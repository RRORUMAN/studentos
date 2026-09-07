"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, MapPin, Sparkles, UsersRound, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { MascotStill } from "@/components/mascot/mascot";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, SampleTag, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { askAnswer, askQueries, moneyIn, type AskAnswerKind } from "@/services/ai/demo-planner";
import { getCity } from "@/data/cities";
import { duration, ease } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

const ROTATE_MS = 5200;
const CITY = "berlin";

const KIND_ICON: Record<AskAnswerKind, LucideIcon> = {
  plan: Sparkles,
  budget: Wallet,
  place: MapPin,
  event: CalendarDays,
  people: UsersRound,
  tasks: CalendarDays,
};

/**
 * ============================================================================
 * ASK STUDENTOS — the one dark section in the middle of the page
 * ----------------------------------------------------------------------------
 * The point being made here is a shape, not a capability: a question comes
 * back as *rows* — priced, sourced, with a budget consequence attached — and
 * never as four paragraphs of chat. So the answer panel is built from the same
 * card vocabulary the product uses, and the longest piece of prose in it is
 * one line.
 *
 * The queries rotate on their own until someone picks one, then they stop:
 * a carousel that keeps moving under a reader's cursor is a carousel nobody
 * finishes reading. Under reduced motion nothing rotates at all.
 * ============================================================================
 */
export function AskSection() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (reduced || held) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % askQueries.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [reduced, held]);

  const city = getCity(CITY);
  const where = city ? moneyIn(city) : undefined;
  const query = askQueries[index];
  const answer = askAnswer(query, CITY);
  const Icon = KIND_ICON[answer.kind];

  return (
    <Section id="ask" tone="dark" className="overflow-hidden">
      {/* One wash of signal behind the panel, so the dark section has depth
          without becoming a gradient. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="mesh-blob top-[-18rem] left-1/2 size-[42rem] -translate-x-1/2 bg-signal/12" />
        <div className="absolute inset-0 text-white/[0.05] gridline [mask-image:radial-gradient(90%_70%_at_50%_0%,black,transparent_75%)]" />
      </div>

      <div className="page relative">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
          <div>
            <Eyebrow index="03" onDark>
              Ask {brand.name}
            </Eyebrow>
            <h2 className="mt-4 text-display-md text-white">Ask your student life anything.</h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/60 sm:text-lg">
              Not a chatbot with opinions. A command centre over real rows: places, events, deals,
              your budget, your week, your people — and an answer you can act on in one tap.
            </p>

            <ul className="mt-8 flex flex-col gap-1.5" role="list">
              {askQueries.map((candidate, candidateIndex) => {
                const active = candidateIndex === index;
                return (
                  <li key={candidate}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setIndex(candidateIndex);
                        setHeld(true);
                        track("demo_tab_changed", { query: candidate });
                      }}
                      className={cn(
                        "w-full rounded-lg border px-3.5 py-2.5 text-left font-mono text-[0.8125rem] transition-colors sm:text-sm",
                        active
                          ? "border-signal/40 bg-signal/12 text-signal"
                          : "border-white/10 bg-white/4 text-white/55 hover:border-white/25 hover:text-white",
                      )}
                    >
                      {candidate}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ---- the answer ------------------------------------------------- */}
          <Reveal delay={0.05}>
            <div className="relative rounded-2xl bg-paper p-5 text-ink-900 shadow-[var(--shadow-lift)] sm:p-6">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-signal text-ink-950">
                  <Icon className="size-4" aria-hidden />
                </span>
                <p className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-ink-500">
                  {answer.query}
                </p>
                <SampleTag />
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={answer.query}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
                >
                  <p className="mt-4 text-display-xs text-ink-950">{answer.lead}</p>

                  <ul className="mt-4 flex flex-col">
                    {answer.rows.map((row, rowIndex) => (
                      <motion.li
                        key={`${row.label}-${rowIndex}`}
                        initial={reduced ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          reduced
                            ? { duration: 0 }
                            : { delay: 0.05 * rowIndex, duration: duration.base, ease: ease.out }
                        }
                        className="flex items-baseline gap-3 border-b border-ink-100 py-2.5 last:border-b-0"
                      >
                        {row.meta ? (
                          <span className="tnum w-16 shrink-0 font-mono text-xs text-ink-400">
                            {row.meta}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.9375rem] font-medium text-ink-950">
                            {row.label}
                          </span>
                          {row.detail ? (
                            <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-500">
                              {row.detail}
                            </span>
                          ) : null}
                        </span>
                        {row.price !== null && row.price !== undefined ? (
                          <span
                            className={cn(
                              "tnum shrink-0 font-mono text-[0.9375rem] font-medium",
                              row.price === 0 ? "text-mint-deep" : "text-ink-950",
                            )}
                          >
                            {row.price === 0 ? "Free" : money(row.price, where)}
                          </span>
                        ) : null}
                      </motion.li>
                    ))}
                  </ul>

                  {answer.budgetLine ? (
                    <p className="mt-4 rounded-lg bg-flow-soft px-3.5 py-2.5 text-[0.875rem] leading-relaxed text-flow-deep">
                      {answer.budgetLine}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-ink-400">Sources: {answer.sources}</p>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 shadow-[var(--shadow-flat)]">
                      <MascotStill state="happy" size="xs" />
                      <span className="text-xs font-medium text-ink-700">{answer.mascotSays}</span>
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <ButtonLink href="/get-started?intent=ask" variant="signal">
                Ask your own question
              </ButtonLink>
              <span className="text-[0.8125rem] text-white/45">
                Free tier includes smart asks every week.
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
