import { allCoverageCities, type CoverageCity } from "@/config/regions";

import type { Campus, City, CityContext, CityStatus } from "./types";

/**
 * ============================================================================
 * CITIES
 * ----------------------------------------------------------------------------
 * Two layers, one honest story:
 *
 *   `cities`          the five with FULL local data — seeded places, events,
 *                     deals, guides, price anchors, a transport card, campuses.
 *   `cityDirectory`   every city a student can pick, built from the worldwide
 *                     coverage list: currency, locale, timezone, languages, and
 *                     a status that says exactly how much is there.
 *
 * `resolveCity(slug)` merges the two into a `CityContext` for the signed-in
 * product. A coming-soon city gets null anchors and an empty neighbourhood
 * list, and every surface handles that rather than printing an invented
 * number. Availability is stated with `status`; nothing claims a community
 * that does not exist.
 * ============================================================================
 */

export const cityStatusLabel: Record<CityStatus, string> = {
  "coming-soon": "Coming soon",
  beta: "Beta",
  live: "Live",
  "high-density": "High density",
};

export const cityStatusNote: Record<CityStatus, string> = {
  "coming-soon": "Budget, planner and Arrival Mode work from official data. Pulse opens with the first post; local places and events fill in as students add them.",
  beta: "Full local data. The community is still filling up.",
  live: "Full local data and an active community.",
  "high-density": "Live, with enough students that friends-of-friends and campus signals are meaningful.",
};

/** Languages a student will meet, by country. Most common first. */
const LANGUAGES: Record<string, readonly string[]> = {
  ES: ["Spanish", "English"],
  GB: ["English"],
  NL: ["Dutch", "English"],
  DE: ["German", "English"],
  FR: ["French", "English"],
  PT: ["Portuguese", "English"],
  IT: ["Italian", "English"],
  AT: ["German", "English"],
  DK: ["Danish", "English"],
  SE: ["Swedish", "English"],
  PL: ["Polish", "English"],
  CZ: ["Czech", "English"],
  IE: ["English", "Irish"],
  BE: ["French", "Dutch", "English"],
  HU: ["Hungarian", "English"],
  FI: ["Finnish", "Swedish", "English"],
  EE: ["Estonian", "English"],
  CH: ["German", "French", "Italian", "English"],
  TR: ["Turkish", "English"],
  US: ["English", "Spanish"],
  CA: ["English", "French"],
  MX: ["Spanish"],
  BR: ["Portuguese"],
  AR: ["Spanish"],
  CL: ["Spanish"],
  CO: ["Spanish"],
  JP: ["Japanese", "English"],
  KR: ["Korean", "English"],
  SG: ["English", "Mandarin", "Malay", "Tamil"],
  HK: ["Cantonese", "English"],
  AU: ["English"],
  NZ: ["English", "Māori"],
  TH: ["Thai", "English"],
  MY: ["Malay", "English"],
  IN: ["Hindi", "English"],
  TW: ["Mandarin", "English"],
  AE: ["Arabic", "English"],
  QA: ["Arabic", "English"],
  IL: ["Hebrew", "English", "Arabic"],
  EG: ["Arabic", "English"],
  ZA: ["English", "Afrikaans", "Zulu"],
  KE: ["Swahili", "English"],
  NG: ["English"],
  GH: ["English"],
  MA: ["Arabic", "French"],
};

export const cities: readonly City[] = [
  {
    slug: "madrid",
    name: "Madrid",
    country: "Spain",
    countryCode: "ES",
    currency: { code: "EUR", symbol: "€" },
    locale: "es-ES",
    timezone: "Europe/Madrid",
    languages: LANGUAGES.ES,
    status: "live",
    hook: "Late dinners, free museums, and a metro that makes distance irrelevant.",
    intro:
      "Madrid is cheap if you know where to stand and expensive if you do not. The gap between a tourist evening and a student evening here is about fifteen euro, and it comes down to which streets you walk down after 21:00.",
    anchors: { lunch: [8, 13], pint: [2.5, 5], monthlyTransport: 20, weeklyGroceries: [28, 45], singleFare: 1.5 },
    neighbourhoods: ["Malasaña", "Lavapiés", "Chamberí", "Moncloa", "La Latina", "Argüelles"],
    campusSlugs: ["ucm", "uam", "uc3m", "upm"],
    transport: { card: "Abono Joven", studentNote: "Under 26 gets the whole region for a flat monthly fee.", officialUrl: "https://www.crtm.es/" },
    mapSeed: 11,
  },
  {
    slug: "barcelona",
    name: "Barcelona",
    country: "Spain",
    countryCode: "ES",
    currency: { code: "EUR", symbol: "€" },
    locale: "es-ES",
    timezone: "Europe/Madrid",
    languages: ["Catalan", "Spanish", "English"],
    status: "live",
    hook: "A city where the free version of the evening is usually the better one.",
    intro:
      "Barcelona punishes students who plan their nights on the main streets. Two blocks inland the same evening costs half as much, and the beach is free until it is not.",
    anchors: { lunch: [9, 14], pint: [3, 5.5], monthlyTransport: 22, weeklyGroceries: [30, 48], singleFare: 1.25 },
    neighbourhoods: ["Gràcia", "El Raval", "Poblenou", "Sants", "El Born"],
    campusSlugs: ["ub", "upf", "upc"],
    transport: { card: "T-Jove", studentNote: "90 days of unlimited travel for under 25s.", officialUrl: "https://www.tmb.cat/en/barcelona-fares-metro-bus" },
    mapSeed: 23,
  },
  {
    slug: "london",
    name: "London",
    country: "United Kingdom",
    countryCode: "GB",
    currency: { code: "GBP", symbol: "£" },
    locale: "en-GB",
    timezone: "Europe/London",
    languages: LANGUAGES.GB,
    status: "beta",
    hook: "The most expensive city on this list and the one with the most free things in it.",
    intro:
      "London rewards students who know which museums, viewpoints and gigs cost nothing. The difference between a good week and a broke week here is almost entirely transport and lunch.",
    anchors: { lunch: [7, 12], pint: [5, 7], monthlyTransport: 100, weeklyGroceries: [30, 50], singleFare: 2.8 },
    neighbourhoods: ["Bloomsbury", "Peckham", "Shoreditch", "Camden", "New Cross"],
    campusSlugs: ["ucl", "kcl", "qmul"],
    transport: { card: "18+ Student Oyster", studentNote: "30% off travelcards and bus passes once your uni verifies you.", officialUrl: "https://tfl.gov.uk/fares/free-and-discounted-travel" },
    mapSeed: 37,
  },
  {
    slug: "amsterdam",
    name: "Amsterdam",
    country: "Netherlands",
    countryCode: "NL",
    currency: { code: "EUR", symbol: "€" },
    locale: "nl-NL",
    timezone: "Europe/Amsterdam",
    languages: LANGUAGES.NL,
    status: "beta",
    hook: "Buy the bike in week one. Everything else follows from that.",
    intro:
      "Amsterdam is small enough that transport costs are optional and expensive enough that groceries are not. Student life here happens in association bars and living rooms more than in restaurants.",
    anchors: { lunch: [8, 13], pint: [4, 6], monthlyTransport: 0, weeklyGroceries: [35, 55], singleFare: 0 },
    neighbourhoods: ["De Pijp", "Oost", "Westerpark", "Noord", "Bijlmer"],
    campusSlugs: ["uva", "vu"],
    transport: { card: "A second-hand bike", studentNote: "Cheaper than any pass. Budget for two locks, not one.", officialUrl: "https://www.iamsterdam.com/en/travel-stay/getting-around" },
    mapSeed: 51,
  },
  {
    slug: "berlin",
    name: "Berlin",
    country: "Germany",
    countryCode: "DE",
    currency: { code: "EUR", symbol: "€" },
    locale: "de-DE",
    timezone: "Europe/Berlin",
    languages: LANGUAGES.DE,
    status: "beta",
    hook: "Your semester ticket is already paid for. Use it like it is free.",
    intro:
      "Berlin spreads students across districts that each feel like a different city. The semester ticket makes distance free, so the real budget question is food and door prices.",
    anchors: { lunch: [6, 11], pint: [3, 5], monthlyTransport: 0, weeklyGroceries: [28, 45], singleFare: 0 },
    neighbourhoods: ["Neukölln", "Kreuzberg", "Wedding", "Friedrichshain", "Charlottenburg"],
    campusSlugs: ["hu", "fu", "tu"],
    transport: { card: "Semesterticket", studentNote: "Included in most semester fees. Check before buying anything else.", officialUrl: "https://www.bvg.de/en/tickets-and-fares" },
    mapSeed: 67,
  },
] as const;

/**
 * Universities the product knows the location of.
 *
 * This list exists to be *searched*, not to be complete. Madrid alone has more
 * than thirty institutions and no seeded list will ever cover a whole sector. A
 * student whose university is missing types it, and it is stored on their
 * profile as `universityName` with no `campusSlug`.
 *
 * That distinction is why this list stays conservative rather than long. A row
 * here claims to know where the buildings are, and `area` feeds the commute
 * figures in the neighbourhood engine. Adding an institution with a guessed
 * neighbourhood would produce a confident "18 min from campus" derived from
 * nothing, which serves that student worse than not being listed at all. Every
 * row names the campus its own students would name; where an institution has
 * several, it is the principal one.
 */
export const campuses: readonly Campus[] = [
  /* --- Madrid ----------------------------------------------------------- */
  { slug: "ucm", name: "Universidad Complutense de Madrid", shortName: "Complutense", citySlug: "madrid", area: "Moncloa" },
  { slug: "uam", name: "Universidad Autónoma de Madrid", shortName: "Autónoma", citySlug: "madrid", area: "Cantoblanco" },
  { slug: "uc3m", name: "Universidad Carlos III de Madrid", shortName: "Carlos III", citySlug: "madrid", area: "Getafe" },
  { slug: "upm", name: "Universidad Politécnica de Madrid", shortName: "Politécnica", citySlug: "madrid", area: "Ciudad Universitaria" },
  { slug: "urjc", name: "Universidad Rey Juan Carlos", shortName: "Rey Juan Carlos", citySlug: "madrid", area: "Móstoles" },
  { slug: "uah", name: "Universidad de Alcalá", shortName: "Alcalá", citySlug: "madrid", area: "Alcalá de Henares" },
  { slug: "comillas", name: "Universidad Pontificia Comillas (ICADE)", shortName: "Comillas", citySlug: "madrid", area: "Chamberí" },
  { slug: "ceu-usp", name: "Universidad CEU San Pablo", shortName: "CEU San Pablo", citySlug: "madrid", area: "Montepríncipe" },
  { slug: "uem", name: "Universidad Europea de Madrid", shortName: "Europea", citySlug: "madrid", area: "Villaviciosa de Odón" },
  { slug: "ufv", name: "Universidad Francisco de Vitoria", shortName: "Francisco de Vitoria", citySlug: "madrid", area: "Pozuelo de Alarcón" },
  { slug: "nebrija", name: "Universidad Antonio de Nebrija", shortName: "Nebrija", citySlug: "madrid", area: "Princesa" },
  { slug: "uax", name: "Universidad Alfonso X el Sabio", shortName: "Alfonso X", citySlug: "madrid", area: "Villanueva de la Cañada" },
  { slug: "ucjc", name: "Universidad Camilo José Cela", shortName: "Camilo José Cela", citySlug: "madrid", area: "Villafranca del Castillo" },
  { slug: "ie-madrid", name: "IE University (Madrid)", shortName: "IE", citySlug: "madrid", area: "Chamartín" },
  { slug: "uned", name: "Universidad Nacional de Educación a Distancia", shortName: "UNED", citySlug: "madrid", area: "Ciudad Universitaria" },

  /* --- Barcelona -------------------------------------------------------- */
  { slug: "ub", name: "Universitat de Barcelona", shortName: "UB", citySlug: "barcelona", area: "Raval" },
  { slug: "upf", name: "Universitat Pompeu Fabra", shortName: "Pompeu Fabra", citySlug: "barcelona", area: "Ciutadella" },
  { slug: "upc", name: "Universitat Politècnica de Catalunya", shortName: "UPC", citySlug: "barcelona", area: "Les Corts" },
  { slug: "uab", name: "Universitat Autònoma de Barcelona", shortName: "Autònoma", citySlug: "barcelona", area: "Bellaterra" },
  { slug: "uoc", name: "Universitat Oberta de Catalunya", shortName: "UOC", citySlug: "barcelona", area: "Poblenou" },
  { slug: "url-esade", name: "Universitat Ramon Llull (ESADE)", shortName: "Ramon Llull", citySlug: "barcelona", area: "Sant Cugat" },

  /* --- London ----------------------------------------------------------- */
  { slug: "ucl", name: "University College London", shortName: "UCL", citySlug: "london", area: "Bloomsbury" },
  { slug: "kcl", name: "King's College London", shortName: "KCL", citySlug: "london", area: "Strand" },
  { slug: "qmul", name: "Queen Mary University of London", shortName: "Queen Mary", citySlug: "london", area: "Mile End" },
  { slug: "imperial", name: "Imperial College London", shortName: "Imperial", citySlug: "london", area: "South Kensington" },
  { slug: "lse", name: "London School of Economics", shortName: "LSE", citySlug: "london", area: "Holborn" },
  { slug: "city", name: "City, University of London", shortName: "City", citySlug: "london", area: "Islington" },
  { slug: "soas", name: "SOAS University of London", shortName: "SOAS", citySlug: "london", area: "Bloomsbury" },
  { slug: "westminster", name: "University of Westminster", shortName: "Westminster", citySlug: "london", area: "Marylebone" },

  /* --- Amsterdam -------------------------------------------------------- */
  { slug: "uva", name: "Universiteit van Amsterdam", shortName: "UvA", citySlug: "amsterdam", area: "Roeterseiland" },
  { slug: "vu", name: "Vrije Universiteit Amsterdam", shortName: "VU", citySlug: "amsterdam", area: "Zuidas" },
  { slug: "hva", name: "Hogeschool van Amsterdam", shortName: "HvA", citySlug: "amsterdam", area: "Amstelcampus" },

  /* --- Berlin ----------------------------------------------------------- */
  { slug: "hu", name: "Humboldt-Universität zu Berlin", shortName: "Humboldt", citySlug: "berlin", area: "Mitte" },
  { slug: "fu", name: "Freie Universität Berlin", shortName: "Freie", citySlug: "berlin", area: "Dahlem" },
  { slug: "tu", name: "Technische Universität Berlin", shortName: "TU Berlin", citySlug: "berlin", area: "Charlottenburg" },
  { slug: "htw", name: "Hochschule für Technik und Wirtschaft Berlin", shortName: "HTW", citySlug: "berlin", area: "Oberschöneweide" },
  { slug: "hwr", name: "Hochschule für Wirtschaft und Recht Berlin", shortName: "HWR", citySlug: "berlin", area: "Schöneberg" },
  { slug: "charite", name: "Charité – Universitätsmedizin Berlin", shortName: "Charité", citySlug: "berlin", area: "Mitte" },
] as const;

/* -------------------------------------------------------------------------- */
/* Directory                                                                   */
/* -------------------------------------------------------------------------- */

/** Stable slug from a city name: "São Paulo" → "sao-paulo". */
export function citySlugFor(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Currency symbol for a code, via Intl. Falls back to the code. */
function symbolFor(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0 }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Deterministic map seed from a slug, so a directory city draws the same way every time. */
function seedFor(slug: string): number {
  return [...slug].reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 997, 7) + 1;
}

function fromCoverage(entry: CoverageCity): CityContext {
  const slug = entry.slug ?? citySlugFor(entry.name);
  return {
    slug,
    name: entry.name,
    country: entry.country,
    countryCode: entry.countryCode,
    currency: { code: entry.currency, symbol: symbolFor(entry.currency, entry.locale) },
    locale: entry.locale,
    timezone: entry.timezone,
    languages: LANGUAGES[entry.countryCode] ?? ["English"],
    status: "coming-soon",
    anchors: null,
    neighbourhoods: [],
    campusSlugs: [],
    transport: null,
    mapSeed: seedFor(slug),
    deep: false,
  };
}

function fromCity(city: City): CityContext {
  return {
    slug: city.slug,
    name: city.name,
    country: city.country,
    countryCode: city.countryCode,
    currency: city.currency,
    locale: city.locale,
    timezone: city.timezone,
    languages: city.languages,
    status: city.status,
    anchors: city.anchors,
    neighbourhoods: city.neighbourhoods,
    campusSlugs: city.campusSlugs,
    transport: city.transport,
    mapSeed: city.mapSeed,
    deep: true,
  };
}

/**
 * Every city a student can pick. Deep records first, then the coverage list,
 * de-duplicated by slug. Sorted by status (most complete first), then name.
 */
export const cityDirectory: readonly CityContext[] = (() => {
  const bySlug = new Map<string, CityContext>();
  for (const city of cities) bySlug.set(city.slug, fromCity(city));
  for (const entry of allCoverageCities) {
    const context = fromCoverage(entry);
    if (!bySlug.has(context.slug)) bySlug.set(context.slug, context);
  }
  const rank: Record<CityStatus, number> = { "high-density": 0, live: 1, beta: 2, "coming-soon": 3 };
  return [...bySlug.values()].sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name));
})();

/** Full record, deep cities only. Marketing pages use this. */
export function getCity(slug: string): City | undefined {
  return cities.find((city) => city.slug === slug);
}

/** Any city a student can pick, deep or coming soon. Null for an unknown slug. */
export function resolveCity(slug: string): CityContext | null {
  return cityDirectory.find((city) => city.slug === slug) ?? null;
}

export function getCampus(slug: string): Campus | undefined {
  return campuses.find((campus) => campus.slug === slug);
}

export function campusesForCity(citySlug: string): Campus[] {
  return campuses.filter((campus) => campus.citySlug === citySlug);
}

/** Cities grouped by country, for a picker. */
export function citiesByCountry(): { country: string; countryCode: string; cities: CityContext[] }[] {
  const groups = new Map<string, { country: string; countryCode: string; cities: CityContext[] }>();
  for (const city of cityDirectory) {
    const group = groups.get(city.countryCode) ?? { country: city.country, countryCode: city.countryCode, cities: [] };
    group.cities.push(city);
    groups.set(city.countryCode, group);
  }
  return [...groups.values()].sort((a, b) => a.country.localeCompare(b.country));
}

/** Madrid is the demo city used across the marketing experience. */
export const defaultCity = cities[0];
export const defaultCityContext: CityContext = fromCity(cities[0]);

export { formatLocaleFor } from "@/lib/locale";
