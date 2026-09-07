"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Bookmark, Check, Loader2, Share2, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/logo";
import { Mascot } from "@/components/mascot/mascot";
import { AppSurface } from "@/components/product/app-surface";
import { PlanView } from "@/components/product/plan-view";
import { ButtonLink } from "@/components/ui/button";
import { AvatarStack, SampleTag } from "@/components/ui/primitives";
import { brand } from "@/brand/brand.config";
import type { MascotState } from "@/brand/mascot.config";
import { mascotLine } from "@/brand/mascot.config";
import { getCity } from "@/data/cities";
import {
  demoCities,
  demoIntents,
  intentMeta,
  moneyIn,
  planFor,
  type DemoIntent,
} from "@/services/ai/demo-planner";
import { duration, ease, spring } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

type Phase = "typing" | "thinking" | "result";

const TYPE_SPEED_MS = 34;
const THINK_STEP_MS = 380;
const DEFAULT_CITY = "madrid";
const DEFAULT_INTENT: DemoIntent = "tonight";

/**
 * ============================================================================
 * HERO CONSOLE
 * ----------------------------------------------------------------------------
 * The product, running, at the top of the page.
 *
 * The question types itself, the mascot thinks, and the plan assembles row by
 * row — but none of that is a video. Every row is computed by
 * `services/ai/demo-planner.ts` from the selected city's own price anchors, so
 * switching to London reprices the evening in pounds and switching to Berlin
 * drops the transport row because the semester ticket already covers it.
 *
 * There is no network call and no model behind this. The three actions under
 * the plan are links into onboarding: the demo never pretends to save
 * something for a visitor who does not have an account.
 * ============================================================================
 */
export function HeroConsole() {
  const reduced = useReducedMotion();

  const [citySlug, setCitySlug] = useState<string>(DEFAULT_CITY);
  const [intent, setIntent] = useState<DemoIntent>(DEFAULT_INTENT);
  const [phase, setPhase] = useState<Phase>(reduced ? "result" : "typing");
  const [typed, setTyped] = useState("");
  const [thinkStep, setThinkStep] = useState(0);

  const city = getCity(citySlug) ?? getCity(DEFAULT_CITY)!;
  const plan = planFor(citySlug, intent);
  const where = moneyIn(city);
  const query = intentMeta(intent).query(city);

  /* The opening type-out runs once. Any interaction after that swaps the
     question instantly — a visitor who has taken control should never wait for
     a typewriter. */
  const typingDone = useRef(Boolean(reduced));

  useEffect(() => {
    if (typingDone.current) {
      setTyped(query);
      return;
    }
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTyped(query.slice(0, index));
      if (index >= query.length) {
        window.clearInterval(timer);
        typingDone.current = true;
        setThinkStep(0);
        setPhase("thinking");
      }
    }, TYPE_SPEED_MS);
    return () => window.clearInterval(timer);
    /* Deliberately runs once: `query` changes when the visitor picks a city or
       a question, and re-typing under their cursor would be theatre. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Retrieval steps. Nothing enters `thinking` under reduced motion, so there
     is no reduced-motion branch to write here. */
  useEffect(() => {
    if (phase !== "thinking") return;
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      if (step > 2) {
        window.clearInterval(timer);
        setPhase("result");
        return;
      }
      setThinkStep(step);
    }, THINK_STEP_MS);
    return () => window.clearInterval(timer);
  }, [phase]);

  /* Plain function on purpose: wrapping it in useCallback is memoization the
     React Compiler already does, and hand-written memoization here defeats it
     for the whole component. */
  function rerun(nextCity: string, nextIntent: DemoIntent) {
    typingDone.current = true;
    const nextQuery = intentMeta(nextIntent).query(getCity(nextCity) ?? city);
    setCitySlug(nextCity);
    setIntent(nextIntent);
    setTyped(nextQuery);
    setThinkStep(0);
    setPhase(reduced ? "result" : "thinking");
  }

  const busy = phase !== "result";

  const steps = [
    `Reading what students in ${city.name} posted`,
    "Checking official hours, fares and free windows",
    `Fitting it inside ${money(plan.budget, where)}`,
  ];

  const mascotState: MascotState = busy ? "thinking" : plan.over ? "budget" : "happy";
  const mascotSays = busy ? mascotLine("thinking") : plan.over ? mascotLine("budgetTight", 1) : "Tonight fits.";

  return (
    <div className="relative mx-auto w-full max-w-[36rem]">
      <AppSurface
        title={
          <span className="flex items-center gap-2">
            <BrandMark className="size-3.5 text-signal" />
            {brand.name} · {city.name}
          </span>
        }
        meta="Budget aware · sources attached"
        live
        bodyClassName="p-0 sm:p-0"
      >
        {/* ---- city switcher ------------------------------------------------ */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-white/8 px-4 py-2.5 no-scrollbar edge-fade-x sm:px-5">
          {demoCities.map((slug) => {
            const option = getCity(slug);
            if (!option) return null;
            const active = slug === citySlug;
            return (
              <button
                key={slug}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  rerun(slug, intent);
                  track("demo_city_changed", { city: slug });
                }}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[0.8125rem] font-medium transition-colors",
                  active
                    ? "border-transparent bg-white text-ink-950"
                    : "border-white/12 bg-white/4 text-white/60 hover:border-white/25 hover:text-white",
                )}
              >
                {option.name}
              </button>
            );
          })}
        </div>

        {/* ---- the question ------------------------------------------------- */}
        <div className="border-b border-white/8 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 font-mono text-[0.9375rem] break-words text-white">
              {typed}
              {phase === "typing" ? (
                <span
                  aria-hidden
                  className="ml-px inline-block h-4 w-px translate-y-0.5 bg-signal animate-blink"
                />
              ) : null}
            </p>
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-signal text-ink-950"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </span>
          </div>
        </div>

        {/* ---- answer ------------------------------------------------------- */}
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <AnimatePresence mode="wait" initial={false}>
            {busy ? (
              <motion.div
                key="thinking"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: reduced ? 0 : duration.quick }}
                className="flex flex-col gap-2.5 py-2"
                aria-live="polite"
              >
                {steps.map((step, index) => (
                  <div
                    key={step}
                    className={cn(
                      "flex items-center gap-2.5 text-sm transition-colors",
                      index <= thinkStep && phase === "thinking" ? "text-white/70" : "text-white/25",
                    )}
                  >
                    {index < thinkStep && phase === "thinking" ? (
                      <Check className="size-3.5 shrink-0 text-mint" aria-hidden />
                    ) : (
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          index === thinkStep && phase === "thinking" ? "bg-signal" : "bg-white/20",
                        )}
                      />
                    )}
                    {step}
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={plan.id}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
              >
                <PlanView plan={plan} animate={!reduced} where={where} />

                {plan.interestedCount > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <AvatarStack people={plan.people} size="xs" onDark />
                    <p className="text-[0.8125rem] text-white/55">
                      <span className="tnum font-medium text-white">
                        {plan.interestedCount} students
                      </span>{" "}
                      interested ·{" "}
                      <span className="tnum font-medium text-white">{plan.sameUniversity}</span> from
                      your university
                    </p>
                    <SampleTag onDark label="Sample counts" />
                  </div>
                ) : null}

                {/* Three real destinations. Nothing here claims to have saved
                    anything for a visitor with no account. */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink
                    href="/get-started?intent=plan"
                    size="sm"
                    variant="onDark"
                    onClick={() => track("cta_clicked", { location: "hero-save-plan" })}
                  >
                    <Bookmark className="size-4" aria-hidden />
                    Save plan
                  </ButtonLink>
                  <ButtonLink
                    href="/get-started?intent=anyone-down"
                    size="sm"
                    variant="onDarkGhost"
                    onClick={() => track("cta_clicked", { location: "hero-anyone-down" })}
                  >
                    <UsersRound className="size-4" aria-hidden />
                    {brand.surfaces.anyoneDown}
                  </ButtonLink>
                  <ButtonLink
                    href="/get-started?intent=share"
                    size="sm"
                    variant="onDarkGhost"
                    onClick={() => track("cta_clicked", { location: "hero-share" })}
                  >
                    <Share2 className="size-4" aria-hidden />
                    Share
                  </ButtonLink>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---- other questions ---------------------------------------------- */}
        <div className="border-t border-white/8 px-4 py-3 sm:px-5">
          <p className="mb-2 font-mono text-micro uppercase tracking-[0.12em] text-white/35">
            Try another question
          </p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar edge-fade-x">
            {demoIntents.map((option) => {
              const active = option.key === intent && phase === "result";
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    rerun(citySlug, option.key);
                    track("demo_intent_changed", { intent: option.key });
                  }}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors",
                    active
                      ? "border-signal/40 bg-signal/15 text-signal"
                      : "border-white/12 bg-white/4 text-white/60 hover:border-white/25 hover:text-white",
                  )}
                >
                  {option.label(city)}
                </button>
              );
            })}
          </div>
        </div>
      </AppSurface>

      {/* The mascot sits in normal flow under the console rather than floated
          over its corner: floated, his bubble lands on the question chips at
          every width below xl, and a mascot that covers a tap target is a bug. */}
      <div className="mt-4 flex items-center gap-3">
        <Mascot state={mascotState} size="md" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={mascotSays}
            initial={reduced ? false : { opacity: 0, x: -8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: 4 }}
            transition={reduced ? { duration: 0 } : spring.snappy}
            className="relative rounded-2xl bg-white px-3.5 py-2 text-[0.8125rem] font-medium text-ink-800 shadow-[var(--shadow-float)] ring-1 ring-ink-950/6"
          >
            <span
              aria-hidden
              className="absolute top-1/2 -left-1 size-2.5 -translate-y-1/2 rotate-45 bg-white"
            />
            {mascotSays}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
