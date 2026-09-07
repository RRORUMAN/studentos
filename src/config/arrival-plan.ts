import type { HousingSituation, LifeStage } from "@/domain/lifecycle";

/**
 * ============================================================================
 * ARRIVAL PLAN
 * ----------------------------------------------------------------------------
 * The move, as a timeline rather than a checklist.
 *
 * A flat list of thirty tasks is the version everyone builds and nobody
 * finishes. The thing that makes this usable is **ordering by what blocks
 * what**: an address unlocks registration, registration unlocks a bank account,
 * a bank account unlocks a phone contract. So each task declares `unblocks`,
 * and the UI can say "do this one first, three things are waiting on it".
 *
 * Phases map to lifecycle stages, so a student three weeks out sees only the
 * things that are genuinely easier from home, and one who landed yesterday
 * sees supermarket, transport and pharmacy — not a visa form.
 *
 * `official` marks a task whose *content* must come from `official_facts` with
 * a source link. The task itself is a prompt; the answer is never authored
 * here and never generated. See the note in `src/server/ai/gateway.ts`.
 * ============================================================================
 */

export type ArrivalPhase = "before" | "first-24h" | "first-week" | "first-month";

export const phaseMeta: Record<
  ArrivalPhase,
  { label: string; blurb: string; stages: readonly LifeStage[] }
> = {
  before: {
    label: "Before you arrive",
    blurb: "Much easier from home than from a hostel with no local number.",
    stages: ["before-arrival"],
  },
  "first-24h": {
    label: "First 24 hours",
    blurb: "Food, a way to get around, and knowing where the pharmacy is.",
    stages: ["before-arrival", "first-24h", "first-week"],
  },
  "first-week": {
    label: "First week",
    blurb: "The admin that unblocks everything else.",
    stages: ["first-24h", "first-week", "first-month"],
  },
  "first-month": {
    label: "First month",
    blurb: "Settling: a routine, a budget that holds, people.",
    stages: ["first-week", "first-month", "established"],
  },
};

export type ArrivalTaskSpec = {
  id: string;
  phase: ArrivalPhase;
  label: string;
  detail: string;
  /** Roughly how long, so the list feels finishable. */
  effort: string;
  /** Ids of tasks this one unblocks. Drives the "do this first" ordering. */
  unblocks?: readonly string[];
  /** Content must come from a verified `official_facts` row, never generated. */
  official?: boolean;
  /** Where in the product this task is actually completed. */
  href?: string;
  /** Only shown for these housing situations. */
  housing?: readonly HousingSituation[];
  /** Hidden for students who asked to keep things private. */
  social?: boolean;
};

export const arrivalTasks: readonly ArrivalTaskSpec[] = [
  /* ---- before -------------------------------------------------------- */
  {
    id: "confirm-accommodation",
    phase: "before",
    label: "Confirm where you are staying the first night",
    detail: "Even if it is temporary. Everything below needs an address to point at.",
    effort: "10 min",
    unblocks: ["save-home", "registration"],
    housing: ["searching", "temporary", "unknown"],
  },
  {
    id: "check-enrolment",
    phase: "before",
    label: "Check what your university needs before you enrol",
    detail: "Documents, insurance proof and deadlines differ by university and nationality.",
    effort: "20 min",
    official: true,
  },
  {
    id: "residency-requirements",
    phase: "before",
    label: "Read the official residency requirements for your nationality",
    detail: "This is the one thing worth reading from the source rather than a forum.",
    effort: "20 min",
    official: true,
    unblocks: ["registration"],
  },
  {
    id: "healthcare-cover",
    phase: "before",
    label: "Sort health cover",
    detail: "Some universities will not complete enrolment without proof of it.",
    effort: "30 min",
    official: true,
    unblocks: ["check-enrolment"],
  },
  {
    id: "first-month-budget",
    phase: "before",
    label: "Estimate your first month",
    detail: "Deposits and setup costs land in the same fortnight. Better to see it now.",
    effort: "5 min",
    href: "/budget/setup",
  },
  {
    id: "join-campus",
    phase: "before",
    label: "Join your campus community",
    detail: "Ask the questions now, while you still have time to act on the answers.",
    effort: "2 min",
    href: "/pulse?view=campus",
    social: true,
  },

  /* ---- first 24 hours -------------------------------------------------- */
  {
    id: "save-home",
    phase: "first-24h",
    label: "Save where you are staying",
    detail: "Turns every distance in the app into a walking time. Never shown to anyone else.",
    effort: "1 min",
    href: "/you/profile",
    unblocks: ["find-supermarket", "transport-card"],
  },
  {
    id: "find-supermarket",
    phase: "first-24h",
    label: "Find your cheap supermarket",
    detail: "The difference between the right and wrong one is real money every week.",
    effort: "10 min",
    href: "/discover?layer=groceries",
  },
  {
    id: "route-to-campus",
    phase: "first-24h",
    label: "Work out how you get to campus",
    detail: "Do it once, unhurried, before the day it matters.",
    effort: "15 min",
  },
  {
    id: "find-pharmacy",
    phase: "first-24h",
    label: "Find the nearest pharmacy",
    detail: "Ten seconds now, considerably better than searching at 23:00 unwell.",
    effort: "2 min",
  },
  {
    id: "emergency-numbers",
    phase: "first-24h",
    label: "Save the local emergency number",
    detail: "And your university's out-of-hours line.",
    effort: "2 min",
    official: true,
  },

  /* ---- first week ------------------------------------------------------ */
  {
    id: "transport-card",
    phase: "first-week",
    label: "Get the student transport card",
    detail: "Usually the single biggest recurring saving available to you.",
    effort: "30 min",
    official: true,
  },
  {
    id: "sim-card",
    phase: "first-week",
    label: "Get a local SIM",
    detail: "Prepaid works the same day. A contract needs an address and a bank account.",
    effort: "30 min",
    unblocks: ["bank-account"],
  },
  {
    id: "registration",
    phase: "first-week",
    label: "Register your address",
    detail: "What this is called and whether you need it depends on the country.",
    effort: "Varies",
    official: true,
    unblocks: ["bank-account"],
  },
  {
    id: "student-card",
    phase: "first-week",
    label: "Collect your student card",
    detail: "It is what unlocks most of the discounts in the app.",
    effort: "20 min",
  },
  {
    id: "bank-account",
    phase: "first-week",
    label: "Open a local bank account",
    detail: "Usually needs the address registration above, so do that first.",
    effort: "45 min",
  },
  {
    id: "study-spot",
    phase: "first-week",
    label: "Find one study spot you like",
    detail: "Having somewhere that is not your room matters more than it sounds.",
    effort: "1 hour",
    href: "/discover?layer=study",
  },
  {
    id: "first-event",
    phase: "first-week",
    label: "Go to one thing",
    detail: "Anything. The first one is the hard one.",
    effort: "An evening",
    href: "/events?tab=free",
    social: true,
  },

  /* ---- first month ----------------------------------------------------- */
  {
    id: "monthly-budget",
    phase: "first-month",
    label: "Set a budget that matches reality",
    detail: "You now know what things actually cost here. Adjust it.",
    effort: "10 min",
    href: "/budget/setup",
  },
  {
    id: "cheap-food",
    phase: "first-month",
    label: "Find three cheap places you would go back to",
    detail: "Three is enough to stop defaulting to whatever is nearest.",
    effort: "A week",
    href: "/discover?filter=under-10",
  },
  {
    id: "join-group",
    phase: "first-month",
    label: "Join something that repeats",
    detail: "A weekly sport or language exchange makes friends faster than a big night out.",
    effort: "1 hour",
    href: "/anyone-down",
    social: true,
  },
  {
    id: "review-recurring",
    phase: "first-month",
    label: "Check what is charging you monthly",
    detail: "Gym, phone, subscriptions. Easy to accumulate in a new country.",
    effort: "10 min",
    href: "/budget",
  },
  {
    id: "explore-neighbourhood",
    phase: "first-month",
    label: "Walk your own neighbourhood properly",
    detail: "The cheapest thing you can do, and where most of your life will happen.",
    effort: "An afternoon",
  },
  {
    id: "first-trip",
    phase: "first-month",
    label: "Plan one weekend away",
    detail: "It is cheaper from here than it will ever be from home.",
    effort: "30 min",
  },
];

/* -------------------------------------------------------------------------- */
/* Leaving                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Leaving Mode.
 *
 * The counterpart to arrival, and the loop that feeds it: things sold here
 * become the marketplace an arriving student shops. That is the strongest
 * network effect in the product, and it only exists because departure is
 * treated as a first-class stage rather than churn.
 */
export const leavingTasks: readonly ArrivalTaskSpec[] = [
  {
    id: "cancel-recurring",
    phase: "first-month",
    label: "Cancel anything that renews",
    detail: "Gym, phone, subscriptions. Notice periods are longer than you think.",
    effort: "20 min",
    href: "/budget",
  },
  {
    id: "sell-furniture",
    phase: "first-month",
    label: "Sell what you cannot take",
    detail: "Arriving students need exactly what you are about to throw away.",
    effort: "30 min",
    href: "/exchange/new?mode=offer",
  },
  {
    id: "transport-pass",
    phase: "first-month",
    label: "Sort your transport pass",
    detail: "Some are refundable, most need cancelling to stop billing.",
    effort: "15 min",
    official: true,
  },
  {
    id: "return-university",
    phase: "first-month",
    label: "Return library books and university kit",
    detail: "Withheld results over an unreturned book is a miserable way to end a year.",
    effort: "20 min",
  },
  {
    id: "deposit",
    phase: "first-month",
    label: "Start the deposit conversation early",
    detail: "Photograph everything on the way out. Ask what the deductions will be in writing.",
    effort: "30 min",
  },
  {
    id: "final-bills",
    phase: "first-month",
    label: "Close final bills",
    detail: "Utilities and anything on a direct debit after you leave.",
    effort: "20 min",
  },
  {
    id: "airport-plan",
    phase: "first-month",
    label: "Plan the airport run",
    detail: "With luggage, at that hour, on that day. Not the usual journey.",
    effort: "10 min",
  },
  {
    id: "share-places",
    phase: "first-month",
    label: "Pass on what you worked out",
    detail: "Your cheap places are the most useful thing you can leave behind.",
    effort: "10 min",
    href: "/pulse",
    social: true,
  },
  {
    id: "last-things",
    phase: "first-month",
    label: "Do the things you kept meaning to",
    detail: "There is a list. There is always a list.",
    effort: "Ongoing",
    href: "/events",
  },
];

/* -------------------------------------------------------------------------- */
/* Ordering                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sort tasks so blockers come first.
 *
 * A task that unblocks three others is worth doing before one that unblocks
 * none, regardless of which is easier — that is the entire difference between
 * a checklist and a plan.
 */
export function orderByBlocking(tasks: readonly ArrivalTaskSpec[]): ArrivalTaskSpec[] {
  return [...tasks].sort((a, b) => (b.unblocks?.length ?? 0) - (a.unblocks?.length ?? 0));
}

/** Which phases to show for a stage. */
export function phasesForStage(stage: LifeStage): ArrivalPhase[] {
  return (Object.keys(phaseMeta) as ArrivalPhase[]).filter((phase) =>
    phaseMeta[phase].stages.includes(stage),
  );
}
