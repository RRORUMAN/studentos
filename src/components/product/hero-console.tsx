"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  Check,
  CornerDownLeft,
  Hand,
  Loader2,
  Share2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/logo";
import { Mascot } from "@/components/mascot/mascot";
import { AppSurface } from "@/components/product/app-surface";
import { PlanView } from "@/components/product/plan-view";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar, AvatarStack } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { brand } from "@/brand/brand.config";
import { mascotLine } from "@/brand/mascot.config";
import type { MascotState } from "@/brand/mascot.config";
import { defaultCity } from "@/data/cities";
import { defaultPlan, heroPlans, planTotal } from "@/data/plans";
import { loopSummaries } from "@/data/loop";
import { nearbyInterested } from "@/data/social";
import type { Plan } from "@/data/types";
import { useCopy } from "@/hooks/use-copy";
import { duration, ease, spring } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

type Phase = "typing" | "thinking" | "result" | "empty";
type View = "plan" | "group";

const TYPE_SPEED_MS = 42;
const THINK_STEP_MS = 420;

/**
 * ============================================================================
 * HERO CONSOLE
 * ----------------------------------------------------------------------------
 * The product, running, at the top of the page. It is a real form with real
 * state, not a video: the visitor can pick a different question, save the
 * result, turn it into a group or copy it.
 *
 * Answers come from the seeded set (see services/ai/provider.ts). The site
 * never calls a model or a billed maps API for an anonymous visitor, and the
 * surface says so with the sample marker rather than pretending otherwise.
 * ============================================================================
 */
export function HeroConsole() {
  const reduced = useReducedMotion();
  const toast = useToast();
  const { copy } = useCopy();

  const [value, setValue] = useState(reduced ? defaultPlan.query : "");
  const [phase, setPhase] = useState<Phase>(reduced ? "result" : "typing");
  const [plan, setPlan] = useState<Plan>(defaultPlan);
  const [view, setView] = useState<View>("plan");
  const [thinkStep, setThinkStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [joined, setJoined] = useState(false);

  const typingCancelled = useRef(reduced);

  /* ---- opening type-out ------------------------------------------------- */
  useEffect(() => {
    if (typingCancelled.current) return;
    const target = defaultPlan.query;
    let index = 0;
    const timer = window.setInterval(() => {
      if (typingCancelled.current) {
        window.clearInterval(timer);
        return;
      }
      index += 1;
      setValue(target.slice(0, index));
      if (index >= target.length) {
        window.clearInterval(timer);
        setThinkStep(0);
        setPhase("thinking");
      }
    }, TYPE_SPEED_MS);
    return () => window.clearInterval(timer);
  }, []);

  /* ---- retrieval steps --------------------------------------------------- */
  useEffect(() => {
    /* Under reduced motion nothing ever enters `thinking` — `run` resolves
       straight to `result` — so the effect has no reduced-motion branch to
       write. Setting state from an effect body to undo a state we should not
       have entered is a cascading render; not entering it is the fix. */
    if (phase !== "thinking" || reduced) return;

    /* The step counter lives in the closure, not in state, so the effect body
       writes no state at all: the only setState calls happen from the interval
       callback. `thinkStep` is reset to 0 by whoever enters the phase. */
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
  }, [phase, reduced]);

  const run = useCallback(
    (query: string) => {
      typingCancelled.current = true;
      const match = heroPlans.find(
        (candidate) => candidate.query.toLowerCase() === query.trim().toLowerCase(),
      );

      setValue(query);
      setView("plan");
      setSaved(false);
      setJoined(false);

      if (!match) {
        setPhase("empty");
        return;
      }

      setPlan(match);
      setThinkStep(0);
      setPhase(reduced ? "result" : "thinking");
      track("hero_query_run", { query: match.query, planId: match.id });
    },
    [reduced],
  );

  const steps = [
    `Reading ${loopSummaries[defaultCity.slug]?.sourceCount ?? 0} posts from ${defaultCity.name} students`,
    "Checking official hours, fares and free windows",
    plan.budget
      ? `Fitting it inside ${money(plan.budget)}`
      : "Ranking by walking time and student value",
  ];

  const busy = phase === "typing" || phase === "thinking";

  /* The mascot is driven by the console rather than decorating it. He is the
     visible form of "the AI is working / the AI found something", which is a
     job a spinner does badly and a face does instantly.

     Under budget is the only case that earns the excited face: a plan that
     comes in over the number is a correct answer too, and celebrating it would
     make him a cheerleader instead of a student who watches what things cost. */
  const underBudget =
    plan.budget !== undefined && planTotal(plan) <= plan.budget;

  const mascotState: MascotState = busy
    ? "thinking"
    : phase === "empty"
      ? "empty"
      : view === "group"
        ? "social"
        : underBudget
          ? "excited"
          : "neutral";

  const mascotSays = busy
    ? mascotLine("thinking")
    : phase === "empty"
      ? mascotLine("empty")
      : view === "group"
        ? mascotLine("social", 1)
        : underBudget && plan.budget
          ? `${money(plan.budget - planTotal(plan))} left. Not bad.`
          : mascotLine("found", 1);

  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <AppSurface
      title={
        <span className="flex items-center gap-2">
          <BrandMark className="size-3.5 text-signal" />
          {defaultCity.name} · {brand.name}
        </span>
      }
      meta="Tonight · budget aware · 3 sources"
      live
      className="w-full"
      bodyClassName="p-0 sm:p-0"
    >
      {/* ---- command input ------------------------------------------------ */}
      <form
        className="border-b border-white/8 px-4 py-3.5 sm:px-5"
        onSubmit={(event) => {
          event.preventDefault();
          run(value);
        }}
      >
        <label htmlFor="hero-query" className="sr-only">
          Ask {brand.name} about your city
        </label>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              id="hero-query"
              value={value}
              onChange={(event) => {
                typingCancelled.current = true;
                setValue(event.target.value);
              }}
              placeholder="Ask anything about your city"
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "w-full bg-transparent pr-6 font-mono text-[0.9375rem] text-white",
                "placeholder:text-white/30 focus:outline-none",
              )}
            />
            {phase === "typing" ? (
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 h-4.5 w-px -translate-y-1/2 bg-signal animate-blink"
                style={{ left: `calc(${value.length}ch + 1px)` }}
              />
            ) : null}
          </div>
          <Button
            type="submit"
            size="icon"
            variant="signal"
            className="size-9"
            disabled={busy || value.trim().length === 0}
            aria-label="Run this question"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="size-4" aria-hidden />
            )}
          </Button>
        </div>
      </form>

      {/* ---- body --------------------------------------------------------- */}
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
                    index <= thinkStep && phase === "thinking"
                      ? "text-white/70"
                      : "text-white/25",
                  )}
                >
                  {index < thinkStep && phase === "thinking" ? (
                    <Check className="size-3.5 shrink-0 text-mint" aria-hidden />
                  ) : (
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        index === thinkStep && phase === "thinking"
                          ? "bg-signal"
                          : "bg-white/20",
                      )}
                      aria-hidden
                    />
                  )}
                  {step}
                </div>
              ))}
            </motion.div>
          ) : phase === "empty" ? (
            <motion.div
              key="empty"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
              className="py-2"
            >
              <p className="text-[0.9375rem] font-medium text-white">
                This demo answers from a fixed set of questions.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/55">
                The real thing answers whatever you ask, using your city, your location and your
                budget. Try one of these, or build your own {brand.name}.
              </p>
              <ButtonLink
                href="/get-started"
                variant="signal"
                size="sm"
                className="mt-4"
                onClick={() => track("cta_clicked", { location: "hero-empty-state" })}
              >
                Build my {brand.name}
              </ButtonLink>
            </motion.div>
          ) : view === "group" ? (
            <GroupView
              key="group"
              plan={plan}
              joined={joined}
              onBack={() => setView("plan")}
            />
          ) : (
            <motion.div
              key={plan.id}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
            >
              <PlanView plan={plan} animate={!reduced} />

              {plan.interested > 0 ? (
                <div className="mt-4 flex items-center gap-3">
                  <AvatarStack people={nearbyInterested.slice(0, plan.interested)} size="xs" onDark />
                  <p className="text-[0.8125rem] text-white/55">
                    <span className="tnum font-medium text-white">{plan.interested} students</span>{" "}
                    nearby are interested.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={saved ? "onDarkGhost" : "onDark"}
                  onClick={() => {
                    setSaved((current) => !current);
                    track("plan_saved", { planId: plan.id, saved: !saved });
                    toast({
                      title: saved ? "Plan removed" : "Plan saved",
                      description: saved
                        ? undefined
                        : `${plan.title} is in your saved plans.`,
                    });
                  }}
                  aria-pressed={saved}
                >
                  {saved ? (
                    <BookmarkCheck className="size-4" aria-hidden />
                  ) : (
                    <Bookmark className="size-4" aria-hidden />
                  )}
                  {saved ? "Saved" : "Save plan"}
                </Button>

                <Button
                  size="sm"
                  variant="onDarkGhost"
                  onClick={() => {
                    setView("group");
                    setJoined(true);
                    track("invite_responded", { planId: plan.id, response: "host" });
                  }}
                >
                  <Hand className="size-4" aria-hidden />
                  {brand.surfaces.anyoneDown}
                </Button>

                <Button
                  size="sm"
                  variant="onDarkGhost"
                  onClick={async () => {
                    const text = `${plan.title} — ${money(planTotal(plan))} in ${defaultCity.name}. Built with ${brand.name}: ${brand.url}`;
                    const ok = await copy(text);
                    track("plan_shared", { planId: plan.id, method: "clipboard" });
                    toast({
                      title: ok ? "Plan copied" : "Could not copy",
                      description: ok
                        ? "Paste it into any chat."
                        : "Your browser blocked clipboard access.",
                      tone: ok ? "success" : "warning",
                    });
                  }}
                >
                  <Share2 className="size-4" aria-hidden />
                  Share
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- suggestions -------------------------------------------------- */}
      <div className="border-t border-white/8 px-4 py-3 sm:px-5">
        <p className="mb-2 font-mono text-micro uppercase tracking-[0.12em] text-white/35">
          Try another question
        </p>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar edge-fade-x">
          {heroPlans.map((candidate) => {
            const active = candidate.id === plan.id && phase === "result";
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => run(candidate.query)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors",
                  active
                    ? "border-signal/40 bg-signal/15 text-signal"
                    : "border-white/12 bg-white/4 text-white/60 hover:border-white/25 hover:text-white",
                )}
              >
                {candidate.query}
              </button>
            );
          })}
        </div>
      </div>
      </AppSurface>

      {/* ---- the mascot --------------------------------------------------
          In normal flow directly under the console, not floated over its
          corner.

          The floated version looked better in a screenshot and was wrong: at
          every width below `xl` the speech bubble landed on top of the "try
          another question" chips, which are real buttons. A mascot that covers
          a tap target is a bug, so he gets his own row. It also means he
          survives on mobile, where the floated version had to be hidden
          entirely — and mobile is where most people will meet him. */}
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
            {/* The tail, as a rotated square so it inherits the bubble fill. */}
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

/* -------------------------------------------------------------------------- */
/* Anyone Down? — the plan becomes a temporary group                           */
/* -------------------------------------------------------------------------- */

function GroupView({
  plan,
  joined,
  onBack,
}: {
  plan: Plan;
  joined: boolean;
  onBack: () => void;
}) {
  const reduced = useReducedMotion();
  const people = nearbyInterested;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
    >
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-[0.8125rem] text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to the plan
      </button>

      <div className="rounded-lg border border-white/10 bg-white/4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-micro uppercase tracking-[0.12em] text-signal">
              Temporary group
            </p>
            <h3 className="mt-1.5 text-lg font-semibold text-white">{plan.title}</h3>
            <p className="mt-0.5 text-sm text-white/50">
              Closes after tonight. Nobody has to add anyone as a friend.
            </p>
          </div>
          <span className="tnum shrink-0 rounded-full bg-mint/15 px-2.5 py-1 text-xs font-medium text-mint">
            {money(planTotal(plan))} each
          </span>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {joined ? (
            <motion.li
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduced ? { duration: 0 } : spring.snappy}
              className="flex items-center gap-3 rounded-md bg-signal/12 px-3 py-2"
            >
              <Avatar initials="YOU" size="xs" className="bg-signal text-ink-950" />
              <span className="text-sm font-medium text-white">You</span>
              <span className="ml-auto text-xs font-medium text-signal">Host</span>
            </motion.li>
          ) : null}

          {people.map((person, index) => (
            <motion.li
              key={person.handle}
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={
                reduced ? { duration: 0 } : { ...spring.snappy, delay: 0.12 * (index + 1) }
              }
              className="flex items-center gap-3 rounded-md bg-white/4 px-3 py-2"
            >
              <Avatar initials={person.initials} size="xs" />
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{person.handle}</p>
                <p className="truncate text-xs text-white/40">{person.campus}</p>
              </div>
              <span className="ml-auto shrink-0 text-xs text-white/40">invited</span>
            </motion.li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-2 rounded-md bg-ink-900 px-3 py-2.5">
          <CornerDownLeft className="size-3.5 shrink-0 text-white/30" aria-hidden />
          <p className="text-[0.8125rem] text-white/55">
            Group chat opens the moment two people are in.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
