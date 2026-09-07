import type { MissionTemplate } from "@/domain/missions";

/**
 * ============================================================================
 * MISSION CATALOGUE
 * ----------------------------------------------------------------------------
 * The templates. Each is a short argument about how to spend a day, a weekend
 * or a first week well on a student budget. The engine in
 * `src/server/engines/missions.ts` fills the slots from real rows; a slot the
 * city cannot fill is dropped, never faked.
 *
 * Budgets are in euro cents and are scaled by the engine for cities priced in
 * another currency, using the city's own lunch anchor as the ratio.
 * ============================================================================
 */

export const missionTemplates: readonly MissionTemplate[] = [
  {
    key: "first-7-days",
    title: "First 7 days",
    tagline: "The seven things that make a new city yours, in order.",
    emoji: "🧭",
    stages: ["before-arrival", "first-24h", "first-week"],
    budgetCents: null,
    durationDays: 7,
    social: false,
    steps: [
      { key: "supermarket", label: "Find your cheap supermarket", kind: "place", pick: { layers: ["groceries"] } },
      { key: "transport", label: "Get the student transport card", kind: "task", href: "/arrival", official: true },
      { key: "sim", label: "Get a local SIM", kind: "task", href: "/arrival" },
      { key: "campus", label: "Walk to campus once, unhurried", kind: "task", href: "/you/city" },
      { key: "lunch", label: "One cheap lunch you would go back to", kind: "place", pick: { layers: ["cheap-food"], maxCents: 1200 } },
      { key: "event", label: "Go to one free thing", kind: "event", pick: { free: true, withinDays: 7 } },
      { key: "people", label: "Join a group that repeats", kind: "social", href: "/anyone-down", optional: true },
    ],
  },
  {
    key: "weekend-under-30",
    title: "Weekend under €30",
    tagline: "Friday to Sunday, everything included, nothing boring.",
    emoji: "🎯",
    stages: [],
    budgetCents: 3000,
    durationDays: 3,
    social: false,
    steps: [
      { key: "museum", label: "A free museum or gallery", kind: "event", pick: { free: true, eventTags: ["culture", "museums", "art"], withinDays: 4 } },
      { key: "lunch", label: "Student lunch", kind: "place", pick: { layers: ["cheap-food"], maxCents: 900 } },
      { key: "sport", label: "Something outdoors or a game", kind: "event", pick: { eventTags: ["sports", "outdoor", "running", "football"], maxCents: 500, withinDays: 4 }, optional: true },
      { key: "night", label: "One night thing", kind: "event", pick: { eventTags: ["music", "nightlife", "social", "cinema"], maxCents: 1000, withinDays: 4 } },
      { key: "transport", label: "Transport", kind: "transport", priceCents: 500 },
      { key: "buffer", label: "Buffer", kind: "buffer", priceCents: 800 },
    ],
  },
  {
    key: "make-50-last",
    title: "Make €50 last until Friday",
    tagline: "A tight week, planned so it does not feel like one.",
    emoji: "🫙",
    stages: [],
    budgetCents: 5000,
    durationDays: 5,
    social: false,
    steps: [
      { key: "groceries", label: "One proper shop at the cheap supermarket", kind: "place", pick: { layers: ["groceries"] }, priceCents: 2500 },
      { key: "lunch", label: "One lunch out, the cheapest good one", kind: "place", pick: { layers: ["cheap-food"], maxCents: 800 } },
      { key: "free", label: "Two free things this week", kind: "event", pick: { free: true, withinDays: 5 } },
      { key: "review", label: "Check what is charging you monthly", kind: "budget", href: "/budget" },
      { key: "transport", label: "Transport", kind: "transport", priceCents: 700 },
      { key: "buffer", label: "Buffer", kind: "buffer", priceCents: 1000 },
    ],
  },
  {
    key: "zero-euro-sunday",
    title: "Zero-euro Sunday",
    tagline: "A whole day out, nothing spent. Harder and better than it sounds.",
    emoji: "🌿",
    stages: [],
    budgetCents: 0,
    durationDays: 1,
    social: false,
    steps: [
      { key: "walk", label: "A walk somewhere you have not been", kind: "place", pick: { layers: ["free"] } },
      { key: "free-event", label: "A free event", kind: "event", pick: { free: true, withinDays: 7 } },
      { key: "study", label: "A free place to sit with a book", kind: "place", pick: { layers: ["study", "free"] }, optional: true },
      { key: "cook", label: "Cook, do not order", kind: "task" },
    ],
  },
  {
    key: "meet-3-people",
    title: "Meet 3 new people",
    tagline: "Three real conversations this week. Not networking. People.",
    emoji: "👋",
    stages: [],
    budgetCents: 2000,
    durationDays: 7,
    social: true,
    steps: [
      { key: "invite", label: "Join or post an Anyone Down? plan", kind: "social", href: "/anyone-down" },
      { key: "event", label: "A social event with students going", kind: "event", pick: { eventTags: ["social", "language-exchange", "networking", "university"], social: true, withinDays: 7 } },
      { key: "campus", label: "Answer one question on your campus feed", kind: "social", href: "/pulse?view=campus" },
      { key: "friend", label: "Add one person as a friend", kind: "social", href: "/you/friends" },
    ],
  },
  {
    key: "exam-week",
    title: "Exam week",
    tagline: "Somewhere to work, something to eat, one thing to look forward to.",
    emoji: "📚",
    stages: [],
    budgetCents: 3000,
    durationDays: 7,
    social: false,
    steps: [
      { key: "spot", label: "A study spot that is not your room", kind: "place", pick: { layers: ["study"] } },
      { key: "backup", label: "A second spot for when the first is full", kind: "place", pick: { layers: ["study"] }, optional: true },
      { key: "lunch", label: "A quick cheap lunch near campus", kind: "place", pick: { layers: ["cheap-food"], maxCents: 900 } },
      { key: "break", label: "One free thing after the last exam", kind: "event", pick: { free: true, withinDays: 8 } },
      { key: "sleep", label: "No plans after 23:00", kind: "task" },
    ],
  },
  {
    key: "explore-neighbourhood",
    title: "Explore your neighbourhood",
    tagline: "The cheapest thing you can do, and where most of your life happens.",
    emoji: "📍",
    stages: [],
    budgetCents: 1500,
    durationDays: 7,
    social: false,
    steps: [
      { key: "coffee", label: "A cheap coffee or lunch place", kind: "place", pick: { layers: ["cheap-food"], maxCents: 700 } },
      { key: "groceries", label: "The nearest cheap supermarket", kind: "place", pick: { layers: ["groceries"] } },
      { key: "free", label: "Somewhere free to sit outside", kind: "place", pick: { layers: ["free"] } },
      { key: "gym", label: "A gym or a run route", kind: "place", pick: { layers: ["fitness"] }, optional: true },
      { key: "save", label: "Save three places you would go back to", kind: "task", href: "/saved" },
    ],
  },
  {
    key: "cheap-date-night",
    title: "Cheap date night",
    tagline: "Under €25 for two and it still counts.",
    emoji: "🌙",
    stages: [],
    budgetCents: 2500,
    durationDays: 3,
    social: false,
    steps: [
      { key: "free", label: "Start with something free", kind: "event", pick: { free: true, eventTags: ["culture", "cinema", "music", "outdoor"], withinDays: 4 } },
      { key: "food", label: "Dinner where students eat", kind: "place", pick: { layers: ["cheap-food"], maxCents: 1200 } },
      { key: "drink", label: "One drink, not the main street", kind: "place", pick: { layers: ["nightlife"], maxCents: 600 }, optional: true },
      { key: "transport", label: "Transport", kind: "transport", priceCents: 300 },
    ],
  },
  {
    key: "moving-out",
    title: "Moving out",
    tagline: "Leave with the deposit, without the subscriptions, and lighter.",
    emoji: "📦",
    stages: ["leaving"],
    budgetCents: null,
    durationDays: 21,
    social: false,
    steps: [
      { key: "cancel", label: "Cancel anything that renews", kind: "budget", href: "/budget" },
      { key: "sell", label: "List what you cannot take", kind: "task", href: "/exchange/new?mode=offer" },
      { key: "deposit", label: "Photograph the flat and ask about the deposit in writing", kind: "task" },
      { key: "bills", label: "Close final bills", kind: "task" },
      { key: "last", label: "One last thing you kept meaning to do", kind: "event", pick: { withinDays: 21 }, optional: true },
      { key: "airport", label: "Plan the airport run with luggage", kind: "task", href: "/lifeops" },
    ],
  },
  {
    key: "first-month",
    title: "First month abroad",
    tagline: "A routine, a budget that holds, and a group.",
    emoji: "🏙️",
    stages: ["first-week", "first-month"],
    budgetCents: null,
    durationDays: 30,
    social: false,
    steps: [
      { key: "budget", label: "Set a budget that matches reality", kind: "budget", href: "/budget/setup" },
      { key: "three", label: "Three cheap places you would go back to", kind: "place", pick: { layers: ["cheap-food"], maxCents: 1200 } },
      { key: "study", label: "One study spot you like", kind: "place", pick: { layers: ["study"] } },
      { key: "group", label: "Join something that repeats", kind: "social", href: "/anyone-down", optional: true },
      { key: "recurring", label: "Check what is charging you monthly", kind: "budget", href: "/budget" },
      { key: "trip", label: "Plan one weekend away", kind: "task", href: "/lifeops" },
    ],
  },
];

export function missionTemplate(key: string): MissionTemplate | undefined {
  return missionTemplates.find((template) => template.key === key);
}

/** Templates offered for a stage. Stage-agnostic templates are always offered. */
export function missionsForStage(stage: string, social: boolean): MissionTemplate[] {
  return missionTemplates.filter(
    (template) =>
      (template.stages.length === 0 || template.stages.includes(stage as MissionTemplate["stages"][number])) &&
      (social || !template.social),
  );
}

/**
 * The first mission a fresh account gets, by stage. Stated here rather than in
 * onboarding so the choice is reviewable next to the catalogue.
 */
export function firstMissionFor(stage: string, social: boolean): MissionTemplate {
  const preferred =
    stage === "before-arrival" || stage === "first-24h" || stage === "first-week"
      ? "first-7-days"
      : stage === "leaving"
        ? "moving-out"
        : social
          ? "meet-3-people"
          : "explore-neighbourhood";
  return missionTemplate(preferred) ?? missionTemplates[0];
}
