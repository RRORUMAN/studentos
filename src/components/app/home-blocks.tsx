import {
  ArrowRight,
  Calculator,
  CalendarDays,
  ChevronRight,
  Compass,
  CreditCard,
  Gift,
  LifeBuoy,
  ListChecks,
  MapPin,
  Moon,
  Package,
  ShoppingBasket,
  Sparkles,
  Target,
  UsersRound,
  Utensils,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Meter } from "@/components/ui/primitives";
import type { LifeOpsItem } from "@/domain/lifeops";
import type { BriefLine } from "@/server/engines/brief";
import type { BudgetReading } from "@/server/engines/budget";
import type { QuickAction } from "@/server/engines/quick-actions";
import { rightNowKindLabel, type RightNowItem } from "@/server/engines/right-now";
import type { TodayPick } from "@/server/engines/today";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * HOME BLOCKS
 * ----------------------------------------------------------------------------
 * The pieces of the daily screen that are not the feed. Server components;
 * the only interactivity is a link. Hierarchy is carried by size and ink, not
 * by borders: the money is the biggest thing, today's five are the next, and
 * everything below is quieter on purpose.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Money summary                                                               */
/* -------------------------------------------------------------------------- */

export function MoneySummary({
  reading,
  weekTargetCents,
  weekSpentCents,
  sentence,
  where,
}: {
  reading: BudgetReading;
  weekTargetCents: number;
  weekSpentCents: number;
  sentence: string;
  where: { currency: string; locale: string };
}) {
  if (reading.plannedCents === 0) {
    return (
      <section className="flex items-center gap-4 rounded-2xl bg-ink-950 p-5 text-paper">
        <MascotArt state="budget" accessory="calculator" className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[1.0625rem] font-semibold">Want to know what you can safely spend?</p>
          <p className="mt-1 text-[0.875rem] text-paper/70">One number becomes a daily figure, and every recommendation gets a price check.</p>
        </div>
        <ButtonLink href="/budget/setup" variant="signal" size="sm" className="shrink-0">
          Set budget
        </ButtonLink>
      </section>
    );
  }

  const weekLeft = Math.max(0, weekTargetCents - weekSpentCents);

  return (
    <section aria-label="Money" className="rounded-2xl bg-ink-950 p-5 text-paper sm:p-6">
      <div className="grid grid-cols-2 gap-6">
        <Link href="/budget" className="group min-w-0">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">Safe today</p>
          <p className="tnum mt-1.5 font-display text-[2.25rem] leading-none font-semibold tracking-tight text-signal sm:text-[2.75rem]">
            {money(reading.safeTodayCents / 100, where)}
          </p>
        </Link>
        <Link href="/budget" className="group min-w-0">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">Safe this week</p>
          <p className="tnum mt-1.5 font-display text-[2.25rem] leading-none font-semibold tracking-tight text-paper sm:text-[2.75rem]">
            {money(weekLeft / 100, where)}
          </p>
        </Link>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-paper/12 pt-4">
        <p className="text-[0.9375rem] leading-snug text-paper/85">{sentence}</p>
        <Link href="/budget/afford" aria-label="Can I afford this?" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-paper/10 px-3 py-1.5 text-[0.8125rem] font-medium text-paper transition-colors hover:bg-paper/20">
          <Calculator className="size-3.5" />
          Afford?
        </Link>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Today for you                                                               */
/* -------------------------------------------------------------------------- */

const PICK_ICON: Record<TodayPick["kind"], typeof Moon> = {
  task: ListChecks,
  event: CalendarDays,
  social: UsersRound,
  deal: Gift,
  place: MapPin,
  mission: Target,
};

const PICK_TINT: Record<TodayPick["kind"], string> = {
  task: "bg-flow-soft text-flow-deep",
  event: "bg-pulse-soft text-pulse-deep",
  social: "bg-signal-soft text-signal-deep",
  deal: "bg-amber-soft text-amber-deep",
  place: "bg-mint-soft text-mint-deep",
  mission: "bg-mint-soft text-mint-deep",
};

export function TodayForYou({ picks, where }: { picks: readonly TodayPick[]; where: { currency: string; locale: string } }) {
  if (picks.length === 0) return null;
  return (
    <section aria-labelledby="today-heading">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="today-heading" className="text-[1.125rem] font-semibold text-ink-950">Today for you</h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-500">One of each thing that matters. Ranked.</p>
        </div>
        <Link href="/lifeops" className="flex shrink-0 items-center gap-1 text-[0.875rem] font-medium text-ink-600 hover:text-ink-950">
          Timeline
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <ol className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
        {picks.map((pick, index) => {
          const Icon = PICK_ICON[pick.kind];
          return (
            <li key={`${pick.kind}-${pick.id}`}>
              <Link href={pick.href} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-paper-2">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", PICK_TINT[pick.kind])}>
                  <Icon className="size-4.5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("truncate font-semibold text-ink-950", index === 0 ? "text-[1.0625rem]" : "text-[0.9375rem]")}>{pick.title}</span>
                    {pick.tag === "now" ? <Badge accent="pulse" tone="solid">Now</Badge> : null}
                    {pick.tag === "free" ? <Badge accent="mint" tone="solid">Free</Badge> : null}
                    {pick.tag === "friends" ? <Badge accent="signal">People</Badge> : null}
                    {pick.tag === "due" ? <Badge accent="flow">Due</Badge> : null}
                    {pick.tag === "deal" ? <Badge accent="amber">Deal</Badge> : null}
                    {pick.tag === "step" ? <Badge accent="mint">Mission</Badge> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-500">
                    {pick.reason}
                    {pick.meta ? ` · ${pick.meta}` : ""}
                  </span>
                </span>
                {pick.priceCents !== null && pick.priceCents > 0 ? (
                  <span className="tnum shrink-0 font-mono text-[0.9375rem] font-medium text-ink-900">{money(pick.priceCents / 100, where)}</span>
                ) : null}
                <ChevronRight className="size-4 shrink-0 text-ink-300" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Quick actions                                                               */
/* -------------------------------------------------------------------------- */

const ACTION_ICON = {
  free: Gift,
  tonight: Moon,
  food: Utensils,
  weekend: CalendarDays,
  people: UsersRound,
  study: Compass,
  settle: MapPin,
  stretch: LifeBuoy,
  afford: Calculator,
  shop: ShoppingBasket,
} as const;

export function QuickActions({ actions }: { actions: readonly QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <nav aria-label="Quick actions" className="-mx-5 overflow-x-auto px-5 no-scrollbar sm:mx-0 sm:px-0">
      <ul className="flex gap-2 sm:flex-wrap">
        {actions.map((action) => {
          const Icon = ACTION_ICON[action.icon];
          return (
            <li key={action.key} className="shrink-0">
              <Link
                href={action.href}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white pr-4 pl-3 text-[0.875rem] font-medium text-ink-800 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/8 transition-[box-shadow,transform] hover:shadow-[var(--shadow-raise)] active:translate-y-px"
              >
                <Icon className="size-4 text-ink-500" strokeWidth={2} />
                {action.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Daily brief                                                                 */
/* -------------------------------------------------------------------------- */

const BRIEF_ICON: Record<BriefLine["kind"], typeof Moon> = {
  tonight: Moon,
  free: Gift,
  friends: UsersRound,
  deal: Gift,
  money: Calculator,
  task: ListChecks,
  people: UsersRound,
  pulse: Sparkles,
  payment: CreditCard,
  mission: Target,
  exchange: Package,
};

export function DailyBrief({ lines, name }: { lines: readonly BriefLine[]; name: string }) {
  if (lines.length === 0) return null;

  return (
    <section aria-labelledby="brief-heading" className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <div className="flex items-center gap-3">
        <MascotArt state="neutral" className="size-9 shrink-0" />
        <div>
          <h2 id="brief-heading" className="text-[1.0625rem] font-semibold text-ink-950">Your brief</h2>
          <p className="text-[0.8125rem] text-ink-500">What matters today, {name}.</p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-ink-100">
        {lines.map((line) => {
          const Icon = BRIEF_ICON[line.kind];
          return (
            <li key={`${line.kind}-${line.text}`}>
              <Link href={line.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-paper-2">
                <Icon className="size-4 shrink-0 text-ink-400" strokeWidth={2} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] leading-snug text-ink-900">{line.text}</span>
                  {line.detail ? <span className="mt-0.5 block text-[0.8125rem] text-ink-500">{line.detail}</span> : null}
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-300" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* LifeOps peek                                                                */
/* -------------------------------------------------------------------------- */

export function LifeOpsPeek({
  items,
  slipped,
  budgetAfterTodayCents,
  where,
  timeLabels,
}: {
  items: readonly LifeOpsItem[];
  slipped: number;
  budgetAfterTodayCents: number | null;
  where: { currency: string; locale: string };
  timeLabels: Record<string, string | null>;
}) {
  return (
    <section aria-labelledby="lifeops-heading" className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="lifeops-heading" className="text-[1.0625rem] font-semibold text-ink-950">Your day</h2>
          <p className="text-[0.8125rem] text-ink-500">
            {items.length === 0 ? "Nothing dated today." : `${items.length} ${items.length === 1 ? "thing" : "things"} on the timeline`}
            {slipped > 0 ? ` · ${slipped} slipped` : ""}
          </p>
        </div>
        <Link href="/lifeops" className="flex shrink-0 items-center gap-1 text-[0.875rem] font-medium text-ink-600 hover:text-ink-950">
          LifeOps
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {items.length > 0 ? (
        <ol className="mt-3 divide-y divide-ink-100">
          {items.slice(0, 4).map((item) => (
            <li key={item.key}>
              <Link href={item.href ?? "/lifeops"} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-paper-2">
                <span className="tnum w-12 shrink-0 font-mono text-[0.8125rem] text-ink-500">{timeLabels[item.key] ?? "—"}</span>
                <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-ink-900">{item.title}</span>
                {item.priceCents !== null && item.priceCents > 0 ? (
                  <span className="tnum shrink-0 font-mono text-[0.8125rem] text-ink-600">{money(item.priceCents / 100, where)}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-[0.875rem] text-ink-600">
          Deadlines, classes, payments and plans land here.{" "}
          <Link href="/lifeops" className="font-medium text-ink-900 underline underline-offset-4">Add one.</Link>
        </p>
      )}

      {budgetAfterTodayCents !== null && items.some((item) => (item.priceCents ?? 0) > 0) ? (
        <p className="mt-3 border-t border-ink-100 pt-3 text-[0.8125rem] text-ink-600">
          After today&rsquo;s plans: <span className={cn("tnum font-mono font-semibold", budgetAfterTodayCents < 0 ? "text-pulse-deep" : "text-ink-900")}>{money(budgetAfterTodayCents / 100, where)}</span> left of today&rsquo;s number.
        </p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Mission card                                                                */
/* -------------------------------------------------------------------------- */

export function MissionCard({
  mission,
}: {
  mission: { id: string; title: string; emoji: string; done: number; total: number; nextStep: string | null; budgetLabel: string | null } | null;
}) {
  if (!mission) {
    return (
      <Link href="/missions" className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
        <MascotArt state="explorer" className="size-10 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-ink-950">Start a mission</span>
          <span className="mt-0.5 block text-[0.8125rem] text-ink-500">Weekend under budget, meet 3 people, zero-euro Sunday. Built from real rows.</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-ink-400" />
      </Link>
    );
  }
  return (
    <Link href={`/missions/${mission.id}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-signal-soft text-xl">{mission.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[0.9375rem] font-semibold text-ink-950">{mission.title}</span>
          <span className="tnum shrink-0 font-mono text-[0.75rem] text-ink-500">{mission.done}/{mission.total}</span>
        </span>
        <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-500">
          {mission.nextStep ? `Next: ${mission.nextStep}` : "All steps done"}
          {mission.budgetLabel ? ` · ${mission.budgetLabel}` : ""}
        </span>
        <Meter value={(mission.done / Math.max(1, mission.total)) * 100} accent="mint" className="mt-2" label={`${mission.title} progress`} />
      </span>
      <ArrowRight className="size-4 shrink-0 text-ink-400" />
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Right now                                                                   */
/* -------------------------------------------------------------------------- */

export function RightNowStrip({ items }: { items: readonly RightNowItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="now-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative grid size-2 place-items-center">
            <span className="absolute size-2 rounded-full bg-pulse animate-ping-soft" />
            <span className="size-2 rounded-full bg-pulse" />
          </span>
          <h2 id="now-heading" className="text-[1.0625rem] font-semibold text-ink-950">Right now</h2>
        </div>
        <Link href="/discover?tab=right-now" className="flex shrink-0 items-center gap-1 text-[0.875rem] font-medium text-ink-600 hover:text-ink-950">
          More
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="w-[16rem] shrink-0 sm:w-auto">
            <Link
              href={item.href}
              className={cn(
                "flex h-full flex-col rounded-xl p-4 ring-1 transition-shadow hover:shadow-[var(--shadow-raise)]",
                item.kind === "happening" && "bg-pulse-soft/70 ring-pulse-deep/15",
                item.kind === "free-now" && "bg-mint-soft/70 ring-mint-deep/15",
                item.kind === "soon" && "bg-white ring-ink-950/6",
                item.kind === "filling" && "bg-signal-soft/70 ring-signal-deep/15",
                item.kind === "posted" && "bg-white ring-ink-950/6",
              )}
            >
              <span className="flex items-center gap-1.5 font-mono text-micro uppercase tracking-[0.1em] text-ink-500">
                <Zap className="size-3" />
                {rightNowKindLabel[item.kind]}
              </span>
              <span className="mt-1.5 line-clamp-2 text-[0.9375rem] leading-snug font-semibold text-ink-950">{item.title}</span>
              <span className="mt-1 text-[0.8125rem] text-ink-600">{item.meta}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHead({
  title,
  hint,
  href,
  hrefLabel = "See all",
}: {
  title: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[1.0625rem] font-semibold text-ink-950">{title}</h2>
        {hint ? <p className="mt-0.5 text-[0.8125rem] text-ink-500">{hint}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="flex shrink-0 items-center gap-1 text-[0.875rem] font-medium text-ink-600 hover:text-ink-950">
          {hrefLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
