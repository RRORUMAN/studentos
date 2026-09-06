import { Clock, ExternalLink, MapPin, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

import { FeedbackMenu } from "@/components/app/feedback-menu";
import { Badge } from "@/components/ui/primitives";
import type { CityEvent } from "@/domain/types";
import type { EventEnergy } from "@/server/queries/events";
import type { Scored } from "@/server/engines/recommend";
import { cn, money } from "@/lib/utils";
import { whenLabel } from "@/components/app/feed-card";

/**
 * ============================================================================
 * EVENT CARD — the radar card
 * ----------------------------------------------------------------------------
 * Title, price, time, venue, who is going, where the row came from, and why it
 * is being shown. The social line is the point of the redesign: "42 interested
 * · 11 from your university · 2 friends" is what turns a listing into
 * something a student acts on.
 *
 * Every number is a count of rows. The image slot is a coloured field keyed on
 * kind, because the rows carry no photos and a stock image would be a lie
 * about the venue.
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

const KIND_LABEL: Record<CityEvent["kind"], string> = {
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
  campusName,
}: {
  scored: Scored<CityEvent>;
  energy: EventEnergy | undefined;
  where: { currency: string; locale: string };
  now: Date;
  campusName: string | null;
}) {
  const event = scored.item;
  const interested = event.interested + (energy?.interested ?? 0);
  const going = energy?.going ?? 0;
  const friends = energy?.friends ?? [];
  const fresh = now.getTime() - Date.parse(event.observedAt) < 7 * 86_400_000;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      {/* ---- field ------------------------------------------------------- */}
      <div className={cn("relative h-24 bg-linear-to-br", KIND_FIELD[event.kind])}>
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <span className="rounded-full bg-ink-950/70 px-2.5 py-1 font-mono text-micro uppercase tracking-[0.1em] text-paper backdrop-blur-sm">
            {KIND_LABEL[event.kind]}
          </span>
          {event.priceCents === 0 ? (
            <Badge accent="mint" tone="solid">Free</Badge>
          ) : (
            <span className="tnum rounded-full bg-paper px-2.5 py-1 font-mono text-[0.8125rem] font-semibold text-ink-950">
              {money(event.priceCents / 100, where)}
            </span>
          )}
        </div>
        {energy?.mine ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-paper px-2.5 py-1 text-[0.75rem] font-semibold text-ink-950">
            {energy.mine === "going" ? "You're going" : "You're interested"}
          </span>
        ) : null}
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
            <dd>{whenLabel(event.startsAt, now)}</dd>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <MapPin className="size-3.5 text-ink-400" aria-hidden />
            <dd className="truncate">{event.venue}</dd>
          </div>
        </dl>

        {/* ---- energy ----------------------------------------------------- */}
        {interested > 0 || going > 0 || friends.length > 0 || (energy?.fromCampus ?? 0) > 0 ? (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] font-medium text-ink-800">
            <Users className="size-3.5 text-ink-400" aria-hidden />
            {going > 0 ? <span className="tnum">{going} going</span> : null}
            {interested > 0 ? <span className="tnum">{interested} interested</span> : null}
            {energy && energy.fromCampus > 0 ? (
              <span className="tnum text-flow-deep">
                {energy.fromCampus} from {campusName ?? "your campus"}
              </span>
            ) : null}
            {friends.length > 0 ? (
              <span className="flex items-center gap-1 text-pulse-deep">
                {friends.slice(0, 3).map((friend) => (
                  <span key={friend.userId} aria-hidden>
                    {friend.avatarEmoji}
                  </span>
                ))}
                {friends.length === 1 ? friends[0].displayName : `${friends.length} friends`}
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

        <div className="mt-auto flex items-center gap-2 pt-3 text-[0.75rem] text-ink-400">
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
          {fresh ? <span>· Updated this week</span> : null}
        </div>
      </div>
    </article>
  );
}
