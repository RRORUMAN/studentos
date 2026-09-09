import { fold, type Institution } from "@/domain/institutions";
import { curated } from "@/data/institutions/curated";
import { institutions as spain } from "@/data/institutions/es.generated";

/**
 * ============================================================================
 * THE INSTITUTION REGISTRY
 * ----------------------------------------------------------------------------
 * One list, built once, from two sources that know different things.
 *
 *   curated      thirty-eight institutions whose campus neighbourhood somebody
 *                checked. Small, hand-written, and the only source allowed to
 *                claim a campus location.
 *
 *   generated    every higher education institution in a country, imported
 *                from Wikidata by `scripts/import-institutions.mjs`. Knows the
 *                official name, the alternative spellings, the website and the
 *                coordinates; knows nothing about neighbourhoods.
 *
 * MERGING is the interesting part, and it goes one way: a curated row wins
 * every field it declares, and takes everything else from the imported row it
 * matched. So the Politecnica de Catalunya keeps the Catalan name its students
 * use and the campus in Les Corts, and gains the website, the coordinates and
 * the eight spellings that make it findable. Two rows for one university is the
 * failure this avoids -- a student picking the wrong one loses their commute
 * figures and never finds out why.
 *
 * MATCHING is by name or alias, folded. That is deliberately not fuzzy: two
 * institutions in one city with similar names are usually two institutions, and
 * a wrong merge is silent and permanent, while a missed one shows up as a
 * duplicate in the picker the first time anybody looks.
 *
 * CITY SLUGS are assigned here rather than at import time so that adding a
 * StudentOS city is a change to this file and not a re-import.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Metros                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Which towns a StudentOS city serves.
 *
 * "Madrid" as a city record means Madrid's price anchors, its transport card
 * and its local content. A student at Carlos III lives in Getafe and rides the
 * same Abono; a student at Alcalá is inside the Comunidad and the same fare
 * system. So the unit is the metro, and `region` is allowed as a shorthand only
 * where the region really is one travel area -- which is true of the Comunidad
 * de Madrid and is not true of Catalonia, where Girona is two hours away.
 *
 * Anything not listed keeps `citySlug: null`. It is still searchable and still
 * pickable; it simply has no local content behind it, which the product already
 * handles for every city outside the deep five.
 */
type Metro = {
  citySlug: string;
  countryCode: string;
  /** Whole first-level region, when it is one travel area. */
  region?: string;
  /** Individual municipalities, matched folded. */
  towns?: readonly string[];
};

const METROS: readonly Metro[] = [
  { citySlug: "madrid", countryCode: "ES", region: "Comunidad de Madrid" },
  {
    citySlug: "barcelona",
    countryCode: "ES",
    towns: [
      "Barcelona",
      "Cerdanyola del Vallès",
      "Sant Cugat del Vallès",
      "Bellaterra",
      "Castelldefels",
      "Badalona",
      "Hospitalet de Llobregat",
      "L'Hospitalet de Llobregat",
      "Sant Adrià de Besòs",
      "Esplugues de Llobregat",
      "Sant Joan Despí",
    ],
  },
  { citySlug: "london", countryCode: "GB", towns: ["London", "City of London"] },
  { citySlug: "amsterdam", countryCode: "NL", towns: ["Amsterdam", "Amstelveen", "Diemen"] },
  { citySlug: "berlin", countryCode: "DE", towns: ["Berlin"] },
];

function citySlugFor(countryCode: string, city: string, region: string | null): string | null {
  const town = fold(city);
  for (const metro of METROS) {
    if (metro.countryCode !== countryCode) continue;
    if (metro.towns?.some((candidate) => fold(candidate) === town)) return metro.citySlug;
    if (metro.region && region && fold(metro.region) === fold(region)) return metro.citySlug;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Merge                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Every folded name an institution answers to. Used only for matching, never
 * shown -- the search in `src/domain/institutions.ts` does its own folding.
 */
function namesOf(row: { officialName: string; shortName?: string | null; aliases: readonly string[] }): string[] {
  const out = [fold(row.officialName), ...row.aliases.map(fold)];
  if (row.shortName) out.push(fold(row.shortName));
  return out.filter(Boolean);
}

/**
 * The date the curated list was last reviewed. It is a constant rather than
 * `new Date()` because a build must not change what the data says: two
 * deployments of the same commit have to produce the same registry.
 */
const CURATED_REVIEWED_ON = "2026-09-08";

const GENERATED: readonly (readonly Institution[])[] = [spain];

function build(): Institution[] {
  const imported: readonly Institution[] = GENERATED.flat();

  /* One entry per folded name, pointing at the imported row that owns it. A
     name claimed by two imported rows is ambiguous and is claimed by neither,
     because merging into the wrong one is worse than not merging. */
  const byName = new Map<string, Institution | null>();
  for (const row of imported) {
    for (const name of namesOf(row)) {
      byName.set(name, byName.has(name) ? null : row);
    }
  }

  const merged: Institution[] = [];
  const consumed = new Set<string>();

  for (const row of curated) {
    const match = namesOf(row)
      .map((name) => byName.get(name))
      .find((candidate): candidate is Institution => Boolean(candidate));
    if (match) consumed.add(match.id);

    merged.push({
      id: `${row.countryCode.toLowerCase()}-${row.slug}`,
      officialName: row.officialName,
      shortName: row.shortName,
      /* The curated aliases are what students say; the imported ones are what
         registries hold. Both are worth searching, so both are kept. */
      aliases: dedupe([...row.aliases, ...(match?.aliases ?? [])]),
      countryCode: row.countryCode,
      city: row.city,
      region: match?.region ?? null,
      citySlug: row.citySlug,
      campusSlug: row.campusSlug,
      type: row.type,
      website: match?.website ?? null,
      lat: match?.lat ?? null,
      lng: match?.lng ?? null,
      source: "curated",
      sourceId: match?.sourceId ?? null,
      verified: true,
      lastUpdatedAt: CURATED_REVIEWED_ON,
    });
  }

  for (const row of imported) {
    if (consumed.has(row.id)) continue;
    merged.push({ ...row, citySlug: citySlugFor(row.countryCode, row.city, row.region) });
  }

  merged.sort((a, b) => a.officialName.localeCompare(b.officialName));
  return merged;
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = fold(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * The whole registry, built once at module load. A few hundred rows of plain
 * objects: cheaper to hold than to rebuild, and immutable so no caller can
 * quietly reshape what the next one searches.
 */
export const institutions: readonly Institution[] = Object.freeze(build());

const byId = new Map(institutions.map((row) => [row.id, row]));

export function institutionById(id: string): Institution | undefined {
  return byId.get(id);
}

/** Institutions with a StudentOS city behind them. What the picker opens with. */
export function institutionsInCity(citySlug: string): Institution[] {
  return institutions.filter((row) => row.citySlug === citySlug);
}

/** The one whose curated campus row this is, if any. */
export function institutionForCampus(campusSlug: string): Institution | undefined {
  return institutions.find((row) => row.campusSlug === campusSlug);
}

/** Countries the registry has been imported for, for the "not listed" copy. */
export const IMPORTED_COUNTRIES: readonly string[] = ["ES"];
