import type { Cents, Id, Iso } from "@/domain/types";

/**
 * ============================================================================
 * INSIGHT
 * ----------------------------------------------------------------------------
 * The product's own feedback loop: what students asked for and did not get,
 * what they achieved, and the optional challenges that give a reason to come
 * back.
 *
 * The privacy shape of this module is the important part. `SearchMiss` stores
 * a *classified intent* — "laundry", "haircut", "airport-transport" — and
 * never the raw text a student typed. That is a deliberate trade: admin can
 * see that 412 students needed laundry information, and nobody, including us,
 * can reconstruct who asked what. A searchable archive of student queries is a
 * liability with no product upside.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Unmet needs                                                                 */
/* -------------------------------------------------------------------------- */

/** Why the product could not answer. Separates a data gap from a build gap. */
export type NeedGap = "missing-data" | "missing-feature" | "missing-city" | "low-confidence";

export const needGapMeta: Record<NeedGap, { label: string; action: string }> = {
  "missing-data": {
    label: "Missing data",
    action: "We have the feature but no rows for this city.",
  },
  "missing-feature": {
    label: "Missing feature",
    action: "Students want something the product does not do yet.",
  },
  "missing-city": { label: "Missing city", action: "Demand in a city that is not open." },
  "low-confidence": {
    label: "Low confidence",
    action: "We had rows but not enough confirmations to answer.",
  },
};

/** One classified miss. Aggregated into `UnmetNeed`; never shown individually. */
export type SearchMiss = {
  id: Id;
  userId: Id | null;
  citySlug: string;
  /** Normalised intent only. The raw query is never persisted. */
  intent: string;
  surface: "ask" | "search" | "explore" | "events";
  resultCount: number;
  createdAt: Iso;
};

/** The aggregate admin actually reads. */
export type UnmetNeed = {
  id: Id;
  citySlug: string;
  campusSlug: string | null;
  intent: string;
  gap: NeedGap;
  /** Distinct students, not distinct queries. One student asking twice is one. */
  hits: number;
  tag: "potential-feature" | "missing-data" | "new-category" | "city-requirement" | null;
  firstSeenAt: Iso;
  lastSeenAt: Iso;
};

/**
 * The intent vocabulary. A closed list, because the entire value of this
 * feature is that "cheap laundry", "where to wash clothes" and "laundrette"
 * land on one row that reads 412 rather than three rows that read 140.
 *
 * Unmatched queries fall through to `other`, and a rising `other` count is
 * itself the signal that this list needs extending.
 */
export const intentVocabulary: readonly { intent: string; label: string; terms: readonly string[] }[] = [
  { intent: "cheap-food", label: "Cheap food", terms: ["cheap eat", "cheap food", "cheap lunch", "menu del dia", "budget meal"] },
  { intent: "groceries", label: "Groceries", terms: ["supermarket", "grocery", "groceries", "food shop"] },
  { intent: "laundry", label: "Laundry", terms: ["laundry", "laundrette", "launderette", "wash clothes", "washing machine"] },
  { intent: "haircut", label: "Haircuts", terms: ["haircut", "barber", "hairdresser", "salon"] },
  { intent: "printing", label: "Printing", terms: ["print", "printing", "photocopy", "copy shop"] },
  { intent: "sim-card", label: "SIM cards", terms: ["sim", "phone plan", "mobile plan", "data plan"] },
  { intent: "bank-account", label: "Bank accounts", terms: ["bank", "bank account", "iban", "open account"] },
  { intent: "airport-transport", label: "Airport transport", terms: ["airport", "from airport", "to airport"] },
  { intent: "student-jobs", label: "Student jobs", terms: ["job", "part time", "part-time", "work", "hiring"] },
  { intent: "gym", label: "Gyms", terms: ["gym", "fitness", "weights", "climbing"] },
  { intent: "doctor", label: "Healthcare", terms: ["doctor", "gp", "clinic", "pharmacy", "health"] },
  { intent: "housing", label: "Housing", terms: ["flat", "apartment", "room", "rent", "housing", "landlord"] },
  { intent: "free-things", label: "Free things", terms: ["free", "for free", "no money", "zero"] },
  { intent: "nightlife", label: "Nightlife", terms: ["club", "bar", "night out", "party", "drinks"] },
  { intent: "study-spot", label: "Study spots", terms: ["study", "library", "quiet cafe", "work from"] },
  { intent: "language-exchange", label: "Language exchange", terms: ["language exchange", "practise", "practice spanish", "tandem"] },
  { intent: "weekend-trip", label: "Weekend trips", terms: ["weekend trip", "day trip", "travel to", "getaway"] },
  { intent: "furniture", label: "Furniture", terms: ["furniture", "desk", "mattress", "ikea", "second hand"] },
  { intent: "bike", label: "Bikes", terms: ["bike", "bicycle", "cycling"] },
  { intent: "residency", label: "Residency admin", terms: ["residency", "tie", "nie", "registration", "empadronamiento", "visa"] },
];

/**
 * Classify a query into an intent. Pure string work — no model call, because
 * running an LLM over every search to bucket it would cost more than the
 * feature is worth and would be slower than the search itself.
 */
export function classifyIntent(query: string): string {
  const text = query.toLowerCase().trim();
  if (!text) return "other";
  for (const entry of intentVocabulary) {
    if (entry.terms.some((term) => text.includes(term))) return entry.intent;
  }
  return "other";
}

export function intentLabel(intent: string): string {
  return intentVocabulary.find((entry) => entry.intent === intent)?.label ?? "Other";
}

/* -------------------------------------------------------------------------- */
/* Weekly recap                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The weekly read. Every field is computed from rows the student created, so a
 * recap never claims something that did not happen — which is what separates a
 * useful recap from the "you had a great week!" genre.
 */
export type WeeklyRecap = {
  weekStart: Iso;
  spentCents: Cents;
  targetCents: Cents;
  /** Only counted when a cheaper alternative was actually taken. */
  savedCents: Cents;
  placesDiscovered: number;
  eventsSaved: number;
  peopleMet: number;
  contributions: number;
  freeThingsDone: number;
  /** The single most useful thing to do next week, chosen deterministically. */
  suggestion: string;
};

/* -------------------------------------------------------------------------- */
/* Semester recap — the share card                                             */
/* -------------------------------------------------------------------------- */

/**
 * The shareable one. Financial figures are opt-in per field: a student sharing
 * "42 places, 18 events" is fine with that being public, and the same student
 * may not want "€317 saved" on a story. So the card takes a visibility map
 * rather than a boolean.
 */
export type SemesterRecap = {
  citySlug: string;
  cityName: string;
  fromDate: Iso;
  toDate: Iso;
  placesDiscovered: number;
  savedCents: Cents;
  eventsAttended: number;
  neighbourhoodsExplored: number;
  plansMade: number;
  peopleMet: number;
  topCategory: string;
  /** Which fields the student agreed to show. Defaults exclude money. */
  visible: Record<SemesterRecapField, boolean>;
};

export type SemesterRecapField =
  | "places"
  | "saved"
  | "events"
  | "neighbourhoods"
  | "plans"
  | "people"
  | "topCategory";

export const defaultRecapVisibility: Record<SemesterRecapField, boolean> = {
  places: true,
  saved: false,
  events: true,
  neighbourhoods: true,
  plans: true,
  people: false,
  topCategory: true,
};

/* -------------------------------------------------------------------------- */
/* Challenges                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Optional, city-wide, and deliberately gentle.
 *
 * The line this stays on the right side of: challenges are about *discovery*
 * ("try three new places", "a free event this week"), not about spending less
 * than other people. Turning a student's finances into a public leaderboard
 * is how a budgeting product ends up making anxious people more anxious, and
 * there is no version of that which is worth the engagement.
 */
export type ChallengeMetric =
  | "zero-spend-day"
  | "weekend-under"
  | "new-places"
  | "free-events"
  | "walk-everywhere";

export type Challenge = {
  id: Id;
  citySlug: string | null;
  slug: string;
  title: string;
  blurb: string;
  emoji: string;
  metric: ChallengeMetric;
  target: number;
  /** For "weekend-under": the cap. Null for every other metric. */
  capCents: Cents | null;
  startsAt: Iso;
  endsAt: Iso;
};

export type ChallengeEntry = {
  challengeId: Id;
  userId: Id;
  progress: number;
  completedAt: Iso | null;
  joinedAt: Iso;
};

export const challengeMetricLabel: Record<ChallengeMetric, string> = {
  "zero-spend-day": "A day with nothing spent",
  "weekend-under": "A weekend under the cap",
  "new-places": "New places visited",
  "free-events": "Free events attended",
  "walk-everywhere": "Journeys walked instead of paid for",
};

/* -------------------------------------------------------------------------- */
/* City exploration                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Light exploration tracking. Neighbourhoods visited, not points scored: the
 * reward is a map of your own city filling in, which is intrinsically nice to
 * look at, rather than a number that means nothing outside the app.
 */
export type Exploration = {
  userId: Id;
  citySlug: string;
  neighbourhoods: readonly string[];
  placeIds: readonly Id[];
  updatedAt: Iso;
};

/** Milestones worth a mascot reaction. Kept short — three is plenty. */
export const explorationMilestones: readonly {
  id: string;
  label: string;
  test: (e: Pick<Exploration, "neighbourhoods" | "placeIds">) => boolean;
}[] = [
  {
    id: "first-neighbourhood",
    label: "First neighbourhood explored",
    test: (e) => e.neighbourhoods.length >= 1,
  },
  { id: "five-places", label: "Five places found", test: (e) => e.placeIds.length >= 5 },
  {
    id: "three-neighbourhoods",
    label: "Three neighbourhoods explored",
    test: (e) => e.neighbourhoods.length >= 3,
  },
];
