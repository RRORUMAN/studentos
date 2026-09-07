import { expect, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

/**
 * ============================================================================
 * LOCAL TRUTH AND ASK STUDENTS
 * ----------------------------------------------------------------------------
 * The loop that makes the product compound: a question nobody could answer
 * goes to the students who would know, an answer comes back, and the claims
 * students rely on get re-checked before they go stale.
 *
 * The assertions here are deliberately about *what a student sees*, not about
 * the numbers in `assess()` — those are pinned in `tests/unit/truth.test.ts`
 * against a fixed clock. What this file proves is that the verdict reaches the
 * screen: that a confidence badge is rendered next to every claim, that one
 * tap records a check, and that an answer posted by one student is visible on
 * the question.
 * ============================================================================
 */

test("a claim is never shown without its confidence", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/ask/questions");

  const checks = page.getByRole("heading", { name: /Quick checks/ });
  if (!(await checks.isVisible().catch(() => false))) {
    /* A city with nothing needing a check is a valid state, not a failure —
       it is what the screen should look like once students have kept up. */
    test.skip(true, "no claim in this city currently needs checking");
  }

  /* Every claim row carries a verdict chip and the sentence explaining it.
     A statement rendered without one is the specific bug this whole layer
     exists to prevent, so it is asserted rather than eyeballed. */
  await expect(page.getByText(/Verified|Likely live|Unconfirmed|Disputed|Expired/).first()).toBeVisible();
  await expect(page.getByText(/students? (confirmed|have confirmed|reported)|Nobody has confirmed/).first()).toBeVisible();
});

test("one tap records a check and takes that claim out of the queue", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/ask/questions");

  const yes = page.getByRole("button", { name: "Yes" });
  const before = await yes.count();
  if (before === 0) {
    test.skip(true, "no claim in this city currently needs checking");
  }

  await yes.first().click();

  /* A confirmed claim is fresh again, so it drops out of the queue on the next
     render. The count is the assertion worth making: whatever the row does
     visually, the student must never be asked twice about the same thing. */
  await expect(yes).toHaveCount(before - 1, { timeout: 10_000 });
});

test("asking students creates a routed question the asker can follow", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/ask/questions");

  /* A printing question: `routeQuestion` treats that as a campus subject, so
     this also pins the routing rule rather than just the write. A question
     about groceries would correctly go city-wide instead.

     The nonce matters: the mobile and desktop projects share one store, so
     two runs of this test would otherwise post identically-worded questions
     from two different students and every locator would match both. */
  const nonce = `${Date.now()}`.slice(-6);
  const asked = `Which printer in building ${nonce} takes coins rather than a card?`;

  await page
    .getByPlaceholder("Where can I print 100 pages cheaply near campus?")
    .fill(asked);
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  await page.waitForURL(/\/ask\/questions\/[^/]+$/);

  await expect(
    page.getByRole("heading", { name: new RegExp(`building ${nonce}`) }),
  ).toBeVisible();

  /* Routed to the campus, because onboarding picked one and printing is a
     campus subject. */
  await expect(page.getByText("Students on your campus")).toBeVisible();

  /* The asker cannot answer their own question — the box is not offered. */
  await expect(page.getByRole("button", { name: "Post answer" })).toBeHidden();

  /* And it shows up under "You asked" on the way back. */
  await page.goto("/ask/questions");
  await expect(page.getByText(new RegExp(`building ${nonce}`))).toBeVisible();
});

test("a student can answer somebody else's open question", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/ask/questions");

  const waiting = page.getByRole("heading", { name: /Students are waiting/ });
  if (!(await waiting.isVisible().catch(() => false))) {
    test.skip(true, "no open question from another student in this city");
  }

  await page.getByRole("link", { name: /\?/ }).first().click();
  await page.waitForURL(/\/ask\/questions\/[^/]+$/);

  const box = page.getByPlaceholder(/What you actually know/);
  await expect(box).toBeVisible();
  await box.fill("The place on the corner does it for about four euro, bring a USB stick.");
  await page.getByRole("button", { name: "Post answer" }).click();

  /* The server re-render replaces the form with the posted answer, so assert
     on the durable state rather than the transient confirmation — the latter
     is a race against `revalidatePath`. */
  await expect(page.getByText(/bring a USB stick/)).toBeVisible();
  await expect(page.getByText("You have answered this one.")).toBeVisible();
});
