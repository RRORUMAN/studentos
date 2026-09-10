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

  /**
   * THREE STATES, NOT TWO, and the middle one is new.
   *
   * This page used to ask only whether the city had areas at all, because
   * either it was one of the five written-up cities or it was empty. Now every
   * city has areas, and most of them have areas that carry a name and
   * a point and nothing else — so promising a list "ranked against what you
   * can pay" to a student in Vienna would be describing a ranking the page
   * cannot perform.
   */
  const rankable = areas.some((area) => area.rent !== null || area.traits !== null);

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
            {areas.length === 0
              ? `We do not have the neighbourhoods of ${city?.name ?? "your city"} yet, so there is nothing here to show.`
              : rankable
                ? `Every neighbourhood in ${city?.name ?? "your city"}, ranked against what you can pay, how far you will travel and what you actually want nearby.`
                : `The ${areas.length} districts of ${city?.name ?? "your city"}, by name and position. What a room costs and what each one is like is not written up yet, and we would rather list them than invent it.`}
          </p>
        </div>
      </header>

      <div className="mt-6">
        {areas.length > 0 ? (
          <Matcher citySlug={citySlug} viewer={viewer} />
        ) : (
          <div className="rounded-2xl bg-white p-5 text-[0.9375rem] leading-relaxed text-ink-600 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            {/* IT SAYS WHAT IS TRUE, NOT WHY.
                This said "we import every city's districts from Wikidata, and
                for X it has none we could stand behind" — a specific claim
                about a specific source, and wrong in two directions. It was
                wrong for the 181 cities added with the European expansion,
                where the import had simply never been run and Wikidata had
                never been asked. It is still wrong for Paris, where the query
                times out because the city has too many candidates within ten
                kilometres: the districts exist and we could not fetch them.

                Nine cities land here now, and the four that are not editorial
                get here for three different reasons. A sentence naming one of
                them would be false for the others, and the student cannot act
                on any of it — so it states the fact, which is that there is
                nothing here yet. */}
            <p>
              We do not have the districts of {city?.name ?? "your city"} yet. Rather than list
              something approximate, there is nothing here. Everything else in the product works
              normally.
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
