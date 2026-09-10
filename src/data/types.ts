import type {
  DataConfidence,
  PlaceCategory,
  PlaceLayer as DomainPlaceLayer,
  PlaceProviderId,
  Proximity,
  StudentValue,
} from "@/domain/places";

/**
 * ============================================================================
 * DOMAIN TYPES
 * ----------------------------------------------------------------------------
 * These mirror the eventual Postgres schema (see src/services/db/schema.ts).
 * The marketing site renders seeded rows through the same shapes the product
 * will render live rows through, so every demo on this page is a real
 * component fed real-shaped data rather than a screenshot.
 * ============================================================================
 */

/**
 * Honest availability. Nothing is described as live until it is.
 *
 *   coming-soon   the product works from official data and the student's own
 *                 rows; no seeded local content, Pulse opens with the first post
 *   beta          full local data, community still filling up
 *   live          full local data and an active community
 *   high-density  live, with enough students that friends-of-friends and
 *                 campus signals are meaningful
 */
export type CityStatus = "coming-soon" | "beta" | "live" | "high-density";

export type CityAnchors = {
  lunch: [number, number];
  pint: [number, number];
  monthlyTransport: number;
  weeklyGroceries: [number, number];
  /**
   * One journey, paid singly, in the city's own currency. Zero is a real
   * answer in cities where students already hold a semester ticket or ride a
   * bike, and the planner prints that rather than inventing a fare.
   */
  singleFare: number;
};

export type City = {
  slug: string;
  name: string;
  country: string;
  /** ISO-3166 alpha-2, used for flags and locale defaults. */
  countryCode: string;
  currency: { code: string; symbol: string };
  /** BCP-47, for number, date and currency formatting. */
  locale: string;
  /** IANA. The planner needs it before it can say "tonight". */
  timezone: string;
  /** Languages a student will meet, most common first. */
  languages: readonly string[];
  status: CityStatus;
  /** One line a student would actually say about the city. */
  hook: string;
  /** Two or three sentences for the city landing page. */
  intro: string;
  /** Typical student spend anchors. Ranges, never invented averages. */
  anchors: CityAnchors;
  neighbourhoods: readonly string[];
  campusSlugs: readonly string[];
  transport: { card: string; studentNote: string; officialUrl: string };
  /** Rendered as the map backdrop; purely stylised, not geographic data. */
  mapSeed: number;
};

/**
 * What the product knows about ANY city a student can pick, deep or not.
 * Built by `resolveCity`. Fields the directory cannot fill are null or empty,
 * and every consumer handles that rather than inventing a value.
 */
export type CityContext = {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  currency: { code: string; symbol: string };
  locale: string;
  timezone: string;
  languages: readonly string[];
  status: CityStatus;
  /** Null for a coming-soon city: no local price data yet, and the UI says so. */
  anchors: CityAnchors | null;
  neighbourhoods: readonly string[];
  campusSlugs: readonly string[];
  transport: { card: string; studentNote: string; officialUrl: string } | null;
  mapSeed: number;
  /** True when a full `City` record with seeded content exists. */
  deep: boolean;
  /**
   * City centre, imported from Wikidata by `scripts/import-cities.mjs`.
   *
   * The origin of every place search, every distance and every map. Non-null
   * for every city in the directory — `src/config/regions.ts` refuses to build
   * one without it — and typed as nullable only so that a caller reading a
   * city out of an old stored row is forced to handle its absence.
   */
  lat: number | null;
  lng: number | null;
  /** https://www.wikidata.org/wiki/<id> — provenance for the coordinate. */
  wikidataId: string | null;
  /** Municipality population. A city fact, never a student count. */
  population: number | null;
};

export type Campus = {
  slug: string;
  name: string;
  shortName: string;
  citySlug: string;
  /** The neighbourhood students associate with the campus. */
  area: string;
};

export type LoopKind =
  | "event"
  | "deal"
  | "looking-for"
  | "question"
  | "tip"
  | "warning"
  | "poll";

export type LoopAuthor = {
  handle: string;
  /** Initials shown in the avatar. Never a fabricated photo. */
  initials: string;
  campusSlug?: string;
  /** Terms in the city. Signals local credibility without fake stats. */
  terms: number;
};

export type LoopPost = {
  id: string;
  citySlug: string;
  kind: LoopKind;
  title: string;
  body?: string;
  author: LoopAuthor;
  /** Minutes ago; rendered through `ago()` so the feed never shows a date. */
  postedMinutesAgo: number;
  upvotes: number;
  comments: number;
  /** Kind-specific chip: "284 interested", "Verified by 17 students". */
  signal?: string;
  /** Where it is happening, when relevant. */
  place?: string;
  when?: string;
  price?: number;
  /** Campus tags shown as chips under the post. */
  tags: readonly string[];
  /** Poll options, only for kind === "poll". */
  poll?: readonly { label: string; share: number }[];
};

/**
 * Re-exported from the domain, which is where the layer a place belongs to is
 * decided. Kept here because a hundred components import it from this file.
 */
export type { PlaceLayer } from "@/domain/places";

/**
 * A place as a screen needs it: the provider's row, plus what StudentOS knows
 * about it, plus how far away it is.
 *
 * WHAT THIS TYPE USED TO HAVE, AND WHY IT NO LONGER DOES. It had `price`, a
 * euro figure nobody had checked; `priceLabel`, a sentence written around that
 * figure; `walkMinutes`, a haversine dressed as routing; `studentValue`, a
 * number from 0 to 100 computed from nothing; `verifiedBy`, a confirmation
 * count with no students behind it; `why`, a hand-written recommendation; and
 * `x`/`y`, a position on a drawing rather than a coordinate on the earth.
 * Every one of them was invented, and together they made twenty-five made-up
 * places look like the most authoritative screen in the product.
 *
 * What replaces them is narrower and true. `priceLevel` is the provider's own
 * 1-to-4 band or null. `proximity` says how it was measured. `value` is a band
 * with its reasons attached. `confirmations` and `saves` are counted from
 * rows. And `lat`/`lng` are where the place actually is.
 */
export type Place = {
  /** Provider-qualified: "osm:node/26472667", "google:ChIJ…". */
  id: string;
  citySlug: string;
  name: string;
  /** Display label for the category, e.g. "Pharmacy". */
  category: string;
  categoryKey: PlaceCategory;
  layers: readonly DomainPlaceLayer[];
  /** The provider's own 1-4 price band. Null means the provider did not say. */
  priceLevel: number | null;
  /** How far, and how that was measured. Never a duration from a distance. */
  proximity: Proximity;
  /** A band and its reasons. Never a percentage. */
  value: StudentValue;
  /** Students who confirmed something here. Real rows; 0 shows nothing. */
  confirmations: number;
  /** Students who saved it. Real rows; 0 shows nothing. */
  saves: number;
  lat: number;
  lng: number;
  address: string | null;
  brand: string | null;
  website: string | null;
  phone: string | null;
  /** Verbatim from the provider. Rendered only when it can be parsed. */
  openingHours: string | null;
  rating: number | null;
  ratingCount: number | null;
  provider: PlaceProviderId;
  /** The row at the provider, so anybody can check what we showed. */
  sourceUrl: string;
  /** Licence line the interface is required to render. */
  attribution: string;
  confidence: DataConfidence;
  fetchedAt: string;
};

export type PlanItem = {
  time: string;
  title: string;
  detail?: string;
  price: number;
  /** Walking minutes to this stop from the previous one. */
  walkMinutes?: number;
  kind: "food" | "event" | "drink" | "transport" | "culture" | "activity";
  /** Where this row came from. Keeps the AI answer source-aware. */
  source: "students" | "official" | "venue";
};

export type Plan = {
  id: string;
  citySlug: string;
  /** The question that produced it. */
  query: string;
  /** Headline over the generated plan, e.g. "Your €18.50 night". */
  title: string;
  budget: number;
  items: readonly PlanItem[];
  /** Number of nearby students who marked interest. Seeded demo value. */
  interested: number;
  /** Optional closing note under the total. */
  note?: string;
};

export type ArrivalTask = {
  id: string;
  label: string;
  /** What it actually involves, in one sentence. */
  detail: string;
  /** Roughly how long it takes, so the list feels finishable. */
  effort: string;
  /** Official or primary source, linked in the UI. */
  source?: { label: string; url: string };
  /** Set when the step touches legal or immigration requirements. */
  legal?: boolean;
  cost?: string;
};

/* -------------------------------------------------------------------------- */
/* Neighbourhoods                                                              */
/* -------------------------------------------------------------------------- */

/**
 * How a neighbourhood scores on one liveability trait, as a coarse band.
 *
 * Five bands rather than a percentage, and that is a deliberate refusal. The
 * honest resolution of "how good are the groceries in Neukölln" is "fine, not
 * amazing" — rendering that as 63% invents three digits of precision nobody
 * measured, and a student who compares 63% against 67% is comparing noise.
 * A band survives being wrong by a little; a percentage does not.
 */
export type TraitBand = 0 | 1 | 2 | 3 | 4;

export const traitBandLabel: Record<TraitBand, string> = {
  0: "Barely",
  1: "A little",
  2: "Some",
  3: "Good",
  4: "Strong",
};

export type NeighbourhoodTrait =
  /** Bars, clubs and things that are still open at 01:00. */
  | "nightlife"
  /** How likely you are to sleep through a Saturday night. */
  | "quiet"
  /** Cheap supermarkets and a market, within walking distance. */
  | "groceries"
  /** Frequency and coverage of transport, not distance to one stop. */
  | "transport"
  /** How many students already live here. Drives everything social. */
  | "studentDensity"
  /** Parks big enough to sit in. */
  | "green"
  /** Eating out at a student price, not the number of restaurants. */
  | "eatingOut";

/**
 * Where a rent band came from.
 *
 * This exists because a rent figure is the single number in this product a
 * student will make an eight-hundred-euro-a-month decision on. Carrying the
 * basis on the row means a surface cannot render the number without being able
 * to render where it came from, and `seed-estimate` is displayed as exactly
 * that — an estimate to sanity-check listings against, never a market reading.
 */
export type RentBasis =
  /** Written from public listing ranges when the city was seeded. An estimate. */
  | "seed-estimate"
  /** A published municipal or university figure, with a URL. */
  | "official"
  /** Derived from verified `price` claims students submitted. */
  | "students";

/**
 * Typical monthly rent, as a band, in whole units of the city's currency.
 *
 * A band, not an average: the average rent in a neighbourhood is a number no
 * student can act on, because nobody rents the average flat. The two numbers
 * are roughly what the cheaper and dearer ends of what students actually take
 * look like, and a listing outside them is the interesting case either way.
 */
export type RentBand = {
  /** A room in a shared flat — what most students are actually looking at. */
  room: readonly [number, number];
  /** A studio or one-bed. Null where they effectively do not exist for students. */
  studio: readonly [number, number] | null;
  basis: RentBasis;
  /** Required when `basis` is "official". */
  sourceUrl?: string;
  /** ISO date. When someone last looked at this, not when the row was written. */
  checkedOn: string;
};

/**
 * A place a student could live, as a row rather than a string.
 *
 * `City.neighbourhoods` used to be a bare `string[]`, which meant the product
 * could name a neighbourhood and could do nothing else with it: not compare
 * two, not say what a commute costs, not tell someone their budget rules one
 * out. Everything downstream of "where should I live" — the match engine, the
 * housing comparison, the graph edge from a place to the area it sits in —
 * needs this to be an entity. That is what phase 2 of the moat plan means by
 * promoting them.
 */
export type Neighbourhood = {
  slug: string;
  citySlug: string;
  name: string;
  /**
   * One line a student who lives there would say. Not a tourism blurb.
   *
   * NULL FOR AN IMPORTED AREA, and that nullability is what lets this product
   * know about neighbourhoods in eighty cities instead of five. A coordinate
   * and a name can be imported from Wikidata; what a place is LIKE cannot, and
   * generating a sentence about somewhere nobody has been is exactly the
   * fabrication this codebase exists without. So an imported area is a real
   * name in a real position with nothing said about it, and the interface
   * renders the silence rather than filling it.
   */
  character: string | null;
  /**
   * Door-to-door minutes to each campus in the city, keyed by campus slug, by
   * whatever students there actually use — metro in Madrid, a bike in
   * Amsterdam. One number per campus, because a range here would be a range of
   * a range and mean nothing.
   */
  commuteMinutes: Readonly<Record<string, number>>;
  /** Null when nobody has priced this area. `scoreRent` returns "unknown". */
  rent: RentBand | null;
  /** Null when nobody has rated this area. `scoreTraits` scores it neutral. */
  traits: Readonly<Record<NeighbourhoodTrait, TraitBand>> | null;
  /**
   * The area's own centre, from Wikidata via `scripts/import-neighbourhoods.mjs`.
   *
   * NULLABLE, AND THAT IS THE POINT. It is what decides which neighbourhood a
   * real place sits in — nearest centre, inside a radius — and the honest
   * answer for an area nobody has a coordinate for is that no place is ever
   * claimed to be in it. Madrid's La Latina is the live example: Wikidata has
   * a metro station of that name and a district several kilometres away that
   * is a different place, so it has no point and makes no claim.
   *
   * `wikidataId` is the provenance: https://www.wikidata.org/wiki/<id>
   */
  lat: number | null;
  lng: number | null;
  wikidataId: string | null;
};
