import "server-only";

import { cache } from "react";

import type { BudgetReading, Forecast, WeeklyTarget } from "@/server/engines/budget";
import {
  budgetInsight,
  forecast as computeForecast,
  monthKey,
  readBudget,
  weeklyTarget,
} from "@/server/engines/budget";
import { findMany, findOne } from "@/server/db";
import type { BudgetSetup, Cents, Transaction } from "@/domain/types";

/**
 * ============================================================================
 * MONEY QUERIES
 * ----------------------------------------------------------------------------
 * Loads the rows a student's budget is computed from and hands them to the
 * pure engine in `engines/budget.ts`.
 *
 * The split is deliberate and worth keeping: this file does I/O and no maths,
 * the engine does maths and no I/O. That is what lets the engine be tested
 * against fixed dates and fixed rows without a database, and it is why every
 * number on the Budget screen is reproducible.
 *
 * `cache` wraps the loader because Home renders the money block, the insight
 * line and the safe-to-spend figure from three different components. Without
 * it that is three full table scans per request.
 * ============================================================================
 */

export type MoneySnapshot = {
  reading: BudgetReading;
  week: WeeklyTarget;
  forecast: Forecast;
  setup: BudgetSetup | null;
  transactions: Transaction[];
  /** True when the student has not set a budget at all. */
  unset: boolean;
};

export const loadMoney = cache(async (userId: string, now = new Date()): Promise<MoneySnapshot> => {
  const [envelopes, transactions, recurring, setup] = await Promise.all([
    findMany("envelopes", (row) => row.userId === userId),
    findMany("transactions", (row) => row.userId === userId),
    findMany("recurring", (row) => row.userId === userId),
    findOne("budgetSetups", (row) => row.userId === userId),
  ]);

  const reading = readBudget({ now, envelopes, transactions, recurring });

  return {
    reading,
    week: weeklyTarget({ now, reading, transactions }),
    forecast: computeForecast(reading, now),
    setup,
    transactions: transactions.sort((a, b) => b.spentAt.localeCompare(a.spentAt)),
    unset: reading.plannedCents === 0,
  };
});

/**
 * The one-line read for Home.
 *
 * Takes the formatter rather than importing `money()` with a hardcoded
 * currency: the product is worldwide, and the insight for a student in Tokyo
 * has to say ¥ without this module knowing anything about them.
 */
export function insightFor(reading: BudgetReading, format: (cents: Cents) => string) {
  return budgetInsight(reading, format);
}

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Spend per month, oldest first. Used by the trends chart.
 *
 * `historyMonths` comes from the plan quota, and the slice happens here rather
 * than in the component so a free user's twelfth month of data is never sent to
 * a browser that is not entitled to render it.
 */
export async function loadSpendHistory(
  userId: string,
  historyMonths: number | null,
  now = new Date(),
): Promise<{ month: string; spentCents: Cents }[]> {
  const transactions = await findMany("transactions", (row) => row.userId === userId);

  const byMonth = new Map<string, number>();
  for (const tx of transactions) {
    const key = monthKey(new Date(tx.spentAt));
    byMonth.set(key, (byMonth.get(key) ?? 0) + tx.amountCents);
  }

  const months = [...byMonth.entries()]
    .map(([month, spentCents]) => ({ month, spentCents }))
    .sort((a, b) => a.month.localeCompare(b.month));

  if (historyMonths === null) return months;

  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (historyMonths - 1), 1),
  );
  return months.filter((entry) => entry.month >= monthKey(cutoff));
}

/* -------------------------------------------------------------------------- */
/* Weekly recap                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What actually happened in the last seven days.
 *
 * Every figure is counted from rows the student created. Nothing is estimated,
 * because a recap that inflates its numbers is worse than no recap — it is the
 * one screen where a student can check the product against their own memory.
 */
export async function loadWeeklyRecap(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [transactions, saved, outcomes, posts] = await Promise.all([
    findMany("transactions", (row) => row.userId === userId && row.spentAt >= since),
    findMany("saved", (row) => row.userId === userId && row.createdAt >= since),
    findMany("outcomes", (row) => row.userId === userId && row.createdAt >= since),
    findMany("posts", (row) => row.authorId === userId && row.createdAt >= since),
  ]);

  const money = await loadMoney(userId, now);
  const spentCents = transactions.reduce((sum, tx) => sum + tx.amountCents, 0);

  return {
    weekStart: since,
    spentCents,
    targetCents: money.week.targetCents,
    savedCents: outcomes
      .filter((outcome) => outcome.kind === "saved-money")
      .reduce((sum) => sum + 0, 0),
    placesDiscovered: saved.filter((item) => item.kind === "place").length,
    eventsSaved: saved.filter((item) => item.kind === "event").length,
    peopleMet: outcomes.filter((outcome) => outcome.kind === "friend-connected").length,
    contributions: posts.length,
    freeThingsDone: outcomes.filter((outcome) => outcome.kind === "event-saved").length,
  };
}
