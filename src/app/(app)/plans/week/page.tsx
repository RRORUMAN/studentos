import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SaveWeekButton } from "@/components/app/week-controls";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { recordUpgradeTrigger } from "@/server/actions/upgrade";
import { planWeek, type WeekDial, weekDialMeta } from "@/server/engines/week";
import { loadPlaces, loadRecommendContext, loadScoredEvents } from "@/server/queries/discovery";
import { loadMoney } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Plan my week",
  robots: { index: false, follow: false },
};

const DIALS: readonly WeekDial[] = ["cheaper", "social", "free", "active", "less-travel"];

/**
 * ============================================================================
 * SMART WEEK
 * ----------------------------------------------------------------------------
 * Two to four things across the coming week, inside the budget, one per day at
 * most. The dials re-run the same selection with shifted weights, so the plan
 * changes instantly and predictably.
 *
 * Free sees a genuine preview: the first two picks, and the reasoning. Plus
 * unlocks the whole week, the dials and saving it as a plan — value first, then
 * the price.
 * ============================================================================
 */
export default async function WeekPage(props: PageProps<"/plans/week">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();
  const where = viewer.currency;
  const unlocked = viewer.entitlements.can.weeklyPlanner;

  const rawDials = Array.isArray(params.dial) ? params.dial : params.dial ? [params.dial] : [];
  const dials = unlocked ? (rawDials.filter((dial) => DIALS.includes(dial as WeekDial)) as WeekDial[]) : [];

  const money$ = await loadMoney(viewer.user.id, now);
  const context = await loadRecommendContext({
    userId: viewer.user.id,
    profile: viewer.profile,
    budgetCents: money$.unset ? null : money$.reading.safeTodayCents,
    now,
  });

  const [events, places] = await Promise.all([
    loadScoredEvents(viewer.user.id, context, { when: "week" }),
    loadPlaces(context),
  ]);

  const plan = planWeek({
    now,
    events,
    places,
    weekBudgetCents: money$.unset ? null : money$.reading.safeThisWeekCents,
    dials,
    formatMoney: (cents) => money(cents / 100, where),
  });

  const visible = unlocked ? plan.items : plan.items.slice(0, 2);
  const hidden = plan.items.length - visible.length;
  if (!unlocked) await recordUpgradeTrigger("complex-plan");

  const urlWith = (toggle: WeekDial) => {
    const next = dials.includes(toggle) ? dials.filter((dial) => dial !== toggle) : [...dials, toggle];
    const qs = next.map((dial) => `dial=${dial}`).join("&");
    return qs ? `/plans/week?${qs}` : "/plans/week";
  };

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href="/plans" className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        Plans
      </Link>

      <header className="flex items-start gap-4">
        <MascotArt state="survival" className="size-14 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Your week</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            {plan.summary} At most one thing a day — a planner that fills every evening is one you ignore by Wednesday.
          </p>
        </div>
      </header>

      {/* ---- dials ---------------------------------------------------------- */}
      <div className="mt-5 flex flex-wrap gap-2">
        {DIALS.map((dial) => {
          const active = dials.includes(dial);
          return (
            <Link
              key={dial}
              href={unlocked ? urlWith(dial) : "/upgrade?feature=weeklyPlanner"}
              aria-pressed={active}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-3.5 text-[0.875rem] font-medium transition-colors",
                active ? "bg-ink-950 text-paper" : unlocked ? "bg-white text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20" : "bg-paper-2 text-ink-400",
              )}
            >
              {weekDialMeta[dial]}
            </Link>
          );
        })}
      </div>

      {/* ---- the week ------------------------------------------------------- */}
      <ol className="mt-5 space-y-3">
        {visible.map((item) => (
          <li key={`${item.kind}-${item.refId}`}>
            <Link href={item.href} className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
              <span className="w-14 shrink-0 text-center">
                <span className="block font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                  {new Date(item.dateIso).toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
                <span className="tnum block font-display text-[1.5rem] leading-none font-semibold text-ink-950">
                  {new Date(item.dateIso).getDate()}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold text-ink-950">{item.title}</span>
                <span className="mt-0.5 block text-[0.8125rem] text-ink-500">{item.detail}</span>
                {item.reasons.length > 0 ? <span className="mt-1.5 block text-[0.8125rem] text-ink-600">{item.reasons.slice(0, 2).join(" · ")}</span> : null}
              </span>
              <span className={cn("tnum shrink-0 font-mono text-[0.9375rem] font-semibold", item.priceCents === 0 ? "text-mint-deep" : "text-ink-900")}>
                {item.priceCents === 0 ? "Free" : money(item.priceCents / 100, where)}
              </span>
            </Link>
          </li>
        ))}
        {hidden > 0 ? (
          <li className="rounded-2xl border border-dashed border-ink-300 bg-paper-2/60 p-4 text-center text-[0.875rem] text-ink-600">
            {hidden} more {hidden === 1 ? "pick" : "picks"} for later in the week, inside the same budget.
          </li>
        ) : null}
      </ol>

      {plan.items.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl bg-white px-5 py-10 text-center ring-1 ring-ink-950/6">
          <MascotArt state="empty" className="size-16" />
          <p className="mt-4 text-[0.9375rem] text-ink-700">Nothing fits those settings this week. Loosen a dial, or check what is on.</p>
          <Link href="/events?tab=week" className="mt-4 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper">This week&rsquo;s events</Link>
        </div>
      ) : null}

      <div className="mt-6">
        {unlocked ? (
          plan.items.length > 0 ? <SaveWeekButton items={plan.items} weekStartIso={now.toISOString()} budgetCents={plan.budgetCents} /> : null
        ) : (
          <Upsell
            feature="weeklyPlanner"
            line={`The two picks above are real and inside ${money$.unset ? "your week" : money(Math.floor(money$.reading.safeThisWeekCents * 0.7) / 100, where)}. Plus builds the whole week, lets you dial it cheaper, more social, more free or more active, and saves it as a plan you can share.`}
          />
        )}
      </div>
    </div>
  );
}
