import "server-only";

import { sharedRateLimit, sharedRateReset } from "@/server/rate-limit-shared";

/**
 * ============================================================================
 * RATE LIMITING
 * ----------------------------------------------------------------------------
 * Two counters. `rateLimit` is a fixed window in process memory, synchronous
 * and always present. `rateLimitShared` is the same window counted in Postgres,
 * so every instance sees one number, and it is what the auth and spend paths
 * use.
 *
 * WHY BOTH. This module used to say: "behind two instances a caller gets two
 * windows. The production deployment puts a Redis or edge limiter in front for
 * that." No such front was ever put there, and the deployment is serverless, so
 * there is no fixed number of instances to reason about — Vercel starts an
 * isolate whenever it wants one, each beginning with an empty Map. `authAttempt:
 * 8 per 15 minutes` was eight attempts per isolate, with the isolate count
 * driven by the attacker's own traffic. In production that is not a limit.
 *
 * The old objection to a stored counter still stands where it was written: "a
 * limiter that writes to disk on every attempt turns a login flood into an I/O
 * flood." That is an argument about the JSON file store, and it is why the
 * shared counter is skipped entirely when the file store is live — which is
 * also the only case where one process really is the whole deployment, so the
 * Map is already the complete truth.
 *
 * WHICH CALLS USE WHICH. Shared costs a round trip, so it is spent where an
 * attacker or a bill is on the other side: sign-in, sign-up, password reset,
 * verification resend, the AI ask, and the two unauthenticated institution
 * endpoints. Everything else is keyed by a user id and already requires an
 * account, and its ceiling is a courtesy rather than a defence.
 * ============================================================================
 */

type Window = { count: number; resetAt: number };

const globalForLimiter = globalThis as unknown as {
  __studentosLimiter?: Map<string, Window>;
};

const windows: Map<string, Window> = (globalForLimiter.__studentosLimiter ??= new Map());

/** Drop expired windows occasionally so the map cannot grow without bound. */
function sweep(now: number): void {
  if (windows.size < 5_000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. Shown to the user when blocked. */
  retryAfterSeconds: number;
};

/**
 * Consume one unit against `key`.
 *
 * Fixed window rather than sliding: a sliding window needs per-request
 * timestamps, and the extra precision buys nothing for the threat this
 * defends against. The burst allowed at a window boundary is bounded by
 * `limit`, which is already sized for it.
 */
export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: windowSeconds };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds,
  };
}

/**
 * The same window, counted once for the whole deployment.
 *
 * The local check runs first and short-circuits: a caller already blocked on
 * this instance is blocked, and asking Postgres to confirm it would spend a
 * round trip per request during exactly the flood the limiter exists for.
 *
 * The two counters are independent, and that is correct rather than a
 * double-charge. Each enforces the same ceiling over a different population —
 * one isolate, and everyone — so a caller is allowed only while both agree.
 * The strict one wins, which is the one that noticed.
 *
 * A null from the shared counter means it has no opinion: not configured, not
 * migrated, or not answering. Then this is the in-process limiter and nothing
 * has regressed — but `/admin` → Services says so rather than showing a
 * protection that is not running.
 */
export async function rateLimitShared(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const local = rateLimit(key, limit, windowSeconds);
  if (!local.ok) return local;

  const shared = await sharedRateLimit(key, limit, windowSeconds);
  if (!shared) return local;

  return {
    ok: shared.ok,
    remaining: Math.min(local.remaining, shared.remaining),
    retryAfterSeconds: shared.retryAfterSeconds,
  };
}

/** Clear a key early — called after a successful sign-in. */
export function resetLimit(key: string): void {
  windows.delete(key);
}

/**
 * Clear a key on every instance.
 *
 * The local half is synchronous and happens first, so the instance handling the
 * request that just succeeded is correct immediately whatever the round trip
 * does.
 */
export async function resetLimitShared(key: string): Promise<void> {
  windows.delete(key);
  await sharedRateReset(key);
}

/**
 * The limits, named in one place.
 *
 * `authAttempt` is per email+action and is intentionally generous enough that
 * a student mistyping a password four times is not locked out of their own
 * budget, while still making an online guessing attack useless.
 */
export const limits = {
  authAttempt: { limit: 8, windowSeconds: 15 * 60 },
  authSignup: { limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { limit: 4, windowSeconds: 60 * 60 },
  aiAsk: { limit: 30, windowSeconds: 60 * 60 },
  post: { limit: 20, windowSeconds: 60 * 60 },
  chat: { limit: 60, windowSeconds: 5 * 60 },
  report: { limit: 20, windowSeconds: 60 * 60 },
} as const;
