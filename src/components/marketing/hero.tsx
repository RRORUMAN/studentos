import { BadgeCheck, Globe2, HeartHandshake } from "lucide-react";

import { HeroConsole } from "@/components/product/hero-console";
import { ButtonLink } from "@/components/ui/button";
import { Atmosphere } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { coverageStats } from "@/config/regions";

/**
 * ============================================================================
 * HERO
 * ----------------------------------------------------------------------------
 * The claim on the left, the product running on the right. On a wide screen a
 * visitor reads the sentence and drives the demo without scrolling at all; on
 * a phone the two stack, and the primary action still sits above the fold.
 *
 * The three facts under the buttons are all derived or already true
 * elsewhere: the coverage numbers come from `config/regions.ts`, the free tier
 * is the pricing page's own promise, and "every sample says sample" is a rule
 * the page below keeps in public.
 *
 * Behind the console, two tilted plates in the brand colours. They are the
 * only decoration here, they sit inside the section's clip, and they stop
 * above the mascot line so they never sit under a tap target.
 * ============================================================================
 */
export function Hero() {
  const proof = [
    { icon: HeartHandshake, label: "Free, for real", detail: "Community, events and budget" },
    {
      icon: Globe2,
      label: `${coverageStats.cities} cities`,
      detail: `${coverageStats.countries} countries, ${coverageStats.currencies} currencies`,
    },
    { icon: BadgeCheck, label: "Nothing invented", detail: "Every sample says sample" },
  ];

  return (
    <section className="relative overflow-hidden bg-paper pt-8 pb-16 sm:pt-12 sm:pb-20 xl:pt-14 xl:pb-24">
      <Atmosphere
        blobs={[
          { className: "top-[-14rem] left-[-10rem] size-[34rem] bg-signal/24", drift: "a" },
          { className: "top-[12rem] right-[-14rem] size-[32rem] bg-pulse/10", drift: "b" },
        ]}
      />

      {/* `grid-cols-1` is load-bearing. Without a template the single mobile
          column is an implicit `auto` track, which sizes to its content's
          max-content width: the lead paragraph pushed it to 446px on a 375px
          phone, and the section's clip hid the damage by cutting every line off
          mid-word instead of scrolling. `minmax(0, 1fr)` holds it to the page. */}
      <div className="page relative grid grid-cols-1 items-center gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,35rem)] xl:gap-16">
        {/* ---- the claim ---------------------------------------------------- */}
        <div className="mx-auto flex min-w-0 max-w-2xl flex-col items-center text-center xl:mx-0 xl:items-start xl:text-left">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 py-1 pr-3.5 pl-1 text-xs text-ink-600 backdrop-blur-sm">
              <span className="rounded-full bg-ink-950 px-2 py-0.5 font-mono text-[0.625rem] font-semibold tracking-[0.1em] text-signal uppercase">
                OS
              </span>
              The operating system for student life abroad
            </p>
          </Reveal>

          <Reveal delay={0.04}>
            <h1 className="mt-6 text-display-2xl text-ink-950">
              Your new city, <span className="underline-sketch">figured out</span>.
            </h1>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
              What&rsquo;s on tonight, what you can afford, what you&rsquo;re forgetting and
              who&rsquo;s going. One app that knows your city, your money and your university — and
              answers in one screen, not ten tabs.
            </p>
          </Reveal>

          <Reveal delay={0.12} className="w-full">
            <div className="mt-8 flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:justify-center xl:justify-start">
              <ButtonLink href="/get-started" variant="signal" size="lg">
                Get started free
              </ButtonLink>
              <ButtonLink href="#platform" variant="outline" size="lg">
                See how it works
              </ButtonLink>
            </div>
            <p className="mt-3.5 text-[0.8125rem] text-ink-500">Free to join. No card required.</p>
          </Reveal>

          <Reveal delay={0.16} className="w-full">
            <dl className="mt-10 grid w-full max-w-xl grid-cols-3 gap-4 border-t border-ink-200/80 pt-6 text-left xl:max-w-none">
              {proof.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="min-w-0">
                    <dt className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-950 sm:text-[0.875rem]">
                      <Icon className="size-4 shrink-0 text-ink-400" aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </dt>
                    <dd className="mt-1 hidden text-[0.8125rem] leading-snug text-ink-500 sm:block">
                      {item.detail}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Reveal>
        </div>

        {/* ---- the product --------------------------------------------------- */}
        <Reveal delay={0.14} kind="blur">
          <div id="demo" className="relative mx-auto w-full max-w-[36rem] scroll-mt-24">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-12 bottom-28 hidden rotate-[4deg] rounded-[1.75rem] bg-signal sm:block"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-14 bottom-24 hidden -rotate-[3deg] rounded-[1.75rem] bg-pulse-soft ring-1 ring-pulse/20 sm:block"
            />
            <p className="relative mb-3 flex items-center justify-center gap-2 font-mono text-micro tracking-[0.12em] text-ink-500 uppercase xl:justify-start">
              <span className="relative grid size-1.5 place-items-center" aria-hidden>
                <span className="absolute size-1.5 rounded-full bg-pulse animate-ping-soft" />
                <span className="size-1.5 rounded-full bg-pulse" />
              </span>
              Live demo · no account needed
            </p>
            <div className="relative">
              <HeroConsole />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
