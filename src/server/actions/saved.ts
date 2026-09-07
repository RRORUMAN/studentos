"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { placesForCity } from "@/data/places";
import type { SavedKind } from "@/domain/types";
import { findOne, insert, newId, nowIso, remove } from "@/server/db";
import { QuotaError, assertQuota } from "@/server/entitlements";
import { recordOutcome } from "@/server/actions/insight";
import { limits, rateLimit } from "@/server/rate-limit";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * SAVING
 * ----------------------------------------------------------------------------
 * Save and unsave places, events, deals, plans, listings and posts.
 *
 * The free tier caps saved items rather than the act of saving, and the cap is
 * checked on the *insert* only. Unsaving is never blocked — a student who hits
 * the limit must be able to make room, and a product that traps you at your
 * quota with no way down is a product people uninstall.
 * ============================================================================
 */

export type SaveResult =
  | { ok: true; saved: boolean }
  | { ok: false; reason: "quota"; used: number; limit: number }
  | { ok: false; reason: "error"; message: string };

const schema = z.object({
  kind: z.enum(["place", "event", "deal", "plan", "listing", "post"]),
  targetId: z.string().trim().min(1).max(120),
});

/** True when a row of that kind with that id exists and the student may save it. */
async function targetExists(kind: SavedKind, targetId: string, citySlug: string): Promise<boolean> {
  switch (kind) {
    case "place":
      return placesForCity(citySlug).some((row) => row.id === targetId);
    case "event":
      return Boolean(await findOne("events", (row) => row.id === targetId));
    case "deal":
      return Boolean(await findOne("deals", (row) => row.id === targetId));
    case "plan":
      return Boolean(await findOne("plans", (row) => row.id === targetId));
    case "listing":
      return Boolean(await findOne("listings", (row) => row.id === targetId));
    case "post":
      return Boolean(await findOne("posts", (row) => row.id === targetId && row.hiddenAt === null));
  }
}

export async function toggleSaved(kind: SavedKind, targetId: string): Promise<SaveResult> {
  const userId = await requireUserId();

  const parsed = schema.safeParse({ kind, targetId });
  if (!parsed.success) return { ok: false, reason: "error", message: "That cannot be saved." };

  const gate = rateLimit(`saved:toggle:${userId}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false, reason: "error", message: "Slow down a moment and try again." };

  const existing = await findOne(
    "saved",
    (row) => row.userId === userId && row.kind === parsed.data.kind && row.targetId === parsed.data.targetId,
  );

  if (existing) {
    await remove("saved", (row) => row.id === existing.id);
    revalidatePath("/saved");
    revalidatePath("/discover");
    revalidatePath("/events");
    return { ok: true, saved: false };
  }

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, reason: "error", message: "Finish setting up your account first." };
  if (!(await targetExists(parsed.data.kind, parsed.data.targetId, profile.citySlug))) {
    return { ok: false, reason: "error", message: "That is not listed any more." };
  }

  try {
    await assertQuota(userId, "savedItems");
  } catch (error) {
    if (error instanceof QuotaError) {
      return { ok: false, reason: "quota", used: error.state.used, limit: error.state.limit ?? 0 };
    }
    return { ok: false, reason: "error", message: "Could not save that." };
  }

  await insert("saved", {
    id: newId(),
    userId,
    kind: parsed.data.kind,
    targetId: parsed.data.targetId,
    collectionId: null,
    note: null,
    createdAt: nowIso(),
  });

  await recordOutcome(parsed.data.kind === "event" ? "event-saved" : "found-place", parsed.data.targetId);

  revalidatePath("/saved");
  revalidatePath("/discover");
  revalidatePath("/events");
  return { ok: true, saved: true };
}
