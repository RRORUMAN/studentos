import { expect, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

/**
 * ============================================================================
 * WORK
 * ----------------------------------------------------------------------------
 * The scoring is pinned in `tests/unit/work.test.ts`. What this file proves is
 * the part a unit test cannot: that the honesty survives the trip to a screen,
 * and that the things which cost a student real money behave in a browser.
 *
 * Each test is one claim the product makes about itself:
 *
 *   a posting with no stated wage says so, in the same place as the ones that
 *   do state it;
 *   a job the student cannot afford to take is labelled rather than removed;
 *   the tracker never marks anything applied on its own;
 *   a gig posting form has nowhere to type an address;
 *   and the paid income planner is gated on the server, not by hiding markup.
 * ============================================================================
 */

test("a posting with no stated pay says so rather than leaving the space blank", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/work");

  const cards = page.getByRole("listitem").filter({ hasText: "% fit" });
  await expect(cards.first()).toBeVisible();

  /* The seeded board deliberately contains one posting that states no pay,
     because "the source did not say" is a real and common answer that this
     product must be able to render without inventing a figure. */
  await expect(page.getByText("Pay not stated").first()).toBeVisible();

  /* And nothing anywhere is priced at nothing. A €0 would be a claim about
     the job; "not stated" is a claim about the posting, and only the second
     one is true. */
  await expect(page.getByText(/€0(\.00)? (per|for) /)).toHaveCount(0);
});

test("every fit score arrives with a reason attached to it", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/work");

  const cards = page.getByRole("listitem").filter({ hasText: "% fit" });
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  /* A bare percentage is a claim with no evidence. Every card carries at least
     one line explaining where the number came from — including the fallback
     for a posting too terse to match anything. */
  for (let i = 0; i < Math.min(count, 6); i += 1) {
    const card = cards.nth(i);
    await expect(card).toContainText(/·|Nothing stated that we could match/);
  }
});

test("a sample posting says there is nobody to apply to instead of offering a dead button", async ({
  page,
}) => {
  await signUpAndOnboard(page);
  await page.goto("/work");

  /* Addressed by href rather than by copy: a text selector goes stale the
     first time somebody rewords a label, and the failure mode is a test that
     skips itself and reports green. */
  const sampleCard = page
    .getByRole("listitem")
    .filter({ hasText: "Sample posting" })
    .first();
  await expect(sampleCard).toBeVisible();
  await sampleCard.locator('a[href^="/work/"]').first().click();
  await expect(page).toHaveURL(/\/work\/.+/);

  await expect(page.getByText("This is a sample posting")).toBeVisible();
  await expect(page.getByRole("link", { name: "Apply at the source" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "I can do this" })).toHaveCount(0);
});

test("the tracker moves only when the student moves it", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/work");

  /* Scoped to a card, not to the page: the header's own links (/work/post,
     /work/applications, /work/profile) also match `a[href^="/work/"]`, and a
     selector that catches those is testing the wrong screen. */
  const first = page
    .getByRole("listitem")
    .filter({ hasText: "% fit" })
    .first()
    .locator('a[href^="/work/"]')
    .first();
  await first.click();
  await expect(page).toHaveURL(/\/work\/.+/);
  const url = page.url();

  /* Opening a posting is not applying for it, and the tracker must be empty
     after doing exactly that. A tracker that guesses will tell a student they
     have applied for a job they closed after four seconds. */
  await page.goto("/work/applications");
  await expect(page.getByText("Nothing tracked yet")).toBeVisible();

  await page.goto(url);
  await page.getByRole("button", { name: "Applied", exact: true }).first().click();

  await page.goto("/work/applications");
  await expect(page.getByText("Nothing tracked yet")).toHaveCount(0);
  await expect(page.getByText("Applied").first()).toBeVisible();
});

test("there is nowhere on the gig form to publish where you live", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/work/post");

  await expect(page.getByLabel(/Where do you meet/)).toBeVisible();
  await expect(page.getByText(/There is no address field on this form/)).toBeVisible();

  /* The rule is structural, not a placeholder: no field on this form invites
     a street address, and the server schema has nowhere to put one. */
  const labels = await page.locator("form label, form p").allInnerTexts();
  const invites = labels.filter((text) => /\baddress\b/i.test(text) && !/no address field/i.test(text));
  expect(invites).toEqual([]);
});

test("posting a gig puts it on the board and lets another student answer it", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/work/post");

  const title = `Help me carry boxes on Saturday ${Date.now()}`;
  await page.getByLabel(/What do you need doing/).fill(title);
  await page
    .getByLabel(/The detail/)
    .fill("Two flights of stairs, about eight boxes. Half an hour with two people, cash on the day.");
  await page.getByLabel(/Where do you meet/).fill("Moncloa metro, main exit");
  await page.locator('input[name="pay"]').fill("40");
  await page.getByRole("button", { name: "Weekends" }).click();
  await page.getByRole("button", { name: "Post it" }).click();

  await expect(page).toHaveURL(/\/work\/.+/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  /* Your own posting cannot be applied for, and it says why rather than
     rendering a button that would message yourself. */
  await expect(page.getByText("This is your posting")).toBeVisible();

  await page.goto("/work");
  await expect(page.getByText(title)).toBeVisible();
});

test("the income planner is gated on the server, not by hiding the markup", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/work/profile");
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.locator('input[name="monthlyTarget"]').fill("500");
  await page.locator('input[name="currentIncome"]').fill("200");
  await page.getByRole("button", { name: "Save" }).click();

  await page.goto("/work");

  /* A free account sees the shape of the answer and its own target — and not
     one figure that was computed for it. The gap, the picks and the total are
     never rendered, so they were never sent. */
  await expect(page.getByText("You have set a target of")).toBeVisible();
  await expect(page.getByText(/You are €\d+ a month short/)).toHaveCount(0);
  await expect(page.getByText(/An estimate, not an offer/)).toHaveCount(0);
});

test("the budget screen offers a way to earn rather than only a way to cut", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/work/profile");
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.locator('input[name="currentIncome"]').fill("200");
  await page.getByRole("button", { name: "Save" }).click();

  await page.goto("/budget");
  await expect(page.getByRole("heading", { name: "Coming in" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Find ways to earn/ })).toBeVisible();
  /* The arithmetic is on numbers the student typed, and the screen says so
     rather than implying a forecast. */
  await expect(page.getByText(/nothing is being predicted here/)).toBeVisible();
});

test("work rights link to the authority and never state the rule", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/work/rights");

  await expect(page.getByText(/StudentOS does not calculate that/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Ministerio de Inclusión|Open their page/ }).first(),
  ).toBeVisible();

  /* No hour limit appears anywhere on this page. If one is ever added it must
     arrive with a name and a check date beside it — see the header of
     `src/data/work-rights.ts` — and this assertion should be the thing that
     forces that conversation. */
  const body = (await page.locator("main").innerText()).toLowerCase();
  expect(body).not.toMatch(/\b\d+\s*(hours?|hrs?)\s*(a|per)\s*week\b/);
});
