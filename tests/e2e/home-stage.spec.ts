import { expect, test } from "@playwright/test";

import { completeOnboarding, signUp } from "./helpers";

/**
 * ============================================================================
 * HOME IS ORDERED FOR THIS STUDENT, NOT FOR EVERY STUDENT
 * ----------------------------------------------------------------------------
 * `stageMeta[stage].blocks` has declared a different Home for each of the six
 * lifecycle stages since it was written, with unit tests over it. Home never
 * read it: it was a fixed stack of sections with three `stage ===` conditionals
 * in it, so a student sixty days from arriving and a student eight months in
 * were served the same page in the same order.
 *
 * The unit tests can only check the lists differ. Whether the page obeys them
 * is a question about the rendered document, which is this file.
 *
 * The assertion is about ORDER, not presence, because presence was never the
 * bug. Money appeared for a pre-arrival student before this change too — it
 * appeared FIRST, above a countdown to a city they had not reached.
 * ============================================================================
 */

/** Where a heading or landmark sits in the document, top to bottom. */
async function positionOf(page: import("@playwright/test").Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox();
  return box?.y ?? Number.POSITIVE_INFINITY;
}

test("a student who has not arrived leads with the countdown, not with money", async ({ page }) => {
  await signUp(page);
  await completeOnboarding(page, { arrivingInDays: 60 });

  await expect(page).toHaveURL(/\/home/);

  /* The countdown is the hero for this stage. */
  const countdown = page.getByText(/arriving in/i).first();
  await expect(countdown).toBeVisible();

  /* And it is ABOVE the money block, which is the part that was wrong.

     Scoped to `main`: the site nav also links to /lifeops and /budget, and
     unscoped both selectors resolved to the header, where they sit at the same
     y and the comparison was meaningless. */
  const countdownY = await positionOf(page, "main a[href='/lifeops']");
  const moneyY = await positionOf(page, "main a[href='/budget']");
  expect(countdownY).toBeLessThan(moneyY);
});

test("a student who has not arrived is not shown what is on tonight", async ({ page }) => {
  await signUp(page);
  await completeOnboarding(page, { arrivingInDays: 60 });

  await expect(page).toHaveURL(/\/home/);

  /* "Today for you" and "Right now" are both `what is on near you`, and the
     answer for this student is a city they are not in yet. Leading a page
     with an event starting in two hours is the clearest possible way to tell
     somebody the product has not noticed where they are. */
  await expect(page.getByRole("heading", { name: /^right now$/i })).toHaveCount(0);
});

test("a student who is already there still leads with money", async ({ page }) => {
  await signUp(page);
  await completeOnboarding(page);

  await expect(page).toHaveURL(/\/home/);

  /* The other half of the claim: reordering for one stage must not reorder
     every stage. A settled student's Home is unchanged. */
  await expect(page.getByText(/safe to spend/i).first()).toBeVisible();
  await expect(page.getByText(/arriving in/i)).toHaveCount(0);
});
