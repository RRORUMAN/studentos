import "server-only";

import type { PlaceCategory, RealPlace } from "@/domain/places";
import { env } from "@/services/env";

import {
  ProviderRefused,
  type PlaceProvider,
  type PlaceProviderResult,
  type PlaceQuery,
} from "@/server/places/types";

/**
 * ============================================================================
 * GOOGLE PLACES (NEW)
 * ----------------------------------------------------------------------------
 * The optional provider. It knows two things OpenStreetMap does not — ratings
 * and a price level — and it costs money per request, which is why it is not
 * the default and why the cache in front of it is stricter.
 *
 * CACHING AND THE TERMS. Google's terms allow a place ID to be stored
 * indefinitely and other content to be cached for up to thirty days. This
 * adapter is used through a cache with a ONE DAY entry lifetime (see
 * `cache.ts`), which is comfortably inside that and also the right answer for
 * data quality: an opening time cached for a month is wrong for most of it.
 * Nothing here is written into a table that outlives the cache.
 *
 * NOT CONFIGURED IS A FIRST-CLASS STATE. With no key this provider reports
 * exactly which variable is missing and refuses to run. It never returns an
 * empty list, because an empty list is indistinguishable from "there is
 * nothing there" and would quietly become the product's answer.
 * ============================================================================
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
const TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/**
 * The fields asked for, which is also the billing tier. Everything here is
 * rendered somewhere; asking for a field the interface does not show is paying
 * for nothing.
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryType",
  "places.types",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.businessStatus",
].join(",");

/**
 * StudentOS categories to Google place types.
 *
 * Google's taxonomy is finer than ours in some places and coarser in others.
 * Where it has no type at all — a study space is not a Google concept — the
 * entry is empty and `supports` returns false, so the service falls through to
 * a provider that can answer rather than returning Google's nearest guess.
 */
const GOOGLE_TYPES: Record<PlaceCategory, readonly string[]> = {
  supermarket: ["supermarket"],
  grocery: ["grocery_store", "butcher_shop", "bakery"],
  convenience: ["convenience_store"],
  market: ["market"],
  restaurant: ["restaurant"],
  "cheap-eat": ["fast_food_restaurant"],
  cafe: ["cafe", "coffee_shop"],
  bar: ["bar", "pub"],
  nightclub: ["night_club"],
  pharmacy: ["pharmacy"],
  clinic: ["doctor", "medical_lab"],
  gym: ["gym", "fitness_center"],
  pool: ["swimming_pool"],
  library: ["library"],
  "study-space": [],
  coworking: [],
  laundry: ["laundry"],
  bank: ["bank"],
  atm: ["atm"],
  post: ["post_office"],
  bookshop: ["book_store"],
  "phone-shop": ["cell_phone_store"],
  park: ["park"],
  cinema: ["movie_theater"],
  museum: ["museum"],
  bicycle: ["bicycle_store"],
};

const CATEGORY_BY_TYPE = new Map<string, PlaceCategory>();
for (const [category, types] of Object.entries(GOOGLE_TYPES) as [PlaceCategory, string[]][]) {
  for (const type of types) if (!CATEGORY_BY_TYPE.has(type)) CATEGORY_BY_TYPE.set(type, category);
}

/** Google's enum to its 1-4 scale. Anything unrecognised stays null. */
const PRICE_LEVEL: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryType?: string;
  types?: string[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  businessStatus?: string;
};

export function parseGooglePlaces(
  rows: readonly GooglePlace[],
  fallback: PlaceCategory,
  fetchedAt: string,
  attribution: string,
): RealPlace[] {
  const places: RealPlace[] = [];

  for (const row of rows) {
    const name = row.displayName?.text?.trim();
    const lat = row.location?.latitude;
    const lng = row.location?.longitude;
    if (!row.id || !name || typeof lat !== "number" || typeof lng !== "number") continue;

    /* A permanently closed place is worse than no place: it is a walk to a
       shuttered door. Google says so, so we drop it. */
    if (row.businessStatus && row.businessStatus !== "OPERATIONAL") continue;

    const types = row.types ?? [];
    const category: PlaceCategory =
      (row.primaryType ? CATEGORY_BY_TYPE.get(row.primaryType) : undefined) ??
      types.reduce<PlaceCategory | undefined>(
        (held, type) => held ?? CATEGORY_BY_TYPE.get(type),
        undefined,
      ) ??
      fallback;

    places.push({
      id: `google:${row.id}`,
      provider: "google",
      providerPlaceId: row.id,
      name,
      category,
      subcategories: types
        .filter((type) => type !== row.primaryType)
        .slice(0, 4)
        .map((type) => type.replace(/_/g, " ")),
      address: row.formattedAddress ?? null,
      lat,
      lng,
      /* Google does not publish a chain field on this endpoint. Rather than
         infer one from the name, it stays null. */
      brand: null,
      website: row.websiteUri ?? null,
      phone: row.nationalPhoneNumber ?? null,
      /* Google's weekday descriptions are prose, not the OSM grammar, so they
         are kept verbatim and the open-state parser will decline to read them
         — which is correct: it would otherwise parse "Monday: 9:00 AM – 9:00
         PM" with a rule written for "Mo 09:00-21:00" and be wrong by hours. */
      openingHours: row.regularOpeningHours?.weekdayDescriptions?.join("; ") ?? null,
      rating: typeof row.rating === "number" ? row.rating : null,
      ratingCount: typeof row.userRatingCount === "number" ? row.userRatingCount : null,
      priceLevel: row.priceLevel ? (PRICE_LEVEL[row.priceLevel] ?? null) : null,
      sourceUrl: `https://www.google.com/maps/place/?q=place_id:${row.id}`,
      fetchedAt,
      attribution,
      /* Google verifies businesses and holds a review count; a place with real
         reviews behind it is the strongest confidence signal available here. */
      confidence: (row.userRatingCount ?? 0) >= 20 ? "verified" : "recent",
    });
  }

  return places;
}

export function googlePlacesProvider(): PlaceProvider {
  const key = env.places.googleKey;

  return {
    id: "google",
    label: "Google Places",
    attribution: "Places data © Google",

    status: () =>
      key
        ? { configured: true, detail: "Places API (New), searchNearby + searchText" }
        : {
            configured: false,
            missing:
              "Not configured — set GOOGLE_PLACES_API_KEY and enable the Places API (New) on that key.",
          },

    supports: (category) => Boolean(key) && GOOGLE_TYPES[category].length > 0,

    async search(query, signal): Promise<PlaceProviderResult> {
      if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set");

      const started = Date.now();
      const types = [...new Set(query.categories.flatMap((category) => GOOGLE_TYPES[category]))];
      const useText = Boolean(query.text) && types.length === 0;

      const response = await fetch(useText ? TEXT_ENDPOINT : ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
          "x-goog-fieldmask": FIELD_MASK,
        },
        body: JSON.stringify(
          useText
            ? {
                textQuery: query.text,
                maxResultCount: Math.min(query.limit, 20),
                locationBias: {
                  circle: {
                    center: { latitude: query.centre.lat, longitude: query.centre.lng },
                    radius: Math.min(query.radiusMetres, 50_000),
                  },
                },
              }
            : {
                includedTypes: types,
                maxResultCount: Math.min(query.limit, 20),
                locationRestriction: {
                  circle: {
                    center: { latitude: query.centre.lat, longitude: query.centre.lng },
                    radius: Math.min(query.radiusMetres, 50_000),
                  },
                },
              },
        ),
        signal,
        cache: "no-store",
      });

      if (response.status === 429 || response.status === 403) {
        /* Google's error body says whether this is a quota, a disabled API or
           a referrer restriction, and those three need three different fixes.
           Carrying it through is what makes the admin screen actionable. */
        const detail = await response.text();
        throw new ProviderRefused("google", response.status, detail.slice(0, 300));
      }
      if (!response.ok) {
        throw new Error(
          `Google Places returned ${response.status}: ${(await response.text()).slice(0, 300)}`,
        );
      }

      const payload = (await response.json()) as { places?: GooglePlace[] };
      const places = parseGooglePlaces(
        payload.places ?? [],
        query.categories[0] ?? "restaurant",
        new Date().toISOString(),
        "Places data © Google",
      );

      return { places, endpoint: useText ? "searchText" : "searchNearby", tookMs: Date.now() - started };
    },
  };
}
