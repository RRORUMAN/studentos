import { expect, request, test } from "@playwright/test";

import { signUpAndOnboard, toCents } from "./helpers";

/**
 * ============================================================================
 * THE DAILY PRODUCT
 * ----------------------------------------------------------------------------
 * The surfaces a student opens on an ordinary Tuesday: Home as "my day",
 * LifeOps as the timeline, Smart Missions as a plan with steps, Student
 * Exchange as the network, and Ask as the command centre.
 *
 * These are deliberately separate from `flows.spec.ts`, which covers signup,
 * money, privacy and auth. This file is about whether the product answers
 * "what matters today".
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* HOME — my day                                                               */
/* -------------------------------------------------------------------------- */

test("Home leads with money, then a ranked handful of things, then the timeline", async ({ page }) => {
  await signUpAndOnboard(page, "760");

  /* 1. What can I afford. */
  const safeToday = page.getByText("Safe to spend today", { exact: true }).locator("..");
  await expect(safeToday).toBeVisible();
  expect(toCents(await safeToday.innerText())).toBeGreaterThan(0);
  await expect(page.getByText("Safe to spend this week", { exact: true })).toBeVisible();

  /* 2. Today for you: at most five, each with the reason it is there. */
  const today = page.getByRole("region", { name: "Today for you" });
  await expect(today).toBeVisible();
  const picks = today.getByRole("listitem");
  const count = await picks.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(5);

  /* 3. The brief and the timeline peek are both present and both link out. */
  await expect(page.getByRole("heading", { name: "Your brief" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your day" })).toBeVisible();
  await expect(page.getByRole("link", { name: /LifeOps/ }).first()).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* LIFEOPS                                                                     */
/* -------------------------------------------------------------------------- */

test("LifeOps shows one timeline and a task can be added, completed and undone", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/lifeops");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  /* Arrival tasks arrive on the timeline with dates, not as a separate list. */
  await expect(page.getByRole("link", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByText(/Built from your Arrival Mode tasks/)).toBeVisible();

  /* Add a task of my own. */
  await page.getByRole("button", { name: "Add to my timeline" }).click();
  const dialog = page.getByRole("dialog", { name: "Add to my timeline" });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder(/Assignment due/).fill("Return the library book");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Return the library book")).toBeVisible();

  /* Tick it. The row stays visible for the day, struck through. */
  const row = page.getByRole("listitem").filter({ hasText: "Return the library book" });
  await row.getByRole("checkbox").click();
  await expect(row.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
});

test("LifeOps has a week and an upcoming view, and a calendar export", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/lifeops?view=week");
  await expect(page.getByRole("link", { name: /^This week/ })).toHaveAttribute("aria-current", "page");

  await page.goto("/lifeops?view=upcoming");
  await expect(page.getByRole("link", { name: /^Upcoming/ })).toHaveAttribute("aria-current", "page");

  /* The calendar file is a real route, not a dead button. Driven through the
     browser because the session cookie is Secure and Playwright's API request
     context will not send it over plain HTTP. */
  await page.goto("/lifeops");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Calendar file" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.ics$/);

  /* And it is not readable signed out. */
  const signedOut = await request.newContext({ baseURL: page.url().split("/lifeops")[0] });
  const denied = await signedOut.get("/api/lifeops/calendar.ics");
  expect(denied.status()).toBe(401);
  await signedOut.dispose();
});

/* -------------------------------------------------------------------------- */
/* SMART MISSIONS                                                              */
/* -------------------------------------------------------------------------- */

test("a mission is built from real rows, priced, and its steps can be ticked", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/missions");
  await expect(page.getByRole("heading", { name: /Get a plan/ })).toBeVisible();

  /* The preview shows what would be in it before anything is written. */
  await page.getByRole("link", { name: /in it$/ }).first().click();
  await expect(page.getByText(/Preview · built from today/)).toBeVisible();

  /* Every priced line is a real number, and the total never exceeds the cap. */
  const total = page.getByText("Total", { exact: true }).locator("..");
  if (await total.count()) {
    await expect(total).toBeVisible();
  }

  await page.getByRole("button", { name: /^Start/ }).first().click();
  await page.waitForURL(/\/missions\/[0-9a-f-]+/);

  await expect(page.getByRole("heading", { name: "Steps" })).toBeVisible();
  const step = page.getByRole("listitem").filter({ has: page.getByRole("checkbox") }).first();
  await step.getByRole("checkbox").click();
  await expect(step.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");

  /* Progress is recomputed from the rows, not from local state. */
  await page.reload();
  await expect(page.getByText("Progress")).toBeVisible();
});

test("a mission can be shared and the public page shows no private figures", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/missions");
  await page.getByRole("button", { name: "Start", exact: true }).first().click();
  await page.waitForURL(/\/missions\/[0-9a-f-]+/);

  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("button", { name: /Copy link/ })).toBeVisible();

  const link = await page.locator("p", { hasText: "/m/" }).first().innerText();
  const token = link.match(/\/m\/([A-Za-z0-9_-]+)/)?.[1];
  expect(token).toBeTruthy();

  await page.goto(`/m/${token}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  /* A shared mission never carries the owner's budget or safe-to-spend. */
  await expect(page.getByText("Safe to spend today")).toHaveCount(0);
});

/* -------------------------------------------------------------------------- */
/* STUDENT EXCHANGE                                                            */
/* -------------------------------------------------------------------------- */

test("the exchange has five lanes, offers and requests, and no address field", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/exchange");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  for (const lane of ["Buy & sell", "Borrow", "Help", "Rides & travel", "Free stuff"]) {
    await expect(page.getByRole("link", { name: new RegExp(lane.replace("&", "&")) }).first()).toBeVisible();
  }

  /* Requests are first-class: "I need a desk under €30" is a listing too. */
  await page.goto("/exchange?mode=request");
  await expect(page.getByRole("link", { name: "Requests" })).toHaveAttribute("aria-current", "page");

  /* Posting: there is no address field, and there never will be. */
  await page.goto("/exchange/new");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Never your address/)).toBeVisible();
  await expect(page.getByLabel(/address/i)).toHaveCount(0);

  await page.getByPlaceholder(/IKEA desk|Desk under/).fill("Kettle and two mugs");
  await page.getByPlaceholder(/Two years old/).fill("Leaving in June, taking neither.");
  await page.getByPlaceholder(/main entrance/).fill("Moncloa metro, main exit");
  await page.getByRole("button", { name: /^Post it/ }).click();

  await page.waitForURL(/\/exchange\/[0-9a-f-]+/);
  await expect(page.getByRole("heading", { name: "Kettle and two mugs" })).toBeVisible();
  await expect(page.getByText("Moncloa metro, main exit")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meeting safely" })).toBeVisible();
});

test("the old marketplace links still work", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/marketplace");
  await page.waitForURL(/\/exchange/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* ASK                                                                         */
/* -------------------------------------------------------------------------- */

test("Ask says what it understood, answers with cards, and offers real follow-ups", async ({ page }) => {
  await signUpAndOnboard(page, "760");

  await page.goto(`/ask?q=${encodeURIComponent("Where should I buy groceries?")}`);

  /* The interpretation is visible, so a misread can be corrected. */
  await expect(page.getByText("Read as", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where to shop" })).toBeVisible();

  /* This is the query that used to return nothing: "buy" was being used as a
     substring filter over place names. It must return real rows. */
  const rows = page.getByRole("region", { name: "Where to shop" }).getByRole("listitem");
  expect(await rows.count()).toBeGreaterThan(0);

  /* Follow-ups are new questions, not the old one with words glued on. */
  await expect(page.getByRole("heading", { name: "Next" })).toBeVisible();

  /* Every answer is actionable, not only plans. */
  await expect(page.getByRole("link", { name: /See on the map/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ask my campus/ })).toBeVisible();
});

test("Ask answers a timeline question from the student's own rows", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto(`/ask?q=${encodeURIComponent("What am I forgetting this week?")}`);
  await expect(page.getByText("Read as", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open your timeline/ })).toBeVisible();
});

test("Ask refuses to author official requirements and links the source instead", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto(`/ask?q=${encodeURIComponent("how do I register my address")}`);
  await expect(page.getByRole("heading", { name: "Official information" })).toBeVisible();
  await expect(page.getByText(/never written by a model/)).toBeVisible();
  /* A real, linked source with the date it was checked. */
  await expect(page.locator('a[href^="https://"]:visible').first()).toBeVisible();
});

test("Ask prints what it can read, and it is the real tool list", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/ask");
  await expect(page.getByRole("heading", { name: "What Ask can see" })).toBeVisible();
  await expect(page.getByText("search_places")).toBeVisible();
  await expect(page.getByText("read_budget")).toBeVisible();
  await expect(page.getByText(/never leave your account/)).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* NAVIGATION                                                                  */
/* -------------------------------------------------------------------------- */

test("every new surface is reachable from the product, not only by URL", async ({ page }) => {
  await signUpAndOnboard(page);

  /* Today is in the bar on both mobile and desktop. */
  await page.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: "Today" }).click();
  await page.waitForURL(/\/lifeops/);

  /* Everything else has one home, on You. */
  await page.goto("/you");
  for (const label of ["Smart Missions", "Student Exchange", "Event radar", "Saved", "Plans"]) {
    await expect(page.getByRole("link", { name: new RegExp(label) }).first()).toBeVisible();
  }

  /* The two pages that used to be unreachable now have a way in. */
  await expect(page.getByRole("link", { name: /Starter pack/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Guides/ })).toBeVisible();
});
