#!/usr/bin/env node
/**
 * ============================================================================
 * NEIGHBOURHOOD GEOGRAPHY IMPORT
 * ----------------------------------------------------------------------------
 * Builds `src/data/neighbourhoods/geo.generated.ts`: a coordinate for each
 * neighbourhood the product has an editorial row for.
 *
 *   node scripts/import-neighbourhoods.mjs
 *   node scripts/import-neighbourhoods.mjs --dry-run
 *
 * WHY THIS EXISTS, which is a story about a bug. The product used to decide
 * which neighbourhood a place was in by reading the place's own NAME: "Ramen
 * counter, Malasaña" was in Malasaña because the text after the comma said so.
 * That worked for the twenty-five invented places, every one of which was
 * written in that shape. It works for exactly none of the real ones, because
 * OpenStreetMap calls a supermarket "Mercadona". So the moment the invented
 * places were deleted, `areaSlugForPlace` began returning null for everything,
 * the city graph lost every place-to-area edge, and the section on the place
 * page that says "in Malasaña, 20 minutes from your campus" quietly stopped
 * rendering. Nothing failed. A test that skipped itself reported green.
 *
 * The fix has to be geographic, and geography needs coordinates, and a
 * coordinate is exactly the kind of fact this codebase refuses to invent. So
 * it comes from the same place the cities' coordinates come from.
 *
 * THE SOURCE is Wikidata. Each row carries the QID it resolved to, so
 * `https://www.wikidata.org/wiki/<wikidataId>` is the provenance.
 *
 * RESOLUTION IS HARDER THAN IT WAS FOR CITIES. Searching "Wedding" returns the
 * marriage ceremony. "Oost" and "Noord" are Dutch for east and north. "Camden"
 * is a district in London and a city in New Jersey. And the near misses are
 * worse than the far ones: the first run of this script resolved Chamberí to
 * Chamberí District Hall, Poblenou to Poblenou station and Friedrichshain to
 * Volkspark Friedrichshain — each of them real, in the right city, carrying a
 * coordinate a kilometre or two from the truth, and top of the search results.
 *
 * So TWO GATES, then RANKING:
 *
 *   GATE 1 — CLASS. The entity must be a neighbourhood, quarter, suburb,
 *   district, town or human settlement (`AREA_CLASSES`, walked up `P279*`).
 *   This is what rejects the district hall, the station and the park.
 *
 *   GATE 2 — DISTANCE. Its point must be within `MAX_KM` of the city centre.
 *   This is what rejects Camden, New Jersey.
 *
 *   RANK — containment first (`P131+` reaching the city), then an exact name
 *   match, then the number of Wikipedias that write about it, then proximity.
 *   Containment RANKS rather than GATES because gating on it deleted all five
 *   Amsterdam neighbourhoods: Dutch stadsdelen hang off the province, not the
 *   municipality. Sitelinks break the remaining ties, and break them well —
 *   it is what picks Neukölln the quarter over Neukölln the borough.
 *
 * A name that passes neither gate is REPORTED AND LEFT OUT, and every choice
 * between survivors is printed with its runners-up so the decision can be
 * argued with. A neighbourhood with no coordinate degrades: it keeps its
 * editorial row, its rent estimates and its commute figures, and simply never
 * claims a place is inside it. That is the honest failure, and it is why the
 * generated type allows a missing row where the city one does not.
 *
 * ONE ROW IS DELIBERATELY MISSING. Madrid's "La Latina" is a colloquial area
 * inside the Centro district; Wikidata has the metro station and it has the
 * Latina DISTRICT, which is a different part of the city several kilometres
 * southwest. Resolving to either would be wrong, so La Latina has no
 * coordinate and no place will ever be said to be in it.
 *
 * The output is deterministic — sorted by slug, one `FETCHED_ON` in the header
 * — so re-running produces an empty diff when nothing upstream moved.
 * ============================================================================
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "data", "neighbourhoods", "geo.generated.ts");

const SPARQL = "https://query.wikidata.org/sparql";
const SEARCH = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "StudentOS-neighbourhood-import/1.0 (https://github.com/RRORUMAN/studentos)";

/** How far from the city centre a neighbourhood may be and still be believed. */
const MAX_KM = 20;

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The cities that have neighbourhood rows, with the entities a neighbourhood
 * of theirs is allowed to sit inside.
 *
 * London needs two. Wikidata models the CITY of London's urban area as Q84 and
 * the administrative region as Greater London (Q23306), and a borough's P131
 * chain reaches the second and not the first. Accepting only Q84 rejects every
 * London neighbourhood, which is the sort of thing that looks like the data
 * being missing rather than the query being wrong.
 */
const CITIES = {
  madrid: { centre: { lat: 40.41694, lng: -3.70333 }, containers: ["Q2807"] },
  barcelona: { centre: { lat: 41.3825, lng: 2.17694 }, containers: ["Q1492"] },
  london: { centre: { lat: 51.50722, lng: -0.1275 }, containers: ["Q84", "Q23306"] },
  amsterdam: { centre: { lat: 52.36667, lng: 4.88333 }, containers: ["Q727"] },
  berlin: { centre: { lat: 52.51667, lng: 13.38333 }, containers: ["Q64"] },
};

/**
 * Every neighbourhood in `src/data/neighbourhoods.ts`, by slug.
 *
 * `search` is the name as Wikidata is most likely to know it, which is not
 * always the name the product shows. Where the product's name is a colloquial
 * short form the official one is given here and the row keeps its own label.
 */
const NEIGHBOURHOODS = [
  { slug: "malasana", city: "madrid", search: "Malasaña" },
  { slug: "lavapies", city: "madrid", search: "Lavapiés" },
  { slug: "chamberi", city: "madrid", search: "Chamberí" },
  { slug: "moncloa", city: "madrid", search: "Moncloa-Aravaca" },
  { slug: "la-latina", city: "madrid", search: "La Latina" },
  { slug: "arguelles", city: "madrid", search: "Argüelles" },
  { slug: "gracia", city: "barcelona", search: "Gràcia" },
  { slug: "el-raval", city: "barcelona", search: "El Raval" },
  { slug: "poblenou", city: "barcelona", search: "Poblenou" },
  { slug: "sants", city: "barcelona", search: "Sants" },
  { slug: "el-born", city: "barcelona", search: "El Born" },
  { slug: "bloomsbury", city: "london", search: "Bloomsbury" },
  { slug: "peckham", city: "london", search: "Peckham" },
  { slug: "shoreditch", city: "london", search: "Shoreditch" },
  { slug: "camden", city: "london", search: "Camden Town" },
  { slug: "new-cross", city: "london", search: "New Cross" },
  { slug: "de-pijp", city: "amsterdam", search: "De Pijp" },
  { slug: "oost", city: "amsterdam", search: "Amsterdam-Oost" },
  { slug: "westerpark", city: "amsterdam", search: "Westerpark" },
  { slug: "noord", city: "amsterdam", search: "Amsterdam-Noord" },
  { slug: "bijlmer", city: "amsterdam", search: "Bijlmermeer" },
  { slug: "neukolln", city: "berlin", search: "Neukölln" },
  { slug: "kreuzberg", city: "berlin", search: "Kreuzberg" },
  { slug: "wedding", city: "berlin", search: "Wedding" },
  { slug: "friedrichshain", city: "berlin", search: "Friedrichshain" },
  { slug: "charlottenburg", city: "berlin", search: "Charlottenburg" },
];

/* -------------------------------------------------------------------------- */
/* Fetching                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fetch JSON, retrying the failures that are the service having a moment.
 *
 * The public query service answers 429 and 502 under load, and a single 502
 * during one run dropped Wedding from the output — which is the worst possible
 * failure for a generated file, because the diff looks like a deliberate
 * removal and nothing says otherwise. Three attempts with a widening pause.
 */
async function getJson(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(60_000),
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`${label} returned ${response.status} ${response.statusText}`);
      }
      if (!response.ok) {
        throw new Error(`${label} returned ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw lastError;
}

/** Candidate QIDs for a name, best first, from the entity search API. */
async function candidates(name) {
  const url = new URL(SEARCH);
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", name);
  url.searchParams.set("language", "en");
  url.searchParams.set("uselang", "en");
  url.searchParams.set("type", "item");
  url.searchParams.set("limit", "12");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const body = await getJson(url, `search(${name})`);
  return (body.search ?? []).map((hit) => hit.id);
}

/**
 * The classes an answer is allowed to be, and the single most important filter
 * in this file.
 *
 * Without it the first run resolved Chamberí to Chamberí DISTRICT HALL, Poblenou
 * to Poblenou STATION, Peckham to PECKHAM RYE RAILWAY STATION and Friedrichshain
 * to VOLKSPARK FRIEDRICHSHAIN — a building, two stations and a park, each of
 * them genuinely inside the right city, genuinely carrying a coordinate, and
 * genuinely the top search hit for the name. Every one would have pinned an
 * entire neighbourhood to a point a kilometre or two off and looked fine.
 *
 * Five classes because the same kind of area is modelled differently by
 * country: Spain files barrios as neighbourhoods, Berlin's Ortsteile are
 * quarters, London's are suburbs or districts, and Amsterdam's stadsdelen are
 * districts. `P279*` walks up the subclass chain, so a national-specific class
 * like "Ortsteil of Berlin" still matches through its parent.
 */
const AREA_CLASSES = [
  "Q123705", // neighborhood
  "Q2983893", // quarter
  "Q188509", // suburb
  "Q149621", // district
  "Q3957", // town — a few former villages absorbed by a city are still filed so
  "Q486972", // human settlement — the catch-all London and Madrid use for areas
];

/**
 * Coordinate, label, class fitness, containment and sitelink count for a set
 * of QIDs.
 *
 * `?isArea` is the gate; `?inCity` and `?links` are ranking signals. Sitelinks
 * are the tie-break that needs explaining: when two entities both pass every
 * gate and share a name — "Shoreditch" the area and "Shoreditch" the former
 * civil parish, say — the one written up in twenty languages is the one people
 * mean, and the one with two is a historical footnote. It is a proxy for
 * prominence, and it is a better one than "whichever the search API ranked
 * first", which is what picked the district hall.
 */
async function describe(ids, containers) {
  const values = ids.map((id) => `wd:${id}`).join(" ");
  const inCity = containers.map((qid) => `EXISTS { ?n wdt:P131+ wd:${qid} }`).join(" || ");
  const isArea = AREA_CLASSES.map((qid) => `EXISTS { ?n wdt:P31/wdt:P279* wd:${qid} }`).join(" || ");
  const query = `
    SELECT ?n ?coord ?label ?inCity ?isArea ?links WHERE {
      VALUES ?n { ${values} }
      ?n wdt:P625 ?coord .
      OPTIONAL { ?n rdfs:label ?label . FILTER(lang(?label) = "en") }
      OPTIONAL { ?n wikibase:sitelinks ?links . }
      BIND(${inCity} AS ?inCity)
      BIND(${isArea} AS ?isArea)
    }`;
  const url = new URL(SPARQL);
  url.searchParams.set("format", "json");
  url.searchParams.set("query", query);
  const body = await getJson(url, "sparql");
  return body.results.bindings;
}

/** "Point(-3.703333 40.416944)" -> { lat, lng }, rounded to ~1 m. */
function parsePoint(wkt) {
  const match = /^Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/.exec(wkt);
  if (!match) return null;
  return { lng: round(Number(match[1])), lat: round(Number(match[2])) };
}

const round = (value) => Math.round(value * 100_000) / 100_000;
const qid = (uri) => uri.split("/").pop();

/** Lowercase, strip accents and punctuation, so "Gràcia" matches "Gracia". */
const fold = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\u0300-\u036f]", "g"), "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Great-circle distance in kilometres. */
function distanceKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

async function resolve() {
  const rows = [];
  const problems = [];

  for (const entry of NEIGHBOURHOODS) {
    const city = CITIES[entry.city];
    if (!city) {
      problems.push(`${entry.slug}: no city config for "${entry.city}"`);
      continue;
    }

    let ids;
    try {
      ids = await candidates(entry.search);
    } catch (error) {
      problems.push(`${entry.slug}: search failed — ${error.message}`);
      continue;
    }

    if (ids.length === 0) {
      problems.push(`${entry.slug}: "${entry.search}" matched nothing`);
      continue;
    }

    let bindings;
    try {
      bindings = await describe(ids, city.containers);
    } catch (error) {
      problems.push(`${entry.slug}: sparql failed — ${error.message}`);
      continue;
    }

    /**
     * THE GATE is class and distance. Containment is a ranking signal rather
     * than a gate, and that is a change the first run forced: every one of
     * Amsterdam's five neighbourhoods failed `P131+ → Q727`, because Dutch
     * stadsdelen hang off the province in Wikidata rather than off the
     * municipality. Gating on containment deleted a whole city's worth of
     * correct answers. An entity that is a neighbourhood, is called De Pijp,
     * and is four kilometres from the centre of Amsterdam is De Pijp, whatever
     * its administrative parent says.
     */
    const accepted = [];
    for (const binding of bindings) {
      if (binding.isArea?.value !== "true") continue;
      const point = parsePoint(binding.coord.value);
      if (!point) continue;
      const km = distanceKm(city.centre, point);
      if (km > MAX_KM) continue;
      accepted.push({
        id: qid(binding.n.value),
        label: binding.label?.value ?? entry.search,
        point,
        km,
        inCity: binding.inCity?.value === "true",
        links: Number(binding.links?.value ?? 0),
        exact: fold(binding.label?.value ?? "") === fold(entry.search),
      });
    }

    const unique = [...new Map(accepted.map((row) => [row.id, row])).values()];
    if (unique.length === 0) {
      problems.push(
        `${entry.slug}: "${entry.search}" matched ${bindings.length} entities, none of which is ` +
          `an area within ${MAX_KM} km of ${entry.city}`,
      );
      continue;
    }

    /* Administratively inside the city, then named exactly what was asked for,
       then the most written-about, then the closest. Each step only breaks a
       tie the one above it left. */
    unique.sort(
      (a, b) =>
        Number(b.inCity) - Number(a.inCity) ||
        Number(b.exact) - Number(a.exact) ||
        b.links - a.links ||
        a.km - b.km,
    );

    if (unique.length > 1) {
      const runnersUp = unique
        .slice(1, 4)
        .map((row) => `${row.id} ${row.label} (${row.links} wikis)`)
        .join(", ");
      problems.push(
        `${entry.slug}: chose ${unique[0].id} ${unique[0].label} (${unique[0].links} wikis) over ${runnersUp}`,
      );
    }

    const best = unique[0];
    rows.push({
      slug: entry.slug,
      citySlug: entry.city,
      wikidataId: best.id,
      lat: best.point.lat,
      lng: best.point.lng,
    });
    console.log(
      `  ${entry.slug.padEnd(16)} ${best.id.padEnd(10)} ${best.label.padEnd(28)} ` +
        `${best.km.toFixed(1)} km from centre`,
    );
  }

  return { rows: rows.sort((a, b) => a.slug.localeCompare(b.slug)), problems };
}

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

function render(rows) {
  const today = new Date().toISOString().slice(0, 10);
  const body = rows
    .map(
      (row) =>
        `  { slug: ${JSON.stringify(row.slug)}, citySlug: ${JSON.stringify(row.citySlug)}, ` +
        `wikidataId: ${JSON.stringify(row.wikidataId)}, lat: ${row.lat}, lng: ${row.lng} },`,
    )
    .join("\n");

  return `/**
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
 * Fetched     ${today}
 * Rows        ${rows.length}
 *
 * \`wikidataId\` is the provenance for the coordinate:
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
${body}
];
`;
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

const dryRun = process.argv.includes("--dry-run");

console.log(`Resolving ${NEIGHBOURHOODS.length} neighbourhoods against Wikidata…\n`);
const { rows, problems } = await resolve();

console.log(`\nResolved ${rows.length}/${NEIGHBOURHOODS.length}.`);

if (problems.length > 0) {
  console.log(`\n${problems.length} thing(s) to look at:`);
  for (const problem of problems) console.log(`  - ${problem}`);
}

if (dryRun) {
  console.log("\n--dry-run: nothing written.");
  process.exit(problems.length > 0 ? 1 : 0);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, render(rows), "utf8");
console.log(`\nWrote ${OUT}`);

/* A missing neighbourhood degrades rather than breaks, so an unresolved name
   is not a failure exit — but it is worth a non-zero code in CI, where this
   script is only ever run deliberately. */
process.exit(rows.length === 0 ? 1 : 0);
