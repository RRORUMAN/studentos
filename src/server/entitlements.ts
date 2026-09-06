import "server-only";

import {
  type Feature,
  featureCopy,
  planHasFeature,
  quotaFor,
  quotaState,
  type QuotaState,
  requiredTier,
} from "@/config/entitlements";
import type { PlanKey } from "@/config/pricing";
import { effectivePlan } from "@/domain/types";
import { findMany, findOne } from "@/server/db";
import { quotaOverride } from "@/server/queries/settings";

/**
 * ============================================================================
 * SERVER-SIDE ENTITLEMENTS
 * ----------------------------------------------------------------------------
 * The enforcement point. Everything in `src/config/entitlements.ts` is shared
 * with the client so the UI can render the right lock; *this* module is the
 * only thing that decides whether an action actually runs.
 *
 * The rule, stated once so it can be pointed at in review:
 *
 *   A premium feature that is only hidden in the UI is not gated. Every server
 *   action that touches a paid capability calls `assertFeature` before it does
 *   any work, and every quota-bearing action calls `consumeQuota`. A component
 *   that forgets to render a lock is a cosmetic bug; a server action that
 *   forgets to assert is a revenue bug and a security one.
 *
 * The plan is read from the subscription row every time. It is never taken
 * from a cookie, a JWT claim, a request body or a prop — all four are things
 * the client controls.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Plan resolution                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The authoritative plan for a user.
 *
 * `effectivePlan` handles the states where the row says one thing and fairness
 * says another: a past-due card keeps access through Stripe's retry window,
 * and a cancelled subscription keeps what it paid for until the period ends.
 */
export async function planFor(userId: string): Promise<PlanKey> {
  const subscription = await findOne("subscriptions", (row) => row.userId === userId);
  return effectivePlan(subscription);
}

/* -------------------------------------------------------------------------- */
/* Features                                                                    */
/* -------------------------------------------------------------------------- */

export async function canUse(userId: string, feature: Feature): Promise<boolean> {
  return planHasFeature(await planFor(userId), feature);
}

/**
 * Thrown when a gated action is reached without the entitlement. Carries the
 * feature so the error boundary can render the right upgrade panel rather than
 * a generic failure.
 */
export class EntitlementError extends Error {
  readonly feature: Feature;
  readonly requiredPlan: PlanKey;
  readonly currentPlan: PlanKey;

  constructor(feature: Feature, currentPlan: PlanKey) {
    const copy = featureCopy[feature];
    super(`${copy.label} requires ${requiredTier(feature)}`);
    this.name = "EntitlementError";
    this.feature = feature;
    this.requiredPlan = requiredTier(feature);
    this.currentPlan = currentPlan;
  }
}

/** Guard a server action. Throws `EntitlementError` when not entitled. */
export async function assertFeature(userId: string, feature: Feature): Promise<PlanKey> {
  const plan = await planFor(userId);
  if (!planHasFeature(plan, feature)) throw new EntitlementError(feature, plan);
  return plan;
}

/**
 * Non-throwing variant, for actions that degrade instead of failing — the
 * weekly planner still returns a plan for a free user, it just returns the
 * deterministic one rather than the AI-optimised one.
 */
export async function featureCheck(
  userId: string,
  feature: Feature,
): Promise<{ allowed: boolean; plan: PlanKey; requiredPlan: PlanKey }> {
  const plan = await planFor(userId);
  return {
    allowed: planHasFeature(plan, feature),
    plan,
    requiredPlan: requiredTier(feature),
  };
}

/* -------------------------------------------------------------------------- */
/* Quotas                                                                      */
/* -------------------------------------------------------------------------- */

export type QuotaKey = "aiAsksPerWeek" | "savedItems" | "hostedPlans" | "collections" | "catchUpsPerWeek";

const WEEK_MS = 7 * 86_400_000;

/**
 * Current usage for a quota.
 *
 * Usage is *counted from the rows*, not tracked in a counter column. A counter
 * drifts the first time a delete misses a decrement, and then a student who
 * unsaved ten places is permanently short ten slots with no way to explain it.
 * Counting is a few milliseconds and is always right.
 */
async function usageFor(userId: string, key: QuotaKey): Promise<number> {
  switch (key) {
    case "aiAsksPerWeek": {
      const since = Date.now() - WEEK_MS;
      const rows = await findMany(
        "aiUsage",
        (row) => row.userId === userId && Date.parse(row.createdAt) >= since,
      );
      /* Tier 0 is answered from the database with no model call. Charging it
         against the weekly allowance would meter work that costs nothing and
         make the free tier feel arbitrarily stingy. */
      return rows.filter((row) => row.tier > 0 && !row.cacheHit).length;
    }
    case "savedItems": {
      const rows = await findMany("saved", (row) => row.userId === userId);
      return rows.length;
    }
    case "hostedPlans": {
      const now = Date.now();
      const rows = await findMany(
        "invites",
        (row) => row.hostId === userId && Date.parse(row.closesAt) > now,
      );
      return rows.length;
    }
    case "collections": {
      const rows = await findMany("collections", (row) => row.userId === userId);
      return rows.length;
    }
    case "catchUpsPerWeek": {
      const since = Date.now() - WEEK_MS;
      const rows = await findMany(
        "aiUsage",
        (row) =>
          row.userId === userId &&
          row.operation === "summarize" &&
          Date.parse(row.createdAt) >= since,
      );
      return rows.length;
    }
  }
}

/**
 * The quota table for a plan, with any admin override applied. Only the weekly
 * ask allowance is adjustable from admin; the rest are code.
 */
export async function effectiveQuota(plan: PlanKey): Promise<ReturnType<typeof quotaFor>> {
  const base = quotaFor(plan);
  const override = await quotaOverride(plan);
  return override === undefined ? base : { ...base, aiAsksPerWeek: override };
}

export async function readQuota(userId: string, key: QuotaKey): Promise<QuotaState & { plan: PlanKey }> {
  const plan = await planFor(userId);
  const limit = (await effectiveQuota(plan))[key];
  const used = await usageFor(userId, key);
  return { ...quotaState(used, limit), plan };
}

export class QuotaError extends Error {
  readonly quota: QuotaKey;
  readonly state: QuotaState;
  readonly currentPlan: PlanKey;

  constructor(quota: QuotaKey, state: QuotaState, currentPlan: PlanKey) {
    super(`Quota ${quota} reached`);
    this.name = "QuotaError";
    this.quota = quota;
    this.state = state;
    this.currentPlan = currentPlan;
  }
}

/**
 * Check a quota before doing the work. Throws `QuotaError` when exhausted.
 *
 * Named `assert` rather than `consume` on purpose: the count comes from the
 * rows the action is about to create, so there is nothing to decrement. The
 * action creating its row *is* the consumption.
 */
export async function assertQuota(userId: string, key: QuotaKey): Promise<QuotaState> {
  const state = await readQuota(userId, key);
  if (state.exceeded) throw new QuotaError(key, state, state.plan);
  return state;
}

/* -------------------------------------------------------------------------- */
/* Bulk read for the UI                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Everything a screen needs to render locks correctly, in one pass. Computed
 * server-side and passed down as a plain object, so a client component never
 * has to ask "what plan am I on?" — a question it has no trustworthy way to
 * answer.
 */
export type Entitlements = {
  plan: PlanKey;
  can: Record<Feature, boolean>;
  quotas: Record<QuotaKey, QuotaState>;
};

export async function loadEntitlements(userId: string): Promise<Entitlements> {
  const plan = await planFor(userId);

  const featureKeys = Object.keys(featureCopy) as Feature[];
  const can = Object.fromEntries(
    featureKeys.map((feature) => [feature, planHasFeature(plan, feature)]),
  ) as Record<Feature, boolean>;

  const quotaKeys: QuotaKey[] = [
    "aiAsksPerWeek",
    "savedItems",
    "hostedPlans",
    "collections",
    "catchUpsPerWeek",
  ];

  const limits = await effectiveQuota(plan);
  const entries = await Promise.all(
    quotaKeys.map(async (key) => [key, quotaState(await usageFor(userId, key), limits[key])] as const),
  );

  return { plan, can, quotas: Object.fromEntries(entries) as Record<QuotaKey, QuotaState> };
}
