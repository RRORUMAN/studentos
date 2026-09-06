"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { BillingPeriod, PlanKey } from "@/config/pricing";
import { createCheckoutSession, createPortalSession } from "@/server/billing/stripe";
import { findOne } from "@/server/db";
import { requireUserId } from "@/server/viewer";

/**
 * Billing actions.
 *
 * Both read the origin from the request headers rather than from configuration
 * or the client: the return URL has to match the host the student is actually
 * on, or a preview deployment sends them back to production.
 */

export type BillingActionResult = { ok: false; message: string };

async function originFromRequest(): Promise<string> {
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "localhost:3000";
  const proto = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function startCheckout(
  plan: PlanKey,
  period: BillingPeriod,
): Promise<BillingActionResult> {
  const userId = await requireUserId();

  const [user, subscription] = await Promise.all([
    findOne("users", (row) => row.id === userId),
    findOne("subscriptions", (row) => row.userId === userId),
  ]);

  if (!user) return { ok: false, message: "Sign in again." };

  const result = await createCheckoutSession({
    userId,
    email: user.email,
    plan,
    period,
    origin: await originFromRequest(),
    existingCustomerId: subscription?.stripeCustomerId ?? null,
  });

  if (!result.ok) return { ok: false, message: result.message };

  redirect(result.url);
}

export async function openBillingPortal(): Promise<BillingActionResult> {
  const userId = await requireUserId();
  const subscription = await findOne("subscriptions", (row) => row.userId === userId);

  if (!subscription?.stripeCustomerId) {
    return { ok: false, message: "There is no billing account to manage yet." };
  }

  const result = await createPortalSession({
    customerId: subscription.stripeCustomerId,
    origin: await originFromRequest(),
  });

  if (!result.ok) return { ok: false, message: result.message };

  redirect(result.url);
}
