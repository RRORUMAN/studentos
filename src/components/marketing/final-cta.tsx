import { Mascot } from "@/components/mascot/mascot";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { cities } from "@/data/cities";
import { coverageStats } from "@/config/regions";

/**
 * ============================================================================
 * FINAL CTA
 * ----------------------------------------------------------------------------
 * The second and last full-bleed dark field on the page. One line, the
 * character, one button — everything that could dilute the ask has already
 * been said above it.
 * ============================================================================
 */
export function FinalCta() {
  return (
    <Section tone="dark" className="overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="mesh-blob bottom-[-16rem] left-1/2 size-[38rem] -translate-x-1/2 bg-signal/16" />
      </div>

      <div className="page relative">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <Mascot state="celebrating" size="xl" />
          <h2 className="mt-6 text-display-lg text-white">Your new city, figured out.</h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-white/60 sm:text-lg">
            Set your city, your budget and your university, and the first week is waiting for you.
            It takes four questions.
          </p>

          <div className="mt-8 flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            <ButtonLink href="/get-started" variant="signal" size="lg">
              Get started free
            </ButtonLink>
            <ButtonLink href="/pricing" variant="onDarkGhost" size="lg">
              See pricing
            </ButtonLink>
          </div>

          <p className="mt-4 text-[0.8125rem] text-white/40">Free to join. No card required.</p>
          <p className="tnum mt-6 font-mono text-micro uppercase tracking-[0.12em] text-white/30">
            {cities.length} cities with deep data · {coverageStats.cities} cities ·{" "}
            {coverageStats.countries} countries · {coverageStats.currencies} currencies
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
