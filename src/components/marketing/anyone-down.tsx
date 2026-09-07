"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, MessageSquare, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MascotStill } from "@/components/mascot/mascot";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar, SampleTag, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { getCity } from "@/data/cities";
import { anyoneDownDemo } from "@/data/social";
import { duration, ease, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { track } from "@/services/analytics";

const JOIN_STEP_MS = 700;

/**
 * ============================================================================
 * ANYONE DOWN?
 * ----------------------------------------------------------------------------
 * The hardest problem in a new city is not finding something on. It is finding
 * someone to go with, before you know anyone well enough to ask.
 *
 * So the demo is the mechanism itself, played out: a plan that needs three
 * people, three people arriving, a group, a chat. It is a real state machine
 * with one button, not a video — and under reduced motion the button jumps
 * straight to the finished state rather than animating slowly.
 * ============================================================================
 */
export function AnyoneDown() {
  const reduced = useReducedMotion();
  const city = getCity(anyoneDownDemo.citySlug);
  const total = anyoneDownDemo.need;

  const [joined, setJoined] = useState(0);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  function start() {
    if (running) return;
    track("invite_responded", { planId: "landing-football", response: "join" });

    if (reduced) {
      setJoined(total);
      return;
    }

    setRunning(true);
    setJoined(0);
    for (let step = 1; step <= total; step += 1) {
      const timer = window.setTimeout(() => {
        setJoined(step);
        if (step === total) setRunning(false);
      }, JOIN_STEP_MS * step);
      timers.current.push(timer);
    }
  }

  function reset() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setRunning(false);
    setJoined(0);
  }

  const complete = joined >= total;

  return (
    <Section id="anyone-down" tone="paper">
      <div className="page">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeader
              eyebrow={brand.surfaces.anyoneDown}
              eyebrowIndex="05"
              title="Find something. Find people. Go."
              lead="Turn any event, place or plan into a question your city can answer. People join, a group opens, the chat starts, and the plan is already in it — including what it costs each."
            />

            <ol className="mt-8 flex flex-col gap-3">
              {[
                "Post the plan, not yourself. Nobody has to add anyone as a friend.",
                "Open to your city and campus, so it works in week one.",
                "The group closes after the plan, unless everyone wants it to stay.",
              ].map((line, index) => (
                <li key={line} className="flex gap-3">
                  <span className="tnum mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-pulse-soft font-mono text-[0.6875rem] font-semibold text-pulse-deep">
                    {index + 1}
                  </span>
                  <span className="text-[0.9375rem] leading-relaxed text-ink-600">{line}</span>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/get-started?intent=anyone-down" variant="primary">
                Find people this week
              </ButtonLink>
              <span className="text-[0.8125rem] text-ink-400">Free on every tier.</span>
            </div>
          </div>

          {/* ---- the card ---------------------------------------------------- */}
          <Reveal delay={0.05}>
            <div className="relative mx-auto w-full max-w-[26rem]">
              <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-lift)] ring-1 ring-ink-950/6 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-mono text-micro uppercase tracking-[0.12em] text-pulse-deep">
                      {brand.surfaces.anyoneDown}
                      <SampleTag />
                    </p>
                    <h3 className="mt-1.5 text-display-xs text-ink-950">
                      {anyoneDownDemo.title} in {city?.name ?? "your city"}
                    </h3>
                    <p className="mt-1 text-[0.875rem] text-ink-500">
                      {anyoneDownDemo.when} · {anyoneDownDemo.place}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-mint-soft px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.06em] text-mint-deep uppercase">
                    Free
                  </span>
                </div>

                {/* progress */}
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-[0.875rem] font-medium text-ink-700">
                    {complete ? "Group is full" : `Need ${total - joined} ${total - joined === 1 ? "person" : "people"}`}
                  </p>
                  <p className="tnum font-mono text-xs text-ink-400">
                    {joined} of {total} joined
                  </p>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {Array.from({ length: total }).map((_, slot) => (
                    <motion.span
                      key={slot}
                      animate={{ opacity: slot < joined ? 1 : 0.25 }}
                      transition={{ duration: reduced ? 0 : duration.quick }}
                      className={cn(
                        "h-1.5 flex-1 rounded-full",
                        slot < joined ? "bg-pulse" : "bg-ink-200",
                      )}
                    />
                  ))}
                </div>

                {/* joiners */}
                <ul className="mt-4 flex min-h-[9.5rem] flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {anyoneDownDemo.joiners.slice(0, joined).map((person, index) => (
                      <motion.li
                        key={person.handle}
                        initial={reduced ? false : { opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={reduced ? { duration: 0 } : spring.snappy}
                        className="flex items-center gap-3 rounded-lg bg-paper-2 px-3 py-2"
                      >
                        <Avatar initials={person.initials} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.875rem] font-medium text-ink-900">
                            {person.handle}
                          </span>
                          <span className="block truncate text-xs text-ink-400">
                            {person.campus}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-xs font-medium text-pulse-deep">
                          {index + 1} joined
                        </span>
                      </motion.li>
                    ))}
                  </AnimatePresence>

                  {joined === 0 ? (
                    <li className="flex flex-1 items-center gap-3 rounded-lg border border-dashed border-ink-200 px-3 py-4">
                      <MascotStill state="social" size="sm" />
                      <p className="text-[0.8125rem] leading-snug text-ink-500">
                        Post the plan and your city can answer it. Press the button to watch how.
                      </p>
                    </li>
                  ) : null}
                </ul>

                {/* the payoff */}
                <AnimatePresence initial={false}>
                  {complete ? (
                    <motion.div
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reduced ? { duration: 0 } : { duration: duration.base, ease: ease.out }}
                      className="mt-3 flex flex-col gap-2"
                    >
                      <p className="flex items-center gap-2 rounded-lg bg-mint-soft px-3 py-2 text-[0.875rem] font-medium text-mint-deep">
                        <Check className="size-4 shrink-0" aria-hidden />
                        Group created
                      </p>
                      <p className="flex items-center gap-2 rounded-lg bg-ink-950 px-3 py-2 text-[0.875rem] text-white">
                        <MessageSquare className="size-4 shrink-0 text-signal" aria-hidden />
                        {anyoneDownDemo.firstMessage}
                      </p>
                      <p className="text-xs text-ink-400">
                        Shared plan: {anyoneDownDemo.planLine}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {complete ? (
                    <>
                      <ButtonLink href="/get-started?intent=anyone-down" size="sm" variant="primary">
                        Do this in your city
                      </ButtonLink>
                      <Button size="sm" variant="ghost" onClick={reset}>
                        Replay
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="sticker" onClick={start} disabled={running}>
                      <Users className="size-4" aria-hidden />
                      {running ? "People joining…" : "Anyone down?"}
                    </Button>
                  )}
                  <SampleTag label="Demo control" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
