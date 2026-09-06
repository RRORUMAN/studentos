import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PrivacyForm } from "@/components/app/settings-forms";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Privacy and visibility",
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

      <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Privacy and visibility</h1>
      <p className="mt-2 mb-7 text-[0.9375rem] leading-relaxed text-ink-600">
        Your home location, budget and questions are never visible to anyone, at any setting. These control everything else.
      </p>

      <PrivacyForm initial={viewer.profile.privacy} />
    </div>
  );
}
