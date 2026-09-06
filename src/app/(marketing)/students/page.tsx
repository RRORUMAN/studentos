import { ArrowUpRight, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { FinalCta } from "@/components/marketing/final-cta";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { campuses, cities, cityStatusLabel, cityStatusNote } from "@/data/cities";
import { loopForCity } from "@/data/loop";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Students",
  description: `Every city and campus ${brand.name} is opening in, what a student week costs there, and where the community starts.`,
};

const CITY_LINKS = [
  { suffix: "loop", label: "Loop" },
  { suffix: "free-events", label: "Free events" },
  { suffix: "cheap-food", label: "Cheap food" },
  { suffix: "student-deals", label: "Student deals" },
  { suffix: "starter-pack", label: "Starter pack" },
] as const;

export default function StudentsPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Students" }]}
        eyebrow="Cities and campuses"
        title="Find your city. Then find your campus."
        lead={`A city page tells you what a student week actually costs there. A campus page is where your own people are. Both are free to read, and neither pretends to be busier than it is.`}
        actions={
          <ButtonLink href="/get-started" variant="signal" size="lg">
            Build my {brand.name}
          </ButtonLink>
        }
      />

      {/* ---- cities --------------------------------------------------------- */}
      <Section id="cities" tone="paper" className="py-16 sm:py-20">
        <div className="page">
          <Reveal>
            <Eyebrow index="01">Cities</Eyebrow>
            <h2 className="mt-3 text-display-sm text-ink-950">The first five</h2>
          </Reveal>

          <RevealGroup className="mt-8 grid gap-4 lg:grid-cols-2">
            {cities.map((city) => (
              <RevealItem
                key={city.slug}
                className="rounded-xl border border-ink-200 bg-paper-2 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/city/${city.slug}`}
                      className="group inline-flex items-center gap-2"
                    >
                      <h3 className="font-display text-2xl font-semibold tracking-[-0.025em] text-ink-950">
                        {city.name}
                      </h3>
                      <ArrowUpRight
                        className="size-4 text-ink-300 transition-colors group-hover:text-ink-950"
                        aria-hidden
                      />
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-400">{city.country}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-micro font-semibold tracking-[0.06em] uppercase",
                      city.status === "live"
                        ? "bg-signal text-ink-950"
                        : "bg-ink-100 text-ink-500",
                    )}
                  >
                    {cityStatusLabel[city.status]}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-ink-600">{city.hook}</p>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  {[
                    {
                      term: "Lunch",
                      value: `${city.currency.symbol}${city.anchors.lunch[0]}–${city.currency.symbol}${city.anchors.lunch[1]}`,
                    },
                    {
                      term: "Pint",
                      value: `${city.currency.symbol}${city.anchors.pint[0]}–${city.currency.symbol}${city.anchors.pint[1]}`,
                    },
                    {
                      term: "Transport",
                      value:
                        city.anchors.monthlyTransport === 0
                          ? "Included"
                          : `${city.currency.symbol}${city.anchors.monthlyTransport}/mo`,
                    },
                    {
                      term: "Groceries",
                      value: `${city.currency.symbol}${city.anchors.weeklyGroceries[0]}–${city.currency.symbol}${city.anchors.weeklyGroceries[1]}/wk`,
                    },
                  ].map((stat) => (
                    <div key={stat.term}>
                      <dt className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">
                        {stat.term}
                      </dt>
                      <dd className="tnum mt-0.5 text-sm font-medium text-ink-900">{stat.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-ink-200 pt-4">
                  {CITY_LINKS.map((link) => (
                    <Link
                      key={link.suffix}
                      href={`/city/${city.slug}/${link.suffix}`}
                      className="rounded-full border border-ink-200 bg-paper px-3 py-1.5 text-[0.8125rem] text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-950"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>

                <p className="mt-3 text-xs text-ink-400">
                  {cityStatusNote[city.status]} {loopForCity(city.slug).length} sample posts are
                  shown on this city&rsquo;s pages.
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </Section>

      {/* ---- campuses -------------------------------------------------------- */}
      <Section id="campuses" tone="warm" className="py-16 sm:py-20">
        <div className="page">
          <Reveal>
            <Eyebrow index="02">Campuses</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-display-sm text-ink-950">
              Your campus feed is the one you will actually read every day.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-600">
              The city feed is for the city. Your campus feed is for the €5 lunch two streets from
              your building, the society nobody advertises, and the person selling last year&rsquo;s
              course books.
            </p>
          </Reveal>

          <RevealGroup
            step={0.03}
            className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {campuses.map((campus) => {
              const city = cities.find((item) => item.slug === campus.citySlug);
              return (
                <RevealItem key={campus.slug}>
                  <Link
                    href={`/campus/${campus.slug}`}
                    className="group flex h-full items-start gap-3 rounded-lg border border-ink-200 bg-paper p-4 transition-[border-color,box-shadow] hover:border-ink-300 hover:shadow-[var(--shadow-raise)]"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-flow-soft text-flow-deep">
                      <GraduationCap className="size-4.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-semibold text-ink-950">
                        {campus.shortName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-400">
                        {campus.name}
                      </span>
                      <span className="mt-1.5 block text-xs text-ink-500">
                        {city?.name} · {campus.area}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="size-4 shrink-0 text-ink-300 transition-colors group-hover:text-ink-950"
                      aria-hidden
                    />
                  </Link>
                </RevealItem>
              );
            })}
          </RevealGroup>

          <Reveal>
            <p className="mt-6 max-w-2xl text-[0.8125rem] leading-relaxed text-ink-400">
              Missing a university? The list grows with the students who arrive. Campus feeds are
              created on request rather than pre-generated, which is why there are fifteen here and
              not five hundred empty ones.
            </p>
          </Reveal>
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
