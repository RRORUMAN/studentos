import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CityCollection } from "@/components/marketing/city-collection";
import { cities, getCity } from "@/data/cities";
import { placesForCity } from "@/data/places";
import { loopForCity } from "@/data/loop";

export function generateStaticParams() {
  return cities.map((city) => ({ slug: city.slug }));
}

export async function generateMetadata(
  props: PageProps<"/city/[slug]/free-events">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) return { title: "City not found" };

  return {
    title: `Free things to do in ${city.name} as a student`,
    description: `Free museum windows, no-cover nights and outdoor events in ${city.name}, with the walking time from campus and where each claim comes from.`,
    alternates: { canonical: `/city/${city.slug}/free-events` },
  };
}

export default async function FreeEventsPage(props: PageProps<"/city/[slug]/free-events">) {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) notFound();

  const places = placesForCity(city.slug)
    .filter((place) => place.layers.includes("free") || place.layers.includes("events"))
    .sort((a, b) => b.studentValue - a.studentValue);

  const posts = loopForCity(city.slug).filter((post) => post.price === 0);

  return (
    <CityCollection
      city={city}
      active="free-events"
      eyebrow="Free events"
      title={`Free things to do in ${city.name}`}
      lead="Free is a schedule, not a category. Museums have free windows, venues have no-cover hours, and most of the good ones end before midnight — so the useful list is the one with times attached."
      places={places}
      posts={posts}
      emptyTitle={`No free listings for ${city.name} yet`}
      emptyBody="Free windows change constantly, which is exactly why students are better at tracking them than a directory is."
      method="Opening hours and free windows come from official listings or the venue. Whether it is worth going comes from students. Both are labelled on every card."
      aside={
        <div className="rounded-xl border border-ink-200 bg-paper-2 p-5 lg:max-w-xs">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            The rule that saves the most
          </p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-800">
            Turn up in the last two hours. Most major museums drop to free, and the queue is
            shorter than the entry fee is worth.
          </p>
        </div>
      }
    />
  );
}
