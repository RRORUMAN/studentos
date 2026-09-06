"use client";

import { Lock, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * EXPLORE FILTERS
 * ----------------------------------------------------------------------------
 * The chip rail and search box.
 *
 * Filters live in the URL rather than in component state, which buys three
 * things for free: the back button works, a filtered view is shareable, and the
 * server does the filtering — so a free user never receives rows they are not
 * entitled to see and then has them hidden by CSS.
 *
 * Locked layers are rendered, visibly locked, rather than removed. A student
 * who cannot see that "study spots" exists cannot want it; one who can see it
 * behind a lock knows exactly what the paid tier is for.
 * ============================================================================
 */

const PRICE_FILTERS = [
  { value: "free", label: "Free" },
  { value: "under-5", label: "under5" },
  { value: "under-10", label: "under10" },
  { value: "verified", label: "Student verified", needsStacking: true },
] as const;

const LAYERS = [
  { value: "for-you", label: "For you", core: true },
  { value: "cheap-food", label: "Cheap food", core: true },
  { value: "free", label: "Free things", core: true },
  { value: "groceries", label: "Groceries" },
  { value: "study", label: "Study spots" },
  { value: "nightlife", label: "Nightlife" },
  { value: "fitness", label: "Gyms" },
  { value: "deals", label: "Deals" },
  { value: "events", label: "Events" },
] as const;

export function ExploreFilters({
  activeFilter,
  activeLayer,
  query,
  unlockedLayers,
  canStack,
  underTenLabel,
  underFiveLabel,
}: {
  activeFilter: string | null;
  activeLayer: string | null;
  query: string;
  unlockedLayers: boolean;
  canStack: boolean;
  underTenLabel: string;
  underFiveLabel: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(query);

  /** Build a URL preserving the other params. */
  const urlWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/discover?${qs}` : "/discover";
  };

  const labelFor = (value: string, fallback: string) =>
    value === "under-10" ? underTenLabel : value === "under-5" ? underFiveLabel : fallback;

  return (
    <div className="space-y-3">
      {/* ---- search ------------------------------------------------------- */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          router.push(urlWith({ q: search.trim() || null }));
        }}
        className="relative"
      >
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="cheap pizza, quiet café, student gym"
          aria-label="Search places"
          className="h-11 w-full rounded-full border border-ink-200 bg-white pr-10 pl-10 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 hover:border-ink-300 focus:border-ink-400"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setSearch("");
              router.push(urlWith({ q: null }));
            }}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:text-ink-800"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </form>

      {/* ---- price -------------------------------------------------------- */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        {PRICE_FILTERS.map((filter) => {
          const active = activeFilter === filter.value;
          const locked = "needsStacking" in filter && filter.needsStacking && !canStack;

          return (
            <Chip
              key={filter.value}
              href={urlWith({ filter: active ? null : filter.value })}
              active={active}
              locked={locked}
              lockHref="/upgrade?feature=combinedFilters"
            >
              {labelFor(filter.value, filter.label)}
            </Chip>
          );
        })}
      </div>

      {/* ---- layers ------------------------------------------------------- */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        {LAYERS.map((entry) => {
          const active = activeLayer === entry.value;
          const locked = !("core" in entry && entry.core) && !unlockedLayers;

          return (
            <Chip
              key={entry.value}
              href={urlWith({ layer: active ? null : entry.value })}
              active={active}
              locked={locked}
              lockHref="/upgrade?feature=allMapLayers"
            >
              {entry.label}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Chip                                                                        */
/* -------------------------------------------------------------------------- */

function Chip({
  href,
  active,
  locked,
  lockHref,
  children,
}: {
  href: string;
  active: boolean;
  locked: boolean;
  lockHref: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={locked ? lockHref : href}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.875rem] font-medium",
        "transition-colors duration-150",
        active
          ? "border-ink-950 bg-ink-950 text-paper"
          : locked
            ? "border-ink-200 bg-paper-2 text-ink-400"
            : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:text-ink-950",
      )}
    >
      {locked ? <Lock className="size-3" aria-hidden /> : null}
      {children}
    </Link>
  );
}
