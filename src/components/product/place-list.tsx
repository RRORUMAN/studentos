import { Footprints, PackageOpen } from "lucide-react";

import { SourceNote, StudentVerified } from "@/components/product/verified";
import { ButtonLink } from "@/components/ui/button";
import { Meter } from "@/components/ui/primitives";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import type { Place } from "@/data/types";
import { cn, walk } from "@/lib/utils";

/**
 * Light-ground list of places, used on the city sub-pages. Same data and same
 * rules as the map's place card, laid out for reading rather than for tapping
 * a pin.
 */
export function PlaceList({
  places,
  emptyTitle = "Nothing here yet",
  emptyBody,
  className,
}: {
  places: readonly Place[];
  emptyTitle?: string;
  emptyBody?: string;
  className?: string;
}) {
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
            </div>
            <span
              className={cn(
                "tnum shrink-0 rounded-full px-2.5 py-1 font-mono text-sm font-medium",
                place.price === 0 ? "bg-mint-soft text-mint-deep" : "bg-ink-100 text-ink-900",
              )}
            >
              {place.priceLabel}
            </span>
          </div>

          <p className="mt-2.5 flex-1 text-[0.875rem] leading-relaxed text-ink-600">{place.why}</p>

          <div className="mt-3.5">
            <div className="flex items-center justify-between gap-3 text-xs text-ink-400">
              <span className="inline-flex items-center gap-1.5">
                <Footprints className="size-3.5" aria-hidden />
                <span className="tnum">{walk(place.walkMinutes)}</span>
              </span>
              <span className="tnum">Student value {place.studentValue}/100</span>
            </div>
            <Meter value={place.studentValue} accent="signal" className="mt-2" label="Student value" />
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
            <StudentVerified count={place.verifiedBy} size="sm" />
            <SourceNote source={place.source} />
          </div>
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
