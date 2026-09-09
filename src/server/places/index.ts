import "server-only";

import {
  type Coords,
  type PlaceCategory,
  type RankedPlace,
  type RealPlace,
  type ValueSignals,
  dedupePlaces,
  rankPlaces,
  straightLine,
  studentValue,
} from "@/domain/places";
import { captureError } from "@/services/monitoring";

import { cacheKey, readCache, readStale, writeCache } from "@/server/places/cache";
import { googlePlacesProvider } from "@/server/places/google";
import { overpassProvider } from "@/server/places/osm";
import type { PlaceProvider, PlaceQuery } from "@/server/places/types";

/**
 * ============================================================================
 * THE PLACE SERVICE
 * ----------------------------------------------------------------------------
 * One function the rest of the product calls, and the only place that knows
 * there is more than one provider.
 *
 * ---------------------------------------------------------------------------
 * THE CHAIN
 *
 *   cache (fresh)  ->  Google, if configured  ->  OpenStreetMap  ->  cache
 *                                                                    (stale,
 *                                                                     dated)
 *                                                                 ->  say so
 *
 * Google goes first when it is configured because it holds ratings and a price
 * level, which change the answer to "which of these is worth walking to".
 * OpenStreetMap answers everywhere and needs nothing, so it is the floor
 * rather than the ceiling. If both fail, a dated stale entry is better than an
 * error; if there is no stale entry either, the caller gets `ok: false` with
 * the real reason and the interface says the map is unavailable.
 *
 * WHAT IT NEVER DOES is return an empty list to mean "we could not ask".
 * "There are no pharmacies near you" and "we could not reach the map" look the
 * same on a screen and mean opposite things, and only one of them is ever
 * true. That distinction is the whole reason this returns a discriminated
 * union instead of an array.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Registry                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Providers in priority order.
 *
 * Built per call rather than at module load so that a key added to the
 * environment takes effect on the next request instead of the next deploy, and
 * so tests can drive the chain without a module cache to defeat.
 */
export function placeProviders(): readonly PlaceProvider[] {
  return [googlePlacesProvider(), overpassProvider()];
}

export function configuredPlaceProviders(): readonly PlaceProvider[] {
  return placeProviders().filter((provider) => provider.status().configured);
}

/* -------------------------------------------------------------------------- */
/* Result                                                                      */
/* -------------------------------------------------------------------------- */

export type PlaceSearchInput = {
  centre: Coords;
  radiusMetres?: number;
  categories: readonly PlaceCategory[];
  limit?: number;
  text?: string;
  /** Where the student is, when that differs from the search centre. */
  from?: Coords;
  /** Real StudentOS signals per provider place id. Never invented. */
  signals?: ReadonlyMap<string, Partial<ValueSignals>>;
};

export type PlaceSearchOutcome =
  | {
      ok: true;
      places: readonly RankedPlace[];
      /** Provider that answered, for the source line. */
      provider: string;
      /** Licence line the interface must render. */
      attribution: string;
      fetchedAt: string;
      /** True when every provider failed and this came from an old entry. */
      stale: boolean;
    }
  | {
      ok: false;
      /** Rendered to the student, in their words, by the caller. */
      reason: "not-configured" | "unavailable";
      message: string;
      attempts: readonly { provider: string; error: string }[];
    };

const DEFAULT_RADIUS_M = 1_500;
const DEFAULT_LIMIT = 24;
/**
 * The whole budget for one provider, failover included.
 *
 * Generous, because the alternative to waiting is telling a student we could
 * not find a supermarket. Each adapter enforces a shorter per-endpoint
 * deadline inside this, and the cache means a warm search never gets near it.
 */
const PROVIDER_TIMEOUT_MS = 25_000;

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

export async function searchPlaces(
  input: PlaceSearchInput,
  now: Date = new Date(),
): Promise<PlaceSearchOutcome> {
  const query: PlaceQuery = {
    centre: input.centre,
    radiusMetres: input.radiusMetres ?? DEFAULT_RADIUS_M,
    categories: input.categories,
    limit: input.limit ?? DEFAULT_LIMIT,
    text: input.text,
  };

  const origin = input.from ?? input.centre;
  const attempts: { provider: string; error: string }[] = [];
  const usable = placeProviders().filter((provider) => {
    const status = provider.status();
    if (!status.configured) {
      attempts.push({ provider: provider.label, error: status.missing });
      return false;
    }
    /* A provider that cannot answer any of the requested categories is not a
       failure and is not recorded as one — it is simply not asked. */
    return query.categories.some((category) => provider.supports(category));
  });

  if (usable.length === 0) {
    return {
      ok: false,
      reason: "not-configured",
      message: "No place provider is available for this search.",
      attempts,
    };
  }

  let lastKey: string | null = null;

  for (const provider of usable) {
    const supported = query.categories.filter((category) => provider.supports(category));
    const key = cacheKey({
      provider: provider.id,
      centre: query.centre,
      radiusMetres: query.radiusMetres,
      categories: supported,
      text: query.text,
    });
    lastKey = key;

    const cached = await readCache(key, now);
    if (cached) {
      return rank(cached.places, origin, input.signals, {
        provider: provider.label,
        attribution: provider.attribution,
        fetchedAt: cached.fetchedAt,
        stale: false,
        limit: query.limit,
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const result = await provider.search({ ...query, categories: supported }, controller.signal);
      const places = dedupePlaces([result.places]);
      await writeCache(
        key,
        {
          provider: provider.id,
          centre: query.centre,
          radiusMetres: query.radiusMetres,
          categories: supported,
          places,
        },
        now,
      );
      return rank(places, origin, input.signals, {
        provider: provider.label,
        attribution: provider.attribution,
        fetchedAt: now.toISOString(),
        stale: false,
        limit: query.limit,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({ provider: provider.label, error: message });
      /* Recorded, not swallowed. A provider failing every request for a week
         is the single most useful thing the health screen can show, and it
         only exists if the failure leaves the process. */
      captureError(error, { scope: "places", provider: provider.id });
    } finally {
      clearTimeout(timer);
    }
  }

  /* Everything failed. A dated stale entry beats an error page, and the
     interface is required to print the date beside it. */
  if (lastKey) {
    const stale = await readStale(lastKey, now);
    if (stale) {
      const provider = usable[usable.length - 1];
      return rank(stale.places, origin, input.signals, {
        provider: provider?.label ?? "cache",
        attribution: provider?.attribution ?? "",
        fetchedAt: stale.fetchedAt,
        stale: true,
        limit: query.limit,
      });
    }
  }

  return {
    ok: false,
    reason: "unavailable",
    message: "Couldn't reach the map right now.",
    attempts,
  };
}

/* -------------------------------------------------------------------------- */
/* Ranking                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Attach distance and student value, then order.
 *
 * `signals` carries real StudentOS rows — saves, confirmations, verified deals
 * — keyed by provider place id. Anything absent from that map contributes
 * nothing rather than a default, which is why `studentValue` can report
 * "not enough student data" honestly for a city on its first day.
 */
function rank(
  places: readonly RealPlace[],
  origin: Coords,
  signals: ReadonlyMap<string, Partial<ValueSignals>> | undefined,
  meta: {
    provider: string;
    attribution: string;
    fetchedAt: string;
    stale: boolean;
    limit: number;
  },
): PlaceSearchOutcome {
  const ranked: RankedPlace[] = places.map((place) => {
    const proximity = straightLine(origin, place);
    const held = signals?.get(place.id) ?? signals?.get(place.providerPlaceId);
    return {
      place,
      proximity,
      value: studentValue({
        metres: proximity.metres,
        priceLevel: place.priceLevel,
        rating: place.rating,
        ratingCount: place.ratingCount,
        saves: held?.saves ?? 0,
        confirmations: held?.confirmations ?? 0,
        hasVerifiedDeal: held?.hasVerifiedDeal ?? false,
      }),
    };
  });

  return {
    ok: true,
    places: rankPlaces(ranked).slice(0, meta.limit),
    provider: meta.provider,
    attribution: meta.attribution,
    fetchedAt: meta.fetchedAt,
    stale: meta.stale,
  };
}

export { placeProviders as providersForHealth };
