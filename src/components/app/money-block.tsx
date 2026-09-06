import { ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";

import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";
import type { BudgetInsight, BudgetReading } from "@/server/engines/budget";
import { safeUntil } from "@/server/engines/budget";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * MONEY BLOCK
 * ----------------------------------------------------------------------------
 * The headline number on Home, and the most important object in the product.
 *
 * A student opens this app before saying yes to something. The question is
 * always "can I?", and the answer has to be one number, large, with no
 * arithmetic left for them to do. Everything else — categories, history,
 * charts — belongs on the Budget screen, and putting any of it here would bury
 * the one figure that matters under accounting.
 *
 * SAFE TODAY is `availableCents / daysLeft`: money genuinely free to spend
 * after committed recurring charges, spread over the rest of the month. It is
 * not "remaining ÷ days", which would promise money that rent is going to take.
 * ============================================================================
 */

export function MoneyBlock({
  reading,
  insight,
  where,
  now = new Date(),
  showOpenLink = true,
}: {
  reading: BudgetReading;
  insight: BudgetInsight;
  where: { currency: string; locale: string };
  now?: Date;
  /** Off on the Budget screen itself, where the link points at the page you
      are already on. */
  showOpenLink?: boolean;
}) {
  /* The unset state is a different screen, not a zero. Showing "€0 safe today"
     to someone who never set a budget is alarming and wrong. */
  if (reading.plannedCents === 0) {
    return (
      <section className="rounded-xl border border-ink-200 bg-white p-5 shadow-[var(--shadow-raise)]">
        <div className="flex items-start gap-4">
          <MascotArt state="thinking" className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.0625rem] font-semibold text-ink-950">
              Want to know what you can safely spend?
            </h2>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-600">
              Set one number and {"we"}ll turn it into a daily figure you can actually use.
            </p>
            <ButtonLink href="/budget/setup" variant="primary" size="sm" className="mt-3.5">
              Set a budget
              <ArrowRight className="size-3.5" />
            </ButtonLink>
          </div>
        </div>
      </section>
    );
  }

  /* "Safe until Monday" — or Sunday, when today is Monday. A horizon a student
     actually plans against, rather than an abstract month end. */
  const horizon = nextHorizon(now);
  const horizonCents = safeUntil(reading, now, horizon.date);

  return (
    <section className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-[var(--shadow-raise)]">
      <div className="grid grid-cols-2 divide-x divide-ink-200 sm:grid-cols-3">
        <Figure
          label="Safe today"
          value={money(reading.safeTodayCents / 100, where)}
          emphasis
        />
        <Figure
          label={`Safe until ${horizon.label}`}
          value={money(horizonCents / 100, where)}
        />
        <Figure
          label="Left this month"
          value={money(Math.max(0, reading.remainingCents) / 100, where)}
          className="col-span-2 border-t border-ink-200 sm:col-span-1 sm:border-t-0"
        />
      </div>

      {/* ---- insight ------------------------------------------------------
          One sentence, always with a number, never a telling-off. */}
      <div
        className={cn(
          "flex items-start gap-3 border-t border-ink-200 px-5 py-3.5",
          insight.tone === "good" && "bg-mint-soft/50",
          insight.tone === "watch" && "bg-amber-soft/50",
          insight.tone === "tight" && "bg-pulse-soft/50",
        )}
      >
        <MascotArt
          state={
            insight.tone === "good" ? "neutral" : insight.tone === "watch" ? "thinking" : "warning"
          }
          className="size-8 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] leading-snug text-ink-800">{insight.headline}</p>
          {insight.action ? (
            <Link
              href={insight.action.href}
              className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink-950 underline underline-offset-4"
            >
              {insight.action.label}
              <ArrowRight className="size-3" />
            </Link>
          ) : null}
        </div>
      </div>

      {showOpenLink ? (
        <Link
          href="/budget"
          className="flex items-center justify-between border-t border-ink-200 px-5 py-3 text-[0.875rem] font-medium text-ink-700 transition-colors hover:bg-paper-2 hover:text-ink-950"
        >
          <span className="flex items-center gap-2">
            <Wallet className="size-4" strokeWidth={2} />
            Open budget
          </span>
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Parts                                                                       */
/* -------------------------------------------------------------------------- */

function Figure({
  label,
  value,
  emphasis = false,
  className,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("px-5 py-4", className)}>
      <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{label}</dt>
      <dd
        className={cn(
          "tnum mt-1 font-mono font-semibold text-ink-950",
          emphasis ? "text-[1.75rem] leading-none" : "text-[1.25rem] leading-none",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The horizon a student plans against.
 *
 * Monday for most of the week — "can I make it to Monday" is the question
 * people actually ask. On a Monday it points at Sunday instead, because
 * "safe until Monday" on a Monday is a week away and reads as a bug.
 */
function nextHorizon(now: Date): { label: string; date: Date } {
  const day = now.getDay(); // 0 = Sunday
  const target = day === 1 ? 0 : 1; // Monday -> Sunday, otherwise Monday
  const delta = (target - day + 7) % 7 || 7;

  const date = new Date(now);
  date.setDate(date.getDate() + delta);
  date.setHours(23, 59, 59, 999);

  return { label: target === 1 ? "Monday" : "Sunday", date };
}
