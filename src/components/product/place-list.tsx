import { PackageOpen, WifiOff } from "lucide-react";

import {
  Distance,
  OpenState,
  PlaceSource,
  PriceBand,
  ProviderRating,
  StudentValue,
  StudentVerified,
} from "@/components/product/place-meta";
import { ButtonLink } from "@/components/ui/button";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import type { Place } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * Light-ground list of places. Same data and same rules as the dark card, laid
 * out for reading rather than for tapping a pin.
 *
 * THREE EMPTY STATES, not one. A list with nothing in it can mean three
 * different things and the old version drew all of them as "Nothing here yet":
 *
 *   nothing found   the provider answered and there is genuinely nothing of
 *                   this kind nearby. A real answer.
 *   unavailable     no provider could be reached. NOT an answer, and saying
 *                   "nothing here" would be a false one.
 *   no city         we have no coordinate for this city, so no search was made.
 *
 * `unavailable` is the one that matters. It is the difference between a
 * student concluding there is no pharmacy near them and knowing our map is
 * down.
 */
export function PlaceList({
  places,
  timezone,
  now,
  unavailable,
  emptyTitle = "Nothing here yet",
  emptyBody,
  className,
}: {
  places: readonly Place[];
  timezone: string;
  now: Date;
  /** Set when no provider answered. Rendered instead of the empty state. */
  unavailable?: { message: string } | null;
  emptyTitle?: string;
  emptyBody?: string;
  className?: string;
}) {
  if (unavailable) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed border-amber/40 bg-amber-soft/40 px-6 py-14 text-center",
          className,
        )}
      >
        <WifiOff className="size-6 text-amber-deep" aria-hidden />
        <div>
          <p className="text-[0.9375rem] font-medium text-ink-950">{unavailable.message}</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
            This is our map service, not your connection. Places will come back on their own —
            nothing here is a statement about what is actually near you.
          </p>
        </div>
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-300 px-6 py-14 text-center",
          className,
        )}
      >
        <PackageOpen className="size-6 text-ink-300" aria-hidden />
        <div>
          <p className="text-[0.9375rem] font-medium text-ink-950">{emptyTitle}</p>
          {emptyBody ? (
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
              {emptyBody}
            </p>
          ) : null}
        </div>
        <ButtonLink href="/get-started" variant="primary" size="sm">
          Be the first to add one
        </ButtonLink>
      </div>
    );
  }

  return (
    <RevealGroup className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {places.map((place) => (
        <RevealItem
          key={place.id}
          className="flex flex-col rounded-lg border border-ink-200 bg-paper p-4 transition-[border-color,box-shadow] hover:border-ink-300 hover:shadow-[var(--shadow-raise)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                {place.category}
              </p>
              <h3 className="mt-1 text-[0.9375rem] leading-snug font-semibold text-ink-950">
                {place.name}
              </h3>
              {place.address ? (
                <p className="mt-0.5 truncate text-xs text-ink-400">{place.address}</p>
              ) : null}
            </div>
            <PriceBand level={place.priceLevel} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Distance place={place} />
            <OpenState place={place} timezone={timezone} now={now} />
            <ProviderRating place={place} />
          </div>

          <StudentValue place={place} className="mt-3 flex-1" />

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
            <StudentVerified count={place.confirmations} size="sm" />
            <PlaceSource place={place} now={now} />
          </div>
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
