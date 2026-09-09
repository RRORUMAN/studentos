#!/usr/bin/env node
/**
 * ============================================================================
 * INSTITUTION IMPORT
 * ----------------------------------------------------------------------------
 * Builds `src/data/institutions/<cc>.generated.ts` from a real, citable,
 * machine-readable source, one country at a time.
 *
 *   node scripts/import-institutions.mjs ES
 *   node scripts/import-institutions.mjs ES FR DE
 *   node scripts/import-institutions.mjs ES --dry-run
 *
 * WHY NOT THE OFFICIAL SPANISH REGISTRY. RUCT -- the Registro de
 * Universidades, Centros y Titulos -- is the authority, and it was the first
 * thing checked. It is a JSP form over iso-8859-15 HTML with no export, no
 * API and no bulk file: `https://www.educacion.gob.es/ruct/consultauniversidades`
 * answers 200 and returns a page, not data. Turning that into a dataset means
 * writing a scraper against a government form, which breaks silently the first
 * time a hidden field is renamed and would then quietly serve a stale registry
 * to students. This codebase already refused that trade once, for job feeds.
 *
 * So the source is WIKIDATA, queried through its public SPARQL endpoint. It is
 * machine-readable, versioned, has a stable identifier per institution, and --
 * the reason it beats a hand-typed list -- it is maintained by people other
 * than us. Every row carries the QID it came from, so any claim in the product
 * can be traced back to `https://www.wikidata.org/wiki/<sourceId>`.
 *
 * WHAT THIS DELIBERATELY DOES NOT IMPORT. Coordinates come across; campus
 * NEIGHBOURHOODS do not. `area` on a campus feeds the commute figures in
 * `src/server/engines/neighbourhood.ts`, and a guessed neighbourhood produces a
 * confident "18 min from campus" derived from nothing. Imported rows therefore
 * have `campusSlug: null` and the product degrades honestly, exactly as it
 * already did for a university typed by hand. Promoting an imported row to a
 * curated one is a human editing `src/data/institutions/curated.ts`.
 *
 * The output is deterministic -- sorted by id, no timestamps beyond the single
 * `fetchedOn` in the header -- so re-running it produces an empty diff when
 * nothing upstream changed, and a reviewable one when something did.
 * ============================================================================
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "data", "institutions");

const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT =
  "StudentOS-institution-import/1.0 (https://github.com/RRORUMAN/studentos)";

/* -------------------------------------------------------------------------- */
/* Countries                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * ISO-3166 alpha-2 to the Wikidata entity for the country, plus the label
 * language to prefer. The label language matters: asking for English gives
 * "Complutense University of Madrid", which is not what is written above the
 * door and not what a student types.
 *
 * Adding a country is one line. That is the whole of the "global architecture"
 * requirement -- nothing downstream of here knows which country it is holding.
 */
const COUNTRIES = {
  ES: { entity: "Q29", lang: "es", name: "Spain", alsoLabels: ["ca", "eu", "gl"] },
  FR: { entity: "Q142", lang: "fr", name: "France" },
  DE: { entity: "Q183", lang: "de", name: "Germany" },
  IT: { entity: "Q38", lang: "it", name: "Italy", alsoLabels: ["de"] },
  PT: { entity: "Q45", lang: "pt", name: "Portugal" },
  NL: { entity: "Q55", lang: "nl", name: "Netherlands" },
  GB: { entity: "Q145", lang: "en", name: "United Kingdom" },
  IE: { entity: "Q27", lang: "en", name: "Ireland" },
  PL: { entity: "Q36", lang: "pl", name: "Poland" },
  CZ: { entity: "Q213", lang: "cs", name: "Czechia" },
  EE: { entity: "Q191", lang: "et", name: "Estonia" },
  FI: { entity: "Q33", lang: "fi", name: "Finland" },
  SE: { entity: "Q34", lang: "sv", name: "Sweden" },
  DK: { entity: "Q35", lang: "da", name: "Denmark" },
  AT: { entity: "Q40", lang: "de", name: "Austria" },
  BE: { entity: "Q31", lang: "nl", name: "Belgium", alsoLabels: ["fr", "de"] },
  HU: { entity: "Q28", lang: "hu", name: "Hungary" },
  GR: { entity: "Q41", lang: "el", name: "Greece" },
};

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Q38723 is "higher education institution", the superclass that covers
 * universities, business schools, polytechnics, hogescholen and art academies
 * without needing one query per legal category.
 *
 * `FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }` drops institutions that
 * have closed. A student cannot enrol at one and it must not sit in the
 * results looking plausible.
 *
 * The region is resolved by walking `P131+` up to whatever the country calls
 * its first-level subdivision (Q10864048) rather than naming the Spanish class
 * directly, which is what lets the same query serve every country above.
 */
function coreQuery({ entity, lang }) {
  return `
SELECT ?item ?name ?enName ?muni ?muniName ?muniType ?upName ?region ?regionName ?typeName ?hqName ?coord ?website ?parent WHERE {
  ?item wdt:P31/wdt:P279* wd:Q38723 ;
        wdt:P17 wd:${entity} .
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
  OPTIONAL {
    ?item wdt:P131 ?muni .
    ?muni rdfs:label ?muniName . FILTER(LANG(?muniName) = "${lang}")
    OPTIONAL { ?muni wdt:P31 ?muniT . ?muniT rdfs:label ?muniType . FILTER(LANG(?muniType) = "en") }
    OPTIONAL { ?muni wdt:P131 ?up . ?up rdfs:label ?upName . FILTER(LANG(?upName) = "${lang}") }
  }
  OPTIONAL {
    ?item wdt:P131+ ?region .
    ?region wdt:P31/wdt:P279* wd:Q10864048 ;
            rdfs:label ?regionName . FILTER(LANG(?regionName) = "${lang}")
  }
  OPTIONAL { ?item wdt:P159 ?hq . ?hq rdfs:label ?hqName . FILTER(LANG(?hqName) = "${lang}") }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeName . FILTER(LANG(?typeName) = "en") }
  OPTIONAL { ?item wdt:P749|wdt:P361 ?parent }
  ?item rdfs:label ?name . FILTER(LANG(?name) = "${lang}")
  OPTIONAL { ?item rdfs:label ?enName . FILTER(LANG(?enName) = "en") }
}`;
}

/**
 * Aliases are a separate query so the core one does not multiply out.
 *
 * It collects two different things and treats them the same, because to a
 * search field they are the same: alternative labels, and the official name in
 * the country's OTHER languages. The second matters more than it looks. Asked
 * in Spanish, Wikidata calls the UPC "Universidad Politecnica de Cataluna" --
 * which is correct, and is not what is written on the building, not what its
 * students say, and not what an exchange student was sent in their acceptance
 * letter. "Universitat Politecnica de Catalunya" has to be findable, so the
 * Catalan, Basque and Galician labels come across as aliases.
 */
function aliasQuery({ entity, lang, alsoLabels = [] }) {
  const altLangs = [lang, "en", ...alsoLabels].map((code) => `"${code}"`).join(", ");
  const labelLangs = ["en", ...alsoLabels].map((code) => `"${code}"`).join(", ");
  return `
SELECT ?item ?alias WHERE {
  ?item wdt:P31/wdt:P279* wd:Q38723 ;
        wdt:P17 wd:${entity} .
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
  {
    ?item skos:altLabel ?alias .
    FILTER(LANG(?alias) IN (${altLangs}))
  } UNION {
    ?item rdfs:label ?alias .
    FILTER(LANG(?alias) IN (${labelLangs}))
  }
}`;
}

async function sparql(query) {
  const response = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`SPARQL ${response.status} ${response.statusText}: ${(await response.text()).slice(0, 400)}`);
  }
  const body = await response.json();
  return body.results.bindings;
}

/* -------------------------------------------------------------------------- */
/* Shaping                                                                     */
/* -------------------------------------------------------------------------- */

const qid = (uri) => uri.slice(uri.lastIndexOf("/") + 1);

/** Combining marks, stripped after NFD so accented letters fold to plain ones. */
const COMBINING = /[̀-ͯ]/g;

/**
 * Wikidata's `P31` is a bag of overlapping classes and the useful signal is in
 * the English label rather than any one QID -- "private university",
 * "business school", "university of applied sciences" and "grande ecole" are
 * separate entities that all mean something StudentOS wants to say. Matching on
 * the label is a heuristic and is treated as one: anything unrecognised becomes
 * `other`, which the UI renders as "Higher education" rather than guessing.
 */
function classify(typeLabels) {
  const joined = typeLabels.join(" ").toLowerCase();
  if (/business school|school of business|escuela de negocios|grande ecole|grande école/.test(joined)) return "business-school";
  if (/applied science|fachhochschule|hogeschool|polytechnic|university college/.test(joined)) return "applied-sciences";
  if (/conservator/.test(joined)) return "conservatoire";
  if (/art school|school of art|academy of art|academy of fine arts|kunsthochschule/.test(joined)) return "art-school";
  if (/universit|hochschule|universidad|universidade/.test(joined)) return "university";
  return "other";
}

/** "Point(-3.7269 40.4487)" -> { lat, lng }, rounded to about a metre. */
function parsePoint(value) {
  const match = /^Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/.exec(value ?? "");
  if (!match) return { lat: null, lng: null };
  return { lng: round(Number(match[1])), lat: round(Number(match[2])) };
}

const round = (n) => (Number.isFinite(n) ? Math.round(n * 1e5) / 1e5 : null);

/**
 * A Wikidata alias is worth keeping only if it adds a way to find the row.
 * Case variants, the name with its accents removed, and anything that is
 * already a prefix of the official name are dropped -- `fold()` in
 * `src/domain/institutions.ts` handles those, and a hundred redundant aliases
 * is a hundred rows of diff nobody can review.
 */
function usefulAliases(aliases, officialName) {
  const normalise = (s) =>
    s.toLowerCase().normalize("NFD").replace(COMBINING, "").replace(/[^a-z0-9]+/g, " ").trim();
  const official = normalise(officialName);

  const kept = [];
  const keys = [];
  for (const alias of aliases) {
    const trimmed = alias.trim();
    if (!trimmed || trimmed.length > 90) continue;
    const key = normalise(trimmed);
    if (!key || key === official) continue;
    /* Near-duplicates of something already kept. Wikidata holds six Basque
       spellings of "Complutense" and they are one alias, not six: keeping all
       of them pushes out the Catalan name of a Catalan university, which is
       the one somebody will actually type. The rule only collapses spelling
       variants -- a genuinely different name is a different length or has a
       different word in it, and survives. */
    if (keys.some((existing) => nearlyTheSame(existing, key))) continue;
    keys.push(key);
    kept.push(trimmed);
    if (kept.length >= ALIAS_CAP) break;
  }
  return kept.sort((a, b) => a.localeCompare(b));
}

const ALIAS_CAP = 8;

/** Same length to within a fifth, and within that many edits. */
function nearlyTheSame(a, b) {
  const longest = Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) > longest / 5) return false;
  const budget = Math.max(2, Math.round(longest / 5));
  return levenshtein(a, b, budget) <= budget;
}

function levenshtein(a, b, cap) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > cap) return cap + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * A stable, readable id. The acronym of the official name would collide across
 * cities, and the QID alone is unreadable in a diff, so it is both:
 * "es-q214158". Nothing parses it; it exists to be greppable.
 */
const idFor = (cc, entity) => `${cc.toLowerCase()}-${entity.toLowerCase()}`;

/**
 * Q38723 is a loose tree. Asked for every higher education institution in
 * Spain it answers with 602 rows, of which a real sample reads: an elementary
 * music school in Berja, a UNED study centre in Tudela, a military chaplaincy
 * college, an agricultural training centre, a museum and an open-access
 * publisher. None of those is a thing a student enrols at, and every one of
 * them crowds out the row they were looking for.
 *
 * So membership is decided by an ALLOWLIST of classes rather than by the
 * subclass tree. The rule is deliberately simple enough to state in a sentence:
 * anything Wikidata calls a university of any kind, plus a short list of other
 * things that award degrees a student enrols in. Everything else is left out.
 *
 * A false negative here is invisible -- the student types their institution and
 * onboarding stores the name, which is what already happens for anything
 * missing. A false positive is a wrong row shown first, which is worse.
 */
const ALLOWED_CLASSES = new Set([
  "business school",
  "higher education institution",
  "polytechnic",
  "art academy",
  "academy of fine arts",
  "higher conservatory of music",
  "graduate school",
  "school of design",
  "grande ecole",
  "grande école",
  "university of applied sciences",
  "institute of technology",
]);

/** Anything Wikidata calls a university of any kind: public, private, technical, distance. */
const UNIVERSITY_CLASS = /universit/i;

/**
 * Some rows are the BUILDING rather than the institution -- Alcala's founding
 * quadrangle is modelled as a university and as a heritage monument. A student
 * does not enrol at a quadrangle, so a physical structure is left out; the
 * institution itself is a separate row and stays.
 *
 * The list is STRUCTURES only, and that restraint is load-bearing. It first
 * read "museum, library, collection, open-access publisher" as well, all of
 * which sound like things that are not universities, and all of which large
 * universities carry: Granada and Oviedo are both tagged museum and
 * open-access publisher because they run one and are one. Two of Spain's
 * oldest universities disappeared from the picker and nothing said so.
 */
const IS_A_PLACE_NOT_AN_ORGANISATION =
  /^(building|architectural structure|monument|cultural heritage|campus|palace|church|convent|castle)$/i;

function isHigherEducation(typeLabels) {
  if (typeLabels.some((label) => IS_A_PLACE_NOT_AN_ORGANISATION.test(label.trim()))) return false;
  return typeLabels.some(
    (label) => UNIVERSITY_CLASS.test(label) || ALLOWED_CLASSES.has(label.toLowerCase()),
  );
}

/**
 * Names that announce themselves as a part of something. The allowlist already
 * removes most faculties; this catches the ones that also carry a university
 * class because somebody typed it that way.
 */
const PART_OF_SOMETHING =
  /^(facultad|facultat|faculty|faculte|facolt|fakult|escuela tecnica superior|escuela técnica superior|departamento|department|colegio mayor|centro asociado|real academia)\b/i;

/**
 * Sub-city administrative units. A university located in one of these is
 * located in the city that contains it, as far as a student is concerned.
 */
const SUB_CITY =
  /district|borough|neighbou?rhood|quarter|ward|arrondissement|barrio|distrito|stadsdeel|bezirk|ortsteil|municipal district/i;

/** Units bigger than a city. "Provincia de Barcelona" is not where you study. */
const ABOVE_A_CITY =
  /(province|provincia|comarca|autonomous community|county|federal state|voivodeship|prefecture|departement|département)/i;

/**
 * The town a student would name.
 *
 * `P131` is "located in the administrative territorial entity", and inside a
 * big city it frequently points one level too low: an art school in Malaga
 * comes back located in "Distrito Centro", which is not an answer to "where do
 * you study".
 *
 * Walking the whole chain up to a human settlement is the correct query and it
 * times the endpoint out, so the query fetches, for each `P131` value, its
 * classes and its own parent, and this picks between them:
 *
 *   - a value that is not a city district is taken as it stands;
 *   - only when every value is a district does it step one level up.
 *
 * The grouping matters. An institution often has several `P131` values -- the
 * district AND the city -- and flattening their classes into one bag makes the
 * city look like a district, which steps up again and lands on a province.
 * That is exactly the bug this shape exists to avoid.
 */
function resolveCity(record) {
  const places = [...record.places.values()];
  const classesOf = (place) => [...place.types];

  /* `P159` -- headquarters location -- is the institution's own answer to
     "where are you", and it is right where `P131` is not. A university with
     four campuses has four `P131` values and picking between them alphabetically
     put the UPC in Manresa; its headquarters have always said Barcelona. */
  if (record.hq) return record.hq;

  /* A P131 value that is neither a district nor a province is a town, and is
     the best answer left. Alphabetical only to keep the output deterministic. */
  const town = places.filter(
    (place) =>
      !classesOf(place).some((type) => SUB_CITY.test(type)) &&
      !classesOf(place).some((type) => ABOVE_A_CITY.test(type)),
  );
  if (town.length > 0) {
    town.sort((a, b) => a.name.localeCompare(b.name));
    return town[0].name;
  }

  /* Everything left is a district. Step up one. */
  const withParent = places.find((place) => place.up);
  if (withParent) return withParent.up;

  return places[0]?.name ?? null;
}


function shape(cc, rows, aliasesByItem) {
  const byItem = new Map();

  for (const row of rows) {
    const entity = qid(row.item.value);
    let record = byItem.get(entity);
    if (!record) {
      record = {
        entity,
        name: row.name?.value ?? "",
        enName: row.enName?.value ?? null,
        /* One entry per P131 value, each with its own classes and parent.
           See `resolveCity` for why they must not be flattened. */
        places: new Map(),
        hq: row.hqName?.value ?? null,
        region: row.regionName?.value ?? null,
        types: new Set(),
        parents: new Set(),
        coord: row.coord?.value ?? null,
        website: row.website?.value ?? null,
      };
      byItem.set(entity, record);
    }
    if (row.typeName?.value) record.types.add(row.typeName.value);
    if (row.parent?.value) record.parents.add(qid(row.parent.value));
    const placeName = row.muniName?.value;
    if (placeName) {
      let place = record.places.get(placeName);
      if (!place) {
        place = { name: placeName, types: new Set(), up: null };
        record.places.set(placeName, place);
      }
      if (row.muniType?.value) place.types.add(row.muniType.value);
      place.up ??= row.upName?.value ?? null;
    }
    /* The first non-null wins for the single-valued fields: a second region or
       a second website is an equally true answer and picking one keeps the
       output deterministic given a sorted input. */
    record.hq ??= row.hqName?.value ?? null;
    record.region ??= row.regionName?.value ?? null;
    record.coord ??= row.coord?.value ?? null;
    record.website ??= row.website?.value ?? null;
  }

  const out = [];
  let skippedNoCity = 0;
  let skippedPart = 0;
  let skippedNotHigherEd = 0;

  for (const record of byItem.values()) {
    if (!record.name) continue;
    if (!isHigherEducation([...record.types])) {
      skippedNotHigherEd += 1;
      continue;
    }
    /* Part of another institution that is itself in this import: a faculty, a
       campus modelled as its own entity, an affiliated centre. The parent is
       the row the student picks. */
    const insideAnother = [...record.parents].some((parent) => byItem.has(parent));
    if (insideAnother || PART_OF_SOMETHING.test(record.name)) {
      skippedPart += 1;
      continue;
    }
    const city = resolveCity(record);
    /* No town means the row cannot be placed, and an institution the product
       cannot place is one it cannot rank, describe or attach a city to. It is
       dropped rather than shown with a blank where the city goes. */
    if (!city) {
      skippedNoCity += 1;
      continue;
    }
    const { lat, lng } = parsePoint(record.coord);
    /* The English name is an alias, not a second row. An international student
       looking for the Complutense may well know it as "Complutense University
       of Madrid", and that is the only name they have ever read. */
    const aliasPool = [...(aliasesByItem.get(record.entity) ?? [])];
    if (record.enName) aliasPool.unshift(record.enName);
    out.push({
      id: idFor(cc, record.entity),
      officialName: record.name,
      shortName: null,
      aliases: usefulAliases(aliasPool, record.name),
      countryCode: cc,
      city,
      region: record.region,
      campusSlug: null,
      type: classify([...record.types]),
      website: record.website,
      lat,
      lng,
      source: "wikidata",
      sourceId: record.entity,
      verified: false,
    });
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return { rows: out, skippedNoCity, skippedPart, skippedNotHigherEd };
}

/* -------------------------------------------------------------------------- */
/* Emit                                                                        */
/* -------------------------------------------------------------------------- */

const literal = (value) => (value === null ? "null" : JSON.stringify(value));

function emit(cc, country, rows, fetchedOn) {
  const body = rows
    .map((row) => {
      const aliases = row.aliases.length ? `[${row.aliases.map((a) => JSON.stringify(a)).join(", ")}]` : "[]";
      return `  {
    id: ${literal(row.id)},
    officialName: ${literal(row.officialName)},
    shortName: ${literal(row.shortName)},
    aliases: ${aliases},
    countryCode: ${literal(row.countryCode)},
    city: ${literal(row.city)},
    region: ${literal(row.region)},
    citySlug: null,
    campusSlug: null,
    type: ${literal(row.type)},
    website: ${literal(row.website)},
    lat: ${row.lat === null ? "null" : row.lat},
    lng: ${row.lng === null ? "null" : row.lng},
    source: "wikidata",
    sourceId: ${literal(row.sourceId)},
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },`;
    })
    .join("\n");

  return `
/**
 * ============================================================================
 * ${country.name.toUpperCase()} -- HIGHER EDUCATION INSTITUTIONS
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-institutions.mjs ${cc}
 *
 * Source      Wikidata, via the public SPARQL endpoint at
 *             https://query.wikidata.org/sparql
 * Selection   Everything that is a higher education institution
 *             (Q38723 or a subclass), located in ${country.name} (${country.entity}),
 *             with no dissolution date, and with a municipality on record.
 * Fetched     ${fetchedOn}
 * Rows        ${rows.length}
 *
 * \`sourceId\` is the Wikidata QID: https://www.wikidata.org/wiki/Q...
 *
 * \`citySlug\` and \`campusSlug\` are null in every row here and are filled in by
 * \`src/data/institutions/index.ts\` from the metro table and the curated list.
 * Neighbourhoods are never imported -- see the note in the import script.
 * ============================================================================
 */

import type { Institution } from "@/domain/institutions";

const FETCHED_ON = "${fetchedOn}";

export const institutions: readonly Institution[] = [
${body}
];
`;
}

/* -------------------------------------------------------------------------- */
/* Run                                                                         */
/* -------------------------------------------------------------------------- */

async function importCountry(cc, { dryRun }) {
  const country = COUNTRIES[cc];
  if (!country) {
    throw new Error(`Unknown country "${cc}". Known: ${Object.keys(COUNTRIES).join(", ")}`);
  }

  process.stdout.write(`${cc}  querying Wikidata...\n`);
  const [core, aliasRows] = await Promise.all([
    sparql(coreQuery(country)),
    sparql(aliasQuery(country)),
  ]);

  const aliasesByItem = new Map();
  for (const row of aliasRows) {
    const entity = qid(row.item.value);
    if (!aliasesByItem.has(entity)) aliasesByItem.set(entity, []);
    aliasesByItem.get(entity).push(row.alias.value);
  }

  const fetchedOn = new Date().toISOString().slice(0, 10);
  const { rows, skippedNoCity, skippedPart, skippedNotHigherEd } = shape(cc, core, aliasesByItem);

  process.stdout.write(
    `${cc}  ${rows.length} institutions` +
      `  (${skippedNotHigherEd} not higher education, ${skippedPart} part of another institution,` +
      ` ${skippedNoCity} with no municipality skipped)\n`,
  );

  if (dryRun) {
    for (const row of rows.slice(0, 15)) {
      process.stdout.write(`      ${row.officialName} -- ${row.city} -- ${row.type}\n`);
    }
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, `${cc.toLowerCase()}.generated.ts`);
  await writeFile(file, emit(cc, country, rows, fetchedOn), "utf8");
  process.stdout.write(`${cc}  wrote ${file}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const codes = args.filter((a) => !a.startsWith("--")).map((a) => a.toUpperCase());

  if (codes.length === 0) {
    process.stdout.write(
      "usage: node scripts/import-institutions.mjs <ISO-3166 alpha-2>... [--dry-run]\n" +
        `known countries: ${Object.keys(COUNTRIES).join(" ")}\n`,
    );
    process.exit(1);
  }

  for (const cc of codes) {
    await importCountry(cc, { dryRun });
  }
}

main().catch((error) => {
  process.stderr.write(`\nimport failed: ${error.message}\n`);
  process.exit(1);
});
