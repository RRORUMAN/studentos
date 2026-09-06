"use client";

import { motion, useReducedMotion } from "motion/react";
import { Footprints, Search, Users } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/brand/logo";
import { AppSurface } from "@/components/product/app-surface";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { searchComparison } from "@/data/brain";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Side = "traditional" | "studentos";

/**
 * The comparison is about the shape of the question, not about a competitor.
 * A generic search takes four words and returns a list you still have to
 * research. This takes a whole sentence — budget, diet, credibility, distance
 * — and returns something you can act on.
 */
export function AskYourCity() {
  const reduced = useReducedMotion();
  const [side, setSide] = useState<Side>("studentos");

  return (
    <Section id="ask" tone="tint">
      <div className="page">
        <Reveal>
          <Eyebrow index="03">Ask your city</Eyebrow>
          <h2 className="mt-4 max-w-3xl text-display-md text-ink-950">
            Google knows the places.{" "}
            <span className="text-ink-400">
              {brand.name} knows how students actually live there.
            </span>
          </h2>
        </Reveal>

        {/* Mobile switch. On large screens both panels are shown side by side. */}
        <div className="mt-8 lg:hidden">
          <div
            role="tablist"
            aria-label="Compare search"
            className="inline-flex rounded-full border border-ink-200 bg-white p-1"
          >
            {(
              [
                ["traditional", searchComparison.traditional.label],
                ["studentos", searchComparison.studentos.label],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={side === key}
                onClick={() => setSide(key)}
                className={cn(
                  "relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  side === key ? "text-ink-950" : "text-ink-500",
                )}
              >
                {side === key ? (
                  <motion.span
                    layoutId="ask-switch"
                    className="absolute inset-0 rounded-full bg-ink-100"
                    transition={reduced ? { duration: 0 } : { duration: 0.24, ease: ease.out }}
                  />
                ) : null}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:mt-10 lg:grid-cols-2 lg:items-start lg:gap-5">
          <div className={cn(side === "traditional" ? "block" : "hidden", "lg:block")}>
            <TraditionalPanel />
          </div>
          <div className={cn(side === "studentos" ? "block" : "hidden", "lg:block")}>
            <StudentOsPanel />
          </div>
        </div>
      </div>
    </Section>
  );
}

function TraditionalPanel() {
  const { label, query, results, verdict } = searchComparison.traditional;

  return (
    <div className="rounded-xl border border-ink-200 bg-paper-2 p-4 sm:p-5">
      <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">{label}</p>

      <div className="mt-3 flex items-center gap-2.5 rounded-full border border-ink-200 bg-white px-4 py-2.5">
        <Search className="size-4 shrink-0 text-ink-300" aria-hidden />
        <span className="truncate text-[0.9375rem] text-ink-600">{query}</span>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {results.map((result) => (
          <li key={result.name} className="rounded-lg border border-ink-200 bg-white p-3.5">
            <div className="flex items-center gap-3">
              <span aria-hidden className="size-9 shrink-0 rounded-md bg-ink-100" />
              <div className="min-w-0 flex-1">
                <span className="block h-2.5 w-2/3 rounded-full bg-ink-200" aria-hidden />
                <span className="mt-2 block h-2 w-1/3 rounded-full bg-ink-100" aria-hidden />
                <span className="sr-only">{result.name}</span>
              </div>
            </div>
            <p className="mt-2.5 font-mono text-micro tracking-[0.06em] text-ink-400 uppercase">
              {result.meta}
            </p>
            <p className="mt-1.5 text-[0.8125rem] leading-snug text-ink-500">{result.note}</p>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm font-medium text-ink-500">{verdict}</p>
    </div>
  );
}

function StudentOsPanel() {
  const reduced = useReducedMotion();
  const { query, answer } = searchComparison.studentos;

  return (
    <AppSurface
      title={
        <span className="flex items-center gap-2">
          <BrandMark className="size-3.5 text-signal" />
          {brand.name}
        </span>
      }
      meta="One question, all of the constraints"
      bodyClassName="p-0 sm:p-0"
    >
      <div className="border-b border-white/8 px-4 py-3.5 sm:px-5">
        <p className="font-mono text-[0.9375rem] leading-relaxed text-white">{query}</p>
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-[0.9375rem] leading-relaxed text-white/80">{answer.lead}</p>

        <ol className="mt-4 flex flex-col gap-2.5">
          {answer.results.map((result, index) => (
            <motion.li
              key={result.name}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={
                reduced ? { duration: 0 } : { delay: index * 0.08, duration: duration.base, ease: ease.out }
              }
              className={cn(
                "rounded-lg border p-3.5",
                index === 0
                  ? "border-signal/30 bg-signal/[0.07]"
                  : "border-white/10 bg-white/[0.03]",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[0.9375rem] font-medium text-white">{result.name}</p>
                <p className="tnum shrink-0 font-mono text-[0.9375rem] font-medium text-signal">
                  {result.price}
                </p>
              </div>
              <p className="mt-1 text-[0.8125rem] leading-snug text-white/55">{result.note}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                <span className="inline-flex items-center gap-1">
                  <Footprints className="size-3.5" aria-hidden />
                  <span className="tnum">{result.walk}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden />
                  {result.proof}
                </span>
              </div>
            </motion.li>
          ))}
        </ol>

        <p className="mt-4 text-xs leading-relaxed text-white/35">{answer.footnote}</p>
      </div>
    </AppSurface>
  );
}
