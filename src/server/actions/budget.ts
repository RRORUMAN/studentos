"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertFeature } from "@/server/entitlements";
import { findMany, insert, newId, nowIso, remove, transaction, update } from "@/server/db";
import { monthKey, suggestEnvelopes } from "@/server/engines/budget";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * BUDGET ACTIONS
 * ----------------------------------------------------------------------------
 * Every mutation the money surface makes.
 *
 * Two things every action here does, without exception:
 *
 *   1. Takes the user id from the session, never from the form. A transaction
 *      carrying its own `userId` would let anyone write to anyone's budget.
 *   2. Converts to integer cents at the boundary. Floats never enter the
 *      database, so nothing downstream has to defend against them.
 *
 * Paid capabilities call `assertFeature` *before* doing any work, so a client
 * that renders past a lock still cannot write.
 * ============================================================================
 */

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Accepts "12,50" and "12.50"; rejects anything that is not a plain amount. */
const amount = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Enter an amount like 12.50")
  .transform((value) => Math.round(Number(value) * 100));

/* -------------------------------------------------------------------------- */
/* Transactions                                                                */
/* -------------------------------------------------------------------------- */

const transactionSchema = z.object({
  amount,
  category: z.string().min(1).max(40),
  merchant: z.string().trim().max(80).optional(),
  note: z.string().trim().max(200).optional(),
  spentAt: z.string().optional(),
});

export async function addTransaction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();

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
    /* A date-only input has no time; anchor it at midday so a timezone shift
       cannot move the transaction into the previous or next day. */
    spentAt: parsed.data.spentAt
      ? new Date(`${parsed.data.spentAt}T12:00:00Z`).toISOString()
      : nowIso(),
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

  revalidatePath("/budget");
  revalidatePath("/home");
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  /* Scoped by user id as well as row id: without it, knowing a uuid would be
     enough to delete someone else's transaction. */
  const removed = await remove("transactions", (row) => row.id === id && row.userId === userId);
  if (removed === 0) return { ok: false, message: "That transaction is already gone." };

  revalidatePath("/budget");
  revalidatePath("/home");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Budget setup                                                                */
/* -------------------------------------------------------------------------- */

export async function setMonthlyBudget(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();

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
  const month = monthKey(new Date());
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
       customised — re-running setup should not silently discard their edits. */
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

  revalidatePath("/budget");
  revalidatePath("/home");
  return { ok: true };
}

/** Edit one envelope. */
export async function setCategoryBudget(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = z
    .object({ category: z.string().min(1).max(40), amount })
    .safeParse({ category: formData.get("category"), amount: formData.get("amount") });

  if (!parsed.success) return { ok: false, message: "Enter an amount like 120." };

  const month = monthKey(new Date());
  const existing = await findMany(
    "envelopes",
    (row) => row.userId === userId && row.month === month && row.category === parsed.data.category,
  );

  if (existing.length > 0) {
    await update("envelopes", (row) => row.id === existing[0].id, {
      plannedCents: parsed.data.amount,
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

  revalidatePath("/budget");
  revalidatePath("/home");
  return { ok: true };
}

/**
 * Add a category the student invented. Starter and above.
 *
 * The entitlement check runs before the write, so hiding the button on the
 * client is a convenience and this is the actual gate.
 */
export async function addCustomCategory(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();

  try {
    await assertFeature(userId, "customBudgetCategories");
  } catch {
    return { ok: false, message: "Custom categories are part of Plus." };
  }

  const parsed = z
    .object({ name: z.string().trim().min(1).max(40), amount })
    .safeParse({ name: formData.get("name"), amount: formData.get("amount") });

  if (!parsed.success) return { ok: false, message: "Give it a name and an amount." };

  await insert("envelopes", {
    id: newId(),
    userId,
    month: monthKey(new Date()),
    category: parsed.data.name.toLowerCase().replace(/\s+/g, "-"),
    plannedCents: parsed.data.amount,
    custom: true,
  });

  revalidatePath("/budget");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Recurring                                                                   */
/* -------------------------------------------------------------------------- */

export async function addRecurring(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = z
    .object({
      label: z.string().trim().min(1).max(60),
      category: z.string().min(1).max(40),
      amount,
      cadence: z.enum(["weekly", "monthly", "termly"]),
      dayOfPeriod: z.coerce.number().int().min(0).max(31),
    })
    .safeParse({
      label: formData.get("label"),
      category: formData.get("category"),
      amount: formData.get("amount"),
      cadence: formData.get("cadence"),
      dayOfPeriod: formData.get("dayOfPeriod"),
    });

  if (!parsed.success) return { ok: false, message: "Check the recurring expense details." };

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

  revalidatePath("/budget");
  revalidatePath("/home");
  return { ok: true };
}

export async function removeRecurring(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  await remove("recurring", (row) => row.id === id && row.userId === userId);
  revalidatePath("/budget");
  revalidatePath("/home");
  return { ok: true };
}
