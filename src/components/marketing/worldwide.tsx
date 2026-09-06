"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Clock, Coins, Languages, Plane } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Atmosphere, Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import {
  coverageDepthLabel,
  coverageDepthNote,
  coverageStats,
  interfaceLanguages,
  regions,
  supportedCurrencies,
  type CoverageCity,
  type RegionKey,
} from "@/config/regions";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * WORLDWIDE
 * ----------------------------------------------------------------------------
 * The honest version of "available everywhere".
 *
 * A city is not a switch that is on or off. Three things have to be true before
 * the product is useful somewhere, and they arrive in order:
 *
 *   the AI and the official data  →  work anywhere, from day one
 *   local currency and formatting →  works anywhere Intl knows the currency
 *   the student layer             →  only real once students are actually there
 *
 * So the grid prints a depth badge per city rather than a green tick, and the
 * long tail says "Open" rather than pretending a community exists in it. Every
 * count in this section is derived from config/regions.ts — the headline cannot
 * drift from the list underneath it.
 * ============================================================================
 */

const CAPABILITIES = [
  {
    icon: Coins,
    title: `${coverageStats.currencies} currencies, priced natively`,
    body: "A student in Tokyo sees ¥, in London £, in São Paulo R$. Prices are formatted by the city you are standing in, not converted from euro at the last second.",
  },
  {
    icon: Languages,
    title: `${coverageStats.languages} interface languages`,
    body: "Including right-to-left. Language and locale are separate settings, so you can read the app in English while every price, date and fare renders the way your city writes them.",
  },
  {
    icon: Clock,
    title: "Every timezone, no guessing",
    body: `"Tonight" is a real time. ${brand.name} resolves it against the city's own clock and the venue's own opening hours, which is why the plan never sends you somewhere that shut an hour ago.`,
  },
  {
    icon: Plane,
    title: "Two cities at once",
    body: "Exchange, placement, summer abroad. Keep your home city and your new one side by side, each with its own budget and its own currency, and switch without losing either.",
  },
] as const;

export function Worldwide() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<RegionKey>("europe");
  const region = regions.find((entry) => entry.key === active) ?? regions[0];

  return (
    <Section id="worldwide" tone="flow" className="overflow-hidden">
      <Atmosphere
        blobs={[
          { className: "-top-56 right-[-18rem] size-[42rem] bg-flow/14", drift: "b" },
          { className: "bottom-[-22rem] left-[-14rem] size-[34rem] bg-signal/20", drift: "a" },
        ]}
      />

      <div className="page relative">
        <Reveal>
          <div className="max-w-3xl">
            <Eyebrow index="14">Worldwide</Eyebrow>
            <h2 className="mt-4 text-display-md text-ink-950">
              Wherever you are going, it already works there.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-600">
              The planner, the budget, the map and the arrival checklist run from official data and
              your own location, so they work in any city on your first day. What takes time to
              arrive is the student layer — so every city below says exactly which of the two you
              are getting.
            </p>
          </div>
        </Reveal>

        {/* ---- derived headline numbers -------------------------------------- */}
        <Reveal delay={0.05}>
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-ink-200/70 sm:grid-cols-4">
            {[
              { value: coverageStats.cities, label: "student cities mapped" },
              { value: coverageStats.countries, label: "countries" },
              { value: coverageStats.currencies, label: "currencies" },
              { value: coverageStats.languages, label: "languages" },
            ].map((stat) => (
              <div key={stat.label} className="bg-paper px-4 py-6 text-center">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="tnum block font-display text-display-xs font-semibold text-ink-950">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-ink-500">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* ---- region switcher ----------------------------------------------- */}
        <Reveal delay={0.1}>
          <div
            role="group"
            aria-label="Filter cities by region"
            className="mt-12 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar edge-fade-x"
          >
            {regions.map((entry) => {
              const selected = entry.key === active;
              return (
                <button
                  key={entry.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setActive(entry.key);
                    track("coverage_region_changed", { region: entry.key });
                  }}
                  className={cn(
                    "relative inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150",
                    selected ? "text-paper" : "text-ink-600 hover:text-ink-950",
                  )}
                >
                  {selected ? (
                    <motion.span
                      layoutId="coverage-region"
                      className="absolute inset-0 rounded-full bg-ink-950"
                      transition={reduced ? { duration: 0 } : { duration: 0.24, ease: ease.out }}
                    />
                  ) : null}
                  <span className="relative">{entry.label}</span>
                  <span
                    className={cn(
                      "tnum relative font-mono text-micro",
                      selected ? "text-signal" : "text-ink-400",
                    )}
                  >
                    {entry.cities.length}
                  </span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink-500">{region.note}</p>
        </Reveal>

        {/* ---- the grid ------------------------------------------------------ */}
        <motion.ul
          key={region.key}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.32, ease: ease.out }}
          className="mt-6 grid gap-px overflow-hidden rounded-2xl bg-ink-200/70 sm:grid-cols-2 lg:grid-cols-3"
        >
          {region.cities.map((city) => (
            <li key={`${city.name}-${city.countryCode}`}>
              <CityCell city={city} />
            </li>
          ))}
          {/* The grid draws its hairlines as 1px gaps over an ink ground, so a
              part-filled last row shows the ground as a grey block. Padding to a
              multiple of six makes the last row exact at both the two- and
              three-column breakpoints; the fillers have no padding, so at one
              column they collapse to nothing. */}
          {Array.from({ length: (6 - (region.cities.length % 6)) % 6 }).map((_, index) => (
            <li key={`filler-${index}`} aria-hidden className="bg-paper" />
          ))}
        </motion.ul>

        <Reveal>
          <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-400">
            <span className="font-medium text-ink-600">Open</span> means the planner, budget, map
            and arrival checklist all work from official data on your first day. It does not mean a
            student community is waiting for you — that opens when there are enough students in the
            city to be worth reading, and the app says which state you are in.
          </p>
        </Reveal>

        {/* ---- what "worldwide" actually buys you ---------------------------- */}
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl bg-ink-200/70 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <Reveal key={title} className="h-full">
              <div className="flex h-full gap-4 bg-paper p-6 lg:p-7">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-flow-soft text-flow-deep">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink-950">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* ---- the currency rail --------------------------------------------- */}
        <Reveal>
          <div className="mt-10 overflow-hidden rounded-xl border border-ink-200 bg-paper py-4">
            <p className="px-5 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
              Currencies formatted natively
            </p>
            <div className="mt-3 flex overflow-hidden edge-fade-x">
              {/* Duplicated once so the loop has no seam. The copy is hidden
                  from assistive tech; the first pass is the readable one. */}
              {[false, true].map((duplicate) => (
                <ul
                  key={String(duplicate)}
                  aria-hidden={duplicate || undefined}
                  className="flex shrink-0 items-center gap-2 pr-2 animate-ticker"
                >
                  {supportedCurrencies.map((code) => (
                    <li
                      key={code}
                      className="tnum shrink-0 rounded-full border border-ink-200 bg-white px-3 py-1.5 font-mono text-xs text-ink-600"
                    >
                      {code}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ---- languages + request ------------------------------------------- */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Reveal>
            <div className="h-full rounded-xl border border-ink-200 bg-paper p-6">
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                Interface languages
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {interfaceLanguages.map((language) => (
                  <li
                    key={language.code}
                    className="rounded-full bg-ink-100 px-3 py-1.5 text-sm text-ink-700"
                    lang={language.code}
                    dir={"rtl" in language && language.rtl ? "rtl" : undefined}
                  >
                    {language.endonym}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="flex h-full flex-col justify-between rounded-xl bg-ink-950 p-6 text-white">
              <div>
                <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">
                  Your city is not on the list?
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-white/60">
                  It still works. Start free, ask it something about where you are, and tell us
                  which city to seed next — the ones students ask for get their student layer first.
                </p>
              </div>
              <Link
                href="/get-started"
                onClick={() => track("cta_clicked", { location: "worldwide" })}
                className={cn(
                  "group mt-6 inline-flex items-center justify-between gap-3 rounded-full bg-signal px-5 py-3",
                  "text-[0.9375rem] font-medium text-ink-950 transition-[filter] duration-150 hover:brightness-[1.04]",
                )}
              >
                Start in your city
                <ArrowUpRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

const DEPTH_STYLE: Record<CoverageCity["depth"], string> = {
  deep: "bg-signal text-ink-950",
  live: "bg-mint-soft text-mint-deep",
  open: "bg-ink-100 text-ink-500",
};

function CityCell({ city }: { city: CoverageCity }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold tracking-[-0.02em] text-ink-950">
            {city.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-400">{city.country}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.06em]",
            DEPTH_STYLE[city.depth],
          )}
        >
          {coverageDepthLabel[city.depth]}
        </span>
      </div>

      <p className="mt-3 text-xs leading-snug text-ink-500">{coverageDepthNote[city.depth]}</p>

      <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-micro uppercase text-ink-400">
        <div className="flex gap-1.5">
          <dt className="sr-only">Currency</dt>
          <dd className="tnum">{city.currency}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="sr-only">Locale</dt>
          <dd>{city.locale}</dd>
        </div>
      </dl>
    </>
  );

  if (city.slug) {
    return (
      <Link
        href={`/city/${city.slug}`}
        className="group flex h-full flex-col bg-paper p-5 transition-colors duration-200 hover:bg-white"
      >
        {body}
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-500 transition-colors group-hover:text-ink-950">
          Look around
          <ArrowUpRight className="size-3.5" aria-hidden />
        </span>
      </Link>
    );
  }

  return <div className="flex h-full flex-col bg-paper p-5">{body}</div>;
}
