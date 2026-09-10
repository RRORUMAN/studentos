import "server-only";

import { missingPriceIds } from "@/server/billing/stripe";
import { activeStore, storePersistence } from "@/server/db";
import { sharedLimiterState } from "@/server/rate-limit-shared";
import { monitoringConfigured, monitoringMisconfigured } from "@/services/monitoring";
import { env, isAiConfigured, isHostedDeployment, isSampleContent } from "@/services/env";

/**
 * ============================================================================
 * INFRASTRUCTURE STATUS
 * ----------------------------------------------------------------------------
 * What is actually connected, for the one screen where the founder finds out
 * before a student does.
 *
 * Every line here is derived from the running process, never from a checklist
 * somebody ticked. "Configured" means the variable is present and the code path
 * that needs it is the one running — which is why the store row reports which
 * store is serving this request rather than whether a Supabase URL is set. The
 * two came apart once already and that is exactly the failure this screen is
 * for.
 *
 * Nothing here returns a secret. A key is reported as present or absent and
 * never echoed, not even truncated: a prefix is enough to identify which key it
 * is, and this page is one screenshot away from a support thread.
 * ============================================================================
 */

export type ServiceLevel = "ready" | "degraded" | "missing";

export type ServiceStatus = {
  key: string;
  label: string;
  level: ServiceLevel;
  /** What is true right now, in one line. */
  state: string;
  /** What it costs the product while it is like this. Null when it costs nothing. */
  consequence: string | null;
  /** Whether a public launch can proceed without it. */
  blocksLaunch: boolean;
};

export type InfrastructureReport = {
  services: ServiceStatus[];
  blockers: ServiceStatus[];
};

/**
 * What a Stripe key is, read from its prefix. Never returns any part of the key.
 *
 * `startsWith("sk_live")` was the whole test here, and it called a RESTRICTED
 * live key — `rk_live_…` — "Test mode." on the one page whose entire job is
 * telling the operator the truth about what is connected. Restricted keys are
 * the right thing to deploy: this application only ever creates checkout and
 * portal sessions and reads a subscription, so a key scoped to those cannot
 * issue a refund or move money if the server is ever compromised. A readiness
 * page that punishes the safer choice by mislabelling it teaches the operator
 * to deploy the more dangerous one.
 */
function describeStripeKey(key: string): { live: boolean; restricted: boolean; label: string } {
  /* Both forms carry the mode in the same place: sk_live_… / rk_live_… /
     pk_test_…, so the substring is the reliable test and the prefix only says
     which kind of key it is. */
  const live = key.includes("_live_");
  const restricted = key.startsWith("rk_");
  return {
    live,
    restricted,
    label: `${live ? "Live" : "Test"} mode${restricted ? ", restricted key" : ""}.`,
  };
}

export async function loadInfrastructure(): Promise<InfrastructureReport> {
  const persistence = await storePersistence();
  const services: ServiceStatus[] = [];

  /* ---- storage ---------------------------------------------------------- */

  if (activeStore === "supabase") {
    services.push({
      key: "storage",
      label: "Database (Supabase)",
      level: "ready",
      state: "Postgres row store. Writes are per row and survive a redeploy.",
      consequence: null,
      blocksLaunch: false,
    });
  } else {
    services.push({
      key: "storage",
      label: "Database (Supabase)",
      level: "missing",
      state:
        persistence === "ephemeral"
          ? "JSON file on this instance's temp directory."
          : "JSON file under .data/ on this machine.",
      consequence:
        persistence === "ephemeral"
          ? "Every account, budget and message is deleted on the next deploy or instance restart."
          : "Fine for development. One process only, and it does not exist on a serverless host.",
      blocksLaunch: true,
    });
  }

  /* ---- content ---------------------------------------------------------- */

  services.push({
    key: "content",
    label: "City content",
    level: isSampleContent ? "degraded" : "ready",
    state: isSampleContent
      ? "Seeded sample events, deals and places. The standing notice is showing."
      : "Declared real. STUDENTOS_CONTENT_MODE=real and storage is durable.",
    consequence: isSampleContent
      ? "Students see invented listings, labelled as such. Fine to launch a waitlist on, not a city."
      : null,
    blocksLaunch: false,
  });

  /* ---- email ------------------------------------------------------------ */

  const emailReady = Boolean(env.resend.apiKey && env.resend.from);
  services.push({
    key: "email",
    label: "Email (Resend)",
    level: emailReady ? "ready" : "missing",
    state: emailReady
      ? `Sending as ${env.resend.from}.`
      : env.resend.apiKey
        ? "RESEND_API_KEY is set but RESEND_FROM is not."
        : "No API key.",
    consequence: emailReady
      ? null
      : isHostedDeployment
        ? "Nobody can reset a forgotten password and no address can be confirmed. Signing up and using the product still work."
        : "Verification and reset links are handed back on screen instead of emailed. Correct here; refused on any deployment.",
    blocksLaunch: !emailReady,
  });

  /* ---- rate limiting ----------------------------------------------------- */

  /**
   * Reported from what the limiter has actually observed, not from whether
   * Supabase is configured — the two came apart the moment migration 0007
   * existed, because a configured database without that function is exactly the
   * state where the app quietly falls back to counting per isolate.
   */
  const limiter = sharedLimiterState();
  services.push({
    key: "rate-limit",
    label: "Rate limiting",
    level: limiter === "ready" ? "ready" : limiter === "unavailable" ? "degraded" : isHostedDeployment ? "degraded" : "ready",
    state:
      limiter === "ready"
        ? "Shared counter in Postgres. Every instance sees one window."
        : limiter === "unavailable"
          ? "studentos_rate_hit did not answer. In-process counter only."
          : "In-process counter only. No shared store configured.",
    consequence:
      limiter === "ready"
        ? null
        : isHostedDeployment
          ? "Each serverless isolate gets its own window, so the sign-in and sign-up ceilings multiply by however many isolates the traffic starts. Apply supabase/migrations/0007_shared_rate_limit.sql."
          : "One process is the whole deployment here, so the in-process counter is the complete picture.",
    blocksLaunch: false,
  });

  /* ---- billing ---------------------------------------------------------- */

  const missingPrices = missingPriceIds();
  const secret = env.stripe.secretKey ? describeStripeKey(env.stripe.secretKey) : null;
  const publishable = env.stripe.publishableKey ? describeStripeKey(env.stripe.publishableKey) : null;

  /**
   * A live secret key beside a test publishable key, or the reverse.
   *
   * Worth its own state because the failure is late and confusing: the server
   * happily creates a live session and the browser refuses it, or the checkout
   * succeeds against test data that will never appear on a real invoice.
   */
  const modeMismatch = Boolean(secret && publishable && secret.live !== publishable.live);

  const billingLevel: ServiceLevel = !secret
    ? "missing"
    : missingPrices.length > 0 || !env.stripe.webhookSecret || modeMismatch
      ? "degraded"
      : "ready";

  services.push({
    key: "billing",
    label: "Payments (Stripe)",
    level: billingLevel,
    state: !secret
      ? "No secret key."
      : [
          secret.label,
          modeMismatch ? `The publishable key is ${publishable?.live ? "live" : "test"} mode.` : null,
          env.stripe.webhookSecret ? "Webhook signing secret set." : "No webhook signing secret.",
          missingPrices.length === 0 ? "All six price ids set." : `Missing: ${missingPrices.join(", ")}.`,
        ]
          .filter(Boolean)
          .join(" "),
    consequence:
      billingLevel === "ready"
        ? null
        : !secret
          ? "Nobody can subscribe. Paid features stay locked, which is the correct failure."
          : modeMismatch
            ? "The two keys are from different modes, so checkout fails at the browser or bills against data the other mode cannot see."
            : missingPrices.length > 0
              ? "Checkout fails for the plans whose price id is missing."
              : "Payments complete but no entitlement is ever granted: the webhook cannot be verified.",
    blocksLaunch: billingLevel !== "ready",
  });

  /* ---- identity --------------------------------------------------------- */

  const googleReady = Boolean(env.google.clientId && env.google.clientSecret);
  services.push({
    key: "google",
    label: "Google sign-in",
    level: googleReady ? "ready" : "missing",
    state: googleReady ? "Client id and secret set." : "Not configured.",
    consequence: googleReady ? null : "Email and password sign-in still works. The button is hidden.",
    blocksLaunch: false,
  });

  services.push({
    key: "site-url",
    label: "Canonical URL",
    level: env.siteUrl ? "ready" : "missing",
    state: env.siteUrl ?? "NEXT_PUBLIC_SITE_URL is not set.",
    consequence: env.siteUrl
      ? null
      : "Share links, the sitemap and the OAuth callback all point at the wrong host.",
    blocksLaunch: true,
  });

  /* ---- ai --------------------------------------------------------------- */

  /**
   * Named after the provider actually resolved, not after whichever vendor was
   * wired first: a panel that says "Anthropic" while the requests go to OpenAI
   * is the same class of untruth as an integration that pretends to work.
   * `keySource` is the variable name, so a key set under the wrong name is
   * visible here rather than at the first 401.
   */
  const aiProvider = env.ai.provider ?? (isAiConfigured ? "anthropic" : "none");
  const aiLabel = aiProvider === "openai" ? "AI (OpenAI)" : aiProvider === "anthropic" ? "AI (Anthropic)" : "AI";

  services.push({
    key: "ai",
    label: aiLabel,
    level: isAiConfigured ? "ready" : "degraded",
    state: isAiConfigured
      ? `Key present from ${env.ai.keySource}, provider ${aiProvider}.`
      : "No key. Every surface answers deterministically.",
    consequence: isAiConfigured
      ? null
      : "Explanations read plainer. Nothing is broken — the product is complete without a model.",
    blocksLaunch: false,
  });

  /* ---- observability ---------------------------------------------------- */

  services.push({
    key: "sentry",
    label: "Errors (Sentry)",
    level: monitoringConfigured ? "ready" : "missing",
    state: monitoringConfigured
      ? `Reporting as ${env.sentry.environment}.`
      : monitoringMisconfigured
        ? "NEXT_PUBLIC_SENTRY_DSN is set but is not a valid DSN."
        : "No DSN. Errors go to the server console.",
    consequence: monitoringConfigured
      ? null
      : monitoringMisconfigured
        ? "Nothing is being sent, while the variable suggests it is. Check the value against Sentry → Client Keys."
        : "A crash in production is only visible if somebody reports it.",
    blocksLaunch: false,
  });

  services.push({
    key: "posthog",
    label: "Analytics (PostHog)",
    level: env.posthog.key ? "ready" : "missing",
    state: env.posthog.key ? `Sending to ${env.posthog.host}.` : "No key.",
    consequence: env.posthog.key ? null : "Funnels and retention on this page come from the database only.",
    blocksLaunch: false,
  });

  /* ---- safety ----------------------------------------------------------- */

  if (env.demoPassword) {
    services.push({
      key: "demo",
      label: "Demo account",
      level: "degraded",
      state: "STUDENTOS_DEMO_PASSWORD is set, so demo@studentos.local exists with a known password.",
      consequence: "Anyone who knows the password has a real account. Correct locally, never in production.",
      blocksLaunch: false,
    });
  }

  if (env.adminEmails.length === 0) {
    services.push({
      key: "admin",
      label: "Admin access",
      level: "missing",
      state: "ADMIN_EMAILS is empty.",
      consequence: "Nobody can reach this page in a fresh deployment.",
      blocksLaunch: true,
    });
  }

  return { services, blockers: services.filter((service) => service.blocksLaunch) };
}
