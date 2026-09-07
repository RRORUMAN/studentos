import type { MetadataRoute } from "next";

import { brand } from "@/brand/brand.config";
import { env } from "@/services/env";

export default function robots(): MetadataRoute.Robots {
  const base = env.siteUrl ?? brand.url;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        /* The authenticated product and every personal flow. These are all
           noindex at the page level too; this is the belt to that's braces. */
        disallow: [
          "/api/",
          "/get-started",
          "/signin",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/onboarding",
          "/home",
          "/ask",
          "/budget",
          "/discover",
          "/events",
          "/pulse",
          "/saved",
          "/you",
          "/arrival",
          "/leaving",
          "/anyone-down",
          "/exchange",
          "/guides",
          "/starter-pack",
          "/notifications",
          "/upgrade",
          "/admin",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
