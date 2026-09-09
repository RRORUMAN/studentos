#!/usr/bin/env node
/**
 * ============================================================================
 * CITY GEOGRAPHY IMPORT
 * ----------------------------------------------------------------------------
 * Builds `src/data/cities/geo.generated.ts`: one row per StudentOS city
 * holding the thing the product cannot invent — where the city actually is.
 *
 *   node scripts/import-cities.mjs
 *   node scripts/import-cities.mjs --dry-run
 *
 * WHY THIS EXISTS. Until now a city was a name, a currency and a timezone.
 * That is enough to format a price and enough to say "tonight", and it is not
 * enough to ask any question about the ground: what is near, how far, which
 * way. Every real place lookup in `src/server/places` starts from a centre
 * point and a radius, so a city without coordinates cannot have real places,
 * and a product without real places has to make them up. This file is the
 * bottom of that chain.
 *
 * THE SOURCE is Wikidata, the same endpoint the institution import uses, for
 * the same reasons: machine-readable, stable identifiers, maintained by people
 * other than us, and citable per row. Each city carries the QID it resolved to,
 * so `https://www.wikidata.org/wiki/<wikidataId>` is the provenance for its
 * coordinates and its population.
 *
 * RESOLUTION is two steps and refuses to guess at either. The search API turns
 * a name into candidate entities; a single SPARQL query then keeps only those
 * that are in the expected country and have a coordinate. A name that resolves
 * to nothing, or to two entities in the same country, is reported and left out
 * rather than resolved to whichever came first — a city silently pinned to the
 * wrong continent would send every place query in it somewhere absurd, and it
 * would look like it worked.
 *
 * POPULATION is imported where Wikidata has it and is null where it does not.
 * It is never used to claim a student count.
 *
 * The output is deterministic — sorted by key, one `FETCHED_ON` in the header —
 * so re-running produces an empty diff when nothing upstream moved.
 * ============================================================================
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "data", "cities", "geo.generated.ts");

const SPARQL = "https://query.wikidata.org/sparql";
const SEARCH = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "StudentOS-city-import/1.0 (https://github.com/RRORUMAN/studentos)";

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The cities StudentOS offers, as `key` (the stable identifier used everywhere
 * in the app) to the name and country to resolve.
 *
 * `search` overrides the name sent to Wikidata where the display name is not
 * what the entity is called: "Seville" is an English exonym, and the entity is
 * "Sevilla". Getting this wrong shows up as an unresolved row, not as a wrong
 * one, because the country check runs afterwards.
 *
 * `id` pins the entity. The search API ranks by its own relevance and that
 * ranking moves: Bangkok resolved on one run and on the next the top twelve
 * results for that word were hotels. Pinning adds the QID to the candidate
 * list rather than replacing the checks — it still has to be in the right
 * country and still has to be a settlement — so a pin cannot smuggle in a row
 * the rules would otherwise reject. Only add one for a city the search has
 * actually been observed to lose.
 *
 * This list is the ONLY hand-written part of city geography. Everything below
 * comes from the endpoint.
 */
const CITIES = [
  // Europe
  { key: "madrid", search: "Madrid", country: "Q29" },
  { key: "barcelona", search: "Barcelona", country: "Q29" },
  { key: "valencia", search: "Valencia", country: "Q29" },
  { key: "seville", search: "Sevilla", country: "Q29" },
  { key: "malaga", search: "Málaga", country: "Q29" },
  { key: "bilbao", search: "Bilbao", country: "Q29" },
  { key: "granada", search: "Granada", country: "Q29" },
  { key: "salamanca", search: "Salamanca", country: "Q29" },
  { key: "london", search: "London", country: "Q145" },
  { key: "manchester", search: "Manchester", country: "Q145" },
  { key: "edinburgh", search: "Edinburgh", country: "Q145" },
  { key: "amsterdam", search: "Amsterdam", country: "Q55" },
  { key: "rotterdam", search: "Rotterdam", country: "Q55" },
  { key: "utrecht", search: "Utrecht", country: "Q55" },
  { key: "berlin", search: "Berlin", country: "Q183" },
  { key: "munich", search: "Munich", country: "Q183" },
  { key: "hamburg", search: "Hamburg", country: "Q183" },
  { key: "frankfurt", search: "Frankfurt am Main", country: "Q183" },
  { key: "cologne", search: "Cologne", country: "Q183" },
  { key: "paris", search: "Paris", country: "Q142" },
  { key: "lyon", search: "Lyon", country: "Q142" },
  { key: "toulouse", search: "Toulouse", country: "Q142" },
  { key: "lisbon", search: "Lisbon", country: "Q45" },
  { key: "porto", search: "Porto", country: "Q45" },
  { key: "milan", search: "Milan", country: "Q38" },
  { key: "rome", search: "Rome", country: "Q38" },
  { key: "florence", search: "Florence", country: "Q38" },
  { key: "bologna", search: "Bologna", country: "Q38" },
  { key: "turin", search: "Turin", country: "Q38" },
  { key: "brussels", search: "Brussels", country: "Q31" },
  { key: "vienna", search: "Vienna", country: "Q40" },
  { key: "budapest", search: "Budapest", country: "Q28" },
  { key: "helsinki", search: "Helsinki", country: "Q33" },
  { key: "tallinn", search: "Tallinn", country: "Q191" },
  { key: "copenhagen", search: "Copenhagen", country: "Q35" },
  { key: "stockholm", search: "Stockholm", country: "Q34" },
  { key: "oslo", search: "Oslo", country: "Q20" },
  { key: "warsaw", search: "Warsaw", country: "Q36" },
  { key: "krakow", search: "Kraków", country: "Q36" },
  { key: "prague", search: "Prague", country: "Q213" },
  { key: "dublin", search: "Dublin", country: "Q27" },
  { key: "zurich", search: "Zürich", country: "Q39" },
  { key: "istanbul", search: "Istanbul", country: "Q43" },
  { key: "athens", search: "Athens", country: "Q41" },
  // Americas
  { key: "new-york", search: "New York City", country: "Q30" },
  { key: "boston", search: "Boston", country: "Q30" },
  { key: "chicago", search: "Chicago", country: "Q30" },
  { key: "los-angeles", search: "Los Angeles", country: "Q30" },
  { key: "austin", search: "Austin", country: "Q30" },
  { key: "toronto", search: "Toronto", country: "Q16" },
  { key: "montreal", search: "Montreal", country: "Q16" },
  { key: "vancouver", search: "Vancouver", country: "Q16" },
  { key: "mexico-city", search: "Mexico City", country: "Q96" },
  { key: "sao-paulo", search: "São Paulo", country: "Q155" },
  { key: "buenos-aires", search: "Buenos Aires", country: "Q414" },
  { key: "santiago", search: "Santiago", country: "Q298" },
  { key: "bogota", search: "Bogotá", country: "Q739" },
  // Asia Pacific
  { key: "tokyo", search: "Tokyo", country: "Q17" },
  { key: "seoul", search: "Seoul", country: "Q884" },
  { key: "singapore", search: "Singapore", country: "Q334" },
  { key: "hong-kong", search: "Hong Kong", country: "Q148" },
  { key: "sydney", search: "Sydney", country: "Q408" },
  { key: "melbourne", search: "Melbourne", country: "Q408" },
  { key: "auckland", search: "Auckland", country: "Q664" },
  { key: "bangkok", search: "Bangkok", country: "Q869", id: "Q1861" },
  { key: "kuala-lumpur", search: "Kuala Lumpur", country: "Q833" },
  { key: "delhi", search: "New Delhi", country: "Q668" },
  { key: "bengaluru", search: "Bangalore", country: "Q668" },
  { key: "taipei", search: "Taipei", country: "Q865" },
  // Middle East & Africa
  { key: "dubai", search: "Dubai", country: "Q878" },
  { key: "abu-dhabi", search: "Abu Dhabi", country: "Q878" },
  { key: "doha", search: "Doha", country: "Q846" },
  { key: "tel-aviv", search: "Tel Aviv", country: "Q801" },
  { key: "cairo", search: "Cairo", country: "Q79" },
  { key: "cape-town", search: "Cape Town", country: "Q258" },
  { key: "johannesburg", search: "Johannesburg", country: "Q258" },
  { key: "nairobi", search: "Nairobi", country: "Q114" },
  { key: "lagos", search: "Lagos", country: "Q1033" },
  { key: "accra", search: "Accra", country: "Q117" },
  { key: "casablanca", search: "Casablanca", country: "Q1028" },
];

/* -------------------------------------------------------------------------- */
/* Fetching                                                                    */
/* -------------------------------------------------------------------------- */

async function getJson(url, label) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`${label} returned ${response.status} ${response.statusText}`);
  }
  return response.json();
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
 * Coordinates, population, country, label and cityhood for a set of QIDs.
 *
 * `P625` is the coordinate, `P1082` the population, `P17` the country. A city
 * with several population statements (a census series) comes back several
 * times; the caller keeps the largest, which is the most recent census for
 * every city that grows and is stated as such rather than inferred as a date.
 *
 * `isPlace` is the field that matters most and the reason this query is not
 * simply "has a coordinate". Searching Wikidata for "Madrid" returns the city,
 * the province and the autonomous community; searching for "São Paulo" returns
 * the city and the state, and the state's coordinate is 250 km inland from it.
 * Every one of those parents has a coordinate and a larger population, so any
 * rule that prefers the biggest number picks the wrong one and picks it
 * silently.
 *
 * THREE CLASSES, NOT ONE, and the reason is worth writing down because the
 * obvious version of this check is wrong. "Is it a city" (Q515) rejects
 * Madrid, Valencia, Bilbao, Granada, Bologna, Seville and Manchester, which
 * Wikidata classes as municipalities and not as cities. "Is it not an
 * administrative division" rejects Berlin, Hamburg and Vienna, which are
 * city-states and therefore first-level divisions of their countries. The
 * union of city, human settlement and municipality accepts all of those and
 * still rejects every parent: the Community of Madrid, the Province of
 * Bologna and the State of São Paulo are none of the three, and neither is
 * Madrid-Barajas Airport or Valencia CF, which the name search also returns.
 */
async function describe(ids) {
  const values = ids.map((id) => `wd:${id}`).join(" ");
  const query = `
    SELECT ?city ?coord ?population ?country ?label ?isPlace WHERE {
      VALUES ?city { ${values} }
      ?city wdt:P625 ?coord .
      ?city wdt:P17 ?country .
      OPTIONAL { ?city wdt:P1082 ?population . }
      OPTIONAL { ?city rdfs:label ?label . FILTER(lang(?label) = "en") }
      BIND(
        EXISTS { ?city wdt:P31/wdt:P279* wd:Q515 } ||
        EXISTS { ?city wdt:P31/wdt:P279* wd:Q486972 } ||
        EXISTS { ?city wdt:P31/wdt:P279* wd:Q15284 }
        AS ?isPlace
      )
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

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

async function resolve() {
  /* One search per city, then ONE SPARQL call for every candidate at once. The
     endpoint is a shared public resource; eighty small queries where one large
     one will do is the behaviour that gets an importer rate-limited. */
  const searched = [];
  for (const city of CITIES) {
    const found = await candidates(city.search);
    const ids = city.id ? [...new Set([city.id, ...found])] : found;
    searched.push({ ...city, ids });
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  const all = [...new Set(searched.flatMap((city) => city.ids))];
  const rows = [];
  const CHUNK = 120;
  for (let i = 0; i < all.length; i += CHUNK) {
    rows.push(...(await describe(all.slice(i, i + CHUNK))));
  }

  /**
   * QID -> facts, folded across the several rows each entity produces.
   *
   * An entity comes back once per combination of its multi-valued properties,
   * and TWO of them are multi-valued in ways that matter. Population is a
   * census series, so the largest is kept — the most recent for any city that
   * grows, and stated rather than inferred from a date qualifier this query
   * does not ask for. Country is the one that actually bit: Bangkok has five
   * `P17` statements, Thailand plus four historical kingdoms, and keeping the
   * first row meant the city was sometimes recorded as being in the Ayutthaya
   * Kingdom and then failed the country check. So countries are a set, and a
   * city matches if the expected country is anywhere in it.
   */
  const facts = new Map();
  for (const row of rows) {
    const id = qid(row.city.value);
    const point = parsePoint(row.coord.value);
    if (!point) continue;
    const population = row.population ? Number(row.population.value) : null;
    const held = facts.get(id);
    if (held) {
      if (population && (held.population ?? 0) < population) held.population = population;
      held.countries.add(qid(row.country.value));
      continue;
    }
    facts.set(id, {
      ...point,
      population,
      countries: new Set([qid(row.country.value)]),
      label: row.label?.value ?? null,
      isPlace: row.isPlace?.value === "true",
    });
  }

  const resolved = [];
  const problems = [];

  for (const city of searched) {
    const inCountry = city.ids
      .map((id) => ({ id, fact: facts.get(id) }))
      .filter((candidate) => candidate.fact && candidate.fact.countries.has(city.country));

    /* Cities only. Nothing falls back to a non-city: a province standing in
       for its capital is exactly the error this filter exists to catch, and
       accepting one because nothing better was found reintroduces it. */
    const matches = inCountry.filter((candidate) => candidate.fact.isPlace);

    if (matches.length === 0) {
      const near = inCountry.map((candidate) => `${candidate.id} ${candidate.fact.label ?? "?"}`);
      problems.push(
        `${city.key}: no city, settlement or municipality in ${city.country}` +
          (near.length ? ` — non-city candidates were ${near.join(", ")}` : ""),
      );
      continue;
    }

    /* Among genuine cities, an exact English label match wins: "Santiago" is a
       city in Chile several times over and only one of them is called exactly
       that. Population breaks the remaining ties, which is the right rule once
       administrative parents are already out. */
    const wanted = city.search.toLowerCase();
    matches.sort(
      (a, b) =>
        Number((b.fact.label ?? "").toLowerCase() === wanted) -
          Number((a.fact.label ?? "").toLowerCase() === wanted) ||
        (b.fact.population ?? 0) - (a.fact.population ?? 0),
    );
    const best = matches[0];

    resolved.push({
      key: city.key,
      wikidataId: best.id,
      label: best.fact.label,
      lat: best.fact.lat,
      lng: best.fact.lng,
      population: best.fact.population,
    });
  }

  resolved.sort((a, b) => a.key.localeCompare(b.key));
  return { resolved, problems };
}

/* -------------------------------------------------------------------------- */
/* Emit                                                                        */
/* -------------------------------------------------------------------------- */

function render(rows, fetchedOn) {
  const body = rows
    .map(
      (row) =>
        `  { key: ${JSON.stringify(row.key)}, wikidataId: ${JSON.stringify(row.wikidataId)}, ` +
        `lat: ${row.lat}, lng: ${row.lng}, population: ${row.population ?? "null"} },`,
    )
    .join("\n");

  return `/**
 * ============================================================================
 * CITY GEOGRAPHY
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-cities.mjs
 *
 * Source      Wikidata, via https://query.wikidata.org/sparql
 * Properties  P625 coordinate location, P1082 population, P17 country
 * Fetched     ${fetchedOn}
 * Rows        ${rows.length}
 *
 * \`wikidataId\` is the provenance for every figure in the row:
 * https://www.wikidata.org/wiki/<id>
 *
 * The coordinate is the city's own point — its centre as Wikidata records it,
 * not a campus and not a downtown that somebody chose. Place search uses it as
 * the origin of a radius, so it only has to be right to within a district.
 *
 * \`population\` is the municipality. It is shown as a city fact and is never
 * used to imply how many students are on StudentOS.
 * ============================================================================
 */

export type CityGeo = {
  key: string;
  /** https://www.wikidata.org/wiki/<id> */
  wikidataId: string;
  lat: number;
  lng: number;
  /** Municipality population where Wikidata states one. */
  population: number | null;
};

export const CITY_GEO_FETCHED_ON = "${fetchedOn}";

export const cityGeo: readonly CityGeo[] = [
${body}
];
`;
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

const dryRun = process.argv.includes("--dry-run");

const { resolved, problems } = await resolve();

for (const problem of problems) console.error(`  ! ${problem}`);

/* Print what each key resolved to. This is the review step: the file below is
   generated, so the only chance anybody has to notice that "Santiago" became
   the wrong Santiago is right here. */
for (const row of resolved) {
  console.log(
    `  ${row.key.padEnd(14)} ${row.wikidataId.padEnd(11)} ${String(row.lat).padStart(9)},${String(row.lng).padStart(10)}  ${row.label ?? ""}`,
  );
}

if (resolved.length < CITIES.length) {
  console.error(`\nResolved ${resolved.length} of ${CITIES.length}.`);
  /* A missing city is a real failure: the app would keep a city with no
     coordinate and every place query in it would have no origin. Refuse to
     write a partial file rather than leave one behind that looks complete. */
  if (!dryRun) {
    console.error("Refusing to write a partial file. Fix the search terms above and re-run.");
    process.exit(1);
  }
}

const fetchedOn = new Date().toISOString().slice(0, 10);
const output = render(resolved, fetchedOn);

if (dryRun) {
  console.log(output.slice(0, 2_000));
  console.log(`\n(dry run) ${resolved.length} cities`);
} else {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, output, "utf8");
  console.log(`Wrote ${resolved.length} cities to ${OUT}`);
}
