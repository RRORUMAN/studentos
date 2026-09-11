import { Mascot } from "@/components/mascot/mascot";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { coverageStats } from "@/config/regions";

/**
 * ============================================================================
 * FINAL CTA
 * ----------------------------------------------------------------------------
 * The second and last full-bleed dark field on the page. The ask on the left;
 * on the right, exactly what happens after the button — the four questions
 * onboarding asks, in the order `onboarding-flow.tsx` asks them, ending in the
 * first screen a student sees. Showing the steps is what makes "four
 * questions" a fact rather than a slogan.
 *
 * The strip at the bottom deliberately does not count interface languages:
 * the language setting changes how prices and dates are formatted, and there
 * is no translation layer behind it, so "16 languages" would be a lie.
 * ============================================================================
 */

const STEPS = [
  "Where you're studying",
  "Which university",
  "What you live on each month",
  "What you want more of",
];

export function FinalCta() {
  return (
    <Section tone="dark" className="overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="mesh-blob bottom-[-18rem] left-[30%] size-[40rem] bg-signal/14" />
        <div className="absolute inset-0 text-white/[0.04] gridline [mask-image:radial-gradient(80%_70%_at_30%_100%,black,transparent_75%)]" />
      </div>

      <div className="page relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
          <Reveal className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <Mascot state="celebrating" size="lg" />
            <h2 className="mt-6 text-display-xl text-white">New city. Less guessing.</h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-white/60 sm:text-lg">
              Answer four questions and your first week is waiting — priced in your currency, built
              around your campus.
            </p>

            <div className="mt-8 flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center">
              <ButtonLink href="/get-started" variant="signal" size="lg">
                Get started free
              </ButtonLink>
              <ButtonLink href="/pricing" variant="onDarkGhost" size="lg">
                See pricing
              </ButtonLink>
            </div>
            <p className="mt-4 text-[0.8125rem] text-white/45">Free to join. No card required.</p>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 sm:p-6">
              <p className="font-mono text-micro tracking-[0.14em] text-white/45 uppercase">
                What happens next
              </p>
              <ol className="mt-4 flex flex-col">
                {STEPS.map((step, index) => (
                  <li key={step} className="flex items-center gap-3.5 border-b border-white/8 py-3">
                    <span className="tnum grid size-7 shrink-0 place-items-center rounded-full bg-white/8 font-mono text-xs font-semibold text-white/75">
                      {index + 1}
                    </span>
                    <span className="text-[0.9375rem] font-medium text-white">{step}</span>
                  </li>
                ))}
                <li className="flex items-center gap-3.5 pt-3">
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-signal font-mono text-xs font-semibold text-ink-950"
                  >
                    →
                  </span>
                  <span className="text-[0.9375rem] font-semibold text-signal">
                    Your Today screen, ready
                  </span>
                </li>
              </ol>
            </div>
          </Reveal>
        </div>

        <p className="tnum mt-14 text-center font-mono text-micro tracking-[0.12em] text-white/35 uppercase">
          {coverageStats.cities} cities · {coverageStats.countries} countries ·{" "}
          {coverageStats.currencies} currencies
        </p>
      </div>
    </Section>
  );
}
