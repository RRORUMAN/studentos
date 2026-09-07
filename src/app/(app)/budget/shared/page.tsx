import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SharedBuckets, type BucketView } from "@/components/app/budget-shared";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { loadBucketGroups, loadBuckets } from "@/server/queries/money";
import { requireViewer } from "@/server/viewer";
import { currencySymbol, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shared budgets",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * SHARED BUDGETS (Pro)
 * ----------------------------------------------------------------------------
 * The flat's groceries, Saturday night, the Barcelona trip: one envelope,
 * several people, and who owes whom at the end.
 *
 * Not banking, and the copy says so on the screen rather than in a footnote.
 * The split is `settleBucket` — cent-exact, so three people splitting €10 come
 * to exactly €10 — and the payments are the greedy minimum from
 * `settleUpTransfers`, which is always correct and always explainable.
 *
 * A free student sees a worked example with obviously-named people, clearly
 * labelled as one, plus their own groups. Nothing is dressed up as their data.
 * ============================================================================
 */
export default async function SharedBudgetPage() {
  const viewer = await requireViewer();
  const where = viewer.currency;
  const symbol = currencySymbol(where.currency, where.locale);
  const unlocked = viewer.entitlements.can.sharedBudgets;

  const [readings, groups] = await Promise.all([
    unlocked ? loadBuckets(viewer.user.id) : Promise.resolve([]),
    loadBucketGroups(viewer.user.id),
  ]);

  const buckets: BucketView[] = readings.map((reading) => {
    const nameFor = new Map(reading.members.map((member) => [member.userId, member]));
    return {
      id: reading.bucket.id,
      name: reading.bucket.name,
      emoji: reading.bucket.emoji,
      closed: Boolean(reading.bucket.closedAt),
      totalCents: reading.totalCents,
      targetCents: reading.bucket.targetCents,
      viewerNetCents: reading.viewerNetCents,
      members: reading.members,
      entries: reading.entries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        amountCents: entry.amountCents,
        paidByName: entry.paidByName,
        paidByViewer: entry.paidBy === viewer.user.id,
      })),
      transfers: reading.transfers.map((transfer) => ({
        fromName: nameFor.get(transfer.from)?.displayName ?? "Someone",
        toName: nameFor.get(transfer.to)?.displayName ?? "Someone",
        amountCents: transfer.amountCents,
        fromViewer: transfer.from === viewer.user.id,
        toViewer: transfer.to === viewer.user.id,
      })),
    };
  });

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
        <MascotArt state="social" className="size-14 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Shared budgets</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            One envelope, several people. Everyone adds what they fronted and the split works itself
            out. No money moves through StudentOS — it keeps the score, you pay each other however
            you already do.
          </p>
        </div>
      </header>

      <div className="mt-6">
        {unlocked ? (
          <SharedBuckets buckets={buckets} groups={groups} symbol={symbol} where={where} />
        ) : (
          <div className="space-y-4">
            {/* An example, labelled as one. Inventing a bucket that looked like
                the student's own would be the fake-data trap this product is
                explicitly built to avoid. */}
            <section className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
              <header className="flex items-center justify-between gap-3 border-b border-ink-100 p-5">
                <div>
                  <h2 className="text-[1.0625rem] font-semibold text-ink-950">🍝 Flat groceries</h2>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-500">An example, not your data</p>
                </div>
                <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[0.75rem] font-semibold text-ink-600">
                  4 people
                </span>
              </header>
              <ul className="divide-y divide-ink-100">
                {[
                  { label: "The big shop", who: "Ana paid", amount: 4820 },
                  { label: "Milk and bread", who: "You paid", amount: 760 },
                  { label: "Sunday top-up", who: "Marco paid", amount: 1240 },
                ].map((row) => (
                  <li key={row.label} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] text-ink-900">{row.label}</span>
                      <span className="block text-[0.8125rem] text-ink-500">{row.who}</span>
                    </span>
                    <span className="tnum shrink-0 font-mono text-[0.9375rem] font-medium text-ink-900">
                      {money(row.amount / 100, where)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="bg-paper-2/60 px-5 py-4">
                <h3 className="mb-2 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Settle up</h3>
                <p className="text-[0.875rem] text-ink-800">
                  You pay <span className="font-medium">Ana</span>{" "}
                  <span className="tnum font-mono font-semibold">{money(9.3, where)}</span>
                </p>
              </div>
            </section>

            <Upsell
              feature="sharedBudgets"
              line={
                groups.length > 0
                  ? `You are already in ${groups.length} ${groups.length === 1 ? "group" : "groups"}. Pro turns any of them into a shared bucket, with who paid what and the settle-up worked out to the cent.`
                  : "Split a flat, a trip or a night out. Everyone adds what they fronted, and the settle-up is worked out to the cent so the bucket actually closes."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
