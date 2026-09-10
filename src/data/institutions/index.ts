import { allCoverageCities } from "@/config/regions";
import { fold, type Institution } from "@/domain/institutions";
import { curated } from "@/data/institutions/curated";
import { institutions as emirates } from "@/data/institutions/ae.generated";
import { institutions as argentina } from "@/data/institutions/ar.generated";
import { institutions as austria } from "@/data/institutions/at.generated";
import { institutions as australia } from "@/data/institutions/au.generated";
import { institutions as belgium } from "@/data/institutions/be.generated";
import { institutions as brazil } from "@/data/institutions/br.generated";
import { institutions as canada } from "@/data/institutions/ca.generated";
import { institutions as switzerland } from "@/data/institutions/ch.generated";
import { institutions as chile } from "@/data/institutions/cl.generated";
import { institutions as colombia } from "@/data/institutions/co.generated";
import { institutions as czechia } from "@/data/institutions/cz.generated";
import { institutions as germany } from "@/data/institutions/de.generated";
import { institutions as denmark } from "@/data/institutions/dk.generated";
import { institutions as estonia } from "@/data/institutions/ee.generated";
import { institutions as egypt } from "@/data/institutions/eg.generated";
import { institutions as spain } from "@/data/institutions/es.generated";
import { institutions as finland } from "@/data/institutions/fi.generated";
import { institutions as france } from "@/data/institutions/fr.generated";
import { institutions as britain } from "@/data/institutions/gb.generated";
import { institutions as ghana } from "@/data/institutions/gh.generated";
import { institutions as greece } from "@/data/institutions/gr.generated";
import { institutions as hongKong } from "@/data/institutions/hk.generated";
import { institutions as hungary } from "@/data/institutions/hu.generated";
import { institutions as ireland } from "@/data/institutions/ie.generated";
import { institutions as israel } from "@/data/institutions/il.generated";
import { institutions as india } from "@/data/institutions/in.generated";
import { institutions as italy } from "@/data/institutions/it.generated";
import { institutions as japan } from "@/data/institutions/jp.generated";
import { institutions as kenya } from "@/data/institutions/ke.generated";
import { institutions as southKorea } from "@/data/institutions/kr.generated";
import { institutions as morocco } from "@/data/institutions/ma.generated";
import { institutions as mexico } from "@/data/institutions/mx.generated";
import { institutions as malaysia } from "@/data/institutions/my.generated";
import { institutions as nigeria } from "@/data/institutions/ng.generated";
import { institutions as netherlands } from "@/data/institutions/nl.generated";
import { institutions as norway } from "@/data/institutions/no.generated";
import { institutions as newZealand } from "@/data/institutions/nz.generated";
import { institutions as poland } from "@/data/institutions/pl.generated";
import { institutions as portugal } from "@/data/institutions/pt.generated";
import { institutions as qatar } from "@/data/institutions/qa.generated";
import { institutions as sweden } from "@/data/institutions/se.generated";
import { institutions as singapore } from "@/data/institutions/sg.generated";
import { institutions as thailand } from "@/data/institutions/th.generated";
import { institutions as turkey } from "@/data/institutions/tr.generated";
import { institutions as taiwan } from "@/data/institutions/tw.generated";
import { institutions as unitedStates } from "@/data/institutions/us.generated";
import { institutions as southAfrica } from "@/data/institutions/za.generated";
import { institutions as romania } from "@/data/institutions/ro.generated";
import { institutions as croatia } from "@/data/institutions/hr.generated";
import { institutions as slovakia } from "@/data/institutions/sk.generated";
import { institutions as slovenia } from "@/data/institutions/si.generated";
import { institutions as lithuania } from "@/data/institutions/lt.generated";
import { institutions as latvia } from "@/data/institutions/lv.generated";
import { institutions as iceland } from "@/data/institutions/is.generated";
import { institutions as luxembourg } from "@/data/institutions/lu.generated";
import { institutions as malta } from "@/data/institutions/mt.generated";
import { institutions as bosnia } from "@/data/institutions/ba.generated";
import { institutions as albania } from "@/data/institutions/al.generated";
import { institutions as moldova } from "@/data/institutions/md.generated";
import { institutions as andorra } from "@/data/institutions/ad.generated";
import { institutions as liechtenstein } from "@/data/institutions/li.generated";
import { institutions as monaco } from "@/data/institutions/mc.generated";
import { institutions as bulgaria } from "@/data/institutions/bg.generated";
import { institutions as serbia } from "@/data/institutions/rs.generated";
import { institutions as ukraine } from "@/data/institutions/ua.generated";
import { institutions as belarus } from "@/data/institutions/by.generated";
import { institutions as northMacedonia } from "@/data/institutions/mk.generated";
import { institutions as montenegro } from "@/data/institutions/me.generated";
import { institutions as cyprus } from "@/data/institutions/cy.generated";

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

  /* ---- the rest of the world --------------------------------------------
     English town names here, because the importer asks for English labels
     wherever the local script is not Latin — see the note on `COUNTRIES` in
     scripts/import-institutions.mjs. So it is "Tokyo", not the kanji, and the
     kanji survives as a searchable alias on the institution itself.
     ---------------------------------------------------------------------- */

  /* North America */
  { citySlug: "new-york", countryCode: "US", towns: ["New York City", "New York", "Manhattan", "Brooklyn", "Bronx", "Queens"] },
  { citySlug: "boston", countryCode: "US", towns: ["Boston", "Cambridge", "Somerville"] },
  { citySlug: "chicago", countryCode: "US", towns: ["Chicago", "Evanston"] },
  { citySlug: "los-angeles", countryCode: "US", towns: ["Los Angeles", "Pasadena", "Westwood"] },
  { citySlug: "austin", countryCode: "US", towns: ["Austin"] },
  { citySlug: "toronto", countryCode: "CA", towns: ["Toronto", "North York", "Scarborough", "Mississauga"] },
  { citySlug: "montreal", countryCode: "CA", towns: ["Montreal", "Montréal"] },
  { citySlug: "vancouver", countryCode: "CA", towns: ["Vancouver", "Burnaby", "Richmond"] },
  { citySlug: "mexico-city", countryCode: "MX", towns: ["Mexico City", "Ciudad de México"] },

  /* South America */
  { citySlug: "sao-paulo", countryCode: "BR", towns: ["São Paulo", "Sao Paulo"] },
  { citySlug: "buenos-aires", countryCode: "AR", towns: ["Buenos Aires"] },
  { citySlug: "santiago", countryCode: "CL", towns: ["Santiago"] },
  { citySlug: "bogota", countryCode: "CO", towns: ["Bogotá", "Bogota"] },

  /* Asia-Pacific */
  { citySlug: "tokyo", countryCode: "JP", towns: ["Tokyo", "Bunkyo", "Chiyoda", "Meguro"] },
  { citySlug: "seoul", countryCode: "KR", towns: ["Seoul"] },
  { citySlug: "taipei", countryCode: "TW", towns: ["Taipei", "New Taipei"] },
  { citySlug: "hong-kong", countryCode: "HK", towns: ["Hong Kong", "Kowloon"] },
  { citySlug: "singapore", countryCode: "SG", towns: ["Singapore"] },
  { citySlug: "kuala-lumpur", countryCode: "MY", towns: ["Kuala Lumpur", "Petaling Jaya"] },
  { citySlug: "bangkok", countryCode: "TH", towns: ["Bangkok"] },
  { citySlug: "delhi", countryCode: "IN", towns: ["New Delhi", "Delhi"] },
  { citySlug: "bengaluru", countryCode: "IN", towns: ["Bengaluru", "Bangalore"] },
  { citySlug: "sydney", countryCode: "AU", towns: ["Sydney"] },
  { citySlug: "melbourne", countryCode: "AU", towns: ["Melbourne", "Parkville", "Clayton"] },
  { citySlug: "auckland", countryCode: "NZ", towns: ["Auckland"] },

  /* Middle East and Africa */
  { citySlug: "dubai", countryCode: "AE", towns: ["Dubai"] },
  { citySlug: "abu-dhabi", countryCode: "AE", towns: ["Abu Dhabi"] },
  { citySlug: "doha", countryCode: "QA", towns: ["Doha"] },
  { citySlug: "tel-aviv", countryCode: "IL", towns: ["Tel Aviv", "Tel Aviv-Yafo", "Ramat Gan"] },
  { citySlug: "cairo", countryCode: "EG", towns: ["Cairo", "Giza", "New Cairo"] },
  { citySlug: "casablanca", countryCode: "MA", towns: ["Casablanca"] },
  { citySlug: "cape-town", countryCode: "ZA", towns: ["Cape Town"] },
  { citySlug: "johannesburg", countryCode: "ZA", towns: ["Johannesburg"] },
  { citySlug: "nairobi", countryCode: "KE", towns: ["Nairobi"] },
  { citySlug: "lagos", countryCode: "NG", towns: ["Lagos"] },
  { citySlug: "accra", countryCode: "GH", towns: ["Accra"] },

  /* Europe, remaining */
  { citySlug: "istanbul", countryCode: "TR", towns: ["Istanbul", "İstanbul"] },
  { citySlug: "zurich", countryCode: "CH", towns: ["Zürich", "Zurich"] },
  { citySlug: "oslo", countryCode: "NO", towns: ["Oslo"] },
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
/* The cities nobody hand-listed                                               */
/* -------------------------------------------------------------------------- */

/**
 * Which coverage cities have a hand-written metro claim. Everything else falls
 * through to geography below.
 */
const HAND_CLAIMED: ReadonlySet<string> = new Set(METROS.map((metro) => metro.citySlug));

/**
 * How far from a city's centre an institution is still "in" that city.
 *
 * Deliberately tight. The METROS note above explains why a metro must not
 * swallow its region: a student attached to a city two hours away gets that
 * city's transport card and price anchors, both of which are wrong for them.
 * Twenty kilometres is about the radius inside which a city's transport pass
 * and its price level are the ones a student actually meets, and it is small
 * enough that two coverage cities rarely both claim the same institution —
 * where they do, the nearer wins.
 */
const METRO_RADIUS_KM = 20;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Attach an institution to a coverage city by WHERE IT IS.
 *
 * The name-matching above cannot serve the cities added with the European
 * expansion, and not for want of typing: it compares a hand-written town name
 * against the label Wikidata holds, which is in the country's own language for
 * a Latin-script country and folds to the empty string for a Cyrillic or Greek
 * one. That is why `citySlugFor` has to guard against an empty fold, and why
 * every Greek institution would otherwise have landed in Athens. Hand-writing
 * "Praha", "Warszawa", "Кyiv" and "Λευκωσία" for two hundred more cities would
 * be two hundred more chances to make exactly that mistake, silently.
 *
 * Coordinates have no language. Both sides of this comparison come from the
 * same Wikidata import, so an institution is placed by the same authority that
 * placed the city.
 *
 * IT ONLY EVER ADDS. A city with a hand-written metro claim is skipped
 * entirely, so no existing assignment changes and no curated decision — the
 * Comunidad de Madrid as one travel area, Catalonia deliberately not — is
 * overridden by arithmetic. This runs for an institution the hand-written
 * rules left with no city at all, where the alternative is not a better answer
 * but no answer.
 */
/**
 * Attach by the city's own name, for the 29% of institutions Wikidata has no
 * coordinate for.
 *
 * Geography is the better signal and runs first, but it cannot run at all for
 * 3,929 of these rows — Katholieke Universiteit Leuven among them, which is
 * not a row a European student product can afford to leave unattached. What
 * those rows do have is a town: KU Leuven says "Leuven", and there is a
 * coverage city called Leuven in the same country.
 *
 * COUNTRY SCOPING IS NOT DECORATION HERE. Haute École Louvain en Hainaut
 * records its town as "Bergen" — the Dutch name for Mons — and Bergen is also
 * a coverage city in Norway. Without the country check that institution moves
 * to Norway, and it would look entirely plausible on the screen.
 *
 * Cities with a hand-written metro claim are skipped, as above, so this can
 * only add. It matches the English display name, which is why it catches
 * Leuven and not Warszawa — but every city whose English name differs from its
 * local one is a city that already has a hand-written claim or a coordinate.
 */
function coverageCityByName(countryCode: string, city: string): string | null {
  const town = fold(city);
  if (town.length === 0) return null;

  for (const entry of allCoverageCities) {
    if (entry.countryCode !== countryCode) continue;
    const slug = entry.slug ?? entry.key;
    if (HAND_CLAIMED.has(slug)) continue;
    if (fold(entry.name) === town) return slug;
  }
  return null;
}

function nearestCoverageCity(countryCode: string, lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) return null;

  let best: { slug: string; km: number } | null = null;
  for (const city of allCoverageCities) {
    if (city.countryCode !== countryCode) continue;
    if (HAND_CLAIMED.has(city.slug ?? city.key)) continue;
    if (!Number.isFinite(city.lat) || !Number.isFinite(city.lng)) continue;

    const km = haversineKm(lat, lng, city.lat, city.lng);
    if (km > METRO_RADIUS_KM) continue;
    if (!best || km < best.km) best = { slug: city.slug ?? city.key, km };
  }
  return best?.slug ?? null;
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
  emirates,
  argentina,
  austria,
  australia,
  belgium,
  brazil,
  canada,
  switzerland,
  chile,
  colombia,
  czechia,
  germany,
  denmark,
  estonia,
  egypt,
  spain,
  finland,
  france,
  britain,
  ghana,
  greece,
  hongKong,
  hungary,
  ireland,
  israel,
  india,
  italy,
  japan,
  kenya,
  southKorea,
  morocco,
  mexico,
  malaysia,
  nigeria,
  netherlands,
  norway,
  newZealand,
  poland,
  portugal,
  qatar,
  sweden,
  singapore,
  thailand,
  turkey,
  taiwan,
  unitedStates,
  southAfrica,

  /* ---- the rest of Europe, imported with the twenty-two country profiles
     that gave those countries a city in the first place. ---- */
  romania,
  croatia,
  slovakia,
  slovenia,
  lithuania,
  latvia,
  iceland,
  luxembourg,
  malta,
  bosnia,
  albania,
  moldova,
  andorra,
  liechtenstein,
  monaco,
  bulgaria,
  serbia,
  ukraine,
  belarus,
  northMacedonia,
  montenegro,
  cyprus,
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
    /* Three attempts, most authoritative first: the hand-written metro claim,
       then where the institution actually is, then what its town is called.
       The last two only ever consider cities nobody hand-claimed, so a curated
       decision is never overridden — see the notes on each. */
    const citySlug =
      citySlugFor(row.countryCode, row.city, row.region) ??
      nearestCoverageCity(row.countryCode, row.lat, row.lng) ??
      coverageCityByName(row.countryCode, row.city);

    merged.push({ ...row, citySlug });
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
