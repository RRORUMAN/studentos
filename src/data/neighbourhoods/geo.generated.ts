/**
 * ============================================================================
 * NEIGHBOURHOOD GEOGRAPHY
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-neighbourhoods.mjs
 *
 * Source      Wikidata, via https://query.wikidata.org/sparql
 * Properties  P625 coordinate location, P131 located in the administrative
 *             territorial entity (transitively, as the containment check)
 * Fetched     2026-09-09
 * Rows        25
 *
 * `wikidataId` is the provenance for the coordinate:
 * https://www.wikidata.org/wiki/<id>
 *
 * The point is the neighbourhood's own centre as Wikidata records it. It is
 * used to decide which area a real place sits in — nearest centre, inside a
 * radius — so it has to be right to within a few hundred metres, and a
 * neighbourhood missing from this file simply never claims a place.
 * ============================================================================
 */

export type NeighbourhoodGeo = {
  slug: string;
  citySlug: string;
  wikidataId: string;
  lat: number;
  lng: number;
};

export const neighbourhoodGeo: readonly NeighbourhoodGeo[] = [
  { slug: "arguelles", citySlug: "madrid", wikidataId: "Q64874", lat: 40.42916, lng: -3.71885 },
  { slug: "bijlmer", citySlug: "amsterdam", wikidataId: "Q128498", lat: 52.31861, lng: 4.96528 },
  { slug: "bloomsbury", citySlug: "london", wikidataId: "Q150120", lat: 51.52306, lng: -0.125 },
  { slug: "camden", citySlug: "london", wikidataId: "Q149836", lat: 51.541, lng: -0.1433 },
  { slug: "chamberi", citySlug: "madrid", wikidataId: "Q1763370", lat: 40.43279, lng: -3.69719 },
  { slug: "charlottenburg", citySlug: "berlin", wikidataId: "Q162049", lat: 52.51667, lng: 13.3 },
  { slug: "de-pijp", citySlug: "amsterdam", wikidataId: "Q163319", lat: 52.3531, lng: 4.8961 },
  { slug: "el-born", citySlug: "barcelona", wikidataId: "Q3049748", lat: 41.38556, lng: 2.18417 },
  { slug: "el-raval", citySlug: "barcelona", wikidataId: "Q1758503", lat: 41.38, lng: 2.16861 },
  { slug: "friedrichshain", citySlug: "berlin", wikidataId: "Q317056", lat: 52.51583, lng: 13.45417 },
  { slug: "gracia", citySlug: "barcelona", wikidataId: "Q852697", lat: 41.40667, lng: 2.15806 },
  { slug: "kreuzberg", citySlug: "berlin", wikidataId: "Q308928", lat: 52.4875, lng: 13.3833 },
  { slug: "lavapies", citySlug: "madrid", wikidataId: "Q2566034", lat: 40.4085, lng: -3.701 },
  { slug: "malasana", citySlug: "madrid", wikidataId: "Q2521757", lat: 40.42513, lng: -3.70392 },
  { slug: "moncloa", citySlug: "madrid", wikidataId: "Q2017682", lat: 40.43515, lng: -3.71876 },
  { slug: "neukolln", citySlug: "berlin", wikidataId: "Q4071168", lat: 52.48333, lng: 13.45 },
  { slug: "new-cross", citySlug: "london", wikidataId: "Q369361", lat: 51.4709, lng: -0.0337 },
  { slug: "noord", citySlug: "amsterdam", wikidataId: "Q478607", lat: 52.39111, lng: 4.91833 },
  { slug: "oost", citySlug: "amsterdam", wikidataId: "Q478608", lat: 52.35279, lng: 4.93065 },
  { slug: "peckham", citySlug: "london", wikidataId: "Q2690524", lat: 51.4714, lng: -0.0625 },
  { slug: "poblenou", citySlug: "barcelona", wikidataId: "Q1404773", lat: 41.39917, lng: 2.20389 },
  { slug: "sants", citySlug: "barcelona", wikidataId: "Q2476184", lat: 41.37528, lng: 2.13611 },
  { slug: "shoreditch", citySlug: "london", wikidataId: "Q1027127", lat: 51.526, lng: -0.078 },
  { slug: "wedding", citySlug: "berlin", wikidataId: "Q675187", lat: 52.55, lng: 13.3425 },
  { slug: "westerpark", citySlug: "amsterdam", wikidataId: "Q931069", lat: 52.38611, lng: 4.87639 },
];
