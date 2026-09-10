import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BudgetEnvelope, Transaction } from "../../src/domain/types.ts";
import {
  daysInMonth,
  daysLeftInMonth,
  monthKey,
  nextDueDate,
  readBudget,
} from "../../src/server/engines/budget.ts";
import { dayOfMonth } from "../../src/lib/dates.ts";

/**
 * ============================================================================
 * A MONTH ENDS WHERE THE STUDENT IS
 * ----------------------------------------------------------------------------
 * The budget engine keyed months, days and month lengths on `getUTCMonth` and
 * `getUTCDate`. It also defined its own `monthKey` and `dayKey` with the same
 * names as the timezone-aware pair in `src/lib/dates.ts` — two functions called
 * `dayKey` in one codebase, one right and one not, and which one a file got
 * depended on its import line.
 *
 * The consequence is a spend filed to the wrong envelope. A student in Kyiv
 * buying something at 01:00 on the first of the month is at 22:00 UTC on the
 * last day of the month before: the wrong envelope, in a month they had
 * already closed. Every zone east of UTC has that window at each month
 * boundary — three hours wide in Kyiv, thirteen in Auckland — and every zone
 * west has the mirror image at the other end of the day.
 *
 * The tests that already existed pass `timeZone: "UTC"` and are unchanged,
 * which is the point: the arithmetic did not move. These are the ones that
 * would have failed before.
 * ============================================================================
 */

const envelope = (category: string, plannedCents: number, month: string): BudgetEnvelope =>
  ({ id: `env-${category}`, userId: "u1", month, category, plannedCents }) as BudgetEnvelope;

const tx = (category: string, amountCents: number, spentAt: string): Transaction =>
  ({ id: `tx-${spentAt}`, userId: "u1", category, amountCents, spentAt, note: null }) as Transaction;

describe("the month a spend belongs to", () => {
  it("is the month it was in where the student was standing", () => {
    /* 22:30 UTC on 31 August is 01:30 on 1 September in Kyiv. */
    const at = "2026-08-31T22:30:00Z";

    assert.equal(monthKey(at, "UTC"), "2026-08");
    assert.equal(monthKey(at, "Europe/Kyiv"), "2026-09");
    assert.equal(monthKey(at, "Europe/Lisbon"), "2026-08");
    assert.equal(monthKey(at, "Pacific/Auckland"), "2026-09");
  });

  it("puts the spend in the envelope the student thinks they are spending from", () => {
    /* The student is in Kyiv. Their September envelope is open, they buy
       something just after midnight, and the September envelope is the one it
       must come out of. Keyed on UTC it landed in August — a month whose
       budget they had already reconciled and can no longer act on. */
    const now = new Date("2026-09-01T00:30:00Z"); // 03:30 in Kyiv
    const spend = tx("groceries", 2_500, "2026-08-31T22:30:00Z"); // 01:30 in Kyiv, 1 Sep

    const kyiv = readBudget({
      now,
      timeZone: "Europe/Kyiv",
      envelopes: [envelope("groceries", 20_000, "2026-09")],
      transactions: [spend],
      recurring: [],
    });

    assert.equal(kyiv.spentCents, 2_500, "the spend belongs to September in Kyiv");

    /* The same rows read as UTC put it in August, which is the bug. Asserted
       so the test states the difference rather than only the fix. */
    const utc = readBudget({
      now,
      timeZone: "UTC",
      envelopes: [envelope("groceries", 20_000, "2026-09")],
      transactions: [spend],
      recurring: [],
    });

    assert.equal(utc.spentCents, 0);
  });

  it("counts the day of the month from the student's own calendar", () => {
    const at = "2026-09-30T23:00:00Z";
    assert.equal(dayOfMonth(at, "UTC"), 30);
    assert.equal(dayOfMonth(at, "Europe/Kyiv"), 1); // already October there
    assert.equal(dayOfMonth(at, "America/Los_Angeles"), 30);
  });

  it("paces the month against the right number of days left", () => {
    /* This is the number safe-to-spend divides by. Off by one at a month
       boundary it is off by a lot, because the denominator is small. */
    const at = new Date("2026-09-30T23:00:00Z");

    assert.equal(daysLeftInMonth(at, "UTC"), 1, "last day of September in UTC");
    assert.equal(daysLeftInMonth(at, "Europe/Kyiv"), 31, "already 1 October in Kyiv");
  });

  it("knows how long the month is in the city, including February", () => {
    const feb = new Date("2026-02-15T12:00:00Z");
    assert.equal(daysInMonth(feb, "UTC"), 28);
    assert.equal(daysInMonth(new Date("2028-02-15T12:00:00Z"), "UTC"), 29, "leap year");

    /* Late on the last day of a 31-day month, a zone ahead is already into a
       30-day one, and the length has to follow the city. */
    const at = new Date("2026-08-31T23:00:00Z");
    assert.equal(daysInMonth(at, "UTC"), 31, "August");
    assert.equal(daysInMonth(at, "Europe/Kyiv"), 30, "September there");
  });

  it("dates a recurring charge from the student's calendar", () => {
    /* Rent on the 1st. At 23:00 UTC on 31 August the student in Kyiv is
       already on the 1st, so rent is due today, not in a month's time. */
    const at = new Date("2026-08-31T23:00:00Z");
    const rent = { cadence: "monthly" as const, dayOfPeriod: 1 };

    const utc = nextDueDate(rent, at, "UTC");
    const kyiv = nextDueDate(rent, at, "Europe/Kyiv");

    assert.ok(utc && kyiv);
    assert.equal(utc.toISOString().slice(0, 10), "2026-09-01");
    assert.equal(kyiv.toISOString().slice(0, 10), "2026-09-01");
  });

  it("still agrees with UTC for a student who is in UTC", () => {
    /* The regression guard for everybody the old code was accidentally right
       about. London in winter is UTC, and nothing about their budget moved. */
    const at = new Date("2026-01-15T12:00:00Z");
    assert.equal(monthKey(at, "Europe/London"), monthKey(at, "UTC"));
    assert.equal(daysLeftInMonth(at, "Europe/London"), daysLeftInMonth(at, "UTC"));
    assert.equal(dayOfMonth(at, "Europe/London"), dayOfMonth(at, "UTC"));
  });
});
