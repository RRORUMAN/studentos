import type { PlanKey } from "@/config/pricing";

/**
 * ============================================================================
 * ENTITLEMENTS
 * ----------------------------------------------------------------------------
 * The single map from a *capability* to the tier that unlocks it.
 *
 * The rule this file exists to enforce: nothing in the codebase asks "is the
 * user on Pro?". Components and server actions ask "can this user use budget
 * forecasting?", and the answer is resolved here. That indirection is the
 * difference between repricing a tier in one commit and grepping forty
 * components for a plan name.
 *
 *   Features   binary. Either the tier includes it or it does not.
 *   Quotas     numeric. Every tier has the feature; tiers differ in how much.
 *
 * The ladder is strictly ordered, so an entitlement granted at Plus is
 * implicitly granted at Pro and Max.
 *
 * IMPORTANT: imported by client components (to render the right lock) *and* by
 * the server (to enforce it). The client copy is a UI hint. Enforcement happens
 * in `src/server/entitlements.ts`, which reads the subscription row.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Tier ladder                                                                 */
/* -------------------------------------------------------------------------- */

export const tierOrder: readonly PlanKey[] = ["free", "plus", "pro", "max"] as const;

export function tierRank(plan: PlanKey): number {
  return tierOrder.indexOf(plan);
}

export function tierAtLeast(plan: PlanKey, required: PlanKey): boolean {
  return tierRank(plan) >= tierRank(required);
}

/* -------------------------------------------------------------------------- */
/* Features                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every gated capability. Named for what the student can *do*, never for the
 * screen it happens on.
 */
export type Feature =
  /* --- intelligence ------------------------------------------------------ */
  | "advancedAI"
  | "learningRecommendations"
  | "advancedCityBrain"
  | "advancedRecommendationFilters"
  | "priceIntelligence"
  | "eventIntelligence"
  /* --- money ------------------------------------------------------------- */
  | "budgetCoach"
  | "receiptScanner"
  | "customBudgetCategories"
  | "weeklyTargets"
  | "smartBudgetAlerts"
  | "spendingTrends"
  | "cheaperAlternatives"
  | "survivalMode"
  | "budgetForecast"
  | "sharedBudgets"
  | "travelBudgets"
  | "scenarioPlanning"
  | "csvImport"
  | "subscriptionDetection"
  | "multiCurrency"
  | "spendBenchmarks"
  /* --- work -------------------------------------------------------------- */
  | "incomeGoal"
  /* --- planning ---------------------------------------------------------- */
  | "weeklyPlanner"
  | "groupPlanner"
  | "collaborativePlans"
  | "tripPlanner"
  | "yearAheadPlanning"
  /* --- discovery --------------------------------------------------------- */
  | "allMapLayers"
  | "combinedFilters"
  | "savedSearchAlerts"
  | "offlineCityPack"
  /* --- collections ------------------------------------------------------- */
  | "customCollections"
  | "smartCollections"
  | "collaborativeCollections"
  /* --- community --------------------------------------------------------- */
  | "loopCatchUp"
  | "advancedSocialMatching"
  | "privateGroups"
  /* --- moving ------------------------------------------------------------ */
  | "aiArrivalPlan"
  | "advancedArrivalPlanner"
  | "multiCity"
  /* --- account ----------------------------------------------------------- */
  | "dataExport"
  | "earlyAccess";

/**
 * The map. Left column is the capability, right column is the *lowest* tier
 * that includes it.
 *
 * Deliberately absent, and therefore free at every tier: reading and posting
 * in Pulse, chat, friends, basic groups, seeing events and deals, joining and
 * hosting Anyone Down? plans, the basic budget, the basic Arrival checklist,
 * the first-week plan, the core map layers, the daily brief.
 *
 * And, deliberately, the whole of Work: browsing, the Student Fit score,
 * saving, applying, the application tracker, and posting or answering a
 * student gig. A marketplace behind a paywall has no liquidity, and a student
 * who cannot afford €7.99 is exactly the student who needs to find a shift.
 * Only `incomeGoal` — the planning layer on top of it — is paid.
 */
export const featureTier: Record<Feature, PlanKey> = {
  /* --- Plus: the product starts saving money and time -------------------- */
  advancedAI: "plus",
  learningRecommendations: "plus",
  priceIntelligence: "plus",
  budgetCoach: "plus",
  receiptScanner: "plus",
  customBudgetCategories: "plus",
  weeklyTargets: "plus",
  smartBudgetAlerts: "plus",
  spendingTrends: "plus",
  cheaperAlternatives: "plus",
  survivalMode: "plus",
  weeklyPlanner: "plus",
  allMapLayers: "plus",
  combinedFilters: "plus",
  customCollections: "plus",
  smartCollections: "plus",
  loopCatchUp: "plus",
  aiArrivalPlan: "plus",
  incomeGoal: "plus",

  /* --- Pro: other people, and the future ---------------------------------- */
  advancedCityBrain: "pro",
  advancedRecommendationFilters: "pro",
  eventIntelligence: "pro",
  budgetForecast: "pro",
  sharedBudgets: "pro",
  travelBudgets: "pro",
  scenarioPlanning: "pro",
  csvImport: "pro",
  subscriptionDetection: "pro",
  groupPlanner: "pro",
  collaborativePlans: "pro",
  tripPlanner: "pro",
  collaborativeCollections: "pro",
  savedSearchAlerts: "pro",
  offlineCityPack: "pro",
  advancedSocialMatching: "pro",
  privateGroups: "pro",
  advancedArrivalPlanner: "pro",

  /* --- Max: everywhere ---------------------------------------------------- */
  multiCity: "max",
  multiCurrency: "max",
  spendBenchmarks: "max",
  yearAheadPlanning: "max",
  dataExport: "max",
  earlyAccess: "max",
};

/**
 * Human copy for a locked feature. Every paywall answers "what does this give
 * me?" — never "upgrade to continue".
 */
export const featureCopy: Record<Feature, { label: string; promise: string }> = {
  advancedAI: { label: "More smart asks", promise: "Ask as often as you like, with the deeper planning model." },
  learningRecommendations: { label: "Recommendations that learn", promise: "Picks adjust to what you actually choose, not what you tapped once." },
  advancedCityBrain: { label: "Advanced City Brain", promise: "Your neighbourhood, the season and your own history as context." },
  advancedRecommendationFilters: { label: "Advanced filters", promise: "Stack price, walk time, verification and friends in one query." },
  priceIntelligence: { label: "Price intelligence", promise: "What students here actually pay for lunch, a pint, a week of food — and how you compare." },
  eventIntelligence: { label: "Event intelligence", promise: "Which events your friends and campus are converging on, before they happen." },
  budgetCoach: { label: "AI Budget Coach", promise: "A weekly read on where the money is actually going, and what to change." },
  receiptScanner: { label: "Receipt scanning", promise: "Photograph a receipt, get the lines and the total as a transaction." },
  customBudgetCategories: { label: "Custom categories", promise: "Budget the way you actually spend, not the way a template assumes." },
  weeklyTargets: { label: "Weekly targets", promise: "A number for this week, not just for the month." },
  smartBudgetAlerts: { label: "Smart alerts", promise: "Told before a category runs out, not after." },
  spendingTrends: { label: "Spending trends", promise: "Where each category is drifting, month over month." },
  cheaperAlternatives: { label: "Cheaper alternatives", promise: "A concrete swap with the saving attached, not general advice." },
  survivalMode: { label: "Survival Mode", promise: "A full plan built around the money you have left until a date." },
  budgetForecast: { label: "Month-end forecast", promise: "See whether tonight's plan still keeps you on budget for the weekend, and where the month lands." },
  sharedBudgets: { label: "Shared budgets", promise: "Split a flat, a trip or a night out and keep it settled." },
  travelBudgets: { label: "Trip budgets", promise: "A separate envelope for a weekend away that does not wreck the month." },
  scenarioPlanning: { label: "Scenario planning", promise: "Try a spend before you make it and see where it lands you." },
  csvImport: { label: "CSV import", promise: "Bring a term of history in from a bank export." },
  subscriptionDetection: { label: "Subscription detection", promise: "Recurring charges surfaced from your own history." },
  multiCurrency: { label: "Multi-currency", promise: "Home and host currency side by side for a year abroad." },
  spendBenchmarks: { label: "Spend benchmarks", promise: "How your spend compares with students in the same city." },
  incomeGoal: { label: "Income goal", promise: "Set what you need to earn, see the gap against your budget, and get the specific work that would close it." },
  weeklyPlanner: { label: "Weekly planner", promise: "Two to four things across the week, inside your budget, from what is actually on." },
  groupPlanner: { label: "Group planner", promise: "Plans your friends vote on, inside everyone's budget, with the split worked out." },
  collaborativePlans: { label: "Shared plans", promise: "Everyone edits the same itinerary instead of five screenshots." },
  tripPlanner: { label: "Trip planner", promise: "Plan another city properly before you land in it — places, budget, what is on." },
  yearAheadPlanning: { label: "Year-ahead planning", promise: "Term-by-term targets for a whole year abroad." },
  allMapLayers: { label: "Every map layer", promise: "Groceries, study spots, nightlife and gyms on the same map." },
  combinedFilters: { label: "Combined filters", promise: "Free, under €10 and student-verified, together." },
  savedSearchAlerts: { label: "Saved search alerts", promise: "Told when something new matches a search you saved." },
  offlineCityPack: { label: "Offline city pack", promise: "Your saved places keep working with no signal." },
  customCollections: { label: "Collections", promise: "Group saved places your own way: cheap food, date ideas, study spots." },
  smartCollections: { label: "Smart collections", promise: "Cheap Eats, Want To Go, Free Stuff and Study sort themselves as you save." },
  collaborativeCollections: { label: "Shared collections", promise: "Build a list with your flat or your course." },
  loopCatchUp: { label: "Pulse catch-up", promise: "Five things worth knowing from what you missed, with one line on what the city is talking about." },
  advancedSocialMatching: { label: "Advanced matching", promise: "Matched on interests, budget and campus, not just proximity." },
  privateGroups: { label: "Private groups", promise: "Recurring, invite-only groups that do not close after the night." },
  aiArrivalPlan: { label: "AI Arrival Plan", promise: "Your first two weeks ordered by what blocks what, for your situation." },
  advancedArrivalPlanner: { label: "City setup planner", promise: "Bank, registration, phone and housing sequenced with real lead times." },
  multiCity: { label: "Multiple cities", promise: "Home city and host city side by side, with separate budgets." },
  dataExport: { label: "Export everything", promise: "Every place, plan and transaction, in a file you keep." },
  earlyAccess: { label: "Early access", promise: "New features before they roll out." },
};

export function requiredTier(feature: Feature): PlanKey {
  return featureTier[feature];
}

/** Pure check. On the client this is a UI hint only. */
export function planHasFeature(plan: PlanKey, feature: Feature): boolean {
  return tierAtLeast(plan, featureTier[feature]);
}

/** Every feature a tier adds over the tier below it. */
export function featuresAddedBy(plan: PlanKey): Feature[] {
  return (Object.keys(featureTier) as Feature[]).filter((f) => featureTier[f] === plan);
}

/* -------------------------------------------------------------------------- */
/* Quotas                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Numeric limits. `null` is uncapped under normal use.
 *
 * `aiAsksPerWeek` decides the free tier's character: eight is enough to answer
 * a real week — a couple of nights out, a grocery question, an afford check —
 * and it resets weekly so a free user is never permanently locked out. The
 * meter is shown *before* the limit is hit, never after.
 */
export type Quota = {
  aiAsksPerWeek: number | null;
  savedItems: number | null;
  hostedPlans: number | null;
  cities: number;
  historyMonths: number | null;
  collections: number;
  catchUpsPerWeek: number;
};

export const quotas: Record<PlanKey, Quota> = {
  free: { aiAsksPerWeek: 8, savedItems: 10, hostedPlans: 2, cities: 1, historyMonths: 1, collections: 0, catchUpsPerWeek: 0 },
  plus: { aiAsksPerWeek: 200, savedItems: null, hostedPlans: null, cities: 1, historyMonths: 12, collections: 20, catchUpsPerWeek: 20 },
  pro: { aiAsksPerWeek: 500, savedItems: null, hostedPlans: null, cities: 2, historyMonths: 12, collections: 100, catchUpsPerWeek: 60 },
  max: { aiAsksPerWeek: 1500, savedItems: null, hostedPlans: null, cities: 12, historyMonths: null, collections: 500, catchUpsPerWeek: 200 },
};

export function quotaFor(plan: PlanKey): Quota {
  return quotas[plan];
}

export type QuotaState = {
  used: number;
  limit: number | null;
  remaining: number | null;
  exceeded: boolean;
  /** 0-1 for a meter. Always 0 when uncapped. */
  fraction: number;
  /** True inside the last quarter of the allowance — time to say so. */
  nearing: boolean;
};

export function quotaState(used: number, limit: number | null): QuotaState {
  if (limit === null) {
    return { used, limit: null, remaining: null, exceeded: false, fraction: 0, nearing: false };
  }
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    exceeded: used >= limit,
    fraction: limit === 0 ? 1 : Math.min(1, used / limit),
    nearing: remaining > 0 && remaining <= Math.max(1, Math.ceil(limit / 4)),
  };
}

/* -------------------------------------------------------------------------- */
/* Upgrade triggers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Intent-based upgrade moments. Each names the feature it points at, so the
 * paywall it opens is the value-first one for that feature, and the trigger
 * can be counted against conversions in admin.
 *
 * These are shown at most once per trigger per week, and never twice on one
 * screen. A product that interrupts constantly is a product students stop
 * trusting to be on their side.
 */
export type UpgradeTrigger =
  | "many-transactions"
  | "complex-plan"
  | "ai-limit"
  | "heavy-pulse"
  | "another-city"
  | "forecast-peek"
  | "group-plan";

export const upgradeTriggerMeta: Record<UpgradeTrigger, { feature: Feature; when: string }> = {
  "many-transactions": { feature: "budgetCoach", when: "After 15 logged transactions." },
  "complex-plan": { feature: "groupPlanner", when: "A whole-weekend or multi-day plan request." },
  "ai-limit": { feature: "advancedAI", when: "The weekly ask allowance is used up." },
  "heavy-pulse": { feature: "loopCatchUp", when: "Returning to Pulse after a day away with many posts missed." },
  "another-city": { feature: "tripPlanner", when: "Looking at a city that is not their own." },
  "forecast-peek": { feature: "budgetForecast", when: "Opening the budget past day five of the month." },
  "group-plan": { feature: "groupPlanner", when: "Inviting a second person to a plan." },
};
