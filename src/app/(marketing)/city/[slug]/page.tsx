import { ArrowRight, GraduationCap, TrainFront } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { CitySubnav } from "@/components/marketing/city-subnav";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { CityMap } from "@/components/product/city-map";
import { LoopFeed } from "@/components/product/loop-feed";
import { SharePlanActions, SharePlanCard } from "@/components/product/share-plan-card";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import {
  campusesForCity,
  cityStatusLabel,
  cityStatusNote,
  getCity,
  resolveCity,
} from "@/data/cities";
import { areaNamesForCity } from "@/data/neighbourhoods";
import { sharePlansForCity } from "@/data/plans";
import { requestDate } from "@/server/now";
import { loadCityPlaces } from "@/server/queries/places";
import { cn } from "@/lib/utils";

/** Rendered on first request, cached six hours. See city/[slug]/cheap-food. */
export const revalidate = 21600;

export async function generateMetadata(props: PageProps<"/city/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) return { title: "City not found" };

  return {
    title: `${city.name} for students`,
    description: `${city.hook} What a student week costs in ${city.name}, where the free things are, and what students there actually recommend.`,
    alternates: { canonical: `/city/${city.slug}` },
  };
}

export default async function CityPage(props: PageProps<"/city/[slug]">) {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) notFound();

  const now = requestDate();
  /* Coordinates come from the directory, which is where every city's geography
     lives — the marketing `City` record deliberately does not carry a second
     copy of them. */
  const context = resolveCity(city.slug);
  const cityCentre = { lat: context?.lat ?? 0, lng: context?.lng ?? 0 };
  /* The map's rows, loaded here rather than inside the component: the map is a
     client component and must not fetch. An outage becomes a stated message on
     the canvas rather than an empty city. */
  const mapPlaces = await loadCityPlaces({ citySlug: city.slug, radiusMetres: 2_500, limit: 60 });

  const campuses = campusesForCity(city.slug);
  const areaNames = areaNamesForCity(city.slug, city.neighbourhoods);
  const plans = sharePlansForCity(city.slug);

  const anchors = [
    {
      term: "Lunch out",
      value: `${city.currency.symbol}${city.anchors.lunch[0]}–${city.currency.symbol}${city.anchors.lunch[1]}`,
      note: "What students pay, not the tourist street",
    },
    {
      term: "A drink",
      value: `${city.currency.symbol}${city.anchors.pint[0]}–${city.currency.symbol}${city.anchors.pint[1]}`,
      note: "The gap between these two numbers is one street",
    },
    {
      term: "Transport",
      value:
        city.anchors.monthlyTransport === 0
          ? "Included"
          : `${city.currency.symbol}${city.anchors.monthlyTransport}/mo`,
      note: city.transport.studentNote,
    },
    {
      term: "Groceries",
      value: `${city.currency.symbol}${city.anchors.weeklyGroceries[0]}–${city.currency.symbol}${city.anchors.weeklyGroceries[1]}/wk`,
      note: "Market versus supermarket is most of this range",
    },
  ];

  return (
    <>
      <CitySubnav city={city} active="" />

      <PageHero
        crumbs={[{ label: "Students", href: "/students" }, { label: city.name }]}
        eyebrow={`${city.country} · ${cityStatusLabel[city.status]}`}
        title={`${city.name} for students`}
        lead={city.intro}
        actions={
          <>
            <ButtonLink href="/get-started" variant="signal" size="lg">
              Build my {brand.name}
            </ButtonLink>
            <ButtonLink href={`/city/${city.slug}/starter-pack`} variant="outline" size="lg">
              Just moved here
            </ButtonLink>
          </>
        }
        aside={
          <div className="rounded-xl border border-ink-200 bg-paper-2 p-5 lg:max-w-xs">
            <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
              Availability
            </p>
            <p className="mt-2 text-[0.9375rem] font-medium text-ink-950">
              {cityStatusLabel[city.status]}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
              {cityStatusNote[city.status]}
            </p>
            <div className="mt-4 flex items-start gap-2.5 border-t border-ink-200 pt-4">
              <TrainFront className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
              <p className="text-[0.8125rem] leading-relaxed text-ink-600">
                <span className="font-medium text-ink-900">{city.transport.card}</span> —{" "}
                {city.transport.studentNote}
              </p>
            </div>
          </div>
        }
      />

      {/* ---- what a week costs ---------------------------------------------- */}
      <Section tone="paper" className="py-14 sm:py-16">
        <div className="page">
          <Reveal>
            <Eyebrow index="01">Price anchors</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-display-sm text-ink-950">
              What things actually cost here
            </h2>
          </Reveal>

          <RevealGroup className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {anchors.map((anchor) => (
              <RevealItem
                key={anchor.term}
                className="rounded-lg border border-ink-200 bg-paper-2 p-4"
              >
                <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                  {anchor.term}
                </p>
                <p className="tnum mt-1.5 font-mono text-2xl font-semibold text-ink-950">
                  {anchor.value}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-ink-500">{anchor.note}</p>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal>
            <p className="mt-5 max-w-2xl text-[0.8125rem] leading-relaxed text-ink-400">
              Ranges, not averages. An average hides the only useful information here, which is how
              wide the gap is between the cheap version and the default one.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* ---- pulse ----------------------------------------------------------- */}
      <Section tone="pulse" className="py-14 sm:py-16">
        <div className="page">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-start">
            <div>
              <Eyebrow index="02">
                {brand.surfaces.loop}
              </Eyebrow>
              <h2 className="mt-3 text-display-sm text-ink-950">
                What {city.name} students are saying
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-600">
                Sample posts, shown through the real feed. Vote, filter by campus and open the city
                chat — all of it works here.
              </p>
              <ButtonLink
                href={`/city/${city.slug}/loop`}
                variant="primary"
                size="md"
                className="group mt-6"
              >
                Open the full feed
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </ButtonLink>

              {campuses.length > 0 ? (
                <div className="mt-8">
                  <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                    Campuses here
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {campuses.map((campus) => (
                      <li key={campus.slug}>
                        <Link
                          href={`/campus/${campus.slug}`}
                          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/70 px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-ink-300 hover:text-ink-950"
                        >
                          <GraduationCap className="size-3.5" aria-hidden />
                          {campus.shortName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <LoopFeed citySlug={city.slug} limit={4} />
          </div>
        </div>
      </Section>

      {/* ---- map -------------------------------------------------------------- */}
      <Section tone="paper" className="py-14 sm:py-16">
        <div className="page">
          <Reveal>
            <Eyebrow index="03">{brand.surfaces.discover}</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-display-sm text-ink-950">
              Everything with a price and a walk time
            </h2>
          </Reveal>
          <Reveal delay={0.05} className="mt-6">
            <CityMap
              cityName={city.name}
              places={mapPlaces.ok ? mapPlaces.places : []}
              centre={{ lat: cityCentre.lat, lng: cityCentre.lng }}
              unavailable={mapPlaces.ok ? null : { message: mapPlaces.message }}
              attribution={mapPlaces.ok ? mapPlaces.attribution : null}
              now={now}
              timezone={city.timezone}
            />
          </Reveal>
        </div>
      </Section>

      {/* ---- plans ------------------------------------------------------------ */}
      {plans.length > 0 ? (
        <Section tone="warm" className="py-14 sm:py-16">
          <div className="page">
            <Reveal>
              <Eyebrow index="04">Plans</Eyebrow>
              <h2 className="mt-3 max-w-2xl text-display-sm text-ink-950">
                A day in {city.name}, priced
              </h2>
            </Reveal>
            <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-start">
              {plans.map((plan) => (
                <div key={plan.id} className="flex flex-col gap-5">
                  <SharePlanCard plan={plan} />
                  <SharePlanActions plan={plan} />
                </div>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* ---- neighbourhoods + waitlist ----------------------------------------- */}
      <Section tone="paper" className="py-14 sm:py-16">
        <div className="page">
          <div className="grid gap-8 lg:grid-cols-2">
            <Reveal>
              <Eyebrow index="05">Where students live</Eyebrow>
              <h2 className="mt-3 text-display-sm text-ink-950">Neighbourhoods to know</h2>
              {/* This was `city.neighbourhoods` — hand-written, present for
                  five cities, empty for every other — under a heading that
                  promised "Neighbourhoods to know". Most of these public pages
                  therefore carried a section title, a paragraph describing the
                  chips, and no chips. The registry knows the districts of every
                  city, and where the two sources disagree the caption below
                  says which one is speaking. */}
              <ul className="mt-5 flex flex-wrap gap-2">
                {areaNames.map((area) => (
                  <li
                    key={area}
                    className={cn(
                      "rounded-full border border-ink-200 bg-paper-2 px-3.5 py-2 text-sm text-ink-700",
                    )}
                  >
                    {area}
                  </li>
                ))}
              </ul>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-500">
                {city.neighbourhoods.length > 0
                  ? "In the product these carry their own price anchors and feeds. Right now they are the list students keep repeating when someone asks where to look for a room."
                  : `The districts of ${city.name} as Wikidata records them — names and positions, which is what we have here so far. What a room costs in each one comes from students, and that starts when there are students here.`}
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <div className="rounded-xl border border-ink-200 bg-paper-2 p-6">
                <h2 className="text-display-xs text-ink-950">
                  Get told when {city.name} opens
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  One email, when there are enough students here for the feed to be worth reading.
                </p>
                <div className="mt-5">
                  <WaitlistForm citySlug={city.slug} cityName={city.name} />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </Section>
    </>
  );
}
