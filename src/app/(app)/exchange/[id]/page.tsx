import { ArrowLeft, Clock, MapPin, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ListingActions } from "@/components/app/exchange-actions";
import { Badge } from "@/components/ui/primitives";
import { exchangeKindMeta, exchangeKindSafety, listingCategoryMeta, marketplaceSafety } from "@/domain/social";
import { loadListing } from "@/server/queries/exchange";
import { minutesSince, requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { fmtWhen } from "@/lib/dates";
import { ago, cn, money } from "@/lib/utils";
import { env } from "@/services/env";

export const metadata: Metadata = {
  title: "Listing",
  robots: { index: false, follow: false },
};

export default async function ListingPage(props: PageProps<"/exchange/[id]">) {
  const viewer = await requireViewer();
  const { id } = await props.params;
  const now = requestDate();
  const data = await loadListing(id, viewer.user.id, now);
  if (!data) notFound();

  const { listing, kind, mode, seller, saved, mine, more } = data;
  const lane = exchangeKindMeta[kind];
  const request = mode === "request";
  const free = kind === "free" || (!lane.priced && listing.priceCents === 0);
  const closed = listing.status === "sold" || listing.status === "completed" || listing.status === "withdrawn";

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href="/exchange" className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        Exchange
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge accent={request ? "flow" : kind === "free" ? "mint" : kind === "help" ? "pulse" : kind === "ride" ? "amber" : "signal"} tone={request ? "solid" : "soft"}>
            {request ? `Looking for · ${lane.label}` : lane.label}
          </Badge>
          {listing.fromLeaving && !request ? <Badge accent="amber">Leaving soon</Badge> : null}
          {listing.status !== "active" ? <Badge accent="pulse" tone="outline">{listing.status === "reserved" ? "Reserved" : listing.status === "withdrawn" ? "Taken down" : request ? "Sorted" : "Sold"}</Badge> : null}
        </div>
        <h1 className="mt-3 text-display-xs text-ink-950 sm:text-display-sm">{listing.title}</h1>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {free ? (
            <span className="rounded-full bg-mint px-3 py-1 text-[0.875rem] font-semibold text-ink-950">Free</span>
          ) : listing.priceCents > 0 ? (
            <span className="tnum font-mono text-[1.5rem] font-semibold text-ink-950">
              {request ? "up to " : ""}
              {money(listing.priceCents / 100, viewer.currency)}
              {kind === "ride" ? <span className="text-[0.875rem] font-normal text-ink-500"> per seat</span> : null}
            </span>
          ) : (
            <span className="text-[0.9375rem] text-ink-500">{request ? "Open to offers" : "Agree in the chat"}</span>
          )}
          <span className="text-[0.875rem] text-ink-500">
            {listingCategoryMeta[listing.category].emoji} {listingCategoryMeta[listing.category].label}
            {kind === "sell" && !request ? ` · ${listing.condition}` : ""}
          </span>
        </p>
      </header>

      <section className="mt-5 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-800">{listing.detail}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
            <div>
              <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{kind === "ride" ? "Meeting point" : "Where to meet"}</dt>
              <dd className="mt-0.5 text-[0.9375rem] text-ink-900">{listing.meetArea}</dd>
            </div>
          </div>
          {listing.whenAt ? (
            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-ink-400" />
              <div>
                <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">When</dt>
                <dd className="mt-0.5 text-[0.9375rem] text-ink-900">{fmtWhen(listing.whenAt, viewer.city.timezone, now)}</dd>
              </div>
            </div>
          ) : null}
        </dl>
      </section>

      {/* ---- poster --------------------------------------------------------- */}
      <section className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-signal-soft text-2xl">{seller.avatarEmoji}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[0.9375rem] font-semibold text-ink-950">
            {seller.displayName}
            {seller.verified ? <ShieldCheck className="size-4 text-mint-deep" aria-label="Verified student" /> : null}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-[0.8125rem] text-ink-500">
            {seller.campusName ? <span>{seller.campusName}</span> : null}
            {seller.termsInCity !== null ? (
              <span>{seller.termsInCity} {seller.termsInCity === 1 ? "term" : "terms"} in {viewer.city.name}</span>
            ) : null}
            <span>{seller.completed} {seller.completed === 1 ? "exchange" : "exchanges"} done</span>
            {seller.accountDays < 7 ? <span className="text-amber-deep">New account</span> : null}
          </p>
        </div>
        <span className="shrink-0 text-[0.75rem] text-ink-400">{ago(minutesSince(listing.createdAt))}</span>
      </section>

      {/* ---- actions -------------------------------------------------------- */}
      <div className={cn("mt-5", closed && !mine && "opacity-60")}>
        <ListingActions
          listingId={listing.id}
          saved={saved}
          mine={mine}
          status={listing.status}
          shareUrl={`${env.siteUrl ?? brand.url}/exchange/${listing.id}`}
          requestMode={request}
        />
      </div>

      {/* ---- safety ---------------------------------------------------------- */}
      <section className="mt-6 rounded-xl border border-ink-200 bg-paper-2/60 p-5">
        <h2 className="text-[0.9375rem] font-semibold text-ink-950">Meeting safely</h2>
        <p className="mt-1.5 text-[0.875rem] leading-snug text-ink-700">{exchangeKindSafety[kind]}</p>
        <ul className="mt-2.5 space-y-1.5">
          {marketplaceSafety.map((line) => (
            <li key={line} className="flex gap-2.5 text-[0.8125rem] leading-snug text-ink-600">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-400" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {more.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 px-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">More from {seller.displayName}</h2>
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white ring-1 ring-ink-950/6">
            {more.map((row) => (
              <li key={row.id}>
                <Link href={`/exchange/${row.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper-2">
                  <span className="min-w-0 truncate text-[0.9375rem] text-ink-900">{row.title}</span>
                  <span className="tnum shrink-0 font-mono text-[0.875rem] text-ink-600">{row.priceCents === 0 ? "Free" : money(row.priceCents / 100, viewer.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
