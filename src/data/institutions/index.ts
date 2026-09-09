import { fold, type Institution } from "@/domain/institutions";
import { curated } from "@/data/institutions/curated";
import { institutions as austria } from "@/data/institutions/at.generated";
import { institutions as belgium } from "@/data/institutions/be.generated";
import { institutions as czechia } from "@/data/institutions/cz.generated";
import { institutions as germany } from "@/data/institutions/de.generated";
import { institutions as denmark } from "@/data/institutions/dk.generated";
import { institutions as estonia } from "@/data/institutions/ee.generated";
import { institutions as spain } from "@/data/institutions/es.generated";
import { institutions as finland } from "@/data/institutions/fi.generated";
import { institutions as france } from "@/data/institutions/fr.generated";
import { institutions as britain } from "@/data/institutions/gb.generated";
import { institutions as greece } from "@/data/institutions/gr.generated";
import { institutions as hungary } from "@/data/institutions/hu.generated";
import { institutions as ireland } from "@/data/institutions/ie.generated";
import { institutions as italy } from "@/data/institutions/it.generated";
import { institutions as netherlands } from "@/data/institutions/nl.generated";
import { institutions as poland } from "@/data/institutions/pl.generated";
import { institutions as portugal } from "@/data/institutions/pt.generated";
import { institutions as sweden } from "@/data/institutions/se.generated";

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

  /* ---- the rest of Europe -----------------------------------------------
     THE TOWN NAME IS THE LOCAL ONE, because that is what the registry holds:
     the importer asks Wikidata for labels in the country's own language, so
     Prague is "Praha", Vienna is "Wien" and Warsaw is "Warszawa". Writing
     "Prague" here would match nothing and would look like the city simply
     having no universities.

     Several countries label a municipality as a `kommun`/`Kommune` as well as
     a bare name, and the same city appears under both, so both are listed.
     `fold()` handles the accents; it does not handle a different word.

     These are single-town claims on purpose. A metro that swallows the
     surrounding region -- the Comunidad de Madrid above is the one case where
     that is genuinely one travel area -- would attach a student two hours away
     to a transport card they cannot use. An institution in a town not listed
     here keeps `citySlug: null`, stays searchable and pickable, and simply has
     no local content behind it. That is the documented, honest degradation.
     ---------------------------------------------------------------------- */

  /* Spain */
  { citySlug: "valencia", countryCode: "ES", towns: ["Valencia", "València"] },
  { citySlug: "seville", countryCode: "ES", towns: ["Sevilla"] },
  { citySlug: "malaga", countryCode: "ES", towns: ["Málaga"] },
  { citySlug: "bilbao", countryCode: "ES", towns: ["Bilbao", "Bilbo"] },
  { citySlug: "granada", countryCode: "ES", towns: ["Granada"] },
  { citySlug: "salamanca", countryCode: "ES", towns: ["Salamanca"] },

  /* France */
  { citySlug: "paris", countryCode: "FR", towns: ["Paris"] },
  { citySlug: "lyon", countryCode: "FR", towns: ["Lyon"] },
  { citySlug: "toulouse", countryCode: "FR", towns: ["Toulouse"] },

  /* Germany */
  { citySlug: "munich", countryCode: "DE", towns: ["München"] },
  { citySlug: "hamburg", countryCode: "DE", towns: ["Hamburg"] },
  { citySlug: "frankfurt", countryCode: "DE", towns: ["Frankfurt am Main"] },
  { citySlug: "cologne", countryCode: "DE", towns: ["Köln"] },

  /* Italy */
  { citySlug: "rome", countryCode: "IT", towns: ["Roma"] },
  { citySlug: "milan", countryCode: "IT", towns: ["Milano"] },
  { citySlug: "florence", countryCode: "IT", towns: ["Firenze"] },
  { citySlug: "bologna", countryCode: "IT", towns: ["Bologna"] },
  { citySlug: "turin", countryCode: "IT", towns: ["Torino"] },

  /* Portugal */
  { citySlug: "lisbon", countryCode: "PT", towns: ["Lisboa"] },
  { citySlug: "porto", countryCode: "PT", towns: ["Porto", "Paranhos"] },

  /* Netherlands, Belgium */
  { citySlug: "rotterdam", countryCode: "NL", towns: ["Rotterdam"] },
  { citySlug: "utrecht", countryCode: "NL", towns: ["Utrecht"] },
  { citySlug: "brussels", countryCode: "BE", towns: ["Brussel", "Bruxelles"] },

  /* Britain and Ireland */
  { citySlug: "manchester", countryCode: "GB", towns: ["Manchester"] },
  { citySlug: "edinburgh", countryCode: "GB", towns: ["Edinburgh"] },
  { citySlug: "dublin", countryCode: "IE", towns: ["Dublin"] },

  /* Central Europe */
  { citySlug: "vienna", countryCode: "AT", towns: ["Wien"] },
  { citySlug: "prague", countryCode: "CZ", towns: ["Praha"] },
  { citySlug: "budapest", countryCode: "HU", towns: ["Budapest"] },
  { citySlug: "warsaw", countryCode: "PL", towns: ["Warszawa"] },
  { citySlug: "krakow", countryCode: "PL", towns: ["Kraków"] },

  /* Nordics and the Baltic */
  { citySlug: "copenhagen", countryCode: "DK", towns: ["København", "Københavns Kommune"] },
  { citySlug: "stockholm", countryCode: "SE", towns: ["Stockholm", "Stockholms kommun"] },
  { citySlug: "helsinki", countryCode: "FI", towns: ["Helsinki"] },
  { citySlug: "tallinn", countryCode: "EE", towns: ["Tallinn"] },

  /**
   * Greece is listed and currently matches nothing, which is deliberate and
   * worth stating rather than hiding.
   *
   * The registry labels Greek municipalities in Greek — "Αθήνα", not "Athens" —
   * and `fold` keeps only `[a-z0-9]`, so every Greek name folds to the empty
   * string. The guard in `citySlugFor` turns that into "unknown" instead of
   * "matches everything", so Greek institutions stay searchable with
   * `citySlug: null` and no local content, exactly as any unlisted town does.
   *
   * Fixing it properly means transliterating Greek in `fold`, which is a change
   * to how every name in the product is matched and is not worth making
   * blind. This line is here so the next person finds the reason instead of
   * the symptom.
   */
  { citySlug: "athens", countryCode: "GR", towns: ["Athens"] },
];

function citySlugFor(countryCode: string, city: string, region: string | null): string | null {
  const town = fold(city);

  /**
   * AN EMPTY FOLD MATCHES NOTHING, and this guard is the whole reason Greek
   * institutions are not all in Athens.
   *
   * `fold` keeps `[a-z0-9]` and drops everything else, so any name written in a
   * non-Latin script folds to the empty string: "Αθήνα" and "Θεσσαλονίκη" both
   * become "". Without this line the equality below is `"" === ""`, and every
   * institution in Greece would be assigned to whichever Greek city happened to
   * be listed first — silently, and looking entirely plausible on the screen.
   *
   * Returning null is correct rather than merely safe: an institution whose
   * town we cannot read is one whose town we do not know.
   */
  if (town.length === 0) return null;

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

/**
 * Every imported country registry.
 *
 * One line per country, and adding one is one line here plus one import. The
 * order does not matter: rows are merged by folded name against the curated
 * list, and a student searches across all of them at once.
 */
const GENERATED: readonly (readonly Institution[])[] = [
  austria,
  belgium,
  czechia,
  germany,
  denmark,
  estonia,
  spain,
  finland,
  france,
  britain,
  greece,
  hungary,
  ireland,
  italy,
  netherlands,
  poland,
  portugal,
  sweden,
];

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

/**
 * Countries the registry has been imported for, for the "not listed" copy.
 *
 * DERIVED, not hand-written. This was a literal `["ES"]` and stayed that way
 * when seventeen more countries were imported, so the product would have gone
 * on telling a French student their country was not covered while holding four
 * hundred French universities. A list of what we have should be read off what
 * we have.
 */
export const IMPORTED_COUNTRIES: readonly string[] = Object.freeze([
  ...new Set(GENERATED.flatMap((rows) => rows.map((row) => row.countryCode))),
].sort());
