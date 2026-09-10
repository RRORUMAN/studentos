#!/usr/bin/env node
/**
 * ============================================================================
 * AREA DISCOVERY
 * ----------------------------------------------------------------------------
 * Builds `src/data/neighbourhoods/areas.generated.ts`: the districts of every
 * city the product covers, discovered rather than hand-listed.
 *
 *   node scripts/import-areas.mjs
 *   node scripts/import-areas.mjs --dry-run
 *   node scripts/import-areas.mjs --city=vienna,krakow
 *
 * WHAT THIS IS FOR. Five cities have hand-written neighbourhood rows — rent
 * bands, character lines, seven trait scores, commute minutes to each campus.
 * Every other city has nothing, and "nothing" is what a student in Vienna saw:
 * a Where to live screen that knew the city existed and could not name a
 * single part of it. The honest fix is not to invent hundreds more
 * character lines. It is to import the part that is a fact — the area exists,
 * it is called this, it is at this point — and to leave every judgement null
 * until somebody who lives there fills it in.
 *
 * So a row from here carries a name, a coordinate and a QID, and nothing else.
 * `rent`, `character` and `traits` are null, the interface prints "not known
 * yet" rather than a number, and the ranking scores an unknown signal 0.5 —
 * neutral — so an area is never punished for being new to us.
 *
 * IT DOES NOT TOUCH THE FIVE DEEP CITIES. Madrid, Barcelona, London,
 * Amsterdam and Berlin keep exactly the curated set they have. Pouring twelve
 * raw Wikidata districts into Madrid would not improve the screen that
 * already works; it would bury six good rows under twelve blank ones. Those
 * cities are the shape the rest are growing towards, not a gap to be filled.
 *
 * RUN IT AFTER ADDING CITIES. The coverage list went from 80 to 261 and this
 * was not re-run, so 181 cities showed a Where-to-live screen explaining that
 * Wikidata had no districts it could stand behind — about cities Wikidata had
 * never been asked about. Adding a city is not finished until this has run.
 *
 * ----------------------------------------------------------------------------
 * HOW A CANDIDATE IS JUDGED, and why each gate is here
 *
 *   FIND     Everything within `RADIUS_KM` of the city's own point, via the
 *            `wikibase:around` geo service. Radius rather than containment,
 *            because containment alone finds nothing in Amsterdam: Dutch
 *            stadsdelen hang off the province in Wikidata, so `P131+ → Q727`
 *            is false for De Pijp, the Jordaan and every other real answer.
 *
 *   GATE 1   CLASS. Neighbourhood, quarter, suburb or district, walked up
 *            `P279*`. Deliberately NOT "human settlement": that class is the
 *            catch-all that lets in villages, hamlets and — see below — worse.
 *
 *   GATE 2   NOT AN ADMINISTRATIVE PEER OR PARENT. A ten-kilometre circle
 *            drawn on Kraków also contains Kraków County, and one drawn on
 *            Amsterdam contains the municipality of Diemen. Neither is a part
 *            of the city. Cities, municipalities, counties, powiats and
 *            provinces are refused by class, and anything the city itself sits
 *            inside is refused outright.
 *
 *   GATE 3   STILL EXISTS. No `P576` dissolution date, no `P582` end time on
 *            the instance-of statement.
 *
 *   GATE 4   NOT A SITE OF ATROCITY OR CONFINEMENT. This gate exists because
 *            of what the first run produced. Ranked third and fourth among
 *            "places to live in Kraków" were the Kraków Ghetto and the
 *            Kraków-Płaszów concentration camp — both filed in Wikidata under
 *            classes that walk up to "district", both carrying a coordinate,
 *            both perfectly plausible to a scoring function. Shipping either
 *            one to a student under the heading "Where to live" is not a data
 *            quality bug. So the gate is doubled: by class, and then again by
 *            name, and the name half is kept even though substring matching is
 *            crude, because the cost of a false positive here is one missing
 *            district and the cost of a false negative is unbearable.
 *
 *   GATE 5   INSIDE THE CITY — adaptively. Where `P131+` reaches the city for
 *            a decent number of candidates, that country models containment
 *            the way we expect and it becomes a hard gate; this is what
 *            removes Kraków County. Where it reaches almost nothing, the
 *            country models it some other way and distance carries the
 *            decision alone. The threshold is `CONTAINMENT_WORKS`.
 *
 *   RANK     Sitelinks, then proximity. The number of Wikipedias that write
 *            about an area is the best available proxy for whether anyone
 *            means it when they say the name — it is what puts Jordaan above
 *            Blaauwlakenblok, a genuine block of central Amsterdam that no
 *            student has ever asked about.
 *
 *   CAP      `PER_CITY` rows. A ranked list that runs past a dozen stops being
 *            a list of neighbourhoods and starts being a gazetteer.
 *
 * An English label is required. An area with none has no international
 * presence worth speaking of, and this product's whole audience is arriving
 * from somewhere else; the count dropped for that reason is reported per city
 * rather than hidden.
 *
 * The output is deterministic — sorted by city then slug, one `FETCHED_ON` in
 * the header — so re-running produces an empty diff when nothing upstream
 * moved.
 * ============================================================================
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CITY_GEO = join(ROOT, "src", "data", "cities", "geo.generated.ts");
const OUT = join(ROOT, "src", "data", "neighbourhoods", "areas.generated.ts");

const SPARQL = "https://query.wikidata.org/sparql";
const USER_AGENT = "StudentOS-area-import/1.0 (https://github.com/RRORUMAN/studentos)";

/** How far from the city's point an area may be and still be that city's. */
const RADIUS_KM = 10;

/** Areas kept per city, best first. */
const PER_CITY = 12;

/**
 * How many candidates must reach the city through `P131+` before containment
 * is believed to be modelled at all in that country.
 *
 * Three, not one. One is a single well-maintained item in a country that
 * otherwise hangs its districts off a province, and gating on it would delete
 * every correct answer but that one.
 */
const CONTAINMENT_WORKS = 3;

/** The five cities with hand-written rows, which this script leaves alone. */
const EDITORIAL_CITIES = new Set(["madrid", "barcelona", "london", "amsterdam", "berlin"]);

/* -------------------------------------------------------------------------- */
/* Classes                                                                     */
/* -------------------------------------------------------------------------- */

/** What an area is allowed to be. */
const AREA_CLASSES = [
  "Q123705", // neighborhood
  "Q2983893", // quarter
  "Q188509", // suburb
  "Q149621", // district
];

/**
 * What an area may not be, walked up `P279*`.
 *
 * The first block is administrative units at or above the city's own level —
 * peers and parents that a circle drawn on a map inevitably catches. The
 * second block is Gate 4, and the comment above it is the whole reason this
 * script is not thirty lines shorter.
 */
const DENIED_CLASSES = [
  "Q515", // city
  "Q15284", // municipality
  "Q1549591", // big city
  "Q5119", // capital
  "Q3957", // town
  "Q532", // village
  "Q28575", // county
  "Q247073", // powiat
  "Q34876", // province
  "Q2039348", // municipality of the Netherlands
  "Q262166", // municipality of Germany

  /* Not an area a person lives in, however Wikidata files it. New York's first
     run came back with Broadway theatre and Fifth Avenue among its twelve
     "neighbourhoods"; both reach "district" up the subclass chain, and neither
     is somewhere to look for a room. */
  "Q79007", // street
  "Q34442", // road
  "Q174782", // square / plaza
  "Q22698", // park
  "Q24354", // theater building
  "Q41176", // building
  "Q12280", // bridge
  "Q55488", // railway station

  /* Sites of confinement and mass murder. Wikidata files several of these
     under classes that walk up to "district", which is how the Kraków Ghetto
     came third in a list headed "Where to live". */
  "Q2583015", // ghetto in Nazi-occupied Europe
  "Q29089", // ghetto
  "Q152081", // concentration camp
  "Q328468", // extermination camp
  "Q40357", // prison
  "Q1054760", // internment camp
];

/**
 * The second half of Gate 4: names that disqualify whatever the classes say.
 *
 * Substring matching on a name is a blunt instrument and normally the wrong
 * tool. It is the right one here, because the failure it guards against is not
 * a wrong number on a card — it is a memorial site offered to a nineteen year
 * old as somewhere to find a flat. A district wrongly excluded by this list
 * costs one row. The row this list exists to exclude costs considerably more.
 */
const DENIED_NAMES = [
  "ghetto",
  "concentration camp",
  "extermination camp",
  "death camp",
  "internment",
  "labour camp",
  "labor camp",
  "prison",
  "penitentiary",
  "cemetery",
  "memorial",
  "mass grave",
  "refugee camp",
];

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The cities, read out of the generated city geography rather than restated.
 *
 * A regex over a generated file is not elegant, but it is the only way to read
 * a TypeScript module from a plain `.mjs` script without a build step, and the
 * file it reads is machine-written in a fixed shape. If this ever stops
 * matching, it throws rather than silently importing nothing.
 */
async function loadCities() {
  const source = await readFile(CITY_GEO, "utf8");
  const row =
    /\{\s*key:\s*"([^"]+)",\s*wikidataId:\s*"(Q\d+)",\s*lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)/g;
  const cities = [];
  for (const match of source.matchAll(row)) {
    cities.push({ key: match[1], qid: match[2], lat: Number(match[3]), lng: Number(match[4]) });
  }
  if (cities.length === 0) {
    throw new Error(`no city rows matched in ${CITY_GEO} — the generated shape changed`);
  }
  return cities;
}

/* -------------------------------------------------------------------------- */
/* Fetching                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ask the query service, retrying what is the service having a moment.
 *
 * The geo service is slow on a dense city — Vienna takes the better part of a
 * minute — and answers 429 and 502 under load. A city that fails all three
 * attempts is reported and skipped rather than taking the run down with it,
 * because the alternative is a generated file that loses seventy-four cities
 * because the seventy-fifth timed out.
 */
async function query(sparql, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const url = new URL(SPARQL);
      url.searchParams.set("format", "json");
      url.searchParams.set("query", sparql);
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`${label} returned ${response.status} ${response.statusText}`);
      }
      const body = await response.json();
      return body.results.bindings;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 3_000));
    }
  }
  throw lastError;
}

function areaQuery(city) {
  const allowed = AREA_CLASSES.map((id) => `wd:${id}`).join(" ");
  const denied = DENIED_CLASSES.map((id) => `wd:${id}`).join(" ");
  return `
SELECT DISTINCT ?n ?name ?links ?dist ?inCity WHERE {
  SERVICE wikibase:around {
    ?n wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${city.lng} ${city.lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${RADIUS_KM}" .
    bd:serviceParam wikibase:distance ?dist .
  }
  VALUES ?class { ${allowed} }
  ?n wdt:P31/wdt:P279* ?class .
  FILTER(?n != wd:${city.qid})
  FILTER NOT EXISTS { VALUES ?denied { ${denied} } ?n wdt:P31/wdt:P279* ?denied }
  FILTER NOT EXISTS { ?n wdt:P576 ?dissolved }
  FILTER NOT EXISTS { ?n p:P31/pq:P582 ?ended }
  FILTER NOT EXISTS { wd:${city.qid} wdt:P131+ ?n }
  ?n wikibase:sitelinks ?links .
  ?n rdfs:label ?name . FILTER(lang(?name) = "en")
  BIND(EXISTS { ?n wdt:P131+ wd:${city.qid} } AS ?inCity)
}
ORDER BY DESC(?links) LIMIT 60`;
}

/**
 * The area's own point, which the around service does not hand back directly.
 *
 * `?coord` is bound inside `SERVICE wikibase:around` and projecting it there
 * multiplies rows for any item with more than one coordinate statement, so it
 * is fetched in a second, cheap query over the QIDs that survived.
 */
async function pointsFor(ids, label) {
  if (ids.length === 0) return new Map();
  const values = ids.map((id) => `wd:${id}`).join(" ");
  const bindings = await query(
    `SELECT ?n (SAMPLE(?c) AS ?coord) WHERE { VALUES ?n { ${values} } ?n wdt:P625 ?c } GROUP BY ?n`,
    `points(${label})`,
  );
  const points = new Map();
  for (const binding of bindings) {
    const point = parsePoint(binding.coord.value);
    if (point) points.set(qid(binding.n.value), point);
  }
  return points;
}

/* -------------------------------------------------------------------------- */
/* Shaping                                                                     */
/* -------------------------------------------------------------------------- */

/** "Point(-3.703333 40.416944)" -> { lat, lng }, rounded to ~1 m. */
function parsePoint(wkt) {
  const match = /^Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/.exec(wkt);
  if (!match) return null;
  return { lng: round(Number(match[1])), lat: round(Number(match[2])) };
}

const round = (value) => Math.round(value * 100_000) / 100_000;
const qid = (uri) => uri.split("/").pop();

/* Written as escapes rather than as the characters themselves: a combining
   mark typed literally into a source file is invisible in every diff it ever
   appears in, and this repository has already lost a regex that way. */
const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

/** Lowercase and strip accents, for name comparison. */
const fold = (value) => value.toLowerCase().normalize("NFD").replace(COMBINING, "").trim();

/**
 * A URL-safe slug, unique within its city.
 *
 * Two different QIDs really can share a display name — Kraków has two entities
 * both labelled "Kraków Ghetto" — so a collision suffixes rather than
 * overwrites. An empty slug (a name with no Latin characters at all) returns
 * null and the row is dropped: an area addressed by an empty string would
 * match every lookup, which is the same trap the city slug guard exists for.
 */
function slugify(name, taken) {
  const base = fold(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (base.length === 0) return null;
  let slug = base;
  let suffix = 2;
  while (taken.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  taken.add(slug);
  return slug;
}

/** Gate 4's name half. */
const isDeniedName = (name) => {
  const folded = fold(name);
  return DENIED_NAMES.some((term) => folded.includes(term));
};

/**
 * Drop Wikidata's disambiguation suffix: "Kypseli, Athens" -> "Kypseli".
 *
 * Wikidata labels an area with its city attached whenever the bare name is
 * ambiguous across the world, which is most of the time — Johannesburg came
 * back as Booysens, Johannesburg / Denver, Johannesburg / Dewetshof,
 * Johannesburg, and a student reading a list of neighbourhoods in Johannesburg
 * does not need to be told nine times which city they are in.
 *
 * Only the city's own name is removed, and only from the end. "Frankfurt am
 * Main" survives, because the suffix must follow a comma; and a genuine area
 * called after the city — Johannesburg's own inner district is labelled exactly
 * "Johannesburg" — has no comma and is left alone.
 */
function stripCitySuffix(name, cityKey) {
  const comma = name.lastIndexOf(",");
  if (comma <= 0) return name;
  const head = name.slice(0, comma).trim();
  const tail = fold(name.slice(comma + 1));
  if (head.length === 0) return name;
  return tail === fold(cityKey.replace(/-/g, " ")) ? head : name;
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

async function areasFor(city) {
  const bindings = await query(areaQuery(city), `areas(${city.key})`);

  const candidates = bindings.map((binding) => ({
    id: qid(binding.n.value),
    name: stripCitySuffix(binding.name.value, city.key),
    links: Number(binding.links?.value ?? 0),
    km: Number(binding.dist?.value ?? 0),
    inCity: binding.inCity?.value === "true",
  }));

  /* Gate 5, decided by what this country's data actually looks like rather
     than by what we hoped it would look like. */
  const contained = candidates.filter((row) => row.inCity).length;
  const gateOnContainment = contained >= CONTAINMENT_WORKS;
  const kept = candidates.filter((row) => (gateOnContainment ? row.inCity : true));

  const refusedByName = kept.filter((row) => isDeniedName(row.name));
  const clean = kept.filter((row) => !isDeniedName(row.name));

  /* One row per QID, then one per name: Wikidata carries duplicates of the
     same area under different items, and two rows called the same thing in one
     city is a bug the student sees. Highest sitelinks wins, which is the same
     rule the ranking uses. */
  clean.sort((a, b) => b.links - a.links || a.km - b.km);
  const seenIds = new Set();
  const seenNames = new Set();
  const unique = [];
  for (const row of clean) {
    const name = fold(row.name);
    if (seenIds.has(row.id) || seenNames.has(name)) continue;
    seenIds.add(row.id);
    seenNames.add(name);
    unique.push(row);
  }

  const chosen = unique.slice(0, PER_CITY);
  const points = await pointsFor(
    chosen.map((row) => row.id),
    city.key,
  );

  const taken = new Set();
  const rows = [];
  const dropped = [];
  for (const row of chosen) {
    const point = points.get(row.id);
    if (!point) {
      dropped.push(`${row.name} (${row.id}) has no coordinate on a second look`);
      continue;
    }
    const slug = slugify(row.name, taken);
    if (!slug) {
      dropped.push(`${row.name} (${row.id}) does not reduce to a slug`);
      continue;
    }
    rows.push({
      slug,
      citySlug: city.key,
      name: row.name,
      wikidataId: row.id,
      lat: point.lat,
      lng: point.lng,
    });
  }

  return {
    rows: rows.sort((a, b) => a.slug.localeCompare(b.slug)),
    notes: [
      ...(gateOnContainment ? [] : [`containment not modelled here (${contained} of ${candidates.length}); distance alone decided`]),
      ...refusedByName.map((row) => `REFUSED BY NAME: ${row.name} (${row.id})`),
      ...dropped,
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

function render(rows, cityCount) {
  const today = new Date().toISOString().slice(0, 10);
  const body = rows
    .map(
      (row) =>
        `  { slug: ${JSON.stringify(row.slug)}, citySlug: ${JSON.stringify(row.citySlug)}, ` +
        `name: ${JSON.stringify(row.name)}, wikidataId: ${JSON.stringify(row.wikidataId)}, ` +
        `lat: ${row.lat}, lng: ${row.lng} },`,
    )
    .join("\n");

  return `/**
 * ============================================================================
 * DISCOVERED AREAS
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-areas.mjs
 *
 * Source      Wikidata, via https://query.wikidata.org/sparql
 * Properties  P625 coordinate location, P31 instance of, P131 located in the
 *             administrative territorial entity, sitelink count
 * Fetched     ${today}
 * Rows        ${rows.length} across ${cityCount} cities
 *
 * WHAT A ROW HERE IS, AND WHAT IT IS NOT. It is four facts: this area exists,
 * it is called this, it is at this point, and here is the Wikidata item that
 * says so. It is not a rent band, a character line or a trait score — those
 * are judgements, they belong to people who live there, and the five cities
 * that have them have them because somebody wrote them.
 *
 * So an area from this file reaches the product with \`rent\`, \`character\` and
 * \`traits\` all null. The ranking scores an unknown signal 0.5 rather than 0,
 * so a new area is never punished for being new; the interface prints what it
 * does not know instead of a number it does not have.
 *
 * \`wikidataId\` is the provenance: https://www.wikidata.org/wiki/<id>
 * ============================================================================
 */

export type DiscoveredArea = {
  slug: string;
  citySlug: string;
  /** The area's English Wikidata label. */
  name: string;
  /** https://www.wikidata.org/wiki/<id> */
  wikidataId: string;
  lat: number;
  lng: number;
};

export const AREAS_FETCHED_ON = "${today}";

export const discoveredAreas: readonly DiscoveredArea[] = [
${body}
];
`;
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

const dryRun = process.argv.includes("--dry-run");
const only = process.argv
  .find((arg) => arg.startsWith("--city="))
  ?.slice("--city=".length)
  .split(",")
  .filter(Boolean);

const all = await loadCities();
const cities = all
  .filter((city) => !EDITORIAL_CITIES.has(city.key))
  .filter((city) => (only ? only.includes(city.key) : true));

console.log(
  `Discovering areas in ${cities.length} cities ` +
    `(${EDITORIAL_CITIES.size} editorial cities left alone)…\n`,
);

const rows = [];
const problems = [];
let done = 0;

for (const city of cities) {
  done += 1;
  try {
    const result = await areasFor(city);
    rows.push(...result.rows);
    console.log(
      `  [${String(done).padStart(2)}/${cities.length}] ${city.key.padEnd(18)} ` +
        `${String(result.rows.length).padStart(2)} areas  ` +
        result.rows
          .slice(0, 4)
          .map((row) => row.name)
          .join(", "),
    );
    for (const note of result.notes) problems.push(`${city.key}: ${note}`);
    if (result.rows.length === 0) problems.push(`${city.key}: no area survived the gates`);
  } catch (error) {
    /* One city failing must not cost the other seventy-four. */
    problems.push(`${city.key}: FAILED — ${error.message}`);
    console.log(`  [${String(done).padStart(2)}/${cities.length}] ${city.key.padEnd(18)} failed`);
  }
}

const covered = new Set(rows.map((row) => row.citySlug));
console.log(`\n${rows.length} areas across ${covered.size}/${cities.length} cities.`);

if (problems.length > 0) {
  console.log(`\n${problems.length} thing(s) to look at:`);
  for (const problem of problems) console.log(`  - ${problem}`);
}

if (dryRun) {
  console.log("\n--dry-run: nothing written.");
  process.exit(0);
}

/* ---- a scoped run must not delete the cities it did not visit -------------
   `render()` writes the whole file from `rows`, and `rows` holds only the
   cities this run covered. With no `--city` that is every city and replacing
   the file is exactly right. With `--city=vienna` it is one, and writing the
   file would silently drop the other two hundred and fifty — turning "refresh
   Vienna" into "delete everywhere else", with no error and a plausible-looking
   diff.

   So a scoped run merges: it replaces the rows of the cities it visited and
   keeps the rest as they were. A city that was visited and returned nothing is
   still cleared, because that is a real result about that city. */
if (only) {
  const visited = new Set(cities.map((city) => city.key));
  const { discoveredAreas: previous } = await import(pathToFileURL(OUT).href).catch(() => ({
    discoveredAreas: [],
  }));
  const kept = previous.filter((row) => !visited.has(row.citySlug));
  console.log(`\nScoped run: keeping ${kept.length} rows from ${new Set(kept.map((r) => r.citySlug)).size} cities not visited.`);
  rows.push(...kept);
}

rows.sort((a, b) => a.citySlug.localeCompare(b.citySlug) || a.slug.localeCompare(b.slug));
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, render(rows, new Set(rows.map((row) => row.citySlug)).size), "utf8");
console.log(`\nWrote ${OUT}`);

/* A city with no areas degrades — it shows what it always showed. An empty
   file does not, so that alone is a failure. */
process.exit(rows.length === 0 ? 1 : 0);
