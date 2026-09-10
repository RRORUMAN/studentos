import { ArrowRight, MapPin, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Place } from "@/data/types";
import { describeProximity } from "@/domain/places";
import { PriceBand } from "@/components/product/place-meta";
import { accents, type Accent } from "@/components/ui/accent";
import type { Scored } from "@/server/engines/recommend";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * PRODUCT CARDS
 * ----------------------------------------------------------------------------
 * The repeating objects: a place, an event, a section of them.
 *
 * One rule governs every card here, and it is the rule the whole product's
 * credibility rests on: **a card only prints facts that exist on the row.**
 * The price is the stored price, the walk is a computed distance, the "why" is
 * a reason the scorer actually produced, and the confirmation count is a count
 * of confirmations. Nothing is decorative, nothing is generated to fill a slot,
 * and a missing value renders as absent rather than as a plausible guess.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Match                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The match percentage.
 *
 * Only shown above 60. Below that it is noise dressed as precision — a "34%
 * match" tells a student nothing they can act on and makes the number look
 * arbitrary everywhere it appears.
 */
export function MatchChip({ match }: { match: number }) {
  if (match < 60) return null;

  return (
    <span className="tnum shrink-0 rounded-full bg-signal-soft px-2 py-0.5 font-mono text-micro font-semibold text-signal-deep">
      {match}% match
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Reasons                                                                     */
/* -------------------------------------------------------------------------- */

/** The "why this" line. Facts from the row, joined — never a generated sentence. */
export function Reasons({ reasons }: { reasons: readonly string[] }) {
  if (reasons.length === 0) return null;

  return (
    <p className="mt-2 text-[0.8125rem] leading-snug text-ink-500">
      {reasons.slice(0, 3).join(" · ")}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Place card                                                                  */
/* -------------------------------------------------------------------------- */

export function PlaceCard({
  scored,
}: {
  scored: Scored<Place>;
}) {
  const place = scored.item;

  return (
    <article className="group relative flex flex-col rounded-lg border border-ink-200 bg-white p-4 transition-[border-color,box-shadow] hover:border-ink-300 hover:shadow-[var(--shadow-raise)]">
      <div className="flex items-start justify-between gap-3">
        <PriceBand level={place.priceLevel} />
        <MatchChip match={scored.match} />
      </div>

      <h3 className="mt-2.5 text-[1.0625rem] leading-snug font-semibold text-ink-950">
        <Link href={`/discover/${place.id}`} className="after:absolute after:inset-0">
          {place.name}
        </Link>
      </h3>

      <p className="mt-0.5 text-[0.8125rem] text-ink-500">{place.category}</p>

      <dl className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[0.8125rem] text-ink-500">
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3.5" aria-hidden />
          <dd>{describeProximity(place.proximity)}</dd>
        </div>
        {place.confirmations >= 10 ? (
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            <dd>
              Verified by <span className="tnum">{place.confirmations}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <Reasons reasons={scored.reasons} />
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Section                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A titled block with an optional "see all".
 *
 * The `empty` slot is required rather than optional: a section with nothing in
 * it has to say something useful, and making that a required prop is what stops
 * eight silent blank rails shipping on a new city.
 */
export function Block({
  title,
  hint,
  href,
  hrefLabel = "See all",
  accent,
  children,
  empty,
  isEmpty = false,
}: {
  title: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
  accent?: Accent;
  children: ReactNode;
  empty: ReactNode;
  isEmpty?: boolean;
}) {
  return (
    <section className="mt-9 first:mt-0">
      <div className="mb-3.5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[1.125rem] font-semibold text-ink-950">
            {accent ? (
              <span aria-hidden className={cn("size-2 rounded-full", accents[accent].fill)} />
            ) : null}
            {title}
          </h2>
          {hint ? <p className="mt-0.5 text-[0.8125rem] text-ink-500">{hint}</p> : null}
        </div>

        {href && !isEmpty ? (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-[0.875rem] font-medium text-ink-600 hover:text-ink-950"
          >
            {hrefLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>

      {isEmpty ? empty : children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Empty states get a line that says what to do next, not an apology.
 *
 * "Nothing here yet" is the failure mode; "your campus is quiet — start the
 * conversation" is a product that still works when it has no data.
 */
export function Empty({
  line,
  action,
  href,
}: {
  line: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-ink-300 bg-paper-2/60 px-5 py-8 text-center">
      <p className="text-[0.9375rem] text-ink-600">{line}</p>
      {action && href ? (
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-950 underline underline-offset-4"
        >
          {action}
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* What used to be here                                                        */
/* -------------------------------------------------------------------------- */

/*
 * `EventCard`, `PriceTag`, `Rail` and `RailItem` were removed on 2026-09-10.
 * Nothing rendered any of them: every surface that shows an event grew its own
 * card, and the rails became grids. They were not harmless. `EventCard` carried
 * a private `eventTime` that formatted an event in the SERVER's timezone and
 * compared it against the server's idea of today, so the one card in the
 * codebase that would have printed "Tonight" for a Madrid student was deciding
 * what "tonight" meant in whichever region the instance ran in — the bug
 * `src/lib/dates.ts` exists to make impossible, sitting in a file a new screen
 * would reasonably import from.
 *
 * `PlaceCard`, `Block` and `Empty` below are used and stay.
 */
