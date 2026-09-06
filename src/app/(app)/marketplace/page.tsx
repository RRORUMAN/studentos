import { MapPin, Plus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Empty } from "@/components/app/cards";
import { listingCategoryMeta, marketplaceSafety, type ListingCategory } from "@/domain/social";
import { findMany } from "@/server/db";
import { minutesSince } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { ago, cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Marketplace",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * MARKETPLACE
 * ----------------------------------------------------------------------------
 * Outgoing students sell what incoming students need.
 *
 * The strongest network effect in the product, and the one that makes Leaving
 * Mode pay for itself: a student with a flat full of furniture they cannot take
 * home and a student who has just landed with nothing are the two halves of one
 * transaction that no general classifieds site can introduce, because neither
 * knows the other exists.
 *
 * Listings from Leaving Mode are surfaced first for students in an arrival
 * stage — that is the loop, made explicit in the ordering.
 * ============================================================================
 */
export default async function MarketplacePage(props: PageProps<"/marketplace">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const raw = Array.isArray(params.category) ? params.category[0] : params.category;

  const [listings, profiles] = await Promise.all([
    findMany(
      "listings",
      (row) => row.citySlug === viewer.profile.citySlug && row.status === "active",
    ),
    findMany("profiles", () => true),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const categories = Object.keys(listingCategoryMeta) as ListingCategory[];
  const category = raw && categories.includes(raw as ListingCategory) ? (raw as ListingCategory) : null;

  const arriving =
    viewer.stage.stage === "before-arrival" ||
    viewer.stage.stage === "first-24h" ||
    viewer.stage.stage === "first-week";

  const visible = (category ? listings.filter((row) => row.category === category) : listings).sort(
    (a, b) =>
      /* Departing stock first for arriving students; newest first otherwise. */
      (arriving ? Number(b.fromLeaving) - Number(a.fromLeaving) : 0) ||
      b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="page py-6 sm:py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Marketplace</h1>
          <p className="mt-1.5 text-[0.9375rem] text-ink-500">
            {arriving
              ? `Students leaving ${viewer.city.name} are selling what you need.`
              : `Second-hand from students in ${viewer.city.name}.`}
          </p>
        </div>

        <Link
          href="/marketplace/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper hover:bg-ink-800"
        >
          <Plus className="size-4" />
          List something
        </Link>
      </header>

      <nav
        aria-label="Categories"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]"
      >
        <Link
          href="/marketplace"
          className={cn(
            "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[0.875rem] font-medium transition-colors",
            !category
              ? "border-ink-950 bg-ink-950 text-paper"
              : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
          )}
        >
          All
        </Link>
        {categories.map((entry) => (
          <Link
            key={entry}
            href={`/marketplace?category=${entry}`}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.875rem] font-medium transition-colors",
              category === entry
                ? "border-ink-950 bg-ink-950 text-paper"
                : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
            )}
          >
            <span aria-hidden>{listingCategoryMeta[entry].emoji}</span>
            {listingCategoryMeta[entry].label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {visible.length === 0 ? (
          <Empty
            line="Nothing listed in your city yet."
            action="Be the first"
            href="/marketplace/new"
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((listing) => {
              const seller = byUser.get(listing.sellerId);
              return (
                <li key={listing.id} className="rounded-lg border border-ink-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    {listing.priceCents === 0 ? (
                      <span className="rounded-full bg-mint px-2.5 py-0.5 text-[0.75rem] font-semibold text-ink-950">
                        Free
                      </span>
                    ) : (
                      <span className="tnum font-mono text-[1.0625rem] font-semibold text-ink-950">
                        {money(listing.priceCents / 100, viewer.currency)}
                      </span>
                    )}

                    {listing.fromLeaving ? (
                      <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-amber-deep">
                        Leaving soon
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-[1rem] font-semibold text-ink-950">{listing.title}</p>
                  <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug text-ink-600">
                    {listing.detail}
                  </p>

                  <p className="mt-2.5 flex items-center gap-1.5 text-[0.8125rem] text-ink-500">
                    <MapPin className="size-3.5 shrink-0" />
                    {listing.meetArea}
                  </p>

                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.75rem] text-ink-400">
                    <span aria-hidden>{seller?.avatarEmoji ?? "🙂"}</span>
                    {seller?.displayName ?? "A student"}
                    {seller?.studentVerifiedAt ? (
                      <ShieldCheck className="size-3 text-mint-deep" aria-label="Verified" />
                    ) : null}
                    · {listing.condition} ·{" "}
                    {ago(minutesSince(listing.createdAt))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Not dismissible. Meeting a stranger to hand over cash is the one part
          of this product with real-world risk in it. */}
      <section className="mt-8 rounded-xl border border-ink-200 bg-paper-2/60 p-5">
        <h2 className="mb-2.5 text-[0.9375rem] font-semibold text-ink-950">
          Buying and selling safely
        </h2>
        <ul className="space-y-1.5">
          {marketplaceSafety.map((line) => (
            <li key={line} className="flex gap-2.5 text-[0.875rem] leading-snug text-ink-600">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-400" />
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
