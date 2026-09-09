import "server-only";

import {
  type DataConfidence,
  type PlaceCategory,
  type RealPlace,
  placeCategories,
} from "@/domain/places";
import { env } from "@/services/env";

import {
  ProviderRefused,
  type PlaceProvider,
  type PlaceProviderResult,
  type PlaceQuery,
} from "@/server/places/types";

/**
 * ============================================================================
 * OPENSTREETMAP, VIA OVERPASS
 * ----------------------------------------------------------------------------
 * The default place provider, and the reason StudentOS can show real shops on
 * day one in every city it lists.
 *
 * WHY THIS IS THE DEFAULT AND NOT THE FALLBACK. It needs no key, no billing
 * account and no per-city onboarding. A student in Kraków gets the same real
 * supermarkets as a student in Madrid, because the data is already there and
 * the same query works everywhere. The product's alternative — which is what
 * it used to do — was twenty-five invented places in five cities and nothing
 * anywhere else.
 *
 * LICENCE. OpenStreetMap data is ODbL. Two obligations follow and both are
 * discharged in code rather than in a README: every row carries `attribution`,
 * which the interface renders wherever places appear, and every row carries
 * `sourceUrl` pointing at the object on openstreetmap.org so a student, or a
 * mapper, can see and correct what we showed. Results are cached and never
 * republished as a dataset, which keeps this on the "produced work" side of
 * the licence rather than the "derivative database" side.
 *
 * ETIQUETTE. Overpass instances are volunteer-run and the usage policy asks
 * for moderation. So: one query per search rather than one per category, a
 * hard server-side timeout inside the query itself, a User-Agent that says who
 * we are and where to complain, and a cache in front of all of it — see
 * `cache.ts`, which is what actually keeps the request count sane.
 *
 * WHAT IT CANNOT ANSWER. There is no rating, no review count and no price
 * level in OpenStreetMap, so those come back null on every row and the card
 * shows nothing in their place. That is a real limitation and it is visible;
 * configuring Google Places is how a deployment fills it in.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Tag mapping                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * StudentOS categories to OpenStreetMap selectors.
 *
 * Each entry is a list of `key=value` pairs, any of which qualifies. The
 * mapping is one-way and deliberately narrow: `cheap-eat` is `fast_food`
 * because that is the tag for a counter you order at, and no tag anywhere in
 * OSM means "cheap". Nothing here infers a price from a category.
 */
const OSM_TAGS: Record<PlaceCategory, readonly string[]> = {
  supermarket: ["shop=supermarket"],
  grocery: ["shop=greengrocer", "shop=grocery", "shop=butcher", "shop=bakery"],
  convenience: ["shop=convenience"],
  market: ["amenity=marketplace"],
  restaurant: ["amenity=restaurant"],
  "cheap-eat": ["amenity=fast_food"],
  cafe: ["amenity=cafe"],
  bar: ["amenity=bar", "amenity=pub"],
  nightclub: ["amenity=nightclub"],
  pharmacy: ["amenity=pharmacy"],
  clinic: ["amenity=clinic", "amenity=doctors"],
  gym: ["leisure=fitness_centre"],
  pool: ["leisure=swimming_pool", "leisure=sports_centre"],
  library: ["amenity=library"],
  /* OSM has no "study space" tag. Libraries and coworking spaces are the two
     things that are one, and every row returned is a named library or a named
     coworking space, so nothing is claimed that the tag does not support. */
  "study-space": ["amenity=library", "amenity=coworking_space"],
  coworking: ["amenity=coworking_space", "office=coworking"],
  laundry: ["shop=laundry", "shop=dry_cleaning"],
  bank: ["amenity=bank"],
  atm: ["amenity=atm"],
  post: ["amenity=post_office"],
  bookshop: ["shop=books"],
  "phone-shop": ["shop=mobile_phone"],
  park: ["leisure=park"],
  cinema: ["amenity=cinema"],
  museum: ["tourism=museum"],
  bicycle: ["shop=bicycle"],
};

/** Reverse index, so a returned element can say which category it satisfied. */
const CATEGORY_BY_TAG = new Map<string, PlaceCategory>();
for (const meta of placeCategories) {
  for (const tag of OSM_TAGS[meta.key]) {
    /* First category to claim a tag keeps it. `amenity=library` is claimed by
       `library` rather than by `study-space` because that is what the object
       is; a search for study spaces still finds it, it is simply labelled as
       the library it is. */
    if (!CATEGORY_BY_TAG.has(tag)) CATEGORY_BY_TAG.set(tag, meta.key);
  }
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Public Overpass instances, tried in order.
 *
 * The canonical instance is first. It is also the busiest, and it answers a
 * request it cannot serve with a 200 and an HTML page saying so rather than an
 * error status — which is why `parse` checks the content and not just the
 * status code. `OVERPASS_URL` overrides the whole list with a private instance,
 * which is what a deployment doing real volume should run.
 */
const DEFAULT_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

/** Seconds Overpass itself is allowed to spend. Below our own abort. */
const SERVER_TIMEOUT_S = 20;

/**
 * How long ONE endpoint gets before we try the next.
 *
 * This is deliberately shorter than the service's whole budget. The first
 * time this ran with a single budget for the chain, the canonical instance
 * absorbed all twelve seconds and the search failed without the second
 * endpoint ever being asked — a failover that never fires is not a failover.
 */
const ENDPOINT_TIMEOUT_MS = 8_000;

/**
 * The endpoint that answered last, tried first next time.
 *
 * Module-level, so it lives as long as one server instance and is a hint
 * rather than state: a cold instance simply starts at the top of the list
 * again. It exists because the canonical instance is often busy, and paying
 * its timeout on every cold search made a supermarket lookup take ten seconds
 * when the second endpoint would have answered in two.
 */
let lastGood: string | null = null;

const USER_AGENT =
  "StudentOS/1.0 (+https://github.com/RRORUMAN/studentos; places for international students)";

/**
 * The licence line, written once.
 *
 * ODbL requires it wherever the data appears, and it travels on every row as a
 * field rather than being added by whichever component remembered.
 */
const ATTRIBUTION = "© OpenStreetMap contributors";

/* -------------------------------------------------------------------------- */
/* Query                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One Overpass QL query covering every requested category at once.
 *
 * `nwr` is nodes, ways and relations together: a supermarket is a node in one
 * city and a building outline in the next, and asking only for nodes loses
 * half of Germany. `out center` gives the ways and relations a single point,
 * which is what a marker needs.
 *
 * `["name"]` is not an optimisation. An unnamed shop is a dot a student cannot
 * act on, and returning it would pad the list to look fuller — the thing this
 * whole rewrite exists to stop.
 */
export function buildQuery(query: PlaceQuery): string {
  const radius = Math.round(Math.min(query.radiusMetres, 5_000));
  const { lat, lng } = query.centre;

  const selectors = new Set<string>();
  for (const category of query.categories) {
    for (const tag of OSM_TAGS[category] ?? []) selectors.add(tag);
  }

  const clauses = [...selectors]
    .map((tag) => {
      const [key, value] = tag.split("=");
      return `  nwr["${key}"="${value}"]["name"](around:${radius},${lat},${lng});`;
    })
    .join("\n");

  return `[out:json][timeout:${SERVER_TIMEOUT_S}];\n(\n${clauses}\n);\nout center ${Math.min(query.limit * 3, 400)};`;
}

/**
 * Fetch specific objects by their OpenStreetMap identity.
 *
 * `node/26472667` is a permanent, public, citable identity, which is exactly
 * why a saved place stores one and not a copy of the shop. This turns a set of
 * them back into rows.
 *
 * Objects are grouped by type so the query is three statements at most rather
 * than one per id — a student with forty saved places would otherwise make
 * forty statements, and Overpass would be right to refuse.
 */
export function buildLookupQuery(providerPlaceIds: readonly string[]): string {
  const byType = new Map<string, string[]>();

  for (const id of providerPlaceIds) {
    const [type, value] = id.split("/");
    /* Anything that is not a plain numeric id of a known object type is
       dropped rather than interpolated. This string goes into a query
       language, and an id that arrived from a stored row is not trusted to be
       what we wrote there. */
    if (!type || !value || !/^[0-9]+$/.test(value)) continue;
    if (type !== "node" && type !== "way" && type !== "relation") continue;
    const held = byType.get(type);
    if (held) held.push(value);
    else byType.set(type, [value]);
  }

  const clauses = [...byType.entries()]
    .map(([type, ids]) => `  ${type}(id:${ids.join(",")});`)
    .join("\n");

  if (!clauses) return "";
  return `[out:json][timeout:${SERVER_TIMEOUT_S}];\n(\n${clauses}\n);\nout center;`;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * How much to trust the row.
 *
 * OpenStreetMap has no verification concept, so this is derived from how
 * completely the object is described. A shop with opening hours and a website
 * has an active mapper behind it; a bare name and a point may be five years
 * old. The band is shown to the student as words, never as a score.
 */
function confidenceOf(tags: Record<string, string>): DataConfidence {
  const detail = ["opening_hours", "website", "phone", "addr:street", "brand"].filter(
    (key) => tags[key],
  ).length;
  if (detail >= 3) return "verified";
  if (detail >= 1) return "recent";
  return "limited";
}

/** `addr:street 12, 28004 Madrid` from the parts OSM actually holds. */
function addressOf(tags: Record<string, string>): string | null {
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const town = [tags["addr:postcode"], tags["addr:city"]].filter(Boolean).join(" ");
  const full = [street, town].filter(Boolean).join(", ");
  return full || null;
}

function categoryOf(tags: Record<string, string>): PlaceCategory | null {
  for (const [tag, category] of CATEGORY_BY_TAG) {
    const [key, value] = tag.split("=");
    if (key && value && tags[key] === value) return category;
  }
  return null;
}

/** Everything else the object says it is, for the secondary chips. */
function subcategoriesOf(tags: Record<string, string>): string[] {
  const out: string[] = [];
  if (tags.cuisine) out.push(...tags.cuisine.split(";").map((value) => value.replace(/_/g, " ")));
  if (tags.organic === "yes") out.push("organic");
  if (tags.diet_vegetarian === "yes" || tags["diet:vegetarian"] === "yes") out.push("vegetarian");
  if (tags.diet_vegan === "yes" || tags["diet:vegan"] === "yes") out.push("vegan");
  if (tags.wheelchair === "yes") out.push("step-free");
  if (tags.internet_access === "wlan" || tags.internet_access === "yes") out.push("wifi");
  return [...new Set(out)].slice(0, 4);
}

export function parseElements(
  elements: readonly OverpassElement[],
  fetchedAt: string,
  attribution: string,
): RealPlace[] {
  const places: RealPlace[] = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;

    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;

    const category = categoryOf(tags);
    if (!category) continue;

    const path = `${element.type}/${element.id}`;

    places.push({
      id: `osm:${path}`,
      provider: "osm",
      providerPlaceId: path,
      name,
      category,
      subcategories: subcategoriesOf(tags),
      address: addressOf(tags),
      lat,
      lng,
      brand: tags.brand ?? tags.operator ?? null,
      website: tags.website ?? tags["contact:website"] ?? null,
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      openingHours: tags.opening_hours ?? null,
      /* OpenStreetMap holds none of these. Null is the answer, and the card
         renders nothing rather than a placeholder star. */
      rating: null,
      ratingCount: null,
      priceLevel: null,
      sourceUrl: `https://www.openstreetmap.org/${path}`,
      fetchedAt,
      attribution,
      confidence: confidenceOf(tags),
    });
  }

  return places;
}

/* -------------------------------------------------------------------------- */
/* The provider                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Send one Overpass query, trying each endpoint until one answers.
 *
 * Shared by search and lookup because the failure handling is the whole point
 * and having it twice is how the second copy stops checking the content type.
 */
async function run(
  endpoints: readonly string[],
  body: string,
  signal: AbortSignal,
): Promise<{ places: RealPlace[]; endpoint: string; tookMs: number }> {
  const started = Date.now();
  const failures: string[] = [];

  const ordered =
    lastGood && endpoints.includes(lastGood)
      ? [lastGood, ...endpoints.filter((candidate) => candidate !== lastGood)]
      : endpoints;

  for (const endpoint of ordered) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
          "user-agent": USER_AGENT,
        },
        body: new URLSearchParams({ data: body }),
        /* The caller's abort AND this endpoint's own deadline, whichever fires
           first, so one slow instance cannot spend the whole search's budget.
           A single shared budget was the first version, and it meant the busy
           canonical instance absorbed all of it and the second endpoint was
           never asked — a failover that never fires is not a failover. */
        signal: AbortSignal.any([signal, AbortSignal.timeout(ENDPOINT_TIMEOUT_MS)]),
        cache: "no-store",
      });

      if (response.status === 429 || response.status === 504) {
        throw new ProviderRefused("osm", response.status, `${endpoint} is rate limiting`);
      }
      if (!response.ok) {
        throw new Error(`${endpoint} returned ${response.status} ${response.statusText}`);
      }

      /* A busy instance answers 200 with an HTML error page. Reading the
         content type is the only way to tell that apart from data, and
         skipping the check produces a JSON parse error whose message says
         nothing useful to whoever is looking at the health screen. */
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        const text = (await response.text()).slice(0, 400);
        const reason = /Error<\/strong>:\s*([^<]+)/.exec(text)?.[1]?.trim() ?? "not JSON";
        throw new ProviderRefused("osm", response.status, `${endpoint}: ${reason}`);
      }

      const payload = (await response.json()) as { elements?: OverpassElement[] };
      const places = parseElements(
        payload.elements ?? [],
        new Date().toISOString(),
        ATTRIBUTION,
      );

      lastGood = endpoint;
      return { places, endpoint, tookMs: Date.now() - started };
    } catch (error) {
      if (signal.aborted) throw error;
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(failures.join("; ") || "no Overpass endpoint configured");
}

export function overpassProvider(): PlaceProvider {
  const endpoints = env.places.overpassUrl ? [env.places.overpassUrl] : [...DEFAULT_ENDPOINTS];

  return {
    id: "osm",
    label: "OpenStreetMap (Overpass)",
    attribution: ATTRIBUTION,

    status: () => ({
      configured: true,
      detail: `${endpoints.length} endpoint${endpoints.length === 1 ? "" : "s"}: ${endpoints.join(", ")}`,
    }),

    supports: (category) => (OSM_TAGS[category] ?? []).length > 0,

    async lookup(providerPlaceIds, signal) {
      const body = buildLookupQuery(providerPlaceIds);
      if (!body) return [];
      const { places } = await run(endpoints, body, signal);
      return places;
    },

    async search(query, signal): Promise<PlaceProviderResult> {
      return run(endpoints, buildQuery(query), signal);
    },
  };
}
