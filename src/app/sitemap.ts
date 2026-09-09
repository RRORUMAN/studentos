import type { MetadataRoute } from "next";

import { brand } from "@/brand/brand.config";
import { campuses, cities } from "@/data/cities";
import { env } from "@/services/env";

/**
 * The section routes under `city/[slug]/`, and they must match the directories
 * on disk exactly.
 *
 * `"pulse"` was listed here and there is no `pulse` route: the authenticated
 * app was renamed Loop to Pulse and this list followed it, while the marketing
 * route stayed `loop`. So the sitemap submitted five URLs that 404 and omitted
 * the five real community pages entirely — the ones `city/[slug]/page.tsx`
 * links to and that have their own `generateStaticParams`. A sixth of the
 * sitemap was dead and the pages it should have been advertising were
 * invisible to search.
 *
 * `tests/unit/sitemap.test.ts` asserts every entry resolves to a route file,
 * so the next rename fails a test instead of quietly costing five pages.
 */
export const CITY_SECTIONS = [
  "loop",
  "things-to-do",
  "free-events",
  "cheap-food",
  "student-deals",
  "starter-pack",
] as const;

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
