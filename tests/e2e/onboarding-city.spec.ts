import { expect, test } from "@playwright/test";

import { signUp } from "./helpers";

/**
 * ============================================================================
 * THE CITY BOX HAS TO FIND THE CITIES
 * ----------------------------------------------------------------------------
 * The picker searched `cityDirectory.filter(city => !city.deep)` — every city
 * EXCEPT the five with the most data behind them, because those five are drawn
 * as buttons above the box. So a student typing "madrid" got no results and the
 * message "Not on the list yet. Pick the nearest city", about the flagship
 * city sitting a few centimetres higher on the same screen.
 *
 * The unit tests could not catch it. They call `searchCities` with the full
 * directory, and `searchCities` was never wrong — the picker was, in what it
 * handed over. Only driving the real box catches that, which is this file.
 *
 * The second test is the one the expansion made necessary: onboarding's
 * `completeOnboarding` helper has always picked Madrid, so the path that 256
 * of 261 cities take had never been walked by anything.
 * ============================================================================
 */

test("typing a flagship city finds it", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: /International student/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const box = page.getByPlaceholder(/Search \d+ cities/);
  await expect(box).toBeVisible();

  for (const city of ["Madrid", "Berlin"]) {
    await box.fill(city);
    await expect(page.getByText(/Not on the list yet/)).toHaveCount(0);
    /* The result row, not the button above it: the row carries the country. */
    await expect(page.getByRole("button", { name: new RegExp(`${city}\\s*·`) })).toBeVisible();
  }
});

test("a student can set up in a city that is not one of the five", async ({ page }) => {
  await signUp(page);

  await page.getByRole("button", { name: /International student/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  /* Cluj-Napoca exists only because of the European expansion: Romania had no
     country profile, no city and no institutions at all before it. */
  await page.getByPlaceholder(/Search \d+ cities/).fill("cluj");
  await page.getByRole("button", { name: /Cluj-Napoca\s*·/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  /* University: the picker covers every institution in the country, and
     Babeș-Bolyai is attached to Cluj by the geographic metro matching. */
  await page.getByRole("searchbox", { name: /Search universities/ }).fill("babes");
  const option = page.getByRole("option").first();
  await expect(option).toBeVisible();
  await option.click();
  await page.getByRole("button", { name: "Continue" }).click();

  /* Home area, budget, goals, interests, then the skippable tail. */
  await page.getByRole("button", { name: /Skip|Continue/ }).first().click();
  await page.getByLabel("Roughly per month").fill("2400");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  for (const interest of ["Cheap eats", "Football", "Museums"]) {
    await page.getByRole("button", { name: interest, exact: true }).click();
  }
  await page.getByRole("button", { name: "Continue" }).click();
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: "Skip" }).click();
  }
  await page.getByRole("button", { name: /Enter StudentOS/ }).click();

  await page.waitForURL("**/home", { timeout: 30_000 });

  /* Romania is RON, and every figure has to be in it — not the euro the
     mission templates and the price anchors are authored in. This is the
     assertion the whole test exists for: the currency is the thing that
     silently stays wrong when a product is built around one country. */
  const body = page.locator("body");
  await expect(body).toContainText("Cluj-Napoca");
  await expect(body).toContainText(/RON|lei/);
  await expect(body).not.toContainText("€");
});
