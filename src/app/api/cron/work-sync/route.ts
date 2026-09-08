import { cities } from "@/data/cities";
import { cronResponse, requireCron } from "@/server/cron";
import { providers, syncProvider } from "@/server/work/providers";
import { captureError } from "@/services/monitoring";

/**
 * ============================================================================
 * CRON: WORK FEED SYNC
 * ----------------------------------------------------------------------------
 * Runs every configured job feed and records what happened.
 *
 * This route exists because `syncProvider()` had no caller anywhere in the
 * codebase. The sync itself was complete — it fetches, de-duplicates by
 * provider id and again by shape, updates or inserts, and writes a
 * `ProviderRun` carrying the real error text on failure — and nothing ever ran
 * it. A feed added to `STUDENTOS_WORK_FEEDS` would have sat there forever while
 * the admin health screen showed a provider that had never synced.
 *
 * What it does today, honestly: no feed is configured in any environment, so
 * every provider reports itself unconfigured, `syncProvider` writes that run
 * with the reason, and this route answers `{ configured: 0 }`. That is the
 * correct output for a product with no feed partners yet. It is not a no-op
 * dressed up as work.
 *
 * Scheduled daily at 04:17 UTC in `vercel.json`. Daily rather than hourly
 * because Vercel's Hobby plan allows one run a day per job and a schedule the
 * plan rejects fails the deployment; the odd minute keeps it off the top of the
 * hour where everyone else's jobs are. On a Pro plan, tighten the expression to
 * `17 * * * *` and nothing in this file changes.
 * ============================================================================
 */

/** Feeds are network calls against somebody else's server; give them room. */
export const maxDuration = 60;

/** Never cached, never prerendered: it writes rows. */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const refusal = requireCron(request);
  if (refusal) return refusal.response;

  const startedAt = new Date();
  const citySlugs = cities.map((city) => city.slug);
  const all = providers();
  const configured = all.filter((provider) => provider.status().configured);

  let imported = 0;
  let updated = 0;
  let failed = 0;

  for (const provider of configured) {
    try {
      const run = await syncProvider(provider, citySlugs, new Date());
      imported += run.imported;
      updated += run.updated;
      if (!run.ok) failed += 1;
    } catch (error) {
      /* syncProvider records its own failures, so reaching here means the
         store itself refused the write. Count it and keep going: one broken
         provider must not stop the others. */
      failed += 1;
      captureError(error, { route: "cron/work-sync", provider: provider.slug });
    }
  }

  return cronResponse({
    ok: failed === 0,
    job: "work-sync",
    at: startedAt.toISOString(),
    ms: Date.now() - startedAt.getTime(),
    detail: {
      providers: all.length,
      configured: configured.length,
      imported,
      updated,
      failed,
    },
  });
}
