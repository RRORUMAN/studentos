import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { cities, cityStatusLabel, cityStatusNote } from "@/data/cities";
import { cn } from "@/lib/utils";

/**
 * Credibility without invented numbers. No partner logos, no "trusted by
 * 40,000 students", no testimonials from people who do not exist. What we can
 * honestly show is the product's own standards and exactly where it is opening.
 */
const PROMISES = [
  {
    title: "Prices come from students",
    body: "Not from menus, not from a scrape. A price is only shown once students report it, and the count is always visible.",
  },
  {
    title: "Every fact keeps its source",
    body: "Opening hours, fares and free windows are attributed to official listings. Taste is attributed to students. Nothing is laundered through a chatbot.",
  },
  {
    title: "The community stays free",
    body: "The Loop, chat, events and basic discovery cost nothing, permanently. A paid tier never buys access to other students.",
  },
] as const;

export function CitiesStrip() {
  return (
    <Section tone="warm" id="cities">
      <div className="page">
        <Reveal>
          <Eyebrow index="01">Where it works</Eyebrow>
          <h2 className="mt-4 max-w-2xl text-display-md text-ink-950">
            Built for students moving somewhere new.
          </h2>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROMISES.map((promise) => (
            <RevealItem
              key={promise.title}
              className="rounded-lg border border-ink-200 bg-paper p-5"
            >
              <h3 className="text-[0.9375rem] font-semibold text-ink-950">{promise.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{promise.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>

        <div className="mt-14">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h3 className="text-display-sm text-ink-950">The first five cities</h3>
              <p className="max-w-md text-sm leading-relaxed text-ink-500">
                Availability is stated plainly. A city&rsquo;s Loop opens when there are enough
                students in it to be worth reading, and not before.
              </p>
            </div>
          </Reveal>

          <RevealGroup
            step={0.05}
            className="mt-6 -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5"
          >
            {cities.map((city) => (
              <RevealItem
                key={city.slug}
                className="w-[17rem] shrink-0 snap-start sm:w-auto"
              >
                <Link
                  href={`/city/${city.slug}`}
                  className={cn(
                    "group flex h-full flex-col justify-between rounded-lg border border-ink-200 bg-paper p-4",
                    "transition-[border-color,box-shadow,transform] duration-200",
                    "hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-[var(--shadow-float)]",
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink-950">
                          {city.name}
                        </h4>
                        <p className="mt-0.5 text-xs text-ink-400">{city.country}</p>
                      </div>
                      <ArrowUpRight
                        className="size-4 shrink-0 text-ink-300 transition-colors group-hover:text-ink-950"
                        aria-hidden
                      />
                    </div>

                    <p className="mt-3 text-[0.8125rem] leading-snug text-ink-600">{city.hook}</p>
                  </div>

                  <div className="mt-4">
                    <dl className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-micro text-ink-400 uppercase">
                      <div className="flex items-center gap-1.5">
                        <dt className="sr-only">Typical student lunch</dt>
                        <dd className="tnum">
                          Lunch {city.currency.symbol}
                          {city.anchors.lunch[0]}&ndash;{city.currency.symbol}
                          {city.anchors.lunch[1]}
                        </dd>
                      </div>
                    </dl>

                    <p
                      className={cn(
                        "mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-micro font-semibold tracking-[0.06em] uppercase",
                        city.status === "live"
                          ? "bg-signal text-ink-950"
                          : "bg-ink-100 text-ink-500",
                      )}
                    >
                      {cityStatusLabel[city.status]}
                    </p>
                    <p className="mt-2 text-[0.6875rem] leading-snug text-ink-400">
                      {cityStatusNote[city.status]}
                    </p>
                  </div>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal>
            <p className="mt-6 max-w-2xl text-[0.8125rem] leading-relaxed text-ink-400">
              These five are where student prices, free evenings and campus communities differ
              most, which makes them the honest place to start. No city here has a live community
              yet — every screen on this page is built from sample data and says so.
            </p>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
