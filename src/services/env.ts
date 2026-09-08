/**
 * ============================================================================
 * ENVIRONMENT
 * ----------------------------------------------------------------------------
 * One typed accessor for every external service. Nothing else in the codebase
 * reads `process.env`.
 *
 * The marketing build runs with all of these unset, which is deliberate: every
 * provider below degrades to a seeded or no-op implementation so an anonymous
 * visitor never triggers a paid API call.
 * ============================================================================
 */

function optional(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

/**
 * A positive integer, or null.
 *
 * A limit that fails to parse becomes "no override" rather than zero. Zero is a
 * meaningful setting here — it means nobody gets any calls — and a typo should
 * not be able to say it.
 */
function positive(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

/**
 * `slug=https://example.org/jobs.json,other=https://...` into typed entries.
 *
 * A malformed pair is dropped rather than thrown: a typo in one feed must not
 * take the whole application down at import time, and the admin screen shows
 * which feeds actually registered.
 */
function parseFeeds(raw: string | null): readonly { slug: string; url: string }[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const at = entry.indexOf("=");
      if (at < 1) return null;
      const slug = entry.slice(0, at).trim();
      const url = entry.slice(at + 1).trim();
      if (!slug || !/^https:\/\//.test(url)) return null;
      return { slug, url };
    })
    .filter((entry): entry is { slug: string; url: string } => entry !== null);
}

/**
 * The origin Vercel gave this particular deployment, as an https origin.
 *
 * `VERCEL_URL` is a bare host with no scheme (`studentos-abc123.vercel.app`),
 * and it is server-only: it is not a `NEXT_PUBLIC_` name, so it exists in a
 * server component and is undefined in the browser. Nothing in a client bundle
 * may read this file, which is the reason that is safe.
 */
function vercelOrigin(): string | null {
  const host = optional(process.env.VERCEL_URL);
  return host ? `https://${host}` : null;
}

export const env = {
  /**
   * Where this deployment thinks it lives. Canonical URLs, share links, the
   * sitemap, robots.txt and the calendar export all read it.
   *
   * The fallback order matters. An explicit `NEXT_PUBLIC_SITE_URL` always
   * wins, because it is the only one that can name a custom domain. Failing
   * that, a preview deployment describes itself with `VERCEL_URL` rather than
   * inheriting production's domain: without this step every preview emitted
   * share links, sitemap entries and .ics URLs pointing at the live site,
   * which is worse than pointing nowhere because it looks like it worked.
   */
  siteUrl: optional(process.env.NEXT_PUBLIC_SITE_URL) ?? vercelOrigin(),

  /** Overrides where the JSON store keeps its file. Set by the e2e config. */
  dataDir: optional(process.env.STUDENTOS_DATA_DIR),

  /**
   * Forces which store serves reads and writes, overriding what the Supabase
   * variables imply.
   *
   * `file` keeps a developer who has production credentials in their shell on
   * the local file. `supabase` refuses to start on the file store, which is
   * what a production deployment should set: a missing variable then fails the
   * boot instead of quietly serving a database that a redeploy deletes.
   */
  storeOverride: ((): "file" | "supabase" | null => {
    const raw = optional(process.env.STUDENTOS_STORE);
    return raw === "file" || raw === "supabase" ? raw : null;
  })(),

  /**
   * Whether the city content in this deployment is real or the seeded sample.
   *
   * Deliberately a declaration rather than an inference. Connecting a database
   * moves where rows live; it does not make an invented event real, and the
   * standing "sample content" notice must not be silenced by a key that had
   * nothing to do with the content. Somebody reviews the cities and sets this.
   */
  contentMode: process.env.STUDENTOS_CONTENT_MODE === "real" ? "real" : "sample",

  /**
   * When set, the seeder creates a fully populated demo student at
   * demo@studentos.local with this password. There is deliberately no default:
   * a seeded account with a known credential is a real account with a
   * published password, and it should only exist where somebody chose it.
   */
  demoPassword: optional(process.env.STUDENTOS_DEMO_PASSWORD),

  hosting: {
    /**
     * Serverless platforms mount the deployment read-only; the only writable
     * path is the per-instance temp directory, which is wiped on restart.
     * Vercel, Lambda and Netlify each announce themselves with one variable.
     */
    ephemeralFilesystem: Boolean(
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY,
    ),

    /** The commit this build came from. Vercel sets it; returned by /api/health. */
    commit: optional(process.env.VERCEL_GIT_COMMIT_SHA),

    /** Which Vercel environment this is: production, preview or development. */
    environment: optional(process.env.VERCEL_ENV),
  },

  /**
   * The shared secret every scheduled route checks before doing any work.
   *
   * Vercel Cron sends it as `Authorization: Bearer <value>`. A route with no
   * secret configured refuses every request rather than running openly: a cron
   * endpoint that anyone can trigger is a way to make the product spend money
   * on demand, and "unset" must therefore mean closed, not open.
   */
  cronSecret: optional(process.env.CRON_SECRET),

  supabase: {
    url: optional(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: optional(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    /** Server-only. Never referenced from a client component. */
    serviceRoleKey: optional(process.env.SUPABASE_SERVICE_ROLE_KEY),
  },

  ai: {
    /**
     * Which provider adapter to construct: "anthropic", "openai" or "none".
     *
     * Unset with an `ANTHROPIC_API_KEY` present means Anthropic. Somebody who
     * has put an Anthropic key in the environment has said which provider they
     * want, and making them say it twice only creates a way to get it wrong.
     */
    provider:
      optional(process.env.AI_PROVIDER) ??
      (optional(process.env.ANTHROPIC_API_KEY) ? "anthropic" : null),

    /**
     * `ANTHROPIC_API_KEY` is the name Anthropic's own tooling uses, so it is
     * the one most likely to already be in a shell or a Vercel project.
     * `AI_API_KEY` stays for the OpenAI-compatible path and wins if both are
     * set, because it is the more specific statement.
     */
    apiKey: optional(process.env.AI_API_KEY) ?? optional(process.env.ANTHROPIC_API_KEY),

    /** Pins one model across every tier. Leave unset to use the per-tier defaults. */
    model: optional(process.env.AI_MODEL),

    /**
     * Per-tier overrides, in the vocabulary of what each tier is for rather
     * than its number: small for classification and tagging, default for
     * ordinary work, planning for the rare deep call.
     */
    models: {
      1: optional(process.env.AI_SMALL_MODEL),
      2: optional(process.env.AI_DEFAULT_MODEL),
      3: optional(process.env.AI_PLANNING_MODEL),
    },

    /** Ceiling on output tokens per call, across every tier. */
    maxTokens: positive(process.env.AI_MAX_TOKENS),

    /**
     * Per-plan daily call ceilings. The soft limit a student is warned about
     * before they reach it; the euro spend caps in `/admin` are the hard one.
     */
    dailyCalls: {
      free: positive(process.env.AI_DAILY_LIMIT_FREE),
      plus: positive(process.env.AI_DAILY_LIMIT_PLUS),
      pro: positive(process.env.AI_DAILY_LIMIT_PRO),
      max: positive(process.env.AI_DAILY_LIMIT_MAX),
    },

    /** For OpenAI-compatible gateways and self-hosted endpoints. */
    baseUrl: optional(process.env.AI_BASE_URL),
  },

  google: {
    clientId: optional(process.env.GOOGLE_CLIENT_ID),
    clientSecret: optional(process.env.GOOGLE_CLIENT_SECRET),
  },

  maps: {
    provider: optional(process.env.NEXT_PUBLIC_MAPS_PROVIDER),
    apiKey: optional(process.env.MAPS_API_KEY),
  },

  stripe: {
    publishableKey: optional(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    secretKey: optional(process.env.STRIPE_SECRET_KEY),
    webhookSecret: optional(process.env.STRIPE_WEBHOOK_SECRET),

    /**
     * The six price ids, one per plan and period.
     *
     * Written out rather than assembled from a template string so that this
     * file remains the complete list of what the product reads from the
     * environment. A name built at runtime is a name that never appears in a
     * grep, which is how `STRIPE_PRICE_PLUS_ANNUAL` can be missing from a
     * deployment and from every checklist that was written by searching.
     */
    prices: {
      plus: {
        monthly: optional(process.env.STRIPE_PRICE_PLUS_MONTHLY),
        annual: optional(process.env.STRIPE_PRICE_PLUS_ANNUAL),
      },
      pro: {
        monthly: optional(process.env.STRIPE_PRICE_PRO_MONTHLY),
        annual: optional(process.env.STRIPE_PRICE_PRO_ANNUAL),
      },
      max: {
        monthly: optional(process.env.STRIPE_PRICE_MAX_MONTHLY),
        annual: optional(process.env.STRIPE_PRICE_MAX_ANNUAL),
      },
    },
  },

  posthog: {
    key: optional(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    host: optional(process.env.NEXT_PUBLIC_POSTHOG_HOST) ?? "https://eu.posthog.com",
  },

  sentry: {
    dsn: optional(process.env.NEXT_PUBLIC_SENTRY_DSN),
    environment: optional(process.env.SENTRY_ENVIRONMENT) ?? process.env.NODE_ENV,
  },

  resend: {
    apiKey: optional(process.env.RESEND_API_KEY),
    from: optional(process.env.RESEND_FROM),
  },

  /**
   * Comma-separated addresses granted admin. Kept in the environment rather
   * than as a database flag on purpose: promoting yourself to admin should
   * require a deploy, not a row edit.
   */
  /**
   * Job feeds StudentOS is permitted to read, as a comma-separated list of
   * `slug=url` pairs.
   *
   * Unset by default and unset in every deployment so far, which is the honest
   * state: there is no partner feed yet. The admin provider-health screen says
   * "not configured" rather than showing a sync that never ran, and the Work
   * board is filled by students, employers and clearly-labelled sample rows.
   *
   * This is the only way an external source can enter the product. There is no
   * scraper and no crawler: a site that has not published a feed or an API has
   * not agreed to be republished, and its terms are not ours to reinterpret.
   */
  workFeeds: parseFeeds(optional(process.env.STUDENTOS_WORK_FEEDS)),

  adminEmails: (optional(process.env.ADMIN_EMAILS) ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean),
} as const;

/**
 * True when reads and writes go to Postgres rather than a local file.
 *
 * The service role key is part of the test, not decoration. The store is
 * reached only from the server and only with that key; a deployment holding a
 * URL and an anon key has given the browser a key and given the server nothing,
 * and it must not be reported as connected.
 */
export const isRowStoreConfigured =
  env.storeOverride === "file"
    ? false
    : env.storeOverride === "supabase" || Boolean(env.supabase.url && env.supabase.serviceRoleKey);

/** True when a real backend is wired up. Drives every graceful fallback. */
export const isBackendConfigured = isRowStoreConfigured;
export const isAiConfigured = Boolean(env.ai.apiKey);
export const isBillingConfigured = Boolean(env.stripe.secretKey);

/**
 * True when the store runs on an ephemeral filesystem, so nothing a student
 * saves outlives the server instance.
 *
 * A serverless host mounts the deployment read-only and wipes its temp
 * directory on restart, so the file store there loses everything on a redeploy.
 * Connecting the row store is exactly what fixes it, which is why this is the
 * one flag Supabase credentials are allowed to silence — the data really does
 * outlive the instance now. The sample-content notice is a different claim and
 * is not silenced here; see `contentMode`.
 */
export const isEphemeralStore = env.hosting.ephemeralFilesystem && !isRowStoreConfigured;

/**
 * True when the product is answering from the seeded sample content.
 *
 * Both halves have to be false to drop the notice: the content has to have been
 * declared real, and it has to be stored somewhere that a redeploy does not
 * delete. Declaring real content on an ephemeral file store would be a claim
 * about rows that are about to disappear.
 */
export const isSampleContent = env.contentMode === "sample" || isEphemeralStore;
