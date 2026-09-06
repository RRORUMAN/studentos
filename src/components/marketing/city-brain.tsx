"use client";

import { motion, useReducedMotion } from "motion/react";
import { Info } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/brand/logo";
import { MascotArt } from "@/components/mascot/mascot-art";
import { accents } from "@/components/ui/accent";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { brainInputs, brainOutputs } from "@/data/brain";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * AI CITY BRAIN
 * ----------------------------------------------------------------------------
 * An explanation, not a mood board. Six named inputs, each with its
 * provenance, feeding five concrete answers. Select an input and the answers
 * that depend on it stay lit while the rest fade — which makes the mechanism
 * legible instead of mystical.
 *
 * The rule the section is built to communicate: the model chooses and
 * explains, it does not invent facts. Prices, hours and fares arrive as
 * retrieved, sourced context.
 * ============================================================================
 */
export function CityBrain() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  const activeInput = brainInputs.find((input) => input.key === active) ?? null;

  return (
    <Section id="city-brain" tone="paper">
      <div className="page">
        <Reveal>
          <Eyebrow index="04">{brand.surfaces.brain}</Eyebrow>
          <h2 className="mt-4 max-w-3xl text-display-md text-ink-950">
            Six inputs. One answer you can actually act on.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-600">
            Nothing here is magic. Student knowledge and local data are retrieved first, with their
            sources attached. The model&rsquo;s job is to choose, order and explain — never to
            invent a price or an opening time.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] lg:gap-0">
          {/* ---- inputs ---------------------------------------------------- */}
          <Reveal className="lg:pr-2">
            <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
              What goes in
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {brainInputs.map((input) => {
                const Icon = input.icon;
                const accent = accents[input.accent];
                const isActive = active === input.key;
                const dimmed = Boolean(active) && !isActive;

                return (
                  <li key={input.key}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActive(isActive ? null : input.key)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200",
                        isActive
                          ? "border-ink-950 bg-white shadow-[var(--shadow-raise)]"
                          : "border-ink-200 bg-paper hover:border-ink-300 hover:bg-white",
                        dimmed && "opacity-45",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-md",
                          accent.soft,
                          accent.text,
                        )}
                      >
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.9375rem] font-medium text-ink-950">
                          {input.label}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-400">
                          {input.provenance}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* detail */}
            <motion.div
              key={activeInput?.key ?? "default"}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
              className="mt-4 rounded-lg border border-ink-200 bg-white p-4"
            >
              {activeInput ? (
                <>
                  <p className="text-sm leading-relaxed text-ink-700">{activeInput.detail}</p>
                  <p className="mt-3 flex gap-2 text-[0.8125rem] leading-relaxed text-ink-500">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-ink-300" aria-hidden />
                    <span>
                      <span className="font-medium text-ink-700">Without it: </span>
                      {activeInput.withoutIt}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-ink-500">
                  Pick an input to see what it contributes, where it comes from, and what the
                  answer loses without it.
                </p>
              )}
            </motion.div>
          </Reveal>

          {/* ---- connector --------------------------------------------------
              Six signals converging on one point, with the mascot sitting at
              that point.

              He is standing in for the model deliberately, and the section is
              built so that reads as a friendly shorthand rather than a claim:
              every line is labelled with its provenance, the output panel
              prints attributions, and the copy says outright that the model
              chooses and explains but never invents. A brain graphic here
              would say "magic"; a student who has read everything says what
              the product actually does. */}
          <div className="relative hidden lg:block" aria-hidden>
            <svg
              className="absolute inset-0 size-full text-ink-300"
              viewBox="0 0 56 400"
              preserveAspectRatio="none"
              fill="none"
            >
              {[40, 108, 176, 244, 312, 380].map((y, index) => (
                <motion.path
                  key={y}
                  d={`M0 ${y} C 28 ${y}, 28 200, 56 200`}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeOpacity={active && brainInputs[index]?.key !== active ? 0.15 : 0.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <span className="grid size-14 place-items-center rounded-full bg-paper ring-1 ring-ink-200">
                <MascotArt
                  state={active ? "thinking" : "neutral"}
                  className="size-12 translate-y-[6%]"
                />
              </span>
            </div>
          </div>

          {/* ---- output ------------------------------------------------------ */}
          <Reveal delay={0.05} className="lg:pl-2">
            <div className="overflow-hidden rounded-xl bg-ink-950 text-white" data-surface="dark">
              <div className="flex items-center gap-2.5 border-b border-white/8 px-4 py-3.5 sm:px-5">
                <BrandMark className="size-4 text-signal" />
                <p className="font-mono text-micro uppercase tracking-[0.14em] text-white/70">
                  Your {brand.name}
                </p>
              </div>

              <ul className="flex flex-col divide-y divide-white/8">
                {brainOutputs.map((output) => {
                  const dimmed = Boolean(active) && !output.uses.includes(active as string);
                  return (
                    <motion.li
                      key={output.key}
                      animate={{ opacity: dimmed ? 0.3 : 1 }}
                      transition={{ duration: reduced ? 0 : duration.quick }}
                      className="px-4 py-4 sm:px-5"
                    >
                      <p className="text-[0.9375rem] font-semibold text-white">{output.question}</p>
                      <p className="mt-1.5 text-[0.875rem] leading-relaxed text-white/60">
                        {output.answer}
                      </p>
                      <p className="mt-2 font-mono text-micro tracking-[0.06em] text-white/35 uppercase">
                        {output.attribution}
                      </p>
                    </motion.li>
                  );
                })}
              </ul>
            </div>

            <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-400">
              Factual claims — hours, fares, free windows, published prices — are retrieved from
              official or venue sources and shown with that attribution. Judgement calls are
              attributed to the students who made them.
            </p>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
