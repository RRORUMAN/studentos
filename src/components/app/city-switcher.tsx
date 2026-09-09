"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { CityContext } from "@/data/types";
import { setHomeCity } from "@/server/actions/profile";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * CITY SWITCHER
 * ----------------------------------------------------------------------------
 * Move home city. Every city in the directory is offered, with its status said
 * plainly — "Open" means the map, real places, budget, planner and Arrival Mode
 * all work there today, and the student layer fills in as people arrive. It
 * used to say "Coming soon", which stopped being true the day places came from
 * a provider: understating what is there is the same failure as overstating it.
 *
 * A relocation is free at every tier. Holding several cities at once is Max,
 * and is a different control.
 * ============================================================================
 */

export function CitySwitcher({
  cities,
  currentSlug,
  statusLabel,
}: {
  cities: readonly Pick<CityContext, "slug" | "name" | "country" | "status" | "currency" | "deep">[];
  currentSlug: string;
  statusLabel: Record<CityContext["status"], string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cities.filter((city) => !needle || city.name.toLowerCase().includes(needle) || city.country.toLowerCase().includes(needle));
  }, [cities, query]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20">
        Moving city?
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[0.9375rem] font-semibold text-ink-950">Move to another city</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100">
          <X className="size-4" />
        </button>
      </div>

      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cities" aria-label="Search cities" className="h-10 w-full rounded-lg bg-paper-2 pl-9 pr-3 text-[0.9375rem] text-ink-900 placeholder:text-ink-400" />
      </div>

      <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {filtered.map((city) => {
          const selected = (picked ?? currentSlug) === city.slug;
          return (
            <li key={city.slug}>
              <button
                type="button"
                onClick={() => setPicked(city.slug)}
                aria-pressed={selected}
                disabled={city.slug === currentSlug}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors", selected ? "bg-signal-soft" : "hover:bg-paper-2", city.slug === currentSlug && "opacity-60")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium text-ink-900">{city.name}</span>
                  <span className="block text-[0.75rem] text-ink-500">{city.country} · {city.currency.code}</span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", city.deep ? "bg-mint-soft text-mint-deep" : "bg-ink-100 text-ink-500")}>
                  {statusLabel[city.status]}
                </span>
                {selected ? <Check className="size-4 shrink-0 text-ink-950" /> : null}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[0.8125rem] text-ink-500">
        Moving resets your neighbourhood and campus. Saved places keep their city and come back when you do.
      </p>
      {error ? <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">{error}</p> : null}

      <Button
        variant="primary"
        size="md"
        block
        className="mt-3"
        disabled={pending || !picked || picked === currentSlug}
        onClick={() =>
          startTransition(async () => {
            if (!picked) return;
            const result = await setHomeCity(picked);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setOpen(false);
            router.push("/home");
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Move
      </Button>
    </div>
  );
}
