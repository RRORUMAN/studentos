import {
  Banknote,
  CalendarClock,
  GraduationCap,
  Landmark,
  PartyPopper,
  Route,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MascotStill } from "@/components/mascot/mascot";
import { ProductPanel, RuleLabel, SampleTag } from "@/components/ui/primitives";
import { lifeOpsModes, lifeOpsToday, lifeOpsWeek, type LifeOpsItem } from "@/data/brain";
import { safeThisWeek, safeToday } from "@/data/budget";
import { cn, money } from "@/lib/utils";

const KIND: Record<LifeOpsItem["kind"], { icon: LucideIcon; dot: string }> = {
  class: { icon: GraduationCap, dot: "bg-flow" },
  food: { icon: UtensilsCrossed, dot: "bg-mint" },
  deadline: { icon: CalendarClock, dot: "bg-pulse" },
  event: { icon: PartyPopper, dot: "bg-signal" },
  official: { icon: Landmark, dot: "bg-amber" },
  money: { icon: Banknote, dot: "bg-flow" },
  plan: { icon: Route, dot: "bg-signal" },
};

/**
 * ============================================================================
 * LIFEOPS — demo
 * ----------------------------------------------------------------------------
 * The argument that StudentOS runs the week — deadlines, classes, the events
 * you said yes to, the plans you made and the payments that repeat, on one
 * timeline instead of five apps.
 *
 * The budget line under the timeline is the join: a day with plans in it has a
 * cost, and the number after it comes from the same seeded month as Today and
 * Budget, so the three can never disagree.
 * ============================================================================
 */
export function LifeOpsDemo() {
  const planned = lifeOpsToday.reduce((total, item) => total + (item.price ?? 0), 0);
  const after = safeToday() - planned;

  return (
    <ProductPanel className="p-5 sm:p-6 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-0.5 flex flex-wrap gap-1">
          {lifeOpsModes.map((mode, index) => (
            <span
              key={mode}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[0.75rem]",
                index === 2 ? "bg-white text-ink-950" : "bg-white/6 text-white/50",
              )}
            >
              {mode}
            </span>
          ))}
        </div>
        <SampleTag onDark />
      </div>

      <RuleLabel onDark className="mt-5">
        Today · Thursday
      </RuleLabel>
      <ol className="mt-2 flex flex-col">
        {lifeOpsToday.map((item) => (
          <TimelineRow key={item.label} item={item} />
        ))}
      </ol>

      <RuleLabel onDark className="mt-4">
        This week
      </RuleLabel>
      <ol className="mt-2 flex flex-col">
        {lifeOpsWeek.map((item) => (
          <TimelineRow key={item.label} item={item} />
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/6 px-4 py-3">
        <span className="flex items-center gap-2.5">
          <MascotStill state="focus" size="xs" />
          <span className="text-[0.875rem] text-white/70">After the planned day</span>
        </span>
        <span className="tnum font-mono text-base font-semibold text-mint">
          {money(after)} today · {money(safeThisWeek())} week
        </span>
      </div>
    </ProductPanel>
  );
}

function TimelineRow({ item }: { item: LifeOpsItem }) {
  const meta = KIND[item.kind];
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-3 border-b border-white/8 py-2.5 last:border-b-0">
      <span className="tnum w-11 shrink-0 pt-0.5 font-mono text-[0.8125rem] font-medium text-white/70">
        {item.time}
      </span>
      <span className={cn("mt-2 size-2 shrink-0 rounded-full", meta.dot)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[0.9375rem] font-medium text-white">{item.label}</span>
          {item.price !== undefined ? (
            <span
              className={cn(
                "tnum shrink-0 font-mono text-[0.875rem]",
                item.price === 0 ? "text-mint" : "text-white/80",
              )}
            >
              {item.price === 0 ? "Free" : money(item.price)}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[0.8125rem] text-white/50">
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{item.detail}</span>
        </span>
      </span>
    </li>
  );
}
