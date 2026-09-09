import { cronResponse, requireCron } from "@/server/cron";
import { findMany, remove } from "@/server/db";
import { pruneCache } from "@/server/places/cache";
import { captureError } from "@/services/monitoring";

/**
 * ============================================================================
 * CRON: DATA UPKEEP
 * ----------------------------------------------------------------------------
 * The things that go stale on their own.
 *
 * Three jobs, each idempotent, each safe to run twice, none of which deletes
 * anything a student wrote:
 *
 *   PLACE CACHE   entries past the point where showing them would be wrong
 *                 rather than merely old. `pruneCache` keeps a fortnight of
 *                 expired entries so an outage can still be answered from
 *                 them; beyond that they are removed.
 *
 *   DEALS         a deal whose `expiresAt` has passed. Deleted rather than
 *                 hidden, because a deal is a claim about now and an expired
 *                 one has no other use.
 *
 *   OPPORTUNITIES a posting past its own stated expiry. The provider said when
 *                 it ends; nothing here decides that a job is old.
 *
 * WHAT IT DOES NOT TOUCH. Events. They are kept forever and filtered by date
 * at read time, so a student can still open the thing they went to last month.
 * Deleting them would silently destroy the history behind every "you went to
 * six things this term" the product will ever want to say.
 *
 * Scheduled daily in `vercel.json`, on a different minute from the work sync so
 * two jobs never contend for the same store revision.
 * ============================================================================
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const refusal = requireCron(request);
  if (refusal) return refusal.response;

  const startedAt = new Date();
  const now = startedAt.getTime();

  let cacheEntries = 0;
  let expiredDeals = 0;
  let expiredJobs = 0;
  let failed = 0;

  try {
    cacheEntries = await pruneCache(startedAt);
  } catch (error) {
    failed += 1;
    captureError(error, { route: "cron/data-upkeep", step: "places" });
  }

  try {
    expiredDeals = await remove(
      "deals",
      (row) => row.expiresAt !== null && Date.parse(row.expiresAt) < now,
    );
  } catch (error) {
    failed += 1;
    captureError(error, { route: "cron/data-upkeep", step: "deals" });
  }

  try {
    /* Only postings that came from a provider AND stated an expiry. A student's
       own posting is theirs to close; nothing here decides it is over. */
    expiredJobs = await remove(
      "opportunities",
      (row) =>
        row.provider !== "students" &&
        row.expiresAt !== null &&
        Date.parse(row.expiresAt) < now,
    );
  } catch (error) {
    failed += 1;
    captureError(error, { route: "cron/data-upkeep", step: "opportunities" });
  }

  /* Reported so the health screen can show what the cache actually holds
     rather than what it held before this ran. */
  const remaining = await findMany("placeCache", () => true).catch(() => []);

  return cronResponse({
    ok: failed === 0,
    job: "data-upkeep",
    at: startedAt.toISOString(),
    ms: Date.now() - startedAt.getTime(),
    detail: {
      placeCachePruned: cacheEntries,
      placeCacheRemaining: remaining.length,
      expiredDeals,
      expiredJobs,
      failed,
    },
  });
}
