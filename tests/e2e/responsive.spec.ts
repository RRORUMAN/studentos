import { expect, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

/**
 * ============================================================================
 * RESPONSIVE
 * ----------------------------------------------------------------------------
 * That the authenticated product fits the screens it is actually used on.
 *
 * The widths are real devices rather than round numbers: 375 is the iPhone SE
 * and the 13 mini and is the narrowest screen worth supporting; 390 is the
 * 12/13/14 and is the single commonest phone; 430 is the Pro Max; 768 is an
 * iPad in portrait, which is where a layout built for phones and desktops
 * tends to fall between two stools. 1024 and 1440 are there to catch the
 * opposite mistake.
 *
 * WHAT IS ASSERTED, AND WHY IT IS THIS. A sideways scroll is the one layout
 * bug that is both universally wrong and cheaply detectable: no screen in this
 * product is meant to pan horizontally, and a single over-wide element causes
 * it. Measuring `scrollWidth > clientWidth` produces false alarms on the
 * horizontal rails, which overflow ON PURPOSE inside their own scroller. So
 * the test does what a thumb does -- tries to drag the page right, and checks
 * that it did not move.
 *
 * Run on the mobile project only. The viewport is set explicitly here, so
 * running the same 36 page loads again under the desktop profile would prove
 * nothing and cost two minutes.
 * ============================================================================
 */

const WIDTHS = [
  { width: 375, height: 812, name: "iPhone SE / 13 mini" },
  { width: 390, height: 844, name: "iPhone 12-14" },
  { width: 430, height: 932, name: "iPhone Pro Max" },
  { width: 768, height: 1024, name: "iPad portrait" },
  { width: 1024, height: 768, name: "small laptop" },
  { width: 1440, height: 900, name: "desktop" },
] as const;

/** The screens a student is on every day, plus the two densest ones. */
const ROUTES = ["/home", "/discover", "/budget", "/lifeops", "/pulse", "/events", "/you"] as const;

test.describe("every screen fits the screen", () => {
  /* `test.info()` rather than a second callback argument: the condition body
     is handed the fixtures only. */
  test.skip(
    () => test.info().project.name === "desktop",
    "viewports are set explicitly; the second project would repeat the same work",
  );

  test("no screen can be dragged sideways, at any width", async ({ page }) => {
    test.slow();
    await signUpAndOnboard(page);

    const failures: string[] = [];

    for (const size of WIDTHS) {
      await page.setViewportSize({ width: size.width, height: size.height });

      for (const route of ROUTES) {
        await page.goto(route);
        /* Give the route its first paint. Explore in particular renders a map
           and a rail once the provider answers, and both are prime suspects
           for an over-wide child. */
        await page.getByRole("main").waitFor({ state: "visible" });

        const scrolled = await page.evaluate(() => {
          window.scrollTo({ left: 500, behavior: "instant" });
          const x = window.scrollX;
          window.scrollTo({ left: 0, behavior: "instant" });
          return x;
        });

        if (scrolled !== 0) failures.push(`${route} at ${size.width}px (${size.name})`);
      }
    }

    /* Collected rather than asserted in the loop, so one run names every
       broken combination instead of stopping at the first. */
    expect(failures, `these screens scroll sideways:\n${failures.join("\n")}`).toEqual([]);
  });

  test("the bottom bar is reachable by thumb and clears the safe area", async ({ page }) => {
    await signUpAndOnboard(page);

    for (const size of WIDTHS.filter((row) => row.width < 1024)) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/home");

      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(nav).toBeVisible();

      const links = nav.getByRole("link");
      const count = await links.count();
      expect(count, `the bar should hold five destinations at ${size.width}px`).toBe(5);

      for (let index = 0; index < count; index += 1) {
        const box = await links.nth(index).boundingBox();
        expect(box, `nav item ${index} has no box at ${size.width}px`).not.toBeNull();
        if (!box) continue;

        /* 44px is the smallest target a finger hits reliably, and it is the
           number both Apple and WCAG land on. A bar that fails this is not a
           cosmetic problem: it is the primary navigation. */
        expect(
          box.height,
          `nav item ${index} is ${Math.round(box.height)}px tall at ${size.width}px`,
        ).toBeGreaterThanOrEqual(44);

        /* And entirely on screen. A five-item bar that overflows loses You. */
        expect(box.x, `nav item ${index} starts off-screen at ${size.width}px`).toBeGreaterThanOrEqual(0);
        expect(
          box.x + box.width,
          `nav item ${index} runs past the right edge at ${size.width}px`,
        ).toBeLessThanOrEqual(size.width + 1);
      }
    }
  });

  test("the bar never covers the end of the page", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/home");

    /**
     * MEASURED AS RESERVED SPACE, NOT AS A GAP. The obvious version of this
     * test -- scroll to the bottom and check `nav.top >= main.bottom` -- can
     * never pass, and that is a property of the fix rather than of the bug:
     * the clearance IS bottom padding on `main`, so `main`'s border box always
     * extends under the bar by exactly the amount that makes the layout
     * correct. Measuring the gap measures the padding and calls it an overlap.
     *
     * The real invariant is that the reserved strip is at least as tall as the
     * thing it is reserving for, which is what a student experiences as "I can
     * read the last card".
     */
    const measured = await page.evaluate(() => {
      const main = document.querySelector("main");
      const nav = document.querySelector("nav[aria-label='Main']");
      if (!main || !nav) return null;
      return {
        padding: Number.parseFloat(getComputedStyle(main).paddingBottom),
        bar: nav.getBoundingClientRect().height,
      };
    });

    expect(measured, "Home should have a main and a bottom bar").not.toBeNull();
    if (!measured) return;

    expect(
      measured.padding,
      `main reserves ${Math.round(measured.padding)}px for a ${Math.round(measured.bar)}px bar`,
    ).toBeGreaterThanOrEqual(measured.bar);
  });
});
