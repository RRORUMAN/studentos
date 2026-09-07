import type { City } from "./types";

/**
 * ============================================================================
 * SURVIVAL MODE
 * ----------------------------------------------------------------------------
 * "I have €42 and it has to last until Friday."
 *
 * The allocator is real arithmetic, not a lookup table. It takes the money and
 * the days, subtracts what is genuinely unavoidable, then divides what is left
 * the way a student who has done this before would: food first, a real buffer
 * second, and nothing at all allocated to going out, because at this budget
 * the honest going-out line is free events.
 *
 * Two properties the UI depends on:
 * - The rows always sum to exactly the input. Whole units, no drift.
 * - It degrades honestly. Below the floor it says the number does not cover
 *   the week instead of drawing a nicer chart.
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
  /** Food money per day once the fixed rows are paid. The number that decides. */
  perDay: number;
  buffer: number;
  /** True when the money genuinely does not stretch. */
  tight: boolean;
};

/**
 * Build the plan.
 *
 * @param amount money available, in the city's currency
 * @param days   days it has to cover, including today
 * @param city   supplies the fare, so Berlin and Amsterdam, where a student
 *               already holds the ride, get a zero transport row rather than an
 *               invented fare
 */
export function survivalPlan(amount: number, days: number, city: City): SurvivalPlan {
  const safeDays = Math.max(1, Math.round(days));
  const whole = Math.max(0, Math.floor(amount));

  /* Transport: two legs a day, capped at a sixth of the money so it can never
     eat a small budget. Zero where the semester card already covers it. */
  const fare = city.anchors.singleFare;
  const transport =
    fare === 0 ? 0 : Math.min(Math.floor(fare * 2 * safeDays), Math.floor(whole / 6));

  const afterTransport = whole - transport;

  /* A fifth held back. A plan with no slack breaks on day two. */
  const buffer = Math.floor(afterTransport * 0.2);
  const forFood = afterTransport - buffer;

  /* Groceries take roughly two thirds of the food money: cooking is the whole
     reason the number works. The rest is the cheap-meal line, because nobody
     cooks every day and a plan that assumes they will gets abandoned. */
  const groceries = Math.floor(forFood * 0.65);
  const meals = forFood - groceries;

  const rows: SurvivalRow[] = [
    {
      key: "groceries",
      label: "Groceries",
      detail: `One shop for ${safeDays === 1 ? "today" : `${safeDays} days`}. Market for veg, discounter for the rest.`,
      amount: groceries,
      accent: "mint",
    },
    {
      key: "transport",
      label: "Transport",
      detail:
        fare === 0
          ? `Covered. The ${city.transport.card} already pays for it.`
          : "Two legs a day at the single fare.",
      amount: transport,
      accent: "flow",
    },
    {
      key: "meals",
      label: "Meals out",
      detail: "The days you will not cook. Student menus, not restaurants.",
      amount: meals,
      accent: "amber",
    },
    {
      key: "free",
      label: "Free activities",
      detail: "Free events, parks, the museum free windows. Not a compromise.",
      amount: 0,
      accent: "signal",
    },
    {
      key: "buffer",
      label: "Buffer",
      detail: "Untouched unless something goes wrong. It usually does.",
      amount: buffer,
      accent: "pulse",
    },
  ];

  return {
    amount: whole,
    days: safeDays,
    rows,
    perDay: Math.floor((groceries + meals) / safeDays),
    buffer,
    /* Below roughly 4 a day for food the plan stops being a plan. */
    tight: (groceries + meals) / safeDays < 4,
  };
}

/** The opening state of the section: the number that makes the point. */
export const survivalDefaults = { amount: 42, days: 4 } as const;

/** Slider bounds. Wide enough to be honest at both ends. */
export const survivalRange = { min: 10, max: 150, step: 1 } as const;

/** Amount presets shown as chips. */
export const survivalAmounts: readonly number[] = [25, 42, 60, 90];

/** The deadline picker. `label` is the button; `phrase` sits inside a sentence. */
export const survivalHorizons: readonly { days: number; label: string; phrase: string }[] = [
  { days: 2, label: "Tomorrow", phrase: "tomorrow" },
  { days: 4, label: "Friday", phrase: "Friday" },
  { days: 7, label: "A week", phrase: "the end of the week" },
  { days: 14, label: "Two weeks", phrase: "the week after next" },
];
