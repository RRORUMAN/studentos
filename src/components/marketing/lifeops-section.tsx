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
import { ButtonLink } from "@/components/ui/button";
import {
  ProductPanel,
  RuleLabel,
  SampleTag,
  Section,
  SectionHeader,
} from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
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
 * LIFEOPS
 * ----------------------------------------------------------------------------
 * The section that changes what the product *is*. Everything above this is
 * discovery; this is the argument that StudentOS runs the week — deadlines,
 * classes, tasks, the events you said yes to, the plans you made and the
 * payments that repeat, on one timeline instead of five apps.
 *
 * The budget line under the timeline is the join: a day with plans in it has a
 * cost, and the number after it comes from the same seeded month.
 * ============================================================================
 */
export function LifeOpsSection() {
  const planned = lifeOpsToday.reduce((total, item) => total + (item.price ?? 0), 0);
  const after = safeToday() - planned;

  return (
    <Section id="lifeops" tone="warm">
      <div className="page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-14">
          <div>
            <SectionHeader
              eyebrow="LifeOps"
              eyebrowIndex="09"
              title="One place for everything you need to remember."
              lead="Arrival tasks, deadlines, classes, the events you are going to, your plans, recurring payments and travel. Complete, snooze, reschedule or add to your calendar."
            />

            <div className="mt-7">
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                It changes as your year does
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {lifeOpsModes.map((mode, index) => (
                  <span
                    key={mode}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[0.8125rem]",
                      index === 2
                        ? "border-transparent bg-ink-950 text-paper"
                        : "border-ink-200 bg-white text-ink-600",
                    )}
                  >
                    {mode}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-500">
                Before arrival it is a checklist. In week one it is a map of what blocks what. By
                November it is your week. When you leave it is a deposit and a subscription list.
              </p>
            </div>

            <ButtonLink href="/get-started?intent=lifeops" variant="primary" className="mt-7">
              Put your week in one place
            </ButtonLink>
          </div>

          {/* ---- the timeline ------------------------------------------------ */}
          <Reveal delay={0.05}>
            <ProductPanel>
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-micro uppercase tracking-[0.12em] text-white/40">
                  Today · Thursday
                </p>
                <SampleTag onDark />
              </div>

              <ol className="mt-4 flex flex-col">
                {lifeOpsToday.map((item) => (
                  <TimelineRow key={item.label} item={item} />
                ))}
              </ol>

              <RuleLabel onDark className="mt-5">
                This week
              </RuleLabel>

              <ol className="mt-3 flex flex-col">
                {lifeOpsWeek.map((item) => (
                  <TimelineRow key={item.label} item={item} />
                ))}
              </ol>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/6 px-4 py-3">
                <span className="flex items-center gap-2.5">
                  <MascotStill state="focus" size="xs" />
                  <span className="text-[0.875rem] text-white/70">
                    Budget after the planned day
                  </span>
                </span>
                <span className="tnum font-mono text-lg font-semibold text-mint">
                  {money(after)} left today · {money(safeThisWeek())} this week
                </span>
              </div>
            </ProductPanel>
          </Reveal>
        </div>
      </div>
    </Section>
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
      <span className="relative mt-1 flex shrink-0 flex-col items-center self-stretch">
        <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} aria-hidden />
      </span>
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
        <span className="mt-0.5 flex items-center gap-1.5 text-[0.8125rem] text-white/45">
          <Icon className="size-3.5 shrink-0" aria-hidden />
          {item.detail}
        </span>
      </span>
    </li>
  );
}
