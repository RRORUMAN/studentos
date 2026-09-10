import { expect, test } from "@playwright/test";

import { PASSWORD, signUp } from "./helpers";

/**
 * ============================================================================
 * THE ADMIN CONSOLE IS GATED
 * ----------------------------------------------------------------------------
 * Two smoke tests over the real route: an ordinary student is bounced, and so
 * is somebody who has just registered an `ADMIN_EMAILS` address.
 *
 * WHAT THIS FILE CANNOT PROVE, stated because it was originally written as
 * though it could. The property that matters — that an allowlisted address
 * confers nothing until it is CONFIRMED — is invisible here. With no mail
 * provider configured, sign-up hands the verification token to the browser and
 * redirects through it, so a local account is verified seconds after it is
 * created and the gate behaves identically whether or not it checks. This file
 * passed against the broken code.
 *
 * That property is `tests/unit/admin-access.test.ts`, over a pure function,
 * and it fails on the old behaviour. This file's job is the smaller one: that
 * the route is wired to the guard at all, and that the bounce is a redirect
 * rather than a 403 that would confirm the route exists.
 * ============================================================================
 */

const ALLOWLISTED = "e2e-admin@studentos.local";

test("a freshly registered allowlisted address does not land in the console", async ({ page }) => {
  /* The attack, exactly: be first to sign up as the founder.

     The two Playwright projects share one file store, so whichever of mobile
     and desktop runs second finds the address already taken and is told to
     sign in — which is the OTHER fix in this suite working, and is signed in
     just the same. Either way the session below belongs to the allowlisted
     address, which is all this test needs. */
  await page.goto("/signup");
  await page.getByLabel("Email").fill(ALLOWLISTED);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  const taken = page.getByText(/already has an account/i);
  await Promise.race([
    page.waitForURL(/\/(onboarding|verify-email)/, { timeout: 30_000 }),
    taken.waitFor({ timeout: 30_000 }),
  ]);

  if (await taken.isVisible().catch(() => false)) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ALLOWLISTED);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(home|onboarding|verify-email)/, { timeout: 30_000 });
  }

  await page.goto("/admin");

  /* Not the console. The address is unconfirmed, so it proves nothing. */
  await expect(page).not.toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: /data health|services|admin/i })).toHaveCount(0);
});

test("an ordinary student is bounced from the console without being told it exists", async ({ page }) => {
  await signUp(page);

  await page.goto("/admin");

  /* A redirect rather than a 403: a 403 confirms the route is there. */
  await expect(page).not.toHaveURL(/\/admin$/);
  await expect(page.locator("body")).not.toContainText(/forbidden|not authorised|403/i);
});
