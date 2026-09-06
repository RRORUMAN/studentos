import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  diversify,
  scoreBudgetFit,
  scoreCommunityFit,
  scoreDistanceFit,
  scoreFreshness,
  scoreInterestFit,
  weights,
} from "../../src/server/engines/recommend.ts";

/**
 * ============================================================================
 * RECOMMENDATION SCORING
 * ----------------------------------------------------------------------------
 * Selection is deterministic and no model is involved, which is what makes it
 * testable at all — and what makes a bad recommendation traceable to a
 * component score rather than to a prompt.
 * ============================================================================
 */

describe("weights", () => {
  it("sums to one, so a match is a real percentage", () => {
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
  });

  it("weights affordability above raw quality", () => {
    /* For this audience a perfect recommendation you cannot afford is not a
       recommendation. */
    assert.ok(weights.budgetFit > weights.quality);
    assert.ok(weights.studentValue + weights.communityFit > weights.quality);
  });
});

describe("scoreBudgetFit", () => {
  it("scores free as a perfect fit, always", () => {
    assert.equal(scoreBudgetFit(0, 2_000, "cheapest"), 1);
    assert.equal(scoreBudgetFit(0, 100, "occasional-splurge"), 1);
  });

  it("falls off a cliff over budget rather than degrading gently", () => {
    const under = scoreBudgetFit(1_800, 2_000, "balanced");
    const justOver = scoreBudgetFit(2_300, 2_000, "balanced");
    const wayOver = scoreBudgetFit(6_000, 2_000, "balanced");

    assert.ok(justOver < under * 0.6, "a small overshoot must be heavily penalised");
    assert.equal(wayOver, 0, "a large overshoot is simply out");
  });

  it("shifts the sweet spot with declared price sensitivity", () => {
    /* Half the budget: perfect for a value-seeker, less so for someone who
       wants the cheapest possible option. */
    const cheapest = scoreBudgetFit(1_000, 2_000, "cheapest");
    const splurge = scoreBudgetFit(1_000, 2_000, "occasional-splurge");
    assert.ok(splurge > cheapest);
  });

  it("stays neutral when the price is unknown", () => {
    const score = scoreBudgetFit(null, 2_000, "value");
    assert.ok(score > 0.4 && score < 0.7, "unknown price must not be scored as great or terrible");
  });
});

describe("scoreDistanceFit", () => {
  it("is monotonic and hits zero at the limit", () => {
    assert.equal(scoreDistanceFit(30, 30), 0);
    assert.ok(scoreDistanceFit(5, 30) > scoreDistanceFit(15, 30));
    assert.ok(scoreDistanceFit(15, 30) > scoreDistanceFit(25, 30));
  });

  it("treats very short walks as equivalent", () => {
    /* 4 and 8 minutes are both "round the corner"; 25 and 30 are not. */
    const nearGap = scoreDistanceFit(4, 30) - scoreDistanceFit(8, 30);
    const farGap = scoreDistanceFit(22, 30) - scoreDistanceFit(26, 30);
    assert.ok(nearGap < farGap);
  });
});

describe("scoreInterestFit", () => {
  it("rewards matching more interests with diminishing returns", () => {
    const one = scoreInterestFit(["food"], ["food", "coffee", "gym"], null);
    const two = scoreInterestFit(["food", "coffee"], ["food", "coffee", "gym"], null);
    const three = scoreInterestFit(["food", "coffee", "gym"], ["food", "coffee", "gym"], null);

    assert.ok(two > one);
    assert.ok(three > two);
    /* Without the curve, a heavily tagged item outranks a perfect one. */
    assert.ok(three - two < two - one);
  });

  it("lets learned behaviour outweigh a stale declared interest", () => {
    const memory = {
      userId: "u1",
      categoryAffinity: { nightlife: -1 },
      dislikedPlaceIds: [],
      likedPlaceIds: [],
      observedPriceBandCents: null,
      observedTravelMinutes: null,
      updatedAt: "2026-09-01T00:00:00Z",
    };

    const declaredOnly = scoreInterestFit(["nightlife"], ["nightlife"], null);
    const withMemory = scoreInterestFit(["nightlife"], ["nightlife"], memory);
    assert.ok(withMemory < declaredOnly, "behaviour beats a form ticked months ago");
  });
});

describe("scoreCommunityFit", () => {
  it("ranks friends above campus above raw confirmations", () => {
    const friend = scoreCommunityFit({
      id: "p1",
      confirmations: 0,
      savedByFriends: new Set(["p1"]),
    });
    const campus = scoreCommunityFit({
      id: "p1",
      confirmations: 0,
      savedByCampus: new Set(["p1"]),
    });
    const strangers = scoreCommunityFit({ id: "p1", confirmations: 200 });

    assert.ok(friend > campus);
    assert.ok(campus >= strangers - 0.05);
  });

  it("saturates confirmations rather than rewarding them linearly", () => {
    const ten = scoreCommunityFit({ id: "p1", confirmations: 10 });
    const twoHundred = scoreCommunityFit({ id: "p1", confirmations: 200 });
    assert.ok(twoHundred < ten * 2, "200 confirmations is not 20× better than 10");
  });
});

describe("scoreFreshness", () => {
  const now = new Date("2026-09-10T12:00:00Z");

  it("treats anything confirmed in the last fortnight as fully fresh", () => {
    assert.equal(scoreFreshness("2026-09-01T00:00:00Z", now), 1);
  });

  it("decays old confirmations", () => {
    const recent = scoreFreshness("2026-08-20T00:00:00Z", now);
    const old = scoreFreshness("2026-04-01T00:00:00Z", now);
    assert.ok(recent > old);
    assert.ok(old >= 0.1, "never decays to zero — an old row is still a row");
  });
});

describe("diversify", () => {
  it("stops one category owning the top of the feed", () => {
    const scored = [
      { item: { id: "1", kind: "cafe" }, match: 99, components: {}, reasons: [] },
      { item: { id: "2", kind: "cafe" }, match: 98, components: {}, reasons: [] },
      { item: { id: "3", kind: "cafe" }, match: 97, components: {}, reasons: [] },
      { item: { id: "4", kind: "bar" }, match: 60, components: {}, reasons: [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any[];

    const result = diversify(scored, (item) => (item as { kind: string }).kind, 2);
    const topThree = result.slice(0, 3).map((entry) => (entry.item as { kind: string }).kind);

    assert.deepEqual(topThree, ["cafe", "cafe", "bar"]);
  });

  it("appends overflow rather than dropping it", () => {
    const scored = Array.from({ length: 6 }, (_, index) => ({
      item: { id: String(index), kind: "cafe" },
      match: 90 - index,
      components: {},
      reasons: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any[];

    const result = diversify(scored, () => "cafe", 2);
    assert.equal(result.length, 6, "a caller asking for six still gets six");
  });
});
