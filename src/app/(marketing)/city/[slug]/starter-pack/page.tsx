import { ExternalLink, TrainFront } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/layout/page-hero";
import { CitySubnav } from "@/components/marketing/city-subnav";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { ArrivalChecklist } from "@/components/product/arrival-checklist";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { legalDisclaimer } from "@/data/arrival";
import { cities, getCity } from "@/data/cities";

export function generateStaticParams() {
  return cities.map((city) => ({ slug: city.slug }));
}

export async function generateMetadata(
  props: PageProps<"/city/[slug]/starter-pack">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) return { title: "City not found" };

  return {
    title: `Moving to ${city.name} as a student`,
    description: `The first two weeks in ${city.name}: transport card, SIM, banking, registration, discounts, groceries, gym and finding people — in order, with official sources.`,
    alternates: { canonical: `/city/${city.slug}/starter-pack` },
  };
}

export default async function StarterPackPage(props: PageProps<"/city/[slug]/starter-pack">) {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) notFound();

  const decisions = [
    {
      title: "Transport",
      body: `${city.transport.card}. ${city.transport.studentNote}`,
      cost:
        city.anchors.monthlyTransport === 0
          ? "Usually already covered"
          : `${city.currency.symbol}${city.anchors.monthlyTransport} a month`,
      href: city.transport.officialUrl,
      linkLabel: "Official fares",
    },
    {
      title: "Where you shop",
      body: "Find the nearest market and the nearest discount supermarket in week one. This single decision moves your monthly spend more than any discount card.",
      cost: `${city.currency.symbol}${city.anchors.weeklyGroceries[0]}–${city.currency.symbol}${city.anchors.weeklyGroceries[1]} a week`,
    },
    {
      title: "Where you eat out",
      body: "Learn the local cheap-meal format before you learn the restaurants. Every city has one, and it is usually half the price of ordering normally.",
      cost: `${city.currency.symbol}${city.anchors.lunch[0]}–${city.currency.symbol}${city.anchors.lunch[1]} a meal`,
    },
  ];

  return (
    <>
      <CitySubnav city={city} active="starter-pack" />

      <PageHero
        crumbs={[
          { label: "Students", href: "/students" },
          { label: city.name, href: `/city/${city.slug}` },
          { label: "Starter pack" },
        ]}
        eyebrow={`${city.name} · ${brand.surfaces.arrival}`}
        title={`Your first two weeks in ${city.name}`}
        lead="A queue of small decisions that each cost money if you get them wrong. Here they are in order, with the official source next to anything that has legal weight."
        actions={
          <ButtonLink href="/get-started" variant="signal" size="lg">
            Build my {brand.name}
          </ButtonLink>
        }
        aside={
          <div className="rounded-xl border border-ink-200 bg-paper-2 p-5 lg:max-w-xs">
            <div className="flex items-start gap-2.5">
              <TrainFront className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
              <div>
                <p className="text-[0.9375rem] font-semibold text-ink-950">
                  {city.transport.card}
                </p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-600">
                  {city.transport.studentNote}
                </p>
                <a
                  href={city.transport.officialUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-950 underline underline-offset-4"
                >
                  Official source
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
            </div>
          </div>
        }
      />

      <Section tone="warm" className="py-14 sm:py-16">
        <div className="page">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-start">
            <div className="lg:sticky lg:top-32">
              <Reveal>
                <Eyebrow index="01">Three decisions that set your budget</Eyebrow>
                <h2 className="mt-3 max-w-lg text-display-sm text-ink-950">
                  Get these right in week one and the rest is detail
                </h2>
              </Reveal>

              <RevealGroup className="mt-6 flex flex-col gap-3">
                {decisions.map((decision) => (
                  <RevealItem
                    key={decision.title}
                    className="rounded-lg border border-ink-200 bg-paper p-5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[0.9375rem] font-semibold text-ink-950">
                        {decision.title}
                      </h3>
                      <span className="tnum shrink-0 font-mono text-xs text-ink-500">
                        {decision.cost}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">{decision.body}</p>
                    {decision.href ? (
                      <a
                        href={decision.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-2.5 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-950 underline underline-offset-4"
                      >
                        {decision.linkLabel}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : null}
                  </RevealItem>
                ))}
              </RevealGroup>

              <Reveal>
                <p className="mt-6 max-w-lg text-[0.8125rem] leading-relaxed text-ink-400">
                  {legalDisclaimer}
                </p>
              </Reveal>
            </div>

            <Reveal delay={0.05} className="w-full">
              <ArrivalChecklist citySlug={city.slug} />
            </Reveal>
          </div>
        </div>
      </Section>

      <Section tone="paper" className="py-14 sm:py-16">
        <div className="page">
          <div className="flex flex-col gap-6 rounded-xl border border-ink-200 bg-paper-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-md">
              <h2 className="text-display-xs text-ink-950">
                The last item on the list is the one that matters
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                Go to one thing in week one. Everything else on this page is admin; that is the part
                that decides how the year goes.
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
