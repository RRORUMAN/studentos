import { BadgeCheck, Clock, ExternalLink, MapPin, Star, Users } from "lucide-react";

import { valueLabel, valueTone } from "@/config/places";
import type { Place } from "@/data/types";
import {
  describeProximity,
  freshnessLabel,
  openStateFrom,
  priceLevelLabel,
} from "@/domain/places";
import { hourIn, weekdayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { STUDENT_VERIFIED_THRESHOLD, isStudentVerified } from "@/services/db/schema";

/**
 * ============================================================================
 * PLACE META
 * ----------------------------------------------------------------------------
 * The small pieces every place card and list row is built from.
 *
 * They exist as one file because each of them encodes a rule about what may be
 * shown, and a rule copied into two components is a rule that will disagree
 * with itself. Specifically:
 *
 *   PRICE      a band or the words "Price not listed". Never an amount, because
 *              no provider gives us one.
 *   DISTANCE   metres unless a router produced minutes. `describeProximity`
 *              decides, from a field set at retrieval time.
 *   OPEN       only when the opening-hours string parsed cleanly, in the CITY's
 *              timezone. Anything unparsed renders nothing.
 *   RATING     only when the provider published one AND enough people rated it.
 *   VALUE      a band and its reasons. Never a percentage and never a bar.
 *   SOURCE     the provider, the licence, when it was checked, and a link to
 *              the row so anybody can see what we showed.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Price                                                                       */
/* -------------------------------------------------------------------------- */

export function PriceBand({
  level,
  onDark = false,
  className,
}: {
  level: number | null;
  onDark?: boolean;
  className?: string;
}) {
  const label = priceLevelLabel(level);
  const unknown = level === null;

  return (
    <span
      className={cn(
        "tnum shrink-0 rounded-full px-2.5 py-1 font-mono text-sm font-medium",
        unknown
          ? onDark
            ? "bg-white/8 text-white/50"
            : "bg-ink-100 text-ink-400"
          : level <= 1
            ? onDark
              ? "bg-mint/15 text-mint"
              : "bg-mint-soft text-mint-deep"
            : onDark
              ? "bg-white/8 text-white"
              : "bg-ink-100 text-ink-900",
        unknown && "text-xs",
        className,
      )}
      title={unknown ? "This provider does not publish a price level." : undefined}
    >
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Distance                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * How far away, and never a duration we did not measure.
 *
 * The icon changes with the answer: a pin for a distance, because a distance is
 * a fact about the map, and footprints only when something actually walked the
 * streets and came back with a number.
 */
export function Distance({
  place,
  onDark = false,
  className,
}: {
  place: Place;
  onDark?: boolean;
  className?: string;
}) {
  const routed = place.proximity.minutes !== null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        onDark ? "text-white/50" : "text-ink-400",
        className,
      )}
      title={
        routed
          ? "Travel time along the street network."
          : "Straight-line distance. Configure a routing provider for walking times."
      }
    >
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      <span className="tnum">{describeProximity(place.proximity)}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Open now                                                                    */
/* -------------------------------------------------------------------------- */

export function OpenState({
  place,
  timezone,
  now,
  onDark = false,
  className,
}: {
  place: Place;
  timezone: string;
  now: Date;
  onDark?: boolean;
  className?: string;
}) {
  const state = openStateFrom(place.openingHours, weekdayIn(now, timezone), hourIn(now, timezone) * 60);
  /* Unknown renders nothing at all. A grey "hours unknown" chip on most rows
     is noise on every card to say something about none of them. */
  if (state.state === "unknown") return null;

  const open = state.state === "open";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        open
          ? onDark
            ? "text-mint"
            : "text-mint-deep"
          : onDark
            ? "text-white/40"
            : "text-ink-400",
        className,
      )}
    >
      <Clock className="size-3.5 shrink-0" aria-hidden />
      {open
        ? state.until
          ? `Open until ${state.until}`
          : "Open now"
        : state.opensAt
          ? `Closed · opens ${state.opensAt}`
          : "Closed now"}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Rating                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The provider's rating, shown only when there is one and enough people behind
 * it. A 5.0 from two reviews is not information, and OpenStreetMap has no
 * ratings at all, so most rows render nothing here.
 */
export function ProviderRating({
  place,
  onDark = false,
  className,
}: {
  place: Place;
  onDark?: boolean;
  className?: string;
}) {
  if (place.rating === null || (place.ratingCount ?? 0) < 20) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        onDark ? "text-white/50" : "text-ink-500",
        className,
      )}
    >
      <Star className="size-3.5 shrink-0" aria-hidden />
      <span className="tnum">{place.rating.toFixed(1)}</span>
      <span className={onDark ? "text-white/30" : "text-ink-400"}>({place.ratingCount})</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Student value                                                               */
/* -------------------------------------------------------------------------- */

const VALUE_CLASS: Record<"signal" | "mint" | "amber" | "muted", { dark: string; light: string }> = {
  signal: { dark: "bg-signal/15 text-signal", light: "bg-signal-soft text-ink-950" },
  mint: { dark: "bg-mint/15 text-mint", light: "bg-mint-soft text-mint-deep" },
  amber: { dark: "bg-amber/15 text-amber", light: "bg-amber-soft text-amber-deep" },
  muted: { dark: "bg-white/8 text-white/50", light: "bg-ink-100 text-ink-500" },
};

/**
 * Value for money as a band, with the reasons underneath.
 *
 * What this replaced was a bar filled to a number between 0 and 100 that was
 * computed from hand-written fields. A bar is the most confident thing an
 * interface can draw; it says a measurement happened. Now the strongest claim
 * available is a word, and where there is not enough to say, it says so.
 */
export function StudentValue({
  place,
  onDark = false,
  showReasons = true,
  className,
}: {
  place: Place;
  onDark?: boolean;
  showReasons?: boolean;
  className?: string;
}) {
  const tone = VALUE_CLASS[valueTone[place.value.band]];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
          onDark ? tone.dark : tone.light,
        )}
      >
        {valueLabel[place.value.band]}
      </span>
      {showReasons && place.value.reasons.length > 0 ? (
        <p className={cn("text-[0.8125rem] leading-snug", onDark ? "text-white/55" : "text-ink-600")}>
          {place.value.reasons.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Student confirmations                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The badge means one specific thing: at least ten students independently
 * confirmed this, and the count is always shown next to it. It is not a star
 * rating, not a score, and never decorative — a place with nine confirmations
 * shows the count without the badge, and a place with none shows nothing at
 * all rather than "0 confirmed".
 */
export function StudentVerified({
  count,
  size = "md",
  onDark = false,
  className,
}: {
  count: number;
  size?: "sm" | "md";
  onDark?: boolean;
  className?: string;
}) {
  if (count === 0) return null;

  if (!isStudentVerified(count)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs",
          onDark ? "text-white/40" : "text-ink-400",
          className,
        )}
        title={`${STUDENT_VERIFIED_THRESHOLD} independent confirmations are needed for the Student Verified badge.`}
      >
        <Users className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
        <span className="tnum">{count} confirmed</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-xs",
        onDark ? "bg-mint/15 text-mint" : "bg-mint-soft text-mint-deep",
        className,
      )}
      title={`Confirmed independently by ${count} students. The badge needs at least ${STUDENT_VERIFIED_THRESHOLD}.`}
    >
      <BadgeCheck className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      Student verified
      <span className="tnum opacity-70">{count}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Source                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Where this came from, when it was checked, and a link to the original.
 *
 * The link is not a nicety. OpenStreetMap's licence requires attribution, and
 * more usefully it means a student who finds the shop has moved can go and fix
 * it — the only recommendation system in the product where being wrong is
 * repairable by the person who noticed.
 */
export function PlaceSource({
  place,
  now,
  onDark = false,
  className,
}: {
  place: Place;
  now: Date;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <a
      href={place.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs transition-colors",
        onDark ? "text-white/40 hover:text-white/70" : "text-ink-400 hover:text-ink-700",
        className,
      )}
      title={`${place.attribution} · ${freshnessLabel(place.fetchedAt, now)}`}
    >
      <span className="truncate">{place.attribution}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  );
}

/** The freshness line on its own, for surfaces with room for it. */
export function Freshness({
  place,
  now,
  onDark = false,
  className,
}: {
  place: Place;
  now: Date;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("text-xs", onDark ? "text-white/35" : "text-ink-400", className)}>
      {freshnessLabel(place.fetchedAt, now)}
    </span>
  );
}
