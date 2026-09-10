import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env, isRowStoreConfigured } from "@/services/env";
import { captureError } from "@/services/monitoring";

/**
 * ============================================================================
 * SHARED RATE LIMIT — the counter every instance can see
 * ----------------------------------------------------------------------------
 * One `insert … on conflict do update … returning` per call, against
 * `studentos_rate_limits`. See `supabase/migrations/0007_shared_rate_limit.sql`
 * for why it is a table and not Redis, and why it is not in the row store.
 *
 * THIS FILE OWNS ITS OWN CLIENT, and that is the deliberate part. The row store
 * is a cache: it loads tables, holds them, polls a revision and reloads what
 * moved. Routing a rate-limit counter through it would drag a counter that is
 * written on every sign-in attempt into a mechanism designed for data that is
 * read far more often than it is written. The client here is a thin one, made
 * once, used for three functions and nothing else.
 *
 * IT NEVER THROWS. A limiter that 500s the sign-in page when the database
 * hiccups has turned a defence into an outage. Every failure returns null and
 * the caller falls back to the in-process counter — which is exactly what the
 * product had before this existed, so the fallback is a known-good state rather
 * than an unprotected one.
 *
 * The one thing it must not do is fail quietly forever. A missing function —
 * migration 0007 not applied — is reported once through `captureError` and then
 * latched, so it costs one failed round trip for the life of the instance
 * instead of one per attempt, and `/admin` → Services says which limiter is
 * actually running.
 * ============================================================================
 */

export type SharedLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Why availability is a tri-state and not a boolean.
 *
 * "Not configured" (no Supabase) and "configured but not answering" are
 * different facts about a deployment and the operator needs to tell them apart:
 * the first is a decision somebody made, the second is a thing that is broken.
 * A boolean would render both as "in-process only".
 */
export type SharedLimiterState = "unconfigured" | "ready" | "unavailable";

/** Set the moment a call succeeds or fails, so /admin reports observed truth. */
let observed: SharedLimiterState = isRowStoreConfigured ? "ready" : "unconfigured";

/** Latched after the first failure, so a missing migration costs one round trip. */
let disabled = false;
let reported = false;

let client: SupabaseClient | null = null;

function connection(): SupabaseClient | null {
  if (client) return client;

  const { url, serviceRoleKey } = env.supabase;
  if (!url || !serviceRoleKey) return null;

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-studentos-store": "rate-limit" } },
  });
  return client;
}

function fail(error: unknown, fn: string): null {
  observed = "unavailable";
  disabled = true;

  if (!reported) {
    reported = true;
    captureError(error, {
      stage: "rate-limit",
      fn,
      note: "falling back to the in-process limiter for the life of this instance",
    });
  }
  return null;
}

/**
 * Consume one unit against `key`, across every instance.
 *
 * Returns null when there is no shared limiter to consult — not configured, not
 * migrated, or not answering. Null means "I have no opinion", never "allowed".
 */
export async function sharedRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<SharedLimitResult | null> {
  if (disabled || !isRowStoreConfigured) return null;

  const supabase = connection();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc("studentos_rate_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) return fail(new Error(`studentos_rate_hit: ${error.message}`), "studentos_rate_hit");

    const row = data as Partial<SharedLimitResult> | null;
    if (!row || typeof row.ok !== "boolean") {
      return fail(new Error("studentos_rate_hit returned no verdict"), "studentos_rate_hit");
    }

    observed = "ready";
    return {
      ok: row.ok,
      remaining: typeof row.remaining === "number" ? row.remaining : 0,
      retryAfterSeconds: typeof row.retryAfterSeconds === "number" ? row.retryAfterSeconds : windowSeconds,
    };
  } catch (error) {
    return fail(error, "studentos_rate_hit");
  }
}

/**
 * Forgive a key everywhere. Called after a successful sign-in.
 *
 * Failure here is genuinely harmless — the window expires on its own — so it is
 * swallowed without latching the limiter off. The counter being forgiven late
 * is not worth disabling the counter over.
 */
export async function sharedRateReset(key: string): Promise<void> {
  if (disabled || !isRowStoreConfigured) return;

  const supabase = connection();
  if (!supabase) return;

  try {
    await supabase.rpc("studentos_rate_reset", { p_key: key });
  } catch {
    /* The window expires on its own. */
  }
}

/** What `/admin` → Services reports. Observed, not inferred from configuration. */
export function sharedLimiterState(): SharedLimiterState {
  return observed;
}
