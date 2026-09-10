
/**
 * ============================================================================
 * MALTA -- HIGHER EDUCATION INSTITUTIONS
 * ----------------------------------------------------------------------------
 * GENERATED FILE. Do not edit by hand; your edit will be overwritten.
 *
 *   node scripts/import-institutions.mjs MT
 *
 * Source      Wikidata, via the public SPARQL endpoint at
 *             https://query.wikidata.org/sparql
 * Selection   Everything that is a higher education institution
 *             (Q38723 or a subclass), located in Malta (Q233),
 *             with no dissolution date, and with a municipality on record.
 * Fetched     2026-09-10
 * Rows        8
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
    id: "mt-q107424494",
    officialName: "Mediterranean Academy of Diplomatic Studies",
    shortName: null,
    aliases: ["Akkademja Mediterranja tal-Istudji Diplomatiċi", "MEDAC"],
    countryCode: "MT",
    city: "Msida",
    region: "Eastern Region",
    citySlug: null,
    campusSlug: null,
    type: "other",
    website: "https://www.um.edu.mt/medac",
    lat: null,
    lng: null,
    source: "wikidata",
    sourceId: "Q107424494",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "mt-q125957217",
    officialName: "London School of Commerce, Valletta",
    shortName: null,
    aliases: [],
    countryCode: "MT",
    city: "Valletta",
    region: "Port Region",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "https://www.lscmalta.edu.mt/",
    lat: null,
    lng: null,
    source: "wikidata",
    sourceId: "Q125957217",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "mt-q125960086",
    officialName: "St. Martin's Institute of Higher Education",
    shortName: null,
    aliases: [],
    countryCode: "MT",
    city: "Ħamrun",
    region: "Southern Region",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "https://www.stmartins.edu/",
    lat: null,
    lng: null,
    source: "wikidata",
    sourceId: "Q125960086",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "mt-q130387177",
    officialName: "Pegaso International",
    shortName: null,
    aliases: [],
    countryCode: "MT",
    city: "Valletta",
    region: "Port Region",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: null,
    lat: 35.90125,
    lng: 14.51228,
    source: "wikidata",
    sourceId: "Q130387177",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "mt-q138142330",
    officialName: "MED.E.A. University",
    shortName: null,
    aliases: [],
    countryCode: "MT",
    city: "Valletta",
    region: "Port Region",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "https://www.medea-university.eu",
    lat: null,
    lng: null,
    source: "wikidata",
    sourceId: "Q138142330",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "mt-q275868",
    officialName: "International Maritime Law Institute",
    shortName: null,
    aliases: [],
    countryCode: "MT",
    city: "University of Malta",
    region: null,
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: null,
    lat: 35.90233,
    lng: 14.48161,
    source: "wikidata",
    sourceId: "Q275868",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "mt-q426045",
    officialName: "University of Malta",
    shortName: null,
    aliases: ["L-Università ta' Malta", "The University of Malta"],
    countryCode: "MT",
    city: "Msida",
    region: "Eastern Region",
    citySlug: null,
    campusSlug: null,
    type: "university",
    website: "https://www.um.edu.mt/",
    lat: 35.9025,
    lng: 14.48333,
    source: "wikidata",
    sourceId: "Q426045",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
  {
    id: "mt-q56296536",
    officialName: "EDU",
    shortName: null,
    aliases: [],
    countryCode: "MT",
    city: "Kalkara",
    region: "Port Region",
    citySlug: null,
    campusSlug: null,
    type: "other",
    website: null,
    lat: null,
    lng: null,
    source: "wikidata",
    sourceId: "Q56296536",
    verified: false,
    lastUpdatedAt: FETCHED_ON,
  },
];
