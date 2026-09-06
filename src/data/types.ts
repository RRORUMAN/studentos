/**
 * ============================================================================
 * DOMAIN TYPES
 * ----------------------------------------------------------------------------
 * These mirror the eventual Postgres schema (see src/services/db/schema.ts).
 * The marketing site renders seeded rows through the same shapes the product
 * will render live rows through, so every demo on this page is a real
 * component fed real-shaped data rather than a screenshot.
 * ============================================================================
 */

/**
 * Honest availability. Nothing is described as live until it is.
 *
 *   coming-soon   the product works from official data and the student's own
 *                 rows; no seeded local content, Pulse opens with the first post
 *   beta          full local data, community still filling up
 *   live          full local data and an active community
 *   high-density  live, with enough students that friends-of-friends and
 *                 campus signals are meaningful
 */
export type CityStatus = "coming-soon" | "beta" | "live" | "high-density";

export type CityAnchors = {
  lunch: [number, number];
  pint: [number, number];
  monthlyTransport: number;
  weeklyGroceries: [number, number];
  /**
   * One journey, paid singly, in the city's own currency. Zero is a real
   * answer in cities where students already hold a semester ticket or ride a
   * bike, and the planner prints that rather than inventing a fare.
   */
  singleFare: number;
};

export type City = {
  slug: string;
  name: string;
  country: string;
  /** ISO-3166 alpha-2, used for flags and locale defaults. */
  countryCode: string;
  currency: { code: string; symbol: string };
  /** BCP-47, for number, date and currency formatting. */
  locale: string;
  /** IANA. The planner needs it before it can say "tonight". */
  timezone: string;
  /** Languages a student will meet, most common first. */
  languages: readonly string[];
  status: CityStatus;
  /** One line a student would actually say about the city. */
  hook: string;
  /** Two or three sentences for the city landing page. */
  intro: string;
  /** Typical student spend anchors. Ranges, never invented averages. */
  anchors: CityAnchors;
  neighbourhoods: readonly string[];
  campusSlugs: readonly string[];
  transport: { card: string; studentNote: string; officialUrl: string };
  /** Rendered as the map backdrop; purely stylised, not geographic data. */
  mapSeed: number;
};

/**
 * What the product knows about ANY city a student can pick, deep or not.
 * Built by `resolveCity`. Fields the directory cannot fill are null or empty,
 * and every consumer handles that rather than inventing a value.
 */
export type CityContext = {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  currency: { code: string; symbol: string };
  locale: string;
  timezone: string;
  languages: readonly string[];
  status: CityStatus;
  /** Null for a coming-soon city: no local price data yet, and the UI says so. */
  anchors: CityAnchors | null;
  neighbourhoods: readonly string[];
  campusSlugs: readonly string[];
  transport: { card: string; studentNote: string; officialUrl: string } | null;
  mapSeed: number;
  /** True when a full `City` record with seeded content exists. */
  deep: boolean;
};

export type Campus = {
  slug: string;
  name: string;
  shortName: string;
  citySlug: string;
  /** The neighbourhood students associate with the campus. */
  area: string;
};

export type LoopKind =
  | "event"
  | "deal"
  | "looking-for"
  | "question"
  | "tip"
  | "warning"
  | "poll";

export type LoopAuthor = {
  handle: string;
  /** Initials shown in the avatar. Never a fabricated photo. */
  initials: string;
  campusSlug?: string;
  /** Terms in the city. Signals local credibility without fake stats. */
  terms: number;
};

export type LoopPost = {
  id: string;
  citySlug: string;
  kind: LoopKind;
  title: string;
  body?: string;
  author: LoopAuthor;
  /** Minutes ago; rendered through `ago()` so the feed never shows a date. */
  postedMinutesAgo: number;
  upvotes: number;
  comments: number;
  /** Kind-specific chip: "284 interested", "Verified by 17 students". */
  signal?: string;
  /** Where it is happening, when relevant. */
  place?: string;
  when?: string;
  price?: number;
  /** Campus tags shown as chips under the post. */
  tags: readonly string[];
  /** Poll options, only for kind === "poll". */
  poll?: readonly { label: string; share: number }[];
};

export type PlaceLayer =
  | "for-you"
  | "cheap-food"
  | "groceries"
  | "free"
  | "events"
  | "deals"
  | "study"
  | "nightlife"
  | "fitness";

export type Place = {
  id: string;
  citySlug: string;
  name: string;
  category: string;
  layers: readonly PlaceLayer[];
  /** Typical student spend here, not the menu average. */
  price: number | null;
  priceLabel: string;
  walkMinutes: number;
  /** 0-100. Value for money as rated by students, shown as a bar not a star. */
  studentValue: number;
  /**
   * A place is only "verified" once enough students independently confirm it.
   * `verifiedBy` is the count behind the badge — the badge is never decorative.
   */
  verifiedBy: number;
  /** Plain sentence explaining the recommendation. Always attributable. */
  why: string;
  /** Where the claim comes from, shown in the UI next to the recommendation. */
  source: "students" | "official" | "venue" | "mixed";
  /** Position on the stylised map canvas, 0-100 on each axis. */
  x: number;
  y: number;
};

export type PlanItem = {
  time: string;
  title: string;
  detail?: string;
  price: number;
  /** Walking minutes to this stop from the previous one. */
  walkMinutes?: number;
  kind: "food" | "event" | "drink" | "transport" | "culture" | "activity";
  /** Where this row came from. Keeps the AI answer source-aware. */
  source: "students" | "official" | "venue";
};

export type Plan = {
  id: string;
  citySlug: string;
  /** The question that produced it. */
  query: string;
  /** Headline over the generated plan, e.g. "Your €18.50 night". */
  title: string;
  budget: number;
  items: readonly PlanItem[];
  /** Number of nearby students who marked interest. Seeded demo value. */
  interested: number;
  /** Optional closing note under the total. */
  note?: string;
};

export type ArrivalTask = {
  id: string;
  label: string;
  /** What it actually involves, in one sentence. */
  detail: string;
  /** Roughly how long it takes, so the list feels finishable. */
  effort: string;
  /** Official or primary source, linked in the UI. */
  source?: { label: string; url: string };
  /** Set when the step touches legal or immigration requirements. */
  legal?: boolean;
  cost?: string;
};
