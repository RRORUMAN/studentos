import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TripBudgets, type TripView } from "@/components/app/budget-travel";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { loadMoney } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtDay } from "@/lib/dates";
import { currencySymbol, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Trip budgets",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * TRIP BUDGETS (Pro)
 * ----------------------------------------------------------------------------
 * A trip is an envelope with dates. The money in it is excluded from
 * safe-to-spend until the trip starts, which is the entire point: money set
 * aside that still shows up as spendable is not set aside.
 *
 * A free student sees their own month with the trip figure they would be
 * reserving, and one value-first card. Nothing is invented for the preview.
 * ============================================================================
 */
export default async function TravelBudgetPage() {
  const viewer = await requireViewer();
  const now = requestDate();
  const where = viewer.currency;
  const zone = viewer.city.timezone;
  const symbol = currencySymbol(where.currency, where.locale);
  const unlocked = viewer.entitlements.can.travelBudgets;
  const fmt = (cents: number) => money(cents / 100, where);

  const money$ = await loadMoney(viewer.user.id, now);

  const trips: TripView[] = money$.reading.trips.map((trip) => ({
    category: trip.category,
    name: trip.name,
    datesLabel: `${fmtDay(`${trip.start}T12:00:00Z`, zone, now)}–${fmtDay(`${trip.end}T12:00:00Z`, zone, now)}`,
    start: trip.start,
    end: trip.end,
    plannedCents: trip.plannedCents,
    spentCents: trip.spentCents,
    remainingCents: trip.remainingCents,
    status: trip.status,
    daysUntil: trip.daysUntil,
    reserved: trip.reserved,
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

      <header className="flex items-start gap-4">
        <MascotArt state="travel" className="size-14 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Trip budgets</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            A weekend away in its own envelope. What you put in it stops counting as safe-to-spend
            until the trip starts, so the month does not quietly borrow from it.
          </p>
        </div>
      </header>

      <div className="mt-6">
        {unlocked ? (
          <TripBudgets trips={trips} symbol={symbol} where={where} />
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
              <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Your month right now</p>
              <dl className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-[0.8125rem] text-ink-500">Safe to spend today</dt>
                  <dd className="tnum mt-0.5 font-mono text-[1.25rem] font-semibold text-ink-950">
                    {fmt(money$.reading.safeTodayCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.8125rem] text-ink-500">Left this month</dt>
                  <dd className="tnum mt-0.5 font-mono text-[1.25rem] font-semibold text-ink-950">
                    {fmt(Math.max(0, money$.reading.remainingCents))}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-600">
                Put €180 aside for a weekend and, without a trip envelope, that €180 keeps showing up
                as money you can spend on a Tuesday.
              </p>
            </section>

            <Upsell
              feature="travelBudgets"
              line="A trip gets its own envelope with dates. Until it starts, the money is held out of safe-to-spend — so the daily figure stays true and the trip is still funded when you get there."
              preview={[
                { label: "Barcelona · 12–15 Sep", hint: "Set aside, not spendable yet" },
                { label: "Safe to spend today, with the trip held back" },
                { label: "What is left of the trip while you are on it" },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
