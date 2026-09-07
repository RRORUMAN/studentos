import { CalendarDays, MapPin, MessagesSquare, Tag, UsersRound } from "lucide-react";
import Link from "next/link";

import { FeedbackMenu } from "@/components/app/feedback-menu";
import { Badge } from "@/components/ui/primitives";
import type { FeedItem } from "@/server/engines/feed";
import { fmtWhen } from "@/lib/dates";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * FEED CARD
 * ----------------------------------------------------------------------------
 * One row of the For You feed. Enough to decide in two seconds: what, where,
 * when, what it costs, why it is here, and who else. Nothing decorative.
 *
 * The "why" is printed from `reasons` and never generated. If a card reaches
 * this component with no reasons the engine has made a mistake, and the card
 * renders without a why line rather than inventing one.
 * ============================================================================
 */

const KIND_ICON = {
  event: CalendarDays,
  place: MapPin,
  deal: Tag,
  invite: UsersRound,
  post: MessagesSquare,
} as const;

const KIND_LABEL = {
  event: "Event",
  place: "Place",
  deal: "Deal",
  invite: "Anyone down?",
  post: "Students say",
} as const;

export function FeedCard({
  item,
  where,
  now,
  timeZone,
}: {
  item: FeedItem;
  where: { currency: string; locale: string };
  now: Date;
  /** The city's zone. Times are formatted on the server, so they never hydrate differently. */
  timeZone: string;
}) {
  const Icon = KIND_ICON[item.kind];
  const time = item.startsAt ? fmtWhen(item.startsAt, timeZone, now) : null;

  return (
    <article className="group relative flex gap-3.5 rounded-xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      <span
        aria-hidden
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          item.kind === "event" && "bg-pulse-soft text-pulse-deep",
          item.kind === "place" && "bg-mint-soft text-mint-deep",
          item.kind === "deal" && "bg-amber-soft text-amber-deep",
          item.kind === "invite" && "bg-signal-soft text-signal-deep",
          item.kind === "post" && "bg-flow-soft text-flow-deep",
        )}
      >
        <Icon className="size-4.5" strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[0.75rem]">
            <span className="font-mono uppercase tracking-[0.08em] text-ink-400">
              {KIND_LABEL[item.kind]}
            </span>
            {item.tag === "free" ? <Badge accent="mint" tone="solid">Free</Badge> : null}
            {item.tag === "friends" ? <Badge accent="pulse">Friends</Badge> : null}
            {item.tag === "tonight" ? <Badge accent="signal">Tonight</Badge> : null}
            {item.tag === "campus" ? <Badge accent="flow">Campus</Badge> : null}
            {item.tag === "deal" ? <Badge accent="amber">Deal</Badge> : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {item.priceCents !== null && item.priceCents > 0 ? (
              <span className="tnum font-mono text-[0.9375rem] font-semibold text-ink-900">
                {money(item.priceCents / 100, where)}
              </span>
            ) : null}
            {item.kind === "event" || item.kind === "place" ? (
              <FeedbackMenu
                targetKind={item.kind}
                targetId={item.id}
                compact
                className="relative z-10 -mr-1.5"
              />
            ) : null}
          </div>
        </div>

        <h3 className="mt-1 text-[1.0625rem] leading-snug font-semibold text-ink-950">
          <Link href={item.href} className="after:absolute after:inset-0 after:rounded-xl">
            {item.title}
          </Link>
        </h3>

        <p className="mt-0.5 truncate text-[0.875rem] text-ink-500">
          {time ? `${time} · ` : ""}
          {item.meta}
        </p>

        {item.reasons.length > 0 ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] text-ink-600">
            <span className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">Why</span>
            {item.reasons.slice(0, 3).map((reason, index) => (
              <span key={reason} className="flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden className="size-1 rounded-full bg-ink-300" /> : null}
                {reason}
              </span>
            ))}
          </p>
        ) : null}

        {item.social ? (
          <p className="mt-1.5 text-[0.8125rem] font-medium text-ink-700">{item.social}</p>
        ) : null}
      </div>
    </article>
  );
}

