import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProfileForm } from "@/components/app/settings-forms";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Profile and interests",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const viewer = await requireViewer();

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/you"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        You
      </Link>

      <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Profile and interests</h1>
      <p className="mt-2 mb-7 text-[0.9375rem] leading-relaxed text-ink-600">
        Interests are what every recommendation is scored against, so this is the page that changes what the product shows you.
      </p>

      <ProfileForm
        neighbourhoods={viewer.city.neighbourhoods}
        initial={{
          displayName: viewer.profile.displayName,
          bio: viewer.profile.bio ?? "",
          avatarEmoji: viewer.profile.avatarEmoji,
          interests: [...viewer.profile.interests],
          homeArea: viewer.profile.homeArea ?? "",
          maxTravelMinutes: viewer.profile.maxTravelMinutes,
          priceSensitivity: viewer.profile.priceSensitivity,
          diets: [...viewer.profile.diets],
        }}
      />
    </div>
  );
}
