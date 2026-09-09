import { ArrowLeft, ArrowRight, CalendarDays, GraduationCap, MapPin, MessagesSquare, Tag, Utensils } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CitySwitcher } from "@/components/app/city-switcher";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { cityDirectory, cityStatusLabel, cityStatusNote } from "@/data/cities";
import { describeProximity, priceLevelLabel } from "@/domain/places";
import { loadPlacesByIds } from "@/server/queries/places";
import { recordUpgradeTrigger } from "@/server/actions/upgrade";
import { findMany } from "@/server/db";
import { loadCityEvents, loadDeals } from "@/server/queries/discovery";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "My city",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * MY CITY
 * ----------------------------------------------------------------------------
 * The student's own map of the city, filling in as they use the product: their
 * neighbourhood and campus, the places they saved, the events they are going
 * to, the deals in their categories, the groups they are in. Plus the honest
 * status of the city itself and the way to move.
 *
 * Nothing here is a score without data. A coming-soon city says exactly what
 * is and is not there.
 * ============================================================================
 */
export default async function MyCityPage() {
  const viewer = await requireViewer();
  const now = requestDate();

  const city = viewer.city;

  const [saved, responses, groups, events, deals, envelopes] = await Promise.all([
    findMany("saved", (row) => row.userId === viewer.user.id),
    findMany("eventResponses", (row) => row.userId === viewer.user.id),
    findMany("inviteResponses", (row) => row.userId === viewer.user.id && row.status === "in"),
    loadCityEvents(city.slug),
    loadDeals(city.slug),
    findMany("envelopes", (row) => row.userId === viewer.user.id),
  ]);

  /* Saved places are provider ids, resolved again here rather than read from
     a copy we would otherwise have to keep in step with the world. */
  const { places } = await loadPlacesByIds(
    saved.filter((row) => row.kind === "place").map((row) => row.targetId),
    city.slug,
  );
  const savedPlaces = saved
    .filter((row) => row.kind === "place")
    .map((row) => places.get(row.targetId))
    .filter((place): place is NonNullable<typeof place> => Boolean(place));
  const cheap = savedPlaces.filter((place) => place.layers.includes("cheap-food") || place.layers.includes("groceries"));
  const study = savedPlaces.filter((place) => place.layers.includes("study"));
  const myEvents = responses.map((row) => events.find((event) => event.id === row.eventId)).filter((event): event is NonNullable<typeof event> => Boolean(event) && Date.parse(event!.startsAt) >= now.getTime());
  const spending = new Set(envelopes.map((row) => row.category));
  const myDeals = deals.filter((deal) => spending.has(deal.category) && deal.confidence !== "expired").slice(0, 4);

  if (!viewer.entitlements.can.tripPlanner) await recordUpgradeTrigger("another-city");

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href="/you" className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        You
      </Link>

      <header className="flex items-start gap-4">
        <MascotArt state="explorer" accessory="map-pin" className="size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge accent={city.status === "coming-soon" ? "amber" : "mint"}>{cityStatusLabel[city.status]}</Badge>
            <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{city.country} · {city.currency.code} · {city.timezone.split("/").pop()?.replace(/_/g, " ")}</span>
          </div>
          <h1 className="mt-2 text-display-xs text-ink-950 sm:text-display-sm">{city.name}</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">{cityStatusNote[city.status]}</p>
          <p className="mt-1 text-[0.8125rem] text-ink-500">Languages: {city.languages.join(", ")}</p>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        <CitySwitcher cities={cityDirectory} currentSlug={city.slug} statusLabel={cityStatusLabel} />
        <Link href="/you/profile" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20">
          <MapPin className="size-4" />
          {viewer.profile.homeArea ? `Neighbourhood: ${viewer.profile.homeArea}` : "Set your neighbourhood"}
        </Link>
        <Link href="/you/profile" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20">
          <GraduationCap className="size-4" />
          {viewer.campusName ?? "Set your university"}
        </Link>
      </div>

      {/* ---- the personal map -------------------------------------------- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Block title="My cheap places" icon={<Utensils className="size-4" />} href="/discover?tab=food" empty="Save a lunch spot or a supermarket and it lands here.">
          {cheap.slice(0, 4).map((place) => (
            <Row key={place.id} href={`/discover/${encodeURIComponent(place.id)}`} title={place.name} meta={`${priceLevelLabel(place.priceLevel)} · ${describeProximity(place.proximity)}`} />
          ))}
        </Block>
        <Block title="My study spots" icon={<GraduationCap className="size-4" />} href="/discover?tab=study" empty="Nowhere saved to work yet.">
          {study.slice(0, 4).map((place) => (
            <Row key={place.id} href={`/discover/${encodeURIComponent(place.id)}`} title={place.name} meta={describeProximity(place.proximity)} />
          ))}
        </Block>
        <Block title="My events" icon={<CalendarDays className="size-4" />} href="/events" empty="Nothing you are going to yet.">
          {myEvents.slice(0, 4).map((event) => (
            <Row key={event.id} href={`/events/${event.id}`} title={event.title} meta={new Date(event.startsAt).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })} />
          ))}
        </Block>
        <Block title="My deals" icon={<Tag className="size-4" />} href="/discover?tab=deals" empty="Deals in the categories you budget for show up here.">
          {myDeals.map((deal) => (
            <Row key={deal.id} href="/discover?tab=deals" title={deal.title} meta={deal.value} />
          ))}
        </Block>
        <Block title="My groups" icon={<MessagesSquare className="size-4" />} href="/pulse/chat" empty="Join a plan and its group appears here.">
          {groups.slice(0, 4).map((row) => (
            <Row key={row.inviteId} href={`/anyone-down/${row.inviteId}`} title="Anyone Down? group" meta="Open chat" />
          ))}
        </Block>
        <Block title="Neighbourhoods here" icon={<MapPin className="size-4" />} href="/discover" empty={city.deep ? "" : `No neighbourhood data for ${city.name} yet. Students add it as they post.`}>
          {city.neighbourhoods.slice(0, 6).map((area) => (
            <li key={area} className="rounded-full bg-paper-2 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-700">{area}</li>
          ))}
        </Block>
      </div>

      {!viewer.entitlements.can.tripPlanner ? (
        <div className="mt-6">
          <Upsell feature="tripPlanner" line={`Visiting another city? Pro opens any of the ${cityDirectory.length} cities in the directory as a trip — places, budget and what is on — without moving home.`} />
        </div>
      ) : (
        <Link href="/discover" className="mt-6 flex items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-ink-950/6 hover:shadow-[var(--shadow-raise)]">
          <MascotArt state="travel" accessory="luggage-tag" className="size-12 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[1rem] font-semibold text-ink-950">Plan a trip</span>
            <span className="mt-0.5 block text-[0.8125rem] text-ink-600">Open another city in Discover without moving home. Pick it from the city chip.</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-ink-400" />
        </Link>
      )}
    </div>
  );
}

function Block({ title, icon, href, empty, children }: { title: string; icon: React.ReactNode; href: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-950">
          <span className="text-ink-400">{icon}</span>
          {title}
        </h2>
        <Link href={href} className="text-[0.8125rem] font-medium text-ink-500 hover:text-ink-950">More</Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-[0.8125rem] text-ink-500">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2 [&>li]:min-w-0">{children}</ul>
      )}
    </section>
  );
}

function Row({ href, title, meta }: { href: string; title: string; meta: string }) {
  return (
    <li className="w-full">
      <Link href={href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-paper-2">
        <span className="min-w-0 truncate text-[0.875rem] font-medium text-ink-900">{title}</span>
        <span className="shrink-0 text-[0.75rem] text-ink-500">{meta}</span>
      </Link>
    </li>
  );
}
