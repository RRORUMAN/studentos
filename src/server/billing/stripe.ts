import "server-only";

import Stripe from "stripe";

import type { BillingPeriod, PlanKey } from "@/config/pricing";
import { plans } from "@/config/pricing";
import { env, isBillingConfigured } from "@/services/env";

/**
 * ============================================================================
 * STRIPE
 * ----------------------------------------------------------------------------
 * Checkout, the billing portal, and the webhook that is the only thing allowed
 * to change what a student has paid for.
 *
 * The rule that matters: **the app never infers entitlement from a redirect.**
 * A student returning from a successful checkout lands on a "setting up your
 * plan" screen, not an unlocked one. The subscription row is written by the
 * webhook and nowhere else, because a success URL is just a URL — anyone can
 * visit `/upgrade/success` — and treating it as proof of payment is the oldest
 * billing bug there is.
 *
 * Price ids come from configuration, never from the client. A checkout that
 * accepted a `priceId` from a form would let anyone buy Max at the Starter
 * price by editing one field.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */

let client: Stripe | null = null;

function stripe(): Stripe {
  if (!env.stripe.secretKey) {
    throw new Error("Stripe is not configured.");
  }
  client ??= new Stripe(env.stripe.secretKey, {
    /* Pinned. An unpinned version means a Stripe-side upgrade can change the
       shape of a webhook payload without a deploy on our side. */
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
  });
  return client;
}

export { isBillingConfigured };

/* -------------------------------------------------------------------------- */
/* Price resolution                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Price ids, resolved from the environment.
 *
 * Named per plan and period so a missing one fails loudly at checkout rather
 * than silently charging the wrong amount.
 */
function priceIdFor(plan: PlanKey, period: BillingPeriod): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`;
  const fromEnv = process.env[key];
  if (fromEnv) return fromEnv;

  /* Fall back to anything declared in the pricing config. */
  return plans.find((entry) => entry.key === plan)?.stripePriceIds[period] ?? null;
}

/** Reverse lookup, for the webhook. */
export function planForPriceId(priceId: string): { plan: PlanKey; period: BillingPeriod } | null {
  for (const plan of plans) {
    for (const period of ["monthly", "annual"] as const) {
      if (priceIdFor(plan.key, period) === priceId) return { plan: plan.key, period };
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Checkout                                                                    */
/* -------------------------------------------------------------------------- */

export type CheckoutOutcome =
  | { ok: true; url: string }
  | { ok: false; reason: "not-configured" | "no-price" | "failed"; message: string };

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  plan: PlanKey;
  period: BillingPeriod;
  origin: string;
  existingCustomerId: string | null;
}): Promise<CheckoutOutcome> {
  if (!isBillingConfigured) {
    return {
      ok: false,
      reason: "not-configured",
      message: "Billing is not connected in this environment yet.",
    };
  }

  const priceId = priceIdFor(input.plan, input.period);
  if (!priceId) {
    return {
      ok: false,
      reason: "no-price",
      message: `No Stripe price is configured for ${input.plan} ${input.period}.`,
    };
  }

  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        customer: input.existingCustomerId ?? undefined,
        customer_email: input.existingCustomerId ? undefined : input.email,
        /* The user id travels on the subscription so the webhook can find the
           account without trusting anything in the return URL. */
        client_reference_id: input.userId,
        subscription_data: { metadata: { userId: input.userId, plan: input.plan } },
        metadata: { userId: input.userId, plan: input.plan },
        success_url: `${input.origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/upgrade?cancelled=1`,
        allow_promotion_codes: true,
      },
      {
        /* One checkout per user per plan per period per minute. Protects
           against a double-clicked button creating two subscriptions. */
        idempotencyKey: `checkout:${input.userId}:${input.plan}:${input.period}:${Math.floor(
          Date.now() / 60_000,
        )}`,
      },
    );

    return session.url
      ? { ok: true, url: session.url }
      : { ok: false, reason: "failed", message: "Stripe did not return a checkout URL." };
  } catch {
    return { ok: false, reason: "failed", message: "Could not start checkout. Try again." };
  }
}

/* -------------------------------------------------------------------------- */
/* Portal                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The billing portal.
 *
 * Cancelling, changing card and switching plan all happen in Stripe's own
 * portal rather than in our UI. That is a deliberate scope decision: those
 * flows have tax, proration and dunning edge cases that are Stripe's job, and
 * a home-grown cancel button that half works is worse than no cancel button.
 */
export async function createPortalSession(input: {
  customerId: string;
  origin: string;
}): Promise<CheckoutOutcome> {
  if (!isBillingConfigured) {
    return { ok: false, reason: "not-configured", message: "Billing is not connected." };
  }

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: input.customerId,
      return_url: `${input.origin}/you`,
    });
    return { ok: true, url: session.url };
  } catch {
    return { ok: false, reason: "failed", message: "Could not open the billing portal." };
  }
}

/* -------------------------------------------------------------------------- */
/* Webhook verification                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Verify and parse a webhook.
 *
 * The signature check is not optional and there is no development bypass. An
 * unverified webhook endpoint lets anyone POST a `checkout.session.completed`
 * and grant themselves Max — it is the single most exploitable thing a SaaS
 * can ship.
 */
export function verifyWebhook(payload: string, signature: string | null): Stripe.Event | null {
  if (!env.stripe.webhookSecret || !signature) return null;

  try {
    return stripe().webhooks.constructEvent(payload, signature, env.stripe.webhookSecret);
  } catch {
    return null;
  }
}

/** Fetch a subscription, for the events that only carry an id. */
export async function fetchSubscription(id: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe().subscriptions.retrieve(id);
  } catch {
    return null;
  }
}
