import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalisePollOptions, tallyPoll } from "../../src/server/engines/catch-up.ts";

/**
 * ============================================================================
 * POLL COUNTING
 * ----------------------------------------------------------------------------
 * A poll is the one place in the product where a number is presented as a fact
 * about other people. The share has to be a share *of people*, so changing a
 * vote must never add one, and a duplicate row must never count twice.
 * ============================================================================
 */

const OPTIONS = ["Tonight", "Tomorrow", "Neither"];

describe("tallyPoll", () => {
  it("counts one vote per person and marks the viewer's own", () => {
    const tally = tallyPoll(
      OPTIONS,
      [
        { userId: "a", optionIndex: 0, createdAt: "2026-09-01T10:00:00.000Z" },
        { userId: "b", optionIndex: 0, createdAt: "2026-09-01T10:01:00.000Z" },
        { userId: "c", optionIndex: 1, createdAt: "2026-09-01T10:02:00.000Z" },
      ],
      "c",
    );

    assert.equal(tally.total, 3);
    assert.equal(tally.myVote, 1);
    assert.deepEqual(tally.options.map((option) => option.count), [2, 1, 0]);
  });

  it("shows shares that add up to about a hundred", () => {
    const tally = tallyPoll(
      ["A", "B"],
      [
        { userId: "a", optionIndex: 0 },
        { userId: "b", optionIndex: 0 },
        { userId: "c", optionIndex: 1 },
        { userId: "d", optionIndex: 1 },
      ],
      null,
    );

    assert.deepEqual(tally.options.map((option) => option.share), [50, 50]);
  });

  it("moves a changed vote rather than adding one", () => {
    const tally = tallyPoll(
      OPTIONS,
      [
        { userId: "a", optionIndex: 0, createdAt: "2026-09-01T10:00:00.000Z" },
        { userId: "a", optionIndex: 2, createdAt: "2026-09-01T11:00:00.000Z" },
      ],
      "a",
    );

    assert.equal(tally.total, 1, "one person is one vote");
    assert.equal(tally.myVote, 2);
    assert.deepEqual(tally.options.map((option) => option.count), [0, 0, 1]);
  });

  it("ignores a vote for an option that does not exist", () => {
    const tally = tallyPoll(OPTIONS, [{ userId: "a", optionIndex: 9 }, { userId: "b", optionIndex: -1 }], "a");
    assert.equal(tally.total, 0);
    assert.equal(tally.myVote, null);
  });

  it("reports zero shares rather than dividing by zero on an unvoted poll", () => {
    const tally = tallyPoll(OPTIONS, [], "a");
    assert.equal(tally.total, 0);
    assert.equal(tally.myVote, null);
    assert.deepEqual(tally.options.map((option) => option.share), [0, 0, 0]);
  });

  it("keeps the options in the order they were written", () => {
    const tally = tallyPoll(OPTIONS, [{ userId: "a", optionIndex: 2 }], null);
    assert.deepEqual(tally.options.map((option) => option.label), OPTIONS);
    assert.deepEqual(tally.options.map((option) => option.index), [0, 1, 2]);
  });

  it("tells an anonymous reader nothing about whose vote is whose", () => {
    const tally = tallyPoll(OPTIONS, [{ userId: "a", optionIndex: 0 }], null);
    assert.equal(tally.myVote, null);
    assert.equal(JSON.stringify(tally).includes("\"a\""), false);
  });
});

describe("normalisePollOptions", () => {
  it("accepts two to four real options and trims them", () => {
    const result = normalisePollOptions(["  Tonight ", "Tomorrow", "", "   "]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.options, ["Tonight", "Tomorrow"]);
  });

  it("refuses a poll with one answer", () => {
    const result = normalisePollOptions(["Only this"]);
    assert.equal(result.ok, false);
  });

  it("refuses more than four", () => {
    assert.equal(normalisePollOptions(["a", "b", "c", "d", "e"]).ok, false);
  });

  it("refuses two options that say the same thing", () => {
    const result = normalisePollOptions(["Tonight", "tonight"]);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.message.length > 0, true);
  });

  it("refuses an option too long to read on a phone", () => {
    assert.equal(normalisePollOptions(["ok", "x".repeat(61)]).ok, false);
  });
});
