import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BudgetEnvelope, RecurringExpense, Transaction } from "../../src/domain/types.ts";
import {
  budgetInsight,
  committedRemaining,
  daysLeftInMonth,
  forecast,
  monthKey,
  readBudget,
  safeUntil,
  suggestEnvelopes,
  weeklyTarget,
} from "../../src/server/engines/budget.ts";

/**
 * ============================================================================
 * BUDGET ENGINE
 * ----------------------------------------------------------------------------
 * The most load-bearing arithmetic in the product: a student decides whether to
 * go out based on `safeTodayCents`. These tests pin the behaviours that would
 * be *silently* wrong rather than obviously broken — a budget that is off by a
 * plausible amount is far more damaging than one that crashes.
 *
 * Run with Node's own test runner and native type stripping: the engines are
 * pure and cross-import only types, so they need no bundler, no transform step
 * and no test framework to execute.
 * ============================================================================
 */

const MONTH = "2026-09";
/* Mid-month, so days-elapsed and days-remaining are both non-trivial. */
const NOW = new Date("2026-09-10T12:00:00Z");

function envelope(category: string, planned: number): BudgetEnvelope {
  return { id: `${category}-env`, userId: "u1", month: MONTH, category, plannedCents: planned, custom: false };
}

function tx(category: string, cents: number, day = 5): Transaction {
  const at = `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`;
  return {
    id: `${category}-${cents}-${day}`,
    userId: "u1",
    category,
    amountCents: cents,
    merchant: null,
    note: null,
    spentAt: at,
    source: "manual",
    receiptId: null,
    createdAt: at,
  };
}

function recurring(
  category: string,
  cents: number,
  dayOfPeriod: number,
  cadence: RecurringExpense["cadence"] = "monthly",
): RecurringExpense {
  return {
    id: `${category}-rec`,
    userId: "u1",
    label: category,
    category,
    amountCents: cents,
    cadence,
    dayOfPeriod,
    active: true,
    createdAt: "2026-09-01T00:00:00Z",
  };
}

/* -------------------------------------------------------------------------- */

describe("month helpers", () => {
  it("formats the month key", () => {
    assert.equal(monthKey(NOW), "2026-09");
    assert.equal(monthKey(new Date("2026-01-01T00:00:00Z")), "2026-01");
  });

  it("counts today as a day that still has spending left in it", () => {
    /* September has 30 days; on the 10th, 21 days remain including today.
       Excluding today would understate safe-to-spend for the whole day. */
    assert.equal(daysLeftInMonth(NOW), 21);
  });
});

describe("suggestEnvelopes", () => {
  it("sums to exactly the total despite per-category rounding", () => {
    for (const total of [80_000, 76_012, 33_333, 100_001]) {
      const rows = suggestEnvelopes(total);
      assert.equal(
        rows.reduce((acc, row) => acc + row.plannedCents, 0),
        total,
        `envelopes must sum to ${total}`,
      );
    }
  });

  it("redistributes housing rather than leaving the budget short", () => {
    const rows = suggestEnvelopes(80_000, { excludeHousing: true });
    assert.ok(!rows.some((row) => row.category === "housing"));
    /* Without redistribution this sums to ~60% of the total and every category
       looks permanently under-funded. */
    assert.equal(rows.reduce((acc, row) => acc + row.plannedCents, 0), 80_000);
  });
});

describe("readBudget", () => {
  it("subtracts committed recurring charges from available money", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("housing", 40_000), envelope("groceries", 20_000)],
      transactions: [tx("groceries", 5_000)],
      recurring: [recurring("housing", 34_000, 28)], // rent, not yet paid
    });

    assert.equal(reading.plannedCents, 60_000);
    assert.equal(reading.spentCents, 5_000);
    assert.equal(reading.remainingCents, 55_000);
    assert.equal(reading.committedCents, 34_000);
    /* The whole point: available is remaining minus what rent will take. */
    assert.equal(reading.availableCents, 21_000);
  });

  it("never promises money a pending charge will take", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("housing", 40_000)],
      transactions: [],
      recurring: [recurring("housing", 38_000, 28)],
    });

    const naive = Math.floor(reading.remainingCents / reading.daysLeft);
    assert.ok(
      reading.safeTodayCents < naive,
      "safe-to-spend must be below the naive remaining/days figure",
    );
  });

  it("floors safe-to-spend at zero rather than going negative", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("groceries", 10_000)],
      transactions: [tx("groceries", 30_000)],
      recurring: [],
    });

    assert.ok(reading.remainingCents < 0);
    assert.equal(reading.safeTodayCents, 0);
  });

  it("reports pace per category", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("nightlife", 30_000)],
      transactions: [tx("nightlife", 20_000)], // 10 days in, even pace = 10,000
      recurring: [],
    });

    const nightlife = reading.categories.find((row) => row.category === "nightlife");
    assert.equal(nightlife?.pacedCents, 10_000);
    assert.equal(nightlife?.paceDeltaCents, 10_000);
    assert.equal(reading.overPace, true);
  });
});

describe("committedRemaining", () => {
  it("ignores a charge whose due day has already passed", () => {
    assert.equal(
      committedRemaining({ now: NOW, recurring: [recurring("gym", 4_000, 3)], transactions: [] }),
      0,
    );
  });

  it("does not double-count a charge already paid this month", () => {
    /* Paid at €40.99 against a €40.00 expectation — inside tolerance. */
    assert.equal(
      committedRemaining({
        now: NOW,
        recurring: [recurring("gym", 4_000, 28)],
        transactions: [tx("gym", 4_099, 2)],
      }),
      0,
    );
  });

  it("counts every remaining occurrence of a weekly charge", () => {
    /* 10 September 2026 is a Thursday; remaining Thursdays are 10, 17 and 24. */
    assert.equal(
      committedRemaining({
        now: NOW,
        recurring: [recurring("transport", 1_000, 4, "weekly")],
        transactions: [],
      }),
      3_000,
    );
  });
});

describe("safeUntil", () => {
  it("never promises beyond the end of the month", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("groceries", 21_000)],
      transactions: [],
      recurring: [],
    });

    /* A horizon deep into next month must not borrow from a budget that does
       not exist yet. */
    assert.ok(safeUntil(reading, NOW, new Date("2026-11-30T00:00:00Z")) <= reading.availableCents);
  });
});

describe("forecast", () => {
  it("withholds a projection until there is enough data", () => {
    const early = new Date("2026-09-03T12:00:00Z");
    const reading = readBudget({
      now: early,
      envelopes: [envelope("groceries", 20_000)],
      transactions: [tx("groceries", 9_000, 1)],
      recurring: [],
    });

    assert.equal(forecast(reading, early).confident, false);
  });

  it("projects from the current daily rate plus commitments", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("groceries", 30_000)],
      transactions: [tx("groceries", 10_000, 5)],
      recurring: [recurring("gym", 4_000, 28)],
    });

    const result = forecast(reading, NOW);
    assert.equal(result.confident, true);
    /* €100 over 10 days = €10/day × 30 days = €300, plus the €40 gym. */
    assert.equal(result.projectedCents, 34_000);
  });
});

describe("weeklyTarget", () => {
  it("derives the week from available money, not the raw budget", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("groceries", 42_000)],
      transactions: [],
      recurring: [recurring("groceries", 21_000, 28)],
    });

    /* Available 21,000 over 21 days = 1,000/day, so a week is 7,000. */
    assert.equal(weeklyTarget({ now: NOW, reading, transactions: [] }).targetCents, 7_000);
  });
});

describe("budgetInsight", () => {
  const format = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  it("asks for a budget when none is set", () => {
    const reading = readBudget({ now: NOW, envelopes: [], transactions: [], recurring: [] });
    assert.equal(budgetInsight(reading, format).action?.href, "/budget/setup");
  });

  it("never scolds — it offers the cheaper option", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("nightlife", 30_000)],
      transactions: [tx("nightlife", 25_000)],
      recurring: [],
    });

    const insight = budgetInsight(reading, format);
    assert.equal(insight.tone, "watch");
    assert.match(insight.action?.label.toLowerCase() ?? "", /cheaper/);
    /* The brand voice forbids scolding about money, so the copy must not. */
    assert.doesNotMatch(insight.headline, /too much|overspent|stop|careful/i);
  });

  it("reports being under pace as good news, with a number", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("groceries", 30_000)],
      transactions: [tx("groceries", 2_000)],
      recurring: [],
    });

    const insight = budgetInsight(reading, format);
    assert.equal(insight.tone, "good");
    assert.match(insight.headline, /€/);
  });

  it("never offers the screen you are already on as the next action", () => {
    /* The insight is rendered at the top of /budget. "Open budget" as its
       action was a link to the current page — an action that does nothing is
       worse than no action, because it teaches people the line is decoration. */
    const readings = [
      readBudget({ now: NOW, envelopes: [envelope("groceries", 30_000)], transactions: [tx("groceries", 2_000)], recurring: [] }),
      readBudget({ now: NOW, envelopes: [envelope("nightlife", 30_000)], transactions: [tx("nightlife", 25_000)], recurring: [] }),
      readBudget({
        now: NOW,
        envelopes: [envelope("groceries", 30_000)],
        transactions: [tx("groceries", 20_000)],
        recurring: [recurring("housing", 20_000, 28)],
      }),
      readBudget({ now: NOW, envelopes: [envelope("housing", 30_000)], transactions: [tx("housing", 12_000)], recurring: [] }),
    ];

    for (const reading of readings) {
      const insight = budgetInsight(reading, format);
      assert.notEqual(insight.action?.href, "/budget", `"${insight.headline}" links to the page it is on`);
    }
  });
});
