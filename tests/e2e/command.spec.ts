import { expect, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

/**
 * ============================================================================
 * QUICK COMMAND
 * ----------------------------------------------------------------------------
 * That one field reaches the whole product, and that nothing typed into it is
 * a dead end.
 *
 * The ranking is unit-tested in `tests/unit/command.test.ts`; what is left for
 * a browser is the part a pure function cannot answer -- that the dialog opens
 * from a keyboard and from a thumb, that Enter goes where the highlight says,
 * and that a question the registry does not know reaches Ask with the words
 * intact.
 * ============================================================================
 */

const palette = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Search StudentOS" });

test.describe("quick command", () => {
  test("finds a screen by the word on the form rather than its name", async ({ page }) => {
    await signUpAndOnboard(page);

    await page.getByRole("button", { name: "Search StudentOS" }).click();
    await expect(palette(page)).toBeVisible();

    /* The case the whole feature is for: a student holding a residency
       appointment slip, typing the word printed on it. Nothing in the
       product is called "NIE". */
    await page.getByRole("combobox", { name: "Search" }).fill("nie");
    await expect(page.getByRole("option", { name: /Arrival/ })).toBeVisible();

    await page.keyboard.press("Enter");
    await page.waitForURL("**/arrival");
    await expect(palette(page)).toHaveCount(0);
  });

  test("opens from the keyboard, and closes again", async ({ page }) => {
    await signUpAndOnboard(page);

    /**
     * THE CLICK IS NOT REDUNDANT. The shortcut is a `window` listener attached
     * by an effect, so it does not exist until React has hydrated the page.
     * `keyboard.press` is one event with nothing to retry against, so pressing
     * it on a freshly loaded route is a race that loses roughly whenever the
     * bundle is slow -- which is exactly what it did here first time. Clicking
     * the trigger is the cheapest available proof that the page is
     * interactive, and it costs one assertion.
     */
    const trigger = page.getByRole("button", { name: "Search StudentOS" });
    await trigger.click();
    await expect(palette(page)).toBeVisible();

    /* Escape, from the field, closes it. */
    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);

    /* And now the shortcut itself, on a page that is certainly listening.
       Control rather than Meta because both Chromium profiles here are not a
       Mac; the component accepts either, so this is not a platform test. */
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);
  });

  test("hands a question it does not recognise to Ask, with the words intact", async ({ page }) => {
    await signUpAndOnboard(page);

    await page.getByRole("button", { name: "Search StudentOS" }).click();
    const question = "cheapest way to get a bike";
    await page.getByRole("combobox", { name: "Search" }).fill(question);

    /* No screen is called that, and the palette says so rather than sending
       the student somewhere that half fits. */
    await expect(page.getByRole("option", { name: new RegExp(question) })).toBeVisible();

    await page.keyboard.press("Enter");
    await page.waitForURL(/\/ask\?q=/);
    expect(decodeURIComponent(page.url())).toContain(question);
  });

  test("opens with somewhere to go before anything is typed", async ({ page }) => {
    await signUpAndOnboard(page);

    await page.getByRole("button", { name: "Search StudentOS" }).click();

    /* An empty palette is not an empty list. Six things, not forty. */
    const options = palette(page).getByRole("option");
    await expect(options).toHaveCount(6);
    await expect(options.first()).toContainText("Explore");
  });
});
