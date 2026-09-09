import { ArrowRight, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { PlaceList } from "@/components/product/place-list";
import { LoopPostCard } from "@/components/product/loop-post-card";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, ProductPanel, SampleTag, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { getCampus, getCity } from "@/data/cities";
import { requestDate } from "@/server/now";
import { loadCityPlaces } from "@/server/queries/places";
import { loopForCity } from "@/data/loop";

/** Rendered on first request, cached six hours. See city/[slug]/cheap-food. */
export const revalidate = 21600;

export async function generateMetadata(props: PageProps<"/campus/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const campus = getCampus(slug);
  if (!campus) return { title: "Campus not found" };
  const city = getCity(campus.citySlug);

  return {
    title: `${campus.shortName} students`,
    description: `The ${campus.shortName} feed on ${brand.name}: what students around ${campus.area} in ${city?.name} are posting, eating, and organising.`,
    alternates: { canonical: `/campus/${campus.slug}` },
  };
}

export default async function CampusPage(props: PageProps<"/campus/[slug]">) {
  const { slug } = await props.params;
  const campus = getCampus(slug);
  if (!campus) notFound();

  const city = getCity(campus.citySlug);
  if (!city) notFound();

  const now = requestDate();

  const posts = loopForCity(city.slug).filter((post) => post.author.campusSlug === campus.slug);
  /* Nearest to the CAMPUS, not to the city centre. The campus has a
     neighbourhood but not a coordinate of its own, so the search runs from the
     city centre and the list is ordered by distance from there — which the
     heading below now says, instead of claiming a walking time from a building
     whose location we do not hold. */
  const found = await loadCityPlaces({ citySlug: city.slug, radiusMetres: 2_500, limit: 12 });
  const nearby = found.ok
    ? [...found.places].sort((a, b) => a.proximity.metres - b.proximity.metres).slice(0, 4)
    : [];

  return (
    <>
      <PageHero
        crumbs={[
          { label: "Students", href: "/students" },
          { label: city.name, href: `/city/${city.slug}` },
          { label: campus.shortName },
        ]}
        eyebrow={`${city.name} · ${campus.area}`}
        title={campus.name}
        lead={`The city feed is for the city. This one is for the ${campus.shortName} things: the lunch two streets from your building, the society nobody advertises, and whoever is selling last year's course books.`}
        actions={
          <>
            <ButtonLink href="/get-started" variant="signal" size="lg">
              Join {campus.shortName}
            </ButtonLink>
            <ButtonLink href={`/city/${city.slug}/loop`} variant="outline" size="lg">
              See the whole city
            </ButtonLink>
          </>
        }
        aside={
          <div className="rounded-xl border border-ink-200 bg-paper-2 p-5 lg:max-w-xs">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
              <div>
                <p className="text-[0.9375rem] font-semibold text-ink-950">{campus.area}</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-600">
                  Student lunch around here runs {city.currency.symbol}
                  {city.anchors.lunch[0]}–{city.currency.symbol}
                  {city.anchors.lunch[1]}.
                </p>
              </div>
            </div>
          </div>
        }
      />

      {/* ---- campus feed ------------------------------------------------------ */}
      <Section tone="warm" className="py-14 sm:py-16">
        <div className="page">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow index="01">
              {campus.shortName} feed
            </Eyebrow>
            <SampleTag />
          </div>

          {posts.length > 0 ? (
            <ProductPanel className="mt-6">
              <div className="grid gap-3 lg:grid-cols-2">
                {posts.map((post) => (
                  <LoopPostCard key={post.id} post={post} />
                ))}
              </div>
            </ProductPanel>
          ) : (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-300 px-6 py-14 text-center">
              <p className="text-[0.9375rem] font-medium text-ink-950">
                Nothing on the {campus.shortName} feed yet
              </p>
              <p className="max-w-sm text-sm leading-relaxed text-ink-500">
                A campus feed starts the day someone posts to it. Usually that is a person who has
                just found somewhere cheap and wants other people to know.
              </p>
              <ButtonLink href="/get-started" variant="signal" size="sm">
                Start this feed
              </ButtonLink>
            </div>
          )}

          <Reveal>
            <ButtonLink
              href={`/city/${city.slug}/loop`}
              variant="outline"
              size="md"
              className="group mt-6"
            >
              Everything in {city.name}
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </ButtonLink>
          </Reveal>
        </div>
      </Section>

      {/* ---- nearby ------------------------------------------------------------ */}
      <Section tone="paper" className="py-14 sm:py-16">
        <div className="page">
          <Reveal>
            <Eyebrow index="02">Closest to campus</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-display-sm text-ink-950">
              Sorted by distance from the centre of {city.name}
            </h2>
          </Reveal>
          <PlaceList
            className="mt-6"
            places={nearby}
            timezone={city.timezone}
            now={now}
            unavailable={found.ok ? null : { message: found.message }}
            emptyTitle={`Nothing mapped near ${campus.shortName} yet`}
            emptyBody="Places appear here as soon as a provider has them, and anyone can add one to OpenStreetMap."
          />
        </div>
      </Section>

      <Section tone="warm" className="py-14 sm:py-16">
        <div className="page">
          <div className="flex flex-col gap-6 rounded-xl border border-ink-200 bg-paper p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-md">
              <h2 className="text-display-xs text-ink-950">
                Get told when {campus.shortName} opens
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                Campus feeds open with their city. One email, then nothing.
              </p>
            </div>
            <div className="w-full max-w-md">
              <WaitlistForm citySlug={city.slug} cityName={city.name} />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
