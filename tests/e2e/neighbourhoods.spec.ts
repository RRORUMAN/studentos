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
  await page.goto("/discover");

  /* Addressed by href rather than by copy: a selector that matches on the
     card's text goes stale the first time someone rewords a price label, and
     the failure mode is a test that skips itself and reports green. */
  const first = page.locator('a[href^="/discover/"]').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/discover\/.+/);

  const section = page.getByRole("heading", { name: "How this sits in your city" });
  if (!(await section.isVisible().catch(() => false))) {
    /* A place with no area row and no saves has nothing honest to say, and
       showing an empty section would be worse than showing none. */
    test.skip(true, "the city graph has no edges for this place yet");
  }

  await expect(page.getByText(/In your area|In [A-Z]|min from |Saved by/).first()).toBeVisible();
});
