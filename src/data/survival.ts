import type { City } from "./types";

/**
 * ============================================================================
 * SURVIVAL MODE
 * ----------------------------------------------------------------------------
 * "I have €42 and it has to last until Friday."
 *
 * This is the most-asked student money question and no budgeting app answers
 * it, because they are all built to explain a month that already happened.
 *
 * The allocator below is real arithmetic, not a lookup table. It takes the
 * money and the days, subtracts what is genuinely unavoidable, then divides
 * what is left the way a student who has done this before would: food first,
 * a real buffer second, and nothing at all allocated to going out — because
 * the honest answer at this budget is that the going-out line is free events,
 * and pretending otherwise is how a plan gets ignored.
 *
 * Two properties the UI depends on:
 * - The rows always sum to exactly the input. No rounding drift, ever.
 * - It degrades honestly. Below the floor it stops producing a cheerful plan
 *   and says the number does not cover the week, which is information.
 * ============================================================================
 */

export type SurvivalRow = {
  key: string;
  label: string;
  /** What the number is for, in the student's own terms. */
  detail: string;
  amount: number;
  accent: "mint" | "flow" | "amber" | "signal" | "pulse";
};

export type SurvivalPlan = {
  amount: number;
  days: number;
  rows: readonly SurvivalRow[];
  /** Money per day once the fixed rows are paid. The number that decides. */
  perDay: number;
  /** Held back on purpose. A plan with no slack is a plan that breaks on day 2. */
  buffer: number;
  /**
   * True when the money genuinely does not stretch. The UI must show the
   * honest version rather than a prettier plan that cannot survive contact
   * with a real week.
   */
  tight: boolean;
};

/** Round to 10 cents, always downward. A survival plan is never optimistic. */
function floorTo10c(value: number): number {
  return Math.floor(value * 10) / 10;
}

/**
 * Build the plan.
 *
 * @param amount money available, in the city's currency
 * @param days   days it has to cover, including today
 * @param city   supplies the transport anchor, so Berlin and Amsterdam — where
 *               a student already holds the ride — correctly get a €0 transport
 *               row instead of a fare they have already paid
 */
export function survivalPlan(amount: number, days: number, city: City): SurvivalPlan {
  const safeDays = Math.max(1, Math.round(days));

  /* Transport is the only genuinely fixed cost, and in several cities it is
     already covered by the semester card. Two legs a day, capped at a third of
     the total so it can never eat a small budget. */
  const fare = city.anchors.singleFare;
  const transport = fare === 0 ? 0 : Math.min(floorTo10c(fare * 2 * safeDays), floorTo10c(amount / 3));

  const afterTransport = Math.max(0, amount - transport);

  /* A buffer of 15%, floored at nothing and capped so it never looks like the
     plan is hoarding money the student can see sitting there. */
  const buffer = floorTo10c(Math.min(afterTransport * 0.15, 12));

  const forFood = Math.max(0, afterTransport - buffer);

  /* Groceries take roughly two thirds of the food money: cooking is the whole
     reason the number works. The remaining third is the cheap-meal line, which
     exists because nobody cooks seven days out of seven and a plan that
     pretends they will is a plan that gets abandoned on day three. */
  const groceries = floorTo10c(forFood * 0.66);
  const meals = floorTo10c(forFood - groceries);

  /* Whatever the flooring dropped goes back into the buffer, so the rows sum
     to exactly the amount the student typed. */
  const allocated = transport + groceries + meals + buffer;
  const remainder = Math.round((amount - allocated) * 100) / 100;
  const finalBuffer = Math.round((buffer + remainder) * 100) / 100;

  const rows: SurvivalRow[] = [
    {
      key: "groceries",
      label: "Groceries",
      detail: `One shop, ${safeDays === 1 ? "today" : `${safeDays} days`}. Market for veg, discount supermarket for the rest.`,
      amount: groceries,
      accent: "mint",
    },
    {
      key: "transport",
      label: "Transport",
      detail:
        fare === 0
          ? `Nothing. The ${city.transport.card} already covers your journeys.`
          : `Two legs a day at the ${city.transport.card} single rate.`,
      amount: transport,
      accent: "flow",
    },
    {
      key: "meals",
      label: "Cheap meals out",
      detail: "The days you will not cook. Student menus, not restaurants.",
      amount: meals,
      accent: "amber",
    },
    {
      key: "free",
      label: "Things to do",
      detail: "Free events, parks and the free museum windows. Not a compromise.",
      amount: 0,
      accent: "signal",
    },
    {
      key: "buffer",
      label: "Buffer",
      detail: "Untouched unless something goes wrong. It usually does.",
      amount: finalBuffer,
      accent: "pulse",
    },
  ];

  return {
    amount,
    days: safeDays,
    rows,
    perDay: floorTo10c((groceries + meals) / safeDays),
    buffer: finalBuffer,
    /* Below roughly €4 a day for food the plan stops being a plan. That is the
       point where the product should say so instead of drawing a nice chart. */
    tight: (groceries + meals) / safeDays < 4,
  };
}

/** The opening state of the section: the number that makes the point. */
export const survivalDefaults = { amount: 42, days: 4 } as const;

/** Slider bounds. Wide enough to be honest at both ends. */
export const survivalRange = { min: 10, max: 150, step: 1 } as const;

/**
 * The deadline picker.
 *
 * `label` is the button. `phrase` is the same horizon written to sit inside a
 * sentence — which is not the same string and cannot be derived by lowercasing
 * one: "Friday" is a proper noun and stays capitalised, while "A week" has to
 * become "the end of the week" to read as English mid-headline.
 */
export const survivalHorizons: readonly { days: number; label: string; phrase: string }[] = [
  { days: 2, label: "Tomorrow", phrase: "tomorrow" },
  { days: 4, label: "Friday", phrase: "Friday" },
  { days: 7, label: "A week", phrase: "the end of the week" },
  { days: 14, label: "Two weeks", phrase: "the week after next" },
];
