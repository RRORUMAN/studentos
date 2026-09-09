import { CalendarDays, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";

import { DiscoverFilters, type DiscoverTab } from "@/components/app/discover-filters";
import { DiscoverLayout } from "@/components/app/discover-layout";
import type { MapPlace } from "@/components/app/discover-map";
import { DiscoverRightNow } from "@/components/app/discover-right-now";
import { RadarCard } from "@/components/app/event-card";
import { SmartPlaceCard } from "@/components/app/place-card";
import { Locked } from "@/components/app/locked";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { TripPicker } from "@/components/app/trip-picker";
import { Badge } from "@/components/ui/primitives";
import { placeLayers } from "@/config/places";
import { cityDirectory, resolveCity } from "@/data/cities";
import type { Place, PlaceLayer } from "@/data/types";
import { describeProximity } from "@/domain/places";
import type { CityEvent } from "@/domain/types";
import { recordUpgradeTrigger } from "@/server/actions/upgrade";
import { isFlagOn } from "@/server/queries/settings";
import { confidenceMeta } from "@/domain/knowledge";
import {
  dealsByPlace,
  loadCityEvents,
  loadCommunitySignals,
  loadDeals,
  loadPlaces,
  loadRecommendContext,
  loadSavedKeys,
  loadScoredEvents,
  savedKey,
  type DealWithConfidence,
} from "@/server/queries/discovery";
import { loadEventEnergy, UNDER_TEN_CENTS } from "@/server/queries/events";
import { loadTrending } from "@/server/queries/loop";
import { loadMoney } from "@/server/queries/money";
import { loadOpenInvites } from "@/server/queries/plans";
import { rightNow } from "@/server/engines/right-now";
import type { Scored } from "@/server/engines/recommend";
import { recordSearchMiss } from "@/server/actions/insight";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtDay } from "@/lib/dates";
import { money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Discover",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * DISCOVER
 * ----------------------------------------------------------------------------
 * Map plus smart feed. On mobile the map is on top with a draggable sheet over
 * it; on desktop the map sits alongside and stays put while the list scrolls.
 *
 * The categories are the questions students actually ask — free, under ten,
 * food, study, what is on right now — not the data model. A category is only
 * listed when rows in *this* city can answer it, so a student never taps into a
 * promise the data cannot keep.
 *
 * Every visible control applies to the current category. A refinement a
 * category cannot honour is not rendered: deals carry no price, so the price
 * caps are absent there rather than present and inert.
 *
 * Nothing is written during render. A search that returns nothing is recorded
 * as an unmet need, and an upsell impression is counted, in `after()` — after
 * the response is done.
 * ============================================================================
 */

type TabKind = "places" | "events" | "deals" | "mixed" | "right-now";

type Tab = {
  value: string;
  label: string;
  core: boolean;
  kind: TabKind;
  /** Which places belong to this category. Omitted when it has none. */
  place?: (place: Place) => boolean;
  /** Which events belong to this category. Omitted when it has none. */
  event?: (event: CityEvent) => boolean;
};

const hasLayer = (layer: PlaceLayer) => (place: Place) => place.layers.includes(layer);
const hasTag = (...tags: string[]) => (event: CityEvent) =>
  tags.includes(event.kind) || event.tags.some((tag) => tags.includes(tag));

const TABS: readonly Tab[] = [
  { value: "for-you", label: "For you", core: true, kind: "places", place: () => true },
  { value: "right-now", label: "Right now", core: true, kind: "right-now" },
  {
    value: "free",
    label: "Free",
    core: true,
    kind: "mixed",
    /* "Free" is a claim about a ticket price, so for a place it means free to
       walk into — a park, a public library — and not "cheap". The layer
       decides, from the category, rather than a euro figure nobody published. */
    place: hasLayer("free"),
    event: (event) => event.priceCents === 0,
  },
  {
    value: "under-10",
    label: "Under 10",
    core: true,
    /* EVENTS ONLY, and this is the honest half of a tab that used to include
       places. An event publishes a price and can be compared to ten euro. A
       place publishes a BAND, and pretending a band is an amount is how a
       €30 dinner ends up filed under "Under 10". Cheap places have their own
       tab, which claims exactly what the provider said. */
    kind: "events",
    event: (event) => event.priceCents <= UNDER_TEN_CENTS,
  },
  {
    value: "cheap",
    label: "Cheap",
    core: true,
    kind: "places",
    /* The provider's own cheapest band. Not a promise about a euro figure. */
    place: (place) => place.priceLevel !== null && place.priceLevel <= 1,
  },
  { value: "food", label: "Food", core: true, kind: "places", place: hasLayer("cheap-food") },
  { value: "groceries", label: "Groceries", core: false, kind: "places", place: hasLayer("groceries") },
  { value: "events", label: "Events", core: true, kind: "events", event: () => true },
  { value: "deals", label: "Deals", core: true, kind: "deals" },
  {
    value: "nightlife",
    label: "Nightlife",
    core: false,
    kind: "mixed",
    place: hasLayer("nightlife"),
    event: hasTag("nightlife", "music", "clubbing"),
  },
  { value: "study", label: "Study", core: false, kind: "places", place: hasLayer("study") },
  {
    value: "fitness",
    label: "Fitness",
    core: false,
    kind: "mixed",
    place: hasLayer("fitness"),
    event: hasTag("sports", "running", "fitness", "football", "cycling"),
  },
  {
    value: "culture",
    label: "Culture",
    core: false,
    kind: "mixed",
    place: hasLayer("culture"),
    event: hasTag("culture", "art", "museums", "cinema"),
  },
  {
    value: "nature",
    label: "Nature",
    core: false,
    kind: "mixed",
    /* Category rather than a regular expression over a hand-written sentence.
       The old test read `place.why`, which was prose somebody typed; a park is
       a park because the provider tagged it as one. */
    place: (place) => place.categoryKey === "park" || place.categoryKey === "pool",
    event: hasTag("outdoor", "nature", "cycling", "running"),
  },
];

/**
 * Price caps, which apply to EVENTS and DEALS only.
 *
 * A place has no amount to cap. The control is hidden on place-only tabs
 * rather than rendered and quietly ignored — a filter that does nothing is
 * worse than a missing one, because the student believes it worked.
 */
const CAPS = [
  { value: "free", cents: 0 },
  { value: "5", cents: 500 },
  { value: "10", cents: 1000 },
] as const;

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

  /* Legacy links: ?filter=under-10, ?layer=study, ?tab=cheap. */
  const legacyLayer = one("layer");
  const legacyFilter = one("filter");
  const requestedRaw =
    one("tab") ??
    (legacyLayer ? TABS.find((tab) => tab.value === legacyLayer || tab.value === legacyLayer.replace("cheap-", ""))?.value : undefined) ??
    (legacyFilter === "free" ? "free" : legacyFilter?.startsWith("under") ? "under-10" : undefined) ??
    "for-you";
  const requested = requestedRaw === "cheap" ? "under-10" : requestedRaw;

  const tabMeta = TABS.find((tab) => tab.value === requested) ?? TABS[0];
  /* A category a free user is not entitled to falls back to For you rather
     than refusing; the chip they tapped still shows as locked. */
  const tab = tabMeta.core || can.allMapLayers ? tabMeta : TABS[0];

  /* ---- trip mode --------------------------------------------------------
     `?city=` opens another city read-only. Pro (tripPlanner); a free student
     asking for it is shown their own city and the value-first upsell below.
     With the flag off there is no trip mode at all and no picker. */
  const tripsOn = await isFlagOn("trips");
  const tripSlug = tripsOn && one("city") && one("city") !== viewer.profile.citySlug ? one("city")! : null;
  const tripCity = tripSlug ? resolveCity(tripSlug) : null;
  const trip = tripCity && can.tripPlanner ? tripCity : null;
  if (tripCity && !can.tripPlanner) after(() => recordUpgradeTrigger("another-city"));

  const citySlug = trip?.slug ?? viewer.profile.citySlug;
  const cityName = trip?.name ?? viewer.city.name;
  const timeZone = trip?.timezone ?? viewer.city.timezone;
  /* The map's origin. Every city in the directory has one — `config/regions.ts`
     refuses to build a city without a coordinate — so the fallbacks below are
     for a stored city slug that has since been removed, not for a normal one. */
  const centre = {
    lat: trip?.lat ?? viewer.city.lat ?? 0,
    lng: trip?.lng ?? viewer.city.lng ?? 0,
  };
  const scopedProfile = trip
    ? { ...viewer.profile, citySlug: trip.slug, campusSlug: null, homePoint: null }
    : viewer.profile;

  const capValue = CAPS.some((cap) => cap.value === one("max")) ? one("max")! : null;
  const capCents = capValue === null ? null : CAPS.find((cap) => cap.value === capValue)!.cents;
  const verified = one("verified") === "1" && can.combinedFilters;
  const query = (one("q") ?? "").trim();
  const needle = query.toLowerCase();

  const money$ = await loadMoney(viewer.user.id, now);
  const context = await loadRecommendContext({
    userId: viewer.user.id,
    profile: scopedProfile,
    budgetCents: money$.unset ? null : money$.reading.safeTodayCents,
    now,
  });

  const [placeResults, allEvents, deals, signals, savedKeys] = await Promise.all([
    loadPlaces(context),
    loadScoredEvents(viewer.user.id, context, { when: "week" }),
    loadDeals(citySlug),
    loadCommunitySignals(viewer.user.id, viewer.profile.campusSlug),
    loadSavedKeys(viewer.user.id),
  ]);

  const allPlaces = placeResults.places;
  const dealFor = dealsByPlace(deals);

  /* ---- the current view -------------------------------------------------- */
  const placeMatches = (scored: Scored<Place>) => {
    const place = scored.item;
    if (!tab.place?.(place)) return false;
    /* The euro caps do not apply to places, because places have no euro price.
       "Free" is the one that has a meaning here, and it means the free layer:
       somewhere you can walk into without paying. */
    if (capValue === "free" && !place.layers.includes("free")) return false;
    if (verified && place.confirmations < 10) return false;
    if (
      needle &&
      !`${place.name} ${place.category} ${place.brand ?? ""} ${place.address ?? ""}`
        .toLowerCase()
        .includes(needle)
    ) {
      return false;
    }
    return true;
  };

  const eventMatches = (scored: Scored<CityEvent>) => {
    const event = scored.item;
    if (!tab.event?.(event)) return false;
    if (capCents !== null && event.priceCents > capCents) return false;
    if (verified && event.confirmations < 10) return false;
    if (needle && !`${event.title} ${event.venue} ${event.blurb} ${event.kind} ${event.tags.join(" ")}`.toLowerCase().includes(needle)) {
      return false;
    }
    return true;
  };

  const dealMatches = (deal: DealWithConfidence) =>
    !needle || `${deal.title} ${deal.detail} ${deal.value} ${deal.category}`.toLowerCase().includes(needle);

  const places = tab.place ? allPlaces.filter(placeMatches) : [];
  const events = tab.event ? allEvents.filter(eventMatches) : [];
  const shownDeals = tab.kind === "deals" ? deals.filter(dealMatches) : [];

  /* ---- right now --------------------------------------------------------- */
  const live =
    tab.kind === "right-now"
      ? rightNow({
          now,
          events: await loadCityEvents(citySlug),
          invites: await loadOpenInvites({ userId: viewer.user.id, citySlug, now }),
          posts: await loadTrending(citySlug, 8),
          limit: 12,
        })
      : [];

  const energy =
    events.length > 0
      ? await loadEventEnergy({
          viewerId: viewer.user.id,
          campusSlug: viewer.profile.campusSlug,
          eventIds: events.map((entry) => entry.item.id),
          now,
        })
      : new Map();

  const total =
    tab.kind === "deals" ? shownDeals.length : tab.kind === "right-now" ? live.length : places.length + events.length;

  if (total === 0 && query) {
    after(() => recordSearchMiss({ query, surface: "explore", resultCount: 0 }));
  }

  /* ---- which categories this city can actually answer --------------------- */
  const tabs: DiscoverTab[] = TABS.filter((entry) => {
    if (entry.value === tab.value) return true;
    if (entry.kind === "deals") return deals.length > 0;
    if (entry.kind === "right-now") return true;
    const anyPlace = entry.place ? allPlaces.some((scored) => entry.place!(scored.item)) : false;
    const anyEvent = entry.event ? allEvents.some((scored) => entry.event!(scored.item)) : false;
    return anyPlace || anyEvent;
  }).map((entry) => ({
    value: entry.value,
    label: entry.value === "under-10" ? `Under ${money(10, where)}` : entry.label,
    locked: !entry.core && !can.allMapLayers,
  }));

  const mapPlaces: MapPlace[] = places.map((scored) => {
    const place = scored.item;
    const primary = place.layers[0];
    const deal = dealFor.get(place.id) ?? null;
    return {
      id: place.id,
      name: place.name,
      category: place.category,
      lat: place.lat,
      lng: place.lng,
      priceLevel: place.priceLevel,
      proximityLabel: describeProximity(place.proximity),
      valueBand: place.value.band,
      valueReasons: place.value.reasons,
      confirmations: place.confirmations,
      match: scored.match,
      accent: placeLayers.find((layer) => layer.key === primary)?.accent ?? "signal",
      community: signals.savedByFriends.has(place.id)
        ? "friends"
        : signals.savedByCampus.has(place.id)
          ? "campus"
          : null,
      deal: deal ? deal.value : null,
      reasons: scored.reasons,
    };
  });

  const countLabel =
    tab.kind === "deals"
      ? `${total} ${total === 1 ? "deal" : "deals"}`
      : tab.kind === "right-now"
        ? `${total} ${total === 1 ? "thing" : "things"} in the next few hours`
        : [
            places.length > 0 ? `${places.length} ${places.length === 1 ? "place" : "places"}` : null,
            events.length > 0 ? `${events.length} ${events.length === 1 ? "event" : "events"}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Nothing here";

  const filters = (
    <DiscoverFilters
      tabs={tabs}
      activeTab={tab.value}
      activeCap={capValue}
      query={query}
      caps={[
        { value: "free", label: "Free" },
        { value: "5", label: `Under ${money(5, where)}` },
        { value: "10", label: `Under ${money(10, where)}` },
      ]}
      showCaps={tab.kind !== "deals" && tab.kind !== "right-now"}
      showVerified={tab.kind !== "deals" && tab.kind !== "right-now"}
      verifiedLocked={!can.combinedFilters}
      verifiedActive={verified}
      placeholder={tab.kind === "deals" ? "student discount, gym, transport" : "cheap pizza, quiet café, student gym"}
    />
  );

  const results = (
    <div>
      <p className="mb-3 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{countLabel}</p>

      {total === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-white px-5 py-10 text-center ring-1 ring-ink-950/6">
          <MascotArt state="empty" className="size-16" />
          <p className="mt-4 text-[0.9375rem] text-ink-700">
            {query
              ? `Nothing matches “${query}” in ${cityName} yet. Noted.`
              : trip && !trip.deep
                ? `No local rows for ${trip.name} yet.`
                : tab.kind === "right-now"
                  ? "Nothing is under way or starting in the next few hours."
                  : "Nothing in this category yet."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/discover" className="rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper">
              Show everything nearby
            </Link>
            {capValue || verified || query ? (
              <Link
                href={`/discover?tab=${tab.value}`}
                className="rounded-full border border-ink-200 bg-white px-4 py-2 text-[0.875rem] font-medium text-ink-700"
              >
                Clear the filters
              </Link>
            ) : null}
          </div>
        </div>
      ) : tab.kind === "right-now" ? (
        <DiscoverRightNow items={live} where={where} />
      ) : tab.kind === "deals" ? (
        <ul className="space-y-3">
          {shownDeals.map((deal) => {
            const meta = confidenceMeta[deal.confidence];
            return (
              <li key={deal.id} className="rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
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
                  <span className="tnum shrink-0 font-mono text-[1rem] font-semibold text-ink-950">{deal.value}</span>
                </div>
                <h3 className="mt-2 text-[1.0625rem] leading-snug font-semibold text-ink-950">{deal.title}</h3>
                <p className="mt-1 text-[0.875rem] leading-snug text-ink-600">{deal.detail}</p>
                <p className="mt-2 text-[0.8125rem] text-ink-500">
                  {meta.note}
                  {deal.workedCount > 0 ? ` ${deal.workedCount} students said it worked.` : ""}
                  {deal.lastConfirmedAt ? ` Last confirmed ${fmtDay(deal.lastConfirmedAt, timeZone, now)}.` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-6">
          {places.length > 0 ? (
            <ul className="space-y-3">
              {places.slice(0, 40).map((scored) => (
                <li key={scored.item.id}>
                  <SmartPlaceCard
                    scored={scored}
                    now={now}
                    timezone={timeZone}
                    campusSaved={signals.savedByCampus.has(scored.item.id)}
                    friendsSaved={signals.savedByFriends.has(scored.item.id)}
                    saved={savedKeys.has(savedKey("place", scored.item.id))}
                    deal={dealFor.get(scored.item.id) ?? null}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {events.length > 0 ? (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[1.0625rem] font-semibold text-ink-950">
                <CalendarDays className="size-4 text-ink-400" />
                What is on
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {events.slice(0, 24).map((entry) => (
                  <li key={entry.item.id}>
                    <RadarCard
                      scored={entry}
                      energy={energy.get(entry.item.id)}
                      where={where}
                      now={now}
                      timeZone={timeZone}
                      campusName={viewer.campusName}
                      saved={savedKeys.has(savedKey("event", entry.item.id))}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      {!can.allMapLayers ? (
        <div className="mt-5">
          <Locked feature="allMapLayers" compact />
        </div>
      ) : null}
      {tripCity && !can.tripPlanner ? (
        <div className="mt-5">
          <Upsell
            feature="tripPlanner"
            line={`Open ${tripCity.name} as a trip — places, budget and what is on — without moving home. Pro.`}
          />
        </div>
      ) : null}
    </div>
  );

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

      <DiscoverLayout
        places={mapPlaces}
        centre={centre}
        attribution={placeResults.attribution}
        eventCount={events.length}
        filters={filters}
        aside={
          <>
            {tripsOn ? (
              <TripPicker
                cities={cityDirectory.map((entry) => ({
                  slug: entry.slug,
                  name: entry.name,
                  country: entry.country,
                  status: entry.status,
                  deep: entry.deep,
                }))}
                homeSlug={viewer.profile.citySlug}
                currentSlug={citySlug}
                unlocked={can.tripPlanner}
              />
            ) : null}
            {trip && !trip.deep ? (
              <p className="mb-3 rounded-xl bg-amber-soft/70 px-4 py-3 text-[0.8125rem] leading-snug text-amber-deep">
                {trip.name} has no local places or events yet. The map is the city outline only; nothing below is invented.
              </p>
            ) : null}
          </>
        }
      >
        {results}
      </DiscoverLayout>
    </div>
  );
}
