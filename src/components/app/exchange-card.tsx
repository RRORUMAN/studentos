import { Clock, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/primitives";
import { exchangeKindMeta, listingCategoryMeta } from "@/domain/social";
import type { ListingView } from "@/server/queries/exchange";
import { cn, money } from "@/lib/utils";

/**
 * One listing in the grid. Prints only what is on the row: the lane, whether
 * it is an offer or a request, the price, the meeting area label, and the
 * poster's trust signals. Never an address, never a photo of a real flat.
 */
export function ExchangeCard({
  view,
  where,
  whenLabel,
  agoLabel,
}: {
  view: ListingView;
  where: { currency: string; locale: string };
  whenLabel: string | null;
  agoLabel: string;
}) {
  const { listing, kind, mode, seller } = view;
  const lane = exchangeKindMeta[kind];
  const request = mode === "request";
  const free = kind === "free" || (!lane.priced && listing.priceCents === 0);

  return (
    <li className={cn("relative flex flex-col rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 transition-shadow hover:shadow-[var(--shadow-raise)]", request ? "ring-flow-deep/15" : "ring-ink-950/6")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge accent={request ? "flow" : kind === "free" ? "mint" : kind === "help" ? "pulse" : kind === "ride" ? "amber" : "signal"} tone={request ? "solid" : "soft"}>
            {request ? "Looking for" : lane.label}
          </Badge>
          {listing.fromLeaving && !request ? <Badge accent="amber">Leaving soon</Badge> : null}
        </div>
        {free ? (
          <span className="rounded-full bg-mint px-2.5 py-0.5 text-[0.75rem] font-semibold text-ink-950">Free</span>
        ) : listing.priceCents > 0 ? (
          <span className="tnum font-mono text-[1.0625rem] font-semibold text-ink-950">
            {request ? "≤ " : ""}
            {money(listing.priceCents / 100, where)}
          </span>
        ) : null}
      </div>

      <h3 className="mt-2 text-[1rem] leading-snug font-semibold text-ink-950">
        <Link href={`/exchange/${listing.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
          {listing.title}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug text-ink-600">{listing.detail}</p>

      <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-500">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>{listingCategoryMeta[listing.category].emoji}</span>
          {listingCategoryMeta[listing.category].label}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{listing.meetArea}</span>
        </span>
        {whenLabel ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 shrink-0" />
            {whenLabel}
          </span>
        ) : null}
      </p>

      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.75rem] text-ink-500">
        <span aria-hidden>{seller.avatarEmoji}</span>
        <span className="font-medium text-ink-700">{seller.displayName}</span>
        {seller.verified ? <ShieldCheck className="size-3 text-mint-deep" aria-label="Verified student" /> : null}
        {seller.campusName ? <span>· {seller.campusName}</span> : null}
        {seller.completed > 0 ? <span>· {seller.completed} done</span> : null}
        <span>· {agoLabel}</span>
      </p>
    </li>
  );
}
