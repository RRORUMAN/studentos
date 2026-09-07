import { ArrowRight, Briefcase } from "lucide-react";
import Link from "next/link";

import { budgetShortfall, incomeGap } from "@/server/engines/earn";
import { loadWorkProfile } from "@/server/queries/work";
import { money } from "@/lib/utils";

/**
 * ============================================================================
 * BUDGET → WORK
 * ----------------------------------------------------------------------------
 * The other side of the money loop, on the screen where a student notices the
 * problem.
 *
 * Every budgeting product ends the same sentence: spend less. This one can
 * finish it differently, because it also knows what work is on the board in
 * this city tonight. That is the whole reason Work belongs inside StudentOS
 * rather than beside it.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE NO PROJECTIONS HERE
 *
 * The Budget screen already carries one paywall, and the product's rule is one
 * per screen. So this card is free at every tier and shows only arithmetic on
 * numbers the student typed themselves — their monthly plan minus the income
 * they told us about. The estimating, the plan and the "this would close it"
 * are on `/work`, where `incomeGoal` gates them.
 *
 * A student who has not entered an income figure gets an invitation rather
 * than a shortfall. Treating "I never said" as "I have nothing coming in"
 * would greet most accounts with an alarming number about a fact we do not
 * have.
 * ============================================================================
 */

export async function IncomeBridge({
  userId,
  monthlyPlannedCents,
  where,
}: {
  userId: string;
  /** The month's total envelope. Null when the budget is not set up. */
  monthlyPlannedCents: number | null;
  where: { currency: string; locale: string };
}) {
  const profile = await loadWorkProfile(userId);

  /* Someone who has said they are not looking for work does not need a job
     board on their budget screen every month. */
  if (profile.lookingFor === "no" && profile.currentIncomeCents === null) return null;

  const fmt = (cents: number) => money(cents / 100, where);
  const shortfall = budgetShortfall({
    monthlyPlannedCents,
    currentIncomeCents: profile.currentIncomeCents,
  });
  const target = incomeGap({
    targetCents: profile.monthlyTargetCents,
    currentIncomeCents: profile.currentIncomeCents,
  });

  const gap = shortfall ?? target?.gapCents ?? null;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <h2 className="inline-flex items-center gap-2 text-[1.0625rem] font-semibold text-ink-950">
        <Briefcase className="size-4 text-signal-deep" />
        Coming in
      </h2>

      {gap !== null && gap > 0 ? (
        <>
          <dl className="mt-3 space-y-1.5 text-[0.9375rem]">
            {monthlyPlannedCents ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-600">This month costs</dt>
                <dd className="tnum font-mono text-ink-950">{fmt(monthlyPlannedCents)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-600">You told us you have</dt>
              <dd className="tnum font-mono text-ink-950">
                {fmt(profile.currentIncomeCents ?? 0)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-ink-100 pt-1.5">
              <dt className="font-medium text-ink-950">Short by</dt>
              <dd className="tnum font-mono text-[1.0625rem] font-semibold text-ink-950">
                {fmt(gap)}
              </dd>
            </div>
          </dl>

          <Link
            href="/work"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-semibold text-paper transition-colors hover:bg-ink-800"
          >
            Find ways to earn {fmt(gap)}
            <ArrowRight className="size-4" />
          </Link>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
            Subtraction on the two numbers you gave us — nothing is being predicted here.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            {profile.currentIncomeCents === null
              ? "Tell StudentOS what you have coming in each month and this becomes the other half of your budget: how far short you are, and which work in your city would close it."
              : "Nothing is short this month on the numbers you gave us. Work is still there if you want more than the plan."}
          </p>
          <Link
            href={profile.currentIncomeCents === null ? "/work/profile#earn" : "/work"}
            className="mt-3 inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-flow hover:underline"
          >
            {profile.currentIncomeCents === null ? "Add what you earn" : "Browse work"}
            <ArrowRight className="size-4" />
          </Link>
        </>
      )}
    </section>
  );
}
