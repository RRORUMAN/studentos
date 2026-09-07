import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { GigForm } from "@/components/app/gig-form";
import { MascotArt } from "@/components/mascot/mascot-art";
import { workSafety } from "@/domain/work";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Post a gig",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * POST A GIG
 * ----------------------------------------------------------------------------
 * The supply side of the student economy, and the half no job board has.
 *
 * A student who needs a sofa carried, a room photographed or a contract read
 * is a customer nobody serves: too small for a marketplace, too awkward for a
 * group chat, and worth €25 to somebody on the same campus. That transaction
 * is where this pillar is genuinely different, so posting is free, takes a
 * minute, and is one tap from the board.
 * ============================================================================
 */
export default async function PostGigPage() {
  const viewer = await requireViewer();

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
        <MascotArt state="social" className="size-14 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Post a gig</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            Something small you will pay a student to do, in {viewer.city.name}. It goes to students
            whose skills match — not to the whole city.
          </p>
        </div>
      </header>

      <GigForm currencySymbol={viewer.city.currency.symbol} />

      <section className="mt-8 rounded-2xl bg-paper-2 p-5">
        <h2 className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-950">
          <ShieldCheck className="size-4 text-signal-deep" />
          For whoever answers
        </h2>
        <ul className="mt-2.5 space-y-1.5 text-[0.875rem] leading-relaxed text-ink-600">
          {workSafety.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-300" />
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
