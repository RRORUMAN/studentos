import { neighbourhoodGeo } from "@/data/neighbourhoods/geo.generated";
import type { Neighbourhood, NeighbourhoodTrait, TraitBand } from "./types";

/**
 * ============================================================================
 * NEIGHBOURHOODS
 * ----------------------------------------------------------------------------
 * The five deep cities, as places you could live rather than as names.
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
export const neighbourhoods: readonly Neighbourhood[] = EDITORIAL.map((area) => {
  const geo = GEO.get(area.slug);
  return {
    ...area,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    wikidataId: geo?.wikidataId ?? null,
  };
});

/* -------------------------------------------------------------------------- */
/* Lookups                                                                     */
/* -------------------------------------------------------------------------- */

export function neighbourhoodsForCity(citySlug: string): readonly Neighbourhood[] {
  return neighbourhoods.filter((area) => area.citySlug === citySlug);
}

export function getNeighbourhood(slug: string): Neighbourhood | undefined {
  return neighbourhoods.find((area) => area.slug === slug);
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
  const wanted = normalise(label);
  return neighbourhoods.find(
    (area) => area.citySlug === citySlug && (normalise(area.name) === wanted || area.slug === wanted),
  );
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** True while the band is a written estimate rather than a reading from students. */
export function rentIsEstimated(area: Neighbourhood): boolean {
  return area.rent.basis === "seed-estimate";
}

/** Door-to-door minutes to one campus, or null when we have no figure for it. */
export function commuteTo(area: Neighbourhood, campusSlug: string | null): number | null {
  if (!campusSlug) return null;
  return area.commuteMinutes[campusSlug] ?? null;
}
