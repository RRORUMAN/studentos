import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { settleBucket } from "../../src/domain/social.ts";
import type { BudgetEnvelope, RecurringExpense, Transaction } from "../../src/domain/types.ts";
import {
  detectSubscriptions,
  groupTransactionsByDay,
  nextDueDate,
  parseAmount,
  parseAmountCents,
  parseTripCategory,
  readBudget,
  settleUpTransfers,
  spendTrajectory,
  subscriptionsReading,
  forecast,
  tripCategory,
  weeklyBars,
} from "../../src/server/engines/budget.ts";

/**
 * ============================================================================
 * BUDGET — TRIPS, SUBSCRIPTIONS, CHARTS AND SETTLE-UP
 * ----------------------------------------------------------------------------
 * The behaviours added with the redesign, pinned at the level where being
 * silently wrong would be worst: money reserved for a trip must not be offered
 * as spendable, a detected subscription must not be invented from a single
 * coincidence, and a settle-up must come to exactly zero.
 * ============================================================================
 */

const MONTH = "2026-09";
const NOW = new Date("2026-09-10T12:00:00Z"); // a Thursday

function envelope(category: string, planned: number, custom = false): BudgetEnvelope {
  return { id: `${category}-env`, userId: "u1", month: MONTH, category, plannedCents: planned, custom };
}

function tx(category: string, cents: number, day = 5, month = "09", merchant: string | null = null): Transaction {
  const at = `2026-${month}-${String(day).padStart(2, "0")}T12:00:00Z`;
  return {
    id: `${category}-${cents}-${month}-${day}`,
    userId: "u1",
    category,
    amountCents: cents,
    merchant,
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

describe("parseAmount", () => {
  it("takes a comma or a dot, and nothing else", () => {
    assert.equal(parseAmount("12"), 12);
    assert.equal(parseAmount("12.50"), 12.5);
    assert.equal(parseAmount("12,50"), 12.5);
    assert.equal(parseAmount(" 12,50 "), 12.5);
    assert.equal(parseAmountCents("12,50"), 1_250);
  });

  it("refuses anything that is not a positive amount", () => {
    for (const input of ["", "0", "-4", "abc", "12.345", "1,2,3", null, undefined]) {
      assert.equal(parseAmount(input), null, `"${String(input)}" must not parse`);
    }
  });
});

/* -------------------------------------------------------------------------- */

describe("trip envelopes", () => {
  const category = tripCategory({ name: "Barcelona", start: "2026-09-25", end: "2026-09-28" });

  it("round-trips a name and its dates through the category key", () => {
    const parsed = parseTripCategory(category);
    assert.equal(parsed?.name, "Barcelona");
    assert.equal(parsed?.start, "2026-09-25");
    assert.equal(parsed?.end, "2026-09-28");
  });

  it("holds an upcoming trip out of safe-to-spend", () => {
    const withTrip = readBudget({
      now: NOW,
      envelopes: [envelope("groceries", 20_000), envelope(category, 18_000, true)],
      transactions: [],
      recurring: [],
    });
    const without = readBudget({
      now: NOW,
      envelopes: [envelope("groceries", 20_000)],
      transactions: [],
      recurring: [],
    });

    assert.equal(withTrip.reservedCents, 18_000);
    /* The whole point: adding money for a trip must not make today look
       richer. Available is the same as if the trip money were not there. */
    assert.equal(withTrip.availableCents, without.availableCents);
    assert.equal(withTrip.safeTodayCents, without.safeTodayCents);
  });

  it("releases the money once the trip has started", () => {
    const during = readBudget({
      now: new Date("2026-09-26T12:00:00Z"),
      envelopes: [envelope("groceries", 20_000), envelope(category, 18_000, true)],
      transactions: [],
      recurring: [],
    });

    assert.equal(during.reservedCents, 0);
    assert.equal(during.trips[0]?.status, "active");
  });

  it("keeps trips out of the category list and out of pace", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("groceries", 20_000), envelope(category, 18_000, true)],
      transactions: [tx("groceries", 5_000)],
      recurring: [],
    });

    assert.ok(!reading.categories.some((row) => row.category.startsWith("travel:")));
    assert.equal(reading.trips.length, 1);
    /* Paced against the €200 of real envelopes, not the €380 including a
       weekend away that is spent in one burst. */
    assert.equal(reading.pacedCents, Math.round((20_000 * 10) / 30));
  });
});

/* -------------------------------------------------------------------------- */

describe("pace sign", () => {
  it("is positive when spending is ahead of an even pace", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("nightlife", 30_000)],
      transactions: [tx("nightlife", 20_000)],
      recurring: [],
    });

    /* 10 days into a 30-day month, an even pace is 10,000. The documented
       convention is `spent − paced`, so 20,000 spent is +10,000 and over. */
    assert.equal(reading.pacedCents, 10_000);
    assert.equal(reading.paceDeltaCents, 10_000);
    assert.equal(reading.overPace, true);
    assert.equal(reading.categories[0].paceDeltaCents, 10_000);
  });

  it("is negative when spending is under it", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("groceries", 30_000)],
      transactions: [tx("groceries", 2_000)],
      recurring: [],
    });

    assert.ok(reading.paceDeltaCents < 0);
    assert.equal(reading.overPace, false);
  });
});

/* -------------------------------------------------------------------------- */

describe("subscriptions", () => {
  it("finds the next due date without stepping into a month that is too short", () => {
    const due = nextDueDate({ cadence: "monthly", dayOfPeriod: 31 }, new Date("2026-01-31T12:00:00Z"));
    assert.equal(due?.toISOString().slice(0, 10), "2026-01-31");

    /* A charge on the 31st, asked about on the 1st of February. */
    const february = nextDueDate({ cadence: "monthly", dayOfPeriod: 31 }, new Date("2026-02-01T12:00:00Z"));
    assert.equal(february?.toISOString().slice(0, 10), "2026-02-28");
  });

  it("compares a weekly and a monthly charge on the same monthly footing", () => {
    const reading = subscriptionsReading({
      now: NOW,
      recurring: [recurring("subscriptions", 1_000, 4, "weekly"), recurring("housing", 40_000, 28)],
      transactions: [],
    });

    const weekly = reading.rows.find((row) => row.cadence === "weekly");
    assert.equal(weekly?.monthlyCents, Math.round((1_000 * 52) / 12));
    assert.equal(reading.monthlyTotalCents, Math.round((1_000 * 52) / 12) + 40_000);
  });

  it("marks a charge that has already landed this month", () => {
    const reading = subscriptionsReading({
      now: NOW,
      recurring: [recurring("fitness", 4_000, 28)],
      transactions: [tx("fitness", 4_050, 2)],
    });

    assert.equal(reading.rows[0].paidThisMonth, true);
    assert.equal(reading.stillToComeCents, 0);
  });
});

describe("detectSubscriptions", () => {
  it("needs two consecutive months before it will call something recurring", () => {
    const once = detectSubscriptions({
      now: NOW,
      recurring: [],
      transactions: [tx("subscriptions", 999, 4, "09", "Streamy")],
    });
    assert.equal(once.length, 0, "one charge is a purchase, not a subscription");

    const twice = detectSubscriptions({
      now: NOW,
      recurring: [],
      transactions: [tx("subscriptions", 999, 4, "08", "Streamy"), tx("subscriptions", 999, 4, "09", "Streamy")],
    });
    assert.equal(twice.length, 1);
    assert.equal(twice[0].amountCents, 999);
    assert.equal(twice[0].label, "Streamy");
    assert.equal(twice[0].dayOfMonth, 4);
  });

  it("tolerates a small price change but not a different charge", () => {
    const nudged = detectSubscriptions({
      now: NOW,
      recurring: [],
      transactions: [tx("subscriptions", 1_000, 4, "08"), tx("subscriptions", 1_100, 4, "09")],
    });
    assert.equal(nudged.length, 1, "a 10% price rise is the same subscription");

    const unrelated = detectSubscriptions({
      now: NOW,
      recurring: [],
      transactions: [tx("shopping", 1_000, 4, "08"), tx("shopping", 8_000, 4, "09")],
    });
    assert.equal(unrelated.length, 0);
  });

  it("says nothing about a charge the student has already told it about", () => {
    const found = detectSubscriptions({
      now: NOW,
      recurring: [recurring("subscriptions", 1_000, 4)],
      transactions: [tx("subscriptions", 999, 4, "08"), tx("subscriptions", 999, 4, "09")],
    });
    assert.equal(found.length, 0);
  });

  it("ignores a run that stopped months ago", () => {
    const found = detectSubscriptions({
      now: NOW,
      recurring: [],
      transactions: [tx("subscriptions", 999, 4, "05"), tx("subscriptions", 999, 4, "06")],
    });
    assert.equal(found.length, 0, "a cancelled subscription is not a suggestion");
  });
});

/* -------------------------------------------------------------------------- */

describe("charts", () => {
  it("groups history by day, newest first, with a real daily total", () => {
    const groups = groupTransactionsByDay([
      tx("groceries", 1_000, 9),
      tx("eating-out", 2_500, 10),
      tx("nightlife", 4_000, 10),
    ]);

    assert.equal(groups[0].day, "2026-09-10");
    assert.equal(groups[0].totalCents, 6_500);
    assert.equal(groups[1].totalCents, 1_000);
  });

  it("draws a week bar for every week asked for, this week last", () => {
    const bars = weeklyBars({ now: NOW, transactions: [tx("groceries", 3_000, 8)], targetCents: 7_000, weeks: 4 });

    assert.equal(bars.length, 4);
    assert.equal(bars[3].current, true);
    assert.equal(bars[3].spentCents, 3_000);
    assert.equal(bars[0].spentCents, 0);
  });

  it("projects the same total the forecast card prints", () => {
    const reading = readBudget({
      now: NOW,
      envelopes: [envelope("groceries", 30_000)],
      transactions: [tx("groceries", 10_000, 5)],
      recurring: [recurring("fitness", 4_000, 28)],
    });
    const projection = forecast(reading, NOW);
    const trajectory = spendTrajectory({ now: NOW, transactions: [tx("groceries", 10_000, 5)], reading, forecast: projection });

    assert.equal(trajectory.actual.length, 10, "one point per elapsed day");
    assert.equal(trajectory.projected.length, 30, "the line runs to month end");
    /* The picture and the number must never disagree. */
    assert.equal(trajectory.projected[trajectory.projected.length - 1], projection.projectedCents);
  });
});

/* -------------------------------------------------------------------------- */

describe("settleUpTransfers", () => {
  const entry = (id: string, paidBy: string, cents: number) => ({
    id,
    bucketId: "b1",
    userId: paidBy,
    label: id,
    amountCents: cents,
    paidBy,
    createdAt: "2026-09-10T12:00:00Z",
  });

  it("turns positions into payments that clear the bucket exactly", () => {
    const { settlements } = settleBucket([entry("shop", "a", 4_820), entry("milk", "b", 760)], ["a", "b", "c"]);
    const transfers = settleUpTransfers(settlements);

    /* Everyone who owes pays, nobody overpays, and the payments net to zero. */
    const net = new Map<string, number>();
    for (const transfer of transfers) {
      net.set(transfer.from, (net.get(transfer.from) ?? 0) - transfer.amountCents);
      net.set(transfer.to, (net.get(transfer.to) ?? 0) + transfer.amountCents);
    }
    for (const settlement of settlements) {
      assert.equal(net.get(settlement.userId) ?? 0, settlement.netCents, `${settlement.userId} must come out square`);
    }
    assert.equal(
      transfers.reduce((sum, transfer) => sum + transfer.amountCents, 0) > 0,
      true,
    );
  });

  it("asks for nothing when everyone already paid their share", () => {
    const { settlements } = settleBucket([entry("a", "a", 1_000), entry("b", "b", 1_000)], ["a", "b"]);
    assert.deepEqual(settleUpTransfers(settlements), []);
  });

  it("never asks anyone to pay someone who is not owed", () => {
    const { settlements } = settleBucket([entry("taxi", "a", 1_500)], ["a", "b", "c"]);
    const transfers = settleUpTransfers(settlements);

    assert.ok(transfers.every((transfer) => transfer.to === "a"));
    assert.equal(transfers.reduce((sum, transfer) => sum + transfer.amountCents, 0), 1_000);
  });
});
