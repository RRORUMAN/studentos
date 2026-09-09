/**
 * ============================================================================
 * PLACES
 * ----------------------------------------------------------------------------
 * What a real-world place is once it has been through a provider and before it
 * reaches a screen. Pure: no fetch, no store, no `new Date()`.
 *
 * ---------------------------------------------------------------------------
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 * A place is a claim about somewhere a student can walk to. Every field on it
 * either came from a provider or is null. There is no default rating, no
 * assumed opening time, no invented price, and no "typical" anything. The
 * previous version of this product shipped twenty-five hand-written places
 * with names like "Ramen counter, Malasaña" and a `verifiedBy: 41` that no
 * student had ever supplied; a place with no name is not a recommendation, and
 * a confirmation count with nobody behind it is a lie with a number on it.
 *
 * ---------------------------------------------------------------------------
 * PROVENANCE IS PART OF THE TYPE
 *
 * `provider`, `providerPlaceId`, `sourceUrl` and `fetchedAt` are required, not
 * optional. A place that cannot say where it came from cannot be constructed,
 * which means no code path can produce one by accident. `attribution` is the
 * string the interface must render — OpenStreetMap's licence requires it, and
 * making it a field rather than a convention is what stops it being forgotten
 * on the one surface nobody re-read.
 *
 * ---------------------------------------------------------------------------
 * DISTANCE IS NOT TRAVEL TIME
 *
 * `Proximity` carries how it was measured. A haversine between two points is a
 * distance; it becomes "9 min walk" only when a routing provider says so.
 * Presenting the first as the second is the specific dishonesty that makes a
 * map feel authoritative while being wrong about every one-way street, river
 * and railway line in the city.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What a student is looking for, in their words.
 *
 * This is the product's own taxonomy, and every provider adapter maps its own
 * vocabulary onto it. It is deliberately short: a category earns its place by
 * being something somebody actually searches for at 19:00 on a Tuesday, not by
 * existing in a provider's list.
 */
export type PlaceCategory =
  | "supermarket"
  | "grocery"
  | "convenience"
  | "market"
  | "restaurant"
  | "cheap-eat"
  | "cafe"
  | "bar"
  | "nightclub"
  | "pharmacy"
  | "clinic"
  | "gym"
  | "pool"
  | "library"
  | "study-space"
  | "coworking"
  | "laundry"
  | "bank"
  | "atm"
  | "post"
  | "bookshop"
  | "phone-shop"
  | "park"
  | "cinema"
  | "museum"
  | "bicycle";

export type PlaceCategoryMeta = {
  key: PlaceCategory;
  /** Singular, sentence case. What the card prints under the name. */
  label: string;
  /** Plural, for headings and empty states. */
  plural: string;
  /** The group a filter chip belongs to, so Explore need not show 26 chips. */
  group: PlaceGroup;
  /** Words a student might type that mean this category. Folded on use. */
  synonyms: readonly string[];
};

export type PlaceGroup = "food" | "shops" | "health" | "study" | "sport" | "going-out" | "admin";

export const placeGroupLabel: Record<PlaceGroup, string> = {
  food: "Food",
  shops: "Shops",
  health: "Health",
  study: "Study",
  sport: "Sport",
  "going-out": "Going out",
  admin: "Everyday",
};

export const placeCategories: readonly PlaceCategoryMeta[] = [
  { key: "supermarket", label: "Supermarket", plural: "Supermarkets", group: "shops", synonyms: ["supermarket", "groceries", "food shop", "mercadona", "lidl", "aldi", "supermercado"] },
  { key: "grocery", label: "Grocery shop", plural: "Grocery shops", group: "shops", synonyms: ["grocer", "greengrocer", "fruit shop", "corner shop"] },
  { key: "convenience", label: "Convenience shop", plural: "Convenience shops", group: "shops", synonyms: ["convenience", "late shop", "corner store"] },
  { key: "market", label: "Market", plural: "Markets", group: "shops", synonyms: ["market", "mercado", "food market"] },
  { key: "restaurant", label: "Restaurant", plural: "Restaurants", group: "food", synonyms: ["restaurant", "dinner", "eat", "food"] },
  { key: "cheap-eat", label: "Cheap eat", plural: "Cheap eats", group: "food", synonyms: ["cheap food", "fast food", "takeaway", "kebab", "pizza slice"] },
  { key: "cafe", label: "Café", plural: "Cafés", group: "food", synonyms: ["cafe", "coffee", "breakfast"] },
  { key: "bar", label: "Bar", plural: "Bars", group: "going-out", synonyms: ["bar", "pub", "drinks", "pint"] },
  { key: "nightclub", label: "Club", plural: "Clubs", group: "going-out", synonyms: ["club", "nightclub", "night out", "dancing"] },
  { key: "pharmacy", label: "Pharmacy", plural: "Pharmacies", group: "health", synonyms: ["pharmacy", "chemist", "farmacia", "apotheke"] },
  { key: "clinic", label: "Clinic", plural: "Clinics", group: "health", synonyms: ["doctor", "clinic", "gp", "health centre"] },
  { key: "gym", label: "Gym", plural: "Gyms", group: "sport", synonyms: ["gym", "fitness", "weights"] },
  { key: "pool", label: "Swimming pool", plural: "Swimming pools", group: "sport", synonyms: ["pool", "swimming", "piscina"] },
  { key: "library", label: "Library", plural: "Libraries", group: "study", synonyms: ["library", "biblioteca"] },
  { key: "study-space", label: "Study space", plural: "Study spaces", group: "study", synonyms: ["study", "study spot", "quiet place"] },
  { key: "coworking", label: "Coworking", plural: "Coworking spaces", group: "study", synonyms: ["coworking", "desk", "workspace"] },
  { key: "laundry", label: "Laundrette", plural: "Laundrettes", group: "admin", synonyms: ["laundry", "laundrette", "washing"] },
  { key: "bank", label: "Bank", plural: "Banks", group: "admin", synonyms: ["bank", "branch", "account"] },
  { key: "atm", label: "Cash machine", plural: "Cash machines", group: "admin", synonyms: ["atm", "cash machine", "cashpoint", "cajero"] },
  { key: "post", label: "Post office", plural: "Post offices", group: "admin", synonyms: ["post", "post office", "parcel", "correos"] },
  { key: "bookshop", label: "Bookshop", plural: "Bookshops", group: "study", synonyms: ["bookshop", "books", "textbooks"] },
  { key: "phone-shop", label: "Phone shop", plural: "Phone shops", group: "admin", synonyms: ["sim", "phone", "mobile", "data"] },
  { key: "park", label: "Park", plural: "Parks", group: "sport", synonyms: ["park", "green", "outdoors", "run"] },
  { key: "cinema", label: "Cinema", plural: "Cinemas", group: "going-out", synonyms: ["cinema", "film", "movie"] },
  { key: "museum", label: "Museum", plural: "Museums", group: "going-out", synonyms: ["museum", "gallery", "culture"] },
  { key: "bicycle", label: "Bike shop", plural: "Bike shops", group: "sport", synonyms: ["bike", "bicycle", "repair"] },
];

const categoryByKey = new Map(placeCategories.map((meta) => [meta.key, meta]));

export function placeCategoryMeta(key: PlaceCategory): PlaceCategoryMeta {
  const meta = categoryByKey.get(key);
  /* Every key in the union is in the table above; this is the compiler's proof
     turned into a runtime one for the JSON that arrives from a cache row. */
  if (!meta) throw new Error(`unknown place category: ${key}`);
  return meta;
}

export function categoriesInGroup(group: PlaceGroup): readonly PlaceCategoryMeta[] {
  return placeCategories.filter((meta) => meta.group === group);
}

/* -------------------------------------------------------------------------- */
/* The place                                                                   */
/* -------------------------------------------------------------------------- */

export type PlaceProviderId = "osm" | "google" | "students";

export const placeProviderLabel: Record<PlaceProviderId, string> = {
  osm: "OpenStreetMap",
  google: "Google Maps",
  students: "StudentOS students",
};

/**
 * How trustworthy the row is, which is a different question from how good the
 * place is. Set by the adapter from what the provider actually returned.
 */
export type DataConfidence = "verified" | "recent" | "community-reported" | "limited" | "unknown";

export const dataConfidenceLabel: Record<DataConfidence, string> = {
  verified: "Verified",
  recent: "Recently updated",
  "community-reported": "Reported by students",
  limited: "Limited data",
  unknown: "Unknown",
};

/**
 * A real place, normalised.
 *
 * Nullable is the default for everything a provider might not say. The one
 * group that is not nullable is provenance, because a place that cannot be
 * traced back has no business being on a screen.
 */
export type RealPlace = {
  /** Stable within a provider: `osm:node/624783119`, `google:ChIJ…`. */
  id: string;
  provider: PlaceProviderId;
  providerPlaceId: string;
  name: string;
  category: PlaceCategory;
  /** Anything else the provider said this is. Shown as secondary chips. */
  subcategories: readonly string[];
  /** As the provider gives it. Never assembled from parts we guessed. */
  address: string | null;
  lat: number;
  lng: number;
  /** Chain or operator, where stated. "Mercadona", "Lidl". */
  brand: string | null;
  website: string | null;
  phone: string | null;
  /**
   * Verbatim from the provider, in the provider's own syntax. Rendering it is
   * `openingHoursSummary`'s job and it refuses anything it cannot parse rather
   * than printing a time it inferred.
   */
  openingHours: string | null;
  /** 0-5. Only ever a provider's own rating; StudentOS does not compute one. */
  rating: number | null;
  ratingCount: number | null;
  /** 1-4, provider's own scale. */
  priceLevel: number | null;
  /** Deep link to the row at the provider, for anyone who wants to check. */
  sourceUrl: string;
  /** ISO instant this row was retrieved. */
  fetchedAt: string;
  /** Licence line the interface is required to render. */
  attribution: string;
  confidence: DataConfidence;
};

/* -------------------------------------------------------------------------- */
/* Geometry                                                                    */
/* -------------------------------------------------------------------------- */

export type Coords = { lat: number; lng: number };

export type Bounds = { south: number; west: number; north: number; east: number };

const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceMetres(from: Coords, to: Coords): number {
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * A square-ish box of `radiusMetres` around a point.
 *
 * Longitude degrees shrink with latitude, which the cosine handles; at the
 * poles it would divide by zero, so the divisor is floored. No student is
 * studying at 90°N, but a provider that returns a bad coordinate should give
 * a wide box rather than an exception.
 */
export function boundsAround(centre: Coords, radiusMetres: number): Bounds {
  const latDelta = (radiusMetres / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngDelta = latDelta / Math.max(0.01, Math.cos(toRad(centre.lat)));
  return {
    south: centre.lat - latDelta,
    north: centre.lat + latDelta,
    west: centre.lng - lngDelta,
    east: centre.lng + lngDelta,
  };
}

export function withinBounds(point: Coords, bounds: Bounds): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

/** The centre of a box. Used to key a cache entry to a viewport. */
export function boundsCentre(bounds: Bounds): Coords {
  return { lat: (bounds.south + bounds.north) / 2, lng: (bounds.west + bounds.east) / 2 };
}

/* -------------------------------------------------------------------------- */
/* Proximity                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * How far away something is, and — the important half — how we know.
 *
 * `straight-line` is a haversine. It is honest about being a lower bound and
 * the interface prints a distance. `walking-route`, `cycling-route` and
 * `transit-route` come from a routing provider and are allowed to print a
 * duration. Nothing converts the first into the second.
 */
export type ProximityKind = "straight-line" | "walking-route" | "cycling-route" | "transit-route";

export type Proximity = {
  kind: ProximityKind;
  metres: number;
  /** Only ever set by a routing provider. Null for a straight line. */
  minutes: number | null;
};

export function straightLine(from: Coords, to: Coords): Proximity {
  return { kind: "straight-line", metres: Math.round(distanceMetres(from, to)), minutes: null };
}

/**
 * The one sentence the card prints.
 *
 * A routed proximity prints minutes because a router walked the streets. A
 * straight line prints metres and the word "away", which is true and is not a
 * promise about how long anything takes.
 */
export function describeProximity(proximity: Proximity): string {
  if (proximity.minutes !== null) {
    const verb =
      proximity.kind === "cycling-route" ? "cycle" : proximity.kind === "transit-route" ? "by transit" : "walk";
    const minutes = Math.max(1, Math.round(proximity.minutes));
    return proximity.kind === "transit-route" ? `${minutes} min ${verb}` : `${minutes} min ${verb}`;
  }
  return `${formatDistance(proximity.metres)} away`;
}

/** Metres below a kilometre, one decimal above it. Never "0.4 km". */
export function formatDistance(metres: number): string {
  if (metres < 1_000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1_000).toFixed(1)} km`;
}

/* -------------------------------------------------------------------------- */
/* Opening hours                                                               */
/* -------------------------------------------------------------------------- */

export type OpenState =
  | { state: "open"; until: string | null }
  | { state: "closed"; opensAt: string | null }
  | { state: "unknown" };

/** `Mo-Sa 09:15-21:30` and friends: one day spec, one or more ranges. */
const OSM_RULE = /^([A-Za-z,\-\s]+?)\s+((?:\d{2}:\d{2}-\d{2}:\d{2}(?:,\s*)?)+)$/;
const DAY_INDEX: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };

/**
 * Answer "is it open" from an OpenStreetMap `opening_hours` string.
 *
 * The syntax is a small language with public holidays, seasons, sunset offsets
 * and exceptions, and this parser handles the ordinary case only: weekday
 * ranges with clock times, plus `24/7`. Anything it does not fully understand
 * returns `unknown`, and the card says nothing rather than guessing — a
 * student standing outside a closed pharmacy at 22:00 because the app rounded
 * a rule it half-read is the failure being avoided.
 *
 * `dayOfWeek` is 0=Sunday and `minutes` is minutes since local midnight, both
 * computed by the caller in the CITY's timezone, never the server's.
 */
export function openStateFrom(
  openingHours: string | null,
  dayOfWeek: number,
  minutes: number,
): OpenState {
  if (!openingHours) return { state: "unknown" };
  const value = openingHours.trim();
  if (value === "24/7") return { state: "open", until: null };

  let closesAt: number | null = null;
  let nextOpen: number | null = null;
  let understood = false;

  for (const rule of value.split(";")) {
    const match = OSM_RULE.exec(rule.trim());
    if (!match) continue;
    const days = parseDays(match[1] ?? "");
    if (!days) continue;
    understood = true;
    if (!days.has(dayOfWeek)) continue;

    for (const span of (match[2] ?? "").split(",")) {
      const [from, to] = span.trim().split("-");
      const start = clockMinutes(from);
      const end = clockMinutes(to);
      if (start === null || end === null) continue;
      if (minutes >= start && minutes < end) closesAt = end;
      else if (minutes < start && (nextOpen === null || start < nextOpen)) nextOpen = start;
    }
  }

  if (!understood) return { state: "unknown" };
  if (closesAt !== null) return { state: "open", until: clockLabel(closesAt) };
  return { state: "closed", opensAt: nextOpen === null ? null : clockLabel(nextOpen) };
}

function parseDays(spec: string): Set<number> | null {
  const days = new Set<number>();
  for (const part of spec.split(",")) {
    const token = part.trim().toLowerCase();
    if (!token) continue;
    const range = token.split("-");
    if (range.length === 1) {
      const day = DAY_INDEX[range[0]?.slice(0, 2) ?? ""];
      if (day === undefined) return null;
      days.add(day);
      continue;
    }
    const from = DAY_INDEX[range[0]?.slice(0, 2) ?? ""];
    const to = DAY_INDEX[range[1]?.slice(0, 2) ?? ""];
    if (from === undefined || to === undefined) return null;
    for (let i = 0; i < 7; i += 1) {
      const day = (from + i) % 7;
      days.add(day);
      if (day === to) break;
    }
  }
  return days.size ? days : null;
}

function clockMinutes(value: string | undefined): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value?.trim() ?? "");
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function clockLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Student value                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Signals StudentOS holds about a place, all optional because most places have
 * none. Supplied by the caller from real rows: saves, confirmations, claims.
 */
export type ValueSignals = {
  /** Straight-line or routed metres from wherever the student is. */
  metres: number | null;
  /** Provider price level, 1-4. */
  priceLevel: number | null;
  rating: number | null;
  ratingCount: number | null;
  /** Students who saved this place. Real rows only. */
  saves: number;
  /** Students who confirmed a claim about it. Real rows only. */
  confirmations: number;
  /** A verified deal exists here. */
  hasVerifiedDeal: boolean;
};

export type ValueBand = "strong" | "good" | "mixed" | "insufficient";

export type StudentValue = {
  band: ValueBand;
  /** Short phrases, each traceable to a signal above. Never more than three. */
  reasons: readonly string[];
};

export const valueBandLabel: Record<ValueBand, string> = {
  strong: "Strong student value",
  good: "Good student value",
  mixed: "Mixed",
  insufficient: "Not enough student data",
};

/**
 * Below this many independent signals there is nothing to say, and the honest
 * answer is to say nothing. Two is low but not arbitrary: one signal is a
 * coincidence, two is the smallest thing that can agree with itself.
 */
export const MIN_VALUE_SIGNALS = 2;

/**
 * Value for money, as a band and the reasons behind it.
 *
 * There is no percentage and there never will be. The old product printed a
 * `studentValue: 92` computed from nothing, and a number with a decimal point
 * is the strongest claim an interface can make — it says somebody measured.
 * Bands say what is actually known: this looks strong, this looks good, or we
 * do not have enough to say.
 */
export function studentValue(signals: ValueSignals): StudentValue {
  const reasons: string[] = [];
  let score = 0;
  let counted = 0;

  if (signals.metres !== null) {
    counted += 1;
    if (signals.metres <= 400) {
      score += 2;
      reasons.push("Very close");
    } else if (signals.metres <= 1_200) {
      score += 1;
    }
  }

  if (signals.priceLevel !== null) {
    counted += 1;
    if (signals.priceLevel <= 1) {
      score += 2;
      reasons.push("Cheap for the category");
    } else if (signals.priceLevel === 2) {
      score += 1;
    } else {
      score -= 1;
    }
  }

  /* A rating with nobody behind it is noise. Twenty is the point where a mean
     stops moving much with one more review. */
  if (signals.rating !== null && (signals.ratingCount ?? 0) >= 20) {
    counted += 1;
    if (signals.rating >= 4.3) {
      score += 2;
      reasons.push(`Rated ${signals.rating.toFixed(1)} by ${signals.ratingCount}`);
    } else if (signals.rating >= 3.8) {
      score += 1;
    } else if (signals.rating < 3.2) {
      score -= 2;
    }
  }

  if (signals.saves > 0) {
    counted += 1;
    if (signals.saves >= 5) {
      score += 2;
      reasons.push(`Saved by ${signals.saves} students`);
    } else {
      score += 1;
    }
  }

  if (signals.confirmations > 0) {
    counted += 1;
    score += signals.confirmations >= 3 ? 2 : 1;
    reasons.push(
      signals.confirmations === 1
        ? "Confirmed by a student"
        : `Confirmed by ${signals.confirmations} students`,
    );
  }

  if (signals.hasVerifiedDeal) {
    counted += 1;
    score += 2;
    reasons.push("Verified student deal");
  }

  if (counted < MIN_VALUE_SIGNALS) return { band: "insufficient", reasons: [] };

  /* Five is deliberately above what two signals can reach even at their
     maximum (two each). "Strong student value" is a claim that SEVERAL
     different things agree — close and cheap and confirmed — and two of them
     agreeing is "good". Without that floor, one nearby shop with a good rating
     would look like the best place in the city. */
  const band: ValueBand = score >= 5 ? "strong" : score >= 2 ? "good" : "mixed";
  return { band, reasons: reasons.slice(0, 3) };
}

/* -------------------------------------------------------------------------- */
/* Ranking and de-duplication                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Two providers describing the same shop.
 *
 * Same folded name within fifty metres is one place. The radius is small on
 * purpose: two branches of the same chain a hundred metres apart on the same
 * street is a real and common arrangement, and merging them loses the nearer
 * one, which is the whole answer to "where is the closest".
 */
export const DEDUPE_RADIUS_M = 50;

export function isSamePlace(a: RealPlace, b: RealPlace): boolean {
  if (a.provider === b.provider && a.providerPlaceId === b.providerPlaceId) return true;
  if (foldName(a.name) !== foldName(b.name)) return false;
  return distanceMetres(a, b) <= DEDUPE_RADIUS_M;
}

function foldName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Merge results from several providers, preferring the earlier list.
 *
 * "Preferring" means the kept row is the one from the higher-priority provider
 * and it is NOT enriched with fields from the other. Mixing a Google rating
 * into an OpenStreetMap row produces something whose `attribution` is a lie
 * and whose licence terms are two different licences at once.
 */
export function dedupePlaces(lists: readonly (readonly RealPlace[])[]): RealPlace[] {
  const kept: RealPlace[] = [];
  for (const list of lists) {
    for (const place of list) {
      if (kept.some((held) => isSamePlace(held, place))) continue;
      kept.push(place);
    }
  }
  return kept;
}

export type RankedPlace = {
  place: RealPlace;
  proximity: Proximity;
  value: StudentValue;
};

/**
 * Nearest first, and that is nearly the whole rule.
 *
 * Distance is the signal a student actually optimises for when they want a
 * supermarket, and it is the one signal every row has. Value only breaks ties
 * inside the same two-hundred-metre band, so a strongly-rated shop a kilometre
 * away never displaces the one across the road.
 */
export function rankPlaces(ranked: readonly RankedPlace[]): RankedPlace[] {
  const bandOrder: Record<ValueBand, number> = { strong: 0, good: 1, mixed: 2, insufficient: 3 };
  return [...ranked].sort((a, b) => {
    const bandA = Math.floor(a.proximity.metres / 200);
    const bandB = Math.floor(b.proximity.metres / 200);
    if (bandA !== bandB) return bandA - bandB;
    const valueDelta = bandOrder[a.value.band] - bandOrder[b.value.band];
    if (valueDelta !== 0) return valueDelta;
    return a.proximity.metres - b.proximity.metres;
  });
}

/* -------------------------------------------------------------------------- */
/* Intent                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Turn what a student typed into categories, without a model.
 *
 * "cheap supermarket near me" is not a language problem, it is a lookup, and a
 * lookup that runs in a microsecond and cannot hallucinate is better than one
 * that costs a token and can. The AI layer calls this before it calls anything
 * else — see the note in `src/server/ai/tools.ts` about retrieval happening in
 * ordinary code.
 */
export function categoriesFor(query: string): PlaceCategory[] {
  const needle = ` ${foldName(query)} `;
  if (!needle.trim()) return [];
  const hits: { key: PlaceCategory; weight: number }[] = [];

  for (const meta of placeCategories) {
    for (const synonym of [meta.label, meta.plural, ...meta.synonyms]) {
      const folded = foldName(synonym);
      if (!folded) continue;
      if (needle.includes(` ${folded} `)) {
        /* A longer synonym is a more specific intent: "cheap food" must beat
           the "food" inside it, or every food query becomes every restaurant. */
        hits.push({ key: meta.key, weight: folded.length });
        break;
      }
    }
  }

  hits.sort((a, b) => b.weight - a.weight);
  return [...new Set(hits.map((hit) => hit.key))];
}

/** Whether the query asks for the cheap end, which changes the sort. */
export function wantsCheap(query: string): boolean {
  const needle = foldName(query);
  return ["cheap", "cheapest", "budget", "affordable", "discount", "barato", "low cost"].some(
    (word) => needle.includes(word),
  );
}

/* -------------------------------------------------------------------------- */
/* Cache row                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One cached provider answer, as it is stored.
 *
 * The shape lives here rather than beside the cache itself so that the store
 * schema can name it without importing anything from `src/server`, which would
 * be a cycle: the cache reads the store, and the store's schema would then
 * read the cache. The lifetimes and the key are in
 * `src/server/places/cache.ts`; this is only the row.
 */
export type PlaceCacheRow = {
  /** The cache key. Provider, snapped centre, snapped radius, categories. */
  id: string;
  provider: PlaceProviderId;
  centreLat: number;
  centreLng: number;
  radiusMetres: number;
  categories: string[];
  places: RealPlace[];
  fetchedAt: string;
  expiresAt: string;
};

/* -------------------------------------------------------------------------- */
/* Layers                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The filter rails Explore shows, as a student thinks about them.
 *
 * A layer is not a category. "Cheap food" spans three categories and depends
 * on a price level; "deals" is not a property of the place at all but of
 * whether somebody verified an offer there. Keeping them apart is what lets
 * the category taxonomy follow the providers while the filters follow the
 * student.
 */
export type PlaceLayer =
  | "for-you"
  | "cheap-food"
  | "groceries"
  | "free"
  | "deals"
  | "study"
  | "nightlife"
  | "fitness"
  | "culture"
  | "everyday";

/** Categories that always belong to a layer, whatever else is known. */
const LAYER_CATEGORIES: Partial<Record<PlaceLayer, readonly PlaceCategory[]>> = {
  groceries: ["supermarket", "grocery", "convenience", "market"],
  "cheap-food": ["cheap-eat"],
  study: ["library", "study-space", "coworking", "bookshop"],
  nightlife: ["bar", "nightclub"],
  fitness: ["gym", "pool", "park"],
  culture: ["museum", "cinema"],
  everyday: ["pharmacy", "clinic", "laundry", "bank", "atm", "post", "phone-shop", "bicycle"],
  /* Free means free to walk into, not "cheap". A park and a public library
     are; a museum charges in most of these cities and is not listed here
     because the product would then be making a claim about a ticket price it
     has not checked. */
  free: ["park", "library"],
};

/**
 * Which rails a place belongs on.
 *
 * `for-you` is deliberately absent: it is a fact about a student, not about a
 * place, and it is computed by the recommender rather than stored here.
 */
export function layersFor(
  category: PlaceCategory,
  signals: { priceLevel: number | null; hasVerifiedDeal: boolean },
): PlaceLayer[] {
  const layers = new Set<PlaceLayer>();

  for (const [layer, categories] of Object.entries(LAYER_CATEGORIES) as [
    PlaceLayer,
    readonly PlaceCategory[],
  ][]) {
    if (categories.includes(category)) layers.add(layer);
  }

  /* A restaurant or café earns "cheap food" only when the provider said it is
     at the cheap end. With no price level it stays off the rail rather than
     being added on the assumption that student food is cheap — that
     assumption is how a €30 dinner ends up under "Under €10". */
  if (signals.priceLevel !== null && signals.priceLevel <= 1) {
    if (category === "restaurant" || category === "cafe") layers.add("cheap-food");
  }

  if (signals.hasVerifiedDeal) layers.add("deals");

  return [...layers];
}

/* -------------------------------------------------------------------------- */
/* Price                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A provider's price band, as a student reads it.
 *
 * Bands, not amounts. Google publishes a 1-to-4 level and OpenStreetMap
 * publishes nothing, so an amount would have to be invented — which is what
 * the old `priceLabel: "€8.50 bowl"` was, on twenty-five places nobody had
 * been to. `null` renders as "Price not listed", which is the truth and is
 * also what a student can act on: they will look at the menu either way.
 */
export function priceLevelLabel(level: number | null): string {
  if (level === null) return "Price not listed";
  return "€".repeat(Math.max(1, Math.min(4, level)));
}

export function priceLevelNote(level: number | null): string {
  switch (level) {
    case 1:
      return "Cheap for the category";
    case 2:
      return "Mid-priced";
    case 3:
      return "Expensive";
    case 4:
      return "Very expensive";
    default:
      return "The provider did not state a price level";
  }
}

/**
 * How fresh the row is, in words.
 *
 * Every place carries `fetchedAt`, and a card that says when it was last
 * checked is doing something a search result never does. Hours rather than
 * minutes: a cache is measured in days and false precision on a timestamp is
 * still false precision.
 */
export function freshnessLabel(fetchedAt: string, now: Date): string {
  const ms = now.getTime() - Date.parse(fetchedAt);
  if (!Number.isFinite(ms) || ms < 0) return "Checked just now";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "Checked in the last hour";
  if (hours < 24) return `Checked ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Checked yesterday" : `Checked ${days} days ago`;
}

/* -------------------------------------------------------------------------- */
/* Projection                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Web Mercator, normalised into a box.
 *
 * The map used to place a pin using `x` and `y` percentages written by hand
 * next to each invented place, which meant the picture was a drawing: two
 * shops on the same street could be at opposite corners and nothing would
 * notice. Real coordinates need a real projection, and this is the smallest
 * one that is correct — the same projection every tile server uses, so a
 * marker computed here lands on the right building if a basemap is ever
 * configured underneath it.
 *
 * `y` is inverted because screen coordinates grow downward and latitude grows
 * upward, which is the one thing everybody gets wrong once.
 */
export function mercator(point: Coords): { x: number; y: number } {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, point.lat));
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: (point.lng + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

export type Viewport = { west: number; east: number; north: number; south: number };

/**
 * A viewport that contains every point, with a margin, and never smaller than
 * `minSpanMetres`.
 *
 * The floor matters: five supermarkets on one street would otherwise produce a
 * viewport a hundred metres across, and the map would look like a city while
 * showing a block. Below the floor the box is grown around its own centre.
 */
export function viewportFor(
  points: readonly Coords[],
  options: { marginFraction?: number; minSpanMetres?: number } = {},
): Viewport | null {
  if (points.length === 0) return null;

  const margin = options.marginFraction ?? 0.12;
  const minSpan = options.minSpanMetres ?? 600;

  let west = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let south = Infinity;

  for (const point of points) {
    west = Math.min(west, point.lng);
    east = Math.max(east, point.lng);
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
  }

  const centre = { lat: (north + south) / 2, lng: (west + east) / 2 };
  const minLatSpan = (minSpan / EARTH_RADIUS_M) * (180 / Math.PI);
  const minLngSpan = minLatSpan / Math.max(0.01, Math.cos(toRad(centre.lat)));

  let latSpan = Math.max(north - south, minLatSpan);
  let lngSpan = Math.max(east - west, minLngSpan);
  latSpan *= 1 + margin * 2;
  lngSpan *= 1 + margin * 2;

  return {
    north: centre.lat + latSpan / 2,
    south: centre.lat - latSpan / 2,
    west: centre.lng - lngSpan / 2,
    east: centre.lng + lngSpan / 2,
  };
}

/**
 * A point as a percentage of the viewport, ready for `left` and `top`.
 *
 * Returns null for anything outside, so a caller cannot accidentally pin
 * something to the edge of the canvas and imply it is at the edge of the city.
 */
export function positionIn(point: Coords, viewport: Viewport): { left: number; top: number } | null {
  const nw = mercator({ lat: viewport.north, lng: viewport.west });
  const se = mercator({ lat: viewport.south, lng: viewport.east });
  const here = mercator(point);

  const width = se.x - nw.x;
  const height = se.y - nw.y;
  if (width <= 0 || height <= 0) return null;

  const left = ((here.x - nw.x) / width) * 100;
  const top = ((here.y - nw.y) / height) * 100;
  if (left < 0 || left > 100 || top < 0 || top > 100) return null;

  return { left, top };
}

/* -------------------------------------------------------------------------- */
/* Interests                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * What a student ticked at onboarding, translated into rails.
 *
 * THE BUG THIS FIXES. The recommender scored interest fit by intersecting the
 * student's interests with the place's layers — two vocabularies that were
 * never joined. Of twenty-three interests, exactly three happened to share a
 * name with a layer, so for almost every place the intersection was empty and
 * `interestFit` returned its no-opinion constant. A student who ticked
 * "coffee", "cooking" and "study groups" got the same ranking as one who
 * ticked nothing, and the interests step of onboarding was decoration.
 *
 * The mapping is one-way and deliberately loose: an interest may point at
 * several rails, and a rail may serve several interests. What it must not do
 * is invent a connection — "networking" maps to nothing, because no category
 * of place is where networking happens, and pretending otherwise would rank
 * cafés for somebody who asked for people.
 */
const INTEREST_LAYERS: Record<string, readonly PlaceLayer[]> = {
  food: ["cheap-food"],
  "cheap-food": ["cheap-food"],
  coffee: ["cheap-food"],
  cooking: ["groceries"],
  nightlife: ["nightlife"],
  clubbing: ["nightlife"],
  music: ["nightlife", "culture"],
  concerts: ["culture"],
  festivals: ["culture"],
  museums: ["culture"],
  art: ["culture"],
  film: ["culture"],
  football: ["fitness"],
  gym: ["fitness"],
  running: ["fitness"],
  cycling: ["fitness"],
  fitness: ["fitness"],
  sports: ["fitness"],
  swimming: ["fitness"],
  "study-groups": ["study"],
  study: ["study"],
  reading: ["study"],
  "go-out": ["nightlife", "culture"],
  outdoors: ["fitness", "free"],
  budget: ["deals", "cheap-food"],
  deals: ["deals"],
  /* No rail. Nothing here is where you meet people or find a job, and
     inventing one would rank cafés at somebody who asked for company. */
  "meet-friends": [],
  networking: [],
  "travel-buddies": [],
  "language-exchange": [],
  "campus-events": [],
  private: [],
};

/**
 * The rails a student's interests point at.
 *
 * Returns a plain array so the recommender can intersect it with a place's
 * layers — the same shape as before, over vocabularies that now meet.
 */
export function layersForInterests(interests: readonly string[]): PlaceLayer[] {
  const layers = new Set<PlaceLayer>();
  for (const interest of interests) {
    for (const layer of INTEREST_LAYERS[interest] ?? []) layers.add(layer);
  }
  return [...layers];
}
