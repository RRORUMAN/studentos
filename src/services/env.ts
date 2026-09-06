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

export const env = {
  /** Set by the host in production; used for canonical URLs and share links. */
  siteUrl: optional(process.env.NEXT_PUBLIC_SITE_URL),

  /** Overrides where the JSON store keeps its file. Set by the e2e config. */
  dataDir: optional(process.env.STUDENTOS_DATA_DIR),

  hosting: {
    /**
     * Serverless platforms mount the deployment read-only; the only writable
     * path is the per-instance temp directory, which is wiped on restart.
     * Vercel, Lambda and Netlify each announce themselves with one variable.
     */
    ephemeralFilesystem: Boolean(
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY,
    ),
  },

  supabase: {
    url: optional(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: optional(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    /** Server-only. Never referenced from a client component. */
    serviceRoleKey: optional(process.env.SUPABASE_SERVICE_ROLE_KEY),
  },

  ai: {
    /** Which provider adapter to construct. */
    provider: optional(process.env.AI_PROVIDER),
    apiKey: optional(process.env.AI_API_KEY),
    model: optional(process.env.AI_MODEL),
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
  adminEmails: (optional(process.env.ADMIN_EMAILS) ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean),
} as const;

/** True when a real backend is wired up. Drives every graceful fallback. */
export const isBackendConfigured = Boolean(env.supabase.url && env.supabase.anonKey);
export const isAiConfigured = Boolean(env.ai.apiKey);
export const isBillingConfigured = Boolean(env.stripe.secretKey);

/**
 * True when the JSON store runs on an ephemeral filesystem, so nothing a
 * student saves outlives the server instance. Deliberately not silenced by
 * `isBackendConfigured`: storage only moves once the Supabase repository exists
 * (see `src/server/db/index.ts`), and a notice about data that is really lost
 * must not be switched off by a key that does not yet change where it goes.
 */
export const isEphemeralStore = env.hosting.ephemeralFilesystem;
