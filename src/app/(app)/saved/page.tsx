import { Bookmark, CalendarDays, MapPin, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CollectionPicker, NewCollectionForm } from "@/components/app/collection-form";
import { SaveButton } from "@/components/app/save-button";
import { UpsellLine } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { placesForCity } from "@/data/places";
import type { Place } from "@/data/types";
import type { CityEvent, SavedItem } from "@/domain/types";
import { loadCityEvents, loadDeals } from "@/server/queries/discovery";
import { findMany } from "@/server/db";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { cn, money, walk } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Saved",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * SAVED
 * ----------------------------------------------------------------------------
 * Not a dumping ground. Smart collections sort themselves from the rows —
 * Cheap Eats, Want To Go, Free Stuff, Study, This Weekend — and named
 * collections sit alongside for Plus. The quota meter is visible before it is
 * hit, never after.
 * ============================================================================
 */

type Resolved =
  | { saved: SavedItem; kind: "place"; place: Place }
  | { saved: SavedItem; kind: "event"; event: CityEvent }
  | { saved: SavedItem; kind: "deal"; title: string; value: string }
  | { saved: SavedItem; kind: "plan"; title: string; stops: number };

export default async function SavedPage(props: PageProps<"/saved">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();
  const where = viewer.currency;
  const can = viewer.entitlements.can;

  const raw = Array.isArray(params.c) ? params.c[0] : params.c;

  const [saved, events, deals, collections, plans] = await Promise.all([
    findMany("saved", (row) => row.userId === viewer.user.id),
    loadCityEvents(viewer.profile.citySlug),
    loadDeals(viewer.profile.citySlug),
    findMany("collections", (row) => row.userId === viewer.user.id),
    findMany("plans", (row) => row.userId === viewer.user.id),
  ]);

  const places = placesForCity(viewer.profile.citySlug);
  const quota = viewer.entitlements.quotas.savedItems;

  const resolved: Resolved[] = saved
    .map((item): Resolved | null => {
      if (item.kind === "place") {
        const place = places.find((row) => row.id === item.targetId);
        return place ? { saved: item, kind: "place", place } : null;
      }
      if (item.kind === "event") {
        const event = events.find((row) => row.id === item.targetId);
        return event ? { saved: item, kind: "event", event } : null;
      }
      if (item.kind === "deal") {
        const deal = deals.find((row) => row.id === item.targetId);
        return deal ? { saved: item, kind: "deal", title: deal.title, value: deal.value } : null;
      }
      const plan = plans.find((row) => row.id === item.targetId);
      return plan ? { saved: item, kind: "plan", title: plan.title, stops: plan.items.length } : null;
    })
    .filter((entry): entry is Resolved => entry !== null)
    .sort((a, b) => b.saved.createdAt.localeCompare(a.saved.createdAt));

  /* ---- smart collections: computed, no rows ------------------------------- */
  const weekendEnd = (() => {
    const day = now.getDay();
    const daysToSunday = (7 - day) % 7;
    const end = new Date(now);
    end.setDate(end.getDate() + daysToSunday);
    end.setHours(23, 59, 59, 999);
    return end.getTime();
  })();

  const smart: { key: string; label: string; emoji: string; test: (entry: Resolved) => boolean }[] = [
    { key: "cheap-eats", label: "Cheap Eats", emoji: "🍜", test: (entry) => entry.kind === "place" && entry.place.layers.includes("cheap-food") },
    { key: "want-to-go", label: "Want To Go", emoji: "🎟️", test: (entry) => entry.kind === "event" && Date.parse(entry.event.startsAt) >= now.getTime() },
    { key: "free", label: "Free Stuff", emoji: "🎁", test: (entry) => (entry.kind === "place" && entry.place.price === 0) || (entry.kind === "event" && entry.event.priceCents === 0) },
    { key: "study", label: "Study", emoji: "📚", test: (entry) => entry.kind === "place" && entry.place.layers.includes("study") },
    { key: "weekend", label: "This Weekend", emoji: "🗓️", test: (entry) => entry.kind === "event" && Date.parse(entry.event.startsAt) >= now.getTime() && Date.parse(entry.event.startsAt) <= weekendEnd },
    { key: "deals", label: "Deals", emoji: "🏷️", test: (entry) => entry.kind === "deal" },
  ];

  const smartVisible = smart.filter((collection) => resolved.some(collection.test));
  const activeSmart = smart.find((collection) => collection.key === raw) ?? null;
  const activeNamed = collections.find((collection) => collection.id === raw) ?? null;

  const list = activeSmart
    ? resolved.filter(activeSmart.test)
    : activeNamed
      ? resolved.filter((entry) => entry.saved.collectionId === activeNamed.id)
      : resolved;

  return (
    <div className="page max-w-3xl py-6 sm:py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            {viewer.city.name}
            {quota.limit !== null ? ` · ${quota.used}/${quota.limit} saved` : ` · ${resolved.length} saved`}
          </p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">Saved</h1>
        </div>
        {can.customCollections ? <NewCollectionForm canCollaborate={can.collaborativeCollections} /> : null}
      </header>

      {/* ---- collections rail ---------------------------------------------- */}
      {resolved.length > 0 ? (
        <nav aria-label="Collections" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
          <Link href="/saved" aria-current={!raw ? "page" : undefined} className={cn("inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[0.875rem] font-medium", !raw ? "bg-ink-950 text-paper" : "bg-white text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20")}>
            All
          </Link>
          {(can.smartCollections ? smartVisible : smartVisible.slice(0, 2)).map((collection) => (
            <Link key={collection.key} href={`/saved?c=${collection.key}`} aria-current={raw === collection.key ? "page" : undefined} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.875rem] font-medium", raw === collection.key ? "bg-ink-950 text-paper" : "bg-white text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20")}>
              <span aria-hidden>{collection.emoji}</span>
              {collection.label}
              <span className="tnum text-[0.75rem] opacity-70">{resolved.filter(collection.test).length}</span>
            </Link>
          ))}
          {collections.map((collection) => (
            <Link key={collection.id} href={`/saved?c=${collection.id}`} aria-current={raw === collection.id ? "page" : undefined} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.875rem] font-medium", raw === collection.id ? "bg-ink-950 text-paper" : "bg-white text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20")}>
              <span aria-hidden>{collection.emoji}</span>
              {collection.name}
              {collection.collaborative ? <Badge accent="mint">Shared</Badge> : null}
            </Link>
          ))}
        </nav>
      ) : null}

      {!can.smartCollections && smartVisible.length > 2 ? (
        <UpsellLine feature="smartCollections" line={`${smartVisible.length - 2} more smart collections sort themselves from what you saved.`} className="mt-3" />
      ) : null}

      {/* ---- list ---------------------------------------------------------- */}
      {list.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl bg-white px-5 py-12 text-center ring-1 ring-ink-950/6">
          <MascotArt state="neutral" className="size-16" />
          <h2 className="mt-4 text-[1.0625rem] font-semibold text-ink-950">
            {resolved.length === 0 ? "Nothing saved yet." : "Nothing in this collection."}
          </h2>
          <p className="mt-1 max-w-sm text-[0.9375rem] text-ink-600">
            {resolved.length === 0 ? "Tap the bookmark on anything worth remembering. Cheap Eats, Free Stuff and Want To Go sort themselves." : "Save a few more things and this fills in."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/discover" className="rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper">Find something</Link>
            <Link href="/events?tab=free" className="rounded-full bg-white px-4 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/10">Free events</Link>
          </div>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {list.map((entry) => (
            <li key={entry.saved.id} className="flex flex-col rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
              <div className="flex items-start justify-between gap-3">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", entry.kind === "place" ? "bg-mint-soft text-mint-deep" : entry.kind === "event" ? "bg-pulse-soft text-pulse-deep" : entry.kind === "deal" ? "bg-amber-soft text-amber-deep" : "bg-flow-soft text-flow-deep")}>
                  {entry.kind === "place" ? <MapPin className="size-4" /> : entry.kind === "event" ? <CalendarDays className="size-4" /> : entry.kind === "deal" ? <Tag className="size-4" /> : <Bookmark className="size-4" />}
                </span>
                <SaveButton kind={entry.kind} targetId={entry.saved.targetId} saved />
              </div>

              {entry.kind === "place" ? (
                <>
                  <Link href={`/discover/${entry.place.id}`} className="mt-3 text-[1rem] font-semibold text-ink-950 hover:underline">{entry.place.name}</Link>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-500">{entry.place.category} · {walk(entry.place.walkMinutes)} walk</p>
                  <p className="mt-1.5 text-[0.875rem] font-medium text-ink-800">{entry.place.price === null ? entry.place.priceLabel : entry.place.price === 0 ? "Free" : money(entry.place.price, where)}</p>
                </>
              ) : entry.kind === "event" ? (
                <>
                  <Link href={`/events/${entry.event.id}`} className="mt-3 text-[1rem] font-semibold text-ink-950 hover:underline">{entry.event.title}</Link>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-500">
                    {new Date(entry.event.startsAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {entry.event.venue}
                  </p>
                  <p className="mt-1.5 text-[0.875rem] font-medium text-ink-800">{entry.event.priceCents === 0 ? "Free" : money(entry.event.priceCents / 100, where)}</p>
                </>
              ) : entry.kind === "deal" ? (
                <>
                  <Link href="/discover?tab=deals" className="mt-3 text-[1rem] font-semibold text-ink-950 hover:underline">{entry.title}</Link>
                  <p className="mt-1.5 text-[0.875rem] font-medium text-ink-800">{entry.value}</p>
                </>
              ) : (
                <>
                  <Link href={`/plans/${entry.saved.targetId}`} className="mt-3 text-[1rem] font-semibold text-ink-950 hover:underline">{entry.title}</Link>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-500">{entry.stops} stops</p>
                </>
              )}

              {collections.length > 0 ? (
                <div className="mt-3">
                  <CollectionPicker savedId={entry.saved.id} current={entry.saved.collectionId} collections={collections} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {quota.limit !== null && quota.nearing ? (
        <UpsellLine feature="customCollections" line={`${quota.remaining} of ${quota.limit} free saves left. Plus removes the cap and adds named collections.`} className="mt-5" />
      ) : null}
    </div>
  );
}
