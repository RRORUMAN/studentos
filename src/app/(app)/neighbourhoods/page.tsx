import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NeighbourhoodMatcher } from "@/components/app/neighbourhood-match";
import { MascotArt } from "@/components/mascot/mascot-art";
import { campusesForCity, resolveCity } from "@/data/cities";
import { findNeighbourhood, neighbourhoodsForCity } from "@/data/neighbourhoods";
import { areaDensity } from "@/domain/graph";
import { loadCityGraph } from "@/server/queries/graph";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Where should I live?",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * NEIGHBOURHOOD MATCH
 * ----------------------------------------------------------------------------
 * The first high-stakes question a student asks, and until now the one the
 * product could not answer: `City.neighbourhoods` was a list of names, so
 * "where should I live" could be shown but not reasoned about.
 *
 * The page is a shell. It loads the city's areas, the campuses, and the one
 * genuinely dynamic input — how many students live in each area, floored by
 * the graph so a count never describes a person — and hands them to a client
 * component that re-ranks locally. No model is involved anywhere in this
 * screen.
 *
 * Free at every tier, deliberately. This is the question a student asks before
 * they have any reason to trust the product, and putting it behind a paywall
 * would be charging for the introduction.
 * ============================================================================
 */
export default async function NeighbourhoodsPage() {
  const viewer = await requireViewer();
  const citySlug = viewer.profile.citySlug;
  const city = resolveCity(citySlug);
  const areas = neighbourhoodsForCity(citySlug);

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/you"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        You
      </Link>

      <header className="flex items-start gap-4">
        <MascotArt state="thinking" className="size-14 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Where should I live?</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            {areas.length > 0
              ? `Every neighbourhood in ${city?.name ?? "your city"}, ranked against what you can pay, how far you will travel and what you actually want nearby.`
              : `Nobody has written up the neighbourhoods in ${city?.name ?? "your city"} yet, so there is nothing here to rank.`}
          </p>
        </div>
      </header>

      <div className="mt-6">
        {areas.length > 0 ? (
          <Matcher citySlug={citySlug} viewer={viewer} />
        ) : (
          <div className="rounded-2xl bg-white p-5 text-[0.9375rem] leading-relaxed text-ink-600 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            <p>
              This works in the cities with full local data. Your city has the budget, arrival and
              planning tools, and areas appear here once there are rent bands and commute figures
              worth ranking rather than guesses dressed as a score.
            </p>
            <Link
              href="/ask/questions"
              className="mt-3 inline-block font-medium text-flow hover:underline"
            >
              See what students are asking
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

async function Matcher({
  citySlug,
  viewer,
}: {
  citySlug: string;
  viewer: Awaited<ReturnType<typeof requireViewer>>;
}) {
  const graph = await loadCityGraph(citySlug);

  return (
    <NeighbourhoodMatcher
      areas={neighbourhoodsForCity(citySlug)}
      campuses={campusesForCity(citySlug).map((campus) => ({
        slug: campus.slug,
        shortName: campus.shortName,
      }))}
      defaultCampus={viewer.profile.campusSlug}
      density={Object.fromEntries(areaDensity(graph))}
      where={viewer.currency}
      homeAreaSlug={findNeighbourhood(citySlug, viewer.profile.homeArea)?.slug ?? null}
    />
  );
}
