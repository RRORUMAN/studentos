import { type Opportunity, hourlyEquivalent, workKindMeta } from "@/domain/work";
import type { Match } from "@/server/engines/work-match";
import type { Cents } from "@/domain/types";

/**
 * ============================================================================
 * EARN
 * ----------------------------------------------------------------------------
 * The other half of the money loop, and the reason Work belongs in StudentOS
 * rather than in a job board.
 *
 * The budget engine answers "how much can I spend?". This one answers the
 * question that follows it and that nothing else the student owns will answer:
 * "I am €280 short — what do I actually do about it?"
 *
 * ---------------------------------------------------------------------------
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 * Every number here is an estimate, every estimate carries the `EstimateBasis`
 * that produced it, and an opportunity that does not state its pay **cannot
 * enter a plan at all**. Not at an assumed rate, not at the city average, not
 * at the median of the ones that do. It is counted in `unpriced` and named, so
 * the student can see there is more out there than the plan could price.
 *
 * That constraint is what makes the feature safe to ship. "You could make
 * €320" is a sentence a student will rearrange their term around. If any part
 * of that number came from us guessing, we have moved their risk onto our
 * guess without telling them.
 *
 * Nothing here promises earnings, and `describeBasis` is written so that every
 * rendering of a total has to say where it came from.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* The gap                                                                     */
/* -------------------------------------------------------------------------- */

export type IncomeGap = {
  /** What the student said they want coming in each month. */
  targetCents: Cents;
  /** What they already have — allowance, existing job, savings drawdown. */
  currentIncomeCents: Cents;
  /** The shortfall. Floored at zero: a surplus is not a negative gap. */
  gapCents: Cents;
  closed: boolean;
};

export function incomeGap(input: {
  targetCents: Cents | null;
  currentIncomeCents: Cents | null;
}): IncomeGap | null {
  /* No target means no gap, not a zero gap. A student who never set one must
     not be told they are "on track" against a number they never chose. */
  if (input.targetCents === null || input.targetCents <= 0) return null;

  const current = Math.max(0, input.currentIncomeCents ?? 0);
  const gap = Math.max(0, input.targetCents - current);

  return {
    targetCents: input.targetCents,
    currentIncomeCents: current,
    gapCents: gap,
    closed: gap === 0,
  };
}

/**
 * The gap between what the month costs and what is coming in.
 *
 * Separate from `incomeGap` because it is a different question with a
 * different failure mode: this one is derived from the budget the student
 * already set, so it is only meaningful once they have set one. `null` when
 * they have not, rather than a gap of the full monthly spend, which would
 * greet every new account with an alarming and meaningless number.
 */
export function budgetShortfall(input: {
  monthlyPlannedCents: Cents | null;
  currentIncomeCents: Cents | null;
}): Cents | null {
  if (input.monthlyPlannedCents === null || input.monthlyPlannedCents <= 0) return null;
  if (input.currentIncomeCents === null) return null;
  return Math.max(0, input.monthlyPlannedCents - input.currentIncomeCents);
}

/* -------------------------------------------------------------------------- */
/* Estimating one opportunity                                                  */
/* -------------------------------------------------------------------------- */

/**
 * How a monthly figure was arrived at. Rendered next to every total.
 *
 *   stated-monthly    The posting states a monthly wage. Nothing assumed.
 *   hourly-x-hours    A stated hourly rate times an hours figure — the
 *                     posting's own, or the student's availability where the
 *                     posting gave a range. The assumption is named.
 *   fixed-one-off     A whole-job price. Counts once, this month, and never
 *                     repeats.
 */
export type EstimateBasis = "stated-monthly" | "hourly-x-hours" | "fixed-one-off";

export const basisLabel: Record<EstimateBasis, string> = {
  "stated-monthly": "Stated monthly pay",
  "hourly-x-hours": "Stated rate × hours",
  "fixed-one-off": "One-off, paid once",
};

export type Estimate = {
  opportunity: Opportunity;
  /** What it would add to one month. Integer cents. */
  monthlyCents: Cents;
  basis: EstimateBasis;
  /** Hours a week this estimate assumes. Null for a one-off. */
  hoursPerWeek: number | null;
  /** Only set for `hourly-x-hours`, so the UI can show the rate behind it. */
  hourlyCents: Cents | null;
};

const WEEKS_PER_MONTH = 4.33;

/**
 * What this opportunity would plausibly add to one month, or null.
 *
 * `hoursAvailable` caps the assumption: a job offering up to twenty hours to a
 * student with eight free is worth eight hours, and quietly pricing it at
 * twenty is how a plan reaches a target on paper and not in life.
 */
export function estimateMonthly(
  opportunity: Opportunity,
  hoursAvailable: number,
): Estimate | null {
  const pay = opportunity.pay;
  if (!pay) return null;

  if (pay.period === "month") {
    return {
      opportunity,
      monthlyCents: pay.minCents,
      basis: "stated-monthly",
      hoursPerWeek: opportunity.hoursMin ?? opportunity.hoursMax ?? null,
      hourlyCents: null,
    };
  }

  if (pay.period === "fixed") {
    return {
      opportunity,
      monthlyCents: pay.minCents,
      basis: "fixed-one-off",
      hoursPerWeek: null,
      hourlyCents: null,
    };
  }

  const hourly = hourlyEquivalent(pay, opportunity.hoursMax ?? opportunity.hoursMin ?? null);
  if (hourly === null) return null;

  /* The posting's own lower bound is the honest hours figure where it gave
     one: a role advertised as "8–20 hours" is guaranteeing eight. */
  const offered = opportunity.hoursMin ?? opportunity.hoursMax;
  const hours = Math.max(0, Math.min(offered ?? hoursAvailable, hoursAvailable));
  if (hours <= 0) return null;

  return {
    opportunity,
    monthlyCents: Math.round(hourly * hours * WEEKS_PER_MONTH),
    basis: "hourly-x-hours",
    hoursPerWeek: hours,
    hourlyCents: hourly,
  };
}

/* -------------------------------------------------------------------------- */
/* The plan                                                                    */
/* -------------------------------------------------------------------------- */

export type EarnPlan = {
  targetCents: Cents;
  picks: readonly Estimate[];
  /** The sum of the picks. An estimate, and labelled as one everywhere. */
  estimatedTotalCents: Cents;
  reachesTarget: boolean;
  shortfallCents: Cents;
  /** Hours a week the plan consumes, against what the student said they have. */
  hoursUsed: number;
  hoursAvailable: number;
  /**
   * How many matching opportunities could not be priced because the source did
   * not state pay. Named rather than hidden: it is the honest answer to "is
   * that all there is?".
   */
  unpriced: number;
  /**
   * The arithmetic answer to "what would it take?", when the plan falls short.
   *
   * Uses the median stated rate among the priced matches — a real number
   * observed in these results, not a national average. Null when there are too
   * few priced matches for a median to mean anything.
   */
  needed: { hoursPerWeek: number; atHourlyCents: Cents } | null;
};

export type EarnInput = {
  matches: readonly Match[];
  targetCents: Cents;
  hoursAvailable: number;
  /** Cap on how many roles a plan may stack. Four jobs is not a plan. */
  maxPicks?: number;
};

const DEFAULT_MAX_PICKS = 3;
const MIN_RATES_FOR_MEDIAN = 3;

/**
 * Build the shortest combination of real opportunities that reaches the target.
 *
 * Greedy by monthly value per hour consumed, which is the right objective:
 * hours are the student's genuinely scarce resource, and the plan that reaches
 * €300 in six hours a week beats the one that reaches it in fourteen.
 * One-offs are considered first at zero hourly cost — they consume no ongoing
 * time, which is precisely why a student under pressure this month should see
 * them before a contract.
 *
 * Not an optimiser. A true knapsack over three picks would gain a few euro and
 * produce combinations nobody would choose, and the result has to be a plan a
 * person can read and act on this week.
 */
export function earnPlan(input: EarnInput): EarnPlan {
  const maxPicks = input.maxPicks ?? DEFAULT_MAX_PICKS;
  const hoursAvailable = Math.max(0, input.hoursAvailable);

  const priced: Estimate[] = [];
  let unpriced = 0;

  for (const match of input.matches) {
    if (match.blocked) continue;
    const estimate = estimateMonthly(match.opportunity, hoursAvailable);
    if (estimate && estimate.monthlyCents > 0) priced.push(estimate);
    else unpriced += 1;
  }

  priced.sort((a, b) => value(b) - value(a));

  const picks: Estimate[] = [];
  let total = 0;
  let hoursUsed = 0;

  for (const estimate of priced) {
    if (picks.length >= maxPicks) break;
    if (total >= input.targetCents) break;

    const hours = estimate.hoursPerWeek ?? 0;
    if (hoursUsed + hours > hoursAvailable) continue;

    /* Re-price against the hours actually left, so the second pick in a plan
       is not silently assuming the same free evenings as the first. */
    const remaining = hoursAvailable - hoursUsed;
    const repriced =
      estimate.basis === "hourly-x-hours"
        ? estimateMonthly(estimate.opportunity, remaining)
        : estimate;
    if (!repriced || repriced.monthlyCents <= 0) continue;

    picks.push(repriced);
    total += repriced.monthlyCents;
    hoursUsed += repriced.hoursPerWeek ?? 0;
  }

  const shortfall = Math.max(0, input.targetCents - total);

  return {
    targetCents: input.targetCents,
    picks,
    estimatedTotalCents: total,
    reachesTarget: shortfall === 0,
    shortfallCents: shortfall,
    hoursUsed: Math.round(hoursUsed * 10) / 10,
    hoursAvailable,
    unpriced,
    needed: shortfall > 0 ? hoursToClose(shortfall, priced) : null,
  };
}

/** Monthly euros per hour a week consumed. One-offs cost no ongoing hours. */
function value(estimate: Estimate): number {
  const hours = estimate.hoursPerWeek ?? 0;
  if (hours <= 0) return estimate.monthlyCents * 2;
  return estimate.monthlyCents / hours;
}

function hourlyRates(estimates: readonly Estimate[]): number[] {
  return estimates
    .map((estimate) => estimate.hourlyCents)
    .filter((rate): rate is number => rate !== null && rate > 0)
    .sort((a, b) => a - b);
}

function hoursToClose(
  shortfallCents: Cents,
  estimates: readonly Estimate[],
): { hoursPerWeek: number; atHourlyCents: Cents } | null {
  const rates = hourlyRates(estimates);
  if (rates.length < MIN_RATES_FOR_MEDIAN) return null;

  const median = rates[Math.floor(rates.length / 2)];
  const hours = shortfallCents / (median * WEEKS_PER_MONTH);

  return { hoursPerWeek: Math.ceil(hours), atHourlyCents: median };
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * One sentence naming the assumption behind an estimate.
 *
 * Every surface that prints a monthly figure prints this next to it. That is
 * the whole mechanism preventing "€320/month" from reading as a promise.
 */
export function describeBasis(estimate: Estimate, formatMoney: (cents: Cents) => string): string {
  switch (estimate.basis) {
    case "stated-monthly":
      return "The posting states this monthly.";
    case "fixed-one-off":
      return `${formatMoney(estimate.monthlyCents)} once, not every month.`;
    case "hourly-x-hours":
      return `${formatMoney(estimate.hourlyCents ?? 0)} an hour × ${estimate.hoursPerWeek} hours a week.`;
  }
}

/** Whether a plan is made only of work that happens once. Changes the copy. */
export function isOneOffPlan(plan: EarnPlan): boolean {
  return plan.picks.length > 0 && plan.picks.every((pick) => pick.basis === "fixed-one-off");
}

/** Grouping for the plan's summary line: "2 weekend shifts, 1 tutoring gig". */
export function summarisePicks(plan: EarnPlan): readonly { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const pick of plan.picks) {
    const label = workKindMeta[pick.opportunity.kind].label;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}
