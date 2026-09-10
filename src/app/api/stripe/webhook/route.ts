import type Stripe from "stripe";

import type { PlanKey } from "@/config/pricing";
import type { SubscriptionStatus } from "@/domain/types";
import { fetchSubscription, planForPriceId, verifyWebhook } from "@/server/billing/stripe";
import { nowIso, transaction } from "@/server/db";

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

  /* ---- idempotency ------------------------------------------------------
     Claimed in one transaction, before any handling, rather than checked and
     marked around it. Stripe retries, and a retry can arrive while the first
     delivery is still awaiting `fetchSubscription` — with the check and the
     mark at opposite ends of the handler, both deliveries pass the check and
     both process the event. Reading and writing inside one transaction makes
     the claim atomic, and the row store's optimistic check means the second
     instance loses the race and sees the claim on its replay.

     The claim is released again if handling throws, so a genuine failure still
     gets the retry it needs. */
  const claimed = await transaction((db) => {
    if (db.processedStripeEvents.some((row) => row.id === event.id)) return false;
    db.processedStripeEvents.push({ id: event.id, at: nowIso() });
    return true;
  });

  if (!claimed) return new Response("Already processed", { status: 200 });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
        if (!userId || !session.subscription) break;

        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;

        const subscription = await fetchSubscription(subscriptionId);

        /* THROW, do not shrug.
           `fetchSubscription` returns null for every failure alike — a network
           blip, a rate limit, a restricted key missing Subscriptions read. This
           used to be `if (subscription) await write(...)`, which meant those all
           fell through to a 200 while the event id stayed in the processed
           table. Stripe treats 200 as delivered and never sends it again, so a
           student who had just paid was never granted anything, and the replay
           that would have fixed it was refused as a duplicate.

           Throwing releases the idempotency claim and answers 500, which is the
           whole reason that release path exists: Stripe then retries, and the
           second delivery does the work. A payment taken and silently not
           granted is the worst outcome this endpoint can produce. */
        if (!subscription) {
          throw new Error(`checkout.session.completed: could not retrieve subscription ${subscriptionId}`);
        }

        await writeSubscription(userId, subscription);
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

    /* Keep the guard table bounded. Stripe does not retry beyond a few days,
       so anything older than a week cannot still be in flight. */
    await transaction((db) => {
      const cutoff = Date.now() - 7 * 86_400_000;
      const kept = db.processedStripeEvents.filter((row) => Date.parse(row.at) > cutoff);
      db.processedStripeEvents.length = kept.length;
      for (let index = 0; index < kept.length; index += 1) db.processedStripeEvents[index] = kept[index];
    });

    return new Response("ok", { status: 200 });
  } catch {
    /* Release the claim, then 500 so Stripe retries. Leaving it in place would
       make the retry a no-op and lose the event permanently — a subscription
       paid for and never granted, which is the worst outcome available here. */
    await transaction((db) => {
      const kept = db.processedStripeEvents.filter((row) => row.id !== event.id);
      db.processedStripeEvents.length = kept.length;
      for (let index = 0; index < kept.length; index += 1) db.processedStripeEvents[index] = kept[index];
    });

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
