"use client";

import { Check, GraduationCap, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { setMoveDates, setUniversity } from "@/server/actions/profile";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * UNIVERSITY AND MOVE DATES
 * ----------------------------------------------------------------------------
 * Two settings that had no surface at all and drive a great deal of the
 * product: the campus decides event ranking, the campus feed, community
 * membership and social matching; the dates decide the lifecycle stage, which
 * decides what Home leads with and which tasks apply.
 * ============================================================================
 */

export function UniversityForm({
  campuses,
  currentCampusSlug,
  currentName,
  cityName,
}: {
  campuses: readonly { slug: string; name: string; shortName: string }[];
  currentCampusSlug: string | null;
  currentName: string | null;
  cityName: string;
}) {
  const [campusSlug, setCampusSlug] = useState<string | null>(currentCampusSlug);
  const [name, setName] = useState(currentCampusSlug ? "" : (currentName ?? ""));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold text-ink-950">
        <GraduationCap className="size-4.5 text-ink-400" />
        University
      </h2>
      <p className="mt-1 mb-4 text-[0.875rem] text-ink-500">
        Your campus decides which events are ranked first, which feed you see, and who you are matched with.
      </p>

      {campuses.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {campuses.map((campus) => (
            <button
              key={campus.slug}
              type="button"
              aria-pressed={campusSlug === campus.slug}
              onClick={() => {
                setCampusSlug(campusSlug === campus.slug ? null : campus.slug);
                setName("");
                setSaved(false);
              }}
              className={cn(
                "inline-flex h-10 items-center rounded-full border px-4 text-[0.875rem] font-medium transition-colors",
                campusSlug === campus.slug ? "border-ink-950 bg-ink-950 text-paper" : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
              )}
            >
              {campus.shortName}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[0.875rem] text-ink-500">
          No campuses are listed for {cityName} yet. Type your university and it still shows on your profile.
        </p>
      )}

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">
          {campuses.length > 0 ? "Not listed? Type it" : "University"}
        </span>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (event.target.value) setCampusSlug(null);
            setSaved(false);
          }}
          placeholder="The name students use"
          maxLength={120}
          className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>

      {error ? <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">{error}</p> : null}

      <Button
        variant="primary"
        size="md"
        className="mt-4"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await setUniversity({ campusSlug, universityName: name.trim() || null });
            if (!result.ok) setError(result.message);
            else setSaved(true);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
        {saved ? "Saved" : "Save university"}
      </Button>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Move dates                                                                  */
/* -------------------------------------------------------------------------- */

const HOUSING = [
  { value: "sorted", label: "Sorted" },
  { value: "university-halls", label: "Halls" },
  { value: "temporary", label: "Temporary" },
  { value: "searching", label: "Still looking" },
  { value: "with-family", label: "With family" },
  { value: "unknown", label: "Not saying" },
] as const;

export function MoveDatesForm({
  arrivingOn,
  leavingOn,
  housing,
  cityName,
}: {
  arrivingOn: string | null;
  leavingOn: string | null;
  housing: string;
  cityName: string;
}) {
  const [arrival, setArrival] = useState(arrivingOn ? arrivingOn.slice(0, 10) : "");
  const [leaving, setLeaving] = useState(leavingOn ? leavingOn.slice(0, 10) : "");
  const [where, setWhere] = useState(housing);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-5">
      <h2 className="text-[1.0625rem] font-semibold text-ink-950">Your move</h2>
      <p className="mt-1 mb-4 text-[0.875rem] text-ink-500">
        These decide what {cityName} leads with: a countdown and a document list before you land, the first-week list
        after, and the cancellation list when you are near the end.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">Arriving</span>
          <input
            type="date"
            value={arrival}
            onChange={(event) => {
              setArrival(event.target.value);
              setSaved(false);
            }}
            className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">Leaving</span>
          <input
            type="date"
            value={leaving}
            onChange={(event) => {
              setLeaving(event.target.value);
              setSaved(false);
            }}
            className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900"
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-ink-800">Housing</legend>
        <div className="flex flex-wrap gap-1.5">
          {HOUSING.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={where === option.value}
              onClick={() => {
                setWhere(option.value);
                setSaved(false);
              }}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[0.8125rem] font-medium transition-colors",
                where === option.value ? "border-ink-950 bg-ink-950 text-paper" : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {error ? <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">{error}</p> : null}

      <Button
        variant="primary"
        size="md"
        className="mt-4"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await setMoveDates({
              arrivingOn: arrival || null,
              leavingOn: leaving || null,
              housing: where as (typeof HOUSING)[number]["value"],
            });
            if (!result.ok) setError(result.message);
            else setSaved(true);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
        {saved ? "Saved" : "Save dates"}
      </Button>
    </section>
  );
}
