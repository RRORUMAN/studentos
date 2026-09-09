import {
  ArrowRight,
  Calculator,
  ChevronRight,
  LifeBuoy,
  Plane,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  CategoryBar,
  MonthBar,
  MonthTrend,
  TrajectorySparkline,
  WeekBars,
} from "@/components/app/budget-charts";
import { SubscriptionsPanel, type DetectedView, type SubscriptionView } from "@/components/app/budget-subscriptions";
import { BudgetTelemetry } from "@/components/app/budget-telemetry";
import { AddTransaction, BudgetHistory, type HistoryGroup } from "@/components/app/budget-ui";
import { IncomeBridge } from "@/components/app/income-bridge";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import type { Feature } from "@/config/entitlements";
import {
  categoryDealKinds,
  categoryLabel,
  defaultCategories,
  groupTransactionsByDay,
  isTripCategory,
} from "@/server/engines/budget";
import { quotaFor } from "@/config/entitlements";
import {
  chartsFor,
  detectedSubscriptions,
  insightFor,
  loadMoney,
  loadSpendHistory,
  loadSpendLess,
} from "@/server/queries/money";
import { formatDistance, priceLevelLabel } from "@/domain/places";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtDay } from "@/lib/dates";
import { cn, currencySymbol, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Budget",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * BUDGET
 * ----------------------------------------------------------------------------
 * Consumer finance, not accounting.
 *
 * The screen answers one question — "what can I spend?" — and then gives every
 * number underneath it something to do. The order is deliberate:
 *
 *   1. Log a spend. The most repeated action in the product is the first
 *      control on the page and stays reachable as it scrolls.
 *   2. Safe to spend today, safe to spend this week, and the month bar with its pace marker.
 *   3. One sentence about what that means, with a link somewhere else.
 *   4. Categories, then the concrete cheaper things in the drifting one.
 *   5. What repeats, what the weeks look like, where the month lands.
 *   6. What was actually spent, by day, correctable.
 *
 * Free is genuinely useful: envelopes, transactions, repeating costs, safe to
 * spend, the week, the history. Paid adds intelligence over the same rows —
 * and there is exactly ONE upsell on this screen, chosen by whichever locked
 * feature this student's own data would benefit from most. A screen with three
 * paywalls on it is a shop, not a budget.
 * ============================================================================
 */
export default async function BudgetPage() {
  const viewer = await requireViewer();
  const now = requestDate();
  const where = viewer.currency;
  const zone = viewer.city.timezone;
  const symbol = currencySymbol(where.currency, where.locale);
  const can = viewer.entitlements.can;
  const fmt = (cents: number) => money(cents / 100, where);

  const money$ = await loadMoney(viewer.user.id, now);
  const reading = money$.reading;
  const unset = money$.unset;

  const insight = insightFor(reading, fmt);
  const charts = chartsFor(money$, now);
  const detected = detectedSubscriptions(money$, now);

  /* Trends are Plus, and the history quota decides how far back the rows are
     even loaded — a free student's twelfth month is never sent to a browser
     that is not entitled to render it. */
  const history = can.spendingTrends
    ? await loadSpendHistory(viewer.user.id, quotaFor(viewer.entitlements.plan).historyMonths, now)
    : [];

  const spendLess = unset
    ? null
    : await loadSpendLess({
        userId: viewer.user.id,
        citySlug: viewer.profile.citySlug,
        reading,
        transactions: money$.transactions,
        maxWalkMinutes: viewer.profile.maxTravelMinutes * 1.6,
        now,
        formatMoney: fmt,
        dealKinds: (category) => categoryDealKinds[category] ?? [],
      });

  const categories =
    reading.categories.length > 0
      ? reading.categories.map((entry) => ({ key: entry.category, label: entry.label }))
      : defaultCategories.map((entry) => ({ key: entry.key, label: entry.label }));

  /* ---- the single upsell ------------------------------------------------
     Ordered by how much this student's own rows would gain from it, so the
     one paywall they see is about their situation and not about our pricing
     page. `null` when there is nothing worth offering. */
  const manyTransactions = money$.transactions.length >= 15;
  const upsell: Feature | null = unset
    ? null
    : !can.budgetForecast && money$.forecast.confident
      ? "budgetForecast"
      : !can.cheaperAlternatives && spendLess?.opportunity
        ? "cheaperAlternatives"
        : !can.subscriptionDetection && detected.length > 0
          ? "subscriptionDetection"
          : !can.weeklyTargets
            ? "weeklyTargets"
            : !can.budgetCoach && manyTransactions
              ? "budgetCoach"
              : !can.spendBenchmarks && spendLess?.benchmark?.comparison
                ? "spendBenchmarks"
                : null;

  const upsellLine =
    upsell === "budgetForecast"
      ? `At about ${fmt(money$.forecast.currentDailyCents)} a day, Pro shows where this month lands and what tonight does to it.`
      : upsell === "cheaperAlternatives" && spendLess?.opportunity
        ? `You are averaging ${fmt(spendLess.opportunity.averageCents)} on ${spendLess.label.toLowerCase()}. There are ${spendLess.opportunity.alternatives.length} places near you students rate well at around ${fmt(spendLess.opportunity.alternativeAverageCents)}. Plus names them, with the weekly difference.`
        : upsell === "subscriptionDetection"
          ? `${detected.length} ${detected.length === 1 ? "charge repeats" : "charges repeat"} month after month in your own history and ${detected.length === 1 ? "is" : "are"} not in your repeating list. Pro names them and adds them in a tap.`
          : upsell === "weeklyTargets"
            ? `Your weeks are already here. Plus adds the target line: what this week is actually meant to cost, not just what the month is.`
            : upsell === "budgetCoach"
              ? `${money$.transactions.length} transactions logged. That is enough for a weekly read on where the money actually goes and what to change.`
              : upsell === "spendBenchmarks" && spendLess?.benchmark
                ? `Students here report ${fmt(spendLess.benchmark.city.lowCents)}–${fmt(spendLess.benchmark.city.highCents)} for ${spendLess.benchmark.item.replace(/-/g, " ")}. Max shows how your own average compares, category by category.`
                : null;

  const telemetry =
    upsell === "budgetForecast" ? "forecast-peek" : upsell === "budgetCoach" ? "many-transactions" : null;

  /* ---- history, grouped by day in the city's own calendar ---------------- */
  const historyGroups: HistoryGroup[] = groupTransactionsByDay(money$.transactions.slice(0, 60))
    .slice(0, 10)
    .map((group) => ({
      day: group.day,
      label: fmtDay(`${group.day}T12:00:00Z`, zone, now),
      totalCents: group.totalCents,
      rows: group.transactions.map((tx) => ({
        id: tx.id,
        label: tx.merchant ?? categoryLabel(tx.category),
        categoryKey: tx.category,
        categoryLabel: categoryLabel(tx.category),
        amountCents: tx.amountCents,
        spentAt: tx.spentAt,
        merchant: tx.merchant,
      })),
    }));

  const subscriptionRows: SubscriptionView[] = money$.subscriptions.rows.map((row) => ({
    id: row.id,
    label: row.label,
    categoryKey: row.category,
    categoryLabel: categoryLabel(row.category),
    amountCents: row.amountCents,
    cadence: row.cadence,
    dayOfPeriod: row.dayOfPeriod,
    nextDueLabel: row.nextDue ? fmtDay(`${row.nextDue}T12:00:00Z`, zone, now) : null,
    daysUntil: row.daysUntil,
    monthlyCents: row.monthlyCents,
    paidThisMonth: row.paidThisMonth,
  }));

  const detectedRows: DetectedView[] = can.subscriptionDetection
    ? detected.map((row) => ({
        key: row.key,
        label: row.label,
        categoryKey: row.category,
        categoryLabel: categoryLabel(row.category),
        amountCents: row.amountCents,
        dayOfMonth: row.dayOfMonth,
        monthCount: row.months.length,
      }))
    : [];

  return (
    <div className="page max-w-3xl py-6 sm:py-8">
      <BudgetTelemetry trigger={telemetry} />

      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400 capitalize">
            {now.toLocaleDateString(where.locale, { month: "long", year: "numeric" })} · {reading.daysLeft} days
            left
          </p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">Budget</h1>
        </div>
        <Link href="/budget/setup" className="shrink-0 text-[0.875rem] font-medium text-ink-600 hover:text-ink-950">
          Edit budget
        </Link>
      </header>

      {unset ? (
        <section className="flex flex-col items-center rounded-2xl bg-ink-950 p-6 text-center text-paper sm:flex-row sm:text-left">
          <MascotArt state="budget" className="size-16 shrink-0" />
          <div className="mt-4 flex-1 sm:mt-0 sm:ml-5">
            <h2 className="text-[1.125rem] font-semibold">
              Want StudentOS to tell you what you can safely spend?
            </h2>
            <p className="mt-1 text-[0.9375rem] text-paper/70">
              One monthly number. It becomes a daily figure, and every recommendation gets a price
              check.
            </p>
          </div>
          <Link
            href="/budget/setup"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-signal px-5 py-2.5 text-[0.9375rem] font-semibold text-ink-950 sm:mt-0 sm:ml-5"
          >
            Set budget
            <ArrowRight className="size-4" />
          </Link>
        </section>
      ) : (
        <>
          {/* ---- the figures ------------------------------------------------ */}
          <section className="rounded-2xl bg-ink-950 p-5 text-paper sm:p-6" data-surface="dark">
            <dl className="grid grid-cols-3 gap-4">
              <div>
                <dt className="font-mono text-micro uppercase tracking-[0.1em] text-paper/55">Monthly budget</dt>
                <dd className="tnum mt-0.5 font-mono text-[1.0625rem] font-semibold">{fmt(reading.plannedCents)}</dd>
              </div>
              <div>
                <dt className="font-mono text-micro uppercase tracking-[0.1em] text-paper/55">Spent</dt>
                <dd className="tnum mt-0.5 font-mono text-[1.0625rem] font-semibold">{fmt(reading.spentCents)}</dd>
              </div>
              <div>
                <dt className="font-mono text-micro uppercase tracking-[0.1em] text-paper/55">Remaining</dt>
                <dd className="tnum mt-0.5 font-mono text-[1.0625rem] font-semibold">
                  {fmt(Math.max(0, reading.remainingCents))}
                </dd>
              </div>
            </dl>

            <MonthBar
              className="mt-4"
              spentCents={reading.spentCents}
              plannedCents={reading.plannedCents}
              pacedCents={reading.pacedCents}
              where={where}
              onDark
            />

            <div className="mt-6 grid grid-cols-2 gap-6 border-t border-paper/12 pt-5">
              <div>
                <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">Safe to spend today</p>
                <p className="tnum mt-1.5 font-display text-[2.25rem] leading-none font-semibold tracking-tight text-signal sm:text-[2.75rem]">
                  {fmt(reading.safeTodayCents)}
                </p>
              </div>
              <div>
                <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">Safe to spend this week</p>
                <p className="tnum mt-1.5 font-display text-[2.25rem] leading-none font-semibold tracking-tight sm:text-[2.75rem]">
                  {fmt(reading.safeThisWeekCents)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 border-t border-paper/12 pt-4">
              <MascotArt
                state={insight.tone === "good" ? "budget" : insight.tone === "watch" ? "thinking" : "concerned"}
                className="size-8 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] leading-snug text-paper/90">{insight.headline}</p>
                {insight.action ? (
                  <Link
                    href={insight.action.href}
                    className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-signal underline underline-offset-4"
                  >
                    {insight.action.label}
                    <ArrowRight className="size-3" />
                  </Link>
                ) : null}
              </div>
            </div>

            {reading.reservedCents > 0 ? (
              <p className="mt-3 text-[0.8125rem] text-paper/60">
                {fmt(reading.reservedCents)} is set aside for a trip and is not counted as safe until it
                starts.
              </p>
            ) : null}
          </section>
        </>
      )}

      {/* ---- the primary action ------------------------------------------- */}
      <div className="mt-4">
        <AddTransaction categories={categories} symbol={symbol} where={where} />
      </div>

      {/* ---- quick tools --------------------------------------------------- */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ToolLink
          href="/budget/afford"
          icon={<Calculator className="size-5 text-mint-deep" />}
          tint="bg-mint-soft"
          title="Can I afford this?"
          detail="Type a spend, get yes, possibly or not ideal as you type."
        />
        <ToolLink
          href="/budget/survival"
          icon={<LifeBuoy className="size-5 text-flow-deep" />}
          tint="bg-flow-soft"
          title="Make it last"
          detail="What you have, until when. Survival Mode builds the plan."
        />
      </div>

      <div className="mt-6 space-y-6">
        {/* ---- income ----------------------------------------------------- */}
        <IncomeBridge
          userId={viewer.user.id}
          monthlyPlannedCents={unset ? null : reading.plannedCents}
          where={where}
        />

        {/* ---- categories ------------------------------------------------- */}
        <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="text-[1.0625rem] font-semibold text-ink-950">Where it goes</h2>
            <Link href="/budget/setup" className="text-[0.875rem] font-medium text-ink-600 hover:text-ink-950">
              Edit
            </Link>
          </div>

          {reading.categories.length === 0 ? (
            <p className="rounded-xl bg-paper-2 px-4 py-6 text-center text-[0.9375rem] text-ink-600">
              Set a monthly budget and the categories appear here, each with its own pace.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {reading.categories
                .filter((category) => category.plannedCents > 0 || category.spentCents > 0)
                .map((category) => (
                  <li key={category.category}>
                    <Link
                      href={`/budget/category/${encodeURIComponent(category.category)}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-paper-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-[0.9375rem] text-ink-800">{category.label}</span>
                          <span className="tnum shrink-0 font-mono text-[0.875rem] text-ink-600">
                            {fmt(category.spentCents)}
                            <span className="text-ink-400"> / {fmt(category.plannedCents)}</span>
                          </span>
                        </span>
                        <CategoryBar
                          className="mt-2"
                          spentCents={category.spentCents}
                          plannedCents={category.plannedCents}
                          pacedCents={category.pacedCents}
                        />
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-ink-300" />
                    </Link>
                  </li>
                ))}
            </ul>
          )}

          <p className="mt-3 text-[0.8125rem] text-ink-500">
            The notch on each bar is where an even pace would have you today.
          </p>
        </section>

        {/* ---- spend less -------------------------------------------------- */}
        {spendLess && (spendLess.options.length > 0 || spendLess.freeEvents.length > 0 || spendLess.deals.length > 0) ? (
          <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Spend less this week</p>

            {spendLess.opportunity && can.cheaperAlternatives ? (
              <>
                <h2 className="mt-1.5 text-[1.0625rem] font-semibold text-ink-950">
                  {spendLess.opportunity.headline}
                </h2>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-600">
                  {spendLess.opportunity.detail}
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-1.5 text-[1.0625rem] font-semibold text-ink-950">
                  Cheap {spendLess.label.toLowerCase()} options nearby
                </h2>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-600">
                  {spendLess.label} is the category furthest ahead of its pace this month. These are
                  the cheapest places near you — not a saving claim, just what is there.
                </p>
              </>
            )}

            {spendLess.options.length > 0 ? (
              <ul className="mt-3 divide-y divide-ink-100">
                {spendLess.options.map((option) => (
                  <li key={option.placeId}>
                    <Link
                      href={`/discover/${option.placeId}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-paper-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.9375rem] font-medium text-ink-900">{option.name}</span>
                        <span className="block text-[0.8125rem] text-ink-500">
                          {formatDistance(option.metres)} away
                          {option.verifiedBy >= 10 ? ` · ${option.verifiedBy} confirmed` : ""}
                        </span>
                      </span>
                      <span className="tnum shrink-0 font-mono text-[0.9375rem] font-semibold text-mint-deep">
                        {option.priceCents === null ? priceLevelLabel(option.priceLevel) : fmt(option.priceCents)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {spendLess.freeEvents.length > 0 ? (
              <div className="mt-4 border-t border-ink-100 pt-3">
                <h3 className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                  Free this week instead
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {spendLess.freeEvents.map((event) => (
                    <li key={event.id}>
                      <Link
                        href={`/events/${event.id}`}
                        className="flex items-baseline gap-2 text-[0.875rem] text-ink-800 hover:text-ink-950"
                      >
                        <span className="min-w-0 flex-1 truncate">{event.title}</span>
                        <span className="shrink-0 text-[0.8125rem] font-medium text-mint-deep">Free</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {spendLess.deals.length > 0 ? (
              <div className="mt-4 border-t border-ink-100 pt-3">
                <h3 className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                  Deals in {spendLess.label.toLowerCase()}
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {spendLess.deals.map((deal) => (
                    <li key={deal.id} className="flex items-baseline gap-2 text-[0.875rem] text-ink-800">
                      <span className="min-w-0 flex-1 truncate">{deal.title}</span>
                      <span className="shrink-0 text-[0.8125rem] font-medium text-amber-deep">{deal.value}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/discover?tab=deals"
                  className="mt-2 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink-700 underline underline-offset-4 hover:text-ink-950"
                >
                  All deals
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            ) : null}

            {/* The city figure is other students' data and is free to everyone;
                the personal comparison is the Max feature. */}
            {spendLess.benchmark ? (
              <p className="mt-4 border-t border-ink-100 pt-3 text-[0.875rem] text-ink-600">
                {spendLess.benchmark.cityLine}
                {can.spendBenchmarks && spendLess.benchmark.personalLine ? (
                  <span className="mt-1 block font-medium text-ink-800">
                    {spendLess.benchmark.personalLine}
                  </span>
                ) : null}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* ---- subscriptions ---------------------------------------------- */}
        <SubscriptionsPanel
          rows={subscriptionRows}
          detected={detectedRows}
          categories={categories}
          symbol={symbol}
          where={where}
          monthlyTotalCents={money$.subscriptions.monthlyTotalCents}
          stillToComeCents={money$.subscriptions.stillToComeCents}
          canDetect={can.subscriptionDetection}
        />

        {/* ---- weeks ------------------------------------------------------- */}
        {!unset ? (
          <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-[1.0625rem] font-semibold text-ink-950">Your weeks</h2>
              <span className="tnum font-mono text-[0.875rem] text-ink-500">
                {fmt(money$.week.spentCents)}
                {can.weeklyTargets ? ` of ${fmt(money$.week.targetCents)}` : ""}
              </span>
            </div>

            <WeekBars weeks={charts.weeks} where={where} showTarget={can.weeklyTargets} />

            {history.length >= 2 ? (
              <div className="mt-5 border-t border-ink-100 pt-4">
                <h3 className="mb-2 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                  Month by month
                </h3>
                <MonthTrend months={history} where={where} />
              </div>
            ) : null}

            <p className="mt-3 text-[0.875rem] text-ink-700">
              {can.weeklyTargets
                ? money$.week.remainingCents >= 0
                  ? `${fmt(money$.week.remainingCents)} left for this week.`
                  : `${fmt(Math.abs(money$.week.remainingCents))} over for this week.`
                : "Every bar is a week of your own spending."}{" "}
              <Link
                href="/events?tab=free"
                className="font-medium text-ink-950 underline underline-offset-4"
              >
                Find something free
              </Link>
            </p>
          </section>
        ) : null}

        {/* ---- forecast ---------------------------------------------------- */}
        {!unset && can.budgetForecast ? (
          <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold text-ink-950">
              <TrendingUp className="size-4.5 text-flow-deep" />
              Where this month lands
            </h2>

            {!money$.forecast.confident ? (
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-600">
                {money$.forecast.basisDays} {money$.forecast.basisDays === 1 ? "day" : "days"} of spending is
                not enough to project from yet. This fills in around day five.
              </p>
            ) : (
              <>
                <p className="tnum mt-3 font-mono text-[1.75rem] leading-none font-semibold text-ink-950">
                  {fmt(money$.forecast.projectedCents)}
                </p>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-600">
                  At your current pace, including what is still due to come out. That is{" "}
                  <span
                    className={
                      money$.forecast.projectedDeltaCents >= 0
                        ? "font-medium text-mint-deep"
                        : "font-medium text-pulse-deep"
                    }
                  >
                    {fmt(Math.abs(money$.forecast.projectedDeltaCents))}{" "}
                    {money$.forecast.projectedDeltaCents >= 0 ? "under" : "over"}
                  </span>{" "}
                  your budget.
                </p>

                <TrajectorySparkline className="mt-4" trajectory={charts.trajectory} where={where} />

                <p className="mt-3 text-[0.875rem] text-ink-700">
                  Averaging {fmt(money$.forecast.requiredDailyCents)} a day keeps you on target.{" "}
                  <Link href="/budget/afford" className="font-medium text-ink-950 underline underline-offset-4">
                    Check a spend against it
                  </Link>
                </p>
              </>
            )}
          </section>
        ) : null}

        {/* ---- trips and shared -------------------------------------------- */}
        <div className="grid gap-3 sm:grid-cols-2">
          <ToolLink
            href="/budget/travel"
            icon={<Plane className="size-5 text-flow-deep" />}
            tint="bg-flow-soft"
            title={reading.trips.length > 0 ? `${reading.trips.length} trip budget${reading.trips.length === 1 ? "" : "s"}` : "Trip budgets"}
            detail={
              reading.trips.length > 0
                ? `${fmt(reading.trips.reduce((sum, trip) => sum + trip.remainingCents, 0))} set aside for trips.`
                : "Put a weekend away in its own envelope, out of safe-to-spend."
            }
          />
          <ToolLink
            href="/budget/shared"
            icon={<Users className="size-5 text-pulse-deep" />}
            tint="bg-pulse-soft"
            title="Shared budgets"
            detail="Split a flat, a trip or a night out and keep it settled."
          />
        </div>

        {/* ---- one upsell, chosen for this student -------------------------- */}
        {upsell ? <Upsell feature={upsell} line={upsellLine} /> : null}

        {/* ---- history ----------------------------------------------------- */}
        <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-[1.0625rem] font-semibold text-ink-950">Recent</h2>
            {money$.transactions.length > 0 ? (
              <span className="tnum font-mono text-[0.8125rem] text-ink-500">
                {money$.transactions.length} logged
              </span>
            ) : null}
          </div>

          <BudgetHistory
            groups={historyGroups}
            categories={categories.filter((category) => !isTripCategory(category.key))}
            symbol={symbol}
            where={where}
          />
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ToolLink({
  href,
  icon,
  tint,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  tint: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]"
    >
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", tint)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-ink-950">{title}</span>
        <span className="mt-0.5 block text-[0.8125rem] text-ink-500">{detail}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-ink-400" />
    </Link>
  );
}
