"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";

import { MascotStill } from "@/components/mascot/mascot";
import { accents } from "@/components/ui/accent";
import { ButtonLink } from "@/components/ui/button";
import {
  Meter,
  ProductPanel,
  SampleTag,
  Section,
  SectionHeader,
} from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import {
  affordCheck,
  budgetMonth,
  cheaperAlternatives,
  safeThisWeek,
  safeToday,
  tonightPlanCost,
} from "@/data/budget";
import { duration, ease } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

const AMOUNTS = [12, 20, 35, 60];

const VERDICT_TONE = {
  easy: { bg: "bg-mint-soft", text: "text-mint-deep", mascot: "budget" },
  "yes-but": { bg: "bg-amber-soft", text: "text-amber-deep", mascot: "budget" },
  careful: { bg: "bg-amber-soft", text: "text-amber-deep", mascot: "concerned" },
  no: { bg: "bg-pulse-soft", text: "text-pulse-deep", mascot: "concerned" },
} as const;

/**
 * ============================================================================
 * SMART BUDGET
 * ----------------------------------------------------------------------------
 * Every other budgeting app explains a month that already happened. This one
 * answers the only question a student asks it: can I do this thing tonight?
 *
 * Two numbers do the work — safe to spend today and safe to spend this week — and both are
 * derived in `data/budget.ts` from the same seeded month the rest of the page
 * uses, so the figure here can never disagree with the figure in Today or in
 * an Ask answer. The afford check is real arithmetic on the amount you pick.
 * ============================================================================
 */
export function BudgetSection() {
  const reduced = useReducedMotion();
  const [amount, setAmount] = useState(35);

  const today = safeToday();
  const week = safeThisWeek();
  const check = affordCheck(amount);
  const tone = VERDICT_TONE[check.verdict];
  const weekUsed = (budgetMonth.weekSoFar / budgetMonth.weeklyTarget) * 100;

  return (
    <Section id="budget" tone="flow">
      <div className="page">
        <SectionHeader
          eyebrow={brand.surfaces.budget}
          eyebrowIndex="05"
          title="Your budget should tell you what you can do."
          lead="Not a pie chart of what you already spent. Two numbers that decide tonight, and a cheaper version of the plan when the answer is no."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {/* ---- the two numbers -------------------------------------------- */}
          <Reveal>
            <ProductPanel className="h-full">
              <div className="mb-4 flex justify-end">
                <SampleTag onDark />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-micro uppercase tracking-[0.12em] text-white/40">
                    Safe to spend today
                  </p>
                  <p className="tnum mt-1 font-mono text-[2.5rem] leading-none font-semibold text-mint">
                    {money(today)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-micro uppercase tracking-[0.12em] text-white/40">
                    Safe to spend this week
                  </p>
                  <p className="tnum mt-1 font-mono text-[2.5rem] leading-none font-semibold text-white">
                    {money(week)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Meter value={weekUsed} accent="flow" onDark label="Week spent so far" />
                <p className="mt-2 text-xs text-white/40">
                  {money(budgetMonth.weekSoFar)} of this week&rsquo;s {money(budgetMonth.weeklyTarget)}{" "}
                  target used · rent already paid
                </p>
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-lg bg-mint/12 p-3.5">
                <MascotStill state="budget" size="sm" className="shrink-0" />
                <p className="text-[0.9375rem] leading-snug text-white">
                  You can comfortably afford tonight&rsquo;s {money(tonightPlanCost)} plan.
                </p>
              </div>

              <p className="mt-5 font-mono text-micro uppercase tracking-[0.12em] text-white/40">
                Cheaper versions of the same night
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {cheaperAlternatives.map((option) => (
                  <li
                    key={option.label}
                    className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] text-white">
                        {option.label}
                      </span>
                      <span className="block truncate text-xs text-white/40">{option.note}</span>
                    </span>
                    <span
                      className={cn(
                        "tnum shrink-0 font-mono text-sm font-medium",
                        option.price === 0 ? "text-mint" : "text-white",
                      )}
                    >
                      {option.price === 0 ? "Free" : money(option.price)}
                    </span>
                    <span className="tnum shrink-0 text-xs text-mint">
                      −{money(tonightPlanCost - option.price)}
                    </span>
                  </li>
                ))}
              </ul>
            </ProductPanel>
          </Reveal>

          {/* ---- can I afford this? ------------------------------------------ */}
          <Reveal delay={0.05}>
            <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                  Can I afford this?
                </h3>
                <SampleTag label="Demo control" />
              </div>

              <div className="mt-4">
                <label htmlFor="afford-amount" className="text-[0.9375rem] font-medium text-ink-900">
                  A {money(amount)} dinner
                </label>
                <input
                  id="afford-amount"
                  type="range"
                  min={5}
                  max={90}
                  step={1}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  onPointerUp={() => track("budget_scenario_changed", { cost: amount })}
                  className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-100 accent-flow"
                  aria-describedby="afford-verdict"
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {AMOUNTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={amount === preset}
                      onClick={() => {
                        setAmount(preset);
                        track("budget_scenario_changed", { cost: preset });
                      }}
                      className={cn(
                        "tnum rounded-full border px-3 py-1 font-mono text-xs transition-colors",
                        amount === preset
                          ? "border-transparent bg-flow text-white"
                          : "border-ink-200 text-ink-600 hover:border-ink-300 hover:text-ink-950",
                      )}
                    >
                      {money(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <motion.div
                id="afford-verdict"
                key={check.verdict}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0 : duration.quick, ease: ease.out }}
                aria-live="polite"
                className={cn("mt-5 rounded-xl p-4", tone.bg)}
              >
                <p className={cn("text-display-xs", tone.text)}>{check.headline}</p>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
                  {check.detail}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <MascotStill state={tone.mascot} size="xs" />
                  <span className="text-xs text-ink-500">
                    Safe to spend: {money(check.safeToday)} today · {money(check.safeWeek)} this week
                  </span>
                </div>
              </motion.div>

              {check.alternative ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-ink-200 p-3.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mint-soft text-mint-deep">
                    <Check className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.875rem] font-medium text-ink-950">
                      {check.alternative.label} · {money(check.alternative.price)}
                    </span>
                    <span className="block text-xs text-ink-500">{check.alternative.note}</span>
                  </span>
                  <span className={cn("tnum shrink-0 text-sm font-medium", accents.mint.text)}>
                    −{money(check.alternative.saves)}
                  </span>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-ink-200 p-3.5 text-[0.875rem] text-ink-500">
                  Nothing to change. It already fits inside today.
                </p>
              )}

              <div className="mt-auto pt-5">
                <ButtonLink href="/get-started?intent=budget" variant="primary">
                  Set up your budget
                  <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
                <p className="mt-2.5 text-[0.8125rem] text-ink-400">
                  Works on numbers you enter. No bank connection, on any tier.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
