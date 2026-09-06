import { CalendarDays, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DiscoverFilters, type DiscoverTab } from "@/components/app/discover-filters";
import { RadarCard } from "@/components/app/event-card";
import { SmartPlaceCard } from "@/components/app/place-card";
import { Locked } from "@/components/app/locked";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { TripPicker } from "@/components/app/trip-picker";
import { CityMap } from "@/components/product/city-map";
import { Badge } from "@/components/ui/primitives";
import { cityDirectory, resolveCity } from "@/data/cities";
import type { PlaceLayer } from "@/data/types";
import { recordUpgradeTrigger } from "@/server/actions/upgrade";
import { isFlagOn } from "@/server/queries/settings";
import { confidenceMeta } from "@/domain/knowledge";
import {
  loadCommunitySignals,
  loadDeals,
  loadPlaces,
  loadRecommendContext,
  loadScoredEvents,
} from "@/server/queries/discovery";
import { loadEventEnergy } from "@/server/queries/events";
import { loadMoney } from "@/server/queries/money";
import { recordSearchMiss } from "@/server/actions/insight";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Discover",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * DISCOVER
 * ----------------------------------------------------------------------------
 * Map plus smart feed. On mobile the map is a compact panel above the list; on
 * desktop it sits alongside and stays put while the list scrolls.
 *
 * The tabs are the questions students actually ask — cheap, free, food, study,
 * events, deals — not the data model. Free gets the three core layers plus the
 * price caps; paid stacks the rest. A locked tab is visible and says so.
 *
 * A search that returns nothing is recorded as an unmet need, which is how the
 * product learns what a city is missing.
 * ============================================================================
 */

type Tab = {
  value: string;
  label: string;
  layer?: PlaceLayer;
  core: boolean;
  kind: "places" | "events" | "deals";
  cheapOnly?: boolean;
};

const TABS: readonly Tab[] = [
  { value: "for-you", label: "For you", layer: "for-you", core: true, kind: "places" },
  { value: "cheap", label: "Cheap", core: true, kind: "places", cheapOnly: true },
  { value: "free", label: "Free", layer: "free", core: true, kind: "places" },
  { value: "food", label: "Food", layer: "cheap-food", core: true, kind: "places" },
  { value: "groceries", label: "Groceries", layer: "groceries", core: false, kind: "places" },
  { value: "events", label: "Events", core: true, kind: "events" },
  { value: "deals", label: "Deals", core: true, kind: "deals" },
  { value: "study", label: "Study", layer: "study", core: false, kind: "places" },
  { value: "nightlife", label: "Nightlife", layer: "nightlife", core: false, kind: "places" },
  { value: "fitness", label: "Fitness", layer: "fitness", core: false, kind: "places" },
];

export default async function DiscoverPage(props: PageProps<"/discover">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();
  const where = viewer.currency;
  const can = viewer.entitlements.can;

  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  /* Legacy links: ?filter=under-10, ?layer=study. */
  const legacyLayer = one("layer");
  const legacyFilter = one("filter");
  const requested =
    one("tab") ??
    (legacyLayer ? TABS.find((tab) => tab.layer === legacyLayer)?.value : undefined) ??
    (legacyFilter === "free" ? "free" : legacyFilter?.startsWith("under") ? "cheap" : undefined) ??
    "for-you";

  const tabMeta = TABS.find((tab) => tab.value === requested) ?? TABS[0];
  /* A tab a free user is not entitled to falls back to For you rather than
     refusing; the chip they tapped still shows as locked. */
  const tab = tabMeta.core || can.allMapLayers ? tabMeta : TABS[0];

  /* ---- trip mode --------------------------------------------------------
     `?city=` opens another city read-only. Pro (tripPlanner); a free student
     asking for it is shown their own city and the value-first upsell below. */
  const tripSlug = one("city") && one("city") !== viewer.profile.citySlug ? one("city")! : null;
  const tripsOn = await isFlagOn("trips");
  const tripCity = tripSlug && tripsOn ? resolveCity(tripSlug) : null;
  const trip = tripCity && can.tripPlanner ? tripCity : null;
  if (tripCity && !can.tripPlanner) await recordUpgradeTrigger("another-city");
  const citySlug = trip?.slug ?? viewer.profile.citySlug;
  const cityName = trip?.name ?? viewer.city.name;
  const scopedProfile = trip ? { ...viewer.profile, citySlug: trip.slug, campusSlug: null, homePoint: null } : viewer.profile;

  const cap = one("max") ?? (legacyFilter === "under-10" ? "10" : legacyFilter === "under-5" ? "5" : null);
  const capCents = cap && /^\d+$/.test(cap) ? Number(cap) * 100 : tab.cheapOnly ? 1000 : null;
  const verified = one("verified") === "1" && can.combinedFilters;
  const query = one("q") ?? "";

  const money$ = await loadMoney(viewer.user.id, now);
  const context = await loadRecommendContext({
    userId: viewer.user.id,
    profile: scopedProfile,
    budgetCents: money$.unset ? null : money$.reading.safeTodayCents,
    now,
  });

  const [places, events, deals, signals] = await Promise.all([
    tab.kind === "places"
      ? loadPlaces(context, {
          layers: tab.layer && tab.layer !== "for-you" ? [tab.layer] : undefined,
          freeOnly: tab.value === "free",
          maxPriceCents: capCents,
          verifiedOnly: verified,
          query: query || undefined,
        })
      : Promise.resolve([]),
    tab.kind === "events"
      ? loadScoredEvents(viewer.user.id, context, {
          when: "week",
          maxPriceCents: capCents,
          freeOnly: cap === "free",
        })
      : Promise.resolve([]),
    tab.kind === "deals" ? loadDeals(citySlug) : Promise.resolve([]),
    loadCommunitySignals(viewer.user.id, viewer.profile.campusSlug),
  ]);

  const energy =
    tab.kind === "events"
      ? await loadEventEnergy({
          viewerId: viewer.user.id,
          campusSlug: viewer.profile.campusSlug,
          eventIds: events.map((entry) => entry.item.id),
        })
      : new Map();

  const total = tab.kind === "places" ? places.length : tab.kind === "events" ? events.length : deals.length;
  if (total === 0 && query) {
    await recordSearchMiss({ query, surface: "explore", resultCount: 0 });
  }

  const tabs: DiscoverTab[] = TABS.map((entry) => ({
    value: entry.value,
    label: entry.label,
    locked: !entry.core && !can.allMapLayers,
  }));

  return (
    <div className="page py-6 sm:py-8">
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            {cityName}
            {trip ? " · trip" : viewer.profile.homeArea ? ` · from ${viewer.profile.homeArea}` : ""}
          </p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">
            {trip ? `Discover ${trip.name}` : "Discover"}
          </h1>
        </div>
        <Link
          href="/events"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20"
        >
          <CalendarDays className="size-4" />
          Event radar
        </Link>
      </header>

      <DiscoverFilters
        tabs={tabs}
        activeTab={tab.value}
        activeCap={cap}
        query={query}
        caps={[
          { value: "free", label: "Free" },
          { value: "5", label: `Under ${money(5, where)}` },
          { value: "10", label: `Under ${money(10, where)}` },
        ]}
        verifiedLocked={!can.combinedFilters}
        verifiedActive={verified}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.05fr] lg:items-start">
        {/* ---- map ---------------------------------------------------------- */}
        <div className="lg:sticky lg:top-24">
          <TripPicker
            cities={cityDirectory.map((entry) => ({ slug: entry.slug, name: entry.name, country: entry.country, status: entry.status, deep: entry.deep }))}
            homeSlug={viewer.profile.citySlug}
            currentSlug={citySlug}
            unlocked={can.tripPlanner}
          />
          {trip && !trip.deep ? (
            <p className="mb-3 rounded-xl bg-amber-soft/70 px-4 py-3 text-[0.8125rem] leading-snug text-amber-deep">
              {trip.name} has no local places or events yet. The map is the city outline only; nothing below is invented.
            </p>
          ) : null}
          <CityMap citySlug={citySlug} />
          <p className="mt-2 text-[0.8125rem] text-ink-400">
            Our own rows on a stylised map — no third-party tiles, so nothing about where you look
            is sent anywhere.
          </p>
        </div>

        {/* ---- results ------------------------------------------------------ */}
        <div>
          <p className="mb-3 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            {total} {tab.kind === "events" ? (total === 1 ? "event" : "events") : tab.kind === "deals" ? (total === 1 ? "deal" : "deals") : total === 1 ? "place" : "places"}
            {tab.cheapOnly && !cap ? ` under ${money(10, where)}` : ""}
          </p>

          {total === 0 ? (
            <div className="flex flex-col items-center rounded-2xl bg-white px-5 py-10 text-center ring-1 ring-ink-950/6">
              <MascotArt state="empty" className="size-16" />
              <p className="mt-4 text-[0.9375rem] text-ink-700">
                {query ? `Nothing matches "${query}" in ${cityName} yet. Noted.` : trip && !trip.deep ? `No local rows for ${trip.name} yet.` : "Nothing good in this filter yet."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/discover" className="rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper">
                  Show everything nearby
                </Link>
                {capCents ? (
                  <Link
                    href={`/discover?tab=${tab.value}`}
                    className="rounded-full border border-ink-200 bg-white px-4 py-2 text-[0.875rem] font-medium text-ink-700"
                  >
                    Remove the price cap
                  </Link>
                ) : null}
              </div>
            </div>
          ) : tab.kind === "places" ? (
            <ul className="space-y-3">
              {places.slice(0, 40).map((scored) => (
                <li key={scored.item.id}>
                  <SmartPlaceCard
                    scored={scored}
                    where={where}
                    campusSaved={signals.savedByCampus.has(scored.item.id)}
                    friendsSaved={signals.savedByFriends.has(scored.item.id)}
                  />
                </li>
              ))}
            </ul>
          ) : tab.kind === "events" ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {events.map((entry) => (
                <li key={entry.item.id}>
                  <RadarCard
                    scored={entry}
                    energy={energy.get(entry.item.id)}
                    where={where}
                    now={now}
                    campusName={viewer.campusName}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-3">
              {deals.map((deal) => {
                const meta = confidenceMeta[deal.confidence];
                return (
                  <li
                    key={deal.id}
                    className="rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-full bg-amber-soft">
                          <Tag className="size-4 text-amber-deep" />
                        </span>
                        <Badge accent={meta.accent}>{meta.label}</Badge>
                        {deal.requiresStudentId ? (
                          <span className="text-[0.75rem] text-ink-500">Student card needed</span>
                        ) : null}
                      </div>
                      <span className="tnum shrink-0 font-mono text-[1rem] font-semibold text-ink-950">
                        {deal.value}
                      </span>
                    </div>
                    <h3 className="mt-2 text-[1.0625rem] leading-snug font-semibold text-ink-950">{deal.title}</h3>
                    <p className="mt-1 text-[0.875rem] leading-snug text-ink-600">{deal.detail}</p>
                    <p className="mt-2 text-[0.8125rem] text-ink-500">
                      {meta.note}
                      {deal.workedCount > 0 ? ` ${deal.workedCount} students said it worked.` : ""}
                      {deal.lastConfirmedAt
                        ? ` Last confirmed ${new Date(deal.lastConfirmedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          {!can.allMapLayers ? (
            <div className="mt-5">
              <Locked feature="allMapLayers" compact />
            </div>
          ) : null}
          {tripCity && !can.tripPlanner ? (
            <div className="mt-5">
              <Upsell feature="tripPlanner" line={`Open ${tripCity.name} as a trip — places, budget and what is on — without moving home. Pro.`} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
