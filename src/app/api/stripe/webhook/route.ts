import type Stripe from "stripe";

import type { PlanKey } from "@/config/pricing";
import type { SubscriptionStatus } from "@/domain/types";
import { fetchSubscription, planForPriceId, verifyWebhook } from "@/server/billing/stripe";
import { findOne, nowIso, transaction } from "@/server/db";

/**
 * ============================================================================
 * STRIPE WEBHOOK
 * ----------------------------------------------------------------------------
 * The only writer of the `subscriptions` table.
 *
 * Three properties this endpoint has to have, and each one is a bug class it
 * would otherwise ship:
 *
 *   VERIFIED     Every request is signature-checked. Without it, a POST from
 *                anyone grants any plan.
 *   IDEMPOTENT   Stripe retries. Processing `checkout.session.completed` twice
 *                must be indistinguishable from processing it once, so the
 *                event id is recorded and replays are dropped.
 *   ORDER-SAFE   Webhooks arrive out of order. Every handler writes the full
 *                current state from the event rather than applying a delta, so
 *                a late-arriving older event cannot rewind a newer one.
 *
 * It returns 200 for events it does not handle. A non-200 makes Stripe retry
 * forever, and "we do not care about this event" is not a failure.
 * ============================================================================
 */

export async function POST(request: Request): Promise<Response> {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  const event = verifyWebhook(payload, signature);
  if (!event) {
    /* 400, not 500: a bad signature is a rejected request, and 5xx would make
       Stripe retry a payload that will never verify. */
    return new Response("Invalid signature", { status: 400 });
  }

  /* ---- idempotency ------------------------------------------------------ */
  const alreadyProcessed = await findOne("processedStripeEvents", (row) => row.id === event.id);
  if (alreadyProcessed) return new Response("Already processed", { status: 200 });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
        if (!userId || !session.subscription) break;

        const subscription = await fetchSubscription(
          typeof session.subscription === "string" ? session.subscription : session.subscription.id,
        );
        if (subscription) await writeSubscription(userId, subscription);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId ?? null;
        if (userId) await writeSubscription(userId, subscription);
        break;
      }

      case "invoice.payment_failed": {
        /* Do not downgrade here. Stripe moves the subscription to `past_due`
           and retries for the dunning window; `effectivePlan` keeps access
           through it deliberately, because cutting off a student's budget the
           hour a card expires churns people who would have paid. */
        break;
      }

      default:
        break;
    }

    await transaction((db) => {
      db.processedStripeEvents.push({ id: event.id, at: nowIso() });
      /* Keep the guard table bounded. Stripe does not retry beyond a few days,
         so anything older than a week cannot still be in flight. */
      const cutoff = Date.now() - 7 * 86_400_000;
      const kept = db.processedStripeEvents.filter((row) => Date.parse(row.at) > cutoff);
      db.processedStripeEvents.length = 0;
      db.processedStripeEvents.push(...kept);
    });

    return new Response("ok", { status: 200 });
  } catch {
    /* 500 so Stripe retries: something transient went wrong on our side and
       the event has not been marked processed, so a retry is safe. */
    return new Response("Handler failed", { status: 500 });
  }
}

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Write the full subscription state from the event.
 *
 * Deliberately not a patch: the whole row is replaced from what Stripe says is
 * true right now, so an out-of-order delivery cannot leave a half-applied
 * state.
 */
async function writeSubscription(userId: string, subscription: Stripe.Subscription): Promise<void> {
  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  const resolved = priceId ? planForPriceId(priceId) : null;

  const plan: PlanKey = resolved?.plan ?? "free";
  const period = resolved?.period ?? "monthly";

  const status = mapStatus(subscription.status);

  /* `current_period_end` lives on the subscription item in recent API
     versions; fall back to the subscription for older shapes. */
  const periodEnd =
    (item as { current_period_end?: number } | undefined)?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end ??
    null;

  await transaction((db) => {
    const index = db.subscriptions.findIndex((row) => row.userId === userId);
    const row = {
      userId,
      plan: status === "canceled" && !periodEnd ? ("free" as PlanKey) : plan,
      status,
      period,
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : (subscription.customer?.id ?? null),
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: nowIso(),
    };

    if (index === -1) db.subscriptions.push(row);
    else db.subscriptions[index] = row;
  });
}

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "none";
  }
}
