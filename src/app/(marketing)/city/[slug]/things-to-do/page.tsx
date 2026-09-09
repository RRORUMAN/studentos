import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CityCollection } from "@/components/marketing/city-collection";
import { cities, getCity } from "@/data/cities";
import { requestDate } from "@/server/now";
import { loadCityPlaces } from "@/server/queries/places";
import { loopForCity } from "@/data/loop";

export function generateStaticParams() {
  return cities.map((city) => ({ slug: city.slug }));
}

export async function generateMetadata(
  props: PageProps<"/city/[slug]/things-to-do">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) return { title: "City not found" };

  return {
    title: `Things to do in ${city.name} as a student`,
    description: `What students in ${city.name} actually do with an evening — with the price, the walk from campus and where each claim came from.`,
    alternates: { canonical: `/city/${city.slug}/things-to-do` },
  };
}

/**
 * The broadest of the city collections, and the one most likely to be someone's
 * first page on the site.
 *
 * It deliberately spans events, nightlife, free and study rather than being a
 * fourth food page: a student searching "things to do in Berlin" is asking
 * about an evening, not a meal. Ordering is by student value rather than by
 * price, because the cheapest thing in a city is rarely the answer to that
 * question — the best thing you can afford is.
 */
export default async function ThingsToDoPage(props: PageProps<"/city/[slug]/things-to-do">) {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) notFound();

  const now = requestDate();

  const found = await loadCityPlaces({
    citySlug: city.slug,
    layers: ["culture", "nightlife", "free", "study"],
    radiusMetres: 3_000,
    limit: 24,
  });
  const bandOrder = { strong: 0, good: 1, mixed: 2, insufficient: 3 } as const;
  const places = found.ok
    ? [...found.places].sort(
        (a, b) =>
          bandOrder[a.value.band] - bandOrder[b.value.band] ||
          a.proximity.metres - b.proximity.metres,
      )
    : [];

  const posts = loopForCity(city.slug).filter(
    (post) => post.kind === "event" || post.kind === "looking-for" || post.kind === "tip",
  );

  return (
    <CityCollection
      city={city}
      active="things-to-do"
      eyebrow="Things to do"
      title={`Things to do in ${city.name}`}
      lead={`Not a list of landmarks. This is what students here actually do with a Tuesday and with a Saturday, ordered by what is worth the money rather than by what is nearest.`}
      places={places}
      placesUnavailable={found.ok ? null : { message: found.message }}
      attribution={found.ok ? found.attribution : null}
      now={now}
      posts={posts}
      emptyTitle={`No listings for ${city.name} yet`}
      emptyBody="This page fills up from what students report, so it stays empty rather than being padded with the same attractions every guide already lists."
      method="Opening hours and prices come from official or venue listings. Whether something is worth an evening comes from students, and the number behind that judgement is printed on every card."
      aside={
        <div className="rounded-xl border border-ink-200 bg-paper-2 p-5 lg:max-w-xs">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            Where students actually go
          </p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-800">
            {city.hook}
          </p>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
            Most of {city.name}&rsquo;s good evenings happen in{" "}
            {city.neighbourhoods.slice(0, 3).join(", ")} — and almost none of them on the street the
            guidebook names.
          </p>
        </div>
      }
    />
  );
}
