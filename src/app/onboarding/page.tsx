import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupFlowClient } from "@/components/onboarding/setup-flow-client";
import { Wordmark } from "@/components/brand/logo";
import { getAccount } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Set up",
  robots: { index: false, follow: false },
};

/**
 * Onboarding sits outside every route group: it has no marketing chrome and no
 * app shell, because a bottom navigation bar on a setup flow is an invitation
 * to abandon it halfway.
 */
export default async function OnboardingPage() {
  const account = await getAccount();

  if (!account) redirect("/signup");
  if (account.onboarded) redirect("/home");

  return (
    <main id="main" className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-ink-300/40 dotfield [mask-image:radial-gradient(70%_40%_at_50%_0%,black,transparent)]"
      />

      <div className="relative px-5 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto mb-10 w-full max-w-5xl">
          <Wordmark />
        </div>
        <SetupFlowClient />
      </div>
    </main>
  );
}
