import "server-only";

import { deliveryFor, type NotificationTopic } from "@/domain/types";
import { findMany, findOne, insert, newId, nowIso } from "@/server/db";

/**
 * ============================================================================
 * NOTIFICATIONS
 * ----------------------------------------------------------------------------
 * One door for creating a notification, and it is the only place that decides
 * whether one is created at all.
 *
 * Four rules, all enforced here rather than at the twelve call sites:
 *
 *   PREFERENCE   the topic must be switched on for that student. A row written
 *                past a preference is worse than no notification system: it
 *                teaches people the switches are decorative.
 *   DELIVERY     "off" writes nothing. "digest" writes the row but marks it so
 *                a daily send can batch it. "instant" is the default.
 *   QUIET HOURS  a row created inside quiet hours is held as a digest item
 *                rather than surfacing immediately. The rows already carried
 *                `quietFrom`/`quietTo` and nothing read them.
 *   DEDUPE       one notification per (user, topic, key) per window. Without
 *                this, anything computed on read fires again on every reload.
 *
 * Sending — email or push — is a separate concern and is not implemented:
 * `src/services/email` returns `not-implemented` honestly rather than
 * pretending. These rows are the in-app inbox, which is real.
 * ============================================================================
 */

export type NotifyInput = {
  userId: string;
  topic: NotificationTopic;
  title: string;
  body: string;
  href: string | null;
  /**
   * Stable identity for the thing being announced: `budget-pace:2026-09-07`,
   * `free-events:2026-09-07`. Used to dedupe within `withinHours`.
   */
  key: string;
  /** Do not repeat this key inside this many hours. Default one day. */
  withinHours?: number;
};

/** Local hour for the student, in their city's timezone. */
function hourIn(now: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone }).format(now));
}

function inQuietHours(hour: number, from: number, to: number): boolean {
  /* Quiet hours wrap midnight in the normal case (23 to 8). */
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/**
 * Create a notification, or decide not to. Returns whether a row was written,
 * so a caller computing several can report how many landed.
 */
export async function notify(input: NotifyInput, options?: { timeZone?: string; now?: Date }): Promise<boolean> {
  const now = options?.now ?? new Date();
  const prefs = await findOne("notificationPrefs", (row) => row.userId === input.userId);

  const delivery = deliveryFor(prefs, input.topic);
  if (delivery === "off") return false;

  const quiet =
    prefs && options?.timeZone
      ? inQuietHours(hourIn(now, options.timeZone), prefs.quietFrom, prefs.quietTo)
      : false;

  /* Dedupe. The key is embedded in the body-free `href`-independent identity,
     so a caller cannot accidentally write two rows for the same fact by
     phrasing the title differently. */
  const withinMs = (input.withinHours ?? 24) * 3_600_000;
  const since = new Date(now.getTime() - withinMs).toISOString();
  const existing = await findMany(
    "notifications",
    (row) => row.userId === input.userId && row.topic === input.topic && row.createdAt >= since,
  );
  const tag = `[${input.key}]`;
  if (existing.some((row) => row.body.endsWith(tag))) return false;

  await insert("notifications", {
    id: newId(),
    userId: input.userId,
    topic: input.topic,
    title: input.title,
    /* The key rides at the end of the body and is stripped on render. Keeping
       it on the row rather than in a second column means the JSON store and
       Postgres agree without a migration for a debugging aid. */
    body: `${input.body} ${tag}`,
    href: input.href,
    /* A digest item, or one raised during quiet hours, is created already
       "read" so it does not light the bell in the middle of the night; the
       daily digest is what surfaces it. */
    readAt: delivery === "digest" || quiet ? nowIso() : null,
    createdAt: nowIso(),
  });

  return true;
}

/** Strip the dedupe tag for display. */
export function notificationBody(body: string): string {
  return body.replace(/\s*\[[^\]]+\]$/, "");
}
