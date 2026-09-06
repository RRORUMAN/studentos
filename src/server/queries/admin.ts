import "server-only";

import type { PlanKey } from "@/config/pricing";
import { intentLabel, needGapMeta } from "@/domain/insight";
import { effectivePlan } from "@/domain/types";
import { all, findMany } from "@/server/db";

/**
 * ============================================================================
 * ADMIN METRICS
 * ----------------------------------------------------------------------------
 * The numbers the business is actually run on.
 *
 * The headline is deliberately **weekly useful outcomes per active user**, not
 * DAU. A student who opens the app forty times and gets nothing is a failure
 * that a session metric scores as a triumph, and steering by that number is how
 * products end up optimising for anxiety.
 *
 * The AI cost block exists so the margin question can be answered directly:
 * cost per user, per plan, and — the one that matters most — what share of work
 * was served at Tier 0 with no model call at all.
 * ============================================================================
 */

const DAY = 86_400_000;

export type AdminMetrics = {
  users: { total: number; dau: number; wau: number; mau: number };
  retention: { d1: number; d7: number; d30: number };
  plans: Record<PlanKey, number>;
  revenue: { mrrCents: number; paidUsers: number; conversion: number };
  outcomes: {
    weekly: number;
    perActiveUser: number;
    byKind: { kind: string; count: number }[];
  };
  ai: {
    calls: number;
    tierZeroShare: number;
    cacheHitRate: number;
    costMicros: number;
    costPerUserMicros: number;
    byPlan: { plan: PlanKey; calls: number; costMicros: number }[];
    byOperation: { operation: string; calls: number; costMicros: number }[];
  };
  community: { posts: number; comments: number; chat: number; invites: number; joins: number };
  cities: { citySlug: string; users: number }[];
};

const PRICE_CENTS: Record<PlanKey, number> = { free: 0, plus: 799, pro: 999, max: 1499 };

export async function loadAdminMetrics(): Promise<AdminMetrics> {
  const now = Date.now();

  const [users, profiles, subscriptions, outcomes, aiUsage, posts, comments, chat, invites, responses] =
    await Promise.all([
      all("users"),
      all("profiles"),
      all("subscriptions"),
      all("outcomes"),
      all("aiUsage"),
      all("posts"),
      all("comments"),
      all("chat"),
      all("invites"),
      all("inviteResponses"),
    ]);

  /* ---- activity --------------------------------------------------------- */
  const activeSince = (ms: number) =>
    users.filter((user) => now - Date.parse(user.lastSeenAt) < ms).length;

  /* ---- retention -------------------------------------------------------- */
  /* Share of accounts that came back at least once after N days. Computed from
     outcome rows rather than sessions: coming back and doing nothing is not
     retention in any sense worth measuring. */
  const returnedAfter = (days: number) => {
    const cohort = users.filter((user) => now - Date.parse(user.createdAt) > days * DAY);
    if (cohort.length === 0) return 0;

    const kept = cohort.filter((user) =>
      outcomes.some(
        (outcome) =>
          outcome.userId === user.id &&
          Date.parse(outcome.createdAt) - Date.parse(user.createdAt) >= days * DAY,
      ),
    );
    return Math.round((kept.length / cohort.length) * 100);
  };

  /* ---- plans ------------------------------------------------------------ */
  const plans: Record<PlanKey, number> = { free: 0, plus: 0, pro: 0, max: 0 };
  for (const user of users) {
    const subscription = subscriptions.find((row) => row.userId === user.id) ?? null;
    plans[effectivePlan(subscription)] += 1;
  }

  const paidUsers = plans.plus + plans.pro + plans.max;
  const mrrCents =
    plans.plus * PRICE_CENTS.plus +
    plans.pro * PRICE_CENTS.pro +
    plans.max * PRICE_CENTS.max;

  /* ---- outcomes --------------------------------------------------------- */
  const weekAgo = now - 7 * DAY;
  const weekly = outcomes.filter((row) => Date.parse(row.createdAt) >= weekAgo);
  const wau = activeSince(7 * DAY);

  const byKind = Object.entries(
    weekly.reduce<Record<string, number>>((acc, row) => {
      acc[row.kind] = (acc[row.kind] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);

  /* ---- AI --------------------------------------------------------------- */
  const tierZero = aiUsage.filter((row) => row.tier === 0).length;
  const cacheHits = aiUsage.filter((row) => row.cacheHit).length;
  const costMicros = aiUsage.reduce((sum, row) => sum + row.costMicros, 0);

  const byPlan = (Object.keys(plans) as PlanKey[]).map((plan) => {
    const rows = aiUsage.filter((row) => row.plan === plan);
    return {
      plan,
      calls: rows.length,
      costMicros: rows.reduce((sum, row) => sum + row.costMicros, 0),
    };
  });

  const byOperation = Object.entries(
    aiUsage.reduce<Record<string, { calls: number; costMicros: number }>>((acc, row) => {
      acc[row.operation] ??= { calls: 0, costMicros: 0 };
      acc[row.operation].calls += 1;
      acc[row.operation].costMicros += row.costMicros;
      return acc;
    }, {}),
  )
    .map(([operation, value]) => ({ operation, ...value }))
    .sort((a, b) => b.costMicros - a.costMicros);

  /* ---- cities ----------------------------------------------------------- */
  const cities = Object.entries(
    profiles.reduce<Record<string, number>>((acc, profile) => {
      acc[profile.citySlug] = (acc[profile.citySlug] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([citySlug, count]) => ({ citySlug, users: count }))
    .sort((a, b) => b.users - a.users);

  return {
    users: {
      total: users.length,
      dau: activeSince(DAY),
      wau,
      mau: activeSince(30 * DAY),
    },
    retention: { d1: returnedAfter(1), d7: returnedAfter(7), d30: returnedAfter(30) },
    plans,
    revenue: {
      mrrCents,
      paidUsers,
      conversion: users.length === 0 ? 0 : Math.round((paidUsers / users.length) * 100),
    },
    outcomes: {
      weekly: weekly.length,
      perActiveUser: wau === 0 ? 0 : Math.round((weekly.length / wau) * 10) / 10,
      byKind,
    },
    ai: {
      calls: aiUsage.length,
      tierZeroShare: aiUsage.length === 0 ? 0 : Math.round((tierZero / aiUsage.length) * 100),
      cacheHitRate: aiUsage.length === 0 ? 0 : Math.round((cacheHits / aiUsage.length) * 100),
      costMicros,
      costPerUserMicros: users.length === 0 ? 0 : Math.round(costMicros / users.length),
      byPlan,
      byOperation,
    },
    community: {
      posts: posts.length,
      comments: comments.length,
      chat: chat.length,
      invites: invites.length,
      joins: responses.filter((row) => row.status === "in").length,
    },
    cities,
  };
}

/* -------------------------------------------------------------------------- */
/* Feature Lab                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What students asked for and did not get.
 *
 * This is the product's own discovery mechanism: instead of guessing what to
 * build next, it reads the aggregated intents behind every failed search. The
 * raw queries were never stored — see `recordSearchMiss` — so this is demand
 * without surveillance.
 */
export type NeedRow = {
  id: string;
  intent: string;
  label: string;
  citySlug: string;
  gap: string;
  gapLabel: string;
  gapAction: string;
  hits: number;
  tag: string | null;
  lastSeenAt: string;
};

export async function loadUnmetNeeds(): Promise<NeedRow[]> {
  const needs = await findMany("unmetNeeds", () => true);

  return needs
    .map((need) => ({
      id: need.id,
      intent: need.intent,
      label: intentLabel(need.intent),
      citySlug: need.citySlug,
      gap: need.gap,
      gapLabel: needGapMeta[need.gap].label,
      gapAction: needGapMeta[need.gap].action,
      hits: need.hits,
      tag: need.tag,
      lastSeenAt: need.lastSeenAt,
    }))
    .sort((a, b) => b.hits - a.hits);
}

/* -------------------------------------------------------------------------- */
/* Upgrade triggers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Which moments convert. A trigger "converted" when the student it was shown
 * to is on a paid plan now and was free when it fired. Counted per trigger,
 * shown next to the total, so a moment that fires often and never converts is
 * visible as exactly that.
 */
export type TriggerRow = { trigger: string; feature: string; shown: number; converted: number; rate: number };

export async function loadUpgradeTriggerStats(): Promise<TriggerRow[]> {
  const [rows, subscriptions] = await Promise.all([all("upgradeTriggers"), all("subscriptions")]);
  const planNow = new Map(subscriptions.map((row) => [row.userId, effectivePlan(row)]));

  const byTrigger = new Map<string, TriggerRow>();
  for (const row of rows) {
    const entry = byTrigger.get(row.trigger) ?? {
      trigger: row.trigger,
      feature: row.feature,
      shown: 0,
      converted: 0,
      rate: 0,
    };
    entry.shown += 1;
    if (row.planAtTime === "free" && (planNow.get(row.userId) ?? "free") !== "free") entry.converted += 1;
    byTrigger.set(row.trigger, entry);
  }

  return [...byTrigger.values()]
    .map((entry) => ({ ...entry, rate: entry.shown === 0 ? 0 : Math.round((entry.converted / entry.shown) * 100) }))
    .sort((a, b) => b.shown - a.shown);
}
