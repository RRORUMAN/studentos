"use client";

import { Plus } from "lucide-react";

import {
  Distance,
  OpenState,
  PlaceSource,
  PriceBand,
  ProviderRating,
  StudentValue,
  StudentVerified,
} from "@/components/product/place-meta";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Place } from "@/data/types";
import { cn } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * The place card, on a dark ground.
 *
 * Four things a student needs, in this order: what it is, how far it is,
 * whether it is open, and whether anything backs it. Everything on it came
 * from a provider or from a StudentOS row, and anything neither of them said
 * is simply absent — there is no slot on this card that renders a placeholder.
 */
export function PlaceCard({
  place,
  timezone,
  now,
  onAdd,
  className,
}: {
  place: Place;
  timezone: string;
  /** Passed in rather than read here, so the server and client agree on it. */
  now: Date;
  onAdd?: (place: Place) => void;
  className?: string;
}) {
  const toast = useToast();

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-micro uppercase tracking-[0.1em] text-white/35">
            {place.category}
            {place.brand && place.brand !== place.name ? ` · ${place.brand}` : ""}
          </p>
          <h3 className="mt-1 text-[0.9375rem] leading-snug font-semibold text-white">
            {place.name}
          </h3>
          {place.address ? (
            <p className="mt-0.5 truncate text-xs text-white/40">{place.address}</p>
          ) : null}
        </div>
        <PriceBand level={place.priceLevel} onDark />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Distance place={place} onDark />
        <OpenState place={place} timezone={timezone} now={now} onDark />
        <ProviderRating place={place} onDark />
        <StudentVerified count={place.confirmations} size="sm" onDark />
      </div>

      <StudentValue place={place} onDark />

      <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-3">
        <PlaceSource place={place} now={now} onDark />
        <Button
          size="sm"
          variant="onDarkGhost"
          onClick={() => {
            track("place_opened", { placeId: place.id, action: "add-to-plan" });
            onAdd?.(place);
            toast({ title: "Added to tonight", description: place.name });
          }}
        >
          <Plus className="size-3.5" aria-hidden />
          Add to plan
        </Button>
      </div>
    </article>
  );
}
