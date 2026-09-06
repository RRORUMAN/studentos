import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Empty } from "@/components/app/cards";
import { factFreshness, guideCategoryMeta, type GuideCategory } from "@/domain/knowledge";
import { findMany } from "@/server/db";
import { requireViewer } from "@/server/viewer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Survival guides",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * SURVIVAL HUB
 * ----------------------------------------------------------------------------
 * Short, actionable answers to the things nobody tells you.
 *
 * Every guide carries its source and the date it was checked, and the three
 * source kinds are visibly different: `official` links to a government or
 * transport authority page, `students` means people reported it, `editorial`
 * means we wrote it and it is general rather than local.
 *
 * That distinction is not decoration. "Students say the €6.50 place is good" and
 * "the government requires you to register within 30 days" are different kinds
 * of claim, and a product that renders them identically is training people to
 * trust the wrong one.
 * ============================================================================
 */
export default async function GuidesPage(props: PageProps<"/guides">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const raw = Array.isArray(params.category) ? params.category[0] : params.category;

  const [guides, facts] = await Promise.all([
    findMany(
      "guides",
      (row) =>
        (row.citySlug === null || row.citySlug === viewer.profile.citySlug) &&
        (row.countryCode === null || row.countryCode === viewer.city.countryCode),
    ),
    findMany(
      "officialFacts",
      (row) =>
        row.countryCode === viewer.city.countryCode &&
        (row.citySlug === null || row.citySlug === viewer.profile.citySlug),
    ),
  ]);

  const categories = [...new Set(guides.map((guide) => guide.category))] as GuideCategory[];
  const category = raw && categories.includes(raw as GuideCategory) ? (raw as GuideCategory) : null;
  const visible = category ? guides.filter((guide) => guide.category === category) : guides;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Survival guides</h1>
        <p className="mt-1.5 text-[0.9375rem] text-ink-500">
          The things nobody tells you, kept short.
        </p>
      </header>

      <nav
        aria-label="Guide categories"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]"
      >
        <Link
          href="/guides"
          className={cn(
            "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[0.875rem] font-medium transition-colors",
            !category
              ? "border-ink-950 bg-ink-950 text-paper"
              : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
          )}
        >
          All
        </Link>
        {categories.map((entry) => (
          <Link
            key={entry}
            href={`/guides?category=${entry}`}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.875rem] font-medium transition-colors",
              category === entry
                ? "border-ink-950 bg-ink-950 text-paper"
                : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
            )}
          >
            <span aria-hidden>{guideCategoryMeta[entry].emoji}</span>
            {guideCategoryMeta[entry].label}
          </Link>
        ))}
      </nav>

      {/* ---- official first ----------------------------------------------- */}
      {!category && facts.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">
            Official information
          </h2>
          <ul className="space-y-2.5">
            {facts.map((fact) => (
              <li key={fact.id} className="rounded-lg border border-mint-deep/20 bg-mint-soft/40 p-4">
                <p className="text-[0.9375rem] font-semibold text-ink-950">{fact.title}</p>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">{fact.summary}</p>

                {fact.variesByNationality ? (
                  <p className="mt-2 rounded-md bg-white/70 px-2.5 py-1.5 text-[0.8125rem] text-ink-700">
                    This depends on your nationality. We will not guess — check the source for your
                    own case.
                  </p>
                ) : null}

                <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[0.75rem]">
                  <a
                    href={fact.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-mint-deep underline underline-offset-4"
                  >
                    {fact.sourceName}
                    <ExternalLink className="size-3" />
                  </a>
                  <span className="text-ink-400">{factFreshness(fact).label}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- guides -------------------------------------------------------- */}
      <section className="mt-7">
        {visible.length === 0 ? (
          <Empty line="No guides for that category in your city yet." />
        ) : (
          <ul className="space-y-3">
            {visible.map((guide) => (
              <li key={guide.id} className="rounded-lg border border-ink-200 bg-white p-4">
                <p className="text-[1.0625rem] font-semibold text-ink-950">{guide.title}</p>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-700">{guide.answer}</p>

                <ul className="mt-3 space-y-1.5">
                  {guide.points.map((point) => (
                    <li key={point} className="flex gap-2.5 text-[0.875rem] leading-snug text-ink-600">
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal" />
                      {point}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.75rem] text-ink-400">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold",
                      guide.source === "official"
                        ? "bg-mint-soft text-mint-deep"
                        : guide.source === "students"
                          ? "bg-signal-soft text-signal-deep"
                          : "bg-ink-100 text-ink-600",
                    )}
                  >
                    {guide.source === "official"
                      ? "Official"
                      : guide.source === "students"
                        ? `Students · ${guide.confirmations} confirmed`
                        : "Written by us"}
                  </span>
                  <span>{factFreshness(guide).label}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
