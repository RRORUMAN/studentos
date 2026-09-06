"use server";

import { revalidatePath } from "next/cache";

import { findOne, insert, newId, nowIso, remove, transaction } from "@/server/db";
import { recordOutcome } from "@/server/actions/insight";
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
 * ============================================================================
 */

export type EventResponseResult =
  | { ok: true; status: "interested" | "going" | null }
  | { ok: false; message: string };

export async function respondToEvent(
  eventId: string,
  status: "interested" | "going" | null,
): Promise<EventResponseResult> {
  const userId = await requireUserId();

  const event = await findOne("events", (row) => row.id === eventId);
  if (!event) return { ok: false, message: "That event is not listed any more." };

  const previous = await findOne(
    "eventResponses",
    (row) => row.eventId === eventId && row.userId === userId,
  );

  await transaction((db) => {
    const index = db.eventResponses.findIndex(
      (row) => row.eventId === eventId && row.userId === userId,
    );
    if (status === null) {
      if (index !== -1) db.eventResponses.splice(index, 1);
      return;
    }
    const row = { eventId, userId, status, respondedAt: nowIso() };
    if (index === -1) db.eventResponses.push(row);
    else db.eventResponses[index] = row;
  });

  /* Going, for the first time, tells friends who have that topic on. */
  if (status === "going" && previous?.status !== "going") {
    const [friends, me, prefs] = await Promise.all([
      loadFriendIds(userId),
      findOne("profiles", (row) => row.userId === userId),
      Promise.resolve(null),
    ]);
    void prefs;

    for (const friendId of friends) {
      const friendPrefs = await findOne("notificationPrefs", (row) => row.userId === friendId);
      if (!friendPrefs?.topics["friends-plans"]) continue;
      await insert("notifications", {
        id: newId(),
        userId: friendId,
        topic: "friends-plans",
        title: `${me?.displayName ?? "A friend"} is going to ${event.title}`,
        body: `${new Date(event.startsAt).toLocaleString("en-GB", {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })} · ${event.venue}`,
        href: `/events/${eventId}`,
        readAt: null,
        createdAt: nowIso(),
      });
    }

    await recordOutcome("event-saved", eventId);
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/home");
  revalidatePath("/plans");
  return { ok: true, status };
}

/** Leave an event entirely: response gone, chat access gone. */
export async function leaveEvent(eventId: string): Promise<EventResponseResult> {
  const userId = await requireUserId();
  await remove("eventResponses", (row) => row.eventId === eventId && row.userId === userId);
  revalidatePath(`/events/${eventId}`);
  return { ok: true, status: null };
}
