import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";

import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";
import { plans } from "@/config/pricing";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Thanks",
  robots: { index: false, follow: false },
};

/**
 * The post-checkout screen.
 *
 * It deliberately does NOT unlock anything or claim a plan. Entitlement is
 * written by the Stripe webhook and read from the subscription row; a success
 * URL is just a URL anyone can visit, and granting a plan on arrival here is
 * the oldest billing bug there is.
 *
 * So this page reads the *actual* current plan. If the webhook has already
 * landed it says so; if not, it says the payment is confirming — which is
 * true, and resolves within seconds without the student doing anything.
 */
export default async function UpgradeSuccessPage() {
  const viewer = await requireViewer();
  const plan = plans.find((entry) => entry.key === viewer.entitlements.plan);
  const settled = viewer.entitlements.plan !== "free";

  return (
    <div className="page max-w-md py-16 text-center">
      <MascotArt state={settled ? "celebrating" : "thinking"} className="mx-auto size-24" />

      <h1 className="mt-6 text-display-sm text-ink-950">
        {settled ? `You are on ${plan?.name}.` : "Confirming your payment."}
      </h1>

      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-600">
        {settled
          ? "Everything in your plan is unlocked. Nothing else to do."
          : "Stripe is confirming with us now. This usually takes a few seconds — refresh in a moment and it will be here."}
      </p>

      <ButtonLink href="/home" variant="primary" size="lg" block className="mt-7">
        Back to {settled ? "your city" : "Home"}
        <ArrowRight className="size-4" />
      </ButtonLink>

      {settled ? (
        <p className="mt-4 text-[0.8125rem] text-ink-400">
          Manage or cancel any time from You → your plan.
        </p>
      ) : null}
    </div>
  );
}
