import { expect, test } from "@playwright/test";

import { signUp } from "./helpers";

/**
 * ============================================================================
 * THE PREVIEW HANDS ITS ANSWERS TO SETUP
 * ----------------------------------------------------------------------------
 * `/get-started` asks for a city, a university, a budget and interests, then
 * shows what that buys. Setup after sign-up asks for the same four among its
 * twelve. Until the draft hand-over in `components/onboarding/draft.ts` they
 * shared nothing, so every student who took the preview answered the same
 * questions twice.
 *
 * This walks the real path — preview, the result screen's own button, sign-up,
 * setup — and checks that setup opens with the preview's city and budget
 * already chosen. It runs in one tab because that is the contract: the
 * hand-over lives in session storage and survives the sign-up redirects.
 *
 * It also pins the second fix on the same screen. The result used to pick its
 * "Tonight in {city}" plan by price from a list that only holds Madrid, so a
 * Berlin preview showed a Madrid evening under a Berlin heading.
 * ============================================================================
 */

test("the preview's answers open setup pre-filled, and a Berlin preview shows no Madrid plan", async ({
  page,
}) => {
  await page.goto("/get-started");

  /* City: searched, as a student outside the five would have to. */
  await page.getByPlaceholder(/Search \d+ cities/).fill("berlin");
  await page.getByRole("button", { name: /Berlin\s*·/ }).click();

  /* Picking a city moves on by itself; wait for the next question as a
     student would, rather than racing the transition. */
  await expect(page.getByRole("heading", { name: /Which university in Berlin/ })).toBeVisible();

  /* University: skipped. Budget: typed in the city's currency. */
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Monthly, after rent").fill("700");
  await page.getByRole("button", { name: "Continue" }).click();

  /* Interests keep their two defaults. */
  await page.getByRole("button", { name: /Show me my/ }).click();
  await expect(page.getByRole("heading", { name: /for Berlin/ })).toBeVisible();

  /* The only seeded evenings are Madrid's. None may appear under Berlin. */
  await expect(page.getByText("Tonight in Berlin")).toHaveCount(0);
  await expect(page.getByText(/Ramen|Malasaña/)).toHaveCount(0);

  /* The result ends in the account, not a waitlist. */
  await expect(page.getByText(/leave an address/i)).toHaveCount(0);
  await page.getByRole("link", { name: "Create your account" }).click();
  await page.waitForURL("**/signup");

  await signUp(page);

  /* Status is not a preview question, so it is asked. */
  await page.getByRole("button", { name: /International student/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  /* City: already Berlin, and it says where that came from. */
  await expect(page.getByRole("button", { name: /^Berlin/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("From your preview")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  /* University and area: skipped. */
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: /Skip|Continue/ }).first().click();

  /* Budget: the preview's figure, not an empty box. */
  await expect(page.getByLabel("Roughly per month")).toHaveValue("700");
});
