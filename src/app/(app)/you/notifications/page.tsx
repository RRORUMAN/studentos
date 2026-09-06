import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NotificationForm } from "@/components/app/settings-forms";
import { findOne } from "@/server/db";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const viewer = await requireViewer();
  const prefs = await findOne("notificationPrefs", (row) => row.userId === viewer.user.id);

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href="/you" className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        You
      </Link>

      <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Notifications</h1>
      <p className="mt-2 mb-7 text-[0.9375rem] leading-relaxed text-ink-600">
        Instant, once a day, or off — per topic. Everything except budget warnings starts off. We would rather you turned things on than dug through settings turning them off.
      </p>

      <NotificationForm
        initial={prefs?.topics ?? { "budget-warnings": true }}
        delivery={(prefs?.delivery as Record<string, string> | undefined) ?? {}}
        quiet={{ from: prefs?.quietFrom ?? 23, to: prefs?.quietTo ?? 8 }}
      />
    </div>
  );
}
