import type { MetadataRoute } from "next";

import { brand } from "@/brand/brand.config";

/**
 * PWA manifest.
 *
 * The product is opened every morning on a phone, so a home-screen icon is the
 * difference between a habit and a bookmark. `start_url` is `/home` rather than
 * `/` — someone installing the app has an account, and landing them on the
 * marketing page is a small insult.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name} — ${brand.tagline}`,
    short_name: brand.name,
    description: brand.description,
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfaf7",
    theme_color: "#fbfaf7",
    categories: ["lifestyle", "finance", "social", "travel"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
