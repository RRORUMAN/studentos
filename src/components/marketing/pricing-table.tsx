"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Globe2, Minus, Sparkle } from "lucide-react";
import { useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Atmosphere, Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import {
  annualSaving,
  annualSavingLabel,
  billedTotal,
  defaultCurrency,
  fairUseNote,
  featureMatrix,
  localeFor,
  plans,
  priceCurrencies,
  pricingAssurances,
  pricingFaq,
  priceFor,
  type BillingPeriod,
  type MatrixValue,
  type PlanKey,
  type PriceCurrency,
} from "@/config/pricing";
import { ease } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * PRICING
 * ----------------------------------------------------------------------------
 * The free tier is the product strategy, so it is a full column rather than a
 * footnote — a network with a paywall in front of it has no network.
 *
 * Three things this section does that a card grid alone cannot:
 *
 *   · prices in the student's own currency, from list prices chosen per market
 *     rather than an FX conversion that lands on $8.63;
 *   · a comparison table, because the real question at this point is "what do I
 *     lose by staying free" and four bullet lists make you diff them by eye;
 *   · quantities instead of ticks wherever a feature is rate limited. A tick on
 *     a capped feature is the oldest lie on a pricing page.
 *
 * Every number comes from `priceFor` — the same function the checkout quote
 * calls — so the table cannot drift from what is actually charged.
 * ============================================================================
 */
export function PricingTable({
  showFaq = false,
  showHeader = true,
  tone = "warm",
}: {
  showFaq?: boolean;
  showHeader?: boolean;
  tone?: "warm" | "paper";
}) {
  const reduced = useReducedMotion();
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [currency, setCurrency] = useState<PriceCurrency>(defaultCurrency);

  const where = { currency, locale: localeFor(currency) };

  return (
    <Section id="pricing" tone={tone} className="overflow-hidden">
      <Atmosphere
        grid={false}
        blobs={[{ className: "-top-64 left-1/2 size-[46rem] -translate-x-1/2 bg-signal/16", drift: "b" }]}
      />

      <div className="page relative">
        {showHeader ? (
          <Reveal>
            <div className="max-w-3xl">
              <Eyebrow index="16">Pricing</Eyebrow>
              <h2 className="mt-4 text-display-md text-ink-950">
                The community is free. The depth is what you pay for.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-600">
                A network is worthless with a paywall in front of it, so {brand.surfaces.loop},
                city chat, events, deals and joining other people&rsquo;s plans stay free
                permanently and unmetered. Paying unlocks the rest of the product — unlimited AI,
                every map layer and filter, the budget coach, forecasting, group planning and
                Survival Mode.
              </p>
            </div>
          </Reveal>
        ) : null}

        {/* ---- controls ------------------------------------------------------ */}
        <Reveal delay={0.05}>
          <div className={cn("flex flex-wrap items-center gap-3", showHeader && "mt-9")}>
            <div
              role="radiogroup"
              aria-label="Billing period"
              className="inline-flex rounded-full border border-ink-200 bg-white p-1"
            >
              {(["monthly", "annual"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={period === key}
                  onClick={() => {
                    setPeriod(key);
                    track("pricing_period_changed", { period: key });
                  }}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors",
                    period === key ? "text-ink-950" : "text-ink-500 hover:text-ink-800",
                  )}
                >
                  {period === key ? (
                    <motion.span
                      layoutId="pricing-switch"
                      className="absolute inset-0 rounded-full bg-ink-100"
                      transition={reduced ? { duration: 0 } : { duration: 0.24, ease: ease.out }}
                    />
                  ) : null}
                  <span className="relative">{key}</span>
                </button>
              ))}
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-signal px-3 py-1.5 text-[0.8125rem] font-medium text-ink-950">
              <Sparkle className="size-3.5" aria-hidden />
              Annual is {annualSavingLabel}
            </span>

            {/* Currency. Sits with the billing switch because it is the same
                decision: what will actually leave my account, and in what. */}
            <div className="ml-auto flex items-center gap-2">
              <Globe2 className="size-4 text-ink-400" aria-hidden />
              <label htmlFor="pricing-currency" className="sr-only">
                Display currency
              </label>
              <select
                id="pricing-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as PriceCurrency)}
                className={cn(
                  "cursor-pointer rounded-full border border-ink-200 bg-white py-2 pr-8 pl-3.5 text-sm font-medium text-ink-800",
                  "transition-colors hover:border-ink-300",
                )}
              >
                {priceCurrencies.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code} · {entry.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Reveal>

        {/* ---- plans --------------------------------------------------------- */}
        <div className="mt-8 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => {
            const perMonth = priceFor(plan, period, currency);
            const annualTotal = billedTotal(plan, period, currency);
            const saved = annualSaving(plan, currency);
            const featured = Boolean(plan.recommended);

            return (
              <Reveal
                key={plan.key}
                delay={reduced ? 0 : index * 0.05}
                className={cn("h-full", featured && "xl:-mt-4")}
              >
                <div
                  data-surface={featured ? "dark" : "light"}
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl border p-5",
                    featured
                      ? "border-transparent bg-linear-to-b from-console-2 to-console text-white shadow-[var(--shadow-console)] ring-1 ring-white/8 xl:p-6 xl:pt-8"
                      : "border-ink-200 bg-paper",
                  )}
                >
                  {featured ? (
                    <span className="absolute -top-3 left-5 rounded-full bg-signal px-2.5 py-1 font-mono text-micro font-semibold tracking-[0.08em] text-ink-950 uppercase">
                      Recommended
                    </span>
                  ) : null}

                  <div>
                    <h3
                      className={cn(
                        "font-display text-xl font-semibold tracking-[-0.02em]",
                        featured ? "text-white" : "text-ink-950",
                      )}
                    >
                      {plan.name}
                    </h3>
                    <p
                      className={cn(
                        "mt-1.5 text-[0.8125rem] leading-snug",
                        featured ? "text-white/55" : "text-ink-500",
                      )}
                    >
                      {plan.tagline}
                    </p>
                  </div>

                  <div className="mt-5">
                    <p className="flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "tnum font-mono text-[2.25rem] leading-none font-semibold",
                          featured ? "text-signal" : "text-ink-950",
                        )}
                      >
                        {money(perMonth, where)}
                      </span>
                      {plan.monthly > 0 ? (
                        <span className={cn("text-sm", featured ? "text-white/45" : "text-ink-400")}>
                          /month
                        </span>
                      ) : null}
                    </p>

                    {/* Two lines, always in the same slots, so the four cards
                        stay aligned whichever billing period is selected. */}
                    <p className={cn("mt-2 text-xs", featured ? "text-white/45" : "text-ink-400")}>
                      {annualTotal
                        ? `${money(annualTotal, where)} billed once a year`
                        : plan.monthly === 0
                          ? plan.meta
                          : "Billed monthly, cancel any time"}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-xs font-medium",
                        saved > 0 && period === "annual"
                          ? featured
                            ? "text-mint"
                            : "text-mint-deep"
                          : "text-transparent select-none",
                      )}
                    >
                      {saved > 0 && period === "annual"
                        ? `Saves ${money(saved, where)} a year`
                        : " "}
                    </p>
                  </div>

                  <ButtonLink
                    href={`/get-started?plan=${plan.key}&billing=${period}&currency=${currency}`}
                    variant={featured ? "signal" : plan.monthly === 0 ? "primary" : "outline"}
                    size="md"
                    block
                    className="mt-5"
                    onClick={() => track("pricing_plan_selected", { plan: plan.key, period })}
                  >
                    {plan.cta}
                  </ButtonLink>

                  {/* The one line that actually differentiates this tier from
                      the one below it. Four bullet lists that each open with
                      "Everything in X" are impossible to diff by eye, so the
                      difference is stated once, loudly, above the list. */}
                  <p
                    className={cn(
                      "mt-6 rounded-lg px-3 py-2.5 text-[0.8125rem] leading-snug font-medium",
                      featured
                        ? "bg-signal/12 text-signal"
                        : plan.monthly === 0
                          ? "bg-ink-100 text-ink-700"
                          : "bg-signal-soft text-signal-deep",
                    )}
                  >
                    {plan.unlocks}
                  </p>

                  <ul className="mt-4 flex flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5">
                        <Check
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            featured ? "text-signal" : "text-mint-deep",
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "text-[0.875rem] leading-snug",
                            featured ? "text-white/75" : "text-ink-700",
                          )}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* ---- assurances ----------------------------------------------------- */}
        <Reveal delay={0.1}>
          <dl className="mt-6 grid gap-px overflow-hidden rounded-xl bg-ink-200/70 sm:grid-cols-2 lg:grid-cols-4">
            {pricingAssurances.map((item) => (
              <div key={item.label} className="bg-paper px-4 py-4">
                <dt className="text-[0.8125rem] font-semibold text-ink-950">{item.label}</dt>
                <dd className="mt-0.5 text-xs leading-snug text-ink-500">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal>
          <p className="mt-5 max-w-3xl text-[0.8125rem] leading-relaxed text-ink-400">
            Prices are list prices per currency, not conversions. Anywhere outside these three,
            billing is in euro and your bank&rsquo;s exact charge is shown before you confirm.
            Partner benefits are listed on Max only where a real agreement exists — until one does,
            that line stays empty rather than being filled with logos.
          </p>
        </Reveal>

        {/* ---- comparison ------------------------------------------------------ */}
        <ComparisonTable />

        {/* ---- FAQ ------------------------------------------------------------- */}
        {showFaq ? (
          <div className="mt-16">
            <Reveal>
              <h3 className="text-display-sm text-ink-950">Before you pay for anything</h3>
            </Reveal>
            <dl className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
              {pricingFaq.map((item) => (
                <Reveal key={item.q}>
                  <dt className="text-[0.9375rem] font-semibold text-ink-950">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ink-600">{item.a}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Comparison                                                                  */
/* -------------------------------------------------------------------------- */

const PLAN_KEYS: readonly PlanKey[] = ["free", "plus", "pro", "max"];

function ComparisonTable() {
  return (
    <div className="mt-16">
      <Reveal>
        <h3 className="text-display-sm text-ink-950">What you actually get</h3>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">
          Where a feature is limited, the limit is written in the cell. A tick on a capped feature
          would be a lie, so there are none.
        </p>
      </Reveal>

      {/* The table scrolls inside its own container: the page itself must never
          scroll sideways on a phone. */}
      <Reveal delay={0.05}>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-200 bg-paper">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <caption className="sr-only">Feature comparison across the four plans</caption>
            <thead>
              <tr className="border-b border-ink-200">
                <th scope="col" className="w-[38%] px-5 py-4 text-sm font-semibold text-ink-950">
                  Feature
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.key}
                    scope="col"
                    className={cn(
                      "px-4 py-4 text-center text-sm font-semibold",
                      plan.recommended ? "bg-signal-soft text-ink-950" : "text-ink-950",
                    )}
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>

            {featureMatrix.map((group) => (
              <tbody key={group.title}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={PLAN_KEYS.length + 1}
                    className="bg-paper-2 px-5 py-2.5 text-left font-mono text-micro uppercase tracking-[0.12em] text-ink-500"
                  >
                    {group.title}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="border-t border-ink-100">
                    <th scope="row" className="px-5 py-3.5 text-left align-top font-normal">
                      <span className="block text-[0.875rem] font-medium text-ink-900">
                        {row.label}
                      </span>
                      {row.hint ? (
                        <span className="mt-0.5 block text-xs leading-snug text-ink-400">
                          {row.hint}
                        </span>
                      ) : null}
                    </th>
                    {plans.map((plan) => (
                      <td
                        key={plan.key}
                        className={cn(
                          "px-4 py-3.5 text-center align-top",
                          plan.recommended && "bg-signal-soft/40",
                        )}
                      >
                        <Cell value={row.values[plan.key]} label={`${row.label}, ${plan.name}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Reveal>

      <Reveal>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-ink-400">{fairUseNote}</p>
      </Reveal>
    </div>
  );
}

function Cell({ value, label }: { value: MatrixValue; label: string }) {
  if (value === true) {
    return (
      <>
        <Check className="mx-auto size-4.5 text-mint-deep" aria-hidden />
        <span className="sr-only">{label}: included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="mx-auto size-4 text-ink-300" aria-hidden />
        <span className="sr-only">{label}: not included</span>
      </>
    );
  }
  return <span className="text-[0.8125rem] font-medium text-ink-700">{value}</span>;
}
