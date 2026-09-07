import { env } from "@/services/env";

/**
 * ============================================================================
 * MONITORING — Sentry
 * ----------------------------------------------------------------------------
 * Sends errors to Sentry over its envelope endpoint with `fetch`, and falls
 * back to the console when no DSN is set.
 *
 * Why not `@sentry/nextjs`: the SDK's value is automatic instrumentation —
 * tracing, breadcrumbs, session replay — and every one of those captures more
 * context than this product is willing to send. Budget amounts, chat contents,
 * home coordinates and CV text all pass through these servers, and an SDK that
 * attaches request bodies by default is one upgrade away from putting them in a
 * third party's database. Forty lines of `fetch` sends exactly what `scrub()`
 * allows and nothing else.
 *
 * The previous version of this file was a no-op with a comment saying the SDK
 * was wired up "in the product build". It was not, and the shape of the bug was
 * the dangerous kind: with a DSN set it returned early *without even logging*,
 * so configuring Sentry made errors disappear more thoroughly than not
 * configuring it. Anything here that cannot send must say so on the console.
 * ============================================================================
 */

type Context = Record<string, string | number | boolean | null | undefined>;

/**
 * Never sent, whatever a caller passes.
 *
 * Substring matching, not exact keys, so `homeLat`, `totalAmount` and
 * `userEmail` are all caught. Over-matching here costs a little context on an
 * error report; under-matching puts a student's location in a vendor's search
 * index.
 */
const FORBIDDEN_KEYS = [
  "lat",
  "lng",
  "coord",
  "balance",
  "amount",
  "budget",
  "email",
  "token",
  "secret",
  "key",
  "password",
  "address",
  "body",
  "message",
  "content",
];

function scrub(context?: Context): Context {
  if (!context) return {};
  return Object.fromEntries(
    Object.entries(context).filter(
      ([key]) => !FORBIDDEN_KEYS.some((forbidden) => key.toLowerCase().includes(forbidden)),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* The DSN                                                                     */
/* -------------------------------------------------------------------------- */

type Endpoint = { url: string; publicKey: string };

/**
 * `https://<publicKey>@<host>/<projectId>` into somewhere to POST.
 *
 * Parsed once. A malformed DSN resolves to null and everything falls back to
 * the console rather than throwing — a monitoring layer that can crash the
 * request it was meant to report on is worse than no monitoring.
 */
const endpoint: Endpoint | null = (() => {
  if (!env.sentry.dsn) return null;
  try {
    const dsn = new URL(env.sentry.dsn);
    const projectId = dsn.pathname.replace(/^\//, "");
    if (!dsn.username || !projectId) return null;
    return {
      url: `${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/`,
      publicKey: dsn.username,
    };
  } catch {
    return null;
  }
})();

/** Whether errors actually leave this process. Reported in `/admin`. */
export const monitoringConfigured = endpoint !== null;

/**
 * True when a DSN was provided but could not be understood — the one state that
 * would otherwise look identical to "not configured" while somebody believes
 * they configured it.
 */
export const monitoringMisconfigured = Boolean(env.sentry.dsn) && endpoint === null;

/* -------------------------------------------------------------------------- */
/* Sending                                                                     */
/* -------------------------------------------------------------------------- */

type Level = "error" | "warning";

function describe(error: unknown): { type: string; value: string; stack?: string } {
  if (error instanceof Error) {
    return { type: error.name, value: error.message, stack: error.stack };
  }
  return { type: "UnknownError", value: String(error) };
}

/**
 * Fire and forget, with a hard timeout.
 *
 * An error report must never delay the response that produced it, and it must
 * never become a second failure. Every path here swallows: a monitoring outage
 * is not something a student should be able to see.
 */
function send(level: Level, error: unknown, context: Context, message?: string): void {
  if (!endpoint) return;

  const eventId = crypto.randomUUID().replace(/-/g, "");
  const timestamp = new Date().toISOString();
  const { type, value, stack } = describe(error);

  const event = {
    event_id: eventId,
    timestamp,
    platform: "javascript",
    level,
    logger: "studentos",
    environment: env.sentry.environment ?? "production",
    /* `server_name` deliberately omitted: on Vercel it is the instance id, and
       it identifies nothing anybody debugging this would use. */
    exception: {
      values: [{ type, value: message ?? value, stacktrace: stack ? { frames: [] } : undefined }],
    },
    /* The stack as a plain string rather than parsed frames. Sentry renders it
       fine and it avoids shipping a source-map pipeline for a product where the
       stack is already readable. */
    extra: { ...context, ...(stack ? { stack } : {}) },
  };

  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: timestamp }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);

  void fetch(`${endpoint.url}?sentry_key=${endpoint.publicKey}&sentry_version=7`, {
    method: "POST",
    headers: { "content-type": "application/x-sentry-envelope" },
    body: envelope,
    signal: controller.signal,
    keepalive: true,
  })
    .catch(() => {
      /* Report the failure to report, on the console, once. Silence here is
         how a team discovers three months later that nothing was arriving. */
      console.error("[monitoring] could not reach Sentry:", type, value);
    })
    .finally(() => clearTimeout(timer));
}

export function captureError(error: unknown, context?: Context): void {
  const safe = scrub(context);

  if (endpoint) {
    send("error", error, safe);
    return;
  }

  if (monitoringMisconfigured) {
    console.error("[monitoring] NEXT_PUBLIC_SENTRY_DSN is set but is not a valid DSN.");
  }

  /* No DSN: the console is the only place left, and an unreported error is
     worse than a noisy log in every environment, not just development. */
  console.error("[monitoring]", error, safe);
}

export function captureMessage(message: string, context?: Context): void {
  const safe = scrub(context);

  if (endpoint) {
    send("warning", new Error(message), safe, message);
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[monitoring]", message, safe);
  }
}
