
/**
 * ============================================================================
 * MONACO -- HIGHER EDUCATION INSTITUTIONS
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-institutions.mjs MC
 *
 * Source      Wikidata, via the public SPARQL endpoint at
 *             https://query.wikidata.org/sparql
 * Selection   Everything that is a higher education institution
 *             (Q38723 or a subclass), located in Monaco (Q235),
 *             with no dissolution date, and with a municipality on record.
 * Fetched     2026-09-10
 * Rows        2
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
    id: "mc-q130759542",
    officialName: "Institut monégasque de formation aux professions judiciaires",
    shortName: null,
    aliases: ["IMFPJ", "MITLP", "Monegasque Institute for Training in the Legal Professions"],
    countryCode: "MC",
    city: "commune de Monaco",
    region: null,
    citySlug: null,
    campusSlug: null,
    type: "other",
    website: "https://www.imfpj.mc",
    lat: null,
    lng: null,
    source: "wikidata",
    sourceId: "Q130759542",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "mc-q2504327",
    officialName: "université internationale de Monaco",
    shortName: null,
    aliases: ["International University of Monaco", "IUM"],
    countryCode: "MC",
    city: "commune de Monaco",
    region: null,
    citySlug: null,
    campusSlug: null,
    type: "business-school",
    website: "https://www.monaco.edu/it/",
    lat: 43.7345,
    lng: 7.41789,
    source: "wikidata",
    sourceId: "Q2504327",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
];
