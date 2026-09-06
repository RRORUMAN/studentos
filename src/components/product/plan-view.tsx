"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  Footprints,
  Landmark,
  Martini,
  PartyPopper,
  ShoppingBasket,
  Train,
  UtensilsCrossed,
} from "lucide-react";
import type { ComponentType } from "react";

import { planHeadroom, planTotal } from "@/data/plans";
import type { Plan, PlanItem } from "@/data/types";
import { duration, ease } from "@/lib/motion";
import { cn, money, walk, type MoneyLocale } from "@/lib/utils";

const KIND_ICON: Record<PlanItem["kind"], ComponentType<{ className?: string }>> = {
  food: UtensilsCrossed,
  event: PartyPopper,
  drink: Martini,
  transport: Train,
  culture: Landmark,
  activity: ShoppingBasket,
};

const SOURCE_LABEL: Record<PlanItem["source"], string> = {
  students: "student reports",
  official: "official data",
  venue: "the venue",
};

/**
 * Renders a generated plan. Used by the hero, the city pages and anywhere the
 * product answers a "what can I do" question — one component, one look.
 */
export function PlanView({
  plan,
  animate = true,
  /**
   * The currency the plan is priced in. A plan for London prints pounds and a
   * plan for Madrid euro, from this one component — the product is used
   * worldwide, so the row renderer can never assume a currency.
   */
  where,
  className,
}: {
  plan: Plan;
  animate?: boolean;
  where?: MoneyLocale;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const shouldAnimate = animate && !reduced;
  const total = planTotal(plan);
  const headroom = planHeadroom(plan);
  const price = (amount: number) => money(amount, where);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-display-xs text-white">{plan.title}</h3>
        <span className="font-mono text-micro uppercase tracking-[0.1em] text-white/35">
          {plan.items.length} stops
        </span>
      </div>

      <ol className="mt-4 flex flex-col">
        {plan.items.map((item, index) => (
          <motion.li
            key={`${item.title}-${index}`}
            initial={shouldAnimate ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldAnimate
                ? { delay: 0.08 * index, duration: duration.base, ease: ease.out }
                : { duration: 0 }
            }
            className="group relative flex gap-3 border-b border-white/8 py-3 last:border-b-0 sm:gap-4"
          >
            <PlanRowLeading item={item} />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[0.9375rem] font-medium text-white">{item.title}</p>
                <p
                  className={cn(
                    "tnum shrink-0 font-mono text-[0.9375rem] font-medium",
                    item.price === 0 ? "text-mint" : "text-white",
                  )}
                >
                  {item.price === 0 ? "Free" : price(item.price)}
                </p>
              </div>

              {item.detail ? (
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-white/50">{item.detail}</p>
              ) : null}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {item.walkMinutes ? (
                  <span className="inline-flex items-center gap-1 text-xs text-white/45">
                    <Footprints className="size-3.5" aria-hidden />
                    <span className="tnum">{walk(item.walkMinutes)}</span>
                  </span>
                ) : null}
                <span className="text-xs text-white/30">from {SOURCE_LABEL[item.source]}</span>
              </div>
            </div>
          </motion.li>
        ))}
      </ol>

      <motion.div
        initial={shouldAnimate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={
          shouldAnimate
            ? { delay: 0.08 * plan.items.length + 0.1, duration: duration.base }
            : { duration: 0 }
        }
        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/6 px-4 py-3"
      >
        <span className="font-mono text-micro uppercase tracking-[0.12em] text-white/50">
          Total
        </span>
        <div className="flex items-center gap-3">
          {headroom >= 0 ? (
            <span className="tnum rounded-full bg-mint/15 px-2.5 py-1 text-xs font-medium text-mint">
              {price(headroom)} under budget
            </span>
          ) : (
            <span className="tnum rounded-full bg-pulse/15 px-2.5 py-1 text-xs font-medium text-pulse">
              {price(Math.abs(headroom))} over budget
            </span>
          )}
          <span className="tnum font-mono text-xl font-semibold text-signal">{price(total)}</span>
        </div>
      </motion.div>

      {plan.note ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-white/50">{plan.note}</p>
      ) : null}
    </div>
  );
}

function PlanRowLeading({ item }: { item: PlanItem }) {
  const Icon = KIND_ICON[item.kind];

  if (!item.time) {
    return (
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-white/6 text-white/50">
        <Icon className="size-4" aria-hidden />
      </span>
    );
  }

  return (
    <span className="mt-0.5 flex w-14 shrink-0 flex-col items-start gap-1 sm:w-16">
      <span className="tnum font-mono text-[0.8125rem] font-medium text-white/70">{item.time}</span>
      <span className="grid size-6 place-items-center rounded-xs bg-white/6 text-white/40">
        <Icon className="size-3.5" aria-hidden />
      </span>
    </span>
  );
}
