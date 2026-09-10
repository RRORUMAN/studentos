import { expect, test } from "@playwright/test";

import { PASSWORD, signUp, uniqueEmail } from "./helpers";

/**
 * ============================================================================
 * SIGN-UP MUST NOT BE A WAY INTO SOMEBODY ELSE'S ACCOUNT
 * ----------------------------------------------------------------------------
 * The regression this guards was live and reachable by anyone.
 *
 * `signUp` answered a duplicate address with `{ok: true, userId: <the existing
 * account's id>}` so that the response would not reveal whether the address was
 * taken. The sign-up action reads a userId as licence to open a session, so
 * submitting a known address with ANY password that passed the strength check
 * signed the visitor in as that account. No password was ever compared — that
 * only happens in `signIn`, which this path never reaches.
 *
 * It mattered most for exactly the addresses worth attacking: ADMIN_EMAILS
 * grants /admin by email address alone, so the founder's own address was a
 * one-form takeover of the admin console by anybody who knew it.
 *
 * The test deliberately uses a DIFFERENT password from the original account.
 * Reusing the same one would pass even if the hole came back.
 * ============================================================================
 */

test("signing up with an address that already exists never opens a session", async ({ page }) => {
  const email = uniqueEmail("takeover");

  /* An account that belongs to somebody else. */
  await signUp(page, email);
  await expect(page).toHaveURL(/\/onboarding/);

  /* Become a stranger: no cookies, no session. */
  await page.context().clearCookies();

  const attackerPassword = "totally-different-passphrase-42";
  expect(attackerPassword).not.toBe(PASSWORD);

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(attackerPassword);
  await page.getByLabel("Confirm password").fill(attackerPassword);
  await page.getByRole("button", { name: "Create account" }).click();

  /* The claim: still on /signup, told to sign in, and holding no session. */
  await expect(page.getByText(/already has an account/i)).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);

  /* And the session really is absent, not merely un-redirected — asking for a
     page that requires one must bounce. */
  await page.goto("/home");
  await expect(page).toHaveURL(/\/(signin|get-started|login)/);
});
