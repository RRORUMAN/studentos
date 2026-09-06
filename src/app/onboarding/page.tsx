import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupFlow } from "@/components/onboarding/setup-flow";
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

      <div className="relative px-5 py-10 sm:py-14">
        <div className="mx-auto mb-10 w-full max-w-lg">
          <Wordmark />
        </div>
        <SetupFlow />
      </div>
    </main>
  );
}
