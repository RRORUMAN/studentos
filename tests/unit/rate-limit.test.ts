import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  limits,
  rateLimit,
  rateLimitShared,
  resetLimit,
  resetLimitShared,
} from "../../src/server/rate-limit.ts";
import { sharedLimiterState } from "../../src/server/rate-limit-shared.ts";

/**
 * ============================================================================
 * RATE LIMITING
 * ----------------------------------------------------------------------------
 * These run with no Supabase configured, which is deliberately the interesting
 * case rather than a limitation of the harness. The shared counter is the half
 * that cannot be tested without a database — `pnpm db:verify` and the migration
 * are what prove that — so what is worth pinning here is the half that decides
 * what happens when the shared counter is absent, unreachable, or has not been
 * migrated. That is the path a deployment actually takes on the day something
 * is wrong, and the thing it must not do is stop limiting silently.
 *
 * Every key is prefixed per test. The window map is module-level and shared
 * between tests in a file, exactly as it is between requests in a process.
 * ============================================================================
 */

describe("fixed window", () => {
  it("allows exactly the limit and refuses the one after it", () => {
    const key = "window:exact";
    const results = [1, 2, 3].map(() => rateLimit(key, 3, 60));

    assert.deepEqual(
      results.map((result) => result.ok),
      [true, true, true],
    );
    assert.equal(results[2].remaining, 0);
    assert.equal(rateLimit(key, 3, 60).ok, false);
  });

  it("keeps counting past the limit without going negative", () => {
    const key = "window:overshoot";
    for (let attempt = 0; attempt < 10; attempt += 1) rateLimit(key, 2, 60);

    const blocked = rateLimit(key, 2, 60);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.remaining, 0);
  });

  it("counts each key separately", () => {
    assert.equal(rateLimit("window:a", 1, 60).ok, true);
    assert.equal(rateLimit("window:b", 1, 60).ok, true);
    assert.equal(rateLimit("window:a", 1, 60).ok, false);
  });

  it("reports a retry that is at most the window and never zero", () => {
    const key = "window:retry";
    rateLimit(key, 1, 30);
    const blocked = rateLimit(key, 1, 30);

    assert.equal(blocked.ok, false);
    assert.ok(blocked.retryAfterSeconds >= 1, `${blocked.retryAfterSeconds}`);
    assert.ok(blocked.retryAfterSeconds <= 30, `${blocked.retryAfterSeconds}`);
  });

  /** A student who mistypes a password and then gets it right is not an attack. */
  it("forgives a key completely", () => {
    const key = "window:forgive";
    rateLimit(key, 1, 60);
    assert.equal(rateLimit(key, 1, 60).ok, false);

    resetLimit(key);
    assert.equal(rateLimit(key, 1, 60).ok, true);
  });

  /**
   * A window that has ended starts a new one rather than staying blocked.
   *
   * Zero seconds means the window closes the instant it opens, which is the
   * boundary this asserts without waiting for a real clock: the second call
   * must see an expired row and start again at one.
   */
  it("starts a new window once the old one has ended", () => {
    const key = "window:rollover";
    assert.equal(rateLimit(key, 1, 0).ok, true);
    assert.equal(rateLimit(key, 1, 0).ok, true);
  });
});

describe("shared limiter, with nothing shared to consult", () => {
  it("says so rather than claiming to be protecting anything", () => {
    assert.equal(sharedLimiterState(), "unconfigured");
  });

  /**
   * THE PROPERTY THAT MATTERS. With no shared counter reachable, the shared
   * entry point must behave exactly like the in-process one — which is what the
   * product had before the shared counter existed, so a database that is absent,
   * unmigrated or down degrades to a known-good limiter rather than to none.
   *
   * The failure this guards against is the opposite mistake: treating "the
   * shared counter had no opinion" as "allowed", which would turn a database
   * outage into an unlimited sign-in endpoint.
   */
  it("falls back to the in-process window, still counting", async () => {
    const key = "shared:fallback";
    assert.equal((await rateLimitShared(key, 2, 60)).ok, true);
    assert.equal((await rateLimitShared(key, 2, 60)).ok, true);

    const blocked = await rateLimitShared(key, 2, 60);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.remaining, 0);
  });

  it("shares the counter with the synchronous call, not a second one beside it", async () => {
    const key = "shared:same-window";
    rateLimit(key, 1, 60);
    assert.equal((await rateLimitShared(key, 1, 60)).ok, false);
  });

  it("forgives locally even when there is nowhere to forward the forgiveness to", async () => {
    const key = "shared:forgive";
    await rateLimitShared(key, 1, 60);
    assert.equal((await rateLimitShared(key, 1, 60)).ok, false);

    await resetLimitShared(key);
    assert.equal((await rateLimitShared(key, 1, 60)).ok, true);
  });
});

describe("the limits themselves", () => {
  /**
   * Not a tautology. These four are the ones an anonymous caller can reach, and
   * a zero or a missing entry is an endpoint with no ceiling — the kind of thing
   * a refactor removes without anything failing.
   */
  it("gives every auth path a real ceiling and a real window", () => {
    for (const name of ["authAttempt", "authSignup", "passwordReset", "aiAsk"] as const) {
      const limit = limits[name];
      assert.ok(limit, `${name} has no limit`);
      assert.ok(limit.limit >= 1, `${name} allows nothing`);
      assert.ok(limit.windowSeconds >= 60, `${name} window is under a minute`);
    }
  });

  /** Guessing a password must be harder than asking for a fresh reset link. */
  it("is stricter about resets than about mistyped passwords", () => {
    assert.ok(limits.passwordReset.limit < limits.authAttempt.limit);
  });
});
