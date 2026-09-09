import { cronResponse, requireCron } from "@/server/cron";
import { eventProviders, syncEventProvider } from "@/server/events/providers";
import { captureError } from "@/services/monitoring";

/**
 * ============================================================================
 * CRON: EVENT CALENDAR SYNC
 * ----------------------------------------------------------------------------
 * Reads every configured iCalendar feed and records what happened.
 *
 * What it does today, honestly: no calendar is configured in any environment,
 * so the single registry entry reports itself unconfigured with the variable
 * that would configure it, `syncEventProvider` writes that run with the reason,
 * and this route answers `{ configured: 0 }`. That is the correct output for a
 * product with no calendar partners yet, and it is not a no-op dressed up as
 * work.
 *
 * Two figures on the response exist to keep the ingest honest rather than to
 * look busy:
 *
 *   `unpriced`   how many entries arrived with no price, which for iCalendar
 *                is all of them. They are stored as zero because
 *                `CityEvent.priceCents` cannot be null, and this count is the
 *                record that zero was a storage constraint rather than a claim
 *                that anything is free.
 *   `flattened`  how many entries carried an RRULE. `parseIcs` deliberately
 *                does not implement recurrence, so only the next occurrence of
 *                each was taken.
 *
 * Scheduled twice daily: calendars change more often than job feeds, and an
 * event that moved room this morning is worth catching before the evening.
 * ============================================================================
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const refusal = requireCron(request);
  if (refusal) return refusal.response;

  const startedAt = new Date();
  const all = eventProviders();
  const configured = all.filter((provider) => provider.status().configured);

  let imported = 0;
  let updated = 0;
  let expired = 0;
  let unpriced = 0;
  let flattened = 0;
  let failed = 0;

  for (const provider of configured) {
    try {
      const run = await syncEventProvider(provider, new Date());
      imported += run.imported;
      updated += run.updated;
      expired += run.expired;
      unpriced += run.unpriced;
      flattened += run.flattenedRecurring;
      if (!run.ok) failed += 1;
    } catch (error) {
      /* `syncEventProvider` records its own failures, so reaching here means
         the store itself refused the write. Count it and keep going: one
         broken calendar must not stop the others. */
      failed += 1;
      captureError(error, { route: "cron/event-sync", provider: provider.slug });
    }
  }

  return cronResponse({
    ok: failed === 0,
    job: "event-sync",
    at: startedAt.toISOString(),
    ms: Date.now() - startedAt.getTime(),
    detail: {
      providers: all.length,
      configured: configured.length,
      imported,
      updated,
      expired,
      unpriced,
      flattened,
      failed,
    },
  });
}
