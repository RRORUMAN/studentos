/**
 * ============================================================================
 * FORMAT LOCALE
 * ----------------------------------------------------------------------------
 * The locale numbers and money are formatted in. It follows the student's
 * interface language, not the city: an English-interface student in Madrid
 * reads "€900", a Spanish-interface one reads "900 €". The currency itself
 * always comes from the city.
 *
 * Pure and dependency-free so the unit tests can import it directly.
 * ============================================================================
 */
export function formatLocaleFor(
  language: string | null | undefined,
  city: { locale: string; currency: { code: string } },
): string {
  const lang = (language ?? "en").toLowerCase().split("-")[0];
  if (lang === "en") return city.currency.code === "USD" ? "en-US" : "en-GB";
  if (city.locale.toLowerCase().startsWith(`${lang}-`)) return city.locale;
  try {
    return Intl.NumberFormat.supportedLocalesOf([lang]).length > 0 ? lang : city.locale;
  } catch {
    return city.locale;
  }
}
