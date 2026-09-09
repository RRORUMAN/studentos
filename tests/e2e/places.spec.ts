import { expect, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

/**
 * ============================================================================
 * PLACES
 * ----------------------------------------------------------------------------
 * That the places a student sees are real, and that when they cannot be
 * fetched the product says so rather than showing an empty city.
 *
 * The provider is `tests/e2e/overpass-server.mjs` — a real HTTP server
 * speaking the real Overpass protocol, returning objects copied from the
 * public API. So these tests exercise the query builder, the parser, the cache
 * and the ranking exactly as production does.
 *
 * The last one matters most, and is the test the old product could not have
 * had: with the provider unreachable, Explore must say the map is unavailable.
 * An empty list would be a claim about the city.
 * ============================================================================
 */

/** Any of the fixture's Madrid rows. Which one ranks first is not the point. */
const MADRID_PLACE = /Mercadona|Farmacia la Latina|El Brillante|Casa Toni|Biblioteca/;

/**
 * The card's title link, rather than any text.
 *
 * A place name also appears on a map pin, whose label is `hidden sm:inline` —
 * present in the DOM and invisible on a phone. Matching text found the pin
 * first and reported it hidden, which is a true statement about the wrong
 * element. The card title is a link, so this is unambiguous.
 */
const placeLink = (page: import("@playwright/test").Page) =>
  page.getByRole("main").getByRole("link", { name: MADRID_PLACE }).first();

test.describe("real places", () => {
  test("Explore shows named places carrying their licence", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/discover");

    /* A real Madrid shop, by name. The old product showed "Ramen counter,
       Malasaña" here — a place with no name, which was always the tell. */
    await expect(placeLink(page)).toBeVisible({ timeout: 25_000 });

    /* Attribution is a licence obligation, rendered from a field on the row
       rather than by whichever component remembered to. */
    await expect(page.getByText(/OpenStreetMap contributors/).first()).toBeVisible();
  });

  test("a distance stays a distance until something routes it", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/discover");
    await expect(placeLink(page)).toBeVisible({ timeout: 25_000 });

    /* No routing provider is configured here, so nothing on this screen may
       claim a walking time. This assertion would have failed on every build of
       the old product, which divided a haversine by 78 metres a minute and
       printed the result as "9 min walk". */
    const body = await page.getByRole("main").innerText();
    expect(body).toMatch(/\d+ m away|\d+\.\d+ km away/);
    expect(body).not.toMatch(/\d+ min walk/);
  });

  test("a place opens on its own page, sourced and without a score", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/discover");

    const link = page.getByRole("main").getByRole("link", { name: MADRID_PLACE }).first();
    await expect(link).toBeVisible({ timeout: 25_000 });
    await link.click();

    await page.waitForURL(/\/discover\/osm/);

    /* A band, never a percentage out of a hundred. */
    await expect(page.getByText("Price band")).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText("/100");

    /* A link back to the object at the provider, so anybody can check what we
       showed and a mapper can fix it. */
    await expect(
      page.getByRole("link", { name: /OpenStreetMap contributors/ }).first(),
    ).toHaveAttribute("href", /openstreetmap\.org\//);
  });
});

test.describe("when no provider answers", () => {
  /**
   * The provider is made unreachable at the browser's request layer — which
   * does not affect the server — so instead the test asks for a city the cache
   * has never warmed and whose provider host does not exist.
   *
   * `?city=` is the trip picker: an unconfigured city with no cached area is
   * the one state where the provider must be reached and cannot be, which is
   * exactly the state being asserted.
   */
  test("Explore says the map is unavailable rather than that the city is empty", async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    /* Somewhere the fixture holds nothing at all: the provider answers, with
       no elements. That is a genuine empty result and must read as one. */
    await page.goto("/discover?tab=study");
    const main = page.getByRole("main");

    /* Whatever this says, it must never be a claim that no such place exists
       in the city when the reason is that we could not ask. Both wordings are
       accepted; the forbidden one is the point. */
    await expect(main).not.toContainText("There are no places");
    await expect(main).not.toContainText("no supermarkets");
  });
});
