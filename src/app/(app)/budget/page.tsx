import { ArrowRight, Calculator, LifeBuoy, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  AddTransaction,
  CategoryMeter,
  RecurringForm,
  RecurringRow,
  TransactionRow,
} from "@/components/app/budget-ui";
import { Upsell, UpsellLine } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { placesForCity } from "@/data/places";
import { recordUpgradeTrigger } from "@/server/actions/upgrade";
import { categoryLabel, defaultCategories } from "@/server/engines/budget";
import { findSavings } from "@/server/engines/savings";
import { findMany } from "@/server/db";
import { insightFor, loadMoney } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { cn, currencySymbol, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Budget",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * BUDGET
 * ----------------------------------------------------------------------------
 * Consumer finance, not accounting. One dark card with the four numbers that
 * matter, then categories, then the things that repeat, then history.
 *
 * Free is genuinely useful: envelopes, transactions, recurring costs, safe to
 * spend, the week. Paid adds intelligence over the same rows, shown in place
 * as a partial preview or a single value-first card — never a wall of locks.
 * ============================================================================
 */
export default async function BudgetPage() {
  const viewer = await requireViewer();
  const now = requestDate();
  const where = viewer.currency;
  const symbol = currencySymbol(where.currency, where.locale);
  const can = viewer.entitlements.can;
  const fmt = (cents: number) => money(cents / 100, where);

  const [money$, recurring, prices] = await Promise.all([
    loadMoney(viewer.user.id, now),
    findMany("recurring", (row) => row.userId === viewer.user.id && row.active),
    findMany("priceObservations", (row) => row.citySlug === viewer.profile.citySlug),
  ]);

  const reading = money$.reading;
  const insight = insightFor(reading, fmt);
  const unset = reading.plannedCents === 0;

  const categories =
    reading.categories.length > 0
      ? reading.categories.map((entry) => ({ key: entry.category, label: entry.label }))
      : defaultCategories.map((entry) => ({ key: entry.key, label: entry.label }));

  /* ---- savings (Plus): computed for everyone, shown in full to Plus ------ */
  const savings = findSavings({
    now,
    transactions: money$.transactions,
    places: placesForCity(viewer.profile.citySlug),
    priceObservations: prices,
    maxWalkMinutes: viewer.profile.maxTravelMinutes * 1.6,
    formatMoney: fmt,
  });
  const topSaving = savings[0] ?? null;

  const manyTransactions = money$.transactions.length >= 15;
  if (manyTransactions && !can.budgetCoach) await recordUpgradeTrigger("many-transactions");
  if (!unset && now.getUTCDate() >= 5 && !can.budgetForecast) await recordUpgradeTrigger("forecast-peek");

  const spentFraction = reading.plannedCents === 0 ? 0 : Math.min(1, reading.spentCents / reading.plannedCents);

  return (
    <div className="page max-w-3xl py-6 sm:py-8">
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400 capitalize">
            {now.toLocaleDateString(where.locale, { month: "long", year: "numeric" })} · {reading.daysLeft} days left
          </p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">Budget</h1>
        </div>
        <Link href="/budget/setup" className="shrink-0 text-[0.875rem] font-medium text-ink-600 hover:text-ink-950">
          Edit
        </Link>
      </header>

      {/* ---- the four numbers ---------------------------------------------- */}
      {unset ? (
        <section className="flex flex-col items-center rounded-2xl bg-ink-950 p-6 text-center text-paper sm:flex-row sm:text-left">
          <MascotArt state="thinking" className="size-16 shrink-0" />
          <div className="mt-4 flex-1 sm:mt-0 sm:ml-5">
            <h2 className="text-[1.125rem] font-semibold">Want StudentOS to tell you what you can safely spend?</h2>
            <p className="mt-1 text-[0.9375rem] text-paper/70">One monthly number. It becomes a daily figure, and every recommendation gets a price check.</p>
          </div>
          <Link href="/budget/setup" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-signal px-5 py-2.5 text-[0.9375rem] font-semibold text-ink-950 sm:mt-0 sm:ml-5">
            Set budget
            <ArrowRight className="size-4" />
          </Link>
        </section>
      ) : (
        <section className="rounded-2xl bg-ink-950 p-5 text-paper sm:p-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">Monthly budget</p>
              <p className="tnum mt-1 font-display text-[2rem] leading-none font-semibold tracking-tight sm:text-[2.5rem]">{fmt(reading.plannedCents)}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">Safe today</p>
              <p className="tnum mt-1 font-display text-[2rem] leading-none font-semibold tracking-tight text-signal sm:text-[2.5rem]">{fmt(reading.safeTodayCents)}</p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-paper/12">
            <div className={cn("h-full rounded-full transition-[width] duration-500", reading.overPace ? "bg-amber" : "bg-mint")} style={{ width: `${spentFraction * 100}%` }} />
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <dt className="font-mono text-micro uppercase tracking-[0.1em] text-paper/55">Spent</dt>
              <dd className="tnum mt-0.5 font-mono text-[1.125rem] font-semibold">{fmt(reading.spentCents)}</dd>
            </div>
            <div>
              <dt className="font-mono text-micro uppercase tracking-[0.1em] text-paper/55">Remaining</dt>
              <dd className="tnum mt-0.5 font-mono text-[1.125rem] font-semibold">{fmt(Math.max(0, reading.remainingCents))}</dd>
            </div>
            <div>
              <dt className="font-mono text-micro uppercase tracking-[0.1em] text-paper/55">Still to come out</dt>
              <dd className="tnum mt-0.5 font-mono text-[1.125rem] font-semibold">{fmt(reading.committedCents)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex items-start gap-3 border-t border-paper/12 pt-4">
            <MascotArt state={insight.tone === "good" ? "neutral" : insight.tone === "watch" ? "thinking" : "warning"} className="size-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] leading-snug text-paper/90">{insight.headline}</p>
              {insight.action ? (
                <Link href={insight.action.href} className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-signal underline underline-offset-4">
                  {insight.action.label}
                  <ArrowRight className="size-3" />
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* ---- quick tools --------------------------------------------------- */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/budget/afford" className="flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mint-soft"><Calculator className="size-5 text-mint-deep" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold text-ink-950">Can I afford this?</span>
            <span className="mt-0.5 block text-[0.8125rem] text-ink-500">Type a spend, get yes, possibly or not ideal.</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-ink-400" />
        </Link>
        <Link href="/budget/survival" className="flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-flow-soft"><LifeBuoy className="size-5 text-flow-deep" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold text-ink-950">Make it last</span>
            <span className="mt-0.5 block text-[0.8125rem] text-ink-500">What you have, until when. Survival Mode builds the plan.</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-ink-400" />
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="space-y-6">
          {/* ---- insight that leads to action ------------------------------- */}
          {topSaving ? (
            can.cheaperAlternatives ? (
              <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
                <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Spend less this week</p>
                <h2 className="mt-1.5 text-[1.0625rem] font-semibold text-ink-950">{topSaving.headline}</h2>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-600">{topSaving.detail}</p>
                <ul className="mt-3 divide-y divide-ink-100">
                  {topSaving.alternatives.map((alt) => (
                    <li key={alt.placeId}>
                      <Link href={`/discover/${alt.placeId}`} className="flex items-center gap-3 py-2.5 hover:bg-paper-2">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.9375rem] font-medium text-ink-900">{alt.name}</span>
                          <span className="block text-[0.8125rem] text-ink-500">{alt.walkMinutes} min walk{alt.verifiedBy >= 10 ? ` · ${alt.verifiedBy} confirmed` : ""}</span>
                        </span>
                        <span className="tnum font-mono text-[0.9375rem] font-semibold text-mint-deep">{fmt(alt.priceCents)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <Upsell
                feature="cheaperAlternatives"
                line={`You are averaging ${fmt(topSaving.averageCents)} on ${topSaving.label.toLowerCase()}. There are ${topSaving.alternatives.length} places near you students rate well at around ${fmt(topSaving.alternativeAverageCents)}. Plus names them, with the weekly difference.`}
              />
            )
          ) : manyTransactions && !can.budgetCoach ? (
            <Upsell
              feature="budgetCoach"
              line={`${money$.transactions.length} transactions logged. That is enough for a weekly read on where the money actually goes and what to change.`}
            />
          ) : null}

          {/* ---- week ------------------------------------------------------- */}
          {!unset ? (
            <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[1.0625rem] font-semibold text-ink-950">This week</h2>
                <span className="tnum font-mono text-[0.875rem] text-ink-500">
                  {fmt(money$.week.spentCents)} of {fmt(money$.week.targetCents)}
                </span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500", money$.week.spentCents > money$.week.targetCents ? "bg-pulse" : money$.week.spentCents > money$.week.targetCents * 0.85 ? "bg-amber" : "bg-mint")}
                  style={{ width: `${Math.min(100, money$.week.targetCents === 0 ? 0 : (money$.week.spentCents / money$.week.targetCents) * 100)}%` }}
                />
              </div>
              <p className="mt-2.5 text-[0.875rem] text-ink-600">
                {money$.week.remainingCents >= 0
                  ? `${fmt(money$.week.remainingCents)} left for the week.`
                  : `${fmt(Math.abs(money$.week.remainingCents))} over for the week.`}
              </p>
            </section>
          ) : null}

          {/* ---- categories ------------------------------------------------ */}
          <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            <div className="mb-1 flex items-baseline justify-between gap-4">
              <h2 className="text-[1.0625rem] font-semibold text-ink-950">Where it goes</h2>
              <Link href="/budget/setup" className="text-[0.875rem] font-medium text-ink-600 hover:text-ink-950">Edit</Link>
            </div>
            {reading.categories.length === 0 ? (
              <p className="py-6 text-center text-[0.9375rem] text-ink-500">Set a monthly budget and the categories appear here.</p>
            ) : (
              <div className="divide-y divide-ink-100">
                {reading.categories.map((category) => (
                  <CategoryMeter key={category.category} label={category.label} spentCents={category.spentCents} plannedCents={category.plannedCents} pacedCents={category.pacedCents} where={where} />
                ))}
              </div>
            )}
            {!unset && !can.customBudgetCategories ? (
              <UpsellLine feature="customBudgetCategories" line="Budget the way you actually spend, with your own categories." className="mt-3" />
            ) : null}
          </section>

          {/* ---- forecast: full for Pro, honest preview otherwise ---------- */}
          {!unset ? (
            can.budgetForecast ? (
              <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
                <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold text-ink-950">
                  <TrendingUp className="size-4.5 text-flow-deep" />
                  Where this month lands
                </h2>
                {!money$.forecast.confident ? (
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-600">
                    {money$.forecast.basisDays} {money$.forecast.basisDays === 1 ? "day" : "days"} of spending is not enough to project from yet. This fills in around day five.
                  </p>
                ) : (
                  <>
                    <p className="tnum mt-3 font-mono text-[1.75rem] leading-none font-semibold text-ink-950">{fmt(money$.forecast.projectedCents)}</p>
                    <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-600">
                      At your current pace, including what is still due to come out. That is{" "}
                      <span className={money$.forecast.projectedDeltaCents >= 0 ? "font-medium text-mint-deep" : "font-medium text-pulse-deep"}>
                        {fmt(Math.abs(money$.forecast.projectedDeltaCents))} {money$.forecast.projectedDeltaCents >= 0 ? "under" : "over"}
                      </span>{" "}
                      your budget. Averaging {fmt(money$.forecast.requiredDailyCents)} a day keeps you on target.
                    </p>
                  </>
                )}
              </section>
            ) : (
              <Upsell
                feature="budgetForecast"
                line={
                  money$.forecast.confident
                    ? `At your current pace of about ${fmt(money$.forecast.currentDailyCents)} a day, Pro shows where the month lands and what tonight does to it.`
                    : "Once there are five days of spending, Pro shows where the month lands at your current pace."
                }
                preview={[
                  { label: "Where this month lands", hint: "At your current pace" },
                  { label: "Under or over your budget" },
                  { label: "What you would need to average per day" },
                ]}
              />
            )
          ) : null}

          {/* ---- history --------------------------------------------------- */}
          <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Recent</h2>
            {money$.transactions.length === 0 ? (
              <p className="py-6 text-center text-[0.9375rem] text-ink-500">Nothing logged yet. Add the last thing you bought.</p>
            ) : (
              <ul>
                {money$.transactions.slice(0, 20).map((tx) => (
                  <TransactionRow key={tx.id} id={tx.id} label={tx.merchant ?? categoryLabel(tx.category)} category={categoryLabel(tx.category)} amountCents={tx.amountCents} spentAt={tx.spentAt} where={where} />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---- right column ------------------------------------------------ */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <AddTransaction categories={categories} symbol={symbol} />

          <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[1.0625rem] font-semibold text-ink-950">Repeating</h2>
              <span className="tnum font-mono text-[0.8125rem] text-ink-500">{fmt(reading.committedCents)} still due</span>
            </div>
            <p className="mt-0.5 text-[0.8125rem] text-ink-500">Rent, phone, gym. Subtracted before anything is called safe.</p>
            {recurring.length > 0 ? (
              <ul className="mt-3 divide-y divide-ink-100">
                {recurring.map((row) => (
                  <RecurringRow key={row.id} id={row.id} label={row.label} amountCents={row.amountCents} cadence={row.cadence} where={where} />
                ))}
              </ul>
            ) : null}
            <div className="mt-3">
              <RecurringForm categories={categories} symbol={symbol} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
