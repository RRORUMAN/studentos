"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { findOne, insert, newId, nowIso, remove, update } from "@/server/db";
import { assertFeature, assertQuota, EntitlementError, QuotaError } from "@/server/entitlements";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * COLLECTIONS
 * ----------------------------------------------------------------------------
 * User-made lists over saved items. The smart collections on the Saved screen
 * are computed and need no rows; these are the ones a student names.
 *
 * Starter and above, enforced here. Collaborative lists are Plus.
 * ============================================================================
 */

export type CollectionResult = { ok: true; id: string } | { ok: false; message: string };

export async function createCollection(formData: FormData): Promise<CollectionResult> {
  const userId = await requireUserId();

  try {
    await assertFeature(userId, "customCollections");
    await assertQuota(userId, "collections");
  } catch (error) {
    if (error instanceof EntitlementError) return { ok: false, message: "Collections are part of Plus." };
    if (error instanceof QuotaError) return { ok: false, message: "That is all the collections your plan allows." };
    return { ok: false, message: "Could not create that." };
  }

  const parsed = z
    .object({
      name: z.string().trim().min(1, "Name it.").max(40),
      emoji: z.string().trim().min(1).max(8).default("📌"),
      collaborative: z.boolean().default(false),
    })
    .safeParse({
      name: formData.get("name"),
      emoji: formData.get("emoji") || "📌",
      collaborative: formData.get("collaborative") === "on",
    });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the name." };

  if (parsed.data.collaborative) {
    try {
      await assertFeature(userId, "collaborativeCollections");
    } catch {
      return { ok: false, message: "Shared collections are part of Pro." };
    }
  }

  const id = newId();
  await insert("collections", {
    id,
    userId,
    name: parsed.data.name,
    emoji: parsed.data.emoji,
    collaborative: parsed.data.collaborative,
    createdAt: nowIso(),
  });

  revalidatePath("/saved");
  return { ok: true, id };
}

export async function moveToCollection(savedId: string, collectionId: string | null): Promise<CollectionResult> {
  const userId = await requireUserId();

  const saved = await findOne("saved", (row) => row.id === savedId && row.userId === userId);
  if (!saved) return { ok: false, message: "That saved item is not yours." };

  if (collectionId) {
    const collection = await findOne("collections", (row) => row.id === collectionId);
    if (!collection) return { ok: false, message: "No such collection." };
    if (collection.userId !== userId && !collection.collaborative) {
      return { ok: false, message: "That collection is not shared." };
    }
  }

  await update("saved", (row) => row.id === savedId, { collectionId });
  revalidatePath("/saved");
  return { ok: true, id: savedId };
}

export async function deleteCollection(collectionId: string): Promise<CollectionResult> {
  const userId = await requireUserId();
  const removed = await remove("collections", (row) => row.id === collectionId && row.userId === userId);
  if (removed === 0) return { ok: false, message: "That collection is not yours." };
  /* Items go back to the flat list rather than disappearing. */
  await update("saved", (row) => row.collectionId === collectionId, { collectionId: null });
  revalidatePath("/saved");
  return { ok: true, id: collectionId };
}
