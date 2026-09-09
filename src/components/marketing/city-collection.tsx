import type { ReactNode } from "react";

import { PageHero } from "@/components/layout/page-hero";
import { CitySubnav } from "@/components/marketing/city-subnav";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { PlaceList } from "@/components/product/place-list";
import { LoopPostCard } from "@/components/product/loop-post-card";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, ProductPanel, SampleTag, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { cityStatusNote } from "@/data/cities";
import type { City, Place, LoopPost } from "@/data/types";

/**
 * Shared shell for the city collection pages (free events, cheap food, deals).
 * Each page passes its own copy and its own filtered rows — the shell exists so
 * they look like one product, not so they can be spun out of a template.
 */
export function CityCollection({
  city,
  active,
  eyebrow,
  title,
  lead,
  places,
  posts,
  emptyTitle,
  emptyBody,
  aside,
  method,
  now,
  placesUnavailable = null,
  attribution = null,
}: {
  city: City;
  active: string;
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  places: readonly Place[];
  /** Set when no place provider answered, so the page can say so. */
  placesUnavailable?: { message: string } | null;
  /** Licence line for whatever produced the rows. Rendered under the list. */
  attribution?: string | null;
  posts: readonly LoopPost[];
  emptyTitle: string;
  emptyBody: string;
  /** Optional block shown beside the hero, e.g. a price anchor. */
  aside?: ReactNode;
  /** How this list is built. Printed on the page, not hidden in a tooltip. */
  method: string;
  /** Passed in so the server and client agree on what "now" is. */
  now: Date;
}) {
  return (
    <>
      <CitySubnav city={city} active={active} />

      <PageHero
        crumbs={[
          { label: "Students", href: "/students" },
          { label: city.name, href: `/city/${city.slug}` },
          { label: eyebrow },
        ]}
        eyebrow={`${city.name} · ${eyebrow}`}
        title={title}
        lead={lead}
        aside={aside}
        actions={
          <>
            <ButtonLink href="/get-started" variant="signal" size="lg">
              Build my {brand.name}
            </ButtonLink>
            <ButtonLink href={`/city/${city.slug}/loop`} variant="outline" size="lg">
              See the {city.name} feed
            </ButtonLink>
          </>
        }
      />

      <Section tone="paper" className="py-14 sm:py-16">
        <div className="page">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow index="01">Places</Eyebrow>
            {/* No sample tag here any more, and its absence is the claim: these
                rows came from a place provider at request time, each with a
                link back to the object it came from. The tag stays on the
                sections below, which are still seeded. Leaving it on real data
                would be as misleading as leaving it off invented data. */}
            {attribution ? (
              <SampleTag label={`Live · ${attribution}`} />
            ) : null}
          </div>
          <PlaceList
            className="mt-6"
            places={places}
            timezone={city.timezone}
            now={now}
            unavailable={placesUnavailable ?? null}
            emptyTitle={emptyTitle}
            emptyBody={emptyBody}
          />
          {attribution ? (
            <p className="mt-3 text-xs text-ink-400">Place data: {attribution}</p>
          ) : null}
          <Reveal>
            <p className="mt-6 max-w-2xl text-[0.8125rem] leading-relaxed text-ink-400">{method}</p>
          </Reveal>
        </div>
      </Section>

      {posts.length > 0 ? (
        <Section tone="warm" className="py-14 sm:py-16">
          <div className="page">
            <Eyebrow index="02">What students posted</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-display-sm text-ink-950">
              The same subject, in their words.
            </h2>
            {/* Post cards are dark because they are product UI, so they travel
                in a panel rather than turning the whole page dark. */}
            <ProductPanel className="mt-6">
              <div className="grid gap-3 lg:grid-cols-2">
                {posts.map((post) => (
                  <LoopPostCard key={post.id} post={post} />
                ))}
              </div>
            </ProductPanel>
          </div>
        </Section>
      ) : null}

      <Section tone="warm" className="py-14 sm:py-16">
        <div className="page">
          <div className="flex flex-col gap-6 rounded-xl border border-ink-200 bg-paper p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-md">
              <h2 className="text-display-xs text-ink-950">
                This list gets better when {city.name} students write it.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {cityStatusNote[city.status]}
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
