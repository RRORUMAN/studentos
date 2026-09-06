import {
  ArrowRight,
  Calculator,
  CalendarDays,
  ChevronRight,
  Compass,
  Gift,
  LifeBuoy,
  MapPin,
  Moon,
  ShoppingBasket,
  Sparkles,
  UsersRound,
  Utensils,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";
import type { BriefLine } from "@/server/engines/brief";
import type { BudgetReading } from "@/server/engines/budget";
import type { QuickAction } from "@/server/engines/quick-actions";
import type { RightNowItem } from "@/server/engines/right-now";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * HOME BLOCKS
 * ----------------------------------------------------------------------------
 * The pieces of the daily screen that are not the feed: the money summary, the
 * brief, the quick actions and the "right now" strip. Server components; the
 * only interactivity is a link.
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
        <MascotArt state="thinking" className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[1.0625rem] font-semibold">Want to know what you can safely spend?</p>
          <p className="mt-1 text-[0.875rem] text-paper/70">
            One number becomes a daily figure, and every recommendation gets a price check.
          </p>
        </div>
        <ButtonLink href="/budget/setup" variant="signal" size="sm" className="shrink-0">
          Set budget
        </ButtonLink>
      </section>
    );
  }

  const weekLeft = Math.max(0, weekTargetCents - weekSpentCents);

  return (
    <section className="rounded-2xl bg-ink-950 p-5 text-paper sm:p-6">
      <div className="grid grid-cols-2 gap-6">
        <Link href="/budget" className="group min-w-0">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">Safe today</p>
          <p className="tnum mt-1.5 font-display text-[2.25rem] leading-none font-semibold tracking-tight text-signal sm:text-[2.75rem]">
            {money(reading.safeTodayCents / 100, where)}
          </p>
        </Link>
        <Link href="/budget" className="group min-w-0">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">
            Safe this week
          </p>
          <p className="tnum mt-1.5 font-display text-[2.25rem] leading-none font-semibold tracking-tight text-paper sm:text-[2.75rem]">
            {money(weekLeft / 100, where)}
          </p>
        </Link>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-paper/12 pt-4">
        <p className="text-[0.9375rem] leading-snug text-paper/85">{sentence}</p>
        <Link
          href="/budget"
          aria-label="Open budget"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-paper/10 text-paper transition-colors hover:bg-paper/20"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
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
  task: MapPin,
  people: UsersRound,
  pulse: Sparkles,
};

export function DailyBrief({ lines, name }: { lines: readonly BriefLine[]; name: string }) {
  if (lines.length === 0) return null;

  return (
    <section aria-labelledby="brief-heading" className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <div className="flex items-center gap-3">
        <MascotArt state="neutral" className="size-9 shrink-0" />
        <div>
          <h2 id="brief-heading" className="text-[1.0625rem] font-semibold text-ink-950">
            Your brief
          </h2>
          <p className="text-[0.8125rem] text-ink-500">What matters today, {name}.</p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-ink-100">
        {lines.map((line) => {
          const Icon = BRIEF_ICON[line.kind];
          return (
            <li key={`${line.kind}-${line.text}`}>
              <Link
                href={line.href}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-paper-2"
              >
                <Icon className="size-4 shrink-0 text-ink-400" strokeWidth={2} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] leading-snug text-ink-900">{line.text}</span>
                  {line.detail ? (
                    <span className="mt-0.5 block text-[0.8125rem] text-ink-500">{line.detail}</span>
                  ) : null}
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
/* Right now                                                                   */
/* -------------------------------------------------------------------------- */

export function RightNowStrip({ items }: { items: readonly RightNowItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="now-heading">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative grid size-2 place-items-center">
          <span className="absolute size-2 rounded-full bg-pulse animate-ping-soft" />
          <span className="size-2 rounded-full bg-pulse" />
        </span>
        <h2 id="now-heading" className="text-[1.0625rem] font-semibold text-ink-950">
          Right now
        </h2>
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
                {item.kind === "happening"
                  ? "Happening now"
                  : item.kind === "free-now"
                    ? "Free, starting soon"
                    : item.kind === "soon"
                      ? "Starting soon"
                      : item.kind === "filling"
                        ? "Filling up"
                        : "Just posted"}
              </span>
              <span className="mt-1.5 line-clamp-2 text-[0.9375rem] leading-snug font-semibold text-ink-950">
                {item.title}
              </span>
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
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 text-[0.875rem] font-medium text-ink-600 hover:text-ink-950"
        >
          {hrefLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
