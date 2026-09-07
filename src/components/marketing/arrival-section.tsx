"use client";

import { motion, useReducedMotion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { MascotStill } from "@/components/mascot/mascot";
import { ButtonLink } from "@/components/ui/button";
import { SampleTag, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { arrivalStages, legalDisclaimer, type ArrivalStageKey } from "@/data/arrival";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * ARRIVAL MODE
 * ----------------------------------------------------------------------------
 * The first two weeks, in the order things actually block each other: you
 * cannot open some bank accounts without an address, cannot register without
 * an appointment booked weeks ago, and cannot do either while jet-lagged on
 * day one.
 *
 * Anything touching immigration, residency or a fare is marked and links to
 * the primary source in the product. The site is never the authority on a
 * legal requirement, and the note under the tabs says so.
 * ============================================================================
 */
export function ArrivalSection() {
  const reduced = useReducedMotion();
  const [stageKey, setStageKey] = useState<ArrivalStageKey>("first-day");

  const stage = arrivalStages.find((entry) => entry.key === stageKey) ?? arrivalStages[0];

  return (
    <Section id="arrival" tone="paper">
      <div className="page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-14">
          <div>
            <SectionHeader
              eyebrow={brand.surfaces.arrival}
              eyebrowIndex="11"
              title="Just landed? Start here."
              lead="A personal relocation assistant for the two weeks nobody prepares you for — sequenced so the thing that takes three weeks to book is the thing you do first."
            />

            <div className="mt-7 flex items-start gap-3 rounded-xl bg-paper-2 p-4">
              <MascotStill state="arrival" size="md" accessory="backpack" className="shrink-0" />
              <p className="text-[0.9375rem] leading-relaxed text-ink-600">
                Set your city and your start date before you fly, and the list is waiting when you
                land — priced in the local currency.
              </p>
            </div>

            <ButtonLink href="/get-started?intent=arrival" variant="primary" className="mt-6">
              Plan my arrival
            </ButtonLink>
          </div>

          <Reveal delay={0.05}>
            <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5 sm:p-6">
              {/* stage tabs */}
              <div
                className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar edge-fade-x"
                role="tablist"
                aria-label="Arrival stages"
              >
                {arrivalStages.map((entry) => {
                  const active = entry.key === stageKey;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setStageKey(entry.key);
                        track("demo_tab_changed", { stage: entry.key });
                      }}
                      className={cn(
                        "shrink-0 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
                        active
                          ? "border-transparent bg-amber text-ink-950"
                          : "border-ink-200 text-ink-600 hover:border-ink-300 hover:text-ink-950",
                      )}
                    >
                      {entry.label}
                    </button>
                  );
                })}
              </div>

              <motion.div
                key={stage.key}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
              >
                <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-display-xs text-ink-950">{stage.tagline}</h3>
                  <SampleTag />
                </div>

                <ol className="mt-4 flex flex-col">
                  {stage.tasks.map((task, index) => (
                    <li
                      key={task.label}
                      className="flex gap-3 border-b border-ink-100 py-3 last:border-b-0"
                    >
                      <span className="tnum mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-paper-2 font-mono text-[0.6875rem] font-semibold text-ink-600">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-[0.9375rem] font-medium text-ink-950">
                            {task.label}
                          </span>
                          {task.official ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-flow-soft px-2 py-0.5 text-[0.6875rem] font-medium text-flow-deep">
                              <ExternalLink className="size-3" aria-hidden />
                              Official source
                            </span>
                          ) : null}
                          {task.cost ? (
                            <span className="tnum font-mono text-xs text-ink-500">{task.cost}</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[0.875rem] leading-snug text-ink-600">
                          {task.detail}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </motion.div>

              <p className="mt-5 border-t border-ink-100 pt-4 text-xs leading-relaxed text-ink-400">
                {legalDisclaimer}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
