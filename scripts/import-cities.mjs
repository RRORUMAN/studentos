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
  { key: "zaragoza", search: "Zaragoza", country: "Q29" },
  { key: "murcia", search: "Murcia", country: "Q29" },
  { key: "alicante", search: "Alicante", country: "Q29" },
  { key: "santiago-de-compostela", search: "Santiago de Compostela", country: "Q29" },
  { key: "pamplona", search: "Pamplona", country: "Q29" },
  /* Two Spanish entities carry this name — the municipality and the city that
     is its capital — so the search is ambiguous by the script's own rule and
     it correctly refuses to pick. Pinned to the municipality, which is the
     unit every other population figure in this file uses. */
  { key: "cordoba", search: "Córdoba", country: "Q29", id: "Q5818" },
  { key: "valladolid", search: "Valladolid", country: "Q29" },
  { key: "oviedo", search: "Oviedo", country: "Q29" },
  { key: "san-sebastian", search: "Donostia-San Sebastián", country: "Q29" },
  { key: "palma", search: "Palma de Mallorca", country: "Q29" },
  { key: "birmingham", search: "Birmingham", country: "Q145" },
  { key: "leeds", search: "Leeds", country: "Q145" },
  { key: "glasgow", search: "Glasgow", country: "Q145" },
  { key: "liverpool", search: "Liverpool", country: "Q145" },
  { key: "bristol", search: "Bristol", country: "Q145" },
  { key: "nottingham", search: "Nottingham", country: "Q145" },
  { key: "sheffield", search: "Sheffield", country: "Q145" },
  { key: "newcastle", search: "Newcastle upon Tyne", country: "Q145" },
  { key: "oxford", search: "Oxford", country: "Q145" },
  { key: "cambridge", search: "Cambridge", country: "Q145" },
  { key: "cardiff", search: "Cardiff", country: "Q145" },
  { key: "coventry", search: "Coventry", country: "Q145" },
  { key: "southampton", search: "Southampton", country: "Q145" },
  { key: "aberdeen", search: "Aberdeen", country: "Q145" },
  { key: "belfast", search: "Belfast", country: "Q145" },
  { key: "york", search: "York", country: "Q145" },
  { key: "bath", search: "Bath, Somerset", country: "Q145" },
  { key: "exeter", search: "Exeter", country: "Q145" },
  { key: "leicester", search: "Leicester", country: "Q145" },
  { key: "brighton", search: "Brighton and Hove", country: "Q145" },
  { key: "groningen", search: "Groningen", country: "Q55" },
  { key: "leiden", search: "Leiden", country: "Q55" },
  { key: "eindhoven", search: "Eindhoven", country: "Q55" },
  { key: "delft", search: "Delft", country: "Q55" },
  { key: "maastricht", search: "Maastricht", country: "Q55" },
  { key: "tilburg", search: "Tilburg", country: "Q55" },
  { key: "nijmegen", search: "Nijmegen", country: "Q55" },
  { key: "enschede", search: "Enschede", country: "Q55" },
  { key: "wageningen", search: "Wageningen", country: "Q55" },
  { key: "the-hague", search: "The Hague", country: "Q55" },
  { key: "heidelberg", search: "Heidelberg", country: "Q183" },
  { key: "leipzig", search: "Leipzig", country: "Q183" },
  { key: "dresden", search: "Dresden", country: "Q183" },
  { key: "stuttgart", search: "Stuttgart", country: "Q183" },
  { key: "dusseldorf", search: "Düsseldorf", country: "Q183" },
  { key: "aachen", search: "Aachen", country: "Q183" },
  { key: "bonn", search: "Bonn", country: "Q183" },
  { key: "freiburg", search: "Freiburg im Breisgau", country: "Q183" },
  { key: "munster", search: "Münster", country: "Q183" },
  { key: "gottingen", search: "Göttingen", country: "Q183" },
  { key: "tubingen", search: "Tübingen", country: "Q183" },
  { key: "mannheim", search: "Mannheim", country: "Q183" },
  { key: "karlsruhe", search: "Karlsruhe", country: "Q183" },
  { key: "nuremberg", search: "Nuremberg", country: "Q183" },
  { key: "bremen", search: "Bremen", country: "Q183" },
  { key: "hannover", search: "Hannover", country: "Q183" },
  { key: "bochum", search: "Bochum", country: "Q183" },
  { key: "darmstadt", search: "Darmstadt", country: "Q183" },
  { key: "jena", search: "Jena", country: "Q183" },
  { key: "konstanz", search: "Konstanz", country: "Q183" },
  { key: "marseille", search: "Marseille", country: "Q142" },
  { key: "bordeaux", search: "Bordeaux", country: "Q142" },
  { key: "lille", search: "Lille", country: "Q142" },
  { key: "montpellier", search: "Montpellier", country: "Q142" },
  { key: "nantes", search: "Nantes", country: "Q142" },
  { key: "strasbourg", search: "Strasbourg", country: "Q142" },
  { key: "grenoble", search: "Grenoble", country: "Q142" },
  { key: "nice", search: "Nice", country: "Q142" },
  { key: "rennes", search: "Rennes", country: "Q142" },
  { key: "aix-en-provence", search: "Aix-en-Provence", country: "Q142" },
  { key: "naples", search: "Naples", country: "Q38" },
  { key: "padua", search: "Padua", country: "Q38" },
  { key: "pisa", search: "Pisa", country: "Q38" },
  { key: "venice", search: "Venice", country: "Q38" },
  { key: "genoa", search: "Genoa", country: "Q38" },
  { key: "bari", search: "Bari", country: "Q38" },
  { key: "catania", search: "Catania", country: "Q38" },
  { key: "pavia", search: "Pavia", country: "Q38" },
  { key: "perugia", search: "Perugia", country: "Q38" },
  { key: "siena", search: "Siena", country: "Q38" },
  { key: "trento", search: "Trento", country: "Q38" },
  { key: "coimbra", search: "Coimbra", country: "Q45" },
  { key: "braga", search: "Braga", country: "Q45" },
  { key: "aveiro", search: "Aveiro", country: "Q45" },
  { key: "leuven", search: "Leuven", country: "Q31" },
  { key: "ghent", search: "Ghent", country: "Q31" },
  { key: "antwerp", search: "Antwerp", country: "Q31" },
  { key: "liege", search: "Liège", country: "Q31" },
  { key: "louvain-la-neuve", search: "Louvain-la-Neuve", country: "Q31" },
  { key: "graz", search: "Graz", country: "Q40" },
  { key: "innsbruck", search: "Innsbruck", country: "Q40" },
  { key: "salzburg", search: "Salzburg", country: "Q40" },
  { key: "linz", search: "Linz", country: "Q40" },
  { key: "geneva", search: "Geneva", country: "Q39" },
  { key: "lausanne", search: "Lausanne", country: "Q39" },
  { key: "bern", search: "Bern", country: "Q39" },
  { key: "basel", search: "Basel", country: "Q39" },
  { key: "st-gallen", search: "St. Gallen", country: "Q39" },
  { key: "lugano", search: "Lugano", country: "Q39" },
  { key: "cork", search: "Cork", country: "Q27" },
  { key: "galway", search: "Galway", country: "Q27" },
  { key: "limerick", search: "Limerick", country: "Q27" },
  { key: "maynooth", search: "Maynooth", country: "Q27" },
  { key: "aarhus", search: "Aarhus", country: "Q35" },
  { key: "odense", search: "Odense", country: "Q35" },
  { key: "aalborg", search: "Aalborg", country: "Q35" },
  { key: "gothenburg", search: "Gothenburg", country: "Q34" },
  { key: "lund", search: "Lund", country: "Q34" },
  { key: "uppsala", search: "Uppsala", country: "Q34" },
  { key: "malmo", search: "Malmö", country: "Q34" },
  { key: "linkoping", search: "Linköping", country: "Q34" },
  { key: "umea", search: "Umeå", country: "Q34" },
  { key: "bergen", search: "Bergen", country: "Q20" },
  { key: "trondheim", search: "Trondheim", country: "Q20" },
  { key: "tromso", search: "Tromsø", country: "Q20" },
  { key: "tampere", search: "Tampere", country: "Q33" },
  { key: "turku", search: "Turku", country: "Q33" },
  { key: "oulu", search: "Oulu", country: "Q33" },
  { key: "jyvaskyla", search: "Jyväskylä", country: "Q33" },
  { key: "tartu", search: "Tartu", country: "Q191" },
  { key: "wroclaw", search: "Wrocław", country: "Q36" },
  { key: "poznan", search: "Poznań", country: "Q36" },
  { key: "gdansk", search: "Gdańsk", country: "Q36" },
  { key: "lodz", search: "Łódź", country: "Q36" },
  { key: "lublin", search: "Lublin", country: "Q36" },
  { key: "katowice", search: "Katowice", country: "Q36" },
  { key: "brno", search: "Brno", country: "Q213" },
  { key: "olomouc", search: "Olomouc", country: "Q213" },
  { key: "ostrava", search: "Ostrava", country: "Q213" },
  { key: "debrecen", search: "Debrecen", country: "Q28" },
  { key: "szeged", search: "Szeged", country: "Q28" },
  { key: "pecs", search: "Pécs", country: "Q28" },
  { key: "thessaloniki", search: "Thessaloniki", country: "Q41" },
  { key: "patras", search: "Patras", country: "Q41" },
  { key: "heraklion", search: "Heraklion", country: "Q41" },
  { key: "ankara", search: "Ankara", country: "Q43" },
  { key: "izmir", search: "İzmir", country: "Q43" },
  { key: "antalya", search: "Antalya", country: "Q43" },
  { key: "bucharest", search: "Bucharest", country: "Q218" },
  { key: "cluj-napoca", search: "Cluj-Napoca", country: "Q218" },
  { key: "timisoara", search: "Timișoara", country: "Q218" },
  { key: "iasi", search: "Iași", country: "Q218" },
  { key: "brasov", search: "Brașov", country: "Q218" },
  { key: "sofia", search: "Sofia", country: "Q219" },
  { key: "plovdiv", search: "Plovdiv", country: "Q219" },
  { key: "varna", search: "Varna", country: "Q219" },
  { key: "zagreb", search: "Zagreb", country: "Q224" },
  { key: "split", search: "Split", country: "Q224" },
  { key: "rijeka", search: "Rijeka", country: "Q224" },
  { key: "osijek", search: "Osijek", country: "Q224" },
  { key: "belgrade", search: "Belgrade", country: "Q403" },
  { key: "novi-sad", search: "Novi Sad", country: "Q403" },
  { key: "nis", search: "Niš", country: "Q403" },
  { key: "bratislava", search: "Bratislava", country: "Q214" },
  { key: "kosice", search: "Košice", country: "Q214" },
  { key: "ljubljana", search: "Ljubljana", country: "Q215" },
  { key: "maribor", search: "Maribor", country: "Q215" },
  { key: "vilnius", search: "Vilnius", country: "Q37" },
  { key: "kaunas", search: "Kaunas", country: "Q37" },
  { key: "klaipeda", search: "Klaipėda", country: "Q37" },
  { key: "riga", search: "Riga", country: "Q211" },
  { key: "kyiv", search: "Kyiv", country: "Q212" },
  { key: "lviv", search: "Lviv", country: "Q212" },
  { key: "kharkiv", search: "Kharkiv", country: "Q212" },
  { key: "nicosia", search: "Nicosia", country: "Q229" },
  { key: "limassol", search: "Limassol", country: "Q229" },
  { key: "valletta", search: "Valletta", country: "Q233" },
  { key: "msida", search: "Msida", country: "Q233" },
  { key: "luxembourg-city", search: "Luxembourg City", country: "Q32" },
  { key: "reykjavik", search: "Reykjavík", country: "Q189" },
  { key: "sarajevo", search: "Sarajevo", country: "Q225" },
  { key: "banja-luka", search: "Banja Luka", country: "Q225" },
  { key: "mostar", search: "Mostar", country: "Q225" },
  { key: "skopje", search: "Skopje", country: "Q221" },
  { key: "tirana", search: "Tirana", country: "Q222" },
  { key: "podgorica", search: "Podgorica", country: "Q236" },
  { key: "chisinau", search: "Chișinău", country: "Q217" },
  { key: "minsk", search: "Minsk", country: "Q184" },
  { key: "andorra-la-vella", search: "Andorra la Vella", country: "Q228" },
  { key: "vaduz", search: "Vaduz", country: "Q347" },
  { key: "monaco", search: "Monaco", country: "Q235" },
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

/**
 * A courtesy gap between calls to a public endpoint nobody is paying for.
 *
 * The search API is one call per city, and the city list is no longer the
 * eighty it was written for: at 261 cities an unthrottled run walks into
 * HTTP 429 somewhere in the middle, and because the failure lands on whichever
 * city happened to be in flight, the same run fails at a different city each
 * time. That looked like a data problem with an innocent city and was really a
 * rate problem with us.
 */
const COURTESY_MS = 120;
let nextSlot = 0;

async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + COURTESY_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch JSON, backing off when the endpoint asks us to.
 *
 * 429 and 5xx are retried with exponential backoff, honouring `Retry-After`
 * when the server sends one; every other status fails immediately, because a
 * 404 will still be a 404 in four seconds and retrying it just makes the run
 * slower and ruder. The retry budget is small on purpose — if Wikidata is
 * genuinely down, the honest outcome is a failed import an operator can see,
 * not a script that hangs for an hour and then writes a partial file.
 */
async function getJson(url, label, attempt = 0) {
  await throttle();

  let response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    /* A timeout or a dropped connection is worth one more try for the same
       reason a 429 is: it says nothing about whether the data exists. */
    if (attempt < 4) {
      await sleep(2 ** attempt * 1000);
      return getJson(url, label, attempt + 1);
    }
    throw error;
  }

  const retryable = response.status === 429 || response.status >= 500;
  if (retryable && attempt < 4) {
    const header = Number(response.headers.get("retry-after"));
    const backoff = Number.isFinite(header) && header > 0 ? header * 1000 : 2 ** attempt * 1000;
    process.stdout.write(`  ${label}: ${response.status}, retrying in ${Math.round(backoff / 1000)}s\n`);
    await sleep(backoff);
    return getJson(url, label, attempt + 1);
  }

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
