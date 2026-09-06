"use client";

import { Lock, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * DISCOVER FILTERS
 * ----------------------------------------------------------------------------
 * One rail of tabs, one row of price caps, one search box. Everything is in the
 * URL: the back button works, a view is shareable, and the server filters, so
 * a free student never receives rows they are not entitled to and then has
 * them hidden by CSS.
 *
 * Locked tabs render, visibly locked, rather than vanishing. A student who
 * cannot see that "Study spots" exists cannot want it.
 * ============================================================================
 */

export type DiscoverTab = {
  value: string;
  label: string;
  locked: boolean;
};

export function DiscoverFilters({
  tabs,
  activeTab,
  activeCap,
  query,
  caps,
  verifiedLocked,
  verifiedActive,
}: {
  tabs: readonly DiscoverTab[];
  activeTab: string;
  activeCap: string | null;
  query: string;
  caps: readonly { value: string; label: string }[];
  verifiedLocked: boolean;
  verifiedActive: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(query);

  const urlWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/discover?${qs}` : "/discover";
  };

  return (
    <div className="space-y-2.5">
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
          className="h-11 w-full rounded-full bg-white pr-10 pl-10 text-[0.9375rem] text-ink-900 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/8 placeholder:text-ink-400 focus:ring-ink-950/25"
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

      <nav
        aria-label="Discover views"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.locked ? "/upgrade?feature=allMapLayers" : urlWith({ tab: tab.value === "for-you" ? null : tab.value })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.875rem] font-medium transition-colors",
                active
                  ? "bg-ink-950 text-paper"
                  : tab.locked
                    ? "bg-paper-2 text-ink-400"
                    : "bg-white text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20",
              )}
            >
              {tab.locked ? <Lock className="size-3" aria-hidden /> : null}
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        {caps.map((cap) => {
          const active = activeCap === cap.value;
          return (
            <Link
              key={cap.value}
              href={urlWith({ max: active ? null : cap.value })}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
                active ? "bg-mint-soft text-mint-deep ring-1 ring-mint-deep/30" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
              )}
            >
              {cap.label}
            </Link>
          );
        })}
        <Link
          href={verifiedLocked ? "/upgrade?feature=combinedFilters" : urlWith({ verified: verifiedActive ? null : "1" })}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
            verifiedActive
              ? "bg-mint-soft text-mint-deep ring-1 ring-mint-deep/30"
              : verifiedLocked
                ? "bg-paper-2 text-ink-400"
                : "bg-paper-2 text-ink-600 hover:bg-ink-100",
          )}
        >
          {verifiedLocked ? <Lock className="size-3" aria-hidden /> : null}
          Student verified
        </Link>
      </div>
    </div>
  );
}
