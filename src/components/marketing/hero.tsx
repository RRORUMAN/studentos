import { HeroConsole } from "@/components/product/hero-console";
import { ButtonLink } from "@/components/ui/button";
import { Atmosphere } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { coverageStats } from "@/config/regions";
import { cities } from "@/data/cities";

/**
 * ============================================================================
 * HERO
 * ----------------------------------------------------------------------------
 * One claim, one sentence of proof, three destinations, and then the product
 * running underneath — close enough to the fold that a visitor on a 375px
 * phone sees the primary action without scrolling and meets the working demo
 * one thumb-flick later.
 * ============================================================================
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper pt-10 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
      <Atmosphere
        blobs={[
          { className: "top-[-14rem] left-[-10rem] size-[34rem] bg-signal/22", drift: "a" },
          { className: "top-[-6rem] right-[-12rem] size-[30rem] bg-flow/12", drift: "b" },
        ]}
      />

      <div className="page relative">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/70 px-3 py-1.5 text-xs text-ink-600 backdrop-blur-sm">
              <span className="relative grid size-1.5 place-items-center" aria-hidden>
                <span className="absolute size-1.5 rounded-full bg-mint animate-ping-soft" />
                <span className="size-1.5 rounded-full bg-mint" />
              </span>
              <span className="tnum">
                {cities.length} cities with deep student data · {coverageStats.cities} cities
                supported
              </span>
            </p>
          </Reveal>

          <Reveal delay={0.04}>
            <h1 className="mt-5 text-display-xl text-ink-950">
              Your student life abroad,{" "}
              <span className="underline-sketch">figured out</span>.
            </h1>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-600 sm:text-lg">
              Find what to do, what you can afford, where students actually go and who wants to
              join — all personalised around your city, budget, university and interests.
            </p>
          </Reveal>

          <Reveal delay={0.12} className="w-full">
            <div className="mt-7 flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-3">
              <ButtonLink href="/get-started" variant="signal" size="lg">
                Get started free
              </ButtonLink>
              <ButtonLink href="#demo" variant="outline" size="lg">
                Try the live demo
              </ButtonLink>
              <ButtonLink href="/city/madrid" variant="ghost" size="lg">
                Explore your city
              </ButtonLink>
            </div>
            <p className="mt-3.5 text-[0.8125rem] text-ink-400">Free to join. No card required.</p>
          </Reveal>
        </div>

        <Reveal delay={0.16} kind="blur" className="mt-12 sm:mt-14">
          <div id="demo" className="scroll-mt-24">
            <HeroConsole />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
