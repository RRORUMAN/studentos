"use client";

import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/primitives";
import type { Neighbourhood, NeighbourhoodTrait } from "@/data/types";
import { traitBandLabel } from "@/data/types";
import {
  matchNeighbourhoods,
  priorityLabel,
  rentVerdictLabel,
  traitLabel,
  traitOrder,
  type LivingPreferences,
  type NeighbourhoodMatch,
  type Priority,
  type RentVerdict,
} from "@/server/engines/neighbourhood";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * NEIGHBOURHOOD MATCH
 * ----------------------------------------------------------------------------
 * The answer re-ranks as the student moves a control, for the same reason the
 * afford check recomputes on every keystroke: this is a comparison, and a
 * comparison that costs a round trip does not get made. `matchNeighbourhoods`
 * is the same pure engine the server would call, imported directly, so there
 * is no second implementation of the ranking to drift.
 *
 * What this screen deliberately does NOT do is hide the areas that lose. Every
 * neighbourhood in the city is on the page, in order, with its tradeoffs
 * printed under it — including the winner's. A student choosing where to live
 * for a year is owed the whole list and the reason for the order, not a
 * podium.
 * ============================================================================
 */

type Where = { currency: string; locale: string };

export function NeighbourhoodMatcher({
  areas,
  campuses,
  defaultCampus,
  density,
  where,
  homeAreaSlug,
}: {
  areas: readonly Neighbourhood[];
  campuses: readonly { slug: string; shortName: string }[];
  defaultCampus: string | null;
  /** Area slug -> students living there. Already floored by the graph. */
  density: Readonly<Record<string, number>>;
  where: Where;
  /** Where the student already lives, if they have said. Marked, never ranked up. */
  homeAreaSlug: string | null;
}) {
  const [campusSlug, setCampusSlug] = useState<string | null>(defaultCampus);
  const [rentCeiling, setRentCeiling] = useState<number | null>(null);
  const [maxCommute, setMaxCommute] = useState(35);
  const [priorities, setPriorities] = useState<Partial<Record<NeighbourhoodTrait, Priority>>>({
    studentDensity: 1,
  });

  const fmt = useMemo(() => (value: number) => money(value, where), [where]);

  const densityMap = useMemo(() => new Map(Object.entries(density)), [density]);

  const preferences: LivingPreferences = useMemo(
    () => ({ campusSlug, rentCeiling, maxCommuteMinutes: maxCommute, priorities }),
    [campusSlug, rentCeiling, maxCommute, priorities],
  );

  const results = useMemo(
    () => matchNeighbourhoods({ areas, preferences, density: densityMap, formatMoney: fmt }),
    [areas, preferences, densityMap, fmt],
  );

  /* The band the slider moves through, derived from the city rather than
     hard-coded: a London ceiling slider that stops at €900 is useless, and one
     that starts at €400 is useless in Madrid. */
  const [floor, ceiling] = useMemo(() => {
    const lows = areas.map((area) => area.rent.room[0]);
    const highs = areas.map((area) => area.rent.room[1]);
    return [Math.floor(Math.min(...lows) / 50) * 50, Math.ceil(Math.max(...highs) / 50) * 50];
  }, [areas]);

  const cyclePriority = (trait: NeighbourhoodTrait) =>
    setPriorities((current) => {
      const next = (((current[trait] ?? 0) + 1) % 3) as Priority;
      return { ...current, [trait]: next };
    });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        {campuses.length > 0 ? (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-800">Getting to</legend>
            <div className="flex flex-wrap gap-1.5">
              {campuses.map((campus) => (
                <Chip
                  key={campus.slug}
                  active={campusSlug === campus.slug}
                  onClick={() => setCampusSlug(campusSlug === campus.slug ? null : campus.slug)}
                >
                  {campus.shortName}
                </Chip>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="mt-5">
          <legend className="mb-2 flex items-baseline justify-between gap-2 text-sm font-medium text-ink-800">
            <span>Most you would pay for a room</span>
            <span className="font-mono text-[0.8125rem] text-ink-600">
              {rentCeiling === null ? "Not set" : `${fmt(rentCeiling)}/month`}
            </span>
          </legend>
          <input
            type="range"
            min={floor}
            max={ceiling}
            step={25}
            value={rentCeiling ?? Math.round((floor + ceiling) / 2)}
            onChange={(event) => setRentCeiling(Number(event.target.value))}
            aria-label="Most you would pay for a room, per month"
            className="w-full accent-ink-950"
          />
          {rentCeiling === null ? (
            <p className="mt-1.5 text-[0.8125rem] text-ink-500">
              Move it to rank by budget. Until you do, rent is not part of the order.
            </p>
          ) : null}
        </fieldset>

        <fieldset className="mt-5">
          <legend className="mb-2 flex items-baseline justify-between gap-2 text-sm font-medium text-ink-800">
            <span>Longest commute you would accept</span>
            <span className="font-mono text-[0.8125rem] text-ink-600">{maxCommute} min</span>
          </legend>
          <input
            type="range"
            min={10}
            max={60}
            step={5}
            value={maxCommute}
            onChange={(event) => setMaxCommute(Number(event.target.value))}
            aria-label="Longest commute you would accept, each way"
            className="w-full accent-ink-950"
          />
        </fieldset>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium text-ink-800">
            What matters — tap to raise
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {traitOrder.map((trait) => {
              const level = priorities[trait] ?? 0;
              return (
                <button
                  key={trait}
                  type="button"
                  onClick={() => cyclePriority(trait)}
                  aria-pressed={level > 0}
                  aria-label={`${traitLabel[trait]}: ${priorityLabel[level]}`}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-[0.875rem] font-medium transition-colors",
                    level === 0 && "bg-paper-2 text-ink-600 hover:bg-ink-100",
                    level === 1 && "bg-ink-200 text-ink-950",
                    level === 2 && "bg-ink-950 text-paper",
                  )}
                >
                  {traitLabel[trait]}
                  {level === 2 ? <span className="ml-1 opacity-70">must</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <ol className="space-y-3">
        {results.map((result, index) => (
          <MatchCard
            key={result.area.slug}
            result={result}
            rank={index}
            fmt={fmt}
            isHome={result.area.slug === homeAreaSlug}
            showRent={rentCeiling !== null}
          />
        ))}
      </ol>

      <p className="flex items-start gap-2 rounded-xl bg-paper-2 p-3.5 text-[0.8125rem] leading-relaxed text-ink-600">
        <Info className="mt-0.5 size-4 shrink-0 text-ink-400" />
        <span>
          Rent bands are written estimates to sanity-check listings against, not a live market
          reading. Commutes are door-to-door and honest to about five minutes. Student counts are
          only shown once enough people in an area have opted in for a count to describe a group
          rather than a person.
        </span>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const verdictAccent: Record<RentVerdict, "mint" | "amber" | "pulse" | "flow"> = {
  comfortable: "mint",
  tight: "amber",
  over: "pulse",
  unknown: "flow",
};

function MatchCard({
  result,
  rank,
  fmt,
  isHome,
  showRent,
}: {
  result: NeighbourhoodMatch;
  rank: number;
  fmt: (value: number) => string;
  isHome: boolean;
  showRent: boolean;
}) {
  const { area } = result;
  const [low, high] = area.rent.room;

  return (
    <li
      className={cn(
        "rounded-2xl bg-white p-5 ring-1 ring-ink-950/6",
        rank === 0 ? "shadow-[var(--shadow-raise)]" : "shadow-[var(--shadow-flat)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[1.0625rem] font-semibold text-ink-950">{area.name}</h2>
            {rank === 0 ? <Badge accent="signal" tone="solid">Best fit</Badge> : null}
            {isHome ? <Badge accent="flow">Where you live</Badge> : null}
          </div>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-600">{area.character}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[1.375rem] leading-none font-semibold text-ink-950">
            {result.fit}
          </p>
          <p className="mt-1 text-[0.6875rem] tracking-wide text-ink-400 uppercase">Fit</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Figure
          label="Room, monthly"
          value={`${fmt(low)}–${fmt(high)}`}
          note={area.rent.basis === "seed-estimate" ? "Estimate" : "From students"}
        />
        <Figure
          label="To campus"
          value={result.commuteMinutes === null ? "—" : `${result.commuteMinutes} min`}
          note={result.commuteMinutes === null ? "No figure" : undefined}
        />
        <Figure
          label="Students here"
          value={result.studentsLiving === null ? "—" : String(result.studentsLiving)}
          note={result.studentsLiving === null ? "Too few to say" : undefined}
        />
      </dl>

      {showRent ? (
        <div className="mt-3">
          <Badge accent={verdictAccent[result.rentVerdict]}>
            {rentVerdictLabel[result.rentVerdict]}
          </Badge>
        </div>
      ) : null}

      {result.reasons.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {result.reasons.map((reason) => (
            <li
              key={reason}
              className="rounded-full bg-paper-2 px-2.5 py-1 text-[0.8125rem] text-ink-600"
            >
              {reason}
            </li>
          ))}
        </ul>
      ) : null}

      {result.tradeoffs.length > 0 ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
          <span className="font-medium text-ink-600">The catch: </span>
          {result.tradeoffs.join(". ")}.
        </p>
      ) : null}

      <details className="group mt-3">
        <summary className="cursor-pointer list-none text-[0.8125rem] font-medium text-ink-500 hover:text-ink-950">
          What it is like <span className="group-open:hidden">→</span>
        </summary>
        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {traitOrder.map((trait) => (
            <div key={trait} className="flex items-baseline justify-between gap-2">
              <dt className="text-[0.8125rem] text-ink-500">{traitLabel[trait]}</dt>
              <dd className="text-[0.8125rem] font-medium text-ink-800">
                {traitBandLabel[area.traits[trait]]}
              </dd>
            </div>
          ))}
        </dl>
      </details>

      <Link
        href={`/discover?q=${encodeURIComponent(area.name)}`}
        className="mt-3 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-flow hover:underline"
      >
        What is around here
        <ArrowRight className="size-4" />
      </Link>
    </li>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] tracking-wide text-ink-400 uppercase">{label}</dt>
      <dd className="mt-0.5 font-mono text-[0.9375rem] font-medium text-ink-950">{value}</dd>
      {note ? <p className="text-[0.6875rem] text-ink-400">{note}</p> : null}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 rounded-full px-3.5 text-[0.875rem] font-medium transition-colors",
        active ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
      )}
    >
      {children}
    </button>
  );
}
