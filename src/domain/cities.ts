import { fold } from "@/domain/institutions";

/**
 * ============================================================================
 * CITY SEARCH
 * ----------------------------------------------------------------------------
 * Finding a city by typing part of its name, without spelling it correctly.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AS A MODULE
 *
 * The onboarding search was `name.toLowerCase().includes(query)`, which was
 * fine for a list of cities that happened to have no accents in them. The
 * geography import added Málaga, Kraków, São Paulo, Bogotá and Zürich, and on
 * that day the search silently stopped finding five cities: a student in
 * Málaga typing "malaga" got "Not on the list yet", which is the product
 * telling a lie about its own coverage.
 *
 * So the same folding the institution search already uses, and the same
 * principle behind it: the student is not spelling, they are remembering.
 *
 * ---------------------------------------------------------------------------
 * THE ONE RULE ABOUT ORDER
 *
 * A prefix beats a substring, everywhere. Typing "bo" should offer Bologna and
 * Bogotá before Lisbon, even though all three contain the letters — a search
 * that ranks by nothing in particular makes a student read the whole list, and
 * reading the whole list is what the search was for.
 * ============================================================================
 */

/** The shape this search needs. Anything with these fields can be searched. */
export type SearchableCity = {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  /** True for a city with seeded local content behind it. Breaks ties. */
  deep?: boolean;
};

export type CityHit<T extends SearchableCity> = {
  city: T;
  score: number;
  /** Which field matched, so the row can show the country when that is why. */
  matched: "name" | "country" | "alias";
};

/**
 * English exonyms and the spellings people actually type.
 *
 * Only entries a fold cannot already reach. "Munchen" folds to the same string
 * as "München" and needs nothing; "Munich" is a different word and does. The
 * list is short on purpose — every entry is a claim that somebody would type
 * that, and a long list of guesses is worse than a short list of observations.
 */
/**
 * Names a city is also known by, folded on use.
 *
 * Exported because more than one thing needs it: the city search a student
 * types into, and the job adapter deciding whether a posting that says
 * "Munchen" belongs to Munich. A second copy of this table is a second place
 * to forget Koln.
 */
export const CITY_ALIASES: Record<string, readonly string[]> = {
  munich: ["munchen", "muenchen"],
  cologne: ["koln", "koeln"],
  vienna: ["wien"],
  prague: ["praha"],
  warsaw: ["warszawa"],
  krakow: ["cracow"],
  lisbon: ["lisboa"],
  seville: ["sevilla"],
  florence: ["firenze"],
  rome: ["roma"],
  milan: ["milano"],
  turin: ["torino"],
  copenhagen: ["kobenhavn"],
  zurich: ["zuerich"],
  "the-hague": ["den haag"],
  brussels: ["bruxelles", "brussel"],
  athens: ["athina"],
  istanbul: ["stambul"],
  "mexico-city": ["ciudad de mexico", "cdmx"],
  "new-york": ["nyc", "new york city"],
  "los-angeles": ["la"],
  "sao-paulo": ["sampa"],
  "hong-kong": ["hongkong"],
};

const SCORE = {
  nameExact: 1000,
  namePrefix: 800,
  aliasExact: 700,
  aliasPrefix: 600,
  nameContains: 400,
  countryPrefix: 200,
  countryContains: 100,
} as const;

/**
 * Cities matching what was typed, best first.
 *
 * An empty query returns nothing rather than everything: the caller decides
 * what to show before anybody has typed, and that is usually a short list of
 * suggestions rather than eighty rows.
 */
export function searchCities<T extends SearchableCity>(
  cities: readonly T[],
  query: string,
  limit = 12,
): CityHit<T>[] {
  const needle = fold(query);
  if (!needle) return [];

  const hits: CityHit<T>[] = [];

  for (const city of cities) {
    const name = fold(city.name);
    const country = fold(city.country);
    const aliases = CITY_ALIASES[city.slug] ?? [];

    let score = 0;
    let matched: CityHit<T>["matched"] = "name";

    if (name === needle) score = SCORE.nameExact;
    else if (name.startsWith(needle)) score = SCORE.namePrefix;
    else {
      for (const alias of aliases) {
        const folded = fold(alias);
        if (folded === needle) score = Math.max(score, SCORE.aliasExact);
        else if (folded.startsWith(needle)) score = Math.max(score, SCORE.aliasPrefix);
        if (score > 0) matched = "alias";
      }
    }

    if (score === 0 && name.includes(needle)) {
      score = SCORE.nameContains;
      matched = "name";
    }

    if (score === 0) {
      /* Country matches are real and useful — "spain" should offer every
         Spanish city — but they rank below every name match, because somebody
         typing "port" wants Porto before Portugal's other cities. */
      if (country.startsWith(needle)) {
        score = SCORE.countryPrefix;
        matched = "country";
      } else if (country.includes(needle)) {
        score = SCORE.countryContains;
        matched = "country";
      }
    }

    if (score === 0) continue;

    /* A city with local content behind it wins a tie. It is a better answer to
       the same query, and this is the only thing depth is allowed to do here —
       it never promotes a city over a better name match. */
    if (city.deep) score += 25;

    hits.push({ city, score, matched });
  }

  return hits
    .sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name))
    .slice(0, limit);
}
