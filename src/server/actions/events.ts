"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveCity } from "@/data/cities";
import { fmtDayLabel, fmtTime } from "@/lib/dates";
import { findOne, insert, newId, nowIso, transaction } from "@/server/db";
import { recordOutcome } from "@/server/actions/insight";
import { limits, rateLimit } from "@/server/rate-limit";
import { loadFriendIds } from "@/server/queries/social";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * EVENT RESPONSES
 * ----------------------------------------------------------------------------
 * Interested and Going. Free at every tier, never metered.
 *
 * Going does two things Interested does not: it opens the event chat, and it
 * tells friends. Both are deliberate — a student who says they are going has
 * made a small public commitment, and the product should make it easy for the
 * people who might join them to see it.
 *
 * Clearing the response (status null) is the only way out of the chat; there
 * is no separate "leave" action, because one path in and one path out is one
 * fewer place for the two to disagree.
 * ============================================================================
 */

/** A city's timezone, falling back to UTC for a city we do not carry. */
const zoneOf = (slug: string) => resolveCity(slug)?.timezone ?? "UTC";

export type EventResponseResult =
  | { ok: true; status: "interested" | "going" | null }
  | { ok: false; message: string };

const responseSchema = z.object({
  eventId: z.string().trim().min(1).max(120),
  status: z.enum(["interested", "going"]).nullable(),
});

export async function respondToEvent(
  eventId: string,
  status: "interested" | "going" | null,
): Promise<EventResponseResult> {
  const userId = await requireUserId();

  const parsed = responseSchema.safeParse({ eventId, status });
  if (!parsed.success) return { ok: false, message: "That response did not make sense." };

  const gate = rateLimit(`events:respond:${userId}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment and try again." };

  const event = await findOne("events", (row) => row.id === parsed.data.eventId);
  if (!event) return { ok: false, message: "That event is not listed any more." };

  const previous = await findOne(
    "eventResponses",
    (row) => row.eventId === event.id && row.userId === userId,
  );

  await transaction((db) => {
    const index = db.eventResponses.findIndex(
      (row) => row.eventId === event.id && row.userId === userId,
    );
    if (parsed.data.status === null) {
      if (index !== -1) db.eventResponses.splice(index, 1);
      return;
    }
    const row = { eventId: event.id, userId, status: parsed.data.status, respondedAt: nowIso() };
    if (index === -1) db.eventResponses.push(row);
    else db.eventResponses[index] = row;
  });

  /* Going, for the first time, tells friends who have that topic on. */
  if (parsed.data.status === "going" && previous?.status !== "going") {
    const [friends, me] = await Promise.all([
      loadFriendIds(userId),
      findOne("profiles", (row) => row.userId === userId),
    ]);

    for (const friendId of friends) {
      const friendPrefs = await findOne("notificationPrefs", (row) => row.userId === friendId);
      if (!friendPrefs?.topics["friends-plans"]) continue;
      await insert("notifications", {
        id: newId(),
        userId: friendId,
        topic: "friends-plans",
        title: `${me?.displayName ?? "A friend"} is going to ${event.title}`,
        /* The EVENT's city, not the server's. This is a push notification about a
           specific gig in a specific place; formatting it in the server zone
           told a student in Madrid to turn up two hours early all summer. */
        body: `${fmtDayLabel(event.startsAt, zoneOf(event.citySlug))} ${fmtTime(event.startsAt, zoneOf(event.citySlug))} · ${event.venue}`,
        href: `/events/${event.id}`,
        readAt: null,
        createdAt: nowIso(),
      });
    }

    await recordOutcome("event-saved", event.id);
  }

  revalidatePath(`/events/${event.id}`);
  revalidatePath("/events");
  revalidatePath("/discover");
  revalidatePath("/home");
  revalidatePath("/plans");
  return { ok: true, status: parsed.data.status };
}
