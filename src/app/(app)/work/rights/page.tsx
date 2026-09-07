import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { noWorkRightsSource, workRightsDisclaimer, workRightsFor } from "@/data/work-rights";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Working while you study",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * WORK RIGHTS
 * ----------------------------------------------------------------------------
 * The shortest page in the product, and deliberately so.
 *
 * It does not tell a student how many hours they may work. It tells them which
 * authority decides, links to that authority's own page, and says when the
 * link was last confirmed to resolve. Everything else on this subject is
 * somebody guessing on behalf of a person who can lose their permission to
 * stay in the country if the guess is wrong.
 *
 * If this page ever grows an hours figure, it needs a name and a date beside
 * it. See the header of `src/data/work-rights.ts`.
 * ============================================================================
 */
export default async function WorkRightsPage() {
  const viewer = await requireViewer();
  const source = workRightsFor(viewer.profile.countryCode);

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/work"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Work
      </Link>

      <h1 className="text-display-xs text-ink-950 sm:text-display-sm">
        Working while you study in {viewer.city.country}
      </h1>

      <p className="mt-4 rounded-2xl bg-amber-soft px-4 py-3 text-[0.9375rem] leading-relaxed text-ink-800">
        {workRightsDisclaimer}
      </p>

      {source ? (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
          <p className="text-[0.8125rem] font-medium tracking-wide text-ink-400 uppercase">
            The authority that decides
          </p>
          <p className="mt-1 text-[1.0625rem] font-semibold text-ink-950">{source.authority}</p>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-flow hover:underline"
          >
            <ExternalLink className="size-4" />
            Open their page
          </a>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
            Link last confirmed to resolve on {source.checkedOn}. That date says the page was there
            and belongs to {source.authority} — not that anybody here read it or checked what it
            says about you.
          </p>

          {source.summary ? (
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-700">{source.summary}</p>
          ) : (
            <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-500">
              StudentOS has not written a summary of these rules, on purpose. The limits depend on
              your nationality, your permit, your course and the time of year, and a summary short
              enough to fit here would be wrong for somebody reading it.
            </p>
          )}
        </section>
      ) : (
        <p className="mt-6 rounded-2xl bg-white p-5 text-[0.9375rem] leading-relaxed text-ink-600 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
          {noWorkRightsSource}
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-[0.9375rem] font-semibold text-ink-950">What your university can do</h2>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
          Your international office has seen your exact situation before and answers in writing,
          which is worth more than any of this. Ask them before you sign a contract, not after.
        </p>
      </section>
    </div>
  );
}
