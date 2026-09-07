import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { WorkProfileForm } from "@/components/app/work-profile-form";
import { MascotArt } from "@/components/mascot/mascot-art";
import { loadWorkProfile } from "@/server/queries/work";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Your work profile",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * WORK PROFILE
 * ----------------------------------------------------------------------------
 * A shell. Everything interesting is in the form, which is a client component
 * because half of it is chips that only make sense while you are pressing them.
 *
 * Deliberately not part of the main onboarding flow: onboarding is already
 * eleven steps, and a student who does not want a job should never be made to
 * scroll past a wage floor to finish signing up. Work asks its own questions
 * the first time somebody opens Work, which is the moment they are answerable.
 * ============================================================================
 */
export default async function WorkProfilePage() {
  const viewer = await requireViewer();
  const profile = await loadWorkProfile(viewer.user.id);

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/work"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Work
      </Link>

      <header className="flex items-start gap-4">
        <MascotArt state="thinking" className="size-14 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Your work profile</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            This is what the matching reads. Nothing here is shown to anybody unless you turn that
            on at the bottom, and every blank is treated as “no preference” rather than as a no.
          </p>
        </div>
      </header>

      <WorkProfileForm profile={profile} currencySymbol={viewer.city.currency.symbol} />
    </div>
  );
}
