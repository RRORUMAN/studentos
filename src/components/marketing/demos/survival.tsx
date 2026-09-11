"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { MascotStill } from "@/components/mascot/mascot";
import { accents } from "@/components/ui/accent";
import { SampleTag } from "@/components/ui/primitives";
import { mascotLine } from "@/brand/mascot.config";
import { defaultCity } from "@/data/cities";
import {
  survivalAmounts,
  survivalDefaults,
  survivalHorizons,
  survivalPlan,
} from "@/data/survival";
import { duration, ease } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * SURVIVAL MODE — demo
 * ----------------------------------------------------------------------------
 * The most-asked student money question, and the one no budgeting app answers:
 * I have this much, it has to last until then, what do I do?
 *
 * The allocator in `data/survival.ts` is real arithmetic and the rows always
 * sum to exactly the amount — including the honest zero on "free activities",
 * which is the row that makes the plan credible. The card wears the sticker
 * treatment because this is the object students screenshot.
 * ============================================================================
 */
export function SurvivalDemo() {
  const reduced = useReducedMotion();
  const [amount, setAmount] = useState<number>(survivalDefaults.amount);
  const [days, setDays] = useState<number>(survivalDefaults.days);

  const plan = survivalPlan(amount, days, defaultCity);
  const horizon = survivalHorizons.find((option) => option.days === days) ?? survivalHorizons[1];

  return (
    <div className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] sm:items-start">
      {/* ---- controls -------------------------------------------------------- */}
      <div>
        <p className="text-display-xs text-ink-950">
          {money(amount)} until {horizon.phrase}? We can work with that.
        </p>

        <p className="mt-5 font-mono text-micro uppercase tracking-[0.12em] text-ink-500">I have</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {survivalAmounts.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={amount === preset}
              onClick={() => {
                setAmount(preset);
                track("survival_amount_changed", { amount: preset });
              }}
              className={cn(
                "tnum rounded-full border px-3.5 py-1.5 font-mono text-sm transition-colors",
                amount === preset
                  ? "border-transparent bg-ink-950 text-paper"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-950",
              )}
            >
              {money(preset)}
            </button>
          ))}
        </div>

        <p className="mt-4 font-mono text-micro uppercase tracking-[0.12em] text-ink-500">
          It has to last until
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {survivalHorizons.map((option) => (
            <button
              key={option.days}
              type="button"
              aria-pressed={days === option.days}
              onClick={() => {
                setDays(option.days);
                track("survival_horizon_changed", { days: option.days });
              }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                days === option.days
                  ? "border-transparent bg-ink-950 text-paper"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-950",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-500">
          <SampleTag label="Demo control" /> Prices from {defaultCity.name} anchors.
        </p>
      </div>

      {/* ---- the sticker card ---------------------------------------------- */}
      <div className="w-full rounded-2xl bg-signal p-5 text-ink-950 sticker">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-micro font-semibold uppercase tracking-[0.14em]">
            Survival plan
          </p>
          <p className="tnum font-mono text-sm font-semibold">{plan.days} days</p>
        </div>

        <p className="tnum mt-3 font-display text-[2.5rem] leading-none font-semibold tracking-[-0.04em]">
          {money(plan.amount)}
        </p>
        <p className="mt-1 text-[0.8125rem] text-ink-950/70">{money(plan.perDay)} a day for food.</p>

        <ul className="mt-4 flex flex-col gap-1.5 border-t-2 border-ink-950 pt-3">
          {plan.rows.map((row, index) => (
            <motion.li
              key={`${plan.amount}-${plan.days}-${row.key}`}
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={
                reduced ? { duration: 0 } : { delay: index * 0.04, duration: duration.base, ease: ease.out }
              }
              className="flex items-baseline gap-2 font-mono text-[0.8125rem]"
            >
              <span className="shrink-0 font-medium">{row.label}</span>
              <span aria-hidden className="h-px min-w-3 flex-1 border-b border-dashed border-ink-950/30" />
              <span className={cn("tnum shrink-0 font-semibold", row.amount === 0 && "text-ink-950/55")}>
                {row.amount === 0 ? "FREE" : money(row.amount)}
              </span>
            </motion.li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-ink-950 px-3 py-2">
          <MascotStill state="survival" size="xs" className="shrink-0" />
          <p className="text-[0.8125rem] font-medium text-signal">
            {plan.tight ? mascotLine("budgetTight", 1) : mascotLine("survival", 0)}
          </p>
        </div>

        {plan.tight ? (
          <p className={cn("mt-3 text-xs font-medium", accents.pulse.text)}>
            Honestly: this does not cover the days you asked for. The plan above is the most it
            stretches to.
          </p>
        ) : null}
      </div>
    </div>
  );
}
