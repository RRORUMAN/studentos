import type { BillingPeriod, Plan } from "@/config/pricing";
import { billedTotal, priceFor } from "@/config/pricing";
import { isBillingConfigured } from "@/services/env";

/**
 * ============================================================================
 * BILLING — Stripe
 * ----------------------------------------------------------------------------
 * Checkout is a server concern; this module only defines the contract and the
 * quote the UI is allowed to show. Prices shown to a student and prices charged
 * come from the same function, so the pricing table can never lie.
 * ============================================================================
 */

export type CheckoutIntent = {
  planKey: Plan["key"];
  period: BillingPeriod;
  priceId: string;
  /** Where Stripe returns the student after a successful payment. */
  successPath: string;
  cancelPath: string;
};

export type Quote = {
  /** Monthly-equivalent, which is the number shown on the card. */
  perMonth: number;
  /** What actually leaves the account, and how often. */
  chargedAmount: number;
  chargedEvery: "month" | "year";
};

export function quoteFor(plan: Plan, period: BillingPeriod): Quote {
  const perMonth = priceFor(plan, period);
  const annual = billedTotal(plan, period);
  return {
    perMonth,
    chargedAmount: annual ?? perMonth,
    chargedEvery: annual ? "year" : "month",
  };
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not-configured" | "no-price" | "failed" };

/**
 * Builds the intent. Until Stripe keys and price ids exist, this returns
 * `not-configured` and the UI routes the student into onboarding instead of
 * showing a broken checkout button.
 */
export async function createCheckout(
  plan: Plan,
  period: BillingPeriod,
): Promise<CheckoutResult> {
  if (!isBillingConfigured) return { ok: false, reason: "not-configured" };
  const priceId = plan.stripePriceIds[period];
  if (!priceId) return { ok: false, reason: "no-price" };
  return { ok: false, reason: "failed" };
}
