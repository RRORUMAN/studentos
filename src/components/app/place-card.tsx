import { Footprints, ShieldCheck, Tag, Users } from "lucide-react";
import Link from "next/link";

import { FeedbackMenu } from "@/components/app/feedback-menu";
import { SaveButton } from "@/components/app/save-button";
import { accents } from "@/components/ui/accent";
import { Badge, Meter } from "@/components/ui/primitives";
import type { Place } from "@/data/types";
import type { Scored } from "@/server/engines/recommend";
import { cn, money, walk } from "@/lib/utils";

/**
 * ============================================================================
 * SMART PLACE CARD
 * ----------------------------------------------------------------------------
 * Enough to decide immediately: price, walk, student value, your match, who
 * confirmed it, a live deal if one is attached, and why. Every field is on the
 * row or produced by the scorer.
 *
 * Student value is a word *and* a meter: "Excellent" is a decision, the bar
 * lets two cards be compared at a glance.
 * ============================================================================
 */

export function valueWord(score: number): { label: string; accent: "mint" | "signal" | "amber" } {
  if (score >= 85) return { label: "Excellent value", accent: "mint" };
  if (score >= 70) return { label: "Good value", accent: "signal" };
  return { label: "Fair value", accent: "amber" };
}

export function SmartPlaceCard({
  scored,
  where,
  campusSaved = false,
  friendsSaved = false,
  saved = false,
  deal = null,
}: {
  scored: Scored<Place>;
  where: { currency: string; locale: string };
  campusSaved?: boolean;
  friendsSaved?: boolean;
  /** Whether the viewer has bookmarked it. */
  saved?: boolean;
  /** A live deal attached to the place, when there is one. */
  deal?: { value: string; title: string } | null;
}) {
  const place = scored.item;
  const value = valueWord(place.studentValue);

  return (
    <article className="group relative flex flex-col rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            {place.category}
          </span>
          {place.price === 0 ? <Badge accent="mint" tone="solid">Free</Badge> : null}
          {deal ? (
            <Badge accent="amber" className="gap-1">
              <Tag className="size-3" aria-hidden />
              Deal · {deal.value}
            </Badge>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {place.price !== null && place.price > 0 ? (
            <span className="tnum font-mono text-[1.0625rem] font-semibold text-ink-950">
              {money(place.price, where)}
            </span>
          ) : place.price === null ? (
            <span className="text-[0.8125rem] text-ink-400">{place.priceLabel}</span>
          ) : null}
          <SaveButton kind="place" targetId={place.id} saved={saved} compact className="relative z-10" />
          <FeedbackMenu targetKind="place" targetId={place.id} compact className="relative z-10 -mr-1.5" />
        </div>
      </div>

      <h3 className="mt-1.5 text-[1.0625rem] leading-snug font-semibold text-ink-950">
        <Link href={`/discover/${place.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
          {place.name}
        </Link>
      </h3>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-600">
        <span className="inline-flex items-center gap-1">
          <Footprints className="size-3.5 text-ink-400" aria-hidden />
          <span className="tnum">{walk(place.walkMinutes)} walk</span>
        </span>
        {place.verifiedBy >= 10 ? (
          <span className="inline-flex items-center gap-1 text-mint-deep">
            <ShieldCheck className="size-3.5" aria-hidden />
            <span className="tnum">{place.verifiedBy}</span> confirmed
          </span>
        ) : null}
        {friendsSaved ? (
          <span className="inline-flex items-center gap-1 text-pulse-deep">
            <Users className="size-3.5" aria-hidden />
            Friends saved this
          </span>
        ) : campusSaved ? (
          <span className="inline-flex items-center gap-1 text-flow-deep">
            <Users className="size-3.5" aria-hidden />
            Students from your campus saved this
          </span>
        ) : null}
      </p>

      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[0.75rem]">
            <span className={cn("font-medium", accents[value.accent].text)}>{value.label}</span>
            <span className="tnum font-mono text-ink-400">{place.studentValue}/100</span>
          </div>
          <Meter value={place.studentValue} accent={value.accent} label={`Student value ${place.studentValue} of 100`} className="mt-1" />
        </div>
        {scored.match >= 60 ? (
          <span
            className={cn(
              "tnum inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-mono text-micro font-semibold",
              scored.match >= 80 ? "bg-signal text-ink-950" : "bg-signal-soft text-signal-deep",
            )}
          >
            {scored.match}% match
          </span>
        ) : null}
      </div>

      {scored.reasons.length > 0 ? (
        <p className="mt-2.5 text-[0.8125rem] leading-snug text-ink-500">
          <span className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">Why </span>
          {scored.reasons.slice(0, 3).join(" · ")}
        </p>
      ) : null}
    </article>
  );
}
