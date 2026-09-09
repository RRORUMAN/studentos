import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CityCollection } from "@/components/marketing/city-collection";
import { getCity } from "@/data/cities";
import { requestDate } from "@/server/now";
import { loadCityPlaces } from "@/server/queries/places";
import { loopForCity } from "@/data/loop";

/** Rendered on first request, cached six hours. See cheap-food/page.tsx. */
export const revalidate = 21600;

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

  const now = requestDate();

  /* Only places with a VERIFIED deal attached. The layer is set from our own
     deals table, so this page lists nowhere that somebody has not confirmed an
     offer at — which is the whole point of a student-deals page. */
  const found = await loadCityPlaces({
    citySlug: city.slug,
    layers: ["deals"],
    radiusMetres: 3_000,
    limit: 24,
  });
  const places = found.ok
    ? [...found.places].sort((a, b) => b.confirmations - a.confirmations)
    : [];

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
      placesUnavailable={found.ok ? null : { message: found.message }}
      attribution={found.ok ? found.attribution : null}
      now={now}
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
