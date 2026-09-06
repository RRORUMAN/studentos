/**
 * ============================================================================
 * WORLDWIDE
 * ----------------------------------------------------------------------------
 * StudentOS answers questions about a city from official data and student
 * reports. Neither of those is limited to one continent, so the product is
 * usable in any city from day one — what differs by city is how deep the
 * student layer already is.
 *
 * This file is the single source of truth for that distinction:
 *
 *   depth  "deep"      a full city record exists in data/cities.ts: seeded
 *                      Pulse, map layers, transport card, price anchors.
 *          "live"      the AI, budget, map and arrival checklist all work.
 *                      Pulse is open but still filling up.
 *          "open"      everything works from official data and the student
 *                      layer starts the day the first student posts.
 *
 * Nothing here claims a community that does not exist. `open` is the honest
 * default for the long tail, and the UI prints exactly that word.
 * ============================================================================
 */

export type RegionKey = "europe" | "americas" | "apac" | "mea";

export type CoverageDepth = "deep" | "live" | "open";

export type CoverageCity = {
  name: string;
  country: string;
  /** ISO-3166 alpha-2. */
  countryCode: string;
  /** ISO-4217. Drives the price shown to a student in that city. */
  currency: string;
  /** BCP-47 tag used for number, date and currency formatting. */
  locale: string;
  /** IANA timezone. The planner needs it before it can say "tonight". */
  timezone: string;
  depth: CoverageDepth;
  /** Set when a full city record exists, so the card can link to it. */
  slug?: string;
};

export const coverageDepthLabel: Record<CoverageDepth, string> = {
  deep: "Full city",
  live: "Pulse open",
  open: "Open",
};

export const coverageDepthNote: Record<CoverageDepth, string> = {
  deep: "Seeded map layers, price anchors, transport card and arrival checklist.",
  live: "Everything works. The student layer is still filling up.",
  open: "AI, budget, map and arrival work from official data on day one.",
};

export type Region = {
  key: RegionKey;
  label: string;
  /** One line on what makes student life in this region distinct. */
  note: string;
  /** Approximate student-city count the product can answer for. */
  cities: readonly CoverageCity[];
};

export const regions: readonly Region[] = [
  {
    key: "europe",
    label: "Europe",
    note: "Erasmus moves roughly 300,000 students a year between these cities. Transport passes and free-museum windows are where the money is won.",
    cities: [
      { name: "Madrid", country: "Spain", countryCode: "ES", currency: "EUR", locale: "es-ES", timezone: "Europe/Madrid", depth: "deep", slug: "madrid" },
      { name: "Barcelona", country: "Spain", countryCode: "ES", currency: "EUR", locale: "es-ES", timezone: "Europe/Madrid", depth: "deep", slug: "barcelona" },
      { name: "London", country: "United Kingdom", countryCode: "GB", currency: "GBP", locale: "en-GB", timezone: "Europe/London", depth: "deep", slug: "london" },
      { name: "Amsterdam", country: "Netherlands", countryCode: "NL", currency: "EUR", locale: "nl-NL", timezone: "Europe/Amsterdam", depth: "deep", slug: "amsterdam" },
      { name: "Berlin", country: "Germany", countryCode: "DE", currency: "EUR", locale: "de-DE", timezone: "Europe/Berlin", depth: "deep", slug: "berlin" },
      { name: "Paris", country: "France", countryCode: "FR", currency: "EUR", locale: "fr-FR", timezone: "Europe/Paris", depth: "live" },
      { name: "Lisbon", country: "Portugal", countryCode: "PT", currency: "EUR", locale: "pt-PT", timezone: "Europe/Lisbon", depth: "live" },
      { name: "Milan", country: "Italy", countryCode: "IT", currency: "EUR", locale: "it-IT", timezone: "Europe/Rome", depth: "live" },
      { name: "Vienna", country: "Austria", countryCode: "AT", currency: "EUR", locale: "de-AT", timezone: "Europe/Vienna", depth: "open" },
      { name: "Copenhagen", country: "Denmark", countryCode: "DK", currency: "DKK", locale: "da-DK", timezone: "Europe/Copenhagen", depth: "open" },
      { name: "Stockholm", country: "Sweden", countryCode: "SE", currency: "SEK", locale: "sv-SE", timezone: "Europe/Stockholm", depth: "open" },
      { name: "Warsaw", country: "Poland", countryCode: "PL", currency: "PLN", locale: "pl-PL", timezone: "Europe/Warsaw", depth: "open" },
      { name: "Prague", country: "Czechia", countryCode: "CZ", currency: "CZK", locale: "cs-CZ", timezone: "Europe/Prague", depth: "open" },
      { name: "Dublin", country: "Ireland", countryCode: "IE", currency: "EUR", locale: "en-IE", timezone: "Europe/Dublin", depth: "open" },
      { name: "Zurich", country: "Switzerland", countryCode: "CH", currency: "CHF", locale: "de-CH", timezone: "Europe/Zurich", depth: "open" },
      { name: "Istanbul", country: "Türkiye", countryCode: "TR", currency: "TRY", locale: "tr-TR", timezone: "Europe/Istanbul", depth: "open" },
    ],
  },
  {
    key: "americas",
    label: "Americas",
    note: "Campus-centred rather than city-centred, and the transport question is usually whether you need a car at all.",
    cities: [
      { name: "New York", country: "United States", countryCode: "US", currency: "USD", locale: "en-US", timezone: "America/New_York", depth: "live" },
      { name: "Boston", country: "United States", countryCode: "US", currency: "USD", locale: "en-US", timezone: "America/New_York", depth: "live" },
      { name: "Chicago", country: "United States", countryCode: "US", currency: "USD", locale: "en-US", timezone: "America/Chicago", depth: "open" },
      { name: "Los Angeles", country: "United States", countryCode: "US", currency: "USD", locale: "en-US", timezone: "America/Los_Angeles", depth: "open" },
      { name: "Austin", country: "United States", countryCode: "US", currency: "USD", locale: "en-US", timezone: "America/Chicago", depth: "open" },
      { name: "Toronto", country: "Canada", countryCode: "CA", currency: "CAD", locale: "en-CA", timezone: "America/Toronto", depth: "live" },
      { name: "Montreal", country: "Canada", countryCode: "CA", currency: "CAD", locale: "fr-CA", timezone: "America/Toronto", depth: "open" },
      { name: "Vancouver", country: "Canada", countryCode: "CA", currency: "CAD", locale: "en-CA", timezone: "America/Vancouver", depth: "open" },
      { name: "Mexico City", country: "Mexico", countryCode: "MX", currency: "MXN", locale: "es-MX", timezone: "America/Mexico_City", depth: "open" },
      { name: "São Paulo", country: "Brazil", countryCode: "BR", currency: "BRL", locale: "pt-BR", timezone: "America/Sao_Paulo", depth: "open" },
      { name: "Buenos Aires", country: "Argentina", countryCode: "AR", currency: "ARS", locale: "es-AR", timezone: "America/Argentina/Buenos_Aires", depth: "open" },
      { name: "Santiago", country: "Chile", countryCode: "CL", currency: "CLP", locale: "es-CL", timezone: "America/Santiago", depth: "open" },
      { name: "Bogotá", country: "Colombia", countryCode: "CO", currency: "COP", locale: "es-CO", timezone: "America/Bogota", depth: "open" },
    ],
  },
  {
    key: "apac",
    label: "Asia Pacific",
    cities: [
      { name: "Tokyo", country: "Japan", countryCode: "JP", currency: "JPY", locale: "ja-JP", timezone: "Asia/Tokyo", depth: "live" },
      { name: "Seoul", country: "South Korea", countryCode: "KR", currency: "KRW", locale: "ko-KR", timezone: "Asia/Seoul", depth: "live" },
      { name: "Singapore", country: "Singapore", countryCode: "SG", currency: "SGD", locale: "en-SG", timezone: "Asia/Singapore", depth: "live" },
      { name: "Hong Kong", country: "Hong Kong SAR", countryCode: "HK", currency: "HKD", locale: "en-HK", timezone: "Asia/Hong_Kong", depth: "open" },
      { name: "Sydney", country: "Australia", countryCode: "AU", currency: "AUD", locale: "en-AU", timezone: "Australia/Sydney", depth: "live" },
      { name: "Melbourne", country: "Australia", countryCode: "AU", currency: "AUD", locale: "en-AU", timezone: "Australia/Melbourne", depth: "open" },
      { name: "Auckland", country: "New Zealand", countryCode: "NZ", currency: "NZD", locale: "en-NZ", timezone: "Pacific/Auckland", depth: "open" },
      { name: "Bangkok", country: "Thailand", countryCode: "TH", currency: "THB", locale: "th-TH", timezone: "Asia/Bangkok", depth: "open" },
      { name: "Kuala Lumpur", country: "Malaysia", countryCode: "MY", currency: "MYR", locale: "ms-MY", timezone: "Asia/Kuala_Lumpur", depth: "open" },
      { name: "Delhi", country: "India", countryCode: "IN", currency: "INR", locale: "en-IN", timezone: "Asia/Kolkata", depth: "open" },
      { name: "Bengaluru", country: "India", countryCode: "IN", currency: "INR", locale: "en-IN", timezone: "Asia/Kolkata", depth: "open" },
      { name: "Taipei", country: "Taiwan", countryCode: "TW", currency: "TWD", locale: "zh-TW", timezone: "Asia/Taipei", depth: "open" },
    ],
    note: "The widest spread of student costs anywhere: the same evening can be a tenth of the price two flights away.",
  },
  {
    key: "mea",
    label: "Middle East & Africa",
    note: "Fast-growing international campuses, and the cities where an official source matters most because listings go out of date quickest.",
    cities: [
      { name: "Dubai", country: "United Arab Emirates", countryCode: "AE", currency: "AED", locale: "en-AE", timezone: "Asia/Dubai", depth: "live" },
      { name: "Abu Dhabi", country: "United Arab Emirates", countryCode: "AE", currency: "AED", locale: "en-AE", timezone: "Asia/Dubai", depth: "open" },
      { name: "Doha", country: "Qatar", countryCode: "QA", currency: "QAR", locale: "en-QA", timezone: "Asia/Qatar", depth: "open" },
      { name: "Tel Aviv", country: "Israel", countryCode: "IL", currency: "ILS", locale: "he-IL", timezone: "Asia/Jerusalem", depth: "open" },
      { name: "Cairo", country: "Egypt", countryCode: "EG", currency: "EGP", locale: "ar-EG", timezone: "Africa/Cairo", depth: "open" },
      { name: "Cape Town", country: "South Africa", countryCode: "ZA", currency: "ZAR", locale: "en-ZA", timezone: "Africa/Johannesburg", depth: "open" },
      { name: "Johannesburg", country: "South Africa", countryCode: "ZA", currency: "ZAR", locale: "en-ZA", timezone: "Africa/Johannesburg", depth: "open" },
      { name: "Nairobi", country: "Kenya", countryCode: "KE", currency: "KES", locale: "en-KE", timezone: "Africa/Nairobi", depth: "open" },
      { name: "Lagos", country: "Nigeria", countryCode: "NG", currency: "NGN", locale: "en-NG", timezone: "Africa/Lagos", depth: "open" },
      { name: "Accra", country: "Ghana", countryCode: "GH", currency: "GHS", locale: "en-GH", timezone: "Africa/Accra", depth: "open" },
      { name: "Casablanca", country: "Morocco", countryCode: "MA", currency: "MAD", locale: "fr-MA", timezone: "Africa/Casablanca", depth: "open" },
    ],
  },
] as const;

export const allCoverageCities: readonly CoverageCity[] = regions.flatMap(
  (region) => region.cities,
);

/** Distinct currencies the price and budget layers already format correctly. */
export const supportedCurrencies: readonly string[] = Array.from(
  new Set(allCoverageCities.map((city) => city.currency)),
).sort();

/** Distinct locales, which is also the list of number and date formats. */
export const supportedLocales: readonly string[] = Array.from(
  new Set(allCoverageCities.map((city) => city.locale)),
).sort();

/**
 * Interface languages. Kept separate from `supportedLocales` on purpose: a
 * student in Tokyo can read the app in English while every price, date and fare
 * renders in yen and Japanese formatting. Conflating the two is how products
 * end up showing euro prices to someone standing in Seoul.
 */
export const interfaceLanguages = [
  { code: "en", label: "English", endonym: "English" },
  { code: "es", label: "Spanish", endonym: "Español" },
  { code: "fr", label: "French", endonym: "Français" },
  { code: "de", label: "German", endonym: "Deutsch" },
  { code: "pt", label: "Portuguese", endonym: "Português" },
  { code: "it", label: "Italian", endonym: "Italiano" },
  { code: "nl", label: "Dutch", endonym: "Nederlands" },
  { code: "pl", label: "Polish", endonym: "Polski" },
  { code: "tr", label: "Turkish", endonym: "Türkçe" },
  { code: "ar", label: "Arabic", endonym: "العربية", rtl: true },
  { code: "he", label: "Hebrew", endonym: "עברית", rtl: true },
  { code: "zh", label: "Chinese", endonym: "中文" },
  { code: "ja", label: "Japanese", endonym: "日本語" },
  { code: "ko", label: "Korean", endonym: "한국어" },
  { code: "hi", label: "Hindi", endonym: "हिन्दी" },
  { code: "th", label: "Thai", endonym: "ไทย" },
] as const;

export const rtlLanguages = interfaceLanguages
  .filter((language) => "rtl" in language && language.rtl)
  .map((language) => language.code);

export function citiesForRegion(key: RegionKey): readonly CoverageCity[] {
  return regions.find((region) => region.key === key)?.cities ?? [];
}

export function findCoverageCity(name: string): CoverageCity | undefined {
  const needle = name.trim().toLowerCase();
  return allCoverageCities.find((city) => city.name.toLowerCase() === needle);
}

/**
 * Counts printed in the coverage UI. Derived, never typed by hand, so the
 * headline can never drift from the list underneath it.
 */
export const coverageStats = {
  regions: regions.length,
  cities: allCoverageCities.length,
  countries: new Set(allCoverageCities.map((city) => city.countryCode)).size,
  currencies: supportedCurrencies.length,
  languages: interfaceLanguages.length,
  deepCities: allCoverageCities.filter((city) => city.depth === "deep").length,
} as const;
