import { Target } from "lucide-react";
import Link from "next/link";

import { Upsell } from "@/components/app/upsell";
import type { WorkProfile } from "@/domain/work";
import type { Entitlements } from "@/server/entitlements";
import { describeBasis, earnPlan, incomeGap } from "@/server/engines/earn";
import type { Match } from "@/server/engines/work-match";
import { money } from "@/lib/utils";

/**
 * ============================================================================
 * THE INCOME GAP
 * ----------------------------------------------------------------------------
 * "You are €280 short. Here is what would close it."
 *
 * This is the panel the whole pillar is built for and the one thing a job
 * board structurally cannot do, because it does not know what the student
 * spends. It sits above the board rather than on its own screen so that the
 * answer and the jobs that produce it are never more than one scroll apart.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS CAREFUL ABOUT
 *
 * Every figure is an estimate and says so, once, in a line that cannot be
 * scrolled past because it sits directly under the number. Each pick prints
 * the assumption behind it — the rate and the hours, or "paid once" — so the
 * total is never a floating claim. `earnPlan` refuses to price a posting that
 * does not state pay; the count of those is shown rather than hidden, because
 * "and four more we could not price" is the honest shape of the answer.
 *
 * Gated at Plus, and gated on the server: `EarnPanel` is a server component
 * and the plan is only computed inside the `can.incomeGoal` branch, so a
 * student on Free never receives the numbers, not merely the markup.
 * ============================================================================
 */

export function EarnPanel({
  matches,
  profile,
  entitlements,
  where,
}: {
  matches: readonly Match[];
  profile: WorkProfile;
  entitlements: Entitlements;
  where: { currency: string; locale: string };
}) {
  const gap = incomeGap({
    targetCents: profile.monthlyTargetCents,
    currentIncomeCents: profile.currentIncomeCents,
  });

  /* No target, no panel. A student who never set one must not be shown a
     shortfall against a number they did not choose. */
  if (!gap) {
    if (!entitlements.can.incomeGoal) return null;
    return (
      <section className="mt-5 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <h2 className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-950">
          <Target className="size-4 text-signal-deep" />
          Set what you need to earn
        </h2>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-600">
          Tell StudentOS your monthly target and what you already have coming in, and this becomes a
          specific answer: which of these jobs closes the gap, and how many hours it would take.
        </p>
        <Link
          href="/work/profile#earn"
          className="mt-3 inline-block text-[0.875rem] font-semibold text-flow hover:underline"
        >
          Set a target
        </Link>
      </section>
    );
  }

  if (!entitlements.can.incomeGoal) {
    return (
      <Upsell
        className="mt-5"
        feature="incomeGoal"
        line={`You have set a target of ${money(gap.targetCents / 100, where)} a month.`}
        preview={[
          { label: "Your income gap", hint: "Target, minus what you already have" },
          { label: "The jobs that would close it", hint: "From the board below, priced" },
          { label: "Hours a week it would take", hint: "At the going rate in your city" },
        ]}
      />
    );
  }

  const fmt = (cents: number) => money(cents / 100, where);

  if (gap.closed) {
    return (
      <section className="mt-5 rounded-2xl bg-mint p-5">
        <h2 className="text-[0.9375rem] font-semibold text-ink-950">
          You are at your target of {fmt(gap.targetCents)} a month
        </h2>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-800">
          Nothing here needs closing. The board below is still worth a look if you want more than
          the target, but you are not short.
        </p>
      </section>
    );
  }

  const plan = earnPlan({
    matches,
    targetCents: gap.gapCents,
    hoursAvailable: profile.hoursPerWeek,
  });

  /* One-offs and a monthly wage add up to a number, and the number is only
     true for one month. Saying which part of it repeats is the difference
     between a plan and a figure that quietly disappoints in November. */
  const onceOnlyCents = plan.picks
    .filter((pick) => pick.basis === "fixed-one-off")
    .reduce((sum, pick) => sum + pick.monthlyCents, 0);

  return (
    <section className="mt-5 rounded-2xl bg-ink-950 p-5 text-paper">
      <h2 className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Target className="size-4 text-signal" />
        You are {fmt(gap.gapCents)} a month short
      </h2>
      <p className="mt-1 text-[0.8125rem] text-paper/60">
        Target {fmt(gap.targetCents)}, coming in {fmt(gap.currentIncomeCents)}.
      </p>

      {plan.picks.length > 0 ? (
        <>
          <ul className="mt-4 divide-y divide-paper/10 border-y border-paper/10">
            {plan.picks.map((pick) => (
              <li key={pick.opportunity.id} className="flex items-baseline gap-4 py-2.5">
                <Link
                  href={`/work/${pick.opportunity.id}`}
                  className="min-w-0 flex-1 text-[0.9375rem] hover:underline"
                >
                  <span className="block truncate">{pick.opportunity.title}</span>
                  <span className="mt-0.5 block text-[0.75rem] text-paper/50">
                    {describeBasis(pick, fmt)}
                  </span>
                </Link>
                <span className="tnum shrink-0 font-mono text-[0.9375rem] font-semibold">
                  {fmt(pick.monthlyCents)}
                </span>
              </li>
            ))}
          </ul>

          <p className="tnum mt-3 font-mono text-[1.25rem] font-semibold">
            ≈ {fmt(plan.estimatedTotalCents)}
            <span className="ml-2 font-sans text-[0.8125rem] font-normal text-paper/60">
              a month, {plan.hoursUsed} hours a week
            </span>
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-paper/60">
            An estimate, not an offer. It assumes you get the work and that the hours hold — nobody
            here has promised you anything.
            {onceOnlyCents > 0 ? (
              <>
                {" "}
                <strong className="font-semibold text-paper/85">
                  {fmt(onceOnlyCents)} of it happens once
                </strong>{" "}
                and is not there next month.
              </>
            ) : null}
          </p>
        </>
      ) : (
        <p className="mt-3 text-[0.875rem] leading-relaxed text-paper/75">
          Nothing on the board right now states pay in a way we can add up against your{" "}
          {profile.hoursPerWeek > 0 ? `${profile.hoursPerWeek} hours a week` : "availability"}. That
          is a gap in the board, not in you.
        </p>
      )}

      {!plan.reachesTarget && plan.needed ? (
        <p className="mt-3 rounded-xl bg-paper/10 px-3 py-2 text-[0.875rem] leading-relaxed">
          Still {fmt(plan.shortfallCents)} short. Roughly{" "}
          <strong className="font-semibold">{plan.needed.hoursPerWeek} more hours a week</strong> at{" "}
          {fmt(plan.needed.atHourlyCents)} an hour — the middle of what is actually being advertised
          here — would close it.
        </p>
      ) : null}

      {plan.unpriced > 0 ? (
        <p className="mt-2 text-[0.8125rem] text-paper/50">
          {plan.unpriced} more {plan.unpriced === 1 ? "match does" : "matches do"} not state pay, so
          nothing above counts them.
        </p>
      ) : null}
    </section>
  );
}
