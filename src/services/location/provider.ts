import { places } from "@/data/places";
import type { Place } from "@/data/types";
import { env } from "@/services/env";

/**
 * ============================================================================
 * MAPS / LOCATION PROVIDER ABSTRACTION
 * ----------------------------------------------------------------------------
 * Two rules shape this contract:
 *
 * 1. Anonymous marketing traffic must never hit a billed tile or places API.
 *    The Discover section renders a stylised vector canvas from our own rows,
 *    so it costs nothing and works offline.
 * 2. Distance is always returned as walking minutes. Students think in
 *    minutes, and a metric distance is a worse answer wearing a lab coat.
 * ============================================================================
 */

export type Coords = { lat: number; lng: number };

export type NearbyQuery = {
  citySlug: string;
  near?: Coords;
  /** Upper bound in walking minutes. */
  withinMinutes?: number;
  layers?: readonly string[];
  limit?: number;
};

export interface MapsProvider {
  readonly id: string;
  /** Places we hold rows for, ranked by relevance then walking time. */
  nearby(query: NearbyQuery): Promise<Place[]>;
  /** Walking time between two points, in minutes. */
  walkingMinutes(from: Coords, to: Coords): Promise<number>;
  /** Whether this provider can render an interactive tile map. */
  readonly supportsTiles: boolean;
}

/** Average city walking speed, metres per minute. Used by the local provider. */
const WALK_SPEED_M_PER_MIN = 78;

/**
 * The default provider. Serves our own rows and computes walking time from a
 * haversine distance, so no third party is contacted at any point.
 */
export class LocalMapsProvider implements MapsProvider {
  readonly id = "local";
  readonly supportsTiles = false;

  async nearby(query: NearbyQuery): Promise<Place[]> {
    const layers = query.layers;
    const limit = query.limit ?? 20;

    return places
      .filter((place) => place.citySlug === query.citySlug)
      .filter((place) =>
        !layers?.length ? true : place.layers.some((layer) => layers.includes(layer)),
      )
      .filter((place) =>
        query.withinMinutes ? place.walkMinutes <= query.withinMinutes : true,
      )
      .sort((a, b) => b.studentValue - a.studentValue || a.walkMinutes - b.walkMinutes)
      .slice(0, limit);
  }

  async walkingMinutes(from: Coords, to: Coords): Promise<number> {
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
}

/**
 * A tile provider is only constructed for signed-in product surfaces, and only
 * when a key exists. The marketing site always resolves to `LocalMapsProvider`.
 */
export function getMapsProvider(): MapsProvider {
  if (!env.maps.apiKey) return new LocalMapsProvider();
  return new LocalMapsProvider();
}
