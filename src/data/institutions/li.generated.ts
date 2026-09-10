
/**
 * ============================================================================
 * LIECHTENSTEIN -- HIGHER EDUCATION INSTITUTIONS
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-institutions.mjs LI
 *
 * Source      Wikidata, via the public SPARQL endpoint at
 *             https://query.wikidata.org/sparql
 * Selection   Everything that is a higher education institution
 *             (Q38723 or a subclass), located in Liechtenstein (Q347),
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
    id: "li-q1572147",
    officialName: "Internationale Akademie für Philosophie",
    shortName: null,
    aliases: ["IAP", "International Academy of Philosophy", "Internationale Akademie für Philosophie im Fürstentum Liechtenstein"],
    countryCode: "LI",
    city: "Gamprin",
    region: "Gamprin",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "http://www.iap.li/",
    lat: 47.2112,
    lng: 9.50742,
    source: "wikidata",
    sourceId: "Q1572147",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "li-q2111101",
    officialName: "Private Universität im Fürstentum Liechtenstein",
    shortName: null,
    aliases: ["Private University in the Principality of Liechtenstein", "Universität für Humanwissenschaften", "Universität für Humanwissenschaften im Fürstentum Liechtenstein"],
    countryCode: "LI",
    city: "Triesen",
    region: "Triesen",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "https://www.ufl.li/",
    lat: 47.10819,
    lng: 9.52658,
    source: "wikidata",
    sourceId: "Q2111101",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "li-q974328",
    officialName: "Universität Liechtenstein",
    shortName: null,
    aliases: ["Uni Liechtenstein", "University of Liechtenstein"],
    countryCode: "LI",
    city: "Vaduz",
    region: null,
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "https://www.uni.li/",
    lat: 47.1498,
    lng: 9.5162,
    source: "wikidata",
    sourceId: "Q974328",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
];
