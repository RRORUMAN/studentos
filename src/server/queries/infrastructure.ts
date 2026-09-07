import "server-only";

import { missingPriceIds } from "@/server/billing/stripe";
import { activeStore, storePersistence } from "@/server/db";
import { monitoringConfigured, monitoringMisconfigured } from "@/services/monitoring";
import { env, isAiConfigured, isSampleContent } from "@/services/env";

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
      : "Verification links are printed on screen instead of emailed, so anyone can verify any address.",
    blocksLaunch: !emailReady,
  });

  /* ---- billing ---------------------------------------------------------- */

  const missingPrices = missingPriceIds();
  const billingLevel: ServiceLevel = !env.stripe.secretKey
    ? "missing"
    : missingPrices.length > 0 || !env.stripe.webhookSecret
      ? "degraded"
      : "ready";

  services.push({
    key: "billing",
    label: "Payments (Stripe)",
    level: billingLevel,
    state: !env.stripe.secretKey
      ? "No secret key."
      : [
          env.stripe.secretKey.startsWith("sk_live") ? "Live mode." : "Test mode.",
          env.stripe.webhookSecret ? "Webhook signing secret set." : "No webhook signing secret.",
          missingPrices.length === 0
            ? "All six price ids set."
            : `Missing: ${missingPrices.join(", ")}.`,
        ].join(" "),
    consequence:
      billingLevel === "ready"
        ? null
        : !env.stripe.secretKey
          ? "Nobody can subscribe. Paid features stay locked, which is the correct failure."
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

  services.push({
    key: "ai",
    label: "AI (Anthropic)",
    level: isAiConfigured ? "ready" : "degraded",
    state: isAiConfigured
      ? `Key present, provider ${env.ai.provider ?? "anthropic"}.`
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
