import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";

import { EphemeralDataNotice } from "@/components/app/ephemeral-notice";
import { ToastProvider } from "@/components/ui/toast";
import { brand } from "@/brand/brand.config";
import { env, isEphemeralStore } from "@/services/env";

import "./globals.css";

/**
 * ============================================================================
 * ROOT LAYOUT
 * ----------------------------------------------------------------------------
 * Deliberately minimal: fonts, tokens, toasts and the skip link. Nothing else.
 *
 * Chrome belongs to the route groups, because the three halves of this product
 * are genuinely different applications wearing one brand:
 *
 *   (marketing)  public pages, site nav, footer, indexed
 *   (auth)       sign-up and sign-in, no nav at all, noindex
 *   (app)        the product, its own shell and bottom navigation, noindex
 *
 * Putting the marketing nav here — as it was before the product existed —
 * would put "Pricing" and a footer sitemap on top of a student's budget.
 * ============================================================================
 */

/**
 * Type system
 * - Bricolage Grotesque carries the headlines. It has enough character to feel
 *   like a consumer product rather than a dashboard, and its tight tracking
 *   holds up at display sizes.
 * - Inter runs the interface.
 * - JetBrains Mono is reserved for money, times and counts. Treating numbers
 *   as a separate voice is what makes the product feel trustworthy with a
 *   budget attached.
 */
const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl ?? brand.url),
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  keywords: [
    "international students",
    "student life abroad",
    "student budget",
    "student events",
    "student community",
    "erasmus",
  ],
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
    url: brand.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
  },
  robots: { index: true, follow: true },
  /* The product is installable. Students open it every day on a phone, and a
     home-screen icon is the difference between that and a bookmark. */
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf7",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  /* The product has a fixed bottom bar; on iOS it must sit above the home
     indicator rather than under it. */
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper">
        <ToastProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-full focus:bg-ink-950 focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
          >
            Skip to content
          </a>
          {isEphemeralStore ? <EphemeralDataNotice /> : null}
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
