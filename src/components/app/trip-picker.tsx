"use client";

import { Lock, Luggage, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Upsell } from "@/components/app/upsell";
import type { CityStatus } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * The city chip above the Discover map. Home city by default; for Pro, any
 * other city in the directory as a trip.
 *
 * A free student sees the same chip. Picking another city does not navigate
 * to a page that quietly shows their home city again — it opens the
 * value-first Trip planner card right here, naming the city they wanted.
 * The page renders this only when the `trips` flag is on; a switched-off
 * feature is absent, not a button that does nothing.
 */
export function TripPicker({
  cities,
  homeSlug,
  currentSlug,
  unlocked,
}: {
  cities: readonly { slug: string; name: string; country: string; status: CityStatus; deep: boolean }[];
  homeSlug: string;
  currentSlug: string;
  unlocked: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [wanted, setWanted] = useState<{ slug: string; name: string } | null>(null);

  const current = cities.find((city) => city.slug === currentSlug);
  const home = cities.find((city) => city.slug === homeSlug);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cities.filter((city) => !needle || city.name.toLowerCase().includes(needle) || city.country.toLowerCase().includes(needle));
  }, [cities, query]);

  const go = (city: { slug: string; name: string }) => {
    setOpen(false);
    if (!unlocked && city.slug !== homeSlug) {
      setWanted(city);
      return;
    }
    setWanted(null);
    const next = new URLSearchParams(params.toString());
    if (city.slug === homeSlug) next.delete("city");
    else next.set("city", city.slug);
    const qs = next.toString();
    router.push(qs ? `/discover?${qs}` : "/discover");
  };

  return (
    <div className="relative mb-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-800 ring-1 ring-ink-950/8 hover:ring-ink-950/20"
      >
        <Luggage className="size-4 text-ink-500" />
        {current?.name ?? "Your city"}
        {currentSlug !== homeSlug ? <span className="rounded-full bg-signal px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-950">Trip</span> : null}
        {!unlocked ? <Lock className="size-3 text-ink-400" aria-label="Trips are part of Pro" /> : null}
      </button>

      {open ? (
        <div className="absolute top-full left-0 z-40 mt-2 w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl bg-white p-3 shadow-[var(--shadow-lift)] ring-1 ring-ink-950/8">
          <div className="flex items-center justify-between">
            <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Plan a trip</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-7 place-items-center rounded-full text-ink-400 hover:bg-ink-100">
              <X className="size-3.5" />
            </button>
          </div>
          <div className="relative mt-2">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cities" aria-label="Search cities" className="h-10 w-full rounded-lg bg-paper-2 pl-9 pr-3 text-[0.9375rem] text-ink-900 placeholder:text-ink-400" />
          </div>
          <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
            {home ? (
              <li>
                <button type="button" onClick={() => go(home)} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-paper-2", currentSlug === home.slug && "bg-signal-soft")}>
                  <span className="text-[0.9375rem] text-ink-900">{home.name} <span className="text-ink-500">· home</span></span>
                </button>
              </li>
            ) : null}
            {filtered.filter((city) => city.slug !== homeSlug).map((city) => (
              <li key={city.slug}>
                <button type="button" onClick={() => go(city)} className={cn("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-paper-2", currentSlug === city.slug && "bg-signal-soft")}>
                  <span className="min-w-0 truncate text-[0.9375rem] text-ink-900">{city.name} <span className="text-ink-500">· {city.country}</span></span>
                  <span className={cn("shrink-0 text-[0.6875rem] font-semibold", city.deep ? "text-mint-deep" : "text-ink-400")}>{city.deep ? "Local data" : "Coming soon"}</span>
                </button>
              </li>
            ))}
          </ul>
          {!unlocked ? <p className="mt-2 text-[0.75rem] text-ink-500">Trips are part of Pro. Pick a city to see what it unlocks.</p> : null}
        </div>
      ) : null}

      {wanted ? (
        <Upsell
          feature="tripPlanner"
          className="mt-3"
          line={`Open ${wanted.name} as a trip — places, budget and what is on — without moving home. Pro.`}
        />
      ) : null}
    </div>
  );
}
