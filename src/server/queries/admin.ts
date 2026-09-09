import "server-only";

import type { PlanKey } from "@/config/pricing";
import { institutionById, institutions } from "@/data/institutions";
import { searchInstitutions } from "@/domain/institutions";
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

/** How many days of daily series the dashboard draws. Four weeks. */
const SERIES_DAYS = 28;

/**
 * A daily series, oldest first, with no gaps.
 *
 * Gaps are the whole point of building it this way. A chart drawn from grouped
 * rows silently omits the days nothing happened, which turns a week of silence
 * into a flat line between two points and reads as steady rather than dead.
 * Every day in the window gets a row, whether or not anything landed in it.
 */
function dailySeries(
  now: number,
  days: number,
  rows: readonly { at: string; value?: number; userId?: string }[],
  mode: "count" | "sum" | "unique" = "count",
): { day: string; value: number }[] {
  const start = new Date(now - (days - 1) * DAY);
  const startOfDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());

  const buckets = new Map<string, number>();
  const seen = new Map<string, Set<string>>();

  for (let index = 0; index < days; index += 1) {
    buckets.set(new Date(startOfDay + index * DAY).toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const parsed = Date.parse(row.at);
    if (!Number.isFinite(parsed) || parsed < startOfDay) continue;

    const key = new Date(parsed).toISOString().slice(0, 10);
    if (!buckets.has(key)) continue;

    if (mode === "sum") {
      buckets.set(key, (buckets.get(key) ?? 0) + (row.value ?? 0));
    } else if (mode === "unique") {
      const set = seen.get(key) ?? new Set<string>();
      seen.set(key, set);
      if (row.userId) set.add(row.userId);
      buckets.set(key, set.size);
    } else {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return [...buckets].map(([day, value]) => ({ day, value }));
}

/**
 * Change against the matching previous window, as a percentage.
 *
 * Null rather than zero when the previous window was empty. "Up 100%" from a
 * base of zero is a number that means nothing, and rendering it next to real
 * ones teaches the reader to distrust all of them.
 */
function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

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

  /** Daily series for the last four weeks, oldest first, gaps included. */
  series: {
    signups: { day: string; value: number }[];
    active: { day: string; value: number }[];
    outcomes: { day: string; value: number }[];
    aiCostMicros: { day: string; value: number }[];
  };

  growth: {
    today: number;
    last7: number;
    last28: number;
    /** Against the previous window of the same length. Null when it was empty. */
    delta7: number | null;
    delta28: number | null;
  };

  /**
   * Where accounts stop. Every step is counted from a real column, and the
   * first one is deliberately "account created" rather than "visitor": nothing
   * in this product records an anonymous visit, so a visitor row would be a
   * number nobody could source.
   */
  funnel: { step: string; detail: string; count: number }[];

  /**
   * Subscription health that can be read off the rows themselves.
   *
   * MRR *movement* — new, expansion, contraction, churn — is deliberately absent
   * rather than estimated. A `Subscription` row carries only its current state
   * and `updatedAt`, so movement would have to be inferred, and an inferred
   * churn number is the kind of figure a decision gets made on. It arrives when
   * the webhook has been writing an event log for a month.
   */
  subscriptions: {
    active: number;
    pastDue: number;
    cancelling: number;
    annualShare: number;
  };
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

  /* ---- growth ----------------------------------------------------------- */
  const createdSince = (ms: number) =>
    users.filter((user) => now - Date.parse(user.createdAt) < ms).length;
  const createdBetween = (from: number, to: number) =>
    users.filter((user) => {
      const at = now - Date.parse(user.createdAt);
      return at >= from && at < to;
    }).length;

  const last7 = createdSince(7 * DAY);
  const last28 = createdSince(28 * DAY);

  /* ---- funnel ----------------------------------------------------------- */
  const onboardingStarted = profiles.length;
  const onboarded = profiles.filter((profile) => profile.onboardedAt !== null).length;
  const activated = new Set(outcomes.map((row) => row.userId)).size;

  /* ---- subscription health ---------------------------------------------- */
  const good = subscriptions.filter(
    (row) => row.status === "active" || row.status === "trialing",
  );
  const annual = good.filter((row) => row.period === "annual").length;

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

    series: {
      signups: dailySeries(now, SERIES_DAYS, users.map((user) => ({ at: user.createdAt }))),
      active: dailySeries(
        now,
        SERIES_DAYS,
        outcomes.map((row) => ({ at: row.createdAt, userId: row.userId })),
        "unique",
      ),
      outcomes: dailySeries(now, SERIES_DAYS, outcomes.map((row) => ({ at: row.createdAt }))),
      aiCostMicros: dailySeries(
        now,
        SERIES_DAYS,
        aiUsage.map((row) => ({ at: row.createdAt, value: row.costMicros })),
        "sum",
      ),
    },

    growth: {
      today: createdSince(DAY),
      last7,
      last28,
      delta7: delta(last7, createdBetween(7 * DAY, 14 * DAY)),
      delta28: delta(last28, createdBetween(28 * DAY, 56 * DAY)),
    },

    funnel: [
      { step: "Account created", detail: "Signed up and got a session", count: users.length },
      { step: "Onboarding started", detail: "Reached the first question", count: onboardingStarted },
      { step: "Onboarding finished", detail: "City, campus and preferences set", count: onboarded },
      { step: "Activated", detail: "Got at least one useful outcome", count: activated },
      { step: "Paying", detail: "Plus, Pro or Max in good standing", count: paidUsers },
    ],

    subscriptions: {
      active: good.length,
      pastDue: subscriptions.filter((row) => row.status === "past_due").length,
      cancelling: subscriptions.filter((row) => row.cancelAtPeriodEnd).length,
      annualShare: good.length === 0 ? 0 : Math.round((annual / good.length) * 100),
    },
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

/* -------------------------------------------------------------------------- */
/* Institutions                                                                */
/* -------------------------------------------------------------------------- */

export type InstitutionAdminView = {
  /** Size of the register, by where each row came from. */
  registry: { total: number; curated: number; imported: number; withCampus: number };
  /** Countries the import has been run for, with a count each. */
  byCountry: { countryCode: string; count: number }[];
  /** How students are distributed across institutions. */
  distribution: { institutionId: string; name: string; city: string; students: number }[];
  /** Students whose university is not in the register at all. */
  unmatched: number;
  /** The review queue, newest first. */
  submissions: {
    id: string;
    name: string;
    citySlug: string;
    countryCode: string;
    status: "pending" | "verified" | "merged" | "rejected";
    mergedIntoName: string | null;
    createdAt: string;
    /** What the search WOULD return for this name now. Often the answer. */
    suggestions: { id: string; name: string; city: string }[];
  }[];
  pending: number;
};

/**
 * The institution register, and the queue of names students typed that it did
 * not have.
 *
 * The interesting column is `suggestions`. Most submissions are not missing
 * institutions at all -- they are institutions that ARE in the register under
 * a name the search did not match, and the fix is an alias rather than a new
 * row. Running the search against each submitted name and showing the top
 * three answers turns a review from "look this up" into "is it one of these",
 * which is the difference between a queue that gets worked and one that does
 * not.
 */
export async function loadInstitutionAdmin(): Promise<InstitutionAdminView> {
  const [submissions, profiles] = await Promise.all([
    all("institutionSubmissions"),
    all("profiles"),
  ]);

  const byCountry = new Map<string, number>();
  for (const row of institutions) {
    byCountry.set(row.countryCode, (byCountry.get(row.countryCode) ?? 0) + 1);
  }

  const students = new Map<string, number>();
  let unmatched = 0;
  for (const profile of profiles) {
    const id = profile.institutionId ?? null;
    if (id) students.set(id, (students.get(id) ?? 0) + 1);
    else if (profile.universityName) unmatched += 1;
  }

  const distribution = [...students.entries()]
    .map(([institutionId, count]) => {
      const row = institutionById(institutionId);
      return {
        institutionId,
        name: row?.officialName ?? institutionId,
        city: row?.city ?? "—",
        students: count,
      };
    })
    .sort((a, b) => b.students - a.students)
    .slice(0, 12);

  return {
    registry: {
      total: institutions.length,
      curated: institutions.filter((row) => row.source === "curated").length,
      imported: institutions.filter((row) => row.source === "wikidata").length,
      withCampus: institutions.filter((row) => row.campusSlug !== null).length,
    },
    byCountry: [...byCountry.entries()]
      .map(([countryCode, count]) => ({ countryCode, count }))
      .sort((a, b) => b.count - a.count),
    distribution,
    unmatched,
    submissions: submissions
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30)
      .map((row) => ({
        id: row.id,
        name: row.name,
        citySlug: row.citySlug,
        countryCode: row.countryCode,
        status: row.status,
        mergedIntoName: row.mergedIntoId
          ? (institutionById(row.mergedIntoId)?.officialName ?? row.mergedIntoId)
          : null,
        createdAt: row.createdAt,
        suggestions: searchInstitutions(institutions, row.name, {
          countryCode: row.countryCode,
          citySlug: row.citySlug,
          limit: 3,
        }).map((hit) => ({
          id: hit.institution.id,
          name: hit.institution.officialName,
          city: hit.institution.city,
        })),
      })),
    pending: submissions.filter((row) => row.status === "pending").length,
  };
}
