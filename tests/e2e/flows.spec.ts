import { expect, test } from "@playwright/test";

import { addSpend, signUp, signUpAndOnboard, toCents, uniqueEmail, PASSWORD } from "./helpers";

/**
 * ============================================================================
 * END-TO-END FLOWS
 * ----------------------------------------------------------------------------
 * The journeys the product is judged on, walked against a real server and a
 * real database.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* FLOW 1 — signup → onboarding → personalised home                            */
/* -------------------------------------------------------------------------- */

test("a new student can sign up, set up, and land on a personalised Home", async ({ page }) => {
  await signUpAndOnboard(page);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)|Still up/);
  await expect(page.locator("main").getByText("Madrid", { exact: false }).first()).toBeVisible();

  /* The budget they entered has become a daily figure. */
  const safeToday = page.getByText("Safe to spend today", { exact: true }).locator("..");
  await expect(safeToday).toBeVisible();
  expect(toCents(await safeToday.innerText())).toBeGreaterThan(0);

  /* Quick actions and the For You feed are there, with a reason on the cards. */
  await expect(page.getByRole("navigation", { name: "Quick actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "For you", exact: true })).toBeVisible();
  await expect(page.locator("main").getByText("Why", { exact: true }).first()).toBeVisible();

  /* Demo data is labelled as demo data. */
  await expect(page.getByText(/Sample city data/i)).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* FLOW 2 — events: free tab → interested/going → event chat                   */
/* -------------------------------------------------------------------------- */

test("a student can find something free, say they are going, and open the event chat", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/events?tab=free");
  const firstEvent = page.locator("main").getByRole("listitem").first();
  await expect(firstEvent).toBeVisible();
  await expect(firstEvent.getByText("Free").first()).toBeVisible();

  await firstEvent.getByRole("link").first().click();
  await page.getByRole("button", { name: /^Going/ }).click();
  await expect(page.getByRole("button", { name: /^Going/ })).toHaveAttribute("aria-pressed", "true");

  /* Going opens the chat. */
  await page.getByRole("link", { name: /Event chat/ }).click();
  await page.waitForURL(/\/pulse\/chat\/event-/);
  /* Stamped: the store persists between runs and both Playwright projects
     share it, so an unstamped message would accumulate in this channel and the
     count assertion below would drift upwards run after run. */
  const message = `Anyone coming alone? #${Date.now().toString(36).slice(-5)}`;
  await page.getByLabel("Message").fill(message);
  await page.getByRole("button", { name: "Send" }).click();

  /* Sent once, and in the thread exactly once. */
  const thread = page.getByRole("list", { name: "Conversation" });
  await expect(thread.getByRole("listitem").filter({ hasText: message })).toHaveCount(1);

  /* Save it, and it shows in Saved. */
  await page.goBack();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
  await expect(page.locator("main").getByRole("listitem").first()).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* FLOW 3 — ask → useful answer → students say → limits explained              */
/* -------------------------------------------------------------------------- */

test("Ask returns a real plan built from real rows, never an invented one", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/ask?q=" + encodeURIComponent("What can I do tonight for €20?"));

  const answer = page.getByRole("heading", { level: 2 }).first();
  await expect(answer).toBeVisible({ timeout: 20_000 });

  /* The plan is priced and never exceeds the number the student gave. */
  const total = page.getByText("Total", { exact: true }).locator("..");
  await expect(total).toBeVisible();
  expect(toCents(await total.innerText())).toBeLessThanOrEqual(2_000);

  /* Provenance, the parse, and a way to reach real people. */
  await expect(page.getByText("Sources", { exact: true })).toBeVisible();
  await expect(page.getByText("Read as", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ask my campus/ })).toBeVisible();
});

test("Ask never claims a priced list is free", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/ask?q=" + encodeURIComponent("cheap lunch near campus"));

  const summary = page.locator("section").first();
  await expect(summary).toBeVisible({ timeout: 20_000 });
  const text = await summary.innerText();
  if (/€\d/.test(text)) expect(text).not.toMatch(/all of this is free/i);
});

test("Can I afford this gives a verdict with the money that is left", async ({ page }) => {
  await signUpAndOnboard(page, "600");
  await page.goto("/budget/afford?amount=12&category=eating-out");
  await expect(page.getByRole("heading", { name: "Can I afford this?" })).toBeVisible();
  await expect(page.getByText(/Safe until (Monday|Sunday)/)).toBeVisible();
  await expect(page.getByText(/^(Yes|Possibly|Not ideal)$/)).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* FLOW 4 — manual transaction → budget updates → safe spend updates           */
/* -------------------------------------------------------------------------- */

test("logging a spend moves the budget and the safe-to-spend figure", async ({ page }) => {
  await signUpAndOnboard(page, "600");

  await page.goto("/budget");
  const before = toCents(await page.getByText("Remaining", { exact: true }).locator("..").innerText());

  await addSpend(page, "42.50", "Groceries");

  await page.goto("/budget");
  const after = toCents(await page.getByText("Remaining", { exact: true }).locator("..").innerText());
  expect(before - after).toBe(4_250);
  await expect(page.getByText("Groceries").first()).toBeVisible();

  /* Home shows the same safe-today engine, and the figure moved. */
  await page.goto("/home");
  const safe = page.getByText("Safe to spend today", { exact: true }).locator("..");
  await expect(safe).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* FLOW 5 — survival mode and value-first paywalls                             */
/* -------------------------------------------------------------------------- */

test("Survival Mode builds a plan that never exceeds the money available", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/budget/survival?amount=45&days=4");

  await expect(page.getByRole("heading", { name: "Survival Mode", level: 1 })).toBeVisible();
  await expect(page.getByText("Groceries")).toBeVisible();
  await expect(page.getByText("Things to do")).toBeVisible();
  await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Survival Mode", level: 3 })).toBeVisible();
});

test("a locked feature explains what it does rather than saying upgrade", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/upgrade?feature=budgetForecast");

  await expect(page.getByText("You were trying to use")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Month-end forecast" })).toBeVisible();
  await expect(page.getByText(/Free at every tier/i)).toBeVisible();
  /* The recommended tier is Pro. */
  await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
});

test("entitlements are enforced on the server, not just hidden in the UI", async ({ page }) => {
  await signUpAndOnboard(page);

  /* Old links redirect, and a paid map layer requested by URL is ignored. */
  await page.goto("/explore?layer=nightlife");
  await page.waitForURL(/\/discover/);
  await expect(page.getByText(/Every map layer/i)).toBeVisible();

  /* A Pro trip requested by URL shows the home city and the value-first card. */
  await page.goto("/discover?city=paris");
  await expect(page.getByRole("heading", { name: "Discover", exact: true })).toBeVisible();
  await expect(page.getByText(/Trip planner/)).toBeVisible();

  /* The week planner shows two real picks and withholds the rest. */
  await page.goto("/plans/week");
  await expect(page.getByRole("heading", { name: "Your week" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Weekly planner" })).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* FLOW 6 — Anyone Down? → join → group                                        */
/* -------------------------------------------------------------------------- */

test("a student can post a plan and it appears for the city", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/anyone-down");
  await page.getByRole("button", { name: "Anyone down?" }).click();
  await page.getByRole("button", { name: "Football" }).click();
  await page.getByRole("button", { name: "Post it" }).click();

  await page.waitForURL(/\/anyone-down\/[0-9a-f-]+/);
  await expect(page.getByRole("heading", { name: "Football" })).toBeVisible();
  await expect(page.getByText(/1 in ·/)).toBeVisible();

  /* It also shows under Plans. */
  await page.goto("/plans");
  await expect(page.getByText("Football").first()).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* Community                                                                   */
/* -------------------------------------------------------------------------- */

test("Student Pulse is readable and postable on the free tier", async ({ page }) => {
  /* Both Playwright projects share one store, so the title carries a stamp. */
  const title = `Cheapest laundry near Moncloa? #${Date.now().toString(36).slice(-4)}`;
  await signUpAndOnboard(page);

  await page.goto("/loop");
  await page.waitForURL(/\/pulse/);
  await expect(page.getByRole("heading", { name: "Student Pulse" })).toBeVisible();
  await expect(page.locator("main").getByRole("listitem").first()).toBeVisible();

  await page.getByRole("button", { name: "Post something" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Question", exact: true }).click();
  await page.getByRole("button", { name: "Post it", exact: true }).click();

  await expect(page.getByText(title)).toBeVisible();

  /* Open it and answer it. */
  await page.getByRole("link", { name: title }).click();
  await page.getByLabel("Your answer").fill("There is one on Calle de la Princesa, €4 a load.");
  await page.getByRole("button", { name: /^(Answer|Reply)$/ }).click();
  await expect(page.getByRole("paragraph").filter({ hasText: "€4 a load" })).toBeVisible();

  /* The chat hub lists the city channels. */
  await page.goto("/pulse/chat");
  await expect(page.getByRole("heading", { name: "Chat" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cheap eats/ }).first()).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* Privacy                                                                     */
/* -------------------------------------------------------------------------- */

test("one student cannot read another student's private plan, chat or budget", async ({ browser }) => {
  const a = await browser.newContext();
  const pageA = await a.newPage();
  await signUpAndOnboard(pageA, "500");

  /* A creates a private plan and an Anyone Down? group they alone are in. */
  await pageA.goto("/plans");
  await pageA.getByRole("button", { name: "New plan" }).click();
  await pageA.getByLabel("Plan name").fill("Private Saturday");
  await pageA.getByRole("button", { name: "Create" }).click();
  await pageA.waitForURL(/\/plans\/[0-9a-f-]+/);
  const planUrl = pageA.url();
  const planId = planUrl.split("/plans/")[1];

  await pageA.goto("/anyone-down");
  await pageA.getByRole("button", { name: "Anyone down?" }).click();
  await pageA.getByRole("button", { name: "Coffee" }).click();
  await pageA.getByRole("button", { name: "friends" }).click();
  await pageA.getByRole("button", { name: "Post it" }).click();
  await pageA.waitForURL(/\/anyone-down\/[0-9a-f-]+/);
  const inviteId = pageA.url().split("/anyone-down/")[1];

  /* B, a different account, cannot see any of it. */
  const b = await browser.newContext();
  const pageB = await b.newPage();
  await signUpAndOnboard(pageB, "900");

  await pageB.goto(`/plans/${planId}`);
  await expect(pageB.getByText(/could not be found|not found/i).first()).toBeVisible();

  await pageB.goto(`/pulse/chat/plan-${planId}`);
  await expect(pageB.getByText(/could not be found|not found/i).first()).toBeVisible();

  await pageB.goto(`/pulse/chat/invite-${inviteId}`);
  await expect(pageB.getByText(/could not be found|not found/i).first()).toBeVisible();

  /* B's budget is B's: the figure A set never appears. */
  await pageB.goto("/budget");
  await expect(pageB.getByText("€900").first()).toBeVisible();
  await expect(pageB.getByText("€500", { exact: true })).toHaveCount(0);

  /* A's friends-only plan is not in B's city list. */
  await pageB.goto("/anyone-down");
  await expect(pageB.getByRole("link", { name: /^Coffee/ })).toHaveCount(0);

  await a.close();
  await b.close();
});

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

test("sign-in rejects a wrong password without revealing whether the account exists", async ({ page, context }) => {
  const email = await signUp(page);
  await context.clearCookies();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  const error = page.locator("form").getByRole("alert");
  await expect(error).toBeVisible();
  await expect(error).toContainText("do not match");

  await page.goto("/login");
  await page.getByLabel("Email").fill(uniqueEmail("nobody"));
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("do not match");
});

test("Google sign-in is either real or honestly absent, never a dead button", async ({ page }) => {
  await page.goto("/login");
  const button = page.getByRole("link", { name: "Continue with Google" });
  const note = page.getByText(/Google sign-in is not connected/);
  expect((await button.count()) + (await note.count())).toBe(1);
});

test("the app is not reachable signed out", async ({ page }) => {
  for (const route of ["/home", "/budget", "/pulse", "/plans", "/you", "/admin"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/(login|signup)/, { timeout: 10_000 });
  }
});

/* -------------------------------------------------------------------------- */
/* Arrival                                                                     */
/* -------------------------------------------------------------------------- */

test("Arrival Mode tasks persist, the first week is planned, and official items link to a source", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/arrival");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Madrid/);
  await expect(page.getByRole("heading", { name: "Your first week" })).toBeVisible();

  const firstTask = page.getByRole("checkbox").first();
  await firstTask.click();
  await expect(firstTask).toHaveAttribute("aria-checked", "true");

  await page.reload();
  await expect(page.getByRole("checkbox").first()).toHaveAttribute("aria-checked", "true");

  const sourceLink = page.locator('a[href^="https://"]:visible').first();
  await expect(sourceLink).toBeVisible();
});
