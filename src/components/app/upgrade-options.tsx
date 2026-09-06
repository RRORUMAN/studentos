"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  annualSavingLabel,
  type BillingPeriod,
  billedTotal,
  plans,
  type PlanKey,
  priceFor,
} from "@/config/pricing";
import { tierRank } from "@/config/entitlements";
import { startCheckout } from "@/server/actions/billing";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * UPGRADE OPTIONS
 * ----------------------------------------------------------------------------
 * The tier cards, with a monthly/annual toggle.
 *
 * Prices come from `priceFor` — the same function the marketing pricing table
 * and the checkout quote use — so the number on this card is provably the
 * number that gets charged. Nothing here computes a price a second way.
 * ============================================================================
 */

export function UpgradeOptions({
  currentPlan,
  highlightPlan,
  billingReady,
}: {
  currentPlan: PlanKey;
  highlightPlan: PlanKey | null;
  billingReady: boolean;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const paid = plans.filter((plan) => plan.key !== "free");

  return (
    <div>
      {/* ---- period ------------------------------------------------------- */}
      <div className="mb-5 inline-flex rounded-full border border-ink-200 bg-white p-1">
        {(["monthly", "annual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setPeriod(option)}
            aria-pressed={period === option}
            className={cn(
              "rounded-full px-4 py-1.5 text-[0.875rem] font-medium transition-colors",
              period === option ? "bg-ink-950 text-paper" : "text-ink-600 hover:text-ink-950",
            )}
          >
            {option === "monthly" ? "Monthly" : `Annual — ${annualSavingLabel}`}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-pulse-soft px-4 py-3 text-[0.875rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      {/* ---- cards -------------------------------------------------------- */}
      <ul className="grid gap-4 sm:grid-cols-3">
        {paid.map((plan) => {
          const perMonth = priceFor(plan, period);
          const annual = billedTotal(plan, period);
          const isCurrent = plan.key === currentPlan;
          const isDowngrade = tierRank(plan.key) < tierRank(currentPlan);
          const highlighted = highlightPlan === plan.key;

          return (
            <li
              key={plan.key}
              className={cn(
                "flex flex-col rounded-xl border bg-white p-5",
                highlighted
                  ? "border-ink-950 ring-2 ring-signal"
                  : plan.recommended
                    ? "border-ink-400"
                    : "border-ink-200",
              )}
            >
              {highlighted ? (
                <span className="mb-2 inline-block w-fit rounded-full bg-signal px-2.5 py-0.5 text-[0.6875rem] font-semibold text-ink-950">
                  Unlocks what you wanted
                </span>
              ) : plan.recommended ? (
                <span className="mb-2 inline-block w-fit rounded-full bg-ink-950 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-paper">
                  Most students
                </span>
              ) : null}

              <h3 className="text-[1.125rem] font-semibold text-ink-950">{plan.name}</h3>

              <p className="mt-2">
                <span className="tnum font-mono text-[1.75rem] leading-none font-semibold text-ink-950">
                  {money(perMonth)}
                </span>
                <span className="text-[0.875rem] text-ink-500"> / month</span>
              </p>
              {annual ? (
                <p className="tnum mt-1 font-mono text-[0.75rem] text-ink-400">
                  {money(annual)} billed yearly
                </p>
              ) : null}

              <p className="mt-3 text-[0.875rem] leading-snug text-ink-600">{plan.unlocks}</p>

              <ul className="mt-4 flex-1 space-y-1.5">
                {plan.features.slice(0, 5).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[0.8125rem] text-ink-600">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-mint-deep" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant={highlighted || plan.recommended ? "primary" : "outline"}
                size="md"
                block
                className="mt-5"
                disabled={isCurrent || pendingPlan !== null || !billingReady}
                onClick={() => {
                  setError(null);
                  setPendingPlan(plan.key);
                  startTransition(async () => {
                    const result = await startCheckout(plan.key, period);
                    /* A successful checkout redirects and never returns. */
                    if (result && !result.ok) setError(result.message);
                    setPendingPlan(null);
                  });
                }}
              >
                {pendingPlan === plan.key ? <Loader2 className="size-4 animate-spin" /> : null}
                {isCurrent
                  ? "Current plan"
                  : !billingReady
                    ? "Billing not connected"
                    : isDowngrade
                      ? `Switch to ${plan.name}`
                      : `Choose ${plan.name}`}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
