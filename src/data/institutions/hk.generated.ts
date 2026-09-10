
/**
 * ============================================================================
 * HONG KONG -- HIGHER EDUCATION INSTITUTIONS
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-institutions.mjs HK
 *
 * Source      Wikidata, via the public SPARQL endpoint at
 *             https://query.wikidata.org/sparql
 * Selection   Everything that is a higher education institution
 *             (Q38723 or a subclass), located in Hong Kong (Q8646),
 *             with no dissolution date, and with a municipality on record.
 * Fetched     2026-09-10
 * Rows        1
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
    id: "hk-q1666906",
    officialName: "CW Chu College",
    shortName: null,
    aliases: ["C.W. Chu College"],
    countryCode: "HK",
    city: "Hong Kong",
    region: "Hong Kong",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "http://www.cwchu.cuhk.edu.hk/",
    lat: 22.42545,
    lng: 114.20662,
    source: "wikidata",
    sourceId: "Q1666906",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
];
