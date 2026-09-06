import { ArrowRight, MessagesSquare, Radio, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { MascotArt } from "@/components/mascot/mascot-art";
import { LoopFeed } from "@/components/product/loop-feed";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { mascot } from "@/brand/mascot.config";
import { cities, defaultCity } from "@/data/cities";
import { loopSummaries } from "@/data/loop";
import { cn } from "@/lib/utils";

const PILLARS = [
  {
    icon: MessagesSquare,
    title: "City and campus, side by side",
    body: "The city feed for everything, your campus feed for the things only your campus cares about. Filter to either in one tap.",
  },
  {
    icon: Radio,
    title: "Chat that is actually local",
    body: "A live room per city. Someone asks whether the rooftop is really free tonight, and three people who were there last week answer.",
  },
  {
    icon: ShieldAlert,
    title: "Warnings, not just wins",
    body: "The most upvoted post in Madrid this week is someone stopping other students from overpaying for transport. That is the value.",
  },
] as const;

/**
 * The flagship section. Everything else on the page is downstream of this loop,
 * so it gets the most space and the real feed.
 *
 * The ground is the coral tint rather than the old near-black slab: The Loop owns
 * coral everywhere else in the system, and the only dark rectangle here is now
 * the feed itself — which is the point, because the feed *is* the product.
 */
export function LoopSection() {
  return (
    <Section id="loop" tone="pulse">
      <div className="page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-start lg:gap-14">
          <div>
            <Reveal>
              <Eyebrow index="05">
                {brand.surfaces.loop}
              </Eyebrow>
              <h2 className="mt-4 text-display-md text-ink-950">The part no algorithm can fake.</h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
                Every city holds knowledge only students have. Which menú is €5 if you ask for it.
                Which ticket you are being overcharged for. Which night is free before 22:00.{" "}
                {brand.surfaces.loop} is where that gets written down, upvoted and corrected.
              </p>
            </Reveal>

            <RevealGroup className="mt-8 flex flex-col gap-5">
              {PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <RevealItem key={pillar.title} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-pulse-soft text-pulse-deep">
                      <Icon className="size-4.5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-[0.9375rem] font-semibold text-ink-950">{pillar.title}</h3>
                      <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-600">
                        {pillar.body}
                      </p>
                    </div>
                  </RevealItem>
                );
              })}
            </RevealGroup>

            {/* ---- the catch-up ------------------------------------------
                The mascot's one job in this section: turn a feed nobody has
                time to read into four lines. It is also the clearest statement
                of what the AI is actually for — reading the community, not
                replacing it. The source count is printed because a summary
                without one is just an opinion. */}
            <Reveal delay={0.08}>
              <div className="mt-9 overflow-hidden rounded-xl border border-ink-950/10 bg-white">
                <div className="flex items-center gap-3 border-b border-ink-100 bg-signal-soft px-4 py-3">
                  <MascotArt state="social" className="size-9 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-950">
                      {mascot.name}&rsquo;s catch-up
                    </p>
                    <p className="tnum text-xs text-ink-500">
                      {defaultCity.name} · read from{" "}
                      {loopSummaries[defaultCity.slug]?.sourceCount ?? 0} posts today
                    </p>
                  </div>
                </div>
                <p className="px-4 py-4 text-[0.9375rem] leading-relaxed text-ink-700">
                  {loopSummaries[defaultCity.slug]?.body}
                </p>
              </div>
            </Reveal>

            {/* the loop */}
            <Reveal delay={0.1}>
              <div className="mt-9 rounded-lg border border-ink-200 bg-white/70 p-4">
                <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                  Why it compounds
                </p>
                <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-ink-700">
                  {[
                    "More students",
                    "More local knowledge",
                    "Better answers",
                    "More students",
                  ].map((step, index, all) => (
                    <li key={`${step}-${index}`} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1",
                          index === all.length - 1
                            ? "bg-signal text-ink-950"
                            : "bg-ink-100 text-ink-700",
                        )}
                      >
                        {step}
                      </span>
                      {index < all.length - 1 ? (
                        <ArrowRight className="size-3.5 text-ink-300" aria-hidden />
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>

            {/* CTA */}
            <Reveal delay={0.12}>
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-ink-950">
                  See your city&rsquo;s {brand.surfaces.loop}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cities.map((city) => (
                    <Link
                      key={city.slug}
                      href={`/city/${city.slug}/loop`}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                        city.status === "live"
                          ? "border-ink-950 bg-signal text-ink-950 hover:brightness-[1.04]"
                          : "border-ink-200 bg-white/70 text-ink-600 hover:border-ink-300 hover:text-ink-950",
                      )}
                    >
                      {city.name}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal kind="blur" className="w-full lg:sticky lg:top-24">
            <LoopFeed citySlug={defaultCity.slug} limit={5} />
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
