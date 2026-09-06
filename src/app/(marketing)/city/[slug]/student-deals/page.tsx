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
  props: PageProps<"/city/[slug]/student-deals">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) return { title: "City not found" };

  return {
    title: `Student deals in ${city.name}`,
    description: `Real student discounts in ${city.name} — the ones students use, not the ones a brand paid to list. Each with the price, the walk and how many students confirmed it.`,
    alternates: { canonical: `/city/${city.slug}/student-deals` },
  };
}

export default async function StudentDealsPage(props: PageProps<"/city/[slug]/student-deals">) {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) notFound();

  const places = placesForCity(city.slug)
    .filter((place) => place.layers.includes("deals"))
    .sort((a, b) => b.verifiedBy - a.verifiedBy);

  const posts = loopForCity(city.slug).filter(
    (post) => post.kind === "deal" || post.kind === "warning",
  );

  return (
    <CityCollection
      city={city}
      active="student-deals"
      eyebrow="Student deals"
      title={`Student deals in ${city.name} that people actually use`}
      lead="Most student discount lists are advertising. This one has no paid placements, because nothing on it was sold to us — it is what students reported using and what they told each other to avoid."
      places={places}
      posts={posts}
      emptyTitle={`No deals confirmed in ${city.name} yet`}
      emptyBody="A deal only appears once a student has actually used it and said so. That is slower than scraping a discount site, and considerably more useful."
      method="No listing on this page is paid for and there are no affiliate links. If a partnership ever exists it will be labelled on the card itself."
      aside={
        <div className="rounded-xl border border-ink-200 bg-paper-2 p-5 lg:max-w-xs">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            The unglamorous one
          </p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-800">
            <span className="font-medium">{city.transport.card}</span> — {city.transport.studentNote}{" "}
            It saves more over a term than every other discount on this page combined.
          </p>
        </div>
      }
    />
  );
}
