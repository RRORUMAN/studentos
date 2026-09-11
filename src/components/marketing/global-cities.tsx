"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import {
  allCoverageCities,
  coverageDepthLabel,
  coverageDepthNote,
  coverageStats,
  regions,
  type CoverageCity,
  type RegionKey,
} from "@/config/regions";
import { searchCities } from "@/domain/cities";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * WHEREVER YOU STUDY NEXT
 * ----------------------------------------------------------------------------
 * The coverage section used to print every city in the chosen region as a
 * card — 225 of them for Europe, the default — which made it the tallest
 * thing on the page and answered the one question a visitor has ("is MY city
 * on it?") by making them read a list.
 *
 * Now it answers that question directly: a search box over the whole
 * directory, using the same accent-insensitive `searchCities` the onboarding
 * picker uses, so "krakow" finds Kraków here exactly as it will there. Before
 * anything is typed it shows the full cities. The regional spread is one bar
 * rather than four lists.
 *
 * Every count is still derived from `config/regions.ts`. The status word on a
 * row is the real depth label, and "Open" is explained under the box in the
 * same words the rest of the product uses: it does not mean there is a
 * community there, and the site never says there is.
 * ============================================================================
 */

const LIMIT = 6;

const directory = allCoverageCities.map((city) => ({
  slug: city.slug ?? city.key,
  name: city.name,
  country: city.country,
  countryCode: city.countryCode,
  deep: city.depth === "deep",
  population: city.population,
  city,
}));

const fullCities = allCoverageCities.filter((city) => city.depth === "deep");

const REGION_FILL: Record<RegionKey, string> = {
  europe: "bg-flow",
  americas: "bg-pulse",
  apac: "bg-amber",
  mea: "bg-mint",
};

export function GlobalCities() {
  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchCities(directory, query, LIMIT), [query]);
  const searching = query.trim().length > 0;
  const rows = searching ? hits.map((hit) => hit.city.city) : fullCities;

  const stats = [
    { label: "Cities", value: coverageStats.cities },
    { label: "Countries", value: coverageStats.countries },
    { label: "Currencies", value: coverageStats.currencies },
    { label: "Full cities", value: coverageStats.deepCities },
  ];

  return (
    <Section id="cities" tone="paper">
      <div className="page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-start lg:gap-16">
          <div>
            <SectionHeader
              eyebrow="Worldwide"
              eyebrowIndex="07"
              title="Wherever you study next."
              lead="Ask, Budget, LifeOps, Missions and Arrival work from official data in every city here. The student layer is deepest where students already are — and each city says which it is."
            />

            <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="border-t border-ink-200 pt-3">
                  <dd className="tnum font-display text-[2.25rem] leading-none font-semibold tracking-[-0.03em] text-ink-950">
                    {stat.value}
                  </dd>
                  <dt className="mt-2 font-mono text-micro tracking-[0.12em] text-ink-500 uppercase">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>

            <div className="mt-9">
              <p className="font-mono text-micro tracking-[0.12em] text-ink-500 uppercase">
                By region
              </p>
              <div
                role="img"
                aria-label={`Cities by region: ${regions
                  .map((region) => `${region.label} ${region.cities.length}`)
                  .join(", ")}`}
                className="mt-3 flex h-2.5 gap-[3px]"
              >
                {regions.map((region) => (
                  <span
                    key={region.key}
                    className={cn("h-full rounded-full", REGION_FILL[region.key])}
                    style={{ width: `${(region.cities.length / coverageStats.cities) * 100}%` }}
                  />
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] text-ink-700">
                {regions.map((region) => (
                  <li key={region.key} className="flex items-center gap-1.5">
                    <span aria-hidden className={cn("size-2 rounded-full", REGION_FILL[region.key])} />
                    {region.label}
                    <span className="tnum text-ink-500">{region.cities.length}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ---- the checker -------------------------------------------------- */}
          <Reveal delay={0.05}>
            <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-float)] ring-1 ring-ink-950/6 sm:p-6">
              <label
                htmlFor="coverage-search"
                className="block text-[1.0625rem] font-semibold text-ink-950"
              >
                Is my city covered?
              </label>
              <div className="relative mt-3">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400"
                  aria-hidden
                />
                <input
                  id="coverage-search"
                  type="search"
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Try Lisbon, Kraków or Japan"
                  className="h-12 w-full rounded-xl border border-ink-200 bg-paper pr-4 pl-10 text-base text-ink-950 transition-colors placeholder:text-ink-400 hover:border-ink-300"
                />
              </div>

              <p
                aria-live="polite"
                className="mt-5 font-mono text-micro tracking-[0.12em] text-ink-500 uppercase"
              >
                {searching
                  ? hits.length === 0
                    ? "No match"
                    : hits.length === LIMIT
                      ? "Top matches"
                      : `${hits.length} ${hits.length === 1 ? "match" : "matches"}`
                  : "Full cities"}
              </p>

              {rows.length > 0 ? (
                <ul className="mt-1.5 flex flex-col divide-y divide-ink-100">
                  {rows.map((city) => (
                    <CityRow key={city.key} city={city} />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-600">
                  Not on the list yet. Cities are added by hand, with real geography behind each —
                  so this list only grows when it can be right.
                </p>
              )}

              <div className="mt-4 border-t border-ink-100 pt-4">
                <Link
                  href="/students"
                  className="group inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-ink-950"
                >
                  See all <span className="tnum">{coverageStats.cities}</span> cities
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
                <p className="mt-2 text-xs leading-relaxed text-ink-500">
                  <span className="font-medium text-ink-700">{coverageDepthLabel.open}</span>{" "}
                  means: {coverageDepthNote.open}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

function CityRow({ city }: { city: CoverageCity }) {
  const badge = cn(
    "shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.625rem] font-semibold tracking-[0.08em] uppercase",
    city.depth === "deep" && "bg-mint-soft text-mint-deep",
    city.depth === "live" && "bg-signal-soft text-signal-deep",
    city.depth === "open" && "bg-ink-100 text-ink-600",
  );

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium text-ink-950">{city.name}</span>
        <span className="block truncate text-xs text-ink-500">
          {city.country} · {city.currency}
        </span>
      </span>
      <span className={badge}>{coverageDepthLabel[city.depth]}</span>
    </>
  );

  if (city.depth === "deep" && city.slug) {
    return (
      <li>
        <Link
          href={`/city/${city.slug}`}
          className="group flex items-center gap-3 py-2.5 transition-colors hover:text-ink-950"
        >
          {body}
          <ArrowRight
            className="size-4 shrink-0 text-ink-300 transition-colors group-hover:text-ink-900"
            aria-hidden
          />
        </Link>
      </li>
    );
  }

  return <li className="flex items-center gap-3 py-2.5 pr-7">{body}</li>;
}
