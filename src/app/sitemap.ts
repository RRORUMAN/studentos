import type { MetadataRoute } from "next";

import { brand } from "@/brand/brand.config";
import { campuses, cities } from "@/data/cities";
import { env } from "@/services/env";

const CITY_SECTIONS = ["pulse", "things-to-do", "free-events", "cheap-food", "student-deals", "starter-pack"];

/**
 * Only pages with genuinely distinct content are listed. Empty permutations —
 * a campus with no feed, a city section with no rows — are deliberately not
 * generated, which is the difference between a useful sitemap and SEO spam.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl ?? brand.url;
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/students`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  const cityRoutes: MetadataRoute.Sitemap = cities.flatMap((city) => [
    {
      url: `${base}/city/${city.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    ...CITY_SECTIONS.map((section) => ({
      url: `${base}/city/${city.slug}/${section}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ]);

  const campusRoutes: MetadataRoute.Sitemap = campuses.map((campus) => ({
    url: `${base}/campus/${campus.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...cityRoutes, ...campusRoutes];
}
