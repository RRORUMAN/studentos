import { Clock, ExternalLink, Footprints, MapPin, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

import { InterestedToggle } from "@/components/app/event-actions";
import { FeedbackMenu } from "@/components/app/feedback-menu";
import { SaveButton } from "@/components/app/save-button";
import { Badge } from "@/components/ui/primitives";
import type { CityEvent } from "@/domain/types";
import type { EventEnergy } from "@/server/queries/events";
import type { Scored } from "@/server/engines/recommend";
import { fmtDay, fmtWhen } from "@/lib/dates";
import { cn, money, PRICE_NOT_LISTED } from "@/lib/utils";

/**
 * ============================================================================
 * EVENT CARD — the radar card
 * ----------------------------------------------------------------------------
 * Title, price, time, venue, walk, who is going, where the row came from, why
 * it is being shown, a bookmark and a one-tap Interested. The social line is
 * the point: "42 interested · 11 from your university · 2 friends" is what
 * turns a listing into something a student acts on.
 *
 * Every number is a count of rows. The image slot renders the source's own
 * image when the row carries one; otherwise a coloured field keyed on kind,
 * because a stock photo would be a lie about the venue. The walk time appears
 * only when the profile has a home point — never a default number.
 * ============================================================================
 */

const KIND_FIELD: Record<CityEvent["kind"], string> = {
  music: "from-pulse/70 to-pulse-deep/60",
  nightlife: "from-ink-800 to-ink-950",
  networking: "from-flow/70 to-flow-deep/70",
  sports: "from-mint/70 to-mint-deep/60",
  university: "from-signal/80 to-signal-deep/60",
  culture: "from-amber/70 to-amber-deep/60",
  tech: "from-flow-deep/70 to-ink-900",
  food: "from-amber/60 to-pulse/60",
  social: "from-pulse/60 to-signal/70",
  outdoor: "from-mint/60 to-flow/50",
};

export const eventKindLabel: Record<CityEvent["kind"], string> = {
  music: "Music",
  nightlife: "Nightlife",
  networking: "Networking",
  sports: "Sports",
  university: "University",
  culture: "Culture",
  tech: "Technology",
  food: "Food",
  social: "Social",
  outdoor: "Outdoor",
};

export function RadarCard({
  scored,
  energy,
  where,
  now,
  timeZone,
  campusName,
  saved = false,
}: {
  scored: Scored<CityEvent>;
  energy: EventEnergy | undefined;
  where: { currency: string; locale: string };
  now: Date;
  /** The city's IANA zone. Times are the city's, never the browser's. */
  timeZone: string;
  campusName: string | null;
  /** Whether the viewer has bookmarked it. */
  saved?: boolean;
}) {
  const event = scored.item;
  const interested = event.interested + (energy?.interested ?? 0);
  const going = energy?.going ?? 0;
  const friends = energy?.friends ?? [];
  const walk = scored.walkMinutes ?? null;
  const checkedAgoDays = (now.getTime() - Date.parse(event.observedAt)) / 86_400_000;
  const freshness = checkedAgoDays <= 7 ? "Checked this week" : `Checked ${fmtDay(event.observedAt, timeZone, now)}`;
  const hasSocial = interested > 0 || going > 0 || friends.length > 0 || (energy?.fromCampus ?? 0) > 0 || (energy?.lookingForCompany ?? 0) > 0;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      {/* ---- field ------------------------------------------------------- */}
      <div className={cn("relative h-28 bg-linear-to-br", KIND_FIELD[event.kind])}>
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the source publishes the image on its own host; remote hosts are not known ahead of time for next/image.
          <img src={event.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        ) : null}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="rounded-full bg-ink-950/70 px-2.5 py-1 font-mono text-micro uppercase tracking-[0.1em] text-paper backdrop-blur-sm">
            {eventKindLabel[event.kind]}
          </span>
          {event.priceCents === 0 ? (
            <Badge accent="mint" tone="solid">Free</Badge>
          ) : event.priceCents === null ? (
            /* Not a badge and not mint. An unpriced row is the absence of a
               claim, and it must not compete for the eye with the events that
               really are free. */
            <span className="rounded-full bg-paper/90 px-2.5 py-1 font-mono text-[0.75rem] font-medium text-ink-500">
              {PRICE_NOT_LISTED}
            </span>
          ) : (
            <span className="tnum rounded-full bg-paper px-2.5 py-1 font-mono text-[0.8125rem] font-semibold text-ink-950">
              {money(event.priceCents / 100, where)}
            </span>
          )}
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          {energy?.mine ? (
            <span className="rounded-full bg-paper px-2.5 py-1 text-[0.75rem] font-semibold text-ink-950">
              {energy.mine === "going" ? "You're going" : "You're interested"}
            </span>
          ) : (
            <span />
          )}
          <SaveButton kind="event" targetId={event.id} saved={saved} compact className="relative z-10" />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[1.0625rem] leading-snug font-semibold text-ink-950">
            <Link href={`/events/${event.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
              {event.title}
            </Link>
          </h3>
          <FeedbackMenu targetKind="event" targetId={event.id} compact className="relative z-10 -mr-1.5" />
        </div>

        <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-600">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-ink-400" aria-hidden />
            <dt className="sr-only">When</dt>
            <dd>{fmtWhen(event.startsAt, timeZone, now)}</dd>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <MapPin className="size-3.5 text-ink-400" aria-hidden />
            <dt className="sr-only">Where</dt>
            <dd className="truncate">{event.venue}</dd>
          </div>
          {walk !== null ? (
            <div className="flex items-center gap-1.5">
              <Footprints className="size-3.5 text-ink-400" aria-hidden />
              <dt className="sr-only">Walk</dt>
              <dd className="tnum">{walk} min walk</dd>
            </div>
          ) : null}
        </dl>

        {/* ---- energy ----------------------------------------------------- */}
        {hasSocial ? (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] font-medium text-ink-800">
            <Users className="size-3.5 text-ink-400" aria-hidden />
            {going > 0 ? <span className="tnum">{going} going</span> : null}
            {interested > 0 ? <span className="tnum">{interested} students interested</span> : null}
            {energy && energy.fromCampus > 0 ? (
              <span className="tnum text-flow-deep">
                {energy.fromCampus} from {campusName ?? "your university"}
              </span>
            ) : null}
            {friends.length > 0 ? (
              <span className="flex items-center gap-1 text-pulse-deep">
                {friends.slice(0, 3).map((friend) => (
                  <span key={friend.userId} aria-hidden>
                    {friend.avatarEmoji}
                  </span>
                ))}
                {friends.length === 1
                  ? `${friends[0].displayName} is ${friends[0].status}`
                  : friends.length === 2
                    ? `${friends[0].displayName} and ${friends[1].displayName}`
                    : `${friends[0].displayName} and ${friends.length - 1} more friends`}
              </span>
            ) : null}
            {energy && energy.lookingForCompany > 0 ? (
              <span className="text-signal-deep">
                {energy.lookingForCompany} looking for people to go with
              </span>
            ) : null}
          </p>
        ) : null}

        {scored.reasons.length > 0 ? (
          <p className="mt-2 text-[0.8125rem] text-ink-500">
            <span className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">Why </span>
            {scored.reasons.slice(0, 3).join(" · ")}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.75rem] text-ink-400">
            {event.confirmations >= 10 ? (
              <span className="inline-flex items-center gap-1 text-mint-deep">
                <ShieldCheck className="size-3.5" />
                Verified
              </span>
            ) : null}
            <span>
              {event.source === "official" ? "Official" : event.source === "venue" ? "Venue" : "Students"}
            </span>
            {event.sourceUrl ? <ExternalLink className="size-3" aria-hidden /> : null}
            <span aria-hidden>·</span>
            <span>{freshness}</span>
          </p>
          <InterestedToggle eventId={event.id} status={energy?.mine ?? null} />
        </div>
      </div>
    </article>
  );
}
