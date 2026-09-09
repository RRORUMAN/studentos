import "server-only";

import type { PlaceCacheRow, PlaceProviderId, RealPlace } from "@/domain/places";
import { findOne, nowIso, remove, upsert } from "@/server/db";

/**
 * ============================================================================
 * THE PLACE CACHE
 * ----------------------------------------------------------------------------
 * What stands between a student typing "supermarket" and a bill.
 *
 * Every provider below it is either a volunteer-run service that asks for
 * moderation (Overpass) or a metered one that charges per call (Google). A
 * product with a map and no cache sends a request per pan, per filter change
 * and per keystroke, and does it once per user. This is the file that stops
 * that, and it is why the provider adapters are allowed to be simple.
 *
 * ---------------------------------------------------------------------------
 * THE KEY IS A GRID CELL, NOT A POINT
 *
 * Two students standing forty metres apart must hit the same entry or the
 * cache never warms. So the centre is snapped to a grid whose square is about
 * a hundred and fifty metres, and the radius is snapped to a step. The cost is
 * that a search is answered from a point up to ~100 m from where you actually
 * are, which is well inside the accuracy of the coordinate a browser gives and
 * far inside the radius anybody searches.
 *
 * ---------------------------------------------------------------------------
 * LIFETIME IS THE PROVIDER'S TERMS, NOT OUR CONVENIENCE
 *
 * OpenStreetMap is ODbL and may be held as long as it is useful; a week is
 * chosen because that is roughly how fast a mapped shop changes. Google's
 * terms cap cached content at thirty days and this uses one, which is inside
 * the terms and also better data — an opening time a month old is wrong more
 * often than it is right.
 *
 * A stale entry is kept rather than deleted. When every provider is down,
 * `readStale` is what lets the interface show yesterday's supermarkets with a
 * date on them instead of an error, which is the honest degraded answer.
 * ============================================================================
 */

/** ~150 m at the equator, and less as you go north, which is fine: it only has
    to be smaller than the smallest radius anybody searches. */
const GRID_DEGREES = 0.0015;

/** Radii are snapped up to one of these, so a slider cannot create 400 keys. */
const RADIUS_STEPS = [400, 800, 1_500, 3_000, 5_000] as const;

export const CACHE_TTL_MS: Record<PlaceProviderId, number> = {
  /* ODbL. A week is about how fast a mapped shop changes. */
  osm: 7 * 24 * 60 * 60 * 1_000,
  /* Google's terms allow thirty days; one is inside them and fresher. */
  google: 24 * 60 * 60 * 1_000,
  /* Student-written rows are ours and are read live, never cached. */
  students: 0,
};

/**
 * How long a stale entry may still be shown when every provider is failing.
 * Beyond this the answer is "we could not reach the map", because a fortnight
 * old opening time is not a degraded answer, it is a wrong one.
 */
export const STALE_GRACE_MS = 14 * 24 * 60 * 60 * 1_000;

const snap = (value: number) => Math.round(value / GRID_DEGREES) * GRID_DEGREES;

export function snapRadius(metres: number): number {
  return RADIUS_STEPS.find((step) => metres <= step) ?? RADIUS_STEPS[RADIUS_STEPS.length - 1];
}

/**
 * The cache key.
 *
 * Categories are sorted so that {gym, cafe} and {cafe, gym} are one entry, and
 * free text is included because a text search is a different question with the
 * same coordinates.
 */
export function cacheKey(input: {
  provider: PlaceProviderId;
  centre: { lat: number; lng: number };
  radiusMetres: number;
  categories: readonly string[];
  text?: string;
}): string {
  const lat = snap(input.centre.lat).toFixed(4);
  const lng = snap(input.centre.lng).toFixed(4);
  const radius = snapRadius(input.radiusMetres);
  const categories = [...input.categories].sort().join(",");
  const text = input.text?.trim().toLowerCase() ?? "";
  return `${input.provider}|${lat}|${lng}|${radius}|${categories}|${text}`;
}

export type CacheHit = {
  places: readonly RealPlace[];
  fetchedAt: string;
  /** True when the entry is past its TTL and is being shown anyway. */
  stale: boolean;
};

/** A fresh entry, or null. Never returns something past its expiry. */
export async function readCache(key: string, now: Date): Promise<CacheHit | null> {
  const row = await findOne("placeCache", (candidate) => candidate.id === key);
  if (!row) return null;
  if (Date.parse(row.expiresAt) <= now.getTime()) return null;
  return { places: row.places, fetchedAt: row.fetchedAt, stale: false };
}

/**
 * An expired entry, if it is not too old to be worth showing.
 *
 * Only called once every provider has failed. The caller must render the date,
 * because "here are some supermarkets" and "here are the supermarkets we saw
 * on Tuesday" are different claims.
 */
export async function readStale(key: string, now: Date): Promise<CacheHit | null> {
  const row = await findOne("placeCache", (candidate) => candidate.id === key);
  if (!row) return null;
  if (now.getTime() - Date.parse(row.fetchedAt) > STALE_GRACE_MS) return null;
  return { places: row.places, fetchedAt: row.fetchedAt, stale: true };
}

export async function writeCache(
  key: string,
  input: {
    provider: PlaceProviderId;
    centre: { lat: number; lng: number };
    radiusMetres: number;
    categories: readonly string[];
    places: readonly RealPlace[];
  },
  now: Date,
): Promise<void> {
  const ttl = CACHE_TTL_MS[input.provider];
  if (ttl <= 0) return;

  await upsert(
    "placeCache",
    (candidate) => candidate.id === key,
    {
      id: key,
      provider: input.provider,
      centreLat: snap(input.centre.lat),
      centreLng: snap(input.centre.lng),
      radiusMetres: snapRadius(input.radiusMetres),
      categories: [...input.categories].sort(),
      places: [...input.places],
      fetchedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
    },
  );
}

/**
 * Drop entries nothing will read again.
 *
 * Run from the cron in `src/server/cron.ts`. Without it the JSON store grows
 * without bound in development and the row store accumulates rows nobody pays
 * attention to; neither is a crisis, and both are the kind of thing that is
 * only ever fixed if it is written at the same time as the cache.
 */
export async function pruneCache(now: Date): Promise<number> {
  const cutoff = now.getTime() - STALE_GRACE_MS;
  return remove("placeCache", (row) => Date.parse(row.fetchedAt) < cutoff);
}

export type { PlaceCacheRow };
export { nowIso };
