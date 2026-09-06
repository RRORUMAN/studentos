"use server";

import { revalidatePath } from "next/cache";

import type { SavedKind } from "@/domain/types";
import { findOne, insert, newId, nowIso, remove } from "@/server/db";
import { QuotaError, assertQuota } from "@/server/entitlements";
import { recordOutcome } from "@/server/actions/insight";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * SAVING
 * ----------------------------------------------------------------------------
 * Save and unsave places, events and deals.
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

export async function toggleSaved(kind: SavedKind, targetId: string): Promise<SaveResult> {
  const userId = await requireUserId();

  const existing = await findOne(
    "saved",
    (row) => row.userId === userId && row.kind === kind && row.targetId === targetId,
  );

  if (existing) {
    await remove("saved", (row) => row.id === existing.id);
    revalidatePath("/saved");
    return { ok: true, saved: false };
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
    kind,
    targetId,
    collectionId: null,
    note: null,
    createdAt: nowIso(),
  });

  await recordOutcome(kind === "event" ? "event-saved" : "found-place", targetId);

  revalidatePath("/saved");
  revalidatePath("/discover");
  revalidatePath("/events");
  return { ok: true, saved: true };
}
