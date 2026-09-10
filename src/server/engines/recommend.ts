import type { Place } from "@/data/types";
import { type ValueBand, describeProximity, layersForInterests } from "@/domain/places";
import type { Memory } from "@/domain/social";
import type { Cents, CityEvent, Invite, Profile } from "@/domain/types";

/**
 * ============================================================================
 * RECOMMENDATION ENGINE
 * ----------------------------------------------------------------------------
 * Candidate selection and scoring. No model is called anywhere in this file.
 *
 * The pipeline, and why it is in this order:
 *
 *   1. FILTER   Hard constraints. Closed, out of range, wrong diet, over
 *               budget, explicitly disliked. These are not penalties — a
 *               vegetarian does not want a steakhouse ranked seventh, they
 *               want it absent.
 *   2. SCORE    Seven weighted signals, each normalised to 0-1, combined into
 *               a single 0-100 match. Every component is kept on the result so
 *               the UI can say *why* rather than showing a mystery percentage.
 *   3. DIVERSIFY Stop eight cafés filling the feed.
 *   4. EXPLAIN  Optional, and the only step that may involve a model. It gets
 *               the scored candidates and writes a sentence; it never picks.
 *
 * Keeping selection deterministic is what makes the product affordable: the
 * Home feed for a thousand students is a thousand cheap array passes, not a
 * thousand model calls. It is also what makes it *debuggable* — a bad
 * recommendation can be traced to a component score rather than a prompt.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Weights                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The weights. These are product decisions, not tuned parameters, and they are
 * in one block so a change is reviewable.
 *
 * `budgetFit` is the heaviest deliberately: for the student this product is
 * for, a perfect recommendation they cannot afford is not a recommendation.
 * `studentValue` and `community` together outweigh raw `quality`, because a
 * 4.8-star restaurant that costs €40 is a worse answer here than a 4.1-star
 * one that does a €9 menu.
 */
export const weights = {
  budgetFit: 0.26,
  interestFit: 0.2,
  distanceFit: 0.16,
  studentValue: 0.14,
  communityFit: 0.1,
  quality: 0.07,
  freshness: 0.07,
} as const;

export type ScoreComponent = keyof typeof weights;

/** Bumped when the weights or the pipeline change, and stored on saved plans. */
export const STRATEGY_VERSION = "rec-2026-09-a";

/* -------------------------------------------------------------------------- */
/* Inputs                                                                      */
/* -------------------------------------------------------------------------- */

export type RecommendContext = {
  profile: Pick<
    Profile,
    | "interests"
    | "diets"
    | "maxTravelMinutes"
    | "priceSensitivity"
    | "campusSlug"
    | "citySlug"
    | "transport"
  >;
  memory: Memory | null;
  /** What the student can spend on this, in cents. Null means no ceiling. */
  budgetCents: Cents | null;
  /**
   * Where the student lives, when they told us.
   *
   * Null is common and is handled everywhere: with no home point the search
   * runs from the city centre, and every distance is honestly a distance from
   * the centre rather than from them. Nothing substitutes a campus or a guess.
   */
  homePoint?: { lat: number; lng: number } | null;
  now: Date;
  /** Places friends or campusmates saved, for the community signal. */
  communitySignals?: {
    savedByCampus: ReadonlySet<string>;
    savedByFriends: ReadonlySet<string>;
  };
};

export type Scored<T> = {
  item: T;
  /** 0-100. What the UI prints as "Your match". */
  match: number;
  components: Record<ScoreComponent, number>;
  /** Ordered, human, and only ever facts we actually hold. */
  reasons: string[];
  /**
   * Walking minutes from the student's home point, for events. Null when no
   * home point is set — never a default, because a made-up "15 min" is the
   * kind of confident wrongness that costs trust the first time it is checked.
   */
  walkMinutes?: number | null;
};

/* -------------------------------------------------------------------------- */
/* Component scores                                                            */
/* -------------------------------------------------------------------------- */

/**
 * How well a price fits the money available.
 *
 * The curve is asymmetric on purpose. Comfortably under budget scores 1.0 and
 * stays there — cheaper is never worse for this audience. Over budget falls
 * off a cliff rather than degrading gently, because "€3 over what you have" is
 * functionally the same as impossible when the number is what is left until
 * Friday.
 *
 * Price sensitivity shifts the comfortable band: a "cheapest possible" student
 * gets their best scores well below the ceiling, a "happy to spend more
 * occasionally" student is not penalised for using most of it.
 */
export function scoreBudgetFit(
  priceCents: Cents | null,
  budgetCents: Cents | null,
  sensitivity: Profile["priceSensitivity"],
): number {
  if (priceCents === null) return 0.55; // unknown price: neutral, slightly shy
  if (priceCents === 0) return 1; // free is always a perfect fit
  if (budgetCents === null || budgetCents <= 0) return 0.6;

  const ratio = priceCents / budgetCents;

  if (ratio > 1) {
    /* Over budget. A small overshoot is recoverable, a large one is not. */
    return Math.max(0, 0.35 - (ratio - 1) * 1.4);
  }

  /* The share of budget that scores best, by declared sensitivity. */
  const sweetSpot = {
    cheapest: 0.25,
    value: 0.45,
    balanced: 0.6,
    "occasional-splurge": 0.75,
  }[sensitivity];

  /* Full marks anywhere at or below the sweet spot; taper towards the ceiling. */
  if (ratio <= sweetSpot) return 1;
  return 1 - ((ratio - sweetSpot) / (1 - sweetSpot)) * 0.45;
}

/**
 * Overlap between the student's interests and the thing's tags, softened by
 * learned affinity.
 *
 * Uses a diminishing return rather than a raw count: matching two interests is
 * much better than one, matching five is not much better than three, and
 * without the curve a heavily tagged item outranks a perfect one.
 */
export function scoreInterestFit(
  tags: readonly string[],
  interests: readonly string[],
  memory: Memory | null,
): number {
  if (interests.length === 0 && !memory) return 0.5;

  const wanted = new Set(interests);
  const matches = tags.filter((tag) => wanted.has(tag)).length;
  const declared = matches === 0 ? 0 : 1 - Math.pow(0.55, matches);

  /* Learned affinity, averaged over the tags we have an opinion about. */
  const affinities = tags
    .map((tag) => memory?.categoryAffinity[tag])
    .filter((value): value is number => typeof value === "number");

  if (affinities.length === 0) return declared || 0.35;

  const learned = affinities.reduce((sum, value) => sum + value, 0) / affinities.length;
  /* Map -1..1 onto 0..1 and blend. Behaviour is weighted slightly above what
     was declared at onboarding, because what someone does beats what they
     ticked in a form three months ago. */
  return Math.max(0, Math.min(1, declared * 0.45 + ((learned + 1) / 2) * 0.55));
}

/**
 * Travel time against the student's stated tolerance.
 *
 * Full marks well inside the limit, zero at it. The exponent is above 1 so the
 * curve is *flat near the origin and steep near the limit*, which is how people
 * actually feel about walking: 4 minutes and 8 minutes are both "round the
 * corner" and should score almost the same, while 22 and 26 against a 30-minute
 * ceiling are meaningfully different because one is nearly out of range.
 *
 * A square-root curve does the opposite — it punishes the difference between 4
 * and 8 minutes harder than between 22 and 26 — which quietly demotes the
 * closest places on every feed.
 */
export function scoreDistanceFit(walkMinutes: number, maxMinutes: number): number {
  if (walkMinutes <= 0) return 1;
  if (walkMinutes >= maxMinutes) return 0;
  return 1 - Math.pow(walkMinutes / maxMinutes, 1.8);
}

/**
 * Metres a student covers in a minute on foot.
 *
 * Used ONLY to turn a stated tolerance in minutes into a radius in metres, so
 * that "twenty minutes is my limit" can be compared against a measured
 * distance. It never produces a number shown to anybody: a duration on a
 * screen comes from a routing provider or it does not appear. Same constant as
 * the old walk-time fabrication, used in the opposite direction, and the
 * direction is the entire distinction.
 */
export const WALK_METRES_PER_MINUTE = 78;

/**
 * Distance against the student's stated tolerance, in metres.
 *
 * Same curve and the same reasoning as the minutes version: flat near the
 * origin, steep near the limit, because 300 m and 600 m are both "round the
 * corner" while 1.8 km and 2.1 km against a 2 km ceiling are not.
 */
export function scoreProximityFit(metres: number, maxMetres: number): number {
  if (metres <= 0) return 1;
  if (metres >= maxMetres) return 0;
  return 1 - Math.pow(metres / maxMetres, 1.8);
}

/**
 * Value for money, from the band the domain computed.
 *
 * There is no 0-100 number on a place any more, and this is where that shows
 * up hardest: `insufficient` scores 0.5, not 0. A place nobody has rated is
 * unknown, not bad, and scoring an unknown as zero would bury every place in a
 * new city under the handful somebody happened to confirm. It is the same rule
 * the Work engine already runs on.
 */
export function scoreValueBand(band: ValueBand): number {
  switch (band) {
    case "strong":
      return 1;
    case "good":
      return 0.75;
    case "mixed":
      return 0.35;
    default:
      return 0.5;
  }
}

/**
 * The provider's price band against how price-sensitive the student is.
 *
 * Null is 0.5 for the same reason as above. Most rows have no price level,
 * because OpenStreetMap publishes none, and treating "did not say" as
 * "expensive" would hide most of the product from anybody on a budget.
 */
export function scorePriceLevel(
  level: number | null,
  sensitivity: Profile["priceSensitivity"],
  /** True when today's remaining budget is nearly gone, whatever the profile says. */
  broke = false,
): number {
  if (level === null) return 0.5;

  const cheapness = 1 - (Math.max(1, Math.min(4, level)) - 1) / 3;

  /* How far the price band is allowed to move the score. A student who said
     "cheapest possible" is dominated by it; one happy to splurge is nudged.
     Being nearly out of money today overrides the standing preference, because
     it is a fact about tonight rather than a taste. */
  const weight = broke
    ? 1
    : { cheapest: 1, value: 0.8, balanced: 0.6, "occasional-splurge": 0.4 }[sensitivity];

  return Math.max(0, Math.min(1, 0.5 + (cheapness - 0.5) * weight));
}

/**
 * How much the community backs this.
 *
 * Friends count for more than campus, and campus for more than raw
 * confirmations — "three of your friends saved this" is a far stronger signal
 * than "confirmed by 40 strangers", and the product should rank like that.
 */
export function scoreCommunityFit(input: {
  id: string;
  confirmations: number;
  savedByCampus?: ReadonlySet<string>;
  savedByFriends?: ReadonlySet<string>;
}): number {
  const friend = input.savedByFriends?.has(input.id) ? 0.45 : 0;
  const campus = input.savedByCampus?.has(input.id) ? 0.25 : 0;
  /* Confirmations saturate: the difference between 10 and 200 is not 20x. */
  const confirmed = Math.min(0.3, Math.log10(1 + input.confirmations) * 0.15);
  return Math.min(1, friend + campus + confirmed);
}

/**
 * Freshness. Anything confirmed in the last fortnight is fully fresh; the
 * score halves roughly every three weeks after that.
 *
 * This is what stops the feed slowly filling with places that were great in
 * 2024 and closed in 2025 — a row nobody has confirmed for six months should
 * lose to one confirmed on Tuesday.
 */
export function scoreFreshness(observedAt: string | null, now: Date): number {
  if (!observedAt) return 0.4;
  const days = (now.getTime() - Date.parse(observedAt)) / 86_400_000;
  if (days <= 14) return 1;
  return Math.max(0.1, Math.pow(0.5, (days - 14) / 21));
}

/* -------------------------------------------------------------------------- */
/* Places                                                                      */
/* -------------------------------------------------------------------------- */

/** Diet tags that rule a place out entirely rather than ranking it down. */
const DIET_CONFLICTS: Record<string, readonly string[]> = {
  vegetarian: ["steakhouse", "meat"],
  vegan: ["steakhouse", "meat", "cheese"],
  halal: ["pork", "steakhouse"],
  kosher: ["pork", "shellfish"],
  "gluten-free": ["bakery-only"],
};

function passesDiet(place: Place, diets: readonly string[]): boolean {
  if (diets.length === 0 || diets.includes("no-preference")) return true;
  const category = place.category.toLowerCase();
  return !diets.some((diet) =>
    (DIET_CONFLICTS[diet] ?? []).some((conflict) => category.includes(conflict)),
  );
}

/**
 * Score and rank places.
 *
 * Returns everything that passed the hard filters, scored and sorted. Callers
 * slice — the Home feed takes four, Explore takes the lot.
 */
export function recommendPlaces(
  places: readonly Place[],
  context: RecommendContext,
): Scored<Place>[] {
  const { profile, memory, budgetCents, now } = context;
  const disliked = new Set(memory?.dislikedPlaceIds ?? []);

  /* Someone who walks and takes transit will travel further than the stated
     walking limit; someone who only walks will not. The tolerance is stated in
     minutes and the measurement is in metres, so it is converted once, here,
     and the converted figure is never rendered. */
  const reachMinutes = profile.transport.some((mode) => mode !== "walk")
    ? profile.maxTravelMinutes * 1.6
    : profile.maxTravelMinutes;
  const reachMetres = Math.max(400, reachMinutes * WALK_METRES_PER_MINUTE);

  const candidates = places.filter(
    (place) =>
      place.citySlug === profile.citySlug &&
      !disliked.has(place.id) &&
      place.proximity.metres <= reachMetres &&
      passesDiet(place, profile.diets),
  );

  return candidates
    .map((place) => {
      const components: Record<ScoreComponent, number> = {
        /* Budget fit is the provider's price band rather than a euro figure,
           because no provider gives us a euro figure. `budgetCents` still
           matters: a student with almost nothing left today is pushed harder
           towards the cheap end than their standing preference would. */
        budgetFit: scorePriceLevel(
          place.priceLevel,
          profile.priceSensitivity,
          budgetCents !== null && budgetCents < 1_500,
        ),
        /* The student's interests, translated into rails first. Comparing the
           two vocabularies directly matched three of twenty-three interests,
           so for almost every place this returned its no-opinion constant and
           the interests step of onboarding did nothing. */
        interestFit: scoreInterestFit(
          place.layers,
          layersForInterests(profile.interests),
          memory,
        ),
        distanceFit: scoreProximityFit(place.proximity.metres, reachMetres),
        studentValue: scoreValueBand(place.value.band),
        communityFit: scoreCommunityFit({
          id: place.id,
          confirmations: place.confirmations,
          savedByCampus: context.communitySignals?.savedByCampus,
          savedByFriends: context.communitySignals?.savedByFriends,
        }),
        quality: scoreValueBand(place.value.band),
        /* When the row was retrieved, which is a real date on every place now
           rather than the null the seeded rows used to pass. */
        freshness: scoreFreshness(place.fetchedAt, now),
      };

      return {
        item: place,
        match: toMatch(components),
        components,
        reasons: placeReasons(place, components, context),
      };
    })
    .sort((a, b) => b.match - a.match);
}

/** Weighted sum, rounded to a whole percentage. */
function toMatch(components: Record<ScoreComponent, number>): number {
  const total = (Object.keys(weights) as ScoreComponent[]).reduce(
    (sum, key) => sum + components[key] * weights[key],
    0,
  );
  return Math.round(Math.max(0, Math.min(1, total)) * 100);
}

/**
 * The "why" lines.
 *
 * Every one restates a fact already on the row — a walk time, a price, a
 * confirmation count. None of them is generated, and none makes a claim the
 * data does not support. This is what keeps "Why: 8-minute walk, within your
 * budget, students from your campus like it" honest rather than flattering.
 */
function placeReasons(
  place: Place,
  components: Record<ScoreComponent, number>,
  context: RecommendContext,
): string[] {
  const reasons: string[] = [];

  /* Distance in the words the card uses. A routed proximity says minutes; a
     measured one says metres. Never one dressed as the other. */
  if (place.proximity.metres <= 900) reasons.push(describeProximity(place.proximity));

  if (place.priceLevel !== null && place.priceLevel <= 1) reasons.push("Cheap for the category");

  /* Through the same translation the score uses, so the sentence and the
     number can never disagree about whether an interest matched. */
  const wanted = layersForInterests(context.profile.interests);
  const matched = place.layers.filter((layer) => wanted.includes(layer));
  if (matched.length === 1) reasons.push(`Matches ${matched[0].replace(/-/g, " ")}`);
  else if (matched.length > 1) reasons.push(`Matches ${matched.length} of your interests`);

  if (context.communitySignals?.savedByFriends.has(place.id)) reasons.push("Friends saved this");
  else if (context.communitySignals?.savedByCampus.has(place.id))
    reasons.push("Students from your campus go here");
  else if (place.confirmations >= 10) reasons.push(`Confirmed by ${place.confirmations} students`);

  /* The band's own reasons, each already traceable to one signal. Added only
     when nothing above found anything to say, so they never duplicate. */
  if (reasons.length === 0) reasons.push(...place.value.reasons);

  return reasons.slice(0, 4);
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

export function recommendEvents(
  events: readonly CityEvent[],
  context: RecommendContext & { walkMinutesFor: (event: CityEvent) => number | null },
): Scored<CityEvent>[] {
  const { profile, memory, budgetCents, now } = context;

  const candidates = events.filter((event) => {
    if (event.citySlug !== profile.citySlug) return false;
    /* Already started and more than an hour in: not actionable. */
    if (Date.parse(event.startsAt) < now.getTime() - 3_600_000) return false;
    return true;
  });

  return candidates
    .map((event) => {
      const walkMinutes = context.walkMinutesFor(event);

      const components: Record<ScoreComponent, number> = {
        budgetFit: scoreBudgetFit(event.priceCents, budgetCents, profile.priceSensitivity),
        interestFit: scoreInterestFit([event.kind, ...event.tags], profile.interests, memory),
        /* No home point: the distance is unknown, so it neither helps nor hurts. */
        distanceFit:
          walkMinutes === null ? 0.6 : scoreDistanceFit(walkMinutes, profile.maxTravelMinutes * 1.6),
        /* Free is unambiguously good value. A paid event is an unknown, and an
           unknown scores neutral rather than well — the old code passed a
           hardcoded 70 here, which quietly ranked every paid event as if
           somebody had assessed it. */
        studentValue: event.priceCents === 0 ? 1 : scoreValueBand("insufficient"),
        communityFit: scoreCommunityFit({
          id: event.id,
          confirmations: event.confirmations,
          savedByCampus: context.communitySignals?.savedByCampus,
          savedByFriends: context.communitySignals?.savedByFriends,
        }),
        quality: Math.min(1, Math.log10(1 + event.interested) / 2.5),
        freshness: scoreFreshness(event.observedAt, now),
      };

      /* Campus events for the student's own campus get a deliberate lift: they
         are the highest-conversion social opportunity a new student has. */
      if (event.campusSlug && event.campusSlug === profile.campusSlug) {
        components.communityFit = Math.min(1, components.communityFit + 0.35);
      }

      return {
        item: event,
        match: toMatch(components),
        components,
        reasons: eventReasons(event, walkMinutes, context),
        walkMinutes,
      };
    })
    .sort((a, b) => b.match - a.match);
}

function eventReasons(
  event: CityEvent,
  walkMinutes: number | null,
  context: RecommendContext,
): string[] {
  const reasons: string[] = [];

  if (event.priceCents === 0) reasons.push("Free");
  if (walkMinutes !== null && walkMinutes <= 20) reasons.push(`${walkMinutes} min walk`);

  const matched = [event.kind, ...event.tags].filter((tag) =>
    context.profile.interests.includes(tag),
  );
  if (matched.length > 0) {
    reasons.push(
      matched.length === 1
        ? `Matches ${matched[0].replace(/-/g, " ")}`
        : `Matches ${matched.length} of your interests`,
    );
  }

  if (event.campusSlug && event.campusSlug === context.profile.campusSlug) {
    reasons.push("On your campus");
  }
  if (event.interested >= 20) reasons.push(`${event.interested} students interested`);

  return reasons.slice(0, 4);
}

/* -------------------------------------------------------------------------- */
/* Diversification                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Cap how many results share a key, preserving order otherwise.
 *
 * Without this the top of the feed is whatever category the student's
 * interests weight highest — eight cafés, and a product that looks like it
 * only knows one thing about the city. Two per category is enough to show a
 * choice and few enough to leave room for the rest.
 */
export function diversify<T>(
  scored: readonly Scored<T>[],
  keyOf: (item: T) => string,
  perKey = 2,
): Scored<T>[] {
  const seen = new Map<string, number>();
  const picked: Scored<T>[] = [];
  const overflow: Scored<T>[] = [];

  for (const entry of scored) {
    const key = keyOf(entry.item);
    const count = seen.get(key) ?? 0;
    if (count < perKey) {
      seen.set(key, count + 1);
      picked.push(entry);
    } else {
      overflow.push(entry);
    }
  }

  /* Overflow is appended rather than dropped, so a caller asking for forty
     results still gets forty — just with the variety at the top. */
  return [...picked, ...overflow];
}

/* -------------------------------------------------------------------------- */
/* Event views                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The radar's views. Pure, so the tab logic is unit-testable: `arrangeEvents`
 * takes already-scored rows plus the social context and returns the order the
 * screen prints. Horizon filtering (tonight / week / weekend) happens upstream
 * in the query because it needs the request clock; price and social filters
 * are re-applied here so a view is self-describing regardless of the caller.
 */
export type EventTab =
  | "for-you"
  | "tonight"
  | "free"
  | "under-10"
  | "week"
  | "weekend"
  | "campus"
  | "trending"
  | "social"
  | "new";

export const eventTabs: readonly { value: EventTab; label: string }[] = [
  { value: "for-you", label: "For you" },
  { value: "tonight", label: "Tonight" },
  { value: "free", label: "Free" },
  { value: "under-10", label: "Under 10" },
  { value: "week", label: "This week" },
  { value: "weekend", label: "Weekend" },
  { value: "campus", label: "Campus" },
  { value: "trending", label: "Trending" },
  { value: "social", label: "Social" },
  { value: "new", label: "New" },
];

/** The "Under 10" ceiling, in cents. One number, so the tab and the query agree. */
export const UNDER_TEN_CENTS: Cents = 1000;

export const eventKindFilters: readonly { value: string; label: string }[] = [
  { value: "music", label: "Music" },
  { value: "nightlife", label: "Nightlife" },
  { value: "sports", label: "Sports" },
  { value: "networking", label: "Networking" },
  { value: "university", label: "University" },
  { value: "food", label: "Food" },
  { value: "culture", label: "Culture" },
  { value: "outdoor", label: "Outdoor" },
  { value: "tech", label: "Technology" },
  { value: "travel", label: "Travel" },
];

/**
 * Every social fact the rows support about one event, and nothing else: how
 * many are interested, how many from your campus, which friends, and how many
 * are looking for company via Anyone Down?. Never where anyone is.
 */
export type EventEnergy = {
  interested: number;
  going: number;
  fromCampus: number;
  friends: { userId: string; displayName: string; avatarEmoji: string; status: "interested" | "going" }[];
  lookingForCompany: number;
  mine: "interested" | "going" | null;
  /** Responses in the last three days. The velocity behind "Trending". */
  recent: number;
};

/** Total interest including live responses, for the card's social line. */
export function totalInterest(event: CityEvent, energy: EventEnergy | undefined): number {
  return event.interested + (energy ? energy.interested + energy.going : 0);
}

/**
 * Interest per day since the row was last checked, plus a strong bump for
 * responses in the last three days and for people looking for company. A row
 * with 40 interested that was confirmed yesterday is trending; the same 40 on
 * a row nobody has touched in a month is not.
 */
export function interestVelocity(
  event: CityEvent,
  energy: EventEnergy | undefined,
  now: Date,
): number {
  const days = (now.getTime() - Date.parse(event.observedAt)) / 86_400_000;
  const age = Math.min(30, Math.max(1, Number.isFinite(days) ? days : 30));
  return (
    totalInterest(event, energy) / age +
    (energy?.recent ?? 0) * 5 +
    (energy?.lookingForCompany ?? 0) * 3
  );
}

const SOCIAL_KINDS = new Set(["social", "networking", "nightlife", "food"]);
const SOCIAL_TAGS = new Set(["social", "language-exchange", "meet-friends", "networking"]);

/**
 * "Social" means there is a reason to go with people: a social kind or tag, an
 * open Anyone Down? group attached to it, a friend interested, or someone who
 * said they are going.
 */
export function isSocialEvent(
  event: CityEvent,
  energy: EventEnergy | undefined,
  anchored: ReadonlySet<string>,
): boolean {
  return (
    SOCIAL_KINDS.has(event.kind) ||
    event.tags.some((tag) => SOCIAL_TAGS.has(tag)) ||
    anchored.has(event.id) ||
    (energy?.friends.length ?? 0) > 0 ||
    (energy?.lookingForCompany ?? 0) > 0 ||
    (energy?.going ?? 0) > 0
  );
}

/** Re-order (and, where the view is a filter, narrow) scored events for a tab. */
export function arrangeEvents(
  events: readonly Scored<CityEvent>[],
  tab: EventTab,
  energy: ReadonlyMap<string, EventEnergy>,
  invites: readonly Pick<Invite, "anchorId">[],
  now: Date,
): Scored<CityEvent>[] {
  const list = [...events];

  if (tab === "free") {
    /* `=== 0`, not `<= 0` and not a nullish default. An event whose source
       published no price is not free; it is unknown, and a "Free" tab that
       includes it is the false claim in tab form. */
    return list.filter((entry) => entry.item.priceCents === 0);
  }

  if (tab === "under-10") {
    /* Same argument: an unpriced event has not been shown to be under ten, so
       it does not belong in a tab that says it is. Unknown sorts last. */
    return list
      .filter((entry) => entry.item.priceCents !== null && entry.item.priceCents <= UNDER_TEN_CENTS)
      .sort(
        (a, b) =>
          (a.item.priceCents ?? Number.POSITIVE_INFINITY) -
            (b.item.priceCents ?? Number.POSITIVE_INFINITY) || b.match - a.match,
      );
  }

  if (tab === "trending") {
    return list.sort(
      (a, b) =>
        interestVelocity(b.item, energy.get(b.item.id), now) -
        interestVelocity(a.item, energy.get(a.item.id), now),
    );
  }

  if (tab === "new") {
    const week = now.getTime() - 7 * 86_400_000;
    return list
      .filter((entry) => Date.parse(entry.item.observedAt) >= week)
      .sort((a, b) => b.item.observedAt.localeCompare(a.item.observedAt));
  }

  if (tab === "social") {
    const anchored = new Set(
      invites.map((invite) => invite.anchorId).filter((id): id is string => id !== null),
    );
    return list
      .filter((entry) => isSocialEvent(entry.item, energy.get(entry.item.id), anchored))
      .sort((a, b) => {
        const ea = energy.get(a.item.id);
        const eb = energy.get(b.item.id);
        return (
          (eb?.friends.length ?? 0) - (ea?.friends.length ?? 0) ||
          (eb?.lookingForCompany ?? 0) - (ea?.lookingForCompany ?? 0) ||
          b.match - a.match
        );
      });
  }

  if (tab === "tonight" || tab === "week" || tab === "weekend") {
    return list.sort((a, b) => a.item.startsAt.localeCompare(b.item.startsAt));
  }

  return list;
}
