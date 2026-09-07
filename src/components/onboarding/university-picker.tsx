"use client";

import { Check, GraduationCap, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

import type { Campus } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * UNIVERSITY PICKER
 * ----------------------------------------------------------------------------
 * Search and pick, rather than a shortlist and a consolation text box.
 *
 * Madrid has more than thirty universities. The old step offered four buttons
 * and, underneath them, "Not listed? Type it instead." — which is the right
 * escape hatch attached to the wrong default. A student at Rey Juan Carlos read
 * four names that were not theirs and concluded the product was not for them,
 * which is a judgement made in about two seconds and never revisited.
 *
 * So the search field comes first and the list is what it filters. Every
 * university StudentOS knows about is reachable, and anything it does not know
 * about is one keystroke away from being accepted as typed.
 *
 * The two outcomes are deliberately different records, not one field with a
 * fallback:
 *
 *   a known campus  → `campusSlug`, which joins the campus feed, campus events
 *                     and the commute figures that depend on knowing where the
 *                     buildings are
 *   typed by hand   → `universityName` only, with `campusSlug` null
 *
 * That second case must not invent a campus row. A made-up campus would carry a
 * made-up neighbourhood into the commute engine, and a student would be shown a
 * confident "18 min from campus" derived from nothing. Recording the name and
 * admitting there is no geography for it is the honest version, and the profile
 * has carried both fields since it was written.
 * ============================================================================
 */

/** Fold accents so "Autonoma" finds "Autónoma" and "politecnica" finds "Politécnica". */
function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function UniversityPicker({
  cityName,
  campuses,
  campusSlug,
  universityName,
  onPickCampus,
  onPickTyped,
  onClear,
}: {
  cityName: string;
  campuses: readonly Campus[];
  campusSlug: string | null;
  universityName: string;
  onPickCampus: (slug: string) => void;
  onPickTyped: (name: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const listId = useId();

  const matches = useMemo(() => {
    const needle = normalise(query);
    if (!needle) return campuses;
    return campuses.filter((campus) =>
      [campus.name, campus.shortName, campus.area].some((field) =>
        normalise(field).includes(needle),
      ),
    );
  }, [campuses, query]);

  const typed = query.trim();
  /* Offered whenever the search finds nothing, and also alongside results when
     what was typed is clearly not one of them — a student at "Nebrija Business
     School" should not have to clear the box to be believed. */
  const canUseTyped =
    typed.length >= 2 &&
    !matches.some((campus) => normalise(campus.name) === normalise(typed));

  const chosenCampus = campuses.find((campus) => campus.slug === campusSlug) ?? null;
  const hasChoice = Boolean(chosenCampus) || universityName.trim().length > 0;

  return (
    <div className="space-y-3">
      {/* ---- what is currently chosen ------------------------------------ */}
      {hasChoice ? (
        <div className="flex items-center gap-3 rounded-lg border border-ink-950 bg-white p-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-signal text-ink-950">
            <Check className="size-4.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-semibold text-ink-950">
              {chosenCampus ? chosenCampus.name : universityName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-500">
              {chosenCampus
                ? chosenCampus.area
                : "Not in our list yet — saved as you typed it"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onClear();
              setQuery("");
            }}
            className="shrink-0 rounded-md p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Clear the chosen university</span>
          </button>
        </div>
      ) : null}

      {/* ---- search ------------------------------------------------------- */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search universities in ${cityName}`}
          aria-label={`Search universities in ${cityName}`}
          aria-controls={listId}
          autoComplete="off"
          className="h-12 w-full rounded-md border border-ink-200 bg-white pl-11 pr-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus-visible:border-ink-950 focus-visible:outline-none"
        />
      </div>

      {/* ---- results ------------------------------------------------------ */}
      <div
        id={listId}
        role="listbox"
        aria-label="Universities"
        className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5"
      >
        {matches.map((campus) => {
          const selected = campusSlug === campus.slug;
          return (
            <button
              key={campus.slug}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                onPickCampus(campus.slug);
                setQuery("");
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950",
                selected
                  ? "border-ink-950 bg-white"
                  : "border-ink-200 bg-paper hover:border-ink-300 hover:bg-white",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-md",
                  selected ? "bg-signal text-ink-950" : "bg-flow-soft text-flow-deep",
                )}
              >
                {selected ? (
                  <Check className="size-4.5" aria-hidden />
                ) : (
                  <GraduationCap className="size-4.5" aria-hidden />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[0.9375rem] font-semibold text-ink-950">
                  {campus.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-400">{campus.area}</span>
              </span>
            </button>
          );
        })}

        {canUseTyped ? (
          <button
            type="button"
            onClick={() => {
              onPickTyped(typed);
              setQuery("");
            }}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-ink-300 bg-paper p-3.5 text-left transition-colors hover:border-ink-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-ink-100 text-ink-600">
              <GraduationCap className="size-4.5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.9375rem] font-semibold text-ink-950">
                Use &ldquo;{typed}&rdquo;
              </span>
              <span className="mt-0.5 block text-xs text-ink-400">
                We do not have this one yet. Everything else still works.
              </span>
            </span>
          </button>
        ) : null}

        {matches.length === 0 && !canUseTyped ? (
          <p className="rounded-lg border border-dashed border-ink-300 bg-paper px-4 py-6 text-center text-[0.875rem] text-ink-500">
            Keep typing — we will take whatever you enter.
          </p>
        ) : null}
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-ink-500">
        {campuses.length > 0 ? (
          <>
            <span className="tnum">{campuses.length}</span> universities in {cityName} so far. Yours
            not among them? Type it and carry on — only the campus feed needs us to know the place.
          </>
        ) : (
          <>We have no universities listed for {cityName} yet. Type yours and carry on.</>
        )}
      </p>
    </div>
  );
}
