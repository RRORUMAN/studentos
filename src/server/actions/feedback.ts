"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type FeedbackKind, feedbackOrder } from "@/config/feedback";
import { loadPlace } from "@/server/queries/places";
import { emptyMemory, nudgeAffinity } from "@/domain/social";
import { findOne, insert, newId, nowIso, transaction } from "@/server/db";
import { limits, rateLimit } from "@/server/rate-limit";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * RECOMMENDATION FEEDBACK
 * ----------------------------------------------------------------------------
 * "More like this", "Not for me", "Too expensive", "Too far", "Already been",
 * "Wrong info" — the controls that let a student correct the recommender.
 *
 * Every one writes to the inspectable `Memory` row rather than to an opaque
 * model, so the effect can be seen on the You → Your data screen and reset.
 * The nudges are small on purpose; one tap should tilt the feed, not flip it.
 * ============================================================================
 */

const schema = z.object({
  kind: z.enum(feedbackOrder as readonly [FeedbackKind, ...FeedbackKind[]]),
  targetKind: z.enum(["place", "event"]),
  targetId: z.string().trim().min(1).max(120),
});

export async function recordFeedback(input: {
  kind: FeedbackKind;
  targetKind: "place" | "event";
  targetId: string;
}): Promise<{ ok: boolean; message: string }> {
  const userId = await requireUserId();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That did not make sense." };

  const gate = rateLimit(`feedback:${userId}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment and try again." };

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const { kind, targetKind, targetId } = parsed.data;

  /* Tags and price come from the row, never from the client. */
  let tags: readonly string[] = [];
  let priceCents: number | null = null;
  let walkMinutes: number | null = null;

  if (targetKind === "place") {
    const place = await loadPlace(targetId, profile.citySlug);
    if (!place) return { ok: false, message: "That place is not listed." };
    tags = place.layers.filter((layer) => layer !== "for-you");
    /* Null, not zero. Nobody published a price for this place, and recording a
       zero would make the feedback row say it was free. */
    priceCents = null;
    walkMinutes = place.proximity.minutes;
  } else {
    const event = await findOne("events", (row) => row.id === targetId);
    if (!event) return { ok: false, message: "That event is not listed." };
    tags = [event.kind, ...event.tags];
    priceCents = event.priceCents;
  }

  await transaction((db) => {
    let memory = db.memories.find((row) => row.userId === userId);
    if (!memory) {
      memory = emptyMemory(userId, nowIso());
      db.memories.push(memory);
    }

    const affinity = { ...memory.categoryAffinity };
    const direction: 1 | -1 = kind === "more" ? 1 : -1;

    if (kind === "more" || kind === "not-for-me") {
      for (const tag of tags) affinity[tag] = nudgeAffinity(affinity[tag], direction);
    }

    const disliked = new Set(memory.dislikedPlaceIds);
    const liked = new Set(memory.likedPlaceIds);

    if (targetKind === "place") {
      if (kind === "not-for-me" || kind === "been" || kind === "wrong") {
        disliked.add(targetId);
        liked.delete(targetId);
      }
      if (kind === "more") {
        liked.add(targetId);
        disliked.delete(targetId);
      }
    }

    let observedPriceBandCents = memory.observedPriceBandCents;
    if (kind === "too-expensive" && priceCents !== null) {
      /* The band moves towards 70% of the price they balked at. */
      const target = Math.round(priceCents * 0.7);
      observedPriceBandCents =
        observedPriceBandCents === null ? target : Math.round((observedPriceBandCents + target) / 2);
    }

    let observedTravelMinutes = memory.observedTravelMinutes;
    if (kind === "too-far" && walkMinutes !== null) {
      const target = Math.max(5, walkMinutes - 5);
      observedTravelMinutes =
        observedTravelMinutes === null ? target : Math.min(observedTravelMinutes, target);
    }

    const index = db.memories.findIndex((row) => row.userId === userId);
    db.memories[index] = {
      ...memory,
      categoryAffinity: affinity,
      dislikedPlaceIds: [...disliked],
      likedPlaceIds: [...liked],
      observedPriceBandCents,
      observedTravelMinutes,
      updatedAt: nowIso(),
    };
  });

  /* "Wrong info" is also a report for the data team, classified and counted. */
  if (kind === "wrong") {
    await insert("searchMisses", {
      id: newId(),
      userId,
      citySlug: profile.citySlug,
      intent: `wrong-info:${targetKind}:${targetId}`,
      surface: "explore",
      resultCount: 0,
      createdAt: nowIso(),
    });
  }

  revalidatePath("/home");
  revalidatePath("/discover");
  revalidatePath("/events");

  const message =
    kind === "more"
      ? "Noted. More like this."
      : kind === "wrong"
        ? "Thanks. Flagged for a check."
        : "Noted. You will see less of this.";
  return { ok: true, message };
}
