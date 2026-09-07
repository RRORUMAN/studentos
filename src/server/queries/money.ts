import "server-only";

import { cache } from "react";

import { placesForCity } from "@/data/places";
import type { Place } from "@/data/types";
import type { Bucket, BucketEntry, Settlement } from "@/domain/social";
import { settleBucket } from "@/domain/social";
import type {
  BudgetSetup,
  Cents,
  CityEvent,
  Id,
  RecurringExpense,
  Transaction,
} from "@/domain/types";
import type {
  BudgetReading,
  DetectedSubscription,
  Forecast,
  SubscriptionsReading,
  Trajectory,
  WeekBar,
  WeeklyTarget,
} from "@/server/engines/budget";
import {
  budgetInsight,
  detectSubscriptions,
  forecast as computeForecast,
  monthKey,
  readBudget,
  settleUpTransfers,
  type SettleTransfer,
  spendTrajectory,
  subscriptionsReading,
  weeklyBars,
  weeklyTarget,
} from "@/server/engines/budget";
import type { Alternative, SavingOpportunity, SpendBenchmark } from "@/server/engines/savings";
import { cheapOptions, findSavings, spendBenchmark } from "@/server/engines/savings";
import { findMany, findOne } from "@/server/db";
import {
  type DealWithConfidence,
  filterEventsByWhen,
  loadCityEvents,
  loadDeals,
} from "@/server/queries/discovery";

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
 * `cache` wraps the loaders because Home renders the money block, the insight
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
  /** Active repeating charges, newest first. */
  recurring: RecurringExpense[];
  /** Next due dates, monthly total and what is still to come out. */
  subscriptions: SubscriptionsReading;
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
    recurring: recurring.filter((row) => row.active),
    subscriptions: subscriptionsReading({ now, recurring, transactions }),
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
/* Charts                                                                      */
/* -------------------------------------------------------------------------- */

export type BudgetCharts = {
  weeks: WeekBar[];
  trajectory: Trajectory;
};

/** The series behind the weekly bars and the forecast sparkline. */
export function chartsFor(snapshot: MoneySnapshot, now: Date): BudgetCharts {
  return {
    weeks: weeklyBars({
      now,
      transactions: snapshot.transactions,
      targetCents: snapshot.week.targetCents,
    }),
    trajectory: spendTrajectory({
      now,
      transactions: snapshot.transactions,
      reading: snapshot.reading,
      forecast: snapshot.forecast,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Spend less                                                                  */
/* -------------------------------------------------------------------------- */

export type SpendLess = {
  /** The drifting discretionary category the block is about. */
  category: string;
  label: string;
  /** Present only when the sample supports a saving claim. */
  opportunity: SavingOpportunity | null;
  /** Cheap places in the category. Used with no saving attached when
      `opportunity` is null. */
  options: Alternative[];
  /** Free things this week that fit the category's evening. */
  freeEvents: CityEvent[];
  deals: DealWithConfidence[];
  /** What students here report paying, when enough of them have. */
  benchmark: SpendBenchmark | null;
};

/**
 * The "spend less" block: one category, and the concrete cheaper things in it.
 *
 * The category is chosen by drift — the discretionary envelope furthest ahead
 * of its own pace — rather than by size, because "you spend a lot on rent" is
 * not an insight and "eating out is €18 ahead of where it should be by the
 * 12th" is.
 */
export async function loadSpendLess(input: {
  userId: string;
  citySlug: string;
  reading: BudgetReading;
  transactions: readonly Transaction[];
  maxWalkMinutes: number;
  now: Date;
  formatMoney: (cents: Cents) => string;
  dealKinds: (category: string) => readonly string[];
}): Promise<SpendLess | null> {
  const drifting = input.reading.categories
    .filter((category) => category.discretionary && category.paceDeltaCents > 0)
    .sort((a, b) => b.paceDeltaCents - a.paceDeltaCents)[0];
  if (!drifting) return null;

  const places = placesForCity(input.citySlug);
  const maxWalkMinutes = input.maxWalkMinutes;

  const [observations, deals, cityEvents] = await Promise.all([
    findMany("priceObservations", (row) => row.citySlug === input.citySlug),
    loadDeals(input.citySlug),
    loadCityEvents(input.citySlug),
  ]);

  const opportunity =
    findSavings({
      now: input.now,
      transactions: input.transactions,
      places,
      priceObservations: observations,
      maxWalkMinutes,
      formatMoney: input.formatMoney,
    }).find((entry) => entry.category === drifting.category) ?? null;

  const kinds = input.dealKinds(drifting.category);

  return {
    category: drifting.category,
    label: drifting.label,
    opportunity,
    options: opportunity
      ? opportunity.alternatives
      : cheapOptions({ category: drifting.category, places, maxWalkMinutes }),
    freeEvents: filterEventsByWhen(cityEvents, "week", input.now)
      .filter((event) => event.priceCents === 0)
      .slice(0, 2),
    deals: deals
      .filter((deal) => kinds.includes(deal.category))
      .filter((deal) => deal.confidence !== "expired" && deal.confidence !== "disputed")
      .slice(0, 2),
    benchmark: spendBenchmark({
      transactions: input.transactions,
      observations,
      category: drifting.category,
      now: input.now,
      formatMoney: input.formatMoney,
    }),
  };
}

/** Cheap real places in one category, for the category detail screen. */
export function cheapPlacesIn(input: {
  citySlug: string;
  category: string;
  maxWalkMinutes: number;
  limit?: number;
}): Alternative[] {
  return cheapOptions({
    category: input.category,
    places: placesForCity(input.citySlug),
    maxWalkMinutes: input.maxWalkMinutes,
    limit: input.limit,
  });
}

/** Every place in the student's city, for the client-side "better option". */
export function placesFor(citySlug: string): Place[] {
  return placesForCity(citySlug);
}

/* -------------------------------------------------------------------------- */
/* Subscription detection (Pro)                                                */
/* -------------------------------------------------------------------------- */

/**
 * Candidate repeating charges from the student's own history.
 *
 * Computed for everyone — it costs a pass over rows already in memory — and
 * the *count* is what a free student is told, so the upsell can be honest
 * about how much there is to find without giving it away.
 */
export function detectedSubscriptions(snapshot: MoneySnapshot, now: Date): DetectedSubscription[] {
  return detectSubscriptions({
    transactions: snapshot.transactions,
    recurring: snapshot.recurring,
    now,
  });
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
/* Shared buckets                                                              */
/* -------------------------------------------------------------------------- */

export type BucketMember = {
  userId: Id;
  displayName: string;
  avatarEmoji: string;
  isViewer: boolean;
};

export type BucketReading = {
  bucket: Bucket;
  entries: (BucketEntry & { paidByName: string })[];
  members: BucketMember[];
  totalCents: Cents;
  settlements: Settlement[];
  transfers: SettleTransfer[];
  /** What the viewer owes (negative) or is owed (positive). */
  viewerNetCents: Cents;
};

/**
 * Buckets the viewer can see: the ones they own, and the ones belonging to a
 * group they are in. Membership drives the split, so it is resolved from the
 * group rather than from who happens to have added an entry — otherwise a
 * flatmate who has not paid for anything yet would silently owe nothing.
 */
export async function loadBuckets(userId: string): Promise<BucketReading[]> {
  const memberships = await findMany("groupMembers", (row) => row.userId === userId);
  const groupIds = new Set(memberships.map((row) => row.groupId));

  const buckets = await findMany(
    "buckets",
    (row) => row.ownerId === userId || (row.groupId !== null && groupIds.has(row.groupId)),
  );
  if (buckets.length === 0) return [];

  const bucketIds = new Set(buckets.map((row) => row.id));
  const [entries, allMembers, profiles] = await Promise.all([
    findMany("bucketEntries", (row) => bucketIds.has(row.bucketId)),
    findMany("groupMembers", (row) => row.groupId !== undefined),
    findMany("profiles", () => true),
  ]);

  const nameOf = new Map(profiles.map((profile) => [profile.userId, profile]));

  const readings = buckets.map((bucket) => {
    const bucketEntries = entries
      .filter((entry) => entry.bucketId === bucket.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const memberIds = bucket.groupId
      ? allMembers.filter((row) => row.groupId === bucket.groupId).map((row) => row.userId)
      : [];
    /* An owner is always a member of their own bucket, and anyone who has
       fronted money is too — a split that leaves a payer out cannot settle. */
    const ids = [...new Set([bucket.ownerId, ...memberIds, ...bucketEntries.map((entry) => entry.paidBy)])];

    const { total, settlements } = settleBucket(bucketEntries, ids);

    return {
      bucket,
      entries: bucketEntries.map((entry) => ({
        ...entry,
        paidByName: nameOf.get(entry.paidBy)?.displayName ?? "Someone",
      })),
      members: ids.map((id) => ({
        userId: id,
        displayName: nameOf.get(id)?.displayName ?? "Someone",
        avatarEmoji: nameOf.get(id)?.avatarEmoji ?? "🙂",
        isViewer: id === userId,
      })),
      totalCents: total,
      settlements,
      transfers: settleUpTransfers(settlements),
      viewerNetCents: settlements.find((row) => row.userId === userId)?.netCents ?? 0,
    };
  });

  return readings.sort((a, b) => {
    const openness = Number(Boolean(a.bucket.closedAt)) - Number(Boolean(b.bucket.closedAt));
    return openness || b.bucket.createdAt.localeCompare(a.bucket.createdAt);
  });
}

/** Groups the viewer belongs to, for the "who is in this bucket" picker. */
export async function loadBucketGroups(userId: string): Promise<{ id: Id; name: string; emoji: string; memberCount: number }[]> {
  const memberships = await findMany("groupMembers", (row) => row.userId === userId);
  if (memberships.length === 0) return [];

  const ids = new Set(memberships.map((row) => row.groupId));
  const [groups, members] = await Promise.all([
    findMany("groups", (row) => ids.has(row.id)),
    findMany("groupMembers", (row) => ids.has(row.groupId)),
  ]);

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    memberCount: members.filter((row) => row.groupId === group.id).length,
  }));
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
