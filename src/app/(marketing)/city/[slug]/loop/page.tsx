import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { CitySubnav } from "@/components/marketing/city-subnav";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { LoopFeed } from "@/components/product/loop-feed";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { campusesForCity, cities, cityStatusNote, getCity } from "@/data/cities";
import { loopForCity, loopSummaries } from "@/data/loop";

export function generateStaticParams() {
  return cities.map((city) => ({ slug: city.slug }));
}

export async function generateMetadata(
  props: PageProps<"/city/[slug]/loop">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) return { title: "City not found" };

  return {
    title: `${city.name} The Loop`,
    description: `What students in ${city.name} are posting, asking and organising: free events, deals, warnings and people looking for others to join them.`,
    alternates: { canonical: `/city/${city.slug}/loop` },
  };
}

export default async function CityLoopPage(props: PageProps<"/city/[slug]/loop">) {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) notFound();

  const posts = loopForCity(city.slug);
  const campuses = campusesForCity(city.slug);
  const summary = loopSummaries[city.slug];

  return (
    <>
      <CitySubnav city={city} active="pulse" />

      <PageHero
        crumbs={[
          { label: "Students", href: "/students" },
          { label: city.name, href: `/city/${city.slug}` },
          { label: brand.surfaces.loop },
        ]}
        eyebrow={`${city.name} · ${brand.surfaces.loop}`}
        title={`Everything ${city.name} students know, in one feed`}
        lead={`Free events tonight, the deal that is not on the menu, the ticket you are being overcharged for, and the five-a-side game that is two players short. ${posts.length} sample posts across ${campuses.length} campuses.`}
        actions={
          <ButtonLink href="/get-started" variant="signal" size="lg">
            Join {city.name}
          </ButtonLink>
        }
      />

      <Section tone="pulse" className="py-12 sm:py-16">
        <div className="page">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:items-start">
            <LoopFeed citySlug={city.slug} />

            <div className="lg:sticky lg:top-32">
              <Eyebrow>How this feed works</Eyebrow>
              <dl className="mt-5 flex flex-col gap-5">
                {[
                  {
                    term: "Upvotes rank, they do not verify",
                    detail:
                      "A popular post is still one person's claim. A place only earns the Student Verified badge when ten students independently confirm it.",
                  },
                  {
                    term: "Warnings sit alongside wins",
                    detail:
                      "The most useful post in a city is often someone stopping others from wasting money. Those get the same weight as an event.",
                  },
                  {
                    term: "The summary reads, it does not write",
                    detail: summary
                      ? `The summary above this feed is generated from ${summary.sourceCount} posts. It condenses what students said and never adds a fact of its own.`
                      : "Summaries only appear once there is enough activity to condense.",
                  },
                  {
                    term: "Your campus filter is the real feed",
                    detail:
                      "City-wide is for events and warnings. Your campus tab is what most students end up reading daily.",
                  },
                ].map((item) => (
                  <Reveal key={item.term}>
                    <dt className="text-[0.9375rem] font-semibold text-ink-950">{item.term}</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-ink-600">{item.detail}</dd>
                  </Reveal>
                ))}
              </dl>

              <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[0.9375rem] font-semibold text-white">
                  {city.name} is not live yet
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                  {cityStatusNote[city.status]}
                </p>
                <div className="mt-4">
                  <WaitlistForm citySlug={city.slug} cityName={city.name} onDark />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
