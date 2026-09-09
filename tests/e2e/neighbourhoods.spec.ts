import { expect, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

/**
 * ============================================================================
 * WHERE SHOULD I LIVE?
 * ----------------------------------------------------------------------------
 * The ranking maths is pinned in `tests/unit/graph.test.ts`. What this file
 * proves is the part a unit test cannot: that the honesty reaches the screen.
 *
 * Three things, each of which would be a real failure if it broke silently —
 * a rent estimate rendered as though it were a market reading, an area
 * disappearing because the student cannot afford it, and a student count
 * printed for a group too small to describe.
 * ============================================================================
 */

test("no rent figure appears without saying it is an estimate", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/neighbourhoods");

  const cards = page.getByRole("listitem").filter({ hasText: "ROOM, MONTHLY" });
  const count = await cards.count();
  test.skip(count === 0, "this city has no neighbourhood rows");

  /* Every card that prints a band prints the basis with it. The standing
     sample-data notice is not enough on its own here: this is the one number
     on which a student signs a year-long contract. */
  for (let i = 0; i < count; i += 1) {
    await expect(cards.nth(i).getByText("Estimate")).toBeVisible();
  }

  await expect(page.getByText(/written estimates to sanity-check listings against/)).toBeVisible();
});

test("an area over budget is labelled, never removed from the list", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/neighbourhoods");

  const cards = page.getByRole("listitem").filter({ hasText: "ROOM, MONTHLY" });
  const before = await cards.count();
  test.skip(before === 0, "this city has no neighbourhood rows");

  /* Drive the ceiling to the bottom of its range: at least one area must now
     be unaffordable, and the count must not move. */
  const slider = page.getByLabel("Most you would pay for a room, per month");
  await slider.focus();
  for (let i = 0; i < 40; i += 1) await page.keyboard.press("ArrowLeft");

  await expect(page.getByText("Above your budget").first()).toBeVisible();
  await expect(cards).toHaveCount(before);
});

test("a student count is withheld rather than shown for too small a group", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/neighbourhoods");

  const cards = page.getByRole("listitem").filter({ hasText: "STUDENTS HERE" });
  test.skip((await cards.count()) === 0, "this city has no neighbourhood rows");

  /* A fresh account is the only discoverable student in most areas, so the
     product must decline to answer. "0 students" would be a claim about the
     city; "too few to say" is a claim about our own threshold, and only the
     second one is true. */
  await expect(page.getByText("Too few to say").first()).toBeVisible();
  await expect(page.getByText(/\b0 students\b/)).toHaveCount(0);
});

test("the place page explains the relationship, not just the score", async ({ page }) => {
  await signUpAndOnboard(page);

  /**
   * THIS TEST USED TO SKIP ITSELF, and it skipped every run for a month.
   *
   * The section it checks only renders when the graph can relate the place to
   * something — most usefully the neighbourhood it is in. That lookup used to
   * read the area off the end of the place's own name ("Ramen counter,
   * Malasaña"), which was true of the twenty-five invented places and of no
   * real one. When the invented places were deleted the lookup started
   * returning null for every place in every city, the section stopped
   * rendering, and this test's `test.skip` swallowed it and reported green.
   * The area is geographic now, so the section is expected rather than hoped
   * for, and a regression fails here instead of disappearing.
   *
   * WHY IT WALKS SEVERAL PLACES. Which place ranks first depends on the
   * student's interests and on what the provider returned, and a place can
   * legitimately sit outside every area the product has a row for — a shop by
   * the airport is in no neighbourhood, and saying so is correct. What must
   * not happen is that NONE of them can be placed, which is exactly the state
   * the bug produced.
   */
  const CANDIDATES = 4;
  let explained = 0;

  for (let index = 0; index < CANDIDATES; index += 1) {
    await page.goto("/discover");

    /* Addressed by href rather than by copy: a selector that matches on the
       card's text goes stale the first time someone rewords a price label. */
    const link = page.locator('a[href^="/discover/"]').nth(index);
    if (!(await link.isVisible().catch(() => false))) break;

    await link.click();
    await expect(page).toHaveURL(/\/discover\/.+/);

    const section = page.getByRole("heading", { name: "How this sits in your city" });
    if (await section.isVisible().catch(() => false)) {
      explained += 1;
      /* The facts themselves, not just the heading: an area, a commute, or a
         save. A section rendered with nothing under it would pass a check on
         the heading alone. */
      await expect(page.getByText(/In your area|In [A-Z]|min from |Saved by/).first()).toBeVisible();
    }
  }

  expect(
    explained,
    "no place among the first few could be related to anything in the city graph",
  ).toBeGreaterThan(0);
});
