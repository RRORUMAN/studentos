import "server-only";

import { cache } from "react";

import { places as seededPlaces } from "@/data/places";
import type { Place } from "@/data/types";
import { dealConfidence, type Confidence } from "@/domain/knowledge";
import type { Cents, CityEvent, Deal, Profile, SavedKind } from "@/domain/types";
import { ensureFreshSeedData, findMany } from "@/server/db";
import {
  recommendEvents,
  recommendPlaces,
  type RecommendContext,
  type Scored,
} from "@/server/engines/recommend";
import { readHomePoint } from "@/server/viewer";

/**
 * ============================================================================
 * DISCOVERY QUERIES
 * ----------------------------------------------------------------------------
 * Retrieval for places, events and deals, and the community signals the scorer
 * needs.
 *
 * Everything here is Tier 0: no model is called anywhere in this file or in the
 * engine it feeds. That is the architectural bet the whole cost model rests on
 * — the Home feed, Explore, the events list and the free-tonight block are all
 * array work over rows we already hold, so a thousand students opening the app
 * costs nothing but CPU.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Walking distance                                                            */
/* -------------------------------------------------------------------------- */

/** Average city walking speed, metres per minute. */
const WALK_SPEED_M_PER_MIN = 78;

function walkMinutesBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const metres = 2 * R * Math.asin(Math.sqrt(a));
  return Math.max(1, Math.round(metres / WALK_SPEED_M_PER_MIN));
}

/* -------------------------------------------------------------------------- */
/* Community signals                                                           */
/* -------------------------------------------------------------------------- */

/**
 * What this student's campus and friends have saved.
 *
 * These sets are the difference between "a place near you" and "where students
 * from your campus actually go", which is the recommendation this product
 * exists to make. Computed once per request and passed into the scorer.
 */
export const loadCommunitySignals = cache(
  async (userId: string, campusSlug: string | null) => {
    const [friendships, allSaved] = await Promise.all([
      findMany(
        "friendships",
        (row) =>
          row.status === "accepted" && (row.requesterId === userId || row.addresseeId === userId),
      ),
      findMany("saved", (row) => row.userId !== userId),
    ]);

    const friendIds = new Set(
      friendships.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId)),
    );

    const savedByFriends = new Set<string>();
    const savedByCampus = new Set<string>();

    /* Campus membership is resolved from profiles rather than stored on the
       saved row, so a student changing campus immediately changes what counts
       as a campus signal. */
    const campusProfiles = campusSlug
      ? await findMany("profiles", (row) => row.campusSlug === campusSlug)
      : [];
    const campusIds = new Set(campusProfiles.map((row) => row.userId));

    for (const item of allSaved) {
      if (friendIds.has(item.userId)) savedByFriends.add(item.targetId);
      else if (campusIds.has(item.userId)) savedByCampus.add(item.targetId);
    }

    return { savedByFriends, savedByCampus, friendIds };
  },
);

/**
 * What the viewer has saved, as `kind:targetId` keys, so a card can render a
 * filled bookmark without a query per row.
 */
export const loadSavedKeys = cache(async (userId: string): Promise<Set<string>> => {
  const rows = await findMany("saved", (row) => row.userId === userId);
  return new Set(rows.map((row) => savedKey(row.kind, row.targetId)));
});

export function savedKey(kind: SavedKind, targetId: string): string {
  return `${kind}:${targetId}`;
}

/* -------------------------------------------------------------------------- */
/* Context                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Assemble the scoring context for a student.
 *
 * `budgetCents` is what they can spend *today*, not their monthly budget — the
 * whole point of the budget integration is that a €40 dinner stops being
 * recommended on the day there is €12 left.
 */
export const loadRecommendContext = cache(
  async (input: {
    userId: string;
    profile: Profile;
    budgetCents: Cents | null;
    now?: Date;
  }): Promise<RecommendContext> => {
    const [memory, signals] = await Promise.all([
      findMany("memories", (row) => row.userId === input.userId).then((rows) => rows[0] ?? null),
      loadCommunitySignals(input.userId, input.profile.campusSlug),
    ]);

    return {
      profile: input.profile,
      memory,
      budgetCents: input.budgetCents,
      now: input.now ?? new Date(),
      communitySignals: {
        savedByCampus: signals.savedByCampus,
        savedByFriends: signals.savedByFriends,
      },
    };
  },
);

/* -------------------------------------------------------------------------- */
/* Places                                                                      */
/* -------------------------------------------------------------------------- */

export type PlaceFilter = {
  layers?: readonly string[];
  maxPriceCents?: Cents | null;
  freeOnly?: boolean;
  verifiedOnly?: boolean;
  maxWalkMinutes?: number;
  query?: string;
  /** An extra predicate for views the named filters cannot express. */
  test?: (place: Place) => boolean;
};

/** Score and rank the places in a student's city. */
export async function loadPlaces(
  context: RecommendContext,
  filter: PlaceFilter = {},
): Promise<Scored<Place>[]> {
  let candidates = seededPlaces.filter((place) => place.citySlug === context.profile.citySlug);

  if (filter.layers?.length) {
    candidates = candidates.filter((place) =>
      place.layers.some((layer) => filter.layers?.includes(layer)),
    );
  }
  if (filter.freeOnly) candidates = candidates.filter((place) => place.price === 0);
  if (filter.maxPriceCents != null) {
    const cap = filter.maxPriceCents;
    candidates = candidates.filter((place) => place.price !== null && place.price * 100 <= cap);
  }
  if (filter.verifiedOnly) candidates = candidates.filter((place) => place.verifiedBy >= 10);
  if (filter.maxWalkMinutes) {
    candidates = candidates.filter((place) => place.walkMinutes <= filter.maxWalkMinutes!);
  }
  if (filter.query) {
    const needle = filter.query.toLowerCase();
    candidates = candidates.filter(
      (place) =>
        place.name.toLowerCase().includes(needle) ||
        place.category.toLowerCase().includes(needle) ||
        place.why.toLowerCase().includes(needle),
    );
  }
  if (filter.test) candidates = candidates.filter(filter.test);

  return recommendPlaces(candidates, context);
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

export type EventFilter = {
  when?: "tonight" | "week" | "weekend" | "all";
  freeOnly?: boolean;
  maxPriceCents?: Cents | null;
  kinds?: readonly string[];
  campusOnly?: boolean;
  /** Ten independent confirmations, the same bar a place is held to. */
  verifiedOnly?: boolean;
  query?: string;
  /** An extra predicate for views the named filters cannot express. */
  test?: (event: CityEvent) => boolean;
};

export const loadCityEvents = cache(async (citySlug: string): Promise<CityEvent[]> => {
  await ensureFreshSeedData();
  const events = await findMany("events", (row) => row.citySlug === citySlug);
  return events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
});

/**
 * Filter events by horizon.
 *
 * "Tonight" runs to 04:00 rather than midnight, because a student asking what
 * is on tonight at 23:00 does not mean "in the next hour" — and a list that
 * empties at midnight is the kind of literal-minded correctness that makes a
 * product feel like it was built by someone who does not go out.
 */
export function filterEventsByWhen(
  events: readonly CityEvent[],
  when: EventFilter["when"],
  now = new Date(),
): CityEvent[] {
  if (!when || when === "all") return [...events];

  const start = now.getTime();

  if (when === "tonight") {
    const end = new Date(now);
    end.setHours(28, 0, 0, 0); // 04:00 tomorrow
    return events.filter((event) => {
      const at = Date.parse(event.startsAt);
      return at >= start - 3_600_000 && at <= end.getTime();
    });
  }

  if (when === "week") {
    return events.filter((event) => {
      const at = Date.parse(event.startsAt);
      return at >= start - 3_600_000 && at <= start + 7 * 86_400_000;
    });
  }

  /* Weekend: Friday 16:00 through Sunday end, of the coming weekend. */
  const day = now.getDay();
  const daysToFriday = (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setDate(friday.getDate() + daysToFriday);
  friday.setHours(16, 0, 0, 0);
  const sunday = new Date(friday);
  sunday.setDate(sunday.getDate() + 2);
  sunday.setHours(23, 59, 59, 999);

  return events.filter((event) => {
    const at = Date.parse(event.startsAt);
    return at >= friday.getTime() && at <= sunday.getTime();
  });
}

/**
 * Score events for a student, with walking time from their home area.
 *
 * When no home point is set the walk is `null` on every result, and the card
 * omits it. It is never defaulted: a fabricated "15 min" is precisely the kind
 * of plausible wrongness this product refuses to print.
 */
export async function loadScoredEvents(
  userId: string,
  context: RecommendContext,
  filter: EventFilter = {},
): Promise<Scored<CityEvent>[]> {
  let events = await loadCityEvents(context.profile.citySlug);

  events = filterEventsByWhen(events, filter.when, context.now);
  if (filter.freeOnly) events = events.filter((event) => event.priceCents === 0);
  if (filter.maxPriceCents != null) {
    events = events.filter((event) => event.priceCents <= filter.maxPriceCents!);
  }
  if (filter.kinds?.length) {
    events = events.filter(
      (event) => filter.kinds?.includes(event.kind) || event.tags.some((tag) => filter.kinds?.includes(tag)),
    );
  }
  if (filter.campusOnly && context.profile.campusSlug) {
    events = events.filter((event) => event.campusSlug === context.profile.campusSlug);
  }
  if (filter.verifiedOnly) events = events.filter((event) => event.confirmations >= 10);
  if (filter.query) {
    const needle = filter.query.toLowerCase();
    events = events.filter(
      (event) =>
        event.title.toLowerCase().includes(needle) ||
        event.venue.toLowerCase().includes(needle) ||
        event.blurb.toLowerCase().includes(needle) ||
        event.kind.includes(needle) ||
        event.tags.some((tag) => tag.includes(needle)),
    );
  }
  if (filter.test) events = events.filter(filter.test);

  /* The precise home point is read here and immediately reduced to a number of
     minutes. It never leaves this function. */
  const home = await readHomePoint(userId);

  return recommendEvents(events, {
    ...context,
    walkMinutesFor: (event) => (home ? walkMinutesBetween(home, event.point) : null),
  });
}

/* -------------------------------------------------------------------------- */
/* Deals                                                                       */
/* -------------------------------------------------------------------------- */

export type DealWithConfidence = Deal & {
  confidence: Confidence;
  workedCount: number;
  lastConfirmedAt: string | null;
};

/**
 * Deals with a computed confidence reading.
 *
 * The badge is never taken from the `verifiedAt` column — it is derived from
 * the reports every time, with recent failures outweighing old successes. A
 * stored flag would say "verified" for months after a discount quietly ended.
 */
export const loadDeals = cache(async (citySlug: string): Promise<DealWithConfidence[]> => {
  const [deals, reports] = await Promise.all([
    findMany("deals", (row) => row.citySlug === citySlug),
    findMany("dealReports", () => true),
  ]);

  const byDeal = new Map<string, typeof reports>();
  for (const report of reports) {
    const list = byDeal.get(report.dealId) ?? [];
    list.push(report);
    byDeal.set(report.dealId, list);
  }

  return deals
    .map((deal) => ({ ...deal, ...dealConfidence(byDeal.get(deal.id) ?? []) }))
    .sort((a, b) => {
      const rank = { verified: 0, likely: 1, unconfirmed: 2, disputed: 3, expired: 4 };
      return rank[a.confidence] - rank[b.confidence];
    });
});

/**
 * Live deals keyed by the place they belong to, so a place card can carry a
 * deal badge without a lookup per row. Expired and disputed deals are left out:
 * a badge for a discount that ended is worse than no badge.
 */
export function dealsByPlace(deals: readonly DealWithConfidence[]): Map<string, DealWithConfidence> {
  const out = new Map<string, DealWithConfidence>();
  for (const deal of deals) {
    if (!deal.placeId) continue;
    if (deal.confidence === "expired" || deal.confidence === "disputed") continue;
    if (!out.has(deal.placeId)) out.set(deal.placeId, deal);
  }
  return out;
}
