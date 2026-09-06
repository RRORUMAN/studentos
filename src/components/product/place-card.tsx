"use client";

import { Footprints, Plus } from "lucide-react";

import { SourceNote, StudentVerified } from "@/components/product/verified";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Place } from "@/data/types";
import { cn, walk } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * The place card. Four things a student actually needs, in this order:
 * what it costs, how far it is, whether students back it, and why it is being
 * recommended at all. No photo, no star rating, no address.
 */
export function PlaceCard({ place, className }: { place: Place; className?: string }) {
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
          </p>
          <h3 className="mt-1 text-[0.9375rem] leading-snug font-semibold text-white">
            {place.name}
          </h3>
        </div>
        <span
          className={cn(
            "tnum shrink-0 rounded-full px-2.5 py-1 font-mono text-sm font-medium",
            place.price === 0 ? "bg-mint/15 text-mint" : "bg-white/8 text-white",
          )}
        >
          {place.price === 0 ? "Free" : place.priceLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
          <Footprints className="size-3.5" aria-hidden />
          <span className="tnum">{walk(place.walkMinutes)} walk</span>
        </span>
        <StudentVerified count={place.verifiedBy} size="sm" onDark />
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-micro uppercase tracking-[0.1em] text-white/35">
            Student value
          </span>
          <span className="tnum text-xs font-medium text-white/70">{place.studentValue}/100</span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-signal"
            style={{ width: `${place.studentValue}%` }}
          />
        </div>
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-white/60">{place.why}</p>

      <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-3">
        <SourceNote source={place.source} onDark />
        <Button
          size="sm"
          variant="onDarkGhost"
          onClick={() => {
            track("place_opened", { placeId: place.id, action: "add-to-plan" });
            toast({
              title: "Added to tonight",
              description: `${place.name} · ${place.priceLabel}`,
            });
          }}
        >
          <Plus className="size-3.5" aria-hidden />
          Add to plan
        </Button>
      </div>
    </article>
  );
}
