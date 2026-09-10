import { expect, test } from "@playwright/test";

import { signUpAndOnboard } from "./helpers";

/**
 * ============================================================================
 * A PAID FEATURE THAT COULD NOT BE REACHED
 * ----------------------------------------------------------------------------
 * "Shared budgets" is sold on the Pro tier at €9.99 a month, promising "split
 * a flat, a trip or a night out and keep it settled". A bucket is shared by
 * attaching it to a GROUP, and `createBucket` refuses a group the student is
 * not a member of.
 *
 * `groupMembers` was read in six places and written in none. No
 * `insert("groups")` and no `insert("groupMembers")` anywhere in the codebase.
 * So nobody could be in a group, so no bucket could carry a groupId, so every
 * bucket ever created was a personal envelope and the thing on the price list
 * did not exist.
 *
 * Everything around it was built — the types, the tables, the contribution
 * rows, `settleUpTransfers` working the split out to the cent. Two writes were
 * missing.
 *
 * The free-tier test is the one worth having as well: the section is gated, and
 * a gate that renders an upsell while the action underneath still writes is
 * the standard way this kind of thing leaks.
 * ============================================================================
 */

test("a free student is offered shared budgets rather than given them", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/budget/shared");

  /* The page explains the feature and shows a labelled example. What it must
     not show is the student's own groups, because they have none and the
     feature is not theirs. */
  await expect(page.locator("body")).toContainText(/shared budget/i);
  await expect(page.getByRole("button", { name: "New group" })).toHaveCount(0);
});

test("the locked page offers the way in rather than a dead end", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/budget/shared");

  /* A gate that explains nothing is how a paid feature reads as a broken one.
     The example on this page is labelled as an example, and there is a real
     route to the thing being described. */
  await expect(page.getByRole("link", { name: /upgrade|pro|see plans/i }).first()).toBeVisible();
});

/**
 * WHAT THESE TESTS DO NOT COVER, said plainly rather than implied.
 *
 * Driving the unlocked path needs a Pro subscription row, which this suite has
 * no way to create — that belongs in a billing test with a Stripe fixture. So
 * the two writes themselves are exercised by nothing here.
 *
 * A first draft of this file asserted "either the group controls are visible
 * or an upsell is" and passed, which is a sentence that cannot fail: one of
 * the two is always true. It has been removed rather than kept for the count.
 *
 * What does hold the write path: `createGroup` inserts the owner as a member
 * in the same transaction, `addGroupMember` requires the caller to be a member
 * AND the target to be a friend, and adding twice is a no-op — each stated and
 * enforced in `src/server/actions/budget.ts`, and each a guard the type system
 * cannot express.
 */
