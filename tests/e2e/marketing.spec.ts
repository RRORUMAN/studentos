import { expect, test, type Page } from "@playwright/test";

/**
 * ============================================================================
 * THE PUBLIC SITE
 * ----------------------------------------------------------------------------
 * Everything a visitor meets before they have an account. The suite had no
 * coverage here at all, which is how a header whose only mobile controls sat
 * off the right-hand edge of a 375px screen reached a deployed preview: the
 * markup was correct, the CSS was correct in isolation, and nothing ever
 * measured the result.
 *
 * These tests are therefore mostly *geometry* rather than content. Copy on the
 * landing page is meant to change; a control that cannot be reached, a page
 * that scrolls sideways, or an anchor that points at nothing are all defects
 * whatever the copy says.
 * ============================================================================
 */

/** Every control the header offers, whatever the viewport decides to show. */
async function headerControls(page: Page) {
  const header = page.locator("header").first();
  return header.locator("a, button").filter({ visible: true });
}

test.describe("the public site", () => {
  test("every header control sits inside the viewport", async ({ page }) => {
    await page.goto("/");

    /* Bounds, not an exact width. A scrollbar makes "the content area" three
       slightly different numbers depending on which box you ask, and pinning
       the header to one of them tests the scrollbar rather than the layout.
       The window is the one width nothing on the page may exceed. */
    const width = await page.evaluate(() => window.innerWidth);

    /* The header is `position: fixed; inset-x-0`. When a clipped-but-wider box
       anywhere on the page inflates the document's scroll width — the pricing
       comparison table's `min-w-[36rem]`, a horizontal card rail — Chrome
       resolves that `inset-x-0` against the scrollable width rather than the
       viewport, and the right-hand group walks off the screen. On a 375px
       phone the header measured 553px and every control past the logo was
       unreachable. Clipping on `html` is what holds it. */
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box, "the header is rendered").not.toBeNull();
    expect(Math.round(box!.x), "the header starts at the left edge").toBe(0);
    expect(
      Math.round(box!.width),
      "the header is never wider than the window",
    ).toBeLessThanOrEqual(width);

    const controls = await headerControls(page);
    const count = await controls.count();
    expect(count, "the header offers at least a logo and one action").toBeGreaterThan(1);

    for (let i = 0; i < count; i += 1) {
      const control = controls.nth(i);
      const rect = await control.boundingBox();
      if (!rect) continue;
      const label = (await control.getAttribute("aria-label")) ?? (await control.innerText());
      expect(rect.x, `"${label.trim()}" starts inside the viewport`).toBeGreaterThanOrEqual(-1);
      expect(
        rect.x + rect.width,
        `"${label.trim()}" ends inside the viewport`,
      ).toBeLessThanOrEqual(width + 1);
    }
  });

  test("the primary call to action is reachable from the header", async ({ page }) => {
    await page.goto("/");

    /* Whichever layout is in play, a visitor must be able to start an account
       from the top of the page without hunting. */
    const header = page.locator("header").first();
    const cta = header.getByRole("link", { name: /get started/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/get-started/);
  });

  test("the landing page never scrolls sideways", async ({ page }) => {
    await page.goto("/");
    /* Reveal animations are `whileInView`, so the page has to be walked before
       its full width is known. */
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo({ top: y, behavior: "instant" });
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    });

    const scrolled = await page.evaluate(() => {
      window.scrollTo({ left: 500, behavior: "instant" });
      const x = window.scrollX;
      window.scrollTo({ left: 0, behavior: "instant" });
      return x;
    });
    expect(scrolled, "the page cannot be dragged to the right").toBe(0);
  });

  test("the mobile menu opens, navigates, and closes", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", { name: /open menu/i });
    /* Desktop hides the toggle entirely — nothing to test there. */
    test.skip(!(await toggle.isVisible()), "the wide layout has no menu sheet");

    await toggle.click();
    const sheet = page.locator("#mobile-menu");
    await expect(sheet).toBeVisible();
    await expect(page.getByRole("button", { name: /close menu/i })).toBeVisible();

    /* The sheet is the only navigation a phone gets, so it has to carry the
       product surfaces and not just the account links. */
    await expect(sheet.getByRole("link", { name: "Pricing" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: /ask/i }).first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    /* Escape must also give the page back — the sheet locks body scroll while
       it is open, and a lock that outlives it strands the visitor.
       `behavior: "instant"` on purpose: the site sets `scroll-behavior:
       smooth`, and a smooth scroll is still animating when the assertion reads
       `scrollY` — which looks exactly like a stuck scroll lock. */
    const canScroll = await page.evaluate(async () => {
      window.scrollTo({ top: 400, behavior: "instant" });
      await new Promise((resolve) => setTimeout(resolve, 200));
      const y = window.scrollY;
      window.scrollTo({ top: 0, behavior: "instant" });
      return y > 0;
    });
    expect(canScroll, "closing the sheet releases the scroll lock").toBe(true);
  });

  test("every in-page anchor the landing page links to exists", async ({ page }) => {
    await page.goto("/");

    const targets = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href") ?? "")
        .filter((href) => href.startsWith("#") || href.startsWith("/#"))
        .map((href) => href.slice(href.indexOf("#") + 1))
        .filter((id, index, all) => id.length > 0 && all.indexOf(id) === index),
    );

    expect(targets.length, "the page uses in-page navigation").toBeGreaterThan(0);
    for (const id of targets) {
      await expect(page.locator(`#${id}`), `#${id} is a real section`).toHaveCount(1);
    }
  });

  test("the hero demo answers with a plan, without an account", async ({ page }) => {
    await page.goto("/");

    /* The demo is the page's central claim: a visitor drives the product
       before being asked to believe anything. If it renders nothing, the
       hero is a screenshot with buttons on it. */
    const demo = page.locator("#demo");
    await expect(demo).toBeVisible();
    await expect(demo.getByText(/€/).first()).toBeVisible({ timeout: 15_000 });

    /* Seeded marketing data must say so rather than pass as a live reading. */
    await expect(demo.getByText(/sample/i).first()).toBeVisible();

    /* The three actions under a plan are real destinations, not dead buttons. */
    for (const name of [/save plan/i, /share/i]) {
      const action = demo.getByRole("link", { name }).first();
      await expect(action).toBeVisible();
      await expect(action).toHaveAttribute("href", /\/get-started/);
    }
  });

  test("the public routes the landing page advertises all render", async ({ page }) => {
    for (const route of [
      "/",
      "/pricing",
      "/students",
      "/city/madrid",
      "/city/madrid/free-events",
      "/city/madrid/cheap-food",
      "/city/madrid/student-deals",
      "/city/madrid/starter-pack",
      "/city/madrid/things-to-do",
    ]) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} responds`).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    }
  });
});
