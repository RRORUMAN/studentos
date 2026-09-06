import { ArrowRight } from "lucide-react";

import { MascotArt } from "@/components/mascot/mascot-art";
import { ArrivalChecklist } from "@/components/product/arrival-checklist";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { cities, defaultCity } from "@/data/cities";

export function ArrivalSection() {
  return (
    <Section id="arrival" tone="warm">
      <div className="page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-start lg:gap-14">
          <div className="lg:sticky lg:top-24">
            <Reveal>
              <Eyebrow index="10">{brand.surfaces.arrival}</Eyebrow>
              {/* The one place the backpack is allowed. He is arriving too,
                  which is the entire justification for a costume change. */}
              <div className="mt-4 flex items-start gap-4">
                <MascotArt
                  state="explorer"
                  accessory="backpack"
                  className="mt-1 hidden size-16 shrink-0 sm:block"
                />
                <h2 className="text-display-md text-ink-950">
                  Just landed?
                  <br />
                  <span className="text-ink-400">Start here.</span>
                </h2>
              </div>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
                The first two weeks are a queue of small decisions that each cost money if you get
                them wrong. This is that queue, in order, per city, with the official source next to
                anything that has legal weight.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <div className="mt-8 rounded-lg border border-ink-200 bg-paper p-5">
                <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                  Personalised by city
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-600">
                  Transport cards, bank requirements and registration steps are different in every
                  city on this list. The checklist is generated per city rather than being one
                  generic list with the names swapped.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {cities.map((city) => (
                    <ButtonLink
                      key={city.slug}
                      href={`/city/${city.slug}/starter-pack`}
                      variant="outline"
                      size="sm"
                    >
                      {city.name}
                    </ButtonLink>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <ButtonLink href="/get-started" variant="primary" size="lg" className="group mt-6">
                Start my arrival list
                <ArrowRight
                  className="size-4.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </ButtonLink>
            </Reveal>
          </div>

          <Reveal kind="blur" className="w-full">
            <ArrivalChecklist citySlug={defaultCity.slug} />
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
