"use client";

import { Check, GraduationCap, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { findInstitutions, type InstitutionOption } from "@/server/actions/institutions";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * UNIVERSITY PICKER
 * ----------------------------------------------------------------------------
 * Search the whole registry, rather than filter a shortlist.
 *
 * Madrid has more than thirty universities. This step used to offer four
 * buttons, then fifteen hand-typed rows, and now searches every higher
 * education institution in the country -- because a student at Rey Juan Carlos
 * who reads four names that are not theirs concludes in about two seconds that
 * the product was not built for them, and never revisits it.
 *
 * The list is fetched, not bundled. `findInstitutions` is a server action over
 * a dataset that is a few hundred rows today and will be thousands; onboarding
 * is the one screen where a slow first paint costs a signup, so it renders
 * immediately and the institutions arrive behind a debounce. An empty query
 * returns the student's own city, which is what the field opens with and what
 * most students will pick without typing at all.
 *
 * The three outcomes are deliberately different records, not one field with a
 * fallback:
 *
 *   a curated institution  → `campusSlug`, which joins the campus feed, campus
 *                            events and the commute figures that depend on
 *                            knowing where the buildings are
 *   an imported one        → `institutionId` and the name, no campus. The
 *                            product knows the place exists and does not
 *                            pretend to know the neighbourhood.
 *   typed by hand          → the name only, plus a row in the review queue
 *
 * That last case must not invent a campus. A made-up campus carries a made-up
 * neighbourhood into the commute engine, and a student is shown a confident
 * "18 min from campus" derived from nothing. `scoreCommute(null)` already
 * returns 0.5 -- an unknown scores neutral, never zero and never a pass -- so
 * admitting there is no geography is both honest and already handled.
 * ============================================================================
 */

/** Long enough that a fast typist makes one request per word, not per letter. */
const DEBOUNCE_MS = 180;

export type UniversityChoice = {
  institutionId: string | null;
  campusSlug: string | null;
  name: string;
};

export function UniversityPicker({
  cityName,
  citySlug,
  countryCode,
  choice,
  onPick,
  onClear,
}: {
  cityName: string;
  citySlug: string | null;
  countryCode: string | null;
  choice: UniversityChoice | null;
  onPick: (choice: UniversityChoice) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<InstitutionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const listId = useId();

  /* One in-flight search at a time, and a late answer to an old query is
     discarded rather than allowed to overwrite a newer one. Without the
     sequence number a slow request for "com" lands after a fast one for
     "complu" and the student watches their results get worse. */
  const sequence = useRef(0);

  useEffect(() => {
    /* No city yet means no search worth running. The visible list is derived
       below rather than cleared here, so nothing writes state during the
       effect body and no cascading render is triggered. */
    if (!citySlug) return;

    const ticket = (sequence.current += 1);
    const trimmed = query.trim();

    const timer = setTimeout(
      () => {
        setLoading(true);
        void findInstitutions({ query: trimmed, citySlug, countryCode })
          .then((results) => {
            if (ticket !== sequence.current) return;
            setOptions(results);
          })
          .catch(() => {
            if (ticket !== sequence.current) return;
            /* The typed-name path below still works, so a failed search costs
               the student a list, not the step. */
            setOptions([]);
          })
          .finally(() => {
            if (ticket === sequence.current) setLoading(false);
          });
      },
      /* No wait for the opening list: the student has not typed anything and
         should not watch a spinner for a screen they just arrived at. */
      trimmed ? DEBOUNCE_MS : 0,
    );

    return () => clearTimeout(timer);
  }, [query, citySlug, countryCode]);

  /* Derived, so leaving the city unset never needs a state write. */
  const results = citySlug ? options : [];

  const typed = query.trim();
  /* Offered whenever the search finds nothing, and also alongside results when
     what was typed is clearly not one of them -- a student at "Nebrija Business
     School" should not have to clear the box to be believed. */
  const canUseTyped =
    typed.length >= 2 &&
    !results.some((option) => option.name.toLowerCase() === typed.toLowerCase());

  return (
    <div className="space-y-3">
      {/* ---- what is currently chosen ------------------------------------ */}
      {choice ? (
        <div className="flex items-center gap-3 rounded-lg border border-ink-950 bg-white p-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-signal text-ink-950">
            <Check className="size-4.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-semibold text-ink-950">
              {choice.name}
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-500">
              {choice.campusSlug
                ? "Campus feed and commute times included"
                : choice.institutionId
                  ? "Found in the register"
                  : "Not in the register yet — saved as you typed it"}
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
          className="h-12 w-full rounded-md border border-ink-200 bg-white pl-11 pr-11 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus-visible:border-ink-950 focus-visible:outline-none"
        />
        {loading ? (
          <Loader2
            className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-300"
            aria-hidden
          />
        ) : null}
      </div>

      {/* ---- results ------------------------------------------------------ */}
      <div
        id={listId}
        role="listbox"
        aria-label="Universities"
        aria-busy={loading}
        className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5"
      >
        {results.map((option) => {
          const selected = choice?.institutionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                onPick({
                  institutionId: option.id,
                  campusSlug: option.campusSlug,
                  name: option.name,
                });
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
                  {option.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-400">
                  {option.detail}
                  {option.matchedAs ? ` · also known as ${option.matchedAs}` : ""}
                </span>
              </span>
            </button>
          );
        })}

        {canUseTyped ? (
          <button
            type="button"
            onClick={() => {
              onPick({ institutionId: null, campusSlug: null, name: typed });
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
                Not in the register yet. We will look it up — everything else still works.
              </span>
            </span>
          </button>
        ) : null}

        {results.length === 0 && !canUseTyped && !loading ? (
          <p className="rounded-lg border border-dashed border-ink-300 bg-paper px-4 py-6 text-center text-[0.875rem] text-ink-500">
            {citySlug
              ? "Keep typing — we will take whatever you enter."
              : "Pick a city first and we will show what is there."}
          </p>
        ) : null}
      </div>

      <p className="flex items-start gap-1.5 text-[0.8125rem] leading-relaxed text-ink-500">
        <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden />
        <span>
          Search covers every university and business school on record in the country, not just{" "}
          {cityName}. Yours missing? Type it and carry on — only the campus feed needs us to know
          the place.
        </span>
      </p>
    </div>
  );
}
