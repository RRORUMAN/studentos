import { defineConfig, devices } from "@playwright/test";

/**
 * ============================================================================
 * SMOKE — the public site, against a DEPLOYED url
 * ----------------------------------------------------------------------------
 * `playwright.config.ts` only ever tests a local production build. That proves
 * the code is right; it cannot prove that what Vercel is serving is that code,
 * or that it works behind the real CDN with the real environment.
 *
 * This runs the public-site spec against a live URL instead:
 *
 *   pnpm test:smoke                                  # production
 *   SMOKE_URL=https://<preview>.vercel.app pnpm test:smoke
 *
 * Only `marketing.spec.ts`, and deliberately: every test in it is read-only —
 * it loads pages, measures boxes, clicks in-page controls and follows links.
 * Nothing signs up, posts or writes, so pointing it at production creates no
 * rows. The rest of the suite creates accounts and must never be run from here
 * (see the note in `playwright.config.ts` about 110 test accounts once landing
 * in the live database).
 *
 * No web server, no global setup: the thing under test is already running.
 * ============================================================================
 */

const SMOKE_URL = process.env.SMOKE_URL ?? "https://studentos-sooty.vercel.app";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["marketing.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: SMOKE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
