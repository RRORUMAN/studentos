"use server";

import { revalidatePath } from "next/cache";

import { findOne, insert, nowIso, remove } from "@/server/db";
import { requireUserId } from "@/server/viewer";

/** Toggle one Arrival or Leaving task. Progress is per user, per task id. */
export async function toggleArrivalTask(taskId: string): Promise<{ ok: boolean; done: boolean }> {
  const userId = await requireUserId();

  const existing = await findOne(
    "arrival",
    (row) => row.userId === userId && row.taskId === taskId,
  );

  if (existing) {
    await remove("arrival", (row) => row.userId === userId && row.taskId === taskId);
    revalidatePath("/arrival");
    revalidatePath("/home");
    return { ok: true, done: false };
  }

  await insert("arrival", { userId, taskId, doneAt: nowIso() });
  revalidatePath("/arrival");
  revalidatePath("/home");
  return { ok: true, done: true };
}
