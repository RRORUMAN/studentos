/**
 * ============================================================================
 * DATES IN THE CITY'S TIME
 * ----------------------------------------------------------------------------
 * Every time a student sees is in their city's timezone, formatted on the
 * server. Formatting on the client would render in whatever zone the browser
 * happens to be in, and would also hydrate differently from the server — a
 * timeline that says "19:00" on first paint and "18:00" a frame later is
 * worse than either.
 *
 * Pure and dependency-free so it can be unit tested.
 * ============================================================================
 */

const LOCALE = "en-GB";

export function fmtTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}

/** "2026-09-06" in the city's calendar. */
export function dayKey(iso: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(
    typeof iso === "string" ? new Date(iso) : iso,
  );
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * "2026-09" in the city's calendar.
 *
 * The month a spend belongs to, which is the month whose envelope it comes out
 * of. `src/server/engines/budget.ts` had its own `monthKey` built on
 * `getUTCMonth`, so a student in Kyiv buying something at 01:00 on the first
 * had it filed at 22:00 UTC on the last day of the month before — the wrong
 * envelope, in a month they had already closed. Every zone east of UTC has a
 * window like that at each month boundary, and the further east the wider:
 * three hours in Kyiv, thirteen in Auckland.
 *
 * Sorting still works on the string, because the format is fixed-width and
 * big-endian. `src/server/queries/money.ts` compares months with `>=`.
 */
export function monthKey(iso: string | Date, timeZone: string): string {
  return dayKey(iso, timeZone).slice(0, 7);
}

/**
 * Which day of the month it is in the city. 1-31.
 *
 * The companion to `monthKey`, and needed for the same reason: the budget
 * engine paced a month with `now.getUTCDate()`, which is the wrong number for
 * part of every day in every zone that is not UTC. Unlike a wrong month key
 * this one is silent — it is a plausible integer either way — so it does not
 * announce itself, it just makes "day 12 of 30" occasionally mean day 11.
 */
export function dayOfMonth(iso: string | Date, timeZone: string): number {
  return Number(dayKey(iso, timeZone).slice(8, 10));
}

/** "Today", "Tomorrow", "Sat 12 Sep". */
export function fmtDay(iso: string, timeZone: string, now: Date): string {
  const key = dayKey(iso, timeZone);
  if (key === dayKey(now, timeZone)) return "Today";
  if (key === dayKey(new Date(now.getTime() + 86_400_000), timeZone)) return "Tomorrow";
  if (key === dayKey(new Date(now.getTime() - 86_400_000), timeZone)) return "Yesterday";
  return new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(iso));
}

/** "Today 19:00", "Sat 12 Sep 18:00", or just the day for all-day items. */
export function fmtWhen(iso: string, timeZone: string, now: Date, allDay = false): string {
  const day = fmtDay(iso, timeZone, now);
  return allDay ? day : `${day} ${fmtTime(iso, timeZone)}`;
}

/** "Saturday 12 September". */
export function fmtLongDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", timeZone }).format(new Date(iso));
}

/** "12 Sep". Compact, for axis and tooltip labels where the year is implied. */
export function fmtDayLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone }).format(new Date(iso));
}

/** "Sat 12". The weekday and date with no month, for a narrow column. */
export function fmtWeekdayDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", timeZone }).format(new Date(iso));
}

/** "Sat". The weekday alone, for a column header or a saved plan line. */
export function fmtWeekday(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone }).format(new Date(iso));
}

/** "Sat 12 Sep". The day with no "Today" or "Tomorrow" relative wording. */
export function fmtShortDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone }).format(
    new Date(iso),
  );
}

/** "September 2026". The month a reading belongs to, in the city's calendar. */
export function fmtMonth(iso: string | Date, timeZone: string, locale = LOCALE): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );
}

/** Local hour (0-23) in the city, for "tonight" decisions. */
export function hourIn(now: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone }).format(now));
}

/** Local weekday (0 = Sunday) in the city. */
export function weekdayIn(now: Date, timeZone: string): number {
  const label = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}

/** Whole days from now to a date, on the city's calendar. */
export function daysUntil(iso: string, timeZone: string, now: Date): number {
  const [y1, m1, d1] = dayKey(now, timeZone).split("-").map(Number);
  const [y2, m2, d2] = dayKey(iso, timeZone).split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
