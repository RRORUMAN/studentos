import type { Metadata } from "next";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { Wordmark } from "@/components/brand/logo";
import { brand } from "@/brand/brand.config";
import { plans, type PlanKey } from "@/config/pricing";

export const metadata: Metadata = {
  title: "Get started",
  description: `Four questions — city, university, budget, interests — and ${brand.name} shows you what your first month actually looks like. Free, no card.`,
  robots: { index: false, follow: true },
};

function parsePlan(value: string | string[] | undefined): PlanKey | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return plans.find((plan) => plan.key === candidate)?.key;
}

export default async function GetStartedPage(props: PageProps<"/get-started">) {
  const params = await props.searchParams;
  const plan = parsePlan(params.plan);
  const billingRaw = Array.isArray(params.billing) ? params.billing[0] : params.billing;
  const billing = billingRaw === "annual" ? "annual" : undefined;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-ink-300/50 dotfield [mask-image:radial-gradient(60%_40%_at_50%_0%,black,transparent)]"
      />
      <div className="page relative py-14 sm:py-20">
        <div className="mb-10 flex flex-col items-center text-center">
          <Wordmark />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-500">
            Four questions. No account, no card. At the end you get a real setup for your city that
            you can look around straight away.
          </p>
        </div>

        <OnboardingFlow preselectedPlan={plan} billing={billing} />
      </div>
    </div>
  );
}
