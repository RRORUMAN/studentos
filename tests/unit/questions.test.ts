import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  answerRelevance,
  consensusOf,
  routeQuestion,
  shouldClose,
  shouldEscalate,
  type Answer,
  type Question,
} from "../../src/domain/questions.ts";

/**
 * ============================================================================
 * ASK STUDENTS
 * ----------------------------------------------------------------------------
 * Consensus is the step where community answers become something the product
 * will later state as fact, so the tests that matter are the ones that pin what
 * consensus REFUSES to do: promote one enthusiastic student, treat three
 * replies from one account as agreement, or group two answers that share
 * nothing checkable.
 * ============================================================================
 */

const NOW = new Date("2026-09-10T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

let seq = 0;
function answer(over: Partial<Answer> = {}): Answer {
  return {
    id: `a-${(seq += 1)}`,
    questionId: "q-1",
    userId: `student-${seq}`,
    body: "The place next to the library.",
    placeId: null,
    amountCents: null,
    usefulCount: 0,
    markedUsefulByAsker: false,
    createdAt: hoursAgo(2),
    ...over,
  };
}

function question(over: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    askerId: "asker",
    citySlug: "madrid",
    campusSlug: "uc3m",
    audience: "campus",
    communityId: null,
    intent: "printing",
    title: "Where can I print 100 pages cheaply near campus?",
    detail: null,
    originQuery: "cheap printing near campus",
    expectedSubject: "price",
    status: "open",
    acceptedAnswerId: null,
    escalatedAt: null,
    createdAt: hoursAgo(20),
    closedAt: null,
    ...over,
  };
}

describe("routeQuestion", () => {
  it("sends a campus question to the campus, not the whole city", () => {
    assert.equal(routeQuestion("printing", true), "campus");
  });

  it("falls back to the city when the student has no campus", () => {
    assert.equal(routeQuestion("printing", false), "city");
  });

  it("sends a city-wide subject city-wide even with a campus", () => {
    assert.equal(routeQuestion("haircut", true), "city");
  });
});

describe("consensusOf", () => {
  it("returns null on a single answer, however good", () => {
    const only = answer({ placeId: "place-1", usefulCount: 40, markedUsefulByAsker: true });
    assert.equal(consensusOf([only]), null);
  });

  it("does not let one student manufacture agreement with themselves", () => {
    const same = [
      answer({ userId: "loud", placeId: "place-1" }),
      answer({ userId: "loud", placeId: "place-1" }),
      answer({ userId: "loud", placeId: "place-1" }),
    ];
    assert.equal(consensusOf(same), null);
  });

  it("agrees when two students name the same place", () => {
    const result = consensusOf([
      answer({ userId: "a", placeId: "copy-shop" }),
      answer({ userId: "b", placeId: "copy-shop" }),
    ]);

    assert.ok(result);
    assert.equal(result.voices, 2);
    assert.equal(result.placeId, "copy-shop");
  });

  it("does not agree when two students name different places", () => {
    assert.equal(
      consensusOf([
        answer({ userId: "a", placeId: "copy-shop" }),
        answer({ userId: "b", placeId: "library" }),
      ]),
      null,
    );
  });

  it("agrees on prices within tolerance and takes the median", () => {
    const result = consensusOf([
      answer({ userId: "a", amountCents: 500 }),
      answer({ userId: "b", amountCents: 550 }),
      answer({ userId: "c", amountCents: 600 }),
    ]);

    assert.ok(result);
    assert.equal(result.voices, 3);
    assert.equal(result.amountCents, 550);
  });

  it("splits answers whose prices are too far apart", () => {
    /* €5 and €25 are not the same answer, and averaging them into €15 would
       invent a price nobody paid. */
    const result = consensusOf([
      answer({ userId: "a", amountCents: 500 }),
      answer({ userId: "b", amountCents: 2500 }),
    ]);

    assert.equal(result, null);
  });

  it("refuses to group two answers that share nothing checkable", () => {
    /* Both are plausible prose. Neither names a place nor a price, so there is
       nothing to check them against and grouping them would be a guess. */
    assert.equal(
      consensusOf([
        answer({ userId: "a", body: "Try the one by the station." }),
        answer({ userId: "b", body: "There's a place near the park." }),
      ]),
      null,
    );
  });

  it("weights the asker's own verdict above a stranger's upvote", () => {
    const plain = consensusOf([
      answer({ userId: "a", placeId: "p" }),
      answer({ userId: "b", placeId: "p" }),
    ]);
    const endorsed = consensusOf([
      answer({ userId: "a", placeId: "p", markedUsefulByAsker: true }),
      answer({ userId: "b", placeId: "p" }),
    ]);

    assert.ok(plain && endorsed);
    assert.ok(endorsed.strength > plain.strength);
  });
});

describe("question lifecycle", () => {
  it("widens a silent campus question after the escalation window", () => {
    assert.equal(shouldEscalate(question({ createdAt: hoursAgo(20) }), 0, NOW), true);
  });

  it("leaves an answered question where it is", () => {
    assert.equal(shouldEscalate(question({ createdAt: hoursAgo(20) }), 1, NOW), false);
  });

  it("does not widen twice", () => {
    assert.equal(
      shouldEscalate(question({ createdAt: hoursAgo(40), escalatedAt: hoursAgo(20) }), 0, NOW),
      false,
    );
  });

  it("closes a question nobody answered in three weeks", () => {
    assert.equal(shouldClose(question({ createdAt: daysAgo(22) }), 0, NOW), true);
    assert.equal(shouldClose(question({ createdAt: daysAgo(22) }), 2, NOW), false);
  });
});

describe("answerRelevance", () => {
  const student = { campusSlug: "uc3m", knownIntents: ["printing"], familiarPlaceIds: [] };

  it("puts an unanswered question above an answered one", () => {
    const fresh = answerRelevance(question(), student, 0, NOW);
    const crowded = answerRelevance(question(), student, 5, NOW);
    assert.ok(fresh > crowded);
  });

  it("prefers questions from the student's own campus", () => {
    const mine = answerRelevance(question({ campusSlug: "uc3m" }), student, 0, NOW);
    const theirs = answerRelevance(question({ campusSlug: "other" }), student, 0, NOW);
    assert.ok(mine > theirs);
  });

  it("never scores an old unanswered question at zero", () => {
    /* A three-day-old unanswered question is a failure of the product, not of
       the question — it must stay eligible to be shown to someone. */
    assert.ok(answerRelevance(question({ createdAt: daysAgo(3) }), student, 0, NOW) > 0);
  });
});
