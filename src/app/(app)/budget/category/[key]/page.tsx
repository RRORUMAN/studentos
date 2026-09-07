import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryBar } from "@/components/app/budget-charts";
import { BudgetHistory, type HistoryGroup } from "@/components/app/budget-ui";
import { categoryLabel, groupTransactionsByDay } from "@/server/engines/budget";
import { cheapPlacesIn, loadMoney } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtDay } from "@/lib/dates";
import { currencySymbol, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Category",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * ONE CATEGORY
 * ----------------------------------------------------------------------------
 * What a tap on a category bar leads to: the same numbers at full size, every
 * transaction behind them, and the cheaper places in that category.
 *
 * It exists because the bar on the Budget screen is a claim ("eating out is
 * ahead of pace") and a claim a student cannot audit is one they eventually
 * stop believing. Here they can see the rows it was computed from and correct
 * any of them.
 * ============================================================================
 */
export default async function BudgetCategoryPage(props: PageProps<"/budget/category/[key]">) {
  const viewer = await requireViewer();
  const { key } = await props.params;
  const category = decodeURIComponent(key);

  const now = requestDate();
  const where = viewer.currency;
  const zone = viewer.city.timezone;
  const symbol = currencySymbol(where.currency, where.locale);
  const fmt = (cents: number) => money(cents / 100, where);

  const money$ = await loadMoney(viewer.user.id, now);
  const reading = money$.reading.categories.find((entry) => entry.category === category);
  if (!reading) notFound();

  const rows = money$.transactions.filter((tx) => tx.category === category);
  const groups: HistoryGroup[] = groupTransactionsByDay(rows).map((group) => ({
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

  const cheaper = reading.discretionary
    ? cheapPlacesIn({
        citySlug: viewer.profile.citySlug,
        category,
        maxWalkMinutes: Math.round(viewer.profile.maxTravelMinutes * 1.6),
      })
    : [];

  const categories = money$.reading.categories.map((entry) => ({
    key: entry.category,
    label: entry.label,
  }));

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/budget"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Budget
      </Link>

      <h1 className="text-display-xs text-ink-950 sm:text-display-sm">{reading.label}</h1>

      <section className="mt-5 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <dl className="grid grid-cols-3 gap-4">
          <div>
            <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Budget</dt>
            <dd className="tnum mt-0.5 font-mono text-[1.0625rem] font-semibold text-ink-950">
              {fmt(reading.plannedCents)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Spent</dt>
            <dd className="tnum mt-0.5 font-mono text-[1.0625rem] font-semibold text-ink-950">
              {fmt(reading.spentCents)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Left</dt>
            <dd className="tnum mt-0.5 font-mono text-[1.0625rem] font-semibold text-ink-950">
              {fmt(Math.max(0, reading.remainingCents))}
            </dd>
          </div>
        </dl>

        <CategoryBar
          className="mt-4"
          spentCents={reading.spentCents}
          plannedCents={reading.plannedCents}
          pacedCents={reading.pacedCents}
        />

        <p className="mt-2.5 text-[0.875rem] text-ink-700">
          {reading.paceDeltaCents > 0
            ? `${fmt(reading.paceDeltaCents)} ahead of an even pace for the month.`
            : `${fmt(Math.abs(reading.paceDeltaCents))} under an even pace for the month.`}{" "}
          <Link href="/budget/setup" className="font-medium text-ink-950 underline underline-offset-4">
            Change this budget
          </Link>
        </p>
      </section>

      {cheaper.length > 0 ? (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
          <h2 className="text-[1.0625rem] font-semibold text-ink-950">Cheaper here</h2>
          <p className="mt-0.5 text-[0.875rem] text-ink-600">
            The lowest-priced places near you in this category, students first.
          </p>
          <ul className="mt-3 divide-y divide-ink-100">
            {cheaper.map((place) => (
              <li key={place.placeId}>
                <Link
                  href={`/discover/${place.placeId}`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-paper-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-medium text-ink-900">{place.name}</span>
                    <span className="block text-[0.8125rem] text-ink-500">
                      {place.walkMinutes} min walk
                      {place.verifiedBy >= 10 ? ` · ${place.verifiedBy} confirmed` : ""}
                    </span>
                  </span>
                  <span className="tnum shrink-0 font-mono text-[0.9375rem] font-semibold text-mint-deep">
                    {fmt(place.priceCents)}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-300" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">Everything in {reading.label.toLowerCase()}</h2>
        <BudgetHistory
          groups={groups}
          categories={categories}
          symbol={symbol}
          where={where}
          emptyAction={
            <Link
              href="/budget"
              className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-semibold text-paper"
            >
              Log a spend
              <ArrowRight className="size-3.5" />
            </Link>
          }
        />
      </section>
    </div>
  );
}
