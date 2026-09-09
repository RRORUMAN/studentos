import type { InstitutionType } from "@/domain/institutions";

/**
 * ============================================================================
 * CURATED INSTITUTIONS
 * ----------------------------------------------------------------------------
 * The institutions StudentOS knows the location of.
 *
 * This is the old hand-typed campus list, and it survives the arrival of an
 * imported registry because it holds one thing the registry does not: which
 * campus row each institution maps to, and therefore which neighbourhood its
 * students commute from. `area` on a `Campus` feeds the commute figures in
 * `src/server/engines/neighbourhood.ts`, so it may only be written by somebody
 * who checked -- see the note at the top of `src/domain/institutions.ts`.
 *
 * A row here therefore stays SHORT. It is an assertion about geography and a
 * couple of names students actually say; everything else -- website,
 * coordinates, alternative spellings, official name in the regional language --
 * is filled in from the imported row by `index.ts` when the two match. Adding a
 * university here without checking where its buildings are is the one mistake
 * this file exists to prevent.
 *
 * `aliases` here are the ones a registry will never hold: what students call
 * the place out loud. "La Complu" is not in any dataset.
 * ============================================================================
 */

export type CuratedInstitution = {
  /** Becomes the institution id, prefixed with the country: "es-ucm". */
  slug: string;
  officialName: string;
  shortName: string;
  /** Spoken names. Registry spellings arrive from the import instead. */
  aliases: readonly string[];
  countryCode: string;
  /** The municipality the buildings are in. */
  city: string;
  /** The StudentOS city whose data serves these students. */
  citySlug: string;
  /** The row in `campuses` that knows the neighbourhood. */
  campusSlug: string;
  type: InstitutionType;
};

export const curated: readonly CuratedInstitution[] = [
  /* --- Madrid ----------------------------------------------------------- */
  { slug: "ucm", officialName: "Universidad Complutense de Madrid", shortName: "Complutense", aliases: ["La Complu", "Complu"], countryCode: "ES", city: "Madrid", citySlug: "madrid", campusSlug: "ucm", type: "university" },
  { slug: "uam", officialName: "Universidad Autónoma de Madrid", shortName: "Autónoma", aliases: ["La Autónoma", "Cantoblanco"], countryCode: "ES", city: "Madrid", citySlug: "madrid", campusSlug: "uam", type: "university" },
  { slug: "uc3m", officialName: "Universidad Carlos III de Madrid", shortName: "Carlos III", aliases: ["La Carlos", "Carlos Tercero"], countryCode: "ES", city: "Getafe", citySlug: "madrid", campusSlug: "uc3m", type: "university" },
  { slug: "upm", officialName: "Universidad Politécnica de Madrid", shortName: "Politécnica", aliases: ["La Poli"], countryCode: "ES", city: "Madrid", citySlug: "madrid", campusSlug: "upm", type: "university" },
  { slug: "urjc", officialName: "Universidad Rey Juan Carlos", shortName: "Rey Juan Carlos", aliases: ["La Juan Carlos"], countryCode: "ES", city: "Móstoles", citySlug: "madrid", campusSlug: "urjc", type: "university" },
  { slug: "uah", officialName: "Universidad de Alcalá", shortName: "Alcalá", aliases: ["La Alcalá"], countryCode: "ES", city: "Alcalá de Henares", citySlug: "madrid", campusSlug: "uah", type: "university" },
  { slug: "comillas", officialName: "Universidad Pontificia Comillas", shortName: "Comillas", aliases: ["ICADE", "ICAI"], countryCode: "ES", city: "Madrid", citySlug: "madrid", campusSlug: "comillas", type: "university" },
  { slug: "ceu-usp", officialName: "Universidad CEU San Pablo", shortName: "CEU San Pablo", aliases: ["San Pablo CEU"], countryCode: "ES", city: "Alcorcón", citySlug: "madrid", campusSlug: "ceu-usp", type: "university" },
  { slug: "uem", officialName: "Universidad Europea de Madrid", shortName: "Europea", aliases: ["La Europea"], countryCode: "ES", city: "Villaviciosa de Odón", citySlug: "madrid", campusSlug: "uem", type: "university" },
  { slug: "ufv", officialName: "Universidad Francisco de Vitoria", shortName: "Francisco de Vitoria", aliases: [], countryCode: "ES", city: "Pozuelo de Alarcón", citySlug: "madrid", campusSlug: "ufv", type: "university" },
  { slug: "nebrija", officialName: "Universidad Antonio de Nebrija", shortName: "Nebrija", aliases: [], countryCode: "ES", city: "Madrid", citySlug: "madrid", campusSlug: "nebrija", type: "university" },
  { slug: "uax", officialName: "Universidad Alfonso X el Sabio", shortName: "Alfonso X", aliases: ["La Alfonso X"], countryCode: "ES", city: "Villanueva de la Cañada", citySlug: "madrid", campusSlug: "uax", type: "university" },
  { slug: "ucjc", officialName: "Universidad Camilo José Cela", shortName: "Camilo José Cela", aliases: [], countryCode: "ES", city: "Villanueva de la Cañada", citySlug: "madrid", campusSlug: "ucjc", type: "university" },
  { slug: "ie-madrid", officialName: "IE University", shortName: "IE", aliases: ["IE Business School", "Instituto de Empresa"], countryCode: "ES", city: "Madrid", citySlug: "madrid", campusSlug: "ie-madrid", type: "business-school" },
  { slug: "uned", officialName: "Universidad Nacional de Educación a Distancia", shortName: "UNED", aliases: [], countryCode: "ES", city: "Madrid", citySlug: "madrid", campusSlug: "uned", type: "university" },

  /* --- Barcelona -------------------------------------------------------- */
  { slug: "ub", officialName: "Universitat de Barcelona", shortName: "UB", aliases: ["La Central"], countryCode: "ES", city: "Barcelona", citySlug: "barcelona", campusSlug: "ub", type: "university" },
  { slug: "upf", officialName: "Universitat Pompeu Fabra", shortName: "Pompeu Fabra", aliases: ["La Pompeu"], countryCode: "ES", city: "Barcelona", citySlug: "barcelona", campusSlug: "upf", type: "university" },
  { slug: "upc", officialName: "Universitat Politècnica de Catalunya", shortName: "UPC", aliases: ["BarcelonaTech", "La Politècnica"], countryCode: "ES", city: "Barcelona", citySlug: "barcelona", campusSlug: "upc", type: "university" },
  { slug: "uab", officialName: "Universitat Autònoma de Barcelona", shortName: "Autònoma", aliases: ["Bellaterra"], countryCode: "ES", city: "Cerdanyola del Vallès", citySlug: "barcelona", campusSlug: "uab", type: "university" },
  { slug: "uoc", officialName: "Universitat Oberta de Catalunya", shortName: "UOC", aliases: [], countryCode: "ES", city: "Barcelona", citySlug: "barcelona", campusSlug: "uoc", type: "university" },
  { slug: "url-esade", officialName: "Universitat Ramon Llull", shortName: "Ramon Llull", aliases: ["ESADE", "La Salle", "Blanquerna"], countryCode: "ES", city: "Barcelona", citySlug: "barcelona", campusSlug: "url-esade", type: "university" },

  /* --- London ----------------------------------------------------------- */
  { slug: "ucl", officialName: "University College London", shortName: "UCL", aliases: [], countryCode: "GB", city: "London", citySlug: "london", campusSlug: "ucl", type: "university" },
  { slug: "kcl", officialName: "King's College London", shortName: "KCL", aliases: ["Kings"], countryCode: "GB", city: "London", citySlug: "london", campusSlug: "kcl", type: "university" },
  { slug: "qmul", officialName: "Queen Mary University of London", shortName: "Queen Mary", aliases: ["QM"], countryCode: "GB", city: "London", citySlug: "london", campusSlug: "qmul", type: "university" },
  { slug: "imperial", officialName: "Imperial College London", shortName: "Imperial", aliases: [], countryCode: "GB", city: "London", citySlug: "london", campusSlug: "imperial", type: "university" },
  { slug: "lse", officialName: "London School of Economics and Political Science", shortName: "LSE", aliases: [], countryCode: "GB", city: "London", citySlug: "london", campusSlug: "lse", type: "university" },
  { slug: "city", officialName: "City St George's, University of London", shortName: "City", aliases: ["City University"], countryCode: "GB", city: "London", citySlug: "london", campusSlug: "city", type: "university" },
  { slug: "soas", officialName: "SOAS University of London", shortName: "SOAS", aliases: [], countryCode: "GB", city: "London", citySlug: "london", campusSlug: "soas", type: "university" },
  { slug: "westminster", officialName: "University of Westminster", shortName: "Westminster", aliases: [], countryCode: "GB", city: "London", citySlug: "london", campusSlug: "westminster", type: "university" },

  /* --- Amsterdam -------------------------------------------------------- */
  { slug: "uva", officialName: "Universiteit van Amsterdam", shortName: "UvA", aliases: [], countryCode: "NL", city: "Amsterdam", citySlug: "amsterdam", campusSlug: "uva", type: "university" },
  { slug: "vu", officialName: "Vrije Universiteit Amsterdam", shortName: "VU", aliases: [], countryCode: "NL", city: "Amsterdam", citySlug: "amsterdam", campusSlug: "vu", type: "university" },
  { slug: "hva", officialName: "Hogeschool van Amsterdam", shortName: "HvA", aliases: ["AUAS"], countryCode: "NL", city: "Amsterdam", citySlug: "amsterdam", campusSlug: "hva", type: "applied-sciences" },

  /* --- Berlin ----------------------------------------------------------- */
  { slug: "hu", officialName: "Humboldt-Universität zu Berlin", shortName: "Humboldt", aliases: ["HU Berlin"], countryCode: "DE", city: "Berlin", citySlug: "berlin", campusSlug: "hu", type: "university" },
  { slug: "fu", officialName: "Freie Universität Berlin", shortName: "Freie", aliases: ["FU Berlin"], countryCode: "DE", city: "Berlin", citySlug: "berlin", campusSlug: "fu", type: "university" },
  { slug: "tu", officialName: "Technische Universität Berlin", shortName: "TU Berlin", aliases: [], countryCode: "DE", city: "Berlin", citySlug: "berlin", campusSlug: "tu", type: "university" },
  { slug: "htw", officialName: "Hochschule für Technik und Wirtschaft Berlin", shortName: "HTW", aliases: [], countryCode: "DE", city: "Berlin", citySlug: "berlin", campusSlug: "htw", type: "applied-sciences" },
  { slug: "hwr", officialName: "Hochschule für Wirtschaft und Recht Berlin", shortName: "HWR", aliases: [], countryCode: "DE", city: "Berlin", citySlug: "berlin", campusSlug: "hwr", type: "applied-sciences" },
  { slug: "charite", officialName: "Charité – Universitätsmedizin Berlin", shortName: "Charité", aliases: [], countryCode: "DE", city: "Berlin", citySlug: "berlin", campusSlug: "charite", type: "university" },
] as const;
