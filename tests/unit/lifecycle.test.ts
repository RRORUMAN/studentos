import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { daysBetween, resolveStage, stageMeta,
  termsInCity,
} from "../../src/domain/lifecycle.ts";

/**
 * ============================================================================
 * LIFECYCLE
 * ----------------------------------------------------------------------------
 * The stage machine decides what Home leads with, so a wrong answer here shows
 * a student arriving tomorrow a nightlife feed, or shows someone mid-term a
 * pre-arrival checklist.
 *
 * The precedence rules are the part worth pinning: pre-arrival beats leaving
 * (exchange students enter both dates on the same form), and leaving beats the
 * settled stages.
 * ============================================================================
 */

const NOW = new Date("2026-09-10T12:00:00Z");
const iso = (date: string) => new Date(date).toISOString();

describe("daysBetween", () => {
  it("compares at UTC midnight, not by elapsed hours", () => {
    /* 23:00 on the 10th to 01:00 on the 11th is 2 hours but one day. Comparing
       raw instants makes "arriving tomorrow" flip at different local times for
       different students. */
    assert.equal(
      daysBetween(new Date("2026-09-10T23:00:00Z"), new Date("2026-09-11T01:00:00Z")),
      1,
    );
  });

  it("is negative for a past date", () => {
    assert.equal(daysBetween(NOW, new Date("2026-09-08T12:00:00Z")), -2);
  });
});

describe("resolveStage", () => {
  it("puts a future arrival in before-arrival", () => {
    const reading = resolveStage(
      { arrivingOn: iso("2026-09-25"), leavingOn: null, joinedAt: iso("2026-09-01") },
      NOW,
    );
    assert.equal(reading.stage, "before-arrival");
    assert.equal(reading.daysUntilArrival, 15);
    assert.equal(reading.daysSinceArrival, null);
  });

  it("keeps a not-yet-arrived student out of Leaving Mode", () => {
    /* Exchange students enter both dates on the same university form, so this
       combination is common rather than exotic. */
    const reading = resolveStage(
      { arrivingOn: iso("2026-09-20"), leavingOn: iso("2026-10-01"), joinedAt: iso("2026-09-01") },
      NOW,
    );
    assert.equal(reading.stage, "before-arrival");
  });

  it("walks through the settling stages", () => {
    const cases: [string, string][] = [
      ["2026-09-10", "first-24h"],
      ["2026-09-09", "first-24h"],
      ["2026-09-06", "first-week"],
      ["2026-09-01", "first-month"],
      ["2026-07-01", "established"],
    ];

    for (const [arrival, expected] of cases) {
      const reading = resolveStage(
        { arrivingOn: iso(arrival), leavingOn: null, joinedAt: iso(arrival) },
        NOW,
      );
      assert.equal(reading.stage, expected, `arrived ${arrival} should be ${expected}`);
    }
  });

  it("switches to leaving inside the departure window", () => {
    const reading = resolveStage(
      { arrivingOn: iso("2026-02-01"), leavingOn: iso("2026-10-01"), joinedAt: iso("2026-02-01") },
      NOW,
    );
    assert.equal(reading.stage, "leaving");
    assert.equal(reading.daysUntilDeparture, 21);
  });

  it("stays established when departure is beyond the window", () => {
    const reading = resolveStage(
      { arrivingOn: iso("2026-02-01"), leavingOn: iso("2027-06-01"), joinedAt: iso("2026-02-01") },
      NOW,
    );
    assert.equal(reading.stage, "established");
  });

  it("falls back to the join date when no arrival was given", () => {
    /* The common case of a student who already lives in the city and never set
       a move date: they get the first-week treatment, then settle. */
    const reading = resolveStage(
      { arrivingOn: null, leavingOn: null, joinedAt: iso("2026-09-08") },
      NOW,
    );
    assert.equal(reading.stage, "first-week");
  });
});

describe("stageMeta", () => {
  it("gives every stage a hero block", () => {
    for (const [stage, meta] of Object.entries(stageMeta)) {
      assert.ok(meta.blocks.length > 0, `${stage} must render something`);
      assert.ok(meta.summary.length > 0, `${stage} must have a summary`);
    }
  });

  it("leads pre-arrival with the countdown, not with tonight", () => {
    assert.equal(stageMeta["before-arrival"].blocks[0], "countdown");
    assert.ok(!stageMeta["before-arrival"].blocks.includes("free-today"));
  });

  it("leads a settled student with money", () => {
    assert.equal(stageMeta.established.blocks[0], "money");
  });

  it("leads a leaving student with the leaving list", () => {
    assert.equal(stageMeta.leaving.blocks[0], "leaving-tasks");
  });
});

/**
 * ============================================================================
 * TENURE
 * ----------------------------------------------------------------------------
 * "3 terms here" beside a student's name is a credibility signal, so it has to
 * be true.
 *
 * It was not. `Profile.termsInCity` was the literal 1, written at the end of
 * onboarding, reset to 1 on any city change, and incremented by nothing ever.
 * It was rendered in five places. Every account in the product carried the
 * same fabricated credential whether it was an hour or a year old.
 * ============================================================================
 */
describe("terms in the city", () => {
  const now = new Date("2026-09-09T12:00:00.000Z");

  it("says nothing when the student never gave an arrival date", () => {
    /* Null, not zero. "0 terms here" is a claim; silence is the truth. */
    assert.equal(termsInCity(null, now), null);
    assert.equal(termsInCity("", now), null);
    assert.equal(termsInCity("not-a-date", now), null);
  });

  it("says nothing for someone who has not been here a term yet", () => {
    /* Arrived three weeks ago. They are here, and they have no tenure, and
       claiming any would be the original bug in a new coat. */
    assert.equal(termsInCity("2026-08-20", now), null);
    /* Arriving next month. */
    assert.equal(termsInCity("2026-10-01", now), null);
  });

  it("counts terms from the date they actually gave", () => {
    /* Four months to a term, coarse on purpose: this is a rough "have they
       been around" signal, and a figure to the nearest month would imply a
       precision the question does not have. */
    assert.equal(termsInCity("2026-05-01", now), 1);
    assert.equal(termsInCity("2025-09-01", now), 3);
    assert.equal(termsInCity("2024-09-01", now), 6);
  });

  it("grows with time rather than being stamped once", () => {
    /* The property the old column could not have: the same student, later, has
       been here longer. */
    const arrived = "2025-09-01";
    const earlier = termsInCity(arrived, new Date("2026-01-01T00:00:00.000Z"));
    const later = termsInCity(arrived, new Date("2027-01-01T00:00:00.000Z"));
    assert.ok(later !== null && earlier !== null && later > earlier);
  });
});
