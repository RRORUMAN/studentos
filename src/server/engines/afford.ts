import type { Cents } from "@/domain/types";
import type { BudgetReading } from "@/server/engines/budget";

/**
 * ============================================================================
 * CAN I AFFORD THIS?
 * ----------------------------------------------------------------------------
 * "€35 dinner tonight" → YES / POSSIBLY / NOT IDEAL, with what it leaves.
 *
 * The verdict is computed against the money that is genuinely free until the
 * next natural horizon (Monday, or Sunday on a Monday), not against the whole
 * month. Spending €35 of €380 remaining is trivially "yes" on paper and is the
 * wrong answer on the 3rd of the month with rent still to come out; asking the
 * question this way is why the feature is useful at all.
 *
 * Pure arithmetic. No model, no I/O, so it can be run on every keystroke.
 * ============================================================================
 */

export type AffordVerdict = "yes" | "possibly" | "not-ideal" | "no-budget";

export type AffordReading = {
  verdict: AffordVerdict;
  amountCents: Cents;
  /** Money free until the horizon, before this spend. */
  horizonCents: Cents;
  horizonLabel: string;
  horizonDays: number;
  /** What would be left until the horizon after this spend. Can be negative. */
  leftoverCents: Cents;
  /** Leftover spread per remaining day, floored at zero. */
  leftoverPerDayCents: Cents;
  /** Share of the horizon money this spend uses. */
  share: number;
  /** A cheaper figure that would keep the verdict at "yes", or null when
      already comfortable. */
  suggestedCents: Cents | null;
  /** One sentence. Always states a number. Never a telling-off. */
  headline: string;
};

/** Days to the next planning horizon, counting today. */
export function horizonFor(now: Date): { label: string; days: number } {
  const day = now.getUTCDay(); // 0 = Sunday
  const target = day === 1 ? 0 : 1;
  const delta = (target - day + 7) % 7 || 7;
  return { label: target === 1 ? "Monday" : "Sunday", days: delta };
}

/**
 * Thresholds, named so a product change is a one-line edit.
 *
 *   yes        leaves at least 55% of the horizon money
 *   possibly   leaves between 20% and 55%
 *   not-ideal  leaves under 20%, or goes negative
 */
const RULES = { comfortable: 0.45, stretch: 0.8 } as const;

export function canAfford(input: {
  amountCents: Cents;
  reading: BudgetReading;
  now: Date;
  formatMoney: (cents: Cents) => string;
}): AffordReading {
  const { amountCents, reading, now, formatMoney: fmt } = input;
  const horizon = horizonFor(now);

  if (reading.plannedCents === 0) {
    return {
      verdict: "no-budget",
      amountCents,
      horizonCents: 0,
      horizonLabel: horizon.label,
      horizonDays: horizon.days,
      leftoverCents: 0,
      leftoverPerDayCents: 0,
      share: 0,
      suggestedCents: null,
      headline: "Set a budget and this becomes a real answer.",
    };
  }

  const days = Math.max(1, Math.min(reading.daysLeft, horizon.days));
  const dailyRate = reading.availableCents / Math.max(1, reading.daysLeft);
  const horizonCents = Math.max(0, Math.floor(dailyRate * days));

  const leftoverCents = horizonCents - amountCents;
  /* Today's spend leaves the remaining days to share what is left. */
  const remainingDays = Math.max(1, days - 1);
  const leftoverPerDayCents = Math.max(0, Math.floor(leftoverCents / remainingDays));
  const share = horizonCents === 0 ? 1 : amountCents / horizonCents;

  const verdict: AffordVerdict =
    share <= RULES.comfortable ? "yes" : share <= RULES.stretch ? "possibly" : "not-ideal";

  const suggestedCents =
    verdict === "yes" ? null : Math.max(0, Math.floor(horizonCents * RULES.comfortable));

  const until = `until ${horizon.label}`;

  const headline =
    verdict === "yes"
      ? `${fmt(amountCents)} is fine. It leaves ${fmt(Math.max(0, leftoverCents))} ${until}.`
      : verdict === "possibly"
        ? `You can do ${fmt(amountCents)}, but it leaves ${fmt(Math.max(0, leftoverCents))} for everything else ${until}.`
        : leftoverCents < 0
          ? `${fmt(amountCents)} is ${fmt(-leftoverCents)} more than you have free ${until}.`
          : `${fmt(amountCents)} would leave ${fmt(leftoverCents)} ${until}. Doable, not comfortable.`;

  return {
    verdict,
    amountCents,
    horizonCents,
    horizonLabel: horizon.label,
    horizonDays: days,
    leftoverCents,
    leftoverPerDayCents,
    share,
    suggestedCents,
    headline,
  };
}

export const affordVerdictMeta: Record<
  AffordVerdict,
  { label: string; accent: "mint" | "amber" | "pulse" | "flow" }
> = {
  yes: { label: "Yes", accent: "mint" },
  possibly: { label: "Possibly", accent: "amber" },
  "not-ideal": { label: "Not ideal", accent: "pulse" },
  "no-budget": { label: "No budget yet", accent: "flow" },
};
