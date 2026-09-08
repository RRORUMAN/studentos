import "server-only";

import { env } from "@/services/env";

/**
 * ============================================================================
 * SCHEDULED ROUTES
 * ----------------------------------------------------------------------------
 * The one door every cron route goes through.
 *
 * Vercel Cron calls a route over the public internet with
 * `Authorization: Bearer $CRON_SECRET`, so the URL is not a secret and the
 * header is the only thing standing between a scheduled job and anyone who can
 * guess a path. These jobs write rows and, in future, spend money on network
 * calls, so "anyone can trigger this as often as they like" is not an
 * acceptable resting state.
 *
 * Two rules follow from that, and both are deliberate:
 *
 *   1. An unset `CRON_SECRET` closes the route rather than opening it. The
 *      opposite convention — no secret configured means no check — is how a
 *      preview deployment ends up with open endpoints.
 *   2. The comparison is length-safe and constant-time-ish. It is a small thing
 *      against a remote timing attack, but it costs nothing to do properly.
 *
 * Vercel Cron only ever issues GET, so that is the only method a job exports.
 * ============================================================================
 */

export type CronRefusal = { response: Response };

/**
 * Compare without leaking the position of the first difference through timing.
 *
 * Node's `crypto.timingSafeEqual` throws on a length mismatch, which would
 * itself be an oracle, so the lengths are checked first and the loop always
 * runs over the full expected value.
 */
function matches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Returns null when the caller may proceed, or the refusal to return as-is.
 *
 * Both failure modes answer 401 with the same body. A route that said
 * "no secret is configured" would tell an unauthenticated caller something
 * about the deployment's configuration, and there is no reader of that message
 * who is entitled to it.
 */
export function requireCron(request: Request): CronRefusal | null {
  const expected = env.cronSecret;
  const given = request.headers.get("authorization") ?? "";
  const token = given.startsWith("Bearer ") ? given.slice("Bearer ".length) : "";

  if (expected && token && matches(token, expected)) return null;

  return {
    response: Response.json(
      { ok: false, error: "unauthorised" },
      { status: 401, headers: { "cache-control": "no-store" } },
    ),
  };
}

/** The shape every cron route answers with, so a log line is readable. */
export type CronResult = {
  ok: boolean;
  job: string;
  /** ISO timestamp the run started. */
  at: string;
  /** Milliseconds spent. */
  ms: number;
  /** Job-specific counts. Never free text that a monitor has to parse. */
  detail: Record<string, number | string | boolean | null>;
};

export function cronResponse(result: CronResult): Response {
  return Response.json(result, {
    status: result.ok ? 200 : 500,
    headers: { "cache-control": "no-store" },
  });
}
