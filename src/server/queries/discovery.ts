import "server-only";

import { cache } from "react";

import type { Place } from "@/data/types";
import { isCheapPlace, type PlaceCategory, type PlaceLayer } from "@/domain/places";
import { dealConfidence, type Confidence } from "@/domain/knowledge";
import type { Cents, CityEvent, Deal, Profile, SavedKind } from "@/domain/types";
import { ensureFreshSeedData, findMany } from "@/server/db";
import {
  WALK_METRES_PER_MINUTE,
  recommendEvents,
  recommendPlaces,
  type RecommendContext,
  type Scored,
} from "@/server/engines/recommend";
import { loadCityPlaces } from "@/server/queries/places";
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
    const [memory, signals, homePoint] = await Promise.all([
      findMany("memories", (row) => row.userId === input.userId).then((rows) => rows[0] ?? null),
      loadCommunitySignals(input.userId, input.profile.campusSlug),
      readHomePoint(input.userId),
    ]);

    return {
      profile: input.profile,
      memory,
      budgetCents: input.budgetCents,
      homePoint,
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
  layers?: readonly PlaceLayer[];
  categories?: readonly PlaceCategory[];
  /** Only places at the cheap end, by category or by provider price band. */
  cheapOnly?: boolean;
  /** Only places that are free to walk into: parks, public libraries. */
  freeOnly?: boolean;
  /** Ten independent student confirmations, the same bar an event is held to. */
  verifiedOnly?: boolean;
  /** Metres. The student's own tolerance, converted by the caller. */
  maxMetres?: number;
  query?: string;
  /** An extra predicate for views the named filters cannot express. */
  test?: (place: Place) => boolean;
};

/**
 * The result of a place search: rows, or the reason there are none.
 *
 * `unavailable` exists so that no caller can render "nothing nearby" over a
 * provider outage. Every surface that shows places destructures this and
 * handles both, and there is deliberately no helper that flattens it to an
 * array — one would be used, and the distinction would be lost on the first
 * screen somebody was in a hurry on.
 */
export type PlaceResults = {
  places: Scored<Place>[];
  /** Set when no provider answered. The message is written for a student. */
  unavailable: { message: string } | null;
  /** Licence line to render wherever these rows appear. */
  attribution: string | null;
  /** True when these came from a cache entry past its lifetime. */
  stale: boolean;
};

/**
 * Score and rank the real places in a student's city.
 *
 * The filters that used to be applied here — a euro ceiling, a "free" flag
 * meaning price zero — were applied to hand-written prices. What is left are
 * the ones a provider can actually answer: a category, a price band, a
 * distance, and StudentOS's own confirmation count.
 */
export async function loadPlaces(
  context: RecommendContext,
  filter: PlaceFilter = {},
): Promise<PlaceResults> {
  const maxMetres =
    filter.maxMetres ??
    Math.max(400, context.profile.maxTravelMinutes * WALK_METRES_PER_MINUTE * 1.6);

  const result = await loadCityPlaces({
    citySlug: context.profile.citySlug,
    layers: filter.layers,
    categories: filter.categories,
    near: context.homePoint ?? null,
    radiusMetres: Math.min(5_000, Math.round(maxMetres)),
    limit: 60,
    text: filter.query,
  });

  if (!result.ok) {
    return {
      places: [],
      /* A city with no coordinate is a different problem from a provider that
         did not answer, and the student is told which. */
      unavailable: { message: result.message },
      attribution: null,
      stale: false,
    };
  }

  let candidates = result.places;

  if (filter.freeOnly) {
    candidates = candidates.filter((place) => place.layers.includes("free"));
  }
  /* `isCheapPlace` rather than a price level here: OpenStreetMap publishes no
     prices, so testing the price level alone emptied this filter — and Ask's
     "somewhere cheaper" with it — on every deployment without a Google key. */
  if (filter.cheapOnly) {
    candidates = candidates.filter(isCheapPlace);
  }
  if (filter.verifiedOnly) {
    candidates = candidates.filter((place) => place.confirmations >= 10);
  }
  if (filter.test) candidates = candidates.filter(filter.test);

  return {
    places: recommendPlaces(candidates, context),
    unavailable: null,
    attribution: result.attribution,
    stale: result.stale,
  };
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
