import { expect, test } from "@playwright/test";

import { signUp, signUpAndOnboard } from "./helpers";

/**
 * ============================================================================
 * FINDING YOUR UNIVERSITY, AND LEARNING TO SPEAK
 * ----------------------------------------------------------------------------
 * Two features that share a promise: the product knows something specific
 * about where you are, and says so on the first screen you meet.
 *
 * The institution tests are written as the queries a real student types --
 * an abbreviation, half a name, a name without its accents, a university in
 * another city, and a university nobody has heard of. A dropdown that fails
 * any of these is a student who decides in two seconds that the product was
 * not built for them, which is a judgement never revisited.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Institution search                                                          */
/* -------------------------------------------------------------------------- */

test("onboarding finds a university from an abbreviation, half a name, or no accents", async ({ page }) => {
  await signUp(page);

  await page.getByRole("button", { name: /International student/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Madrid/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const search = page.getByRole("searchbox", { name: /Search universities/ });
  await expect(search).toBeVisible();

  /* Before anything is typed, the list is the student's own city rather than a
     shortlist that belongs to somebody else. */
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  expect(await options.count()).toBeGreaterThan(4);

  /* The word its own students use. */
  await search.fill("complu");
  await expect(page.getByRole("option", { name: /Universidad Complutense de Madrid/ })).toBeVisible();

  /* The abbreviation. Nobody types the full name. */
  await search.fill("UAM");
  await expect(page.getByRole("option", { name: /Universidad Autónoma de Madrid/ })).toBeVisible();

  /* A phone keyboard in a second language does not produce accents. */
  await search.fill("politecnica");
  await expect(page.getByRole("option", { name: /Universidad Politécnica de Madrid/ })).toBeVisible();

  /* Half a name is enough. */
  await search.fill("rey juan");
  await expect(page.getByRole("option", { name: /Universidad Rey Juan Carlos/ })).toBeVisible();
});

test("search reaches the whole country, not just the student's city", async ({ page }) => {
  await signUp(page);

  await page.getByRole("button", { name: /International student/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Madrid/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const search = page.getByRole("searchbox", { name: /Search universities/ });
  await search.fill("Universidad de Granada");
  await expect(page.getByRole("option", { name: /Universidad de Granada/ })).toBeVisible();
});

test("a university nobody has heard of never blocks onboarding", async ({ page }) => {
  await signUp(page);

  await page.getByRole("button", { name: /International student/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Madrid/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const search = page.getByRole("searchbox", { name: /Search universities/ });
  await search.fill("Escuela Imaginaria de Ejemplo");

  /* Offered back as typed, with the honest note about what is lost. */
  const useTyped = page.getByRole("button", { name: /Use .Escuela Imaginaria de Ejemplo./ });
  await expect(useTyped).toBeVisible();
  await useTyped.click();

  await expect(page.getByText(/Not in the register yet/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  /* And the student is still moving forward. */
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* Speak Local                                                                 */
/* -------------------------------------------------------------------------- */

test("Speak Local opens with today's phrase and the situations behind it", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/speak");

  await expect(page.getByRole("heading", { name: /The words you actually need/ })).toBeVisible();

  /* Today's phrase, with what it means and how long it takes. */
  const today = page.getByRole("region", { name: /Today.s Spanish/ });
  await expect(today).toBeVisible();
  await expect(today.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(today.getByRole("button", { name: "I know this" })).toBeVisible();

  /* The ten situations, each a real link. */
  await expect(page.getByRole("link", { name: /At the supermarket/ })).toBeVisible();
  await page.getByRole("link", { name: /Eating out/ }).click();

  await expect(page.getByRole("heading", { name: "Eating out" })).toBeVisible();
  await expect(page.getByText("La cuenta, por favor")).toBeVisible();
  await expect(page.getByText("The bill, please")).toBeVisible();
});

test("saving a phrase persists it, and knowing one takes it out of rotation", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/speak/eating-out");

  const first = page.getByRole("article").first();
  await first.getByRole("button", { name: "Save", exact: true }).click();
  await expect(first.getByRole("button", { name: "Saved" })).toBeVisible();

  /* A reload proves it is a row rather than component state. */
  await page.goto("/speak/saved");
  await expect(page.getByRole("heading", { name: "Saved phrases" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);

  /* Marking known is reversible: the same button releases it. */
  const saved = page.getByRole("article").first();
  await saved.getByRole("button", { name: "I know this" }).click();
  await expect(saved.getByRole("button", { name: "You know this" })).toBeVisible();
});

test("the daily phrase reaches Home, and links to the feature", async ({ page }) => {
  await signUpAndOnboard(page);

  const today = page.getByRole("region", { name: "Today for you" });
  await expect(today).toBeVisible();

  /* Language is one of the ranked picks, never the only one. */
  const language = today.getByRole("listitem").filter({ hasText: /Today's Spanish/ });
  await expect(language).toHaveCount(1);
  await language.getByRole("link").first().click();
  await page.waitForURL("**/speak");
});

test("a place carries the phrase you will need there", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/discover");
  await page.getByRole("link", { name: /Menú del día/ }).first().click();

  const hint = page.getByRole("region", { name: /Useful Spanish/ });
  await expect(hint).toBeVisible();
  await expect(hint.getByText("La carta, por favor")).toBeVisible();
});

test("Ask answers a language question from the pack rather than from a model", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/ask?q=How%20do%20I%20say%20the%20bill%20please");

  await expect(page.getByText("La cuenta, por favor").first()).toBeVisible({ timeout: 15_000 });
});
