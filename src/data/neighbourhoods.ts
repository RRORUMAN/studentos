import { discoveredAreas } from "@/data/neighbourhoods/areas.generated";
import { neighbourhoodGeo } from "@/data/neighbourhoods/geo.generated";
import type { Neighbourhood, NeighbourhoodTrait, TraitBand } from "./types";

/**
 * ============================================================================
 * NEIGHBOURHOODS
 * ----------------------------------------------------------------------------
 * The five deep cities, as places you could live rather than as names.
 *
 * TWO TIERS, AND THE SEAM BETWEEN THEM IS THE POINT. What is written below is
 * five cities somebody knows: a character line, a rent band, seven trait
 * scores and a commute to each campus. What is joined on at the bottom of this
 * file, from `neighbourhoods/areas.generated.ts`, is every other city
 * cities as Wikidata knows them — a name, a point, a QID, and nothing else at
 * all. There is no middle tier where a machine guessed what Favoriten is like,
 * and there will not be one.
 *
 * That is the whole reason `character`, `rent` and `traits` are nullable. The
 * type used to require them, which meant the only way to have neighbourhoods
 * in Vienna was to invent Vienna, so the product had neighbourhoods in five
 * cities and a blank screen everywhere else. Letting the type say "not known"
 * cost three question marks and bought seventy-five cities.
 *
 * WHAT THESE NUMBERS ARE, stated before anyone reads one
 *
 * Every `rent.basis` below is `seed-estimate`. That means a person wrote the
 * band from public listing ranges on the date in `checkedOn` and nothing has
 * read a live market since. The UI renders that basis next to the number, and
 * `rentIsEstimated()` exists so a surface cannot show the band without being
 * able to say so. This is the same standing as the city price anchors and the
 * seeded places, and it sits behind the same sample-data notice.
 *
 * The path off `seed-estimate` is already open, and it is deliberately the
 * same loop as everything else in the moat: a `price` claim with `targetKind:
 * "neighbourhood"` that reaches `verified` is a real reading from students who
 * live there, and the graph layer prefers it over this file. These rows are
 * the floor, not the ceiling.
 *
 * Commute minutes are door-to-door by the mode students there actually use —
 * metro in Madrid and London, bike in Amsterdam, whatever is quickest on a
 * semester ticket in Berlin. They are honest to about five minutes, which is
 * the resolution at which the answer changes a decision.
 * ============================================================================
 */

const CHECKED = "2026-09-07";

/** Every trait at once, positionally, so a row cannot silently omit one. */
function traits(
  nightlife: TraitBand,
  quiet: TraitBand,
  groceries: TraitBand,
  transport: TraitBand,
  studentDensity: TraitBand,
  green: TraitBand,
  eatingOut: TraitBand,
): Record<NeighbourhoodTrait, TraitBand> {
  return { nightlife, quiet, groceries, transport, studentDensity, green, eatingOut };
}

type Editorial = Omit<Neighbourhood, "lat" | "lng" | "wikidataId">;

const EDITORIAL: readonly Editorial[] = [
  /* --- Madrid ------------------------------------------------------------ */
  {
    slug: "malasana",
    citySlug: "madrid",
    name: "Malasaña",
    character: "Loud, central, and the reason your Thursday costs more than you planned.",
    commuteMinutes: { ucm: 20, upm: 22, uam: 45, uc3m: 45 },
    rent: { room: [550, 750], studio: [1000, 1350], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(4, 0, 2, 4, 3, 1, 4),
  },
  {
    slug: "lavapies",
    citySlug: "madrid",
    name: "Lavapiés",
    character: "The cheapest central rooms and the best cheap food in the city, in the same streets.",
    commuteMinutes: { ucm: 30, upm: 32, uam: 55, uc3m: 35 },
    rent: { room: [450, 620], studio: [850, 1150], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(3, 1, 3, 4, 3, 1, 4),
  },
  {
    slug: "chamberi",
    citySlug: "madrid",
    name: "Chamberí",
    character: "Quiet, well-connected and grown-up. You will sleep, and you will pay for it.",
    commuteMinutes: { ucm: 18, upm: 20, uam: 40, uc3m: 45 },
    rent: { room: [550, 780], studio: [1000, 1400], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(2, 3, 4, 4, 3, 2, 3),
  },
  {
    slug: "moncloa",
    citySlug: "madrid",
    name: "Moncloa",
    character: "Walk to Complutense. Everyone around you is also a student, for better and worse.",
    commuteMinutes: { ucm: 8, upm: 10, uam: 40, uc3m: 50 },
    rent: { room: [480, 650], studio: [850, 1150], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(3, 2, 3, 4, 4, 3, 2),
  },
  {
    slug: "la-latina",
    citySlug: "madrid",
    name: "La Latina",
    character: "Sunday vermouth territory. Beautiful, central, and short on supermarkets.",
    commuteMinutes: { ucm: 25, upm: 27, uam: 50, uc3m: 40 },
    rent: { room: [500, 700], studio: [900, 1250], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(4, 1, 2, 3, 2, 1, 4),
  },
  {
    slug: "arguelles",
    citySlug: "madrid",
    name: "Argüelles",
    character: "The default student answer in Madrid: close to campus, calm, nothing surprising.",
    commuteMinutes: { ucm: 10, upm: 12, uam: 38, uc3m: 48 },
    rent: { room: [470, 640], studio: [850, 1150], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(2, 3, 3, 4, 4, 3, 2),
  },

  /* --- Barcelona --------------------------------------------------------- */
  {
    slug: "gracia",
    citySlug: "barcelona",
    name: "Gràcia",
    character: "Squares instead of clubs. The most liveable part of the city, and it knows it.",
    commuteMinutes: { ub: 20, upf: 25, upc: 25 },
    rent: { room: [480, 680], studio: [900, 1250], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(3, 2, 3, 3, 4, 2, 4),
  },
  {
    slug: "el-raval",
    citySlug: "barcelona",
    name: "El Raval",
    character: "Cheap, central, never quiet. Five minutes from UB and from everything else.",
    commuteMinutes: { ub: 5, upf: 15, upc: 25 },
    rent: { room: [420, 600], studio: [800, 1100], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(4, 0, 3, 4, 3, 0, 4),
  },
  {
    slug: "poblenou",
    citySlug: "barcelona",
    name: "Poblenou",
    character: "Wide, calm, next to the beach, and slowly becoming the expensive answer.",
    commuteMinutes: { ub: 25, upf: 12, upc: 35 },
    rent: { room: [450, 650], studio: [850, 1200], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(2, 3, 3, 3, 3, 3, 3),
  },
  {
    slug: "sants",
    citySlug: "barcelona",
    name: "Sants",
    character: "Nothing to write home about, which is why the rooms are still affordable.",
    commuteMinutes: { ub: 20, upf: 30, upc: 15 },
    rent: { room: [420, 580], studio: [780, 1050], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(1, 3, 4, 4, 3, 2, 2),
  },
  {
    slug: "el-born",
    citySlug: "barcelona",
    name: "El Born",
    character: "Postcard streets, tourist prices, and the shortest walk to Pompeu Fabra.",
    commuteMinutes: { ub: 12, upf: 10, upc: 30 },
    rent: { room: [500, 700], studio: [950, 1300], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(4, 1, 2, 4, 2, 1, 4),
  },

  /* --- London ------------------------------------------------------------ */
  {
    slug: "bloomsbury",
    citySlug: "london",
    name: "Bloomsbury",
    character: "You can roll out of bed into a UCL lecture. That is the whole pitch and the whole price.",
    commuteMinutes: { ucl: 5, kcl: 15, qmul: 30 },
    rent: { room: [950, 1400], studio: [1600, 2300], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(2, 2, 3, 4, 4, 3, 3),
  },
  {
    slug: "peckham",
    citySlug: "london",
    name: "Peckham",
    character: "The cheapest rooms with a real night out attached. Everything else is a train away.",
    commuteMinutes: { ucl: 40, kcl: 35, qmul: 45 },
    rent: { room: [700, 950], studio: [1200, 1650], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(4, 1, 3, 3, 3, 2, 4),
  },
  {
    slug: "shoreditch",
    citySlug: "london",
    name: "Shoreditch",
    character: "Great if you go out four nights a week. Ruinous if you go out four nights a week.",
    commuteMinutes: { ucl: 25, kcl: 25, qmul: 20 },
    rent: { room: [850, 1200], studio: [1500, 2100], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(4, 0, 3, 4, 3, 1, 4),
  },
  {
    slug: "camden",
    citySlug: "london",
    name: "Camden",
    character: "Music every night, a canal, and the shortest ride to UCL of anywhere fun.",
    commuteMinutes: { ucl: 15, kcl: 25, qmul: 35 },
    rent: { room: [800, 1150], studio: [1400, 1950], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(4, 1, 3, 4, 3, 3, 4),
  },
  {
    slug: "new-cross",
    citySlug: "london",
    name: "New Cross",
    character: "Students everywhere, rent you can survive, and a commute you will feel every morning.",
    commuteMinutes: { ucl: 40, kcl: 30, qmul: 40 },
    rent: { room: [650, 900], studio: [1100, 1500], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(3, 2, 3, 3, 4, 2, 2),
  },

  /* --- Amsterdam --------------------------------------------------------- */
  {
    slug: "de-pijp",
    citySlug: "amsterdam",
    name: "De Pijp",
    character: "The market, the terraces, and ten minutes on a bike to almost everything.",
    commuteMinutes: { uva: 10, vu: 15 },
    rent: { room: [650, 900], studio: [1200, 1650], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(3, 2, 4, 4, 4, 3, 4),
  },
  {
    slug: "oost",
    citySlug: "amsterdam",
    name: "Oost",
    character: "Closest to UvA, greener than the centre, and still findable if you start early.",
    commuteMinutes: { uva: 8, vu: 25 },
    rent: { room: [600, 850], studio: [1100, 1500], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(2, 3, 3, 4, 3, 3, 3),
  },
  {
    slug: "westerpark",
    citySlug: "amsterdam",
    name: "Westerpark",
    character: "A park you will actually use, and enough going on that you never cross the centre.",
    commuteMinutes: { uva: 20, vu: 25 },
    rent: { room: [620, 880], studio: [1150, 1550], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(3, 2, 3, 3, 3, 4, 3),
  },
  {
    slug: "noord",
    citySlug: "amsterdam",
    name: "Noord",
    character: "A free ferry is your commute. Cheaper rooms, and evenings planned around the boat.",
    commuteMinutes: { uva: 25, vu: 35 },
    rent: { room: [500, 750], studio: [950, 1350], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(2, 3, 3, 2, 2, 4, 2),
  },
  {
    slug: "bijlmer",
    citySlug: "amsterdam",
    name: "Bijlmer",
    character: "Where the big student blocks are. The cheapest real option and the least central.",
    commuteMinutes: { uva: 25, vu: 20 },
    rent: { room: [450, 650], studio: [850, 1200], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(1, 3, 3, 3, 3, 3, 2),
  },

  /* --- Berlin ------------------------------------------------------------ */
  {
    slug: "neukolln",
    citySlug: "berlin",
    name: "Neukölln",
    character: "Where most of the people you meet in your first month will turn out to live.",
    commuteMinutes: { hu: 25, fu: 35, tu: 30 },
    rent: { room: [450, 680], studio: [800, 1150], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(4, 1, 3, 3, 4, 2, 4),
  },
  {
    slug: "kreuzberg",
    citySlug: "berlin",
    name: "Kreuzberg",
    character: "The most fun and the least sleep. Rooms go in hours, not days.",
    commuteMinutes: { hu: 20, fu: 35, tu: 25 },
    rent: { room: [500, 720], studio: [900, 1250], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(4, 0, 3, 4, 4, 2, 4),
  },
  {
    slug: "wedding",
    citySlug: "berlin",
    name: "Wedding",
    character: "Still the cheapest inner district. Quiet, unglamorous, twenty minutes from Humboldt.",
    commuteMinutes: { hu: 20, fu: 45, tu: 25 },
    rent: { room: [400, 600], studio: [750, 1050], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(2, 3, 3, 3, 3, 3, 2),
  },
  {
    slug: "friedrichshain",
    citySlug: "berlin",
    name: "Friedrichshain",
    character: "Clubs, cheap food and a lot of other students. A long way from the Freie Universität.",
    commuteMinutes: { hu: 20, fu: 45, tu: 35 },
    rent: { room: [480, 700], studio: [850, 1200], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(4, 1, 3, 4, 4, 2, 4),
  },
  {
    slug: "charlottenburg",
    citySlug: "berlin",
    name: "Charlottenburg",
    character: "Calm, proper supermarkets, and the only sensible answer if you study at TU.",
    commuteMinutes: { hu: 25, fu: 25, tu: 8 },
    rent: { room: [450, 680], studio: [850, 1200], basis: "seed-estimate", checkedOn: CHECKED },
    traits: traits(1, 4, 4, 4, 3, 3, 3),
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Assembly                                                                    */
/* -------------------------------------------------------------------------- */

const GEO = new Map(neighbourhoodGeo.map((row) => [row.slug, row]));

/**
 * The editorial rows above, each joined to its coordinate.
 *
 * Two sources, kept apart on purpose. Everything above is a judgement somebody
 * made and has to maintain — what an area is like, what a room costs there,
 * how long the metro takes. Everything joined here is a fact from Wikidata
 * that no one here gets to have an opinion about. Mixing them into one hand-
 * written table is how a coordinate ends up being "adjusted" to make a result
 * look better.
 *
 * A missing coordinate is not an error. `lat` and `lng` are null and every
 * geographic question about that area answers "I don't know" instead of
 * guessing — which is why this join does not throw the way the city one does.
 */
const WRITTEN: readonly Neighbourhood[] = EDITORIAL.map((area) => {
  const geo = GEO.get(area.slug);
  return {
    ...area,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    wikidataId: geo?.wikidataId ?? null,
  };
});

/**
 * The other seventy-five cities, discovered rather than written.
 *
 * These carry four facts and no judgements: a name, a point, the Wikidata item
 * that vouches for both, and the city they are in. `character`, `rent` and
 * `traits` are null, because those are things a person who lives somewhere
 * knows and a SPARQL query does not, and writing them anyway is the single
 * thing this codebase refuses to do. `commuteMinutes` is empty for the same
 * reason: nobody has timed the journey from Favoriten to a Vienna campus, so
 * `commuteTo` answers null and the ranking leaves commute out entirely.
 *
 * THE SLUG IS PREFIXED WITH THE CITY, and that is not decoration. `slug` is
 * the identity stored in `Profile.areaSlug`, and roughly a dozen of these
 * cities have an area called Centro, Centrum, Zentrum or Old Town. Unprefixed,
 * a student in Turin who set their home area would have been reading
 * Bologna's, silently — the two rows would have been the same row. The
 * importer guarantees uniqueness within a city; the city prefix turns that
 * into uniqueness everywhere, by construction rather than by luck.
 */
const DISCOVERED: readonly Neighbourhood[] = discoveredAreas.map((area) => ({
  slug: `${area.citySlug}-${area.slug}`,
  citySlug: area.citySlug,
  name: area.name,
  character: null,
  commuteMinutes: {},
  rent: null,
  traits: null,
  lat: area.lat,
  lng: area.lng,
  wikidataId: area.wikidataId,
}));

/**
 * Written first, then discovered.
 *
 * Order matters here because `findNeighbourhood` and `getNeighbourhood` both
 * return the first match, so a city that ever gains editorial rows alongside
 * imported ones resolves to the written one — the row with something in it —
 * rather than to whichever came back from Wikidata first.
 */
export const neighbourhoods: readonly Neighbourhood[] = [...WRITTEN, ...DISCOVERED];

/* -------------------------------------------------------------------------- */
/* Lookups                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Indexed rather than scanned.
 *
 * This was a `filter` over the whole table, which was free when the table was
 * twenty-six rows in five cities. It is now around nine hundred rows in
 * eighty, `neighbourhoodsForCity` is called more than once per render on at
 * least two screens, and `areaSlugForPlace` calls it once per place on a page
 * that shows sixty of them. Two module-level maps, built once at import.
 */
const BY_CITY = ((): ReadonlyMap<string, readonly Neighbourhood[]> => {
  const index = new Map<string, Neighbourhood[]>();
  for (const area of neighbourhoods) {
    const rows = index.get(area.citySlug);
    if (rows) rows.push(area);
    else index.set(area.citySlug, [area]);
  }
  return index;
})();

const BY_SLUG = new Map(neighbourhoods.map((area) => [area.slug, area]));

const NONE: readonly Neighbourhood[] = Object.freeze([]);

export function neighbourhoodsForCity(citySlug: string): readonly Neighbourhood[] {
  return BY_CITY.get(citySlug) ?? NONE;
}

export function getNeighbourhood(slug: string): Neighbourhood | undefined {
  return BY_SLUG.get(slug);
}

/**
 * The district names of a city, for anything that shows a list of names.
 *
 * Four screens needed this and four screens each read `City.neighbourhoods` —
 * the hand-written display list that exists for five cities and is empty for
 * the other seventy-five. That is how a public page came to render "Most of
 * Vienna's good evenings happen in  — and almost none of them on the street
 * the guidebook names", with a clause containing nothing, and how the
 * onboarding home step came to show a heading over no chips.
 *
 * `alsoKnownAs` is that hand-written list, passed in rather than imported, so
 * this module stays free of a dependency on the city directory. Registry names
 * come first because they are the ones the rest of the product can reason
 * about — they have a slug, a coordinate and, in five cities, a rent band —
 * and the hand-written extras follow. Deduplicated case- and whitespace-
 * insensitively; "El Born" and "el born " are one district.
 */
export function areaNamesForCity(
  citySlug: string,
  alsoKnownAs: readonly string[] = [],
): readonly string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const name of [...neighbourhoodsForCity(citySlug).map((area) => area.name), ...alsoKnownAs]) {
    const key = name.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/**
 * Find a neighbourhood by the free-text label the rest of the product stores.
 *
 * `Profile.homeArea`, `Campus.area` and `City.neighbourhoods` all hold display
 * names written by hand, and they will keep holding them: rewriting every
 * stored `homeArea` into a slug is a migration that buys nothing, because the
 * strings that would not match are exactly the ones with no row here anyway —
 * someone living in a district nobody has written up. This returns undefined
 * for those, and every caller treats that as "no data" rather than an error.
 */
export function findNeighbourhood(citySlug: string, label: string | null): Neighbourhood | undefined {
  if (!label) return undefined;
  return BY_LABEL.get(`${citySlug}|${normalise(label)}`);
}

/**
 * Every way a stored label might name an area, within its city.
 *
 * Both the normalised display name and the slug, because `Profile.homeArea`
 * holds whatever the student typed or tapped and the two have never been the
 * same string. First writer wins, which is why `neighbourhoods` puts the
 * editorial rows ahead of the imported ones: in a city that has both, a label
 * matching each resolves to the row with something in it.
 */
const BY_LABEL = ((): ReadonlyMap<string, Neighbourhood> => {
  const index = new Map<string, Neighbourhood>();
  for (const area of neighbourhoods) {
    for (const key of [`${area.citySlug}|${normalise(area.name)}`, `${area.citySlug}|${area.slug}`]) {
      if (!index.has(key)) index.set(key, area);
    }
  }
  return index;
})();

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * True while the band is a written estimate rather than a reading from students.
 *
 * False for an area with no band at all -- there is no estimate to caveat, and
 * the interface shows a dash instead of a figure.
 */
export function rentIsEstimated(area: Neighbourhood): boolean {
  return area.rent?.basis === "seed-estimate";
}

/** Door-to-door minutes to one campus, or null when we have no figure for it. */
export function commuteTo(area: Neighbourhood, campusSlug: string | null): number | null {
  if (!campusSlug) return null;
  return area.commuteMinutes[campusSlug] ?? null;
}
