"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import {
  coverageDepthLabel,
  coverageDepthNote,
  coverageStats,
  regions,
  type CoverageCity,
  type RegionKey,
} from "@/config/regions";
import { cityStatusLabel, getCity } from "@/data/cities";
import { cn } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * WHEREVER YOU STUDY NEXT
 * ----------------------------------------------------------------------------
 * The honest coverage map. Every count on this section is derived from
 * `config/regions.ts` — nothing here is typed by hand, so the headline can
 * never drift from the list underneath it.
 *
 * The status word on each card is the real one: a city with a full seeded
 * record prints its own status, and everything else prints the depth label.
 * "Open" means the AI, budget, map and arrival checklist work from official
 * data and the student layer starts with the first post. It does not mean
 * there is a community there, and the site never says there is.
 * ============================================================================
 */
export function GlobalCities() {
  const [regionKey, setRegionKey] = useState<RegionKey>("europe");
  const region = regions.find((entry) => entry.key === regionKey) ?? regions[0];

  return (
    <Section id="cities" tone="flow">
      <div className="page">
        <SectionHeader
          eyebrow="Worldwide"
          eyebrowIndex="14"
          title="Wherever you study next."
          lead={
            <>
              Ask, Budget, LifeOps, Missions and Arrival Mode work from official data in every city
              on this list. The student layer is deepest where students already are, and each card
              says which it is.
            </>
          }
        />

        {/* ---- derived stats ------------------------------------------------ */}
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Cities", value: coverageStats.cities },
            { label: "Countries", value: coverageStats.countries },
            { label: "Currencies", value: coverageStats.currencies },
            { label: "Deep city data", value: coverageStats.deepCities },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-flat)]">
              <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                {stat.label}
              </dt>
              <dd className="tnum mt-1 font-mono text-2xl font-semibold text-ink-950">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* ---- regions ------------------------------------------------------ */}
        <div className="mt-8 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar edge-fade-x">
          {regions.map((entry) => (
            <Chip
              key={entry.key}
              accent="flow"
              active={entry.key === regionKey}
              count={entry.cities.length}
              onClick={() => {
                setRegionKey(entry.key);
                track("coverage_region_changed", { region: entry.key });
              }}
            >
              {entry.label}
            </Chip>
          ))}
        </div>

        {region.note ? (
          <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-600">
            {region.note}
          </p>
        ) : null}

        <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {region.cities.map((city) => (
            <CityCard key={`${city.name}-${city.countryCode}`} city={city} />
          ))}
        </div>

        <Reveal delay={0.05} className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/students" variant="primary">
              See every city
            </ButtonLink>
            <span className="text-[0.8125rem] text-ink-500">
              {coverageDepthLabel.open}: {coverageDepthNote.open}
            </span>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function CityCard({ city }: { city: CoverageCity }) {
  const deep = city.slug ? getCity(city.slug) : undefined;
  const status = deep ? cityStatusLabel[deep.status] : coverageDepthLabel[city.depth];

  const badge = cn(
    "shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.08em]",
    city.depth === "deep" && "bg-mint-soft text-mint-deep",
    city.depth === "live" && "bg-signal-soft text-signal-deep",
    city.depth === "open" && "bg-ink-100 text-ink-500",
  );

  const body = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-[0.9375rem] font-medium text-ink-950">{city.name}</span>
        <span className="block truncate text-xs text-ink-400">
          {city.country} · {city.currency}
        </span>
      </span>
      <span className={badge}>{status}</span>
    </>
  );

  if (deep) {
    return (
      <Link
        href={`/city/${deep.slug}`}
        className="group flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-flat)] transition-shadow hover:shadow-[var(--shadow-raise)]"
      >
        {body}
        <ArrowRight
          className="size-4 shrink-0 text-ink-300 transition-colors group-hover:text-ink-900"
          aria-hidden
        />
      </Link>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-4 py-3">
      {body}
    </div>
  );
}
