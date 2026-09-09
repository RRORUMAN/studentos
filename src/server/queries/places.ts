import "server-only";

import { cache } from "react";

import { resolveCity } from "@/data/cities";
import type { Place } from "@/data/types";
import {
  type Coords,
  type PlaceCategory,
  type PlaceLayer,
  type RealPlace,
  layersFor,
  placeCategories,
  placeCategoryMeta,
  straightLine,
  studentValue,
} from "@/domain/places";
import { findMany } from "@/server/db";
import { lookupPlaces, searchPlaces, type PlaceSearchOutcome } from "@/server/places";
import { proximityBetween, routingConfigured } from "@/server/places/route";

/**
 * ============================================================================
 * PLACE QUERIES
 * ----------------------------------------------------------------------------
 * Where a provider's rows meet StudentOS's own.
 *
 * The provider knows what is there. It does not know that eleven students from
 * your campus saved it, that somebody confirmed the student menu on Tuesday,
 * or that there is a verified deal. Those live in our tables, keyed by the
 * provider place id, and this file is the join.
 *
 * IT IS ALSO THE HONESTY BOUNDARY. Every signal attached here is counted from
 * rows. `confirmations: 0` means nobody has confirmed anything, and the card
 * renders nothing rather than a number — which is the whole difference between
 * this and the twenty-five places that used to ship with `verifiedBy: 41`.
 *
 * A city with no students yet therefore produces real places with no social
 * layer, and `studentValue` answers "not enough student data". That is the
 * correct first-day state for a city and the product is built to show it.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Signals                                                                     */
/* -------------------------------------------------------------------------- */

export type PlaceSignals = {
  saves: Map<string, number>;
  confirmations: Map<string, number>;
  dealsAt: Set<string>;
  savedByFriends: Set<string>;
  savedByCampus: Set<string>;
};

/**
 * Every StudentOS signal about places in one city, in one pass.
 *
 * Loaded once per request through React's `cache`, because Explore, the map
 * and the Today feed all want the same three tables and a query per surface is
 * how a page ends up making forty of them.
 */
export const loadPlaceSignals = cache(async (citySlug: string): Promise<PlaceSignals> => {
  const [saved, confirmations, deals] = await Promise.all([
    findMany("saved", (row) => row.kind === "place"),
    findMany("confirmations", (row) => row.targetKind === "place"),
    findMany(
      "deals",
      (row) => row.citySlug === citySlug && row.placeId !== null && row.verifiedAt !== null,
    ),
  ]);

  const count = (rows: readonly { targetId: string }[]) => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.targetId, (map.get(row.targetId) ?? 0) + 1);
    return map;
  };

  return {
    saves: count(saved),
    confirmations: count(confirmations),
    dealsAt: new Set(deals.map((row) => row.placeId as string)),
    savedByFriends: new Set(),
    savedByCampus: new Set(),
  };
});

/* -------------------------------------------------------------------------- */
/* Assembly                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A provider row plus our own, as the interface needs it.
 *
 * Exported because the AI tools and the map assemble places from lookups
 * rather than searches and must produce exactly the same shape — a second
 * place-shaped object with slightly different rules is how two surfaces end up
 * disagreeing about whether somewhere is verified.
 */
export function toPlace(
  real: RealPlace,
  citySlug: string,
  signals: PlaceSignals,
  origin: Coords,
): Place {
  const saves = signals.saves.get(real.id) ?? 0;
  const confirmations = signals.confirmations.get(real.id) ?? 0;
  const hasVerifiedDeal = signals.dealsAt.has(real.id);
  const proximity = straightLine(origin, real);

  return {
    id: real.id,
    citySlug,
    name: real.name,
    category: placeCategoryMeta(real.category).label,
    categoryKey: real.category,
    layers: layersFor(real.category, { priceLevel: real.priceLevel, hasVerifiedDeal }),
    priceLevel: real.priceLevel,
    proximity,
    value: studentValue({
      metres: proximity.metres,
      priceLevel: real.priceLevel,
      rating: real.rating,
      ratingCount: real.ratingCount,
      saves,
      confirmations,
      hasVerifiedDeal,
    }),
    confirmations,
    saves,
    lat: real.lat,
    lng: real.lng,
    address: real.address,
    brand: real.brand,
    website: real.website,
    phone: real.phone,
    openingHours: real.openingHours,
    rating: real.rating,
    ratingCount: real.ratingCount,
    provider: real.provider,
    sourceUrl: real.sourceUrl,
    attribution: real.attribution,
    confidence: real.confidence,
    fetchedAt: real.fetchedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

export type CityPlacesInput = {
  citySlug: string;
  /** Layers the student picked. Empty means everything the city can answer. */
  layers?: readonly PlaceLayer[];
  categories?: readonly PlaceCategory[];
  /** Where the student is. Falls back to the city centre. */
  near?: Coords | null;
  radiusMetres?: number;
  limit?: number;
  text?: string;
};

export type CityPlacesResult =
  | { ok: true; places: Place[]; provider: string; attribution: string; fetchedAt: string; stale: boolean }
  | { ok: false; reason: "not-configured" | "unavailable" | "no-city"; message: string };

/** Every category that can serve a layer, so a filter chip maps to a query. */
function categoriesForLayers(layers: readonly PlaceLayer[]): PlaceCategory[] {
  if (!layers.length) return [];
  const wanted = new Set<PlaceCategory>();
  for (const meta of placeCategories) {
    /* Ask `layersFor` rather than restating the mapping. Both branches of the
       price-dependent rule are requested, because a restaurant's price level
       is not known until the provider answers — the filter is applied again
       after the rows arrive. */
    const cheap = layersFor(meta.key, { priceLevel: 1, hasVerifiedDeal: true });
    if (cheap.some((layer) => layers.includes(layer))) wanted.add(meta.key);
  }
  return [...wanted];
}

/**
 * Places in a city, ranked, with our signals attached.
 *
 * Returns a result rather than an array so that a caller can tell an empty
 * neighbourhood from an unreachable provider. Every surface that renders
 * places handles all three states; there is no code path that turns a failure
 * into "nothing found".
 */
export async function loadCityPlaces(input: CityPlacesInput): Promise<CityPlacesResult> {
  const city = resolveCity(input.citySlug);
  if (!city || city.lat === null || city.lng === null) {
    return {
      ok: false,
      reason: "no-city",
      message: "We don't have a location for this city yet.",
    };
  }

  const categories = input.categories?.length
    ? [...input.categories]
    : categoriesForLayers(input.layers ?? []);

  /* No layer and no category means "show me the city": the everyday things a
     student actually looks for, rather than every tag in the database. */
  const searchFor: PlaceCategory[] = categories.length
    ? categories
    : ["supermarket", "cheap-eat", "cafe", "pharmacy", "library", "gym"];

  const origin = input.near ?? { lat: city.lat, lng: city.lng };
  const signals = await loadPlaceSignals(input.citySlug);

  const outcome = await searchPlaces({
    centre: origin,
    radiusMetres: input.radiusMetres ?? 1_800,
    categories: searchFor,
    limit: input.limit ?? 40,
    text: input.text,
    from: origin,
    signals: signalsFor(signals),
  });

  return fromOutcome(outcome, input, city.slug, signals, origin);
}

function fromOutcome(
  outcome: PlaceSearchOutcome,
  input: CityPlacesInput,
  citySlug: string,
  signals: PlaceSignals,
  origin: Coords,
): CityPlacesResult {
  if (!outcome.ok) {
    return { ok: false, reason: outcome.reason, message: outcome.message };
  }

  let places = outcome.places.map(({ place }) => toPlace(place, citySlug, signals, origin));

  /* The layer filter runs again here because the price-dependent rules can
     only be evaluated once the provider has answered. */
  const layers = input.layers ?? [];
  if (layers.length) {
    places = places.filter((place) => place.layers.some((layer) => layers.includes(layer)));
  }

  if (input.text) {
    const needle = input.text.toLowerCase();
    places = places.filter(
      (place) =>
        place.name.toLowerCase().includes(needle) ||
        place.category.toLowerCase().includes(needle) ||
        (place.brand?.toLowerCase().includes(needle) ?? false),
    );
  }

  return {
    ok: true,
    places,
    provider: outcome.provider,
    attribution: outcome.attribution,
    fetchedAt: outcome.fetchedAt,
    stale: outcome.stale,
  };
}

function signalsFor(signals: PlaceSignals) {
  const map = new Map<string, { saves: number; confirmations: number; hasVerifiedDeal: boolean }>();
  const ids = new Set([
    ...signals.saves.keys(),
    ...signals.confirmations.keys(),
    ...signals.dealsAt,
  ]);
  for (const id of ids) {
    map.set(id, {
      saves: signals.saves.get(id) ?? 0,
      confirmations: signals.confirmations.get(id) ?? 0,
      hasVerifiedDeal: signals.dealsAt.has(id),
    });
  }
  return map;
}

/* -------------------------------------------------------------------------- */
/* Lookup                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Resolve saved, planned and mentioned places back into rows.
 *
 * A saved place is a provider id in our table and nothing else, which is the
 * correct thing to store: we do not hold a copy of somebody else's database,
 * and a name cached a year ago is a name that has since changed. So Saved
 * re-reads them.
 *
 * It searches rather than fetching each id, because the cache is keyed by area
 * and a student's saved places are nearly always in their own city — one
 * search usually resolves all of them for free. Anything the search does not
 * cover comes back missing, and the caller shows the id it holds with a note
 * rather than an invented name.
 */
export async function loadPlacesByIds(
  ids: readonly string[],
  citySlug: string,
  near?: Coords | null,
): Promise<{ places: Map<string, Place>; missing: string[] }> {
  if (ids.length === 0) return { places: new Map(), missing: [] };

  const city = resolveCity(citySlug);
  const origin =
    near ?? (city?.lat != null && city.lng != null ? { lat: city.lat, lng: city.lng } : null);
  if (!origin) return { places: new Map(), missing: [...ids] };

  const [signals, resolved] = await Promise.all([
    loadPlaceSignals(citySlug),
    lookupPlaces(ids),
  ]);

  const places = new Map<string, Place>();
  for (const real of resolved.places) {
    places.set(real.id, toPlace(real, citySlug, signals, origin));
  }

  return { places, missing: resolved.missing };
}

/* -------------------------------------------------------------------------- */
/* Routing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Attach a routed proximity to the few places a surface is about to show in
 * detail.
 *
 * Deliberately not applied to a list. Routing is one request per place, and a
 * feed of forty would be forty requests to answer a question the student has
 * not asked yet. A distance is enough to choose between two shops; a duration
 * matters once you have chosen.
 */
export async function withRoutedProximity(places: readonly Place[], from: Coords): Promise<Place[]> {
  if (!routingConfigured()) return [...places];

  return Promise.all(
    places.map(async (place) => ({
      ...place,
      proximity: await proximityBetween(from, { lat: place.lat, lng: place.lng }),
    })),
  );
}

/* -------------------------------------------------------------------------- */
/* Existence                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Does this place exist?
 *
 * Asked before a student saves somewhere, attaches it to a message, anchors an
 * Anyone Down on it or puts it on a plan. It used to be answered by looking the
 * id up in a twenty-five-row array, which made it a check that the id was one
 * of ours rather than a check that the place is real.
 *
 * It is now a lookup against the provider, so the answer means what it says.
 * That costs one request, which is the right trade for an action a student
 * takes deliberately and rarely — and a provider outage returns FALSE, so a
 * save is refused rather than silently storing a reference to something that
 * may not exist.
 */
export const placeExists = cache(async (id: string): Promise<boolean> => {
  if (!id.includes(":")) return false;
  const { places } = await lookupPlaces([id]);
  return places.length > 0;
});

/** One place, resolved through the provider. Null when it no longer exists. */
export async function loadPlace(id: string, citySlug: string): Promise<Place | null> {
  const { places } = await loadPlacesByIds([id], citySlug);
  return places.get(id) ?? null;
}
