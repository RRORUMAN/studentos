import "server-only";

import type { Coords, PlaceCategory, PlaceProviderId, RealPlace } from "@/domain/places";

/**
 * ============================================================================
 * PLACE PROVIDERS — THE CONTRACT
 * ----------------------------------------------------------------------------
 * The seam between StudentOS and every source of real-world places.
 *
 * It is modelled on `src/server/work/providers.ts` and inherits its rules,
 * because the failure modes are the same:
 *
 *   A provider MAY NOT INVENT A FIELD. A source that does not publish a rating
 *   produces `rating: null`. There are no defaults in any adapter below this
 *   line, and the normalised type in `src/domain/places.ts` makes every
 *   optional field nullable so that "did not say" has somewhere to live.
 *
 *   A PROVIDER SAYS WHAT IT NEEDS. `status()` returns either configured with a
 *   detail, or unconfigured with the exact variable that would configure it.
 *   The admin screen renders that string verbatim, because "Not configured —
 *   set GOOGLE_PLACES_API_KEY" is actionable and a greyed-out row is not.
 *
 *   A PROVIDER THROWS. Transport failures, bad shapes and rate limits are
 *   raised, not swallowed. The service above decides whether to fall through
 *   to the next provider, and it records the real error either way. An adapter
 *   that returns an empty array on a 500 turns an outage into "there are no
 *   supermarkets in Madrid", which is the worst available answer.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO SCRAPER, AGAIN
 *
 * The same rule as job feeds. Every adapter here talks to a documented API on
 * terms its publisher set. OpenStreetMap says yes through the Overpass API and
 * the ODbL; Google says yes through the Places API and its terms. A site with
 * neither has not agreed to anything, and the absence of an adapter for it is
 * the correct amount of code.
 * ============================================================================
 */

export type PlaceProviderConfiguration =
  | { configured: true; detail: string }
  | { configured: false; missing: string };

/**
 * What a caller asks for.
 *
 * Either a radius around a point or an explicit viewport, never both. A
 * viewport is what the map sends after a pan; a radius is what "near me"
 * means. Adapters translate; nothing here assumes one is derivable from the
 * other, because a rectangle and a circle round differently at the edges and
 * a place that appears when you pan and vanishes when you zoom looks broken.
 */
export type PlaceQuery = {
  centre: Coords;
  /** Metres. Adapters clamp to their own maximum and say so in the result. */
  radiusMetres: number;
  categories: readonly PlaceCategory[];
  /** Upper bound on rows returned. Adapters may return fewer, never more. */
  limit: number;
  /** Free text, when the student typed something a category cannot express. */
  text?: string;
};

export type PlaceProviderResult = {
  places: readonly RealPlace[];
  /** Which endpoint answered, for the health screen and the error message. */
  endpoint: string;
  /** Milliseconds the provider took. Recorded per run. */
  tookMs: number;
};

export interface PlaceProvider {
  readonly id: PlaceProviderId;
  readonly label: string;
  /**
   * The licence line every row from this provider carries, and which the
   * interface is required to render wherever those rows appear.
   */
  readonly attribution: string;
  status(): PlaceProviderConfiguration;
  /** Categories this provider can answer. Others are dropped before the call. */
  supports(category: PlaceCategory): boolean;
  search(query: PlaceQuery, signal: AbortSignal): Promise<PlaceProviderResult>;
  /**
   * Fetch specific rows by the provider's own identity.
   *
   * This is what makes a saved place a reference rather than a copy. We store
   * `osm:node/26472667` and nothing else; when Saved renders, the row is
   * fetched again, so a shop that closed or moved is not still on the screen
   * a year later because we cached its name.
   */
  lookup(providerPlaceIds: readonly string[], signal: AbortSignal): Promise<readonly RealPlace[]>;
}

/**
 * Raised when a provider is reachable but refused, so the service can tell a
 * rate limit apart from an outage and back off rather than retry.
 *
 * The fields are declared and assigned rather than written as constructor
 * parameter properties: unit tests and the verify scripts run this file
 * through Node's type stripping, which is syntax-only and rejects that shorthand.
 */
export class ProviderRefused extends Error {
  readonly provider: PlaceProviderId;
  readonly status: number;

  constructor(provider: PlaceProviderId, status: number, message: string) {
    super(message);
    this.name = "ProviderRefused";
    this.provider = provider;
    this.status = status;
  }
}

/** Raised when no configured provider could answer. Carries every attempt. */
export class NoProviderAvailable extends Error {
  readonly attempts: readonly { provider: string; error: string }[];

  constructor(attempts: readonly { provider: string; error: string }[]) {
    super(
      attempts.length
        ? `no place provider answered: ${attempts.map((a) => `${a.provider} (${a.error})`).join("; ")}`
        : "no place provider is configured",
    );
    this.name = "NoProviderAvailable";
    this.attempts = attempts;
  }
}
