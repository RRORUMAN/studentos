import type { Id, Iso } from "@/domain/types";

/**
 * ============================================================================
 * LIFECYCLE
 * ----------------------------------------------------------------------------
 * The organising idea of the whole product.
 *
 * A student three weeks before they fly and a student three weeks before they
 * leave need almost nothing in common, and a single fixed Home cannot serve
 * both without being mediocre for everyone. So every adaptive surface reads
 * one value — `LifeStage` — and the rules that produce it live here, in one
 * pure function with no I/O, so they can be unit tested against a fixed clock
 * rather than "whatever today is".
 *
 * The stages are deliberately coarse. Six is enough to change what Home leads
 * with; twelve would be a taxonomy nobody could hold in their head, and every
 * screen would need a case for a distinction students do not feel.
 * ============================================================================
 */

export type LifeStage =
  /** Has a city and an arrival date still in the future. */
  | "before-arrival"
  /** Arrival day and the day after. The highest-stakes 48 hours. */
  | "first-24h"
  /** Days 2-7. */
  | "first-week"
  /** Days 8-30. */
  | "first-month"
  /** The long middle. Most students, most of the time. */
  | "established"
  /** Departure inside eight weeks. Overrides everything except pre-arrival. */
  | "leaving";

/** What the student told us about housing, captured in My Move. */
export type HousingSituation =
  | "sorted"
  | "temporary"
  | "searching"
  | "university-halls"
  | "with-family"
  | "unknown";

/** The move record. Drives Arrival Mode, Leaving Mode and the Home layout. */
export type Move = {
  userId: Id;
  fromCountryCode: string | null;
  toCountryCode: string;
  citySlug: string;
  campusSlug: string | null;
  arrivingOn: Iso | null;
  leavingOn: Iso | null;
  housing: HousingSituation;
  /** Months. Decides whether a season ticket is worth recommending at all. */
  stayMonths: number | null;
  createdAt: Iso;
  updatedAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Thresholds                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * All the magic numbers, named and in one block so a product decision to (say)
 * start Leaving Mode earlier is a one-line change rather than a hunt.
 */
export const lifecycle = {
  /** Days after arrival that still count as the first 24 hours window. */
  firstDayDays: 2,
  firstWeekDays: 7,
  firstMonthDays: 30,
  /** How long before departure Leaving Mode takes over Home. */
  leavingWindowDays: 56,
  /** Below this, Arrival Mode starts showing the pre-arrival timeline. */
  preArrivalWindowDays: 60,
} as const;

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: Date, to: Date): number {
  /* Compare at UTC midnight. Comparing raw instants makes "arriving tomorrow"
     flip to "arriving today" at 00:00 local for some students and 23:00 for
     others, which is exactly the sort of bug a worldwide product ships. */
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

/* -------------------------------------------------------------------------- */
/* The stage engine                                                            */
/* -------------------------------------------------------------------------- */

export type StageInput = {
  arrivingOn: Iso | null;
  leavingOn: Iso | null;
  /** Fallback when no arrival date was given: when the account was made. */
  joinedAt: Iso;
};

export type StageReading = {
  stage: LifeStage;
  /** Days until arrival. Null once arrived or when no date is known. */
  daysUntilArrival: number | null;
  /** Days since arrival. Null before arrival. */
  daysSinceArrival: number | null;
  /** Days until departure. Null when no departure date is known. */
  daysUntilDeparture: number | null;
};

/**
 * Resolve the stage.
 *
 * Order matters and is the product decision this function encodes:
 *
 *   1. Not arrived yet wins over everything. A student who has not landed does
 *      not need Leaving Mode, even if they already entered a departure date —
 *      which most exchange students do, because the dates come together on the
 *      same university form.
 *   2. Leaving wins over the settled stages. Someone eight weeks from the end
 *      of an exchange has a different set of urgent problems from someone
 *      mid-term, and those problems have deadlines.
 *   3. Otherwise, time since arrival.
 *
 * With no arrival date at all, `joinedAt` stands in. That is right for the
 * common case of a student who already lives in the city and signed up without
 * ever setting a move date: they get the first-week treatment for a week,
 * which is genuinely useful, and then settle.
 */
export function resolveStage(input: StageInput, now: Date = new Date()): StageReading {
  const arrival = input.arrivingOn ? new Date(input.arrivingOn) : null;
  const departure = input.leavingOn ? new Date(input.leavingOn) : null;

  const daysUntilArrival = arrival ? daysBetween(now, arrival) : null;
  const daysUntilDeparture = departure ? daysBetween(now, departure) : null;

  /* 1. Still to come. */
  if (daysUntilArrival !== null && daysUntilArrival > 0) {
    return {
      stage: "before-arrival",
      daysUntilArrival,
      daysSinceArrival: null,
      daysUntilDeparture,
    };
  }

  /* Reference point for "how settled are they": the arrival date when we have
     one, otherwise the day the account was created. */
  const reference = arrival ?? new Date(input.joinedAt);
  const daysSinceArrival = Math.max(0, daysBetween(reference, now));

  /* 2. Leaving. Only once actually here, and only inside the window. */
  if (
    daysUntilDeparture !== null &&
    daysUntilDeparture >= 0 &&
    daysUntilDeparture <= lifecycle.leavingWindowDays
  ) {
    return { stage: "leaving", daysUntilArrival: null, daysSinceArrival, daysUntilDeparture };
  }

  /* 3. Settling in. */
  const stage: LifeStage =
    daysSinceArrival < lifecycle.firstDayDays
      ? "first-24h"
      : daysSinceArrival <= lifecycle.firstWeekDays
        ? "first-week"
        : daysSinceArrival <= lifecycle.firstMonthDays
          ? "first-month"
          : "established";

  return { stage, daysUntilArrival: null, daysSinceArrival, daysUntilDeparture };
}

/* -------------------------------------------------------------------------- */
/* Presentation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What Home leads with, per stage. Kept next to the engine rather than in the
 * Home component so the stages cannot drift apart from the layouts that serve
 * them — adding a stage forces a compile error here until it has a layout.
 */
export const stageMeta: Record<
  LifeStage,
  {
    label: string;
    /** One line, in the student's own terms, describing where they are. */
    summary: string;
    /** Ordered Home blocks. The first is the hero. */
    blocks: readonly HomeBlock[];
    /** Which mascot state fits this stage. */
    mascot: "neutral" | "thinking" | "excited" | "explorer" | "social" | "determined";
  }
> = {
  "before-arrival": {
    label: "Before you arrive",
    summary: "Getting the things done that are easier from home than from a hostel.",
    blocks: ["countdown", "arrival-tasks", "first-month-estimate", "city-questions", "campus", "saved"],
    mascot: "thinking",
  },
  "first-24h": {
    label: "Day one",
    summary: "Supermarket, transport, pharmacy, campus. In that order.",
    blocks: ["arrival-tasks", "starter-pack", "money", "nearby", "campus"],
    mascot: "explorer",
  },
  "first-week": {
    label: "First week",
    summary: "The admin that unblocks everything else, and the first people.",
    blocks: ["arrival-tasks", "money", "free-today", "meet-people", "starter-pack", "pulse"],
    mascot: "explorer",
  },
  "first-month": {
    label: "First month",
    summary: "Settling: a routine, a budget that holds, a group.",
    blocks: ["money", "for-you", "free-today", "meet-people", "pulse", "arrival-tasks"],
    mascot: "social",
  },
  established: {
    label: "Your city",
    summary: "What is on, what it costs, who is going.",
    blocks: ["money", "ask", "for-you", "free-today", "under-ten", "pulse", "plans"],
    mascot: "neutral",
  },
  leaving: {
    label: "Before you go",
    summary: "The list that stops a deposit or a subscription following you home.",
    blocks: ["leaving-tasks", "money", "sell-items", "final-events", "recap", "pulse"],
    mascot: "determined",
  },
};

/**
 * Every block Home can render. The union is exhaustive so `stageMeta` cannot
 * name a block the renderer does not implement.
 */
export type HomeBlock =
  | "countdown"
  | "arrival-tasks"
  | "leaving-tasks"
  | "first-month-estimate"
  | "city-questions"
  | "starter-pack"
  | "money"
  | "ask"
  | "for-you"
  | "free-today"
  | "under-ten"
  | "nearby"
  | "meet-people"
  | "pulse"
  | "plans"
  | "campus"
  | "saved"
  | "sell-items"
  | "final-events"
  | "recap";

/** True when Arrival Mode should be offered at all. */
export function showsArrivalMode(stage: LifeStage): boolean {
  return stage !== "established" && stage !== "leaving";
}

export function showsLeavingMode(stage: LifeStage): boolean {
  return stage === "leaving";
}
