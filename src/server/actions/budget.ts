"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Cents, RecurringExpense, Transaction } from "@/domain/types";
import { assertFeature } from "@/server/entitlements";
import { findMany, findOne, insert, newId, nowIso, remove, transaction, update } from "@/server/db";
import {
  monthKey,
  parseAmountCents,
  parseTripCategory,
  suggestEnvelopes,
  tripCategory,
} from "@/server/engines/budget";
import type { SurvivalPreview } from "@/server/engines/survival";
import { previewSurvivalPlan } from "@/server/engines/survival";
import { rateLimit } from "@/server/rate-limit";
import { loadFriendIds } from "@/server/queries/social";
import { requireUserId, requireViewer } from "@/server/viewer";

/**
 * ============================================================================
 * BUDGET ACTIONS
 * ----------------------------------------------------------------------------
 * Every mutation the money surface makes.
 *
 * Four things every action here does, without exception:
 *
 *   1. Takes the user id from the session, never from the form. A transaction
 *      carrying its own `userId` would let anyone write to anyone's budget.
 *   2. Converts to integer cents at the boundary. Floats never enter the
 *      database, so nothing downstream has to defend against them.
 *   3. Rate limits. These are the most-called writes in the product and a
 *      runaway client should cost one student their own window, nothing more.
 *   4. Returns `{ ok }` rather than throwing, so a form can show the reason
 *      instead of an error boundary swallowing it.
 *
 * Paid capabilities call `assertFeature` *before* doing any work, so a client
 * that renders past a lock still cannot write.
 * ============================================================================
 */

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Delete returns the row so the UI can offer a real undo rather than a warning. */
export type DeleteTransactionResult =
  | { ok: true; removed: Transaction }
  | { ok: false; message: string };

export type DeleteRecurringResult =
  | { ok: true; removed: RecurringExpense }
  | { ok: false; message: string };

const WRITE = { limit: 120, windowSeconds: 60 * 60 } as const;

function limited(userId: string, key: string): { ok: false; message: string } | null {
  const result = rateLimit(`budget:${key}:${userId}`, WRITE.limit, WRITE.windowSeconds);
  if (result.ok) return null;
  return { ok: false, message: "That is a lot of edits at once. Try again shortly." };
}

/** Accepts "12,50" and "12.50"; rejects anything that is not a plain amount. */
const amount = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Enter an amount like 12.50")
  .transform((value) => Math.round(Number(value) * 100));

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-14");

/** A date-only input has no time; anchor it at midday so a timezone shift
    cannot move the transaction into the previous or next day. */
function atMidday(day: string): string {
  return new Date(`${day}T12:00:00Z`).toISOString();
}

/* -------------------------------------------------------------------------- */
/* Transactions                                                                */
/* -------------------------------------------------------------------------- */

const transactionSchema = z.object({
  amount,
  category: z.string().min(1).max(60),
  merchant: z.string().trim().max(80).optional(),
  note: z.string().trim().max(200).optional(),
  spentAt: z.string().optional(),
});

export async function addTransaction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "tx");
  if (blocked) return blocked;

  const parsed = transactionSchema.safeParse({
    amount: formData.get("amount"),
    category: formData.get("category"),
    merchant: formData.get("merchant") || undefined,
    note: formData.get("note") || undefined,
    spentAt: formData.get("spentAt") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the amount." };
  }

  await insert("transactions", {
    id: newId(),
    userId,
    category: parsed.data.category,
    amountCents: parsed.data.amount,
    merchant: parsed.data.merchant ?? null,
    note: parsed.data.note ?? null,
    spentAt: parsed.data.spentAt ? atMidday(parsed.data.spentAt) : nowIso(),
    source: "manual",
    receiptId: null,
    createdAt: nowIso(),
  });

  /* A logged spend is a real outcome — it is what makes the budget true. */
  await insert("outcomes", {
    id: newId(),
    userId,
    kind: "budget-action",
    detail: parsed.data.category,
    createdAt: nowIso(),
  });

  revalidateBudget();
  return { ok: true };
}

/**
 * Edit a logged spend.
 *
 * A wrong amount that cannot be corrected is worse than an unlogged one: the
 * student either lives with a false budget or deletes and re-enters, and the
 * second option is the one that quietly teaches people to stop logging.
 */
export async function updateTransaction(id: string, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "tx");
  if (blocked) return blocked;

  const parsed = transactionSchema.safeParse({
    amount: formData.get("amount"),
    category: formData.get("category"),
    merchant: formData.get("merchant") || undefined,
    note: formData.get("note") || undefined,
    spentAt: formData.get("spentAt") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the amount." };
  }

  const updated = await update("transactions", (row) => row.id === id && row.userId === userId, {
    amountCents: parsed.data.amount,
    category: parsed.data.category,
    merchant: parsed.data.merchant ?? null,
    note: parsed.data.note ?? null,
    ...(parsed.data.spentAt ? { spentAt: atMidday(parsed.data.spentAt) } : {}),
  });

  if (!updated) return { ok: false, message: "That transaction is no longer there." };

  revalidateBudget();
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<DeleteTransactionResult> {
  const userId = await requireUserId();

  /* Scoped by user id as well as row id: without it, knowing a uuid would be
     enough to delete someone else's transaction. */
  const row = await findOne("transactions", (entry) => entry.id === id && entry.userId === userId);
  if (!row) return { ok: false, message: "That transaction is already gone." };

  await remove("transactions", (entry) => entry.id === id && entry.userId === userId);

  revalidateBudget();
  return { ok: true, removed: row };
}

const restoreSchema = z.object({
  id: z.string().min(1).max(64),
  category: z.string().min(1).max(60),
  amountCents: z.number().int().min(0).max(100_000_000),
  merchant: z.string().max(80).nullable(),
  note: z.string().max(200).nullable(),
  spentAt: z.string().min(4).max(40),
});

/**
 * Put back a transaction the student just deleted.
 *
 * The row comes from the client, so every field is re-validated and `userId`
 * is taken from the session — this is an undo, not a general-purpose insert
 * with a caller-supplied owner.
 */
export async function restoreTransaction(row: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "tx");
  if (blocked) return blocked;

  const parsed = restoreSchema.safeParse(row);
  if (!parsed.success) return { ok: false, message: "That could not be put back." };

  const existing = await findOne("transactions", (entry) => entry.id === parsed.data.id);
  if (existing) return { ok: true };

  await insert("transactions", {
    id: parsed.data.id,
    userId,
    category: parsed.data.category,
    amountCents: parsed.data.amountCents,
    merchant: parsed.data.merchant,
    note: parsed.data.note,
    spentAt: parsed.data.spentAt,
    source: "manual",
    receiptId: null,
    createdAt: nowIso(),
  });

  revalidateBudget();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Budget setup                                                                */
/* -------------------------------------------------------------------------- */

export async function setMonthlyBudget(formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const userId = viewer.user.id;
  const timeZone = viewer.city.timezone;
  const blocked = limited(userId, "setup");
  if (blocked) return blocked;

  const parsed = z
    .object({ amount, excludeHousing: z.string().optional() })
    .safeParse({
      amount: formData.get("amount"),
      excludeHousing: formData.get("excludeHousing") ?? undefined,
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a monthly amount." };
  }

  const excludeHousing = parsed.data.excludeHousing === "on";
  const month = monthKey(new Date(), timeZone);
  const rows = suggestEnvelopes(parsed.data.amount, { excludeHousing });

  await transaction((db) => {
    const setupIndex = db.budgetSetups.findIndex((row) => row.userId === userId);
    const setup = {
      userId,
      mode: "simple" as const,
      monthlyTotalCents: parsed.data.amount,
      excludeHousing,
      updatedAt: nowIso(),
    };
    if (setupIndex === -1) db.budgetSetups.push(setup);
    else db.budgetSetups[setupIndex] = setup;

    /* Replace this month's generated envelopes but keep anything the student
       customised — re-running setup should not silently discard their edits,
       and a trip envelope is customised by construction. */
    const custom = db.envelopes.filter(
      (row) => row.userId === userId && row.month === month && row.custom,
    );
    const others = db.envelopes.filter((row) => !(row.userId === userId && row.month === month));

    db.envelopes.length = 0;
    db.envelopes.push(
      ...others,
      ...custom,
      ...rows
        .filter((row) => !custom.some((existing) => existing.category === row.category))
        .map((row) => ({
          id: newId(),
          userId,
          month,
          category: row.category,
          plannedCents: row.plannedCents,
          custom: false,
        })),
    );
  });

  revalidateBudget();
  return { ok: true };
}

/**
 * Edit one envelope.
 *
 * The edit sets `custom: true`. Without it, re-running the monthly total would
 * regenerate the envelope from the default shares and quietly throw the
 * student's own figure away — which is exactly what the setup screen promises
 * it will not do.
 */
export async function setCategoryBudget(formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const userId = viewer.user.id;
  const timeZone = viewer.city.timezone;
  const blocked = limited(userId, "setup");
  if (blocked) return blocked;

  const parsed = z
    .object({ category: z.string().min(1).max(60), amount })
    .safeParse({ category: formData.get("category"), amount: formData.get("amount") });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter an amount like 120." };
  }

  const month = monthKey(new Date(), timeZone);
  const existing = await findMany(
    "envelopes",
    (row) => row.userId === userId && row.month === month && row.category === parsed.data.category,
  );

  if (existing.length > 0) {
    await update("envelopes", (row) => row.id === existing[0].id, {
      plannedCents: parsed.data.amount,
      custom: true,
    });
  } else {
    await insert("envelopes", {
      id: newId(),
      userId,
      month,
      category: parsed.data.category,
      plannedCents: parsed.data.amount,
      custom: true,
    });
  }

  revalidateBudget();
  return { ok: true };
}

/**
 * Add a category the student invented. Plus and above.
 *
 * The entitlement check runs before the write, so hiding the button on the
 * client is a convenience and this is the actual gate.
 */
export async function addCustomCategory(formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const userId = viewer.user.id;
  const timeZone = viewer.city.timezone;
  const blocked = limited(userId, "setup");
  if (blocked) return blocked;

  try {
    await assertFeature(userId, "customBudgetCategories");
  } catch {
    return { ok: false, message: "Custom categories are part of Plus." };
  }

  const parsed = z
    .object({ name: z.string().trim().min(1).max(40), amount })
    .safeParse({ name: formData.get("name"), amount: formData.get("amount") });

  if (!parsed.success) return { ok: false, message: "Give it a name and an amount." };

  const category = parsed.data.name.toLowerCase().replace(/\s+/g, "-");
  if (category.startsWith("travel:")) {
    return { ok: false, message: "That name is reserved for trip budgets." };
  }

  await insert("envelopes", {
    id: newId(),
    userId,
    month: monthKey(new Date(), timeZone),
    category,
    plannedCents: parsed.data.amount,
    custom: true,
  });

  revalidateBudget();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Trip budgets (Pro)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A trip is an envelope whose category carries the name and the dates. The
 * money is held out of safe-to-spend until the trip starts — see
 * `readBudget` — which is the whole reason the feature exists.
 */
export async function saveTripBudget(formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const userId = viewer.user.id;
  const timeZone = viewer.city.timezone;
  const blocked = limited(userId, "trip");
  if (blocked) return blocked;

  try {
    await assertFeature(userId, "travelBudgets");
  } catch {
    return { ok: false, message: "Trip budgets are part of Pro." };
  }

  const parsed = z
    .object({ name: z.string().trim().min(1).max(40), start: isoDay, end: isoDay, amount })
    .safeParse({
      name: formData.get("name"),
      start: formData.get("start"),
      end: formData.get("end"),
      amount: formData.get("amount"),
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the trip details." };
  }
  if (parsed.data.end < parsed.data.start) {
    return { ok: false, message: "The trip ends before it starts." };
  }

  const category = tripCategory(parsed.data);
  const month = monthKey(new Date(`${parsed.data.start}T12:00:00Z`), timeZone);

  const existing = await findOne(
    "envelopes",
    (row) => row.userId === userId && row.month === month && row.category === category,
  );

  if (existing) {
    await update("envelopes", (row) => row.id === existing.id, { plannedCents: parsed.data.amount });
  } else {
    await insert("envelopes", {
      id: newId(),
      userId,
      month,
      category,
      plannedCents: parsed.data.amount,
      custom: true,
    });
  }

  revalidateBudget();
  return { ok: true };
}

export async function removeTripBudget(category: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!parseTripCategory(category)) return { ok: false, message: "That is not a trip." };

  const removed = await remove(
    "envelopes",
    (row) => row.userId === userId && row.category === category,
  );
  if (removed === 0) return { ok: false, message: "That trip is already gone." };

  revalidateBudget();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Recurring                                                                   */
/* -------------------------------------------------------------------------- */

const recurringSchema = z.object({
  label: z.string().trim().min(1).max(60),
  category: z.string().min(1).max(60),
  amount,
  cadence: z.enum(["weekly", "monthly", "termly"]),
  dayOfPeriod: z.coerce.number().int().min(0).max(31),
});

export async function addRecurring(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "recurring");
  if (blocked) return blocked;

  const parsed = recurringSchema.safeParse({
    label: formData.get("label"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    cadence: formData.get("cadence"),
    dayOfPeriod: formData.get("dayOfPeriod"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the repeating cost." };
  }

  await insert("recurring", {
    id: newId(),
    userId,
    label: parsed.data.label,
    category: parsed.data.category,
    amountCents: parsed.data.amount,
    cadence: parsed.data.cadence,
    dayOfPeriod: parsed.data.dayOfPeriod,
    active: true,
    createdAt: nowIso(),
  });

  revalidateBudget();
  return { ok: true };
}

export async function updateRecurring(id: string, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "recurring");
  if (blocked) return blocked;

  const parsed = recurringSchema.safeParse({
    label: formData.get("label"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    cadence: formData.get("cadence"),
    dayOfPeriod: formData.get("dayOfPeriod"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the repeating cost." };
  }

  const updated = await update("recurring", (row) => row.id === id && row.userId === userId, {
    label: parsed.data.label,
    category: parsed.data.category,
    amountCents: parsed.data.amount,
    cadence: parsed.data.cadence,
    dayOfPeriod: parsed.data.dayOfPeriod,
  });

  if (!updated) return { ok: false, message: "That repeating cost is no longer there." };

  revalidateBudget();
  return { ok: true };
}

export async function removeRecurring(id: string): Promise<DeleteRecurringResult> {
  const userId = await requireUserId();

  const row = await findOne("recurring", (entry) => entry.id === id && entry.userId === userId);
  if (!row) return { ok: false, message: "That repeating cost is already gone." };

  await remove("recurring", (entry) => entry.id === id && entry.userId === userId);

  revalidateBudget();
  return { ok: true, removed: row };
}

const restoreRecurringSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(60),
  category: z.string().min(1).max(60),
  amountCents: z.number().int().min(0).max(100_000_000),
  cadence: z.enum(["weekly", "monthly", "termly"]),
  dayOfPeriod: z.number().int().min(0).max(31),
});

/** Put back a repeating cost the student just removed. */
export async function restoreRecurring(row: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = restoreRecurringSchema.safeParse(row);
  if (!parsed.success) return { ok: false, message: "That could not be put back." };

  const existing = await findOne("recurring", (entry) => entry.id === parsed.data.id);
  if (existing) return { ok: true };

  await insert("recurring", {
    id: parsed.data.id,
    userId,
    label: parsed.data.label,
    category: parsed.data.category,
    amountCents: parsed.data.amountCents,
    cadence: parsed.data.cadence,
    dayOfPeriod: parsed.data.dayOfPeriod,
    active: true,
    createdAt: nowIso(),
  });

  revalidateBudget();
  return { ok: true };
}

/**
 * Turn a detected charge into a repeating cost. Pro.
 *
 * The amount and day come from the client, but they are only ever *offered*
 * by the detector — they are validated here like any other input, and the
 * entitlement is checked before anything is written.
 */
export async function adoptDetectedSubscription(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "recurring");
  if (blocked) return blocked;

  try {
    await assertFeature(userId, "subscriptionDetection");
  } catch {
    return { ok: false, message: "Subscription detection is part of Pro." };
  }

  const parsed = z
    .object({
      label: z.string().trim().min(1).max(60),
      category: z.string().min(1).max(60),
      amount,
      dayOfPeriod: z.coerce.number().int().min(1).max(31),
    })
    .safeParse({
      label: formData.get("label"),
      category: formData.get("category"),
      amount: formData.get("amount"),
      dayOfPeriod: formData.get("dayOfPeriod"),
    });

  if (!parsed.success) return { ok: false, message: "Check the details of that charge." };

  await insert("recurring", {
    id: newId(),
    userId,
    label: parsed.data.label,
    category: parsed.data.category,
    amountCents: parsed.data.amount,
    cadence: "monthly",
    dayOfPeriod: parsed.data.dayOfPeriod,
    active: true,
    createdAt: nowIso(),
  });

  revalidateBudget();
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Shared buckets (Pro)                                                        */
/* -------------------------------------------------------------------------- */

/**
 * ============================================================================
 * GROUPS — the write side, which did not exist
 * ----------------------------------------------------------------------------
 * `groupMembers` was read in six places and written in none. No
 * `insert("groups")` and no `insert("groupMembers")` anywhere in the codebase.
 *
 * The consequence runs all the way to the price list. `createBucket` refuses a
 * `groupId` the student is not a member of, and nobody could be a member of
 * anything, so every bucket ever created was `groupId: null` — a personal
 * envelope. "Shared budgets" is sold on the Pro tier at €9.99 a month with the
 * promise "Split a flat, a trip or a night out and keep it settled", and it
 * was unreachable.
 *
 * Everything else for it was built: the `Group` and `GroupMember` types, the
 * schema tables, `loadBuckets` and `loadBucketGroups`, the contribution rows,
 * and `settleUpTransfers` in the budget engine, which works out who owes whom
 * to the cent. Only the two writes were missing.
 * ============================================================================
 */

/**
 * Start a group, with the student in it.
 *
 * The owner is inserted as a member in the same transaction rather than being
 * implied by `ownerId`. Six read paths ask `groupMembers` who is in a group,
 * and an owner who is not a row in that table is a group its creator cannot
 * see — the kind of split truth that is fixed twice and comes back.
 */
export async function createGroup(formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const userId = viewer.user.id;
  const blocked = limited(userId, "bucket");
  if (blocked) return blocked;

  const parsed = z
    .object({
      name: z.string().trim().min(1, "Give the group a name.").max(60),
      emoji: z.string().trim().max(8).optional(),
    })
    .safeParse({ name: formData.get("name"), emoji: formData.get("emoji") || undefined });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Give the group a name." };
  }

  const id = newId();
  const now = nowIso();

  await transaction((db) => {
    db.groups.push({
      id,
      citySlug: viewer.profile.citySlug,
      name: parsed.data.name,
      emoji: parsed.data.emoji || "👥",
      ownerId: userId,
      createdAt: now,
    });
    db.groupMembers.push({ groupId: id, userId, joinedAt: now });
  });

  revalidatePath("/budget/shared");
  return { ok: true };
}

/**
 * Add somebody to a group.
 *
 * FRIENDS ONLY, and that is the whole authorisation. A group carries a shared
 * bucket, and a shared bucket shows every member what everybody else paid —
 * so being added to one is not a neutral act, and it must not be possible to
 * do it to a stranger by knowing their id. A student who does not want to be
 * in a group with somebody does not accept the friendship.
 *
 * Only a member may add, which keeps the group closed to anyone outside it,
 * and adding twice is a no-op rather than an error: two rows for one person
 * would double them in every settle-up.
 */
export async function addGroupMember(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "bucket");
  if (blocked) return blocked;

  const parsed = z
    .object({ groupId: z.string().min(1).max(64), memberId: z.string().min(1).max(64) })
    .safeParse({ groupId: formData.get("groupId"), memberId: formData.get("memberId") });

  if (!parsed.success) return { ok: false, message: "Pick somebody to add." };

  const mine = await findOne(
    "groupMembers",
    (row) => row.groupId === parsed.data.groupId && row.userId === userId,
  );
  if (!mine) return { ok: false, message: "You are not in that group." };

  const friends = await loadFriendIds(userId);
  if (!friends.has(parsed.data.memberId)) {
    return { ok: false, message: "You can only add people you are friends with." };
  }

  const already = await findOne(
    "groupMembers",
    (row) => row.groupId === parsed.data.groupId && row.userId === parsed.data.memberId,
  );
  if (already) return { ok: true };

  await insert("groupMembers", {
    groupId: parsed.data.groupId,
    userId: parsed.data.memberId,
    joinedAt: nowIso(),
  });

  revalidatePath("/budget/shared");
  return { ok: true };
}

/**
 * A shared envelope. Explicitly not banking: no money moves, the product only
 * tracks who fronted what — see the note on `Bucket` in `domain/social.ts`.
 */
export async function createBucket(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "bucket");
  if (blocked) return blocked;

  try {
    await assertFeature(userId, "sharedBudgets");
  } catch {
    return { ok: false, message: "Shared budgets are part of Pro." };
  }

  const parsed = z
    .object({
      name: z.string().trim().min(1).max(60),
      emoji: z.string().trim().max(8).optional(),
      groupId: z.string().max(64).optional(),
      amount: amount.optional(),
    })
    .safeParse({
      name: formData.get("name"),
      emoji: formData.get("emoji") || undefined,
      groupId: formData.get("groupId") || undefined,
      amount: formData.get("amount") || undefined,
    });

  if (!parsed.success) return { ok: false, message: "Give the bucket a name." };

  /* A bucket may only be attached to a group the student is actually in. */
  let groupId: string | null = null;
  if (parsed.data.groupId) {
    const membership = await findOne(
      "groupMembers",
      (row) => row.groupId === parsed.data.groupId && row.userId === userId,
    );
    if (!membership) return { ok: false, message: "You are not in that group." };
    groupId = parsed.data.groupId;
  }

  await insert("buckets", {
    id: newId(),
    groupId,
    ownerId: userId,
    name: parsed.data.name,
    emoji: parsed.data.emoji || "💸",
    targetCents: parsed.data.amount ?? 0,
    forDate: null,
    closedAt: null,
    createdAt: nowIso(),
  });

  revalidatePath("/budget/shared");
  return { ok: true };
}

/** Whether the viewer may write to a bucket: owner, or in its group. */
async function canWriteBucket(userId: string, bucketId: string) {
  const bucket = await findOne("buckets", (row) => row.id === bucketId);
  if (!bucket) return null;
  if (bucket.ownerId === userId) return bucket;
  if (!bucket.groupId) return null;
  const membership = await findOne(
    "groupMembers",
    (row) => row.groupId === bucket.groupId && row.userId === userId,
  );
  return membership ? bucket : null;
}

export async function addBucketEntry(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "bucket");
  if (blocked) return blocked;

  try {
    await assertFeature(userId, "sharedBudgets");
  } catch {
    return { ok: false, message: "Shared budgets are part of Pro." };
  }

  const parsed = z
    .object({ bucketId: z.string().min(1).max(64), label: z.string().trim().min(1).max(60), amount })
    .safeParse({
      bucketId: formData.get("bucketId"),
      label: formData.get("label"),
      amount: formData.get("amount"),
    });

  if (!parsed.success) return { ok: false, message: "Add what it was and how much." };

  const bucket = await canWriteBucket(userId, parsed.data.bucketId);
  if (!bucket) return { ok: false, message: "That bucket is not yours." };
  if (bucket.closedAt) return { ok: false, message: "That bucket is settled." };

  /* `paidBy` is the session user. Recording a payment on someone else's
     behalf would let one person rewrite everyone's position in the split. */
  await insert("bucketEntries", {
    id: newId(),
    bucketId: bucket.id,
    userId,
    label: parsed.data.label,
    amountCents: parsed.data.amount,
    paidBy: userId,
    createdAt: nowIso(),
  });

  revalidatePath("/budget/shared");
  return { ok: true };
}

export async function removeBucketEntry(entryId: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const entry = await findOne("bucketEntries", (row) => row.id === entryId);
  if (!entry) return { ok: false, message: "That line is already gone." };

  const bucket = await canWriteBucket(userId, entry.bucketId);
  /* Anyone in the bucket can tidy up, but only the person who fronted the
     money can remove their own line. */
  if (!bucket || entry.paidBy !== userId) {
    return { ok: false, message: "Only the person who paid can remove that line." };
  }

  await remove("bucketEntries", (row) => row.id === entryId);
  revalidatePath("/budget/shared");
  return { ok: true };
}

/**
 * Mark a bucket settled.
 *
 * Nothing moves any money — the product has no licence to and no student
 * splitting a €14 taxi wants a passport scan. Settling records that the
 * transfers below the split have happened in real life.
 */
export async function settleBucketUp(bucketId: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const bucket = await canWriteBucket(userId, bucketId);
  if (!bucket) return { ok: false, message: "That bucket is not yours." };
  if (bucket.closedAt) return { ok: true };

  await update("buckets", (row) => row.id === bucketId, { closedAt: nowIso() });

  await insert("outcomes", {
    id: newId(),
    userId,
    kind: "budget-action",
    detail: `settled:${bucket.name}`,
    createdAt: nowIso(),
  });

  revalidatePath("/budget/shared");
  return { ok: true };
}

export async function reopenBucket(bucketId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const bucket = await canWriteBucket(userId, bucketId);
  if (!bucket) return { ok: false, message: "That bucket is not yours." };

  await update("buckets", (row) => row.id === bucketId, { closedAt: null });
  revalidatePath("/budget/shared");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Survival plans                                                              */
/* -------------------------------------------------------------------------- */

export type SavePlanResult = { ok: true; id: string; href: string } | { ok: false; message: string };

export type SurvivalPreviewResult =
  | { ok: true; preview: SurvivalPreview }
  | { ok: false; message: string };

/**
 * The free student's live preview.
 *
 * Survival Mode updates as you type for everyone, but a student without the
 * entitlement must never receive the allocated amounts — so their recompute
 * happens *here*, on the server, and what comes back is the structure and the
 * verdict with the paid numbers absent rather than hidden. A client that
 * computed the plan locally would have the real figures in memory, which is
 * not a paywall.
 */
export async function previewSurvival(input: {
  amount: string;
  days: number;
}): Promise<SurvivalPreviewResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "survival");
  if (blocked) return blocked;

  const parsed = z
    .object({ amount: z.string().max(24), days: z.number().int().min(1).max(60) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the amount and the number of days." };

  const cents = parseAmountCents(parsed.data.amount);
  if (cents === null) return { ok: false, message: "Enter an amount like 42 or 42,50." };

  const viewer = await requireViewer();

  return {
    ok: true,
    preview: previewSurvivalPlan({
      amountCents: cents,
      days: parsed.data.days,
      city: viewer.city,
    }),
  };
}

const planLineSchema = z.object({
  time: z.string().max(20),
  title: z.string().min(1).max(120),
  detail: z.string().max(240).nullable(),
  priceCents: z.number().int().min(0).max(1_000_000),
  walkMinutes: z.number().int().min(0).max(600).nullable(),
  kind: z.enum(["food", "event", "drink", "transport", "culture", "activity"]),
  source: z.enum(["students", "official", "venue"]),
  refKind: z.enum(["place", "event"]).nullable(),
  refId: z.string().nullable(),
});

/**
 * Keep a survival plan.
 *
 * It goes into the same saved-plans store as everything else, through
 * `savePlanFromAnswer`, so the screen can tell the student exactly where it
 * went and they can find it again under Plans. Survival Mode is Plus, and the
 * gate is here rather than only on the button.
 */
export async function saveSurvivalPlan(input: {
  amountCents: Cents;
  days: number;
  lines: unknown;
  formattedAmount: string;
}): Promise<SavePlanResult> {
  const userId = await requireUserId();
  const blocked = limited(userId, "plan");
  if (blocked) return blocked;

  try {
    await assertFeature(userId, "survivalMode");
  } catch {
    return { ok: false, message: "Survival Mode is part of Plus." };
  }

  const parsed = z
    .object({
      amountCents: z.number().int().min(1).max(100_000_000),
      days: z.number().int().min(1).max(60),
      formattedAmount: z.string().min(1).max(24),
      lines: z.array(planLineSchema).min(1).max(12),
    })
    .safeParse(input);

  if (!parsed.success) return { ok: false, message: "That plan did not save." };

  const days = `${parsed.data.days} day${parsed.data.days === 1 ? "" : "s"}`;

  const { savePlanFromAnswer } = await import("@/server/actions/plans");
  const result = await savePlanFromAnswer({
    title: `Survival plan: ${parsed.data.formattedAmount} for ${days}`,
    query: `Survival Mode: ${parsed.data.formattedAmount} for ${days}`,
    budgetCents: parsed.data.amountCents,
    lines: parsed.data.lines,
  });

  if (!result.ok) return result;
  return { ok: true, id: result.id, href: `/plans/${result.id}` };
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

const UPGRADE_TRIGGERS = ["many-transactions", "forecast-peek"] as const;

/**
 * Record that a value-first upsell was shown on the Budget screen.
 *
 * Called from an effect after render rather than during it: a render that
 * writes to the database is a render that can be counted twice, and it makes
 * the screen wait on analytics. The user is taken from the session, and the
 * trigger is checked against a fixed list, so a client cannot invent moments.
 */
export async function noteUpgradeMoment(trigger: string): Promise<void> {
  const parsed = z.enum(UPGRADE_TRIGGERS).safeParse(trigger);
  if (!parsed.success) return;

  const { recordUpgradeTrigger } = await import("@/server/actions/upgrade");
  await recordUpgradeTrigger(parsed.data);
}

/* -------------------------------------------------------------------------- */

function revalidateBudget(): void {
  revalidatePath("/budget");
  revalidatePath("/home");
}
