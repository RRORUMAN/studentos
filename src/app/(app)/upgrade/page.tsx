import { Check, Info } from "lucide-react";
import type { Metadata } from "next";

import { UpgradeOptions } from "@/components/app/upgrade-options";
import { MascotArt } from "@/components/mascot/mascot-art";
import { type Feature, featureCopy, requiredTier } from "@/config/entitlements";
import { plans } from "@/config/pricing";
import { isBillingConfigured } from "@/server/billing/stripe";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Upgrade",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * UPGRADE
 * ----------------------------------------------------------------------------
 * The pricing screen inside the product.
 *
 * When a student arrives here from a specific lock — `?feature=survivalMode` —
 * the page leads with *that* feature and what it does, then shows the tiers.
 * A generic pricing table shown to someone who just tried to do one specific
 * thing is a page that answers a question they did not ask.
 *
 * When Stripe is not configured the buttons say so plainly rather than
 * pretending to work. A checkout button that silently does nothing is worse
 * than an honest "not connected in this environment".
 * ============================================================================
 */
export default async function UpgradePage(props: PageProps<"/upgrade">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;

  const raw = Array.isArray(params.feature) ? params.feature[0] : params.feature;
  const feature = raw && raw in featureCopy ? (raw as Feature) : null;
  const cancelled = params.cancelled !== undefined;

  const current = viewer.entitlements.plan;
  const target = feature ? requiredTier(feature) : null;

  return (
    <div className="page max-w-3xl py-6 sm:py-8">
      {/* ---- the specific thing they wanted ------------------------------- */}
      {feature ? (
        <header className="mb-8 flex items-start gap-4 rounded-xl border border-ink-200 bg-white p-5">
          <MascotArt state="thinking" className="size-14 shrink-0" />
          <div>
            <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
              You were trying to use
            </p>
            <h1 className="mt-1 text-display-xs text-ink-950">{featureCopy[feature].label}</h1>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
              {featureCopy[feature].promise}
            </p>
          </div>
        </header>
      ) : (
        <header className="mb-8">
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Your plan</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">
            The community, events, deals and the basic budget stay free at every tier. Paying
            unlocks depth, not access to other students.
          </p>
        </header>
      )}

      {cancelled ? (
        <p className="mb-6 rounded-lg bg-ink-100 px-4 py-3 text-[0.875rem] text-ink-700">
          Checkout cancelled. Nothing was charged.
        </p>
      ) : null}

      {!isBillingConfigured ? (
        <p className="mb-6 flex items-start gap-2.5 rounded-lg bg-amber-soft/70 px-4 py-3 text-[0.875rem] leading-snug text-amber-deep">
          <Info className="mt-px size-4 shrink-0" />
          <span>
            <span className="font-semibold">Billing is not connected in this environment.</span>{" "}
            The plans below are real and the entitlement system is live — checkout needs Stripe
            keys and price ids before it can charge anything.
          </span>
        </p>
      ) : null}

      <UpgradeOptions
        currentPlan={current}
        highlightPlan={target}
        billingReady={isBillingConfigured}
      />

      {/* ---- what is always free ------------------------------------------ */}
      <section className="mt-10 rounded-xl border border-ink-200 bg-paper-2/50 p-5">
        <h2 className="text-[1.0625rem] font-semibold text-ink-950">
          Free at every tier, permanently
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            "The Loop — city and campus feeds",
            "City chat, replies and votes",
            "Events and student deals",
            "Joining anyone else's plan",
            "The core map layers",
            "Manual budget and safe-to-spend",
            "Arrival Mode checklist",
            "Marketplace buying and selling",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 text-[0.875rem] text-ink-700">
              <Check className="mt-0.5 size-4 shrink-0 text-mint-deep" />
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-500">
          A paywall in front of the community would shrink the network every paid feature is built
          on. That is why it is not there.
        </p>
      </section>

      <p className="mt-6 text-[0.8125rem] text-ink-400">
        {plans.find((plan) => plan.key === current)?.name} is your current plan. Cancel any time
        from the billing portal; access continues to the end of the period you paid for.
      </p>
    </div>
  );
}
