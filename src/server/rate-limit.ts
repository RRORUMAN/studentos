import "server-only";

/**
 * ============================================================================
 * RATE LIMITING
 * ----------------------------------------------------------------------------
 * A fixed-window counter, in process memory.
 *
 * Scope, stated honestly: this stops credential stuffing and accidental
 * hammering from one Node process. It is not a distributed limiter — behind
 * two instances a caller gets two windows. The production deployment puts a
 * Redis or edge limiter in front for that, and this stays as the last line
 * that is always present regardless of infrastructure.
 *
 * It is deliberately *not* backed by the JSON store: a limiter that writes to
 * disk on every attempt turns a login flood into an I/O flood, which is the
 * denial of service it was supposed to prevent.
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

/** Clear a key early — called after a successful sign-in. */
export function resetLimit(key: string): void {
  windows.delete(key);
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
