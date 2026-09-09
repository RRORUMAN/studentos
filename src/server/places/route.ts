import "server-only";

import { type Coords, type Proximity, straightLine } from "@/domain/places";
import { env } from "@/services/env";
import { captureError } from "@/services/monitoring";

/**
 * ============================================================================
 * ROUTING
 * ----------------------------------------------------------------------------
 * The file that exists to stop one specific lie.
 *
 * StudentOS used to print "9 min walk" next to every place. That number came
 * from a haversine distance divided by 78 metres a minute. It crossed rivers,
 * ignored the M-30, walked through the Palacio Real and was confidently wrong
 * in every city with a hill in it. It also looked exactly like a real routing
 * answer, which is what made it worth removing rather than tuning.
 *
 * So: a duration is only ever produced by something that routed. With no
 * routing provider configured, `proximityBetween` returns a straight line, the
 * `Proximity` says `kind: "straight-line"`, and `describeProximity` prints
 * "600 m away". That is a true statement made by a product that does not have
 * a router, and it is worth more than a plausible number.
 *
 * ---------------------------------------------------------------------------
 * PROVIDERS
 *
 *   OSRM        Anything speaking the OSRM HTTP API, set as ROUTING_OSRM_URL.
 *               Self-hostable, open source, and the reason this is not a
 *               vendor decision. The public demo server at
 *               router.project-osrm.org is deliberately NOT a default: its
 *               usage policy is development only, and a product that ships
 *               pointing at it is taking something it was not offered.
 *
 *   Google      Routes API, on the same key as Places. Adds transit, which
 *               OSRM does not do.
 *
 * Both are optional. Neither is required for the product to work.
 * ============================================================================
 */

export type TravelMode = "walking" | "cycling" | "transit";

export type RouteProviderConfiguration =
  | { configured: true; detail: string }
  | { configured: false; missing: string };

export interface RouteProvider {
  readonly id: string;
  readonly label: string;
  status(): RouteProviderConfiguration;
  supports(mode: TravelMode): boolean;
  /** Metres and seconds along the actual network, or null if it cannot say. */
  route(from: Coords, to: Coords, mode: TravelMode, signal: AbortSignal): Promise<Proximity | null>;
}

const TIMEOUT_MS = 6_000;

const KIND: Record<TravelMode, Proximity["kind"]> = {
  walking: "walking-route",
  cycling: "cycling-route",
  transit: "transit-route",
};

/* -------------------------------------------------------------------------- */
/* OSRM                                                                        */
/* -------------------------------------------------------------------------- */

const OSRM_PROFILE: Record<TravelMode, string | null> = {
  walking: "foot",
  cycling: "bike",
  /* OSRM does not do public transport. Saying so is better than routing a
     transit question as a walk and handing back a two-hour number. */
  transit: null,
};

export function osrmProvider(): RouteProvider {
  const base = env.routing.osrmUrl;

  return {
    id: "osrm",
    label: "OSRM",
    status: () =>
      base
        ? { configured: true, detail: base }
        : {
            configured: false,
            missing:
              "Not configured — set ROUTING_OSRM_URL to an OSRM instance. Distances are shown instead of walking times until then.",
          },
    supports: (mode) => Boolean(base) && OSRM_PROFILE[mode] !== null,

    async route(from, to, mode, signal) {
      const profile = OSRM_PROFILE[mode];
      if (!base || !profile) return null;

      const url = `${base.replace(/\/$/, "")}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false`;
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`OSRM returned ${response.status}`);

      const body = (await response.json()) as {
        code?: string;
        routes?: { distance?: number; duration?: number }[];
      };
      if (body.code !== "Ok") return null;

      const best = body.routes?.[0];
      if (typeof best?.distance !== "number" || typeof best?.duration !== "number") return null;

      return {
        kind: KIND[mode],
        metres: Math.round(best.distance),
        minutes: Math.max(1, Math.round(best.duration / 60)),
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Google Routes                                                               */
/* -------------------------------------------------------------------------- */

const GOOGLE_MODE: Record<TravelMode, string> = {
  walking: "WALK",
  cycling: "BICYCLE",
  transit: "TRANSIT",
};

export function googleRoutesProvider(): RouteProvider {
  const key = env.places.googleKey;

  return {
    id: "google-routes",
    label: "Google Routes",
    status: () =>
      key
        ? { configured: true, detail: "Routes API on the Places key" }
        : {
            configured: false,
            missing:
              "Not configured — set GOOGLE_PLACES_API_KEY and enable the Routes API on that key.",
          },
    supports: () => Boolean(key),

    async route(from, to, mode, signal) {
      if (!key) return null;

      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
          "x-goog-fieldmask": "routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
          destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
          travelMode: GOOGLE_MODE[mode],
        }),
        signal,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Google Routes returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
        );
      }

      const body = (await response.json()) as {
        routes?: { distanceMeters?: number; duration?: string }[];
      };
      const best = body.routes?.[0];
      if (typeof best?.distanceMeters !== "number" || !best.duration) return null;

      /* Google returns a protobuf Duration as "834s". */
      const seconds = Number(best.duration.replace(/s$/, ""));
      if (!Number.isFinite(seconds)) return null;

      return {
        kind: KIND[mode],
        metres: best.distanceMeters,
        minutes: Math.max(1, Math.round(seconds / 60)),
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* The service                                                                 */
/* -------------------------------------------------------------------------- */

export function routeProviders(): readonly RouteProvider[] {
  return [osrmProvider(), googleRoutesProvider()];
}

/**
 * How far apart two points are, routed if anything can route and measured if
 * not.
 *
 * Never throws and never leaves the caller without an answer: a routing
 * failure degrades to the straight line, which is always available and always
 * labelled as what it is. The caller renders `describeProximity` and gets
 * either "12 min walk" or "900 m away" without having to know which providers
 * a deployment has.
 */
export async function proximityBetween(
  from: Coords,
  to: Coords,
  mode: TravelMode = "walking",
): Promise<Proximity> {
  for (const provider of routeProviders()) {
    if (!provider.status().configured || !provider.supports(mode)) continue;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const routed = await provider.route(from, to, mode, controller.signal);
      if (routed) return routed;
    } catch (error) {
      captureError(error, { scope: "routing", provider: provider.id });
    } finally {
      clearTimeout(timer);
    }
  }

  return straightLine(from, to);
}

/**
 * Whether any provider can turn a distance into a duration.
 *
 * Surfaces call this to decide between a "walking time" column and a
 * "distance" one, rather than rendering an empty slot per row.
 */
export function routingConfigured(mode: TravelMode = "walking"): boolean {
  return routeProviders().some(
    (provider) => provider.status().configured && provider.supports(mode),
  );
}
