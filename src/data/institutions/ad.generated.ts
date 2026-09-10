
/**
 * ============================================================================
 * ANDORRA -- HIGHER EDUCATION INSTITUTIONS
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-institutions.mjs AD
 *
 * Source      Wikidata, via the public SPARQL endpoint at
 *             https://query.wikidata.org/sparql
 * Selection   Everything that is a higher education institution
 *             (Q38723 or a subclass), located in Andorra (Q228),
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
    id: "ad-q648838",
    officialName: "Universitat d'Andorra",
    shortName: null,
    aliases: ["UdA", "Universidad de Andorra", "University of Andorra"],
    countryCode: "AD",
    city: "Sant Julià de Lòria",
    region: "Sant Julià de Lòria",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "http://www.uda.ad",
    lat: 42.465,
    lng: 1.49056,
    source: "wikidata",
    sourceId: "Q648838",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
];
