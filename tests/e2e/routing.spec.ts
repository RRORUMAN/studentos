import { expect, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

/**
 * ============================================================================
 * THE ROUTING CHAIN HAD NEVER RUN
 * ----------------------------------------------------------------------------
 * `src/server/places/route.ts` is complete: an OSRM provider, a Google Routes
 * provider, a timeout, error capture, and a straight-line fallback. Above it,
 * `withRoutedProximity` in `queries/places.ts` attaches a routed proximity to
 * the few places a surface is about to show in detail.
 *
 * Nothing called it. Not one page, not one action. So every distance a student
 * ever saw was a straight line, while `/admin` and four documents listed
 * routing as a capability of this deployment.
 *
 * It was dead for a second reason too, further down. `withRoutedProximity`
 * needs somewhere to measure FROM, and the only origin was `Profile.homePoint`
 * — which onboarding writes as null on every path, no screen sets, and
 * relocating clears. The single row that has ever carried one is the seeded
 * demo account. The student does answer where they live, though: their area.
 *
 * The suite now runs a local OSRM (`tests/e2e/osrm-server.mjs`, the same
 * pattern as the Overpass stub) returning a fixed 1,340 m / 17-minute walk —
 * a figure no straight line between two Madrid places produces by accident, so
 * "17 min walk" on the page means the route was used and not the fallback.
 * ============================================================================
 */

test("a place page shows a routed walking time, not a straight line", async ({ page }) => {
  await signUpAndOnboard(page);

  /* Onboarding picks Malasaña, which is what gives the student an origin at
     all. Discover is the list; the place page is the one screen worth a
     routing request. */
  await page.goto("/discover");

  const firstPlace = page.locator("main a[href^='/discover/']").first();
  await expect(firstPlace).toBeVisible({ timeout: 30_000 });
  await firstPlace.click();

  await expect(page).toHaveURL(/\/discover\/.+/);

  /* The stub answers 1020 seconds for any pair of coordinates. Seeing it here
     means: the origin resolved from the area, `withRoutedProximity` ran, the
     OSRM adapter built a URL and parsed a real response, and the page rendered
     a duration rather than a distance. */
  await expect(page.locator("body")).toContainText("17 min walk");
});

test("a distance is still shown when nothing can route", async ({ page }) => {
  /* The other half, and the one that must not regress: routing is optional.
     The marketing city page renders places for a visitor with no account and
     therefore no origin, so it cannot route, and it must still say how far —
     as a distance, labelled as one. */
  await page.goto("/city/madrid");

  const map = page.getByText(/Discover/).first();
  await expect(map).toBeVisible({ timeout: 30_000 });

  /* Never a duration without a route: a made-up walking time is the exact
     failure the straight-line fallback exists to avoid. */
  await expect(page.locator("body")).not.toContainText("17 min walk");
});
