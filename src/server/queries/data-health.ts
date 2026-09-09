import "server-only";

import { allCoverageCities, coverageDepthLabel, type CoverageCity } from "@/config/regions";
import { institutions } from "@/data/institutions";
import { findMany } from "@/server/db";
import { placeProviders } from "@/server/places";
import { routeProviders } from "@/server/places/route";
import { providers as jobProviders } from "@/server/work/providers";

/**
 * ============================================================================
 * DATA HEALTH
 * ----------------------------------------------------------------------------
 * What is actually behind each city, for the one screen where the operator
 * finds out before a student does.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT A DASHBOARD OF GREEN TICKS
 *
 * A multi-city product fails city by city, quietly. Madrid has five hundred
 * events and Kraków has none; both look identical from the outside, and the
 * difference only shows up as a student opening Events in Kraków and deciding
 * the product is empty. So every row here reports COVERAGE — what the city
 * actually has — separately from CONNECTIVITY — whether the providers are
 * reachable at all. They are different problems with different fixes.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT COUNTED
 *
 * Places. There is no number of places in a city, because places are not
 * stored: they are fetched from a provider per request and cached by area. A
 * count here would either be the size of the cache, which measures how much
 * the city has been browsed rather than what is in it, or a fabrication. The
 * row says which provider answers and how warm the cache is, which are both
 * true and both actionable.
 *
 * Everything else IS counted, from rows, at the moment the page is loaded.
 * ============================================================================
 */

export type CoverageLevel = "none" | "thin" | "working" | "strong";

export const coverageLevelLabel: Record<CoverageLevel, string> = {
  none: "Nothing yet",
  thin: "Thin",
  working: "Working",
  strong: "Strong",
};

export type DataSignal = {
  key: string;
  label: string;
  level: CoverageLevel;
  /** The count, when there is one to give. Null where counting is dishonest. */
  count: number | null;
  /** One line an operator can act on. */
  note: string;
};

export type CityHealth = {
  slug: string;
  name: string;
  country: string;
  depth: string;
  /** Whether the city has a coordinate at all. Without one, nothing works. */
  located: boolean;
  signals: DataSignal[];
  /**
   * How much of the product this city can honestly carry, 0-1.
   *
   * Averaged over the signals, so it moves when a real count moves. It drives
   * which features are worth featuring in this city, and it is never shown to
   * a student — a city does not need to be told it is thin.
   */
  confidence: number;
};

export type ProviderHealthRow = {
  kind: "places" | "routing" | "jobs";
  label: string;
  configured: boolean;
  /** The detail when configured, or the exact variable that would configure it. */
  detail: string;
};

export type DataHealthReport = {
  providers: ProviderHealthRow[];
  cities: CityHealth[];
  /** Cities with a student in them. The only ones whose coverage matters yet. */
  activeCitySlugs: string[];
  institutionCount: number;
  institutionCountries: number;
  placeCacheEntries: number;
  placeCacheCities: number;
};

/* -------------------------------------------------------------------------- */
/* Banding                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A count becomes a band.
 *
 * The thresholds are per signal because they mean different things: two
 * verified deals in a city is genuinely useful and two Pulse posts is not a
 * community. Stated as data so the bands can be read and argued with rather
 * than being buried in a chain of ternaries.
 */
const BANDS: Record<string, { thin: number; working: number; strong: number }> = {
  events: { thin: 1, working: 8, strong: 30 },
  jobs: { thin: 1, working: 5, strong: 25 },
  deals: { thin: 1, working: 3, strong: 12 },
  posts: { thin: 1, working: 10, strong: 40 },
  students: { thin: 1, working: 10, strong: 50 },
  institutions: { thin: 1, working: 3, strong: 10 },
};

function band(key: string, count: number): CoverageLevel {
  const thresholds = BANDS[key] ?? { thin: 1, working: 5, strong: 20 };
  if (count >= thresholds.strong) return "strong";
  if (count >= thresholds.working) return "working";
  if (count >= thresholds.thin) return "thin";
  return "none";
}

const LEVEL_SCORE: Record<CoverageLevel, number> = {
  none: 0,
  thin: 0.35,
  working: 0.7,
  strong: 1,
};

/* -------------------------------------------------------------------------- */
/* The report                                                                  */
/* -------------------------------------------------------------------------- */

export async function loadDataHealth(now: Date): Promise<DataHealthReport> {
  const [profiles, events, opportunities, deals, posts, cache] = await Promise.all([
    findMany("profiles", () => true),
    findMany("events", (row) => Date.parse(row.startsAt) >= now.getTime()),
    findMany("opportunities", (row) => row.moderation === "published"),
    findMany("deals", (row) => row.verifiedAt !== null),
    findMany("posts", (row) => row.hiddenAt === null),
    findMany("placeCache", () => true),
  ]);

  /* Cities a student has actually chosen. A city with nobody in it has no
     coverage problem yet, and listing all eighty as "Nothing yet" would bury
     the handful that matter. */
  const active = new Set(profiles.map((row) => row.citySlug));

  const countBy = <T,>(rows: readonly T[], slug: (row: T) => string) => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(slug(row), (map.get(slug(row)) ?? 0) + 1);
    return map;
  };

  const studentsIn = countBy(profiles, (row) => row.citySlug);
  const eventsIn = countBy(events, (row) => row.citySlug);
  const jobsIn = countBy(opportunities, (row) => row.citySlug);
  const dealsIn = countBy(deals, (row) => row.citySlug);
  const postsIn = countBy(posts, (row) => row.citySlug);

  const institutionsIn = new Map<string, number>();
  for (const row of institutions) {
    if (!row.citySlug) continue;
    institutionsIn.set(row.citySlug, (institutionsIn.get(row.citySlug) ?? 0) + 1);
  }

  /* Which cities have any cached place results. Reported as a fact about the
     cache, never as a count of places in the city. */
  const cachedCities = new Set<string>();
  for (const row of cache) {
    const city = nearestCity(row.centreLat, row.centreLng);
    if (city) cachedCities.add(city.key);
  }

  const cities = allCoverageCities
    .filter((city) => active.has(city.key) || city.depth === "deep")
    .map((city): CityHealth => {
      const signals: DataSignal[] = [
        signal("students", "Students", studentsIn.get(city.key) ?? 0, {
          none: "Nobody has picked this city yet.",
          some: "Real accounts, counted from profiles.",
        }),
        signal("institutions", "Institutions", institutionsIn.get(city.key) ?? 0, {
          none: `No institution is mapped to ${city.name}. Import the country, or add a metro entry in src/data/institutions/index.ts.`,
          some: "From the imported registry, merged with the curated rows.",
        }),
        signal("events", "Events ahead", eventsIn.get(city.key) ?? 0, {
          none: "No upcoming events. Connect an event feed or wait for students to post.",
          some: "Upcoming only. Anything past is not counted.",
        }),
        signal("jobs", "Open work", jobsIn.get(city.key) ?? 0, {
          none: "No postings. STUDENTOS_WORK_FEEDS is how an external one arrives.",
          some: "Published postings, student and feed.",
        }),
        signal("deals", "Verified deals", dealsIn.get(city.key) ?? 0, {
          none: "No deal has been verified here.",
          some: "Verified only. Unverified reports are not counted.",
        }),
        signal("posts", "Pulse posts", postsIn.get(city.key) ?? 0, {
          none: "The community starts with the first post.",
          some: "Visible posts, counted from rows.",
        }),
      ];

      return {
        slug: city.key,
        name: city.name,
        country: city.country,
        depth: coverageDepthLabel[city.depth],
        located: Number.isFinite(city.lat) && Number.isFinite(city.lng),
        signals,
        confidence:
          signals.reduce((sum, entry) => sum + LEVEL_SCORE[entry.level], 0) / signals.length,
      };
    })
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));

  return {
    providers: [
      ...placeProviders().map((provider): ProviderHealthRow => {
        const status = provider.status();
        return {
          kind: "places",
          label: provider.label,
          configured: status.configured,
          detail: status.configured ? status.detail : status.missing,
        };
      }),
      ...routeProviders().map((provider): ProviderHealthRow => {
        const status = provider.status();
        return {
          kind: "routing",
          label: provider.label,
          configured: status.configured,
          detail: status.configured ? status.detail : status.missing,
        };
      }),
      ...jobProviders().map((provider): ProviderHealthRow => {
        const status = provider.status();
        return {
          kind: "jobs",
          label: provider.label,
          configured: status.configured,
          detail: status.configured ? status.detail : status.missing,
        };
      }),
    ],
    cities,
    activeCitySlugs: [...active],
    institutionCount: institutions.length,
    institutionCountries: new Set(institutions.map((row) => row.countryCode)).size,
    placeCacheEntries: cache.length,
    placeCacheCities: cachedCities.size,
  };
}

function signal(
  key: string,
  label: string,
  count: number,
  notes: { none: string; some: string },
): DataSignal {
  const level = band(key, count);
  return { key, label, level, count, note: level === "none" ? notes.none : notes.some };
}

/**
 * Which city a cached area belongs to.
 *
 * Nearest centre within fifty kilometres, which is generous enough for a
 * campus in a satellite town and tight enough that two cities never claim the
 * same cache entry. Returns null rather than guessing when nothing is close —
 * a cache entry from a student travelling is not evidence about any city.
 */
function nearestCity(lat: number, lng: number): CoverageCity | null {
  let best: CoverageCity | null = null;
  let bestDistance = Infinity;

  for (const city of allCoverageCities) {
    /* Squared degrees, which is not a distance but orders identically over the
       small spans this compares, and avoids eighty trigonometric calls per
       cache row on a page that already does real work. */
    const spread = (city.lat - lat) ** 2 + (city.lng - lng) ** 2;
    if (spread < bestDistance) {
      bestDistance = spread;
      best = city;
    }
  }

  /* ~0.5 degrees, roughly fifty kilometres at these latitudes. */
  return bestDistance <= 0.25 ? best : null;
}
