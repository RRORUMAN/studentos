
/**
 * ============================================================================
 * MONTENEGRO -- HIGHER EDUCATION INSTITUTIONS
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-institutions.mjs ME
 *
 * Source      Wikidata, via the public SPARQL endpoint at
 *             https://query.wikidata.org/sparql
 * Selection   Everything that is a higher education institution
 *             (Q38723 or a subclass), located in Montenegro (Q236),
 *             with no dissolution date, and with a municipality on record.
 * Fetched     2026-09-10
 * Rows        3
 *
 * `sourceId` is the Wikidata QID: https://www.wikidata.org/wiki/Q...
 *
 * `citySlug` and `campusSlug` are null in every row here and are filled in by
 * `src/data/institutions/index.ts` from the metro table and the curated list.
 * Neighbourhoods are never imported -- see the note in the import script.
 * ============================================================================
 */

import type { Institution } from "@/domain/institutions";

const FETCHED_ON = "2026-09-10";

export const institutions: readonly Institution[] = [
  {
    id: "me-q103021183",
    officialName: "University of Donja Gorica",
    shortName: null,
    aliases: [],
    countryCode: "ME",
    city: "Podgorica",
    region: "Podgorica",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "https://www.udg.edu.me",
    lat: 42.4175,
    lng: 19.2028,
    source: "wikidata",
    sourceId: "Q103021183",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "me-q1786067",
    officialName: "University of Montenegro",
    shortName: null,
    aliases: ["Univerzitet Crne Gore"],
    countryCode: "ME",
    city: "Podgorica",
    region: "Podgorica",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "https://www.ucg.ac.me",
    lat: 42.44306,
    lng: 19.24306,
    source: "wikidata",
    sourceId: "Q1786067",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "me-q282645",
    officialName: "Mediterranean University",
    shortName: null,
    aliases: ["Univerzitet Mediteran", "Univerzitet Mediteran Podgorica"],
    countryCode: "ME",
    city: "Podgorica",
    region: "Podgorica",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "http://www.unimediteran.net",
    lat: 42.44833,
    lng: 19.26167,
    source: "wikidata",
    sourceId: "Q282645",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
];
