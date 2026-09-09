import { ShieldCheck, Tag, Users } from "lucide-react";
import Link from "next/link";

import { FeedbackMenu } from "@/components/app/feedback-menu";
import { SaveButton } from "@/components/app/save-button";
import {
  Distance,
  OpenState,
  PlaceSource,
  PriceBand,
  ProviderRating,
} from "@/components/product/place-meta";
import { valueLabel, valueTone } from "@/config/places";
import { accents } from "@/components/ui/accent";
import { Badge } from "@/components/ui/primitives";
import type { Place } from "@/data/types";
import type { Scored } from "@/server/engines/recommend";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * SMART PLACE CARD
 * ----------------------------------------------------------------------------
 * Enough to decide immediately: what it is, what band it is in, how far it is,
 * whether it is open, who confirmed it, a live deal if one is attached, and
 * why it is here. Every field is on the row or produced by the scorer.
 *
 * WHAT WENT, AND WHY. There used to be a meter: student value as a bar filled
 * to a number out of a hundred. A bar is the most confident thing an interface
 * can draw — it says a measurement happened — and the number behind it was
 * written by hand on an invented place. The band and its reasons replace it,
 * and where there is not enough to say, the card says that instead of drawing
 * a shorter bar.
 *
 * The match percentage stays, and is a different kind of claim: it is computed
 * from THIS student's stated preferences against fields that exist, and it
 * says how well something fits them rather than how good it is.
 * ============================================================================
 */

export function SmartPlaceCard({
  scored,
  now,
  timezone,
  campusSaved = false,
  friendsSaved = false,
  saved = false,
  deal = null,
}: {
  scored: Scored<Place>;
  /** Passed in so the server and the client agree on what "now" is. */
  now: Date;
  timezone: string;
  campusSaved?: boolean;
  friendsSaved?: boolean;
  /** Whether the viewer has bookmarked it. */
  saved?: boolean;
  /** A live deal attached to the place, when there is one. */
  deal?: { value: string; title: string } | null;
}) {
  const place = scored.item;
  const tone = valueTone[place.value.band];

  return (
    <article className="group relative flex flex-col rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            {place.category}
          </span>
          {place.layers.includes("free") ? (
            <Badge accent="mint" tone="solid">
              Free to enter
            </Badge>
          ) : null}
          {deal ? (
            <Badge accent="amber" className="gap-1">
              <Tag className="size-3" aria-hidden />
              Deal · {deal.value}
            </Badge>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <PriceBand level={place.priceLevel} />
          <SaveButton
            kind="place"
            targetId={place.id}
            saved={saved}
            compact
            className="relative z-10"
          />
          <FeedbackMenu
            targetKind="place"
            targetId={place.id}
            compact
            className="relative z-10 -mr-1.5"
          />
        </div>
      </div>

      <h3 className="mt-1.5 text-[1.0625rem] leading-snug font-semibold text-ink-950">
        <Link
          href={`/discover/${place.id}`}
          className="after:absolute after:inset-0 after:rounded-2xl"
        >
          {place.name}
        </Link>
      </h3>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-600">
        <Distance place={place} />
        <OpenState place={place} timezone={timezone} now={now} />
        <ProviderRating place={place} />
        {place.confirmations >= 10 ? (
          <span className="inline-flex items-center gap-1 text-mint-deep">
            <ShieldCheck className="size-3.5" aria-hidden />
            <span className="tnum">{place.confirmations}</span> confirmed
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
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-[0.75rem] font-medium",
            tone === "muted" ? "text-ink-400" : accents[tone].text,
          )}
        >
          {valueLabel[place.value.band]}
        </span>
        {scored.match >= 60 ? (
          <span
            className={cn(
              "tnum inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-mono text-micro font-semibold",
              scored.match >= 80 ? "bg-signal text-ink-950" : "bg-signal-soft text-signal-deep",
            )}
            title="How well this fits the preferences you set, not how good it is."
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

      <div className="mt-2.5 border-t border-ink-100 pt-2.5">
        <PlaceSource place={place} now={now} />
      </div>
    </article>
  );
}
