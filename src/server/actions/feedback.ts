"use server";

import { revalidatePath } from "next/cache";

import type { FeedbackKind } from "@/config/feedback";
import { placesForCity } from "@/data/places";
import { emptyMemory, nudgeAffinity } from "@/domain/social";
import { findOne, insert, newId, nowIso, transaction } from "@/server/db";
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

export async function recordFeedback(input: {
  kind: FeedbackKind;
  targetKind: "place" | "event";
  targetId: string;
}): Promise<{ ok: boolean; message: string }> {
  const userId = await requireUserId();
  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  /* Tags and price come from the row, never from the client. */
  let tags: readonly string[] = [];
  let priceCents: number | null = null;
  let walkMinutes: number | null = null;

  if (input.targetKind === "place") {
    const place = placesForCity(profile.citySlug).find((row) => row.id === input.targetId);
    if (!place) return { ok: false, message: "That place is not listed." };
    tags = place.layers.filter((layer) => layer !== "for-you");
    priceCents = place.price === null ? null : Math.round(place.price * 100);
    walkMinutes = place.walkMinutes;
  } else {
    const event = await findOne("events", (row) => row.id === input.targetId);
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
    const direction: 1 | -1 = input.kind === "more" ? 1 : -1;

    if (input.kind === "more" || input.kind === "not-for-me") {
      for (const tag of tags) affinity[tag] = nudgeAffinity(affinity[tag], direction);
    }

    const disliked = new Set(memory.dislikedPlaceIds);
    const liked = new Set(memory.likedPlaceIds);

    if (input.targetKind === "place") {
      if (input.kind === "not-for-me" || input.kind === "been" || input.kind === "wrong") {
        disliked.add(input.targetId);
        liked.delete(input.targetId);
      }
      if (input.kind === "more") {
        liked.add(input.targetId);
        disliked.delete(input.targetId);
      }
    }

    let observedPriceBandCents = memory.observedPriceBandCents;
    if (input.kind === "too-expensive" && priceCents !== null) {
      /* The band moves towards 70% of the price they balked at. */
      const target = Math.round(priceCents * 0.7);
      observedPriceBandCents =
        observedPriceBandCents === null ? target : Math.round((observedPriceBandCents + target) / 2);
    }

    let observedTravelMinutes = memory.observedTravelMinutes;
    if (input.kind === "too-far" && walkMinutes !== null) {
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
  if (input.kind === "wrong") {
    await insert("searchMisses", {
      id: newId(),
      userId,
      citySlug: profile.citySlug,
      intent: `wrong-info:${input.targetKind}:${input.targetId}`,
      surface: "explore",
      resultCount: 0,
      createdAt: nowIso(),
    });
  }

  revalidatePath("/home");
  revalidatePath("/discover");
  revalidatePath("/events");

  const message =
    input.kind === "more"
      ? "Noted. More like this."
      : input.kind === "wrong"
        ? "Thanks. Flagged for a check."
        : "Noted. You will see less of this.";
  return { ok: true, message };
}
