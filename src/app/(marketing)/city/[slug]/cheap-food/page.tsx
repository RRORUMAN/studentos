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
  props: PageProps<"/city/[slug]/cheap-food">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) return { title: "City not found" };

  return {
    title: `Cheap student food in ${city.name}`,
    description: `Where students in ${city.name} actually eat for ${city.currency.symbol}${city.anchors.lunch[0]}–${city.currency.symbol}${city.anchors.lunch[1]}, with walking times and how many students confirmed each one.`,
    alternates: { canonical: `/city/${city.slug}/cheap-food` },
  };
}

export default async function CheapFoodPage(props: PageProps<"/city/[slug]/cheap-food">) {
  const { slug } = await props.params;
  const city = getCity(slug);
  if (!city) notFound();

  const places = placesForCity(city.slug)
    .filter((place) => place.layers.includes("cheap-food") || place.layers.includes("groceries"))
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  const posts = loopForCity(city.slug).filter((post) =>
    post.tags.some((tag) => ["Lunch", "Groceries", "Budget"].includes(tag)),
  );

  return (
    <CityCollection
      city={city}
      active="cheap-food"
      eyebrow="Cheap food"
      title={`Eating in ${city.name} without thinking about it`}
      lead={`Most students overspend on food for a month before someone tells them the two or three rules that matter here. This is that conversation, with prices.`}
      places={places}
      posts={posts}
      emptyTitle={`No food listings for ${city.name} yet`}
      emptyBody="Food is the first thing a new community fills in, because everyone has an opinion and everyone eats every day."
      method={`Prices are what students reported paying this term, not menu prices. The confirmation count on each card is how many people independently reported the same thing.`}
      aside={
        <div className="rounded-xl border border-ink-200 bg-paper-2 p-5 lg:max-w-xs">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            Student lunch in {city.name}
          </p>
          <p className="tnum mt-2 font-mono text-3xl font-semibold text-ink-950">
            {city.currency.symbol}
            {city.anchors.lunch[0]}–{city.currency.symbol}
            {city.anchors.lunch[1]}
          </p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-600">
            Weekly groceries run {city.currency.symbol}
            {city.anchors.weeklyGroceries[0]}–{city.currency.symbol}
            {city.anchors.weeklyGroceries[1]}. Splitting market and supermarket is most of that
            gap.
          </p>
        </div>
      }
    />
  );
}
