"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type LifeOpsSource, type LifeOpsTask, type SnoozePreset, snoozeUntil } from "@/domain/lifeops";
import { findOne, insert, newId, nowIso, remove, transaction, update } from "@/server/db";
import { limits, rateLimit } from "@/server/rate-limit";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * LIFEOPS ACTIONS
 * ----------------------------------------------------------------------------
 * Complete, snooze, reschedule, dismiss, create. Every action takes an item
 * key of the form `<source>:<ref>` (see the engine), validates it, and writes
 * either the custom task itself or an override row for a derived item.
 *
 * Two of these do more than flip a flag, deliberately:
 *
 *   Completing an arrival task writes the same `arrival` row Arrival Mode
 *   writes, so the two screens can never disagree about what is done.
 *
 *   Completing a recurring payment logs a real transaction, so the budget's
 *   safe-to-spend figure moves the moment the student says the rent went out
 *   — a timeline that marks a payment "done" while the budget still counts it
 *   as pending would be two products pretending to be one.
 * ============================================================================
 */

export type LifeOpsResult = { ok: true; message: string; undo?: { key: string } } | { ok: false; message: string };

const KEY = /^(custom|arrival|leaving|mission|event|invite|plan|recurring):([A-Za-z0-9:_-]{1,120})$/;

function parseKey(key: string): { source: LifeOpsSource; ref: string } | null {
  const match = KEY.exec(key);
  if (!match) return null;
  return { source: match[1] as LifeOpsSource, ref: match[2] };
}

function revalidate(): void {
  revalidatePath("/lifeops");
  revalidatePath("/home");
  revalidatePath("/arrival");
  revalidatePath("/leaving");
  revalidatePath("/budget");
}

async function upsertOverride(userId: string, key: string, patch: Partial<Pick<LifeOpsTask, "doneAt" | "snoozedUntil" | "dismissedAt">>, title: string): Promise<void> {
  const parsed = parseKey(key);
  if (!parsed) return;
  const now = nowIso();
  await transaction((db) => {
    const index = db.lifeopsTasks.findIndex((row) => row.userId === userId && row.sourceRef === key);
    if (index === -1) {
      db.lifeopsTasks.push({
        id: newId(),
        userId,
        title,
        detail: null,
        kind: "task",
        dueAt: null,
        allDay: true,
        href: null,
        source: parsed.source,
        sourceRef: key,
        doneAt: null,
        snoozedUntil: null,
        dismissedAt: null,
        createdAt: now,
        updatedAt: now,
        ...patch,
      });
    } else {
      db.lifeopsTasks[index] = { ...db.lifeopsTasks[index], ...patch, updatedAt: now };
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Create                                                                      */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  title: z.string().trim().min(1, "Give it a name.").max(120),
  detail: z.string().trim().max(400).optional().nullable(),
  kind: z.enum(["task", "deadline", "class", "reminder", "payment", "travel", "social"]).default("task"),
  /** ISO string from the client, already in the student's local time. */
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  allDay: z.boolean().default(false),
  repeat: z.enum(["weekly"]).optional().nullable(),
});

export type CreateLifeOpsTaskInput = z.input<typeof createSchema>;

export async function createLifeOpsTask(input: CreateLifeOpsTaskInput): Promise<LifeOpsResult & { id?: string }> {
  const userId = await requireUserId();
  const gate = rateLimit(`lifeops:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the task." };

  const now = nowIso();
  const id = newId();
  await insert("lifeopsTasks", {
    id,
    userId,
    title: parsed.data.title,
    detail: parsed.data.detail ?? null,
    kind: parsed.data.kind,
    dueAt: parsed.data.dueAt ?? null,
    allDay: parsed.data.allDay,
    href: null,
    source: "custom",
    sourceRef: null,
    repeat: parsed.data.repeat ?? null,
    doneAt: null,
    snoozedUntil: null,
    dismissedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  revalidate();
  return { ok: true, message: "Added.", id };
}

/* -------------------------------------------------------------------------- */
/* Complete                                                                    */
/* -------------------------------------------------------------------------- */

export async function completeLifeOpsItem(key: string, input?: { title?: string }): Promise<LifeOpsResult> {
  const userId = await requireUserId();
  const parsed = parseKey(key);
  if (!parsed) return { ok: false, message: "Unknown item." };
  const now = nowIso();

  switch (parsed.source) {
    case "custom": {
      const task = await findOne("lifeopsTasks", (row) => row.id === parsed.ref && row.userId === userId);
      if (!task) return { ok: false, message: "That task is gone." };
      if (task.repeat === "weekly" && task.dueAt) {
        const next = new Date(Date.parse(task.dueAt) + 7 * 86_400_000).toISOString();
        await update("lifeopsTasks", (row) => row.id === task.id, { dueAt: next, snoozedUntil: null, updatedAt: now });
        revalidate();
        return { ok: true, message: "Done. Moved to next week." };
      }
      await update("lifeopsTasks", (row) => row.id === task.id, { doneAt: now, snoozedUntil: null, updatedAt: now });
      revalidate();
      return { ok: true, message: "Done.", undo: { key } };
    }
    case "arrival":
    case "leaving": {
      const existing = await findOne("arrival", (row) => row.userId === userId && row.taskId === parsed.ref);
      if (!existing) await insert("arrival", { userId, taskId: parsed.ref, doneAt: now });
      revalidate();
      return { ok: true, message: "Done.", undo: { key } };
    }
    case "recurring": {
      const [expenseId] = parsed.ref.split(":");
      const expense = await findOne("recurring", (row) => row.id === expenseId && row.userId === userId);
      if (!expense) return { ok: false, message: "That repeating charge is gone." };
      await insert("transactions", {
        id: newId(),
        userId,
        category: expense.category,
        amountCents: expense.amountCents,
        merchant: expense.label,
        note: "Logged from LifeOps",
        spentAt: now,
        source: "recurring",
        receiptId: null,
        createdAt: now,
      });
      await upsertOverride(userId, key, { doneAt: now }, input?.title ?? expense.label);
      revalidate();
      return { ok: true, message: `Logged ${expense.label} as paid.` };
    }
    default:
      return { ok: false, message: "That kind of item is completed where it lives." };
  }
}

export async function uncompleteLifeOpsItem(key: string): Promise<LifeOpsResult> {
  const userId = await requireUserId();
  const parsed = parseKey(key);
  if (!parsed) return { ok: false, message: "Unknown item." };

  if (parsed.source === "custom") {
    await update("lifeopsTasks", (row) => row.id === parsed.ref && row.userId === userId, { doneAt: null, updatedAt: nowIso() });
  } else if (parsed.source === "arrival" || parsed.source === "leaving") {
    await remove("arrival", (row) => row.userId === userId && row.taskId === parsed.ref);
  } else {
    await update("lifeopsTasks", (row) => row.userId === userId && row.sourceRef === key, { doneAt: null, updatedAt: nowIso() });
  }
  revalidate();
  return { ok: true, message: "Back on the list." };
}

/* -------------------------------------------------------------------------- */
/* Snooze, reschedule, dismiss                                                 */
/* -------------------------------------------------------------------------- */

const presetSchema = z.enum(["later", "tomorrow", "weekend", "next-week"]);

export async function snoozeLifeOpsItem(key: string, preset: SnoozePreset, title?: string): Promise<LifeOpsResult> {
  const userId = await requireUserId();
  const parsed = parseKey(key);
  const choice = presetSchema.safeParse(preset);
  if (!parsed || !choice.success) return { ok: false, message: "Unknown item." };

  const until = snoozeUntil(choice.data, new Date()).toISOString();
  if (parsed.source === "custom") {
    const updated = await update("lifeopsTasks", (row) => row.id === parsed.ref && row.userId === userId, { snoozedUntil: until, updatedAt: nowIso() });
    if (!updated) return { ok: false, message: "That task is gone." };
  } else {
    await upsertOverride(userId, key, { snoozedUntil: until }, title ?? key);
  }
  revalidate();
  const label = choice.data === "later" ? "later today" : choice.data === "tomorrow" ? "tomorrow" : choice.data === "weekend" ? "the weekend" : "next week";
  return { ok: true, message: `Snoozed until ${label}.` };
}

export async function rescheduleLifeOpsItem(key: string, dueAtIso: string, allDay: boolean): Promise<LifeOpsResult> {
  const userId = await requireUserId();
  const parsed = parseKey(key);
  const when = z.string().datetime({ offset: true }).safeParse(dueAtIso);
  if (!parsed || parsed.source !== "custom" || !when.success) return { ok: false, message: "Only your own tasks can be rescheduled." };

  const updated = await update("lifeopsTasks", (row) => row.id === parsed.ref && row.userId === userId, {
    dueAt: when.data,
    allDay,
    snoozedUntil: null,
    updatedAt: nowIso(),
  });
  if (!updated) return { ok: false, message: "That task is gone." };
  revalidate();
  return { ok: true, message: "Rescheduled." };
}

export async function dismissLifeOpsItem(key: string, title?: string): Promise<LifeOpsResult> {
  const userId = await requireUserId();
  const parsed = parseKey(key);
  if (!parsed) return { ok: false, message: "Unknown item." };

  if (parsed.source === "custom") {
    await update("lifeopsTasks", (row) => row.id === parsed.ref && row.userId === userId, { dismissedAt: nowIso(), updatedAt: nowIso() });
  } else {
    await upsertOverride(userId, key, { dismissedAt: nowIso() }, title ?? key);
  }
  revalidate();
  return { ok: true, message: "Removed from your timeline.", undo: { key } };
}

/** Undo a dismiss or a completion. */
export async function restoreLifeOpsItem(key: string): Promise<LifeOpsResult> {
  const userId = await requireUserId();
  const parsed = parseKey(key);
  if (!parsed) return { ok: false, message: "Unknown item." };

  if (parsed.source === "custom") {
    await update("lifeopsTasks", (row) => row.id === parsed.ref && row.userId === userId, { dismissedAt: null, doneAt: null, updatedAt: nowIso() });
  } else if (parsed.source === "arrival" || parsed.source === "leaving") {
    await remove("arrival", (row) => row.userId === userId && row.taskId === parsed.ref);
    await remove("lifeopsTasks", (row) => row.userId === userId && row.sourceRef === key);
  } else {
    await remove("lifeopsTasks", (row) => row.userId === userId && row.sourceRef === key);
  }
  revalidate();
  return { ok: true, message: "Restored." };
}

export async function deleteLifeOpsTask(id: string): Promise<LifeOpsResult> {
  const userId = await requireUserId();
  const removed = await remove("lifeopsTasks", (row) => row.id === id && row.userId === userId && row.source === "custom");
  revalidate();
  return removed > 0 ? { ok: true, message: "Deleted." } : { ok: false, message: "That task is gone." };
}
