"use client";

import { motion, useReducedMotion } from "motion/react";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { AppSurface } from "@/components/product/app-surface";
import { accents } from "@/components/ui/accent";
import { BrandMark } from "@/components/brand/logo";
import { brand } from "@/brand/brand.config";
import {
  budgetMonth,
  budgetPlanned,
  budgetRemaining,
  budgetSpent,
  categoryRemaining,
  safeToday,
  tonightPlanCost,
  upcomingTotal,
  weeklyDelta,
} from "@/data/budget";
import { duration, ease } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * BUDGET
 * ----------------------------------------------------------------------------
 * A budget app tells you what you spent. This tells you what you can do.
 *
 * The slider is the argument: move tonight's cost and the product answers
 * immediately, in the same three sentences a friend would use. Every number
 * derives from data/budget.ts, so nothing here can drift out of sync.
 * ============================================================================
 */
export function BudgetPanel({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [cost, setCost] = useState(tonightPlanCost);

  const remaining = budgetRemaining();
  const planned = budgetPlanned();
  const spent = budgetSpent();
  const safe = safeToday();
  const goingOutLeft = categoryRemaining("going-out");
  const delta = weeklyDelta();

  const verdict = getVerdict({ cost, safe, goingOutLeft });

  return (
    <AppSurface
      title={
        <span className="flex items-center gap-2">
          <BrandMark className="size-3.5 text-flow" />
          {budgetMonth.label} budget
        </span>
      }
      meta={`${budgetMonth.daysLeft} days left · rent already paid`}
      className={className}
    >
      {/* ---- headline ------------------------------------------------------ */}
      <div>
        <p className="font-mono text-micro uppercase tracking-[0.12em] text-white/40">Remaining</p>
        <div className="mt-1 flex items-end gap-3">
          <span className="tnum font-mono text-[2.75rem] leading-none font-semibold text-white">
            {money(remaining)}
          </span>
          <span className="pb-1 text-sm text-white/40">of {money(planned)}</span>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-flow"
            initial={reduced ? false : { width: 0 }}
            whileInView={{ width: `${(spent / planned) * 100}%` }}
            viewport={{ once: true, amount: 0.5 }}
            transition={reduced ? { duration: 0 } : { duration: 0.8, ease: ease.out }}
          />
        </div>
        <p className="mt-2 text-xs text-white/35">
          {money(spent)} spent · {money(upcomingTotal())} of known charges still to come
        </p>
      </div>

      {/* ---- two numbers that matter --------------------------------------- */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <StatTile
          label="Safe to spend today"
          value={money(safe)}
          note={`${money(remaining - upcomingTotal())} spread over ${budgetMonth.daysLeft} days`}
          accent="mint"
        />
        <StatTile
          label="Going out left"
          value={money(goingOutLeft)}
          note={`${money(budgetMonth.categories[1].spent)} used this month`}
          accent="pulse"
        />
      </div>

      {/* ---- categories ----------------------------------------------------- */}
      <ul className="mt-5 flex flex-col gap-3">
        {budgetMonth.categories.map((category, index) => {
          const used = (category.spent / category.planned) * 100;
          return (
            <li key={category.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-white/70">{category.label}</span>
                <span className="tnum shrink-0 font-mono text-xs text-white/45">
                  {money(category.planned - category.spent)} left
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className={cn("h-full rounded-full", accents[category.accent].fill)}
                  initial={reduced ? false : { width: 0 }}
                  whileInView={{ width: `${Math.min(100, used)}%` }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={
                    reduced ? { duration: 0 } : { duration: 0.6, delay: index * 0.06, ease: ease.out }
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* ---- the interactive part -------------------------------------------- */}
      <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="tonight-cost" className="text-sm font-medium text-white">
            If tonight costs
          </label>
          <span className="tnum font-mono text-lg font-semibold text-signal">{money(cost)}</span>
        </div>

        <input
          id="tonight-cost"
          type="range"
          min={0}
          max={60}
          step={1}
          value={cost}
          onChange={(event) => setCost(Number(event.target.value))}
          onPointerUp={() => track("budget_scenario_changed", { cost })}
          className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-signal"
          aria-describedby="tonight-verdict"
        />
        <div className="mt-1.5 flex justify-between font-mono text-micro text-white/30">
          <span>{money(0)}</span>
          <span>{money(60)}</span>
        </div>

        <motion.div
          id="tonight-verdict"
          key={verdict.tone}
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : duration.quick }}
          className={cn(
            "mt-4 flex gap-2.5 rounded-md p-3",
            verdict.tone === "good" && "bg-mint/12",
            verdict.tone === "careful" && "bg-amber/12",
            verdict.tone === "bad" && "bg-pulse/12",
          )}
          aria-live="polite"
        >
          {verdict.tone === "bad" ? (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-pulse" aria-hidden />
          ) : (
            <CalendarClock
              className={cn(
                "mt-0.5 size-4 shrink-0",
                verdict.tone === "good" ? "text-mint" : "text-amber",
              )}
              aria-hidden
            />
          )}
          <div>
            <p className="font-mono text-micro uppercase tracking-[0.1em] text-white/45">
              {brand.name} suggestion
            </p>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-white/80">{verdict.message}</p>
          </div>
        </motion.div>

        <p className="mt-3 text-xs text-white/35">
          You are {money(Math.abs(delta))} {delta >= 0 ? "under" : "over"} your weekly target of{" "}
          {money(budgetMonth.weeklyTarget)}.
        </p>
      </div>
    </AppSurface>
  );
}

function StatTile({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent: "mint" | "pulse";
}) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-3">
      <p className="font-mono text-micro uppercase tracking-[0.1em] text-white/40">{label}</p>
      <p
        className={cn(
          "tnum mt-1 font-mono text-xl font-semibold",
          accent === "mint" ? "text-mint" : "text-pulse",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[0.6875rem] leading-tight text-white/35">{note}</p>
    </div>
  );
}

function getVerdict({
  cost,
  safe,
  goingOutLeft,
}: {
  cost: number;
  safe: number;
  goingOutLeft: number;
}): { tone: "good" | "careful" | "bad"; message: string } {
  if (cost > goingOutLeft) {
    return {
      tone: "bad",
      message: `That is ${money(cost - goingOutLeft)} more than you have left for going out this month. There are free plans tonight that still get you out of the flat.`,
    };
  }
  if (cost > safe) {
    return {
      tone: "careful",
      message: `It fits this month, but it is ${money(cost - safe)} over today's safe amount. Doable if tomorrow is a quiet one.`,
    };
  }
  return {
    tone: "good",
    message: `Comfortably fits. That still leaves ${money(safe - cost)} of today's safe amount and ${money(goingOutLeft - cost)} for the rest of the month.`,
  };
}
