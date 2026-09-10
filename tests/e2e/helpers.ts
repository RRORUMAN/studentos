import type { Page } from "@playwright/test";

/**
 * Shared steps for the end-to-end flows.
 *
 * `signUpAndOnboard` is the precondition for almost everything, so it is
 * written once and kept fast: it skips every optional step, which also proves
 * the claim that onboarding is genuinely skippable and still lands the student
 * on a working, personalised Home.
 */

/** A fresh address per run, so tests never collide on the unique email index. */
export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@universidad.edu`;
}

export const PASSWORD = "quiet-lavender-tram-91";

export async function signUp(page: Page, email = uniqueEmail()): Promise<string> {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  /* With no mailer configured, sign-up redirects through the verification link
     rather than emailing it — see the note in `server/actions/auth.ts`. */
  await page.getByRole("link", { name: /continue/i }).click();
  await page.waitForURL("**/onboarding");

  return email;
}

/**
 * Walk onboarding, choosing the minimum and skipping the rest.
 *
 * `budget` is entered because most assertions downstream are about money; every
 * other optional step is skipped deliberately.
 */
export async function completeOnboarding(
  page: Page,
  options: { budget?: string; arrivingInDays?: number } = {},
): Promise<void> {
  const budget = options.budget ?? "760";

  // 1. Status
  await page.getByRole("button", { name: /International student/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // 2. City
  await page.getByRole("button", { name: /^Madrid/ }).click();

  /* An arrival date in the future is what puts a student in the
     `before-arrival` stage, and that stage is the one whose Home differs most
     — it leads with the countdown and drops "today" and "right now" entirely,
     because both answer "what is on near you" about a city this student has
     not reached. Without this the suite only ever tested a student who is
     already there. */
  if (options.arrivingInDays !== undefined) {
    await page.getByRole("checkbox", { name: /moving there soon/i }).check();
    const arriving = new Date(Date.now() + options.arrivingInDays * 86_400_000);
    await page.getByLabel("Arriving", { exact: true }).fill(arriving.toISOString().slice(0, 10));
  }

  await page.getByRole("button", { name: "Continue" }).click();

  /* 3. University — skippable, but the campus drives a lot, so pick one.
        It has to be SEARCHED for rather than clicked out of the opening list:
        the picker now covers every institution in the country and opens with
        the eight nearest the student, which is not the same eight it used to
        show. Typing is also what a real student does. */
  await page
    .getByRole("searchbox", { name: /Search universities/ })
    .fill("complutense");
  await page.getByRole("option", { name: /Universidad Complutense de Madrid/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // 4. Home area
  await page.getByRole("button", { name: "Malasaña" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // 5. Budget
  await page.getByLabel("Roughly per month").fill(budget);
  await page.getByRole("button", { name: "Continue" }).click();

  // 6. Money goals — skip
  await page.getByRole("button", { name: "Skip" }).click();

  // 7. Interests — three are required
  for (const interest of ["Cheap eats", "Football", "Museums"]) {
    await page.getByRole("button", { name: interest, exact: true }).click();
  }
  await page.getByRole("button", { name: "Continue" }).click();

  // 8-12 — skip everything skippable
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: "Skip" }).click();
  }

  await page.getByRole("button", { name: /Enter StudentOS/ }).click();
  await page.waitForURL("**/home", { timeout: 30_000 });
}

/** Sign up and land on a fully set-up Home. */
export async function signUpAndOnboard(page: Page, budget?: string): Promise<string> {
  const email = await signUp(page);
  await completeOnboarding(page, { budget });
  return email;
}

/** Log a spend from the Budget screen. */
export async function addSpend(page: Page, amount: string, category = "Groceries"): Promise<void> {
  await page.goto("/budget");
  await page.getByRole("button", { name: "Add a spend" }).click();
  await page.getByLabel("Amount").fill(amount);
  await page.getByRole("button", { name: category, exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(600);
}

/** Parse a money string like "€28.14" into cents. */
export function toCents(text: string): number {
  const match = text.replace(/\s/g, "").match(/([\d.,]+)/);
  if (!match) throw new Error(`No amount in "${text}"`);
  return Math.round(Number(match[1].replace(",", ".")) * 100);
}
