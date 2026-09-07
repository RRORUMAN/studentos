"use client";

import { Check, Minus } from "lucide-react";
import { useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Badge, SampleTag, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import type { SectionTone } from "@/components/ui/primitives";
import {
  featureCopy,
  featureTier,
  planHasFeature,
  quotas,
  tierOrder,
  type Feature,
} from "@/config/entitlements";
import {
  annualSavingLabel,
  billedTotal,
  plans,
  pricingAssurances,
  pricingFaq,
  priceFor,
  type BillingPeriod,
  type PlanKey,
} from "@/config/pricing";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

const TIER_HEADING: Record<PlanKey, string> = {
  free: "Free on every tier",
  plus: "Added by Plus",
  pro: "Added by Pro",
  max: "Added by Max",
};

/** Never gated, at any price. Stated as capabilities, not as a feature list. */
const ALWAYS_FREE = [
  "Student Pulse, city and campus feeds",
  "Chat, replies, reactions and polls",
  "Events, deals and the core map",
  "Anyone Down? — join and host",
  "Arrival Mode, LifeOps and Smart Missions",
  "The basic budget, with what is safe to spend today",
];

/**
 * ============================================================================
 * PRICING
 * ----------------------------------------------------------------------------
 * Four cards and one table. The table is generated from `featureTier` — the
 * same map the server enforces entitlements with — so it is structurally
 * impossible for the marketing page to promise a feature at a tier the product
 * does not grant it at. Quota rows come from `quotas` for the same reason.
 *
 * Prices, the annual discount and every label come from `config/pricing.ts`.
 * Nothing on this page knows what a tier costs.
 * ============================================================================
 */
export function PricingTable({
  tone = "paper",
  showHeader = true,
  showFaq = false,
}: {
  tone?: SectionTone;
  showHeader?: boolean;
  showFaq?: boolean;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <Section id="pricing" tone={tone}>
      <div className="page">
        {showHeader ? (
          <SectionHeader
            align="center"
            eyebrow="Pricing"
            eyebrowIndex="17"
            title="Free is genuinely free. Paying buys depth."
            lead="The community, discovery, events, Anyone Down?, Arrival Mode, LifeOps, missions and a real budget cost nothing, permanently. Paid tiers add intelligence over the same data — never access to other students."
          />
        ) : null}

        {/* ---- billing toggle ---------------------------------------------- */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <div
            className="inline-flex rounded-full border border-ink-200 bg-white p-1"
            role="group"
            aria-label="Billing period"
          >
            {(["monthly", "annual"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={period === option}
                onClick={() => {
                  setPeriod(option);
                  track("pricing_period_changed", { period: option });
                }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  period === option
                    ? "bg-ink-950 text-paper"
                    : "text-ink-600 hover:text-ink-950",
                )}
              >
                {option === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
          <p className="text-[0.8125rem] text-ink-400">
            Annual billing is {annualSavingLabel}. Cancel any time.
          </p>
        </div>

        {/* ---- cards -------------------------------------------------------- */}
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const price = priceFor(plan, period);
            const billed = billedTotal(plan, period);
            const recommended = Boolean(plan.recommended);

            return (
              <div
                key={plan.key}
                className={cn(
                  "relative flex flex-col rounded-2xl p-5 sm:p-6",
                  recommended
                    ? "bg-ink-950 text-paper shadow-[var(--shadow-lift)] ring-2 ring-signal"
                    : "bg-white text-ink-900 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6",
                )}
              >
                {recommended ? (
                  <Badge accent="signal" tone="solid" className="absolute -top-3 left-5">
                    Best value
                  </Badge>
                ) : null}

                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className={cn(
                      "text-display-xs",
                      recommended ? "text-white" : "text-ink-950",
                    )}
                  >
                    {plan.name}
                  </h3>
                  <span
                    className={cn(
                      "font-mono text-micro uppercase tracking-[0.1em]",
                      recommended ? "text-white/45" : "text-ink-400",
                    )}
                  >
                    {plan.headline}
                  </span>
                </div>

                <p
                  className={cn(
                    "mt-2 text-[0.875rem] leading-snug",
                    recommended ? "text-white/65" : "text-ink-600",
                  )}
                >
                  {plan.tagline}
                </p>

                <div className="mt-5 flex items-end gap-1.5">
                  <span
                    className={cn(
                      "tnum font-mono text-[2.25rem] leading-none font-semibold",
                      recommended ? "text-signal" : "text-ink-950",
                    )}
                  >
                    {money(price)}
                  </span>
                  <span
                    className={cn(
                      "pb-1 text-xs",
                      recommended ? "text-white/45" : "text-ink-400",
                    )}
                  >
                    / month
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1.5 min-h-8 text-xs leading-snug",
                    recommended ? "text-white/45" : "text-ink-400",
                  )}
                >
                  {billed !== null
                    ? `${money(billed)} billed yearly · ${annualSavingLabel}`
                    : plan.meta}
                </p>

                <ButtonLink
                  href={plan.key === "free" ? "/get-started" : `/get-started?plan=${plan.key}`}
                  variant={recommended ? "signal" : plan.key === "free" ? "primary" : "outline"}
                  block
                  className="mt-4"
                  onClick={() => track("pricing_plan_selected", { plan: plan.key, period })}
                >
                  {plan.cta}
                </ButtonLink>

                <p
                  className={cn(
                    "mt-4 font-mono text-micro uppercase tracking-[0.1em]",
                    recommended ? "text-white/40" : "text-ink-400",
                  )}
                >
                  {plan.key === "free" ? "Includes" : plan.unlocks}
                </p>
                <ul className="mt-2.5 flex flex-col gap-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          recommended ? "text-signal" : "text-mint-deep",
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "text-[0.8125rem] leading-snug",
                          recommended ? "text-white/75" : "text-ink-600",
                        )}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* ---- assurances --------------------------------------------------- */}
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pricingAssurances.map((item) => (
            <li key={item.label} className="rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-flat)]">
              <p className="text-[0.875rem] font-medium text-ink-950">{item.label}</p>
              <p className="mt-0.5 text-xs text-ink-500">{item.detail}</p>
            </li>
          ))}
        </ul>

        {/* ---- comparison --------------------------------------------------- */}
        <Reveal className="mt-10">
          <ComparisonTable />
        </Reveal>

        {showFaq ? (
          <div className="mt-12">
            <h3 className="text-display-xs text-ink-950">Before you pay</h3>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              {pricingFaq.map((item) => (
                <div key={item.q}>
                  <dt className="text-[0.9375rem] font-semibold text-ink-950">{item.q}</dt>
                  <dd className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-600">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Comparison, generated from the entitlement map                              */
/* -------------------------------------------------------------------------- */

function ComparisonTable() {
  /* Grouped by the tier that introduces the capability, so the table reads as
     "what does each step up actually buy" rather than as a wall of ticks. */
  const groups = tierOrder
    .filter((tier) => tier !== "free")
    .map((tier) => ({
      tier,
      features: (Object.keys(featureTier) as Feature[]).filter(
        (feature) => featureTier[feature] === tier,
      ),
    }))
    .filter((group) => group.features.length > 0);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3 sm:px-5">
        <h3 className="text-[0.9375rem] font-semibold text-ink-950">Compare tiers</h3>
        <SampleTag label="Generated from entitlements" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-ink-100">
              <th scope="col" className="px-4 py-2.5 text-[0.8125rem] font-medium text-ink-500 sm:px-5">
                Capability
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.key}
                  scope="col"
                  className={cn(
                    "w-20 px-2 py-2.5 text-center text-[0.8125rem] font-semibold",
                    plan.recommended ? "text-ink-950" : "text-ink-600",
                  )}
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Quotas: numbers rather than ticks. */}
            <GroupRow title="Limits" />
            <QuotaRow label="Smart asks a week" pick={(key) => quotas[key].aiAsksPerWeek} />
            <QuotaRow label="Saved places and events" pick={(key) => quotas[key].savedItems} />
            <QuotaRow label="Cities at once" pick={(key) => quotas[key].cities} />

            <GroupRow title={TIER_HEADING.free} />
            {ALWAYS_FREE.map((label) => (
              <tr key={label} className="border-b border-ink-100 last:border-b-0">
                <th
                  scope="row"
                  className="px-4 py-2.5 text-[0.8125rem] font-normal text-ink-700 sm:px-5"
                >
                  {label}
                </th>
                {plans.map((plan) => (
                  <td key={plan.key} className="px-2 py-2.5 text-center">
                    <Yes />
                  </td>
                ))}
              </tr>
            ))}

            {groups.map((group) => (
              <FeatureGroup key={group.tier} tier={group.tier} features={group.features} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-ink-100 px-4 py-3 text-xs leading-relaxed text-ink-400 sm:px-5">
        Every row is generated from the entitlement map the product enforces, so this table cannot
        promise something the app does not grant.
      </p>
    </div>
  );
}

function FeatureGroup({ tier, features }: { tier: PlanKey; features: readonly Feature[] }) {
  return (
    <>
      <GroupRow title={TIER_HEADING[tier]} />
      {features.map((feature) => (
        <tr key={feature} className="border-b border-ink-100 last:border-b-0">
          <th scope="row" className="px-4 py-2.5 text-[0.8125rem] font-normal text-ink-700 sm:px-5">
            {featureCopy[feature].label}
            <span className="mt-0.5 block text-xs text-ink-400">
              {featureCopy[feature].promise}
            </span>
          </th>
          {plans.map((plan) => (
            <td key={plan.key} className="px-2 py-2.5 text-center align-top">
              {planHasFeature(plan.key, feature) ? <Yes /> : <No />}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function GroupRow({ title }: { title: string }) {
  return (
    <tr className="bg-paper-2">
      <th
        scope="colgroup"
        colSpan={plans.length + 1}
        className="px-4 py-2 text-left font-mono text-micro uppercase tracking-[0.12em] text-ink-500 sm:px-5"
      >
        {title}
      </th>
    </tr>
  );
}

function QuotaRow({
  label,
  pick,
}: {
  label: string;
  pick: (plan: PlanKey) => number | null;
}) {
  return (
    <tr className="border-b border-ink-100">
      <th scope="row" className="px-4 py-2.5 text-[0.8125rem] font-normal text-ink-700 sm:px-5">
        {label}
      </th>
      {plans.map((plan) => {
        const value = pick(plan.key);
        return (
          <td
            key={plan.key}
            className="tnum px-2 py-2.5 text-center font-mono text-[0.8125rem] text-ink-800"
          >
            {value === null ? "Unlimited" : value.toLocaleString("en-GB")}
          </td>
        );
      })}
    </tr>
  );
}

function Yes() {
  return (
    <>
      <Check className="mx-auto size-4 text-mint-deep" aria-hidden />
      <span className="sr-only">Included</span>
    </>
  );
}

function No() {
  return (
    <>
      <Minus className="mx-auto size-4 text-ink-300" aria-hidden />
      <span className="sr-only">Not included</span>
    </>
  );
}
