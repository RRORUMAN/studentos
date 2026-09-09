import { readFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { addSpend, completeOnboarding, signUp, signUpAndOnboard } from "./helpers";

/**
 * ============================================================================
 * ISOLATION
 * ----------------------------------------------------------------------------
 * That one student cannot read another student's data.
 *
 * Every other test in this suite drives one signed-in student and asserts what
 * they see. These drive two, in separate browser contexts with separate
 * cookies, and assert what the second one CANNOT see. That is a different kind
 * of test and it is the one worth having: a leak does not look like a broken
 * page, it looks like a page that works.
 *
 * THE ATTACKER IS ASSUMED TO KNOW THE IDs. `userIdFor` reads the victim's user
 * id straight out of the store rather than trying to discover it through the
 * interface, because "they could not guess the URL" is not access control. A
 * plan id is in a share link, ids leak from logs, screenshots and backups. The
 * only defence that counts is the server refusing, so that is what is measured.
 *
 * SCOPE. These prove the checks in `src/server/**` — `canReadChannel`,
 * `loadPlan`'s membership test, `requireViewer` — hold at the routes that use
 * them. On Supabase the same code runs with RLS underneath as a second layer;
 * the application checks are the ones that exist on both stores, so they are
 * the ones pinned here.
 * ============================================================================
 */

/**
 * The store the e2e run writes to, from `playwright.config.ts`.
 *
 * Reading it from a test is deliberate and limited to looking up an id by
 * email. Nothing here writes to it: a test that reached in and created rows
 * would stop exercising the product.
 */
const STORE = ".data/e2e/studentos.json";

function userIdFor(email: string): string {
  const db = JSON.parse(readFileSync(STORE, "utf8")) as {
    users: { id: string; email: string }[];
  };
  const user = db.users.find((row) => row.email === email);
  if (!user) throw new Error(`No user in the store for ${email}`);
  return user.id;
}

/** The channel name `dmChannel` builds, without importing server code. */
function dmChannel(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `dm-${x}-${y}`;
}

/** A second student, in their own context, so the two never share a cookie. */
async function secondStudent(
  browser: Browser,
  onboard: { budget?: string } = {},
): Promise<{ page: Page; email: string; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = await signUp(page);
  await completeOnboarding(page, onboard);
  return { page, email, close: () => context.close() };
}

/** The app's own 404, which is what a refused object must look like. */
async function expectNotFound(page: Page) {
  await expect(page.getByRole("heading", { name: /could not be found/i })).toBeVisible();
}

test.describe("one student cannot read another's", () => {
  test("a private plan is not found, for a signed-in stranger or the internet", async ({
    page,
    browser,
  }) => {
    /* A makes a plan. It is private: nothing was shared. */
    await signUpAndOnboard(page);
    await page.goto("/plans");
    await page.getByRole("button", { name: "New plan" }).click();
    await page.getByLabel("Plan name").fill("A private Saturday");
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/plans\/[0-9a-f-]{36}/);
    const planId = page.url().split("/plans/")[1];
    await expect(page.getByRole("heading", { name: "A private Saturday" })).toBeVisible();

    /* B is a real, fully onboarded student. Not an anonymous request — the
       case that actually happens, and the one a session check alone passes. */
    const b = await secondStudent(browser);
    await b.page.goto(`/plans/${planId}`);
    await expectNotFound(b.page);
    await expect(b.page.locator("body")).not.toContainText("A private Saturday");

    /* The public share route for the same plan, which was never shared. A 404
       rather than a 403: confirming the plan exists is itself a leak. */
    const anonymous = await browser.newContext();
    const guest = await anonymous.newPage();
    await guest.goto(`/p/${planId}`);
    await expect(guest.locator("body")).not.toContainText("A private Saturday");

    await anonymous.close();
    await b.close();
  });

  test("a direct message refuses everyone who is not in it", async ({ page, browser }) => {
    /* Two students who could have a conversation between them... */
    const emailA = await signUpAndOnboard(page);
    const b = await secondStudent(browser);

    const channel = dmChannel(userIdFor(emailA), userIdFor(b.email));

    /* ...and a third who knows the URL. `canReadChannel` decides this, and the
       page calls it before loading a single message. */
    const c = await secondStudent(browser);
    await c.page.goto(`/pulse/chat/${channel}`);
    await expectNotFound(c.page);

    /* A malformed channel is refused too: `channelKind` returns null for
       anything it does not recognise, and null means no. */
    await c.page.goto("/pulse/chat/dm-not-a-uuid");
    await expectNotFound(c.page);

    await c.close();
    await b.close();
  });

  test("an ordinary student cannot reach the admin screens", async ({ page }) => {
    await signUpAndOnboard(page);

    /**
     * The signed-OUT case is covered in `flows.spec.ts`; this is the one that
     * actually happens. A student with a valid session who types the URL is
     * not an anonymous request, so every check that keys on "is there a
     * session" passes them straight through. `requireAdmin` is a second gate
     * on top of `requireViewer`, and this is what proves it is there.
     *
     * A redirect rather than a 403, deliberately: a 403 confirms the route
     * exists, and an admin surface is worth not advertising.
     */
    for (const route of ["/admin", "/admin?tab=services"]) {
      await page.goto(route);
      await expect(page, `${route} must not open for a non-admin`).toHaveURL(/\/home/);
    }

    /* And the data it would have shown is not on the page either. */
    await expect(page.getByRole("main")).not.toContainText("City coverage");
  });

  test("money is per student, and never bleeds between them", async ({ page, browser }) => {
    /* A: a distinctive budget and a distinctive spend. */
    await signUpAndOnboard(page, "760");
    await addSpend(page, "41.55");
    await page.goto("/budget");
    await expect(page.getByRole("main")).toContainText("41.55");

    /* B: a different budget, and no spends at all. */
    const b = await secondStudent(browser, { budget: "1290" });
    await b.page.goto("/budget");
    const budget = b.page.getByRole("main");

    /* Neither A's spend nor A's monthly figure may appear on B's screen. */
    await expect(budget).not.toContainText("41.55");
    await expect(budget).not.toContainText("760");

    await b.close();
  });
});

test.describe("signed out", () => {
  /**
   * Every private surface, in one test, because the failure mode is a single
   * page that forgot `requireViewer` rather than the rule being wrong.
   */
  const PRIVATE = [
    "/budget",
    "/saved",
    "/plans",
    "/you/data",
    "/you/profile",
    "/work/applications",
    "/pulse/chat",
    "/lifeops",
  ];

  test("a private surface sends you to sign in rather than rendering", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const path of PRIVATE) {
      await page.goto(path);
      await expect(page, `${path} should not render signed out`).toHaveURL(/\/login/);
    }

    await context.close();
  });

  test("the calendar export refuses without a session", async ({ browser }) => {
    const context = await browser.newContext();
    /* A timeline is the most personal object in the product and this route
       hands it over as a file. It must answer 401, not an empty calendar. */
    const response = await context.request.get("/api/lifeops/calendar.ics");
    expect(response.status()).toBe(401);
    await context.close();
  });

  test("a cron route is closed to the public", async ({ browser }) => {
    const context = await browser.newContext();
    /* No CRON_SECRET is set in the test environment, and that must CLOSE the
       route rather than open it. */
    for (const path of ["/api/cron/data-upkeep", "/api/cron/event-sync", "/api/cron/work-sync"]) {
      const response = await context.request.get(path);
      expect(response.status(), `${path} must not run unauthenticated`).toBe(401);
    }
    await context.close();
  });
});
