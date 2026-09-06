"use server";

import { revalidatePath } from "next/cache";

import { nowIso, transaction } from "@/server/db";
import { requireUserId } from "@/server/viewer";

/** Mark one, or every, notification read. Reading is never a paid action. */
export async function markNotificationsRead(id?: string): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const now = nowIso();

  await transaction((db) => {
    for (const row of db.notifications) {
      if (row.userId !== userId || row.readAt !== null) continue;
      if (id && row.id !== id) continue;
      row.readAt = now;
    }
  });

  revalidatePath("/notifications");
  revalidatePath("/home");
  return { ok: true };
}
