import type { CityAnchors } from "@/data/types";
import type { Cents } from "@/domain/types";

/**
 * ============================================================================
 * SURVIVAL MODE
 * ----------------------------------------------------------------------------
 * "I have €42 and it has to last until Friday."
 *
 * This is the highest-stakes screen in the product. A student opening it is
 * not browsing — they are worried, and they need a number they can act on in
 * the next ten minutes. Three rules follow from that, and they govern every
 * line below:
 *
 *   1. Eating is not discretionary. Food is allocated first, from the city's
 *      real grocery anchors, before anything else gets a cent. A plan that
 *      leaves someone €4 for four days of food is not a plan.
 *   2. There is always a buffer. Never zero. A plan that spends the last cent
 *      breaks the first time a bus is €2.20 instead of €1.50, and then the
 *      student stops trusting the product at the exact moment they needed it.
 *   3. Nothing is invented. Every anchor comes from the city row. When the
 *      money genuinely does not cover the essentials, the plan says so plainly
 *      and switches to what *can* be done — it does not quietly shrink the
 *      food line until the arithmetic looks tidy.
 *
 * No model is called. This is arithmetic against city anchors, which makes it
 * instant, free, and identical every time the student reloads — three
 * properties that matter more here than anywhere else in the product.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Shape                                                                       */
/* -------------------------------------------------------------------------- */

export type SurvivalLine = {
  key: "groceries" | "meals" | "transport" | "activities" | "buffer";
  label: string;
  amountCents: Cents;
  /** One line explaining where the number came from. Always a real anchor. */
  basis: string;
  /** Free lines are shown at €0 rather than omitted — that is the point. */
  free: boolean;
};

export type SurvivalPlan = {
  amountCents: Cents;
  days: number;
  perDayCents: Cents;
  lines: SurvivalLine[];
  /** Sums to `amountCents`, by construction. */
  allocatedCents: Cents;
  /** True when the money does not cover food and transport for the period. */
  tight: boolean;
  /** The honest headline. Never falsely reassuring. */
  verdict: string;
  /** Concrete next actions, ordered. */
  moves: string[];
};

/* -------------------------------------------------------------------------- */
/* Tuning                                                                      */
/* -------------------------------------------------------------------------- */

const RULES = {
  /** Share of the total held back for the unexpected. Never below the floor. */
  bufferShare: 0.12,
  bufferFloorCents: 300,
  /** Cooking at home is the single biggest lever a broke student has. */
  cookedMealsPerDay: 2,
  /** How many bought meals a plan allows per week when money is tight. */
  boughtMealsPerWeekTight: 1,
  boughtMealsPerWeekComfortable: 3,
  /** Journeys per day assumed when the student is not walking everywhere. */
  journeysPerDay: 2,
} as const;

/* -------------------------------------------------------------------------- */
/* The plan                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Build a survival plan.
 *
 * Allocation order is deliberate and is the whole algorithm: buffer, then
 * groceries, then transport, then — only from what genuinely remains — a
 * bought meal or two. Activities are always free, because at this budget the
 * honest answer to "what can I do this weekend" is the free answer, and
 * pretending otherwise is what makes budgeting apps feel like they were built
 * by someone who has never been broke.
 */
/** What the engine needs from a city. Anchors are null where no price data exists yet. */
export type SurvivalCity = {
  name: string;
  anchors: CityAnchors | null;
  transport: { card: string } | null;
};

/**
 * Rule-of-thumb split for a city with no price anchors. Stated as such in the
 * basis copy — never dressed up as local data.
 */
const FALLBACK_SHARES = { groceries: 0.6, transport: 0.15 } as const;

export function buildSurvivalPlan(input: {
  amountCents: Cents;
  days: number;
  city: SurvivalCity;
  /** Whether the student has a season ticket already. Zero is a real answer. */
  hasTransportPass?: boolean;
  walksEverywhere?: boolean;
}): SurvivalPlan {
  const { amountCents, city } = input;
  const days = Math.max(1, Math.round(input.days));

  /* ---- buffer, first ---------------------------------------------------- */
  const bufferCents = Math.max(
    Math.min(RULES.bufferFloorCents, Math.round(amountCents * 0.25)),
    Math.round(amountCents * RULES.bufferShare),
  );

  let remaining = amountCents - bufferCents;

  /* ---- groceries -------------------------------------------------------- */
  /* The city row carries a weekly grocery range. Use the low end: a student in
     Survival Mode is shopping at the bottom of that range by definition. */
  const anchors = city.anchors;
  const groceriesTarget = anchors
    ? Math.round((anchors.weeklyGroceries[0] * 100 * days) / 7)
    : Math.round(remaining * FALLBACK_SHARES.groceries);
  const groceriesCents = Math.max(0, Math.min(remaining, groceriesTarget));
  remaining -= groceriesCents;

  /* ---- transport -------------------------------------------------------- */
  const fareCents = anchors ? Math.round(anchors.singleFare * 100) : null;
  const transportTarget =
    input.hasTransportPass || input.walksEverywhere || fareCents === 0
      ? 0
      : fareCents === null
        ? Math.round(remaining * FALLBACK_SHARES.transport)
        : fareCents * RULES.journeysPerDay * days;
  const transportCents = Math.max(0, Math.min(remaining, transportTarget));
  remaining -= transportCents;

  /* ---- bought meals, from what is genuinely left ------------------------ */
  /* With no lunch anchor there is no honest meal figure, so no bought meals. */
  const lunchCents = anchors ? Math.round(anchors.lunch[0] * 100) : 0;
  const tight = groceriesCents < groceriesTarget || transportCents < transportTarget;

  const allowedMeals = anchors
    ? Math.max(
        0,
        Math.round(
          ((tight ? RULES.boughtMealsPerWeekTight : RULES.boughtMealsPerWeekComfortable) * days) / 7,
        ),
      )
    : 0;
  const mealsTarget = allowedMeals * lunchCents;
  const mealsCents = Math.max(0, Math.min(remaining, mealsTarget));
  remaining -= mealsCents;

  /* Anything still unallocated goes back to the buffer rather than being
     invented as a spending line. Money the student did not have to spend is a
     good outcome, not a gap in the plan. */
  const finalBufferCents = bufferCents + remaining;

  const lines: SurvivalLine[] = [
    {
      key: "groceries",
      label: "Groceries",
      amountCents: groceriesCents,
      basis: !anchors
        ? `No ${city.name} price data yet — a rule-of-thumb share, not a local figure`
        : groceriesCents >= groceriesTarget
          ? `${days} day${days === 1 ? "" : "s"} at the low end of ${city.name} weekly shop`
          : `All that is left after the buffer — below a normal ${city.name} shop`,
      free: false,
    },
    {
      key: "transport",
      label: "Transport",
      amountCents: transportCents,
      basis:
        transportTarget === 0
          ? input.hasTransportPass
            ? "Already covered by your pass"
            : "Walking distance"
          : !anchors
            ? `No ${city.name} fare data yet — a rule-of-thumb share`
            : `${RULES.journeysPerDay} journeys a day at ${city.transport?.card ?? "the local"} single fare`,
      free: transportCents === 0,
    },
    {
      key: "meals",
      label: allowedMeals === 0 ? "Eating out" : `Eating out (${allowedMeals})`,
      amountCents: mealsCents,
      basis:
        allowedMeals === 0
          ? anchors
            ? "Not this week. Cook everything."
            : `No ${city.name} price data yet. Cook everything.`
          : `${allowedMeals} meal${allowedMeals === 1 ? "" : "s"} at ${city.name} student prices`,
      free: mealsCents === 0,
    },
    {
      key: "activities",
      label: "Things to do",
      amountCents: 0,
      basis: "Free events, parks and campus only",
      free: true,
    },
    {
      key: "buffer",
      label: "Buffer",
      amountCents: finalBufferCents,
      basis: "Untouched unless something goes wrong",
      free: false,
    },
  ];

  const perDayCents = Math.floor((amountCents - finalBufferCents) / days);

  return {
    amountCents,
    days,
    perDayCents,
    lines,
    allocatedCents: lines.reduce((sum, line) => sum + line.amountCents, 0),
    tight,
    verdict: verdictFor({ tight, days, perDayCents, groceriesCents, groceriesTarget }),
    moves: movesFor({ tight, city, allowedMeals }),
  };
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The headline.
 *
 * Never falsely reassuring, and never catastrophising either. When the money
 * does not stretch, it says which part does not stretch, because that is the
 * part the student can go and do something about.
 */
function verdictFor(input: {
  tight: boolean;
  days: number;
  perDayCents: Cents;
  groceriesCents: Cents;
  groceriesTarget: Cents;
}): string {
  const { tight, days, groceriesCents, groceriesTarget } = input;
  const period = `${days} day${days === 1 ? "" : "s"}`;

  if (groceriesCents < groceriesTarget * 0.6) {
    return `This is under a normal food shop for ${period}. The plan below is the most it stretches to — worth checking your campus for a food pantry or a subsidised canteen.`;
  }
  if (tight) {
    return `It covers food and getting around for ${period}, with nothing spare. Everything social in here is free.`;
  }
  return `That works for ${period}. Food and transport are covered, and there is a little room left.`;
}

/** Concrete, city-aware next actions. Ordered by how much they save. */
function movesFor(input: { tight: boolean; city: SurvivalCity; allowedMeals: number }): string[] {
  const moves = [
    "Shop once for the whole period. A second trip is where the money goes.",
    `Cook ${RULES.cookedMealsPerDay} meals a day — it is the difference this plan is built on.`,
  ];

  if (input.allowedMeals === 0) {
    moves.push("Skip eating out entirely this stretch. One lunch out is most of a day's food.");
  }
  if (input.tight) {
    moves.push("Walk anything under 25 minutes.");
  }
  moves.push("Pick from free events only — there are usually more than you would expect.");

  return moves;
}

/* -------------------------------------------------------------------------- */
/* Free preview                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What a free user sees before the paywall.
 *
 * Deliberately a real, computed plan with the *amounts* withheld rather than a
 * mock-up: the categories and the reasoning are genuinely theirs, so the
 * upgrade prompt is an accurate preview instead of a promise. Faking the
 * preview would be both dishonest and worse marketing — the real one is more
 * convincing.
 */
export type SurvivalPreview = {
  days: number;
  lines: { label: string; basis: string; free: boolean }[];
  verdict: string;
  lockedLineCount: number;
};

export function previewSurvivalPlan(
  input: Parameters<typeof buildSurvivalPlan>[0],
): SurvivalPreview {
  const plan = buildSurvivalPlan(input);
  return {
    days: plan.days,
    lines: plan.lines.map((line) => ({
      label: line.label,
      basis: line.basis,
      /* Free lines keep their €0, because "this part costs nothing" is the
         most useful thing on the screen and withholding it would be mean. */
      free: line.free,
    })),
    verdict: plan.verdict,
    lockedLineCount: plan.lines.filter((line) => !line.free).length,
  };
}
