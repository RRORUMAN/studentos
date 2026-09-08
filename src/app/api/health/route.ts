import packageJson from "../../../../package.json";

import { activeStore, storePing } from "@/server/db";
import { env } from "@/services/env";

/**
 * ============================================================================
 * HEALTH
 * ----------------------------------------------------------------------------
 *   GET /api/health  →  200 { ok: true, ... }   or   503 { ok: false, ... }
 *
 * What an external uptime monitor pings. Public and unauthenticated, because a
 * monitor that needs a credential is a monitor that silently stops working when
 * the credential rotates.
 *
 * It is a real check, not a route that returns 200 because it was reached. It
 * asks the store to prove itself with one small round trip, and answers 503
 * when that fails, so a database outage pages somebody instead of waiting for a
 * student to report that nothing loads.
 *
 * Deliberately not in the response: environment variable names, which
 * integrations are configured, row counts, or the store error text on a public
 * deployment. "Is it up" is what an anonymous caller is entitled to. `/admin`
 * is where the detail lives, behind a sign-in.
 * ============================================================================
 */

export const dynamic = "force-dynamic";

/** A stuck database must not hold the monitor's connection open indefinitely. */
export const maxDuration = 15;

type HealthResponse = {
  ok: boolean;
  /** The application version from package.json. */
  version: string;
  /** The commit this build came from, when the host says. */
  commit: string | null;
  /** production, preview, development, or null off Vercel. */
  environment: string | null;
  /** Which store is serving: `supabase` in production, `file` in development. */
  store: "file" | "supabase";
  /** Whether that store answered, and how long it took. */
  database: { ok: boolean; ms: number };
  at: string;
};

export async function GET(): Promise<Response> {
  const ping = await storePing();

  const body: HealthResponse = {
    ok: ping.ok,
    version: packageJson.version,
    commit: env.hosting.commit,
    environment: env.hosting.environment,
    store: activeStore,
    database: { ok: ping.ok, ms: ping.ms },
    at: new Date().toISOString(),
  };

  if (!ping.ok) {
    /* The real cause goes to the server log, where an operator can read it,
       rather than into a public response body. */
    console.error(`[studentos] health check failed against the ${ping.kind} store: ${ping.error}`);
  }

  return Response.json(body, {
    status: ping.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
