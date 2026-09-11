import { Check } from "lucide-react";

import { BrandMark } from "@/components/brand/logo";
import { MascotStill } from "@/components/mascot/mascot";
import { Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { trustPoints } from "@/data/brain";

/**
 * ============================================================================
 * TRUST
 * ----------------------------------------------------------------------------
 * A product that tells students what things cost is only as good as its worst
 * number, so the trust argument here is not "we care about privacy". It is the
 * list of rules the product is built on, printed as a receipt — itemised, and
 * totalling zero invented numbers.
 *
 * Every rule on the receipt is enforced in code, not just stated:
 *   - sourced or absent, the distance/duration split and "prices come from
 *     students" are the four places rules pinned by `tests/unit/places.test.ts`
 *   - "pay not stated" is `Opportunity.pay: Pay | null` in the Work types
 *   - official items carry the primary-source link in `data/arrival.ts`
 *   - "samples say sample" is the `SampleTag` on every demo on this page
 *
 * If one of those stops being true, this receipt is the thing to change first.
 *
 * The data commitments sit beside it as a plain list — the same five points
 * the old trust strip carried, promoted from a footnote to half a section.
 * ============================================================================
 */

const RULES = [
  {
    rule: "A place is sourced or absent",
    tag: "Source",
    detail: "Every place carries its provider and a link back. No source, no listing.",
  },
  {
    rule: "Prices come from students",
    tag: "3+ reports",
    detail: "An amount is the median of at least three real reports — never an estimate dressed up.",
  },
  {
    rule: "A distance is not a duration",
    tag: "Measured",
    detail: "A straight line says “600 m away”. Only a real route gets to say “8 min walk”.",
  },
  {
    rule: "Unstated pay stays unstated",
    tag: "No guesses",
    detail: "A job that doesn't say what it pays reads “pay not stated”. Nothing infers a wage.",
  },
  {
    rule: "Official means linked",
    tag: "Primary source",
    detail: "Visas, registration and fares link to the authority that decides them.",
  },
  {
    rule: "Samples say sample",
    tag: "Labelled",
    detail: "Every demo on this page is marked. So is any seeded content in the app.",
  },
];

export function TrustSection() {
  return (
    <Section id="trust" tone="warm">
      <div className="page">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          {/* ---- the receipt ------------------------------------------------- */}
          <Reveal className="order-2 lg:order-1">
            <div className="mx-auto w-full max-w-[30rem] [filter:drop-shadow(0_24px_32px_rgb(10_10_16/0.12))] lg:-rotate-1">
              <div className="rounded-t-2xl bg-white px-5 pt-6 pb-5 font-mono sm:px-7">
                <div className="flex items-center justify-between">
                  <BrandMark className="size-5 text-ink-950" />
                  <span className="text-micro tracking-[0.14em] text-ink-500 uppercase">
                    House rules
                  </span>
                </div>
                <p className="mt-4 text-center text-micro tracking-[0.24em] text-ink-500 uppercase">
                  — {brand.name} —
                </p>

                <ul className="mt-4 flex flex-col gap-4 border-y border-dashed border-ink-300 py-5">
                  {RULES.map((entry) => (
                    <li key={entry.rule}>
                      <div className="flex items-baseline gap-2 text-[0.8125rem] font-semibold text-ink-950">
                        <Check className="size-3.5 shrink-0 translate-y-0.5 text-mint-deep" aria-hidden />
                        <span>{entry.rule}</span>
                        <span
                          aria-hidden
                          className="hidden h-px min-w-3 flex-1 border-b border-dotted border-ink-300 sm:block"
                        />
                        <span className="hidden shrink-0 text-[0.625rem] tracking-[0.08em] text-ink-500 uppercase sm:block">
                          {entry.tag}
                        </span>
                      </div>
                      <p className="mt-1 pl-5.5 font-sans text-[0.8125rem] leading-snug text-ink-600">
                        {entry.detail}
                      </p>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-baseline justify-between gap-3 text-ink-950">
                  <span className="text-[0.8125rem] font-semibold tracking-[0.1em] uppercase">
                    Numbers made up
                  </span>
                  <span className="tnum text-[2rem] leading-none font-semibold">0</span>
                </div>
                <p className="mt-4 text-center text-micro tracking-[0.2em] text-ink-400 uppercase">
                  Thanks for checking
                </p>
              </div>
              <div aria-hidden className="h-3 receipt-edge" />
            </div>
          </Reveal>

          {/* ---- the argument ------------------------------------------------ */}
          <div className="order-1 lg:order-2">
            <SectionHeader
              eyebrow="Trust"
              eyebrowIndex="08"
              title="Nothing here is made up."
              lead="You act on what StudentOS tells you — a price, a free night, a deadline. So every number is sourced, reported by students, or labelled as an estimate. These are the rules, and the product is built to keep them."
            />

            <p className="mt-9 font-mono text-micro tracking-[0.12em] text-ink-500 uppercase">
              What we won&rsquo;t do with your data
            </p>
            <ul className="mt-3 flex flex-col divide-y divide-ink-200">
              {trustPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.label} className="flex gap-3.5 py-3.5">
                    <Icon className="mt-0.5 size-5 shrink-0 text-ink-500" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[0.9375rem] font-semibold text-ink-950">
                        {point.label}
                      </span>
                      <span className="mt-0.5 block text-[0.875rem] leading-snug text-ink-600">
                        {point.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 flex items-center gap-3">
              <MascotStill state="focus" size="sm" />
              <p className="text-[0.875rem] text-ink-600">
                When we don&rsquo;t know, the app says so.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
