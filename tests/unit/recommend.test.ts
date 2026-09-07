import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  arrangeEvents,
  diversify,
  type EventEnergy,
  eventTabs,
  type Scored,
  scoreBudgetFit,
  scoreCommunityFit,
  scoreDistanceFit,
  scoreFreshness,
  scoreInterestFit,
  weights,
} from "../../src/server/engines/recommend.ts";
import type { CityEvent } from "../../src/domain/types.ts";

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

/* ==========================================================================
   EVENT VIEWS
   --------------------------------------------------------------------------
   The radar's tabs are pure functions over already-scored rows, which is what
   makes "Under 10 never shows an eleven-euro ticket" a test rather than a
   click.
   ========================================================================== */

const NOW = new Date("2026-09-10T18:00:00Z");

function event(overrides: Partial<CityEvent> & { id: string }): CityEvent {
  return {
    citySlug: "madrid",
    campusSlug: null,
    title: `Event ${overrides.id}`,
    blurb: "",
    kind: "culture",
    priceCents: 0,
    startsAt: "2026-09-11T18:00:00Z",
    endsAt: null,
    venue: "Somewhere",
    point: { lat: 40.4, lng: -3.7 },
    source: "students",
    sourceUrl: null,
    confirmations: 0,
    interested: 0,
    tags: [],
    observedAt: "2026-09-09T00:00:00Z",
    ...overrides,
  };
}

function scoredEvent(item: CityEvent, match = 70): Scored<CityEvent> {
  return {
    item,
    match,
    components: {
      budgetFit: 0,
      interestFit: 0,
      distanceFit: 0,
      studentValue: 0,
      communityFit: 0,
      quality: 0,
      freshness: 0,
    },
    reasons: [],
    walkMinutes: null,
  };
}

function energyFor(overrides: Partial<EventEnergy> = {}): EventEnergy {
  return {
    interested: 0,
    going: 0,
    fromCampus: 0,
    friends: [],
    lookingForCompany: 0,
    mine: null,
    recent: 0,
    ...overrides,
  };
}

const noEnergy = new Map<string, EventEnergy>();

describe("arrangeEvents: under-10", () => {
  const free = scoredEvent(event({ id: "free", priceCents: 0 }), 50);
  const cheap = scoredEvent(event({ id: "cheap", priceCents: 800 }), 90);
  const exactly = scoredEvent(event({ id: "exactly", priceCents: 1000 }), 60);
  const dear = scoredEvent(event({ id: "dear", priceCents: 1200 }), 99);

  it("drops anything over the ceiling, however well it scored", () => {
    const result = arrangeEvents([free, cheap, exactly, dear], "under-10", noEnergy, [], NOW);
    assert.deepEqual(
      result.map((entry) => entry.item.id),
      ["free", "cheap", "exactly"],
    );
  });

  it("includes the ceiling itself — a ten-euro ticket is under ten", () => {
    const result = arrangeEvents([exactly], "under-10", noEnergy, [], NOW);
    assert.equal(result.length, 1);
  });

  it("orders by price, cheapest first, and breaks ties on match", () => {
    const alsoCheap = scoredEvent(event({ id: "also-cheap", priceCents: 800 }), 40);
    const result = arrangeEvents([dear, cheap, alsoCheap, free], "under-10", noEnergy, [], NOW);
    assert.deepEqual(
      result.map((entry) => entry.item.id),
      ["free", "cheap", "also-cheap"],
    );
  });
});

describe("arrangeEvents: free", () => {
  it("keeps only rows that cost nothing", () => {
    const rows = [
      scoredEvent(event({ id: "free", priceCents: 0 })),
      scoredEvent(event({ id: "paid", priceCents: 1 })),
    ];
    const result = arrangeEvents(rows, "free", noEnergy, [], NOW);
    assert.deepEqual(
      result.map((entry) => entry.item.id),
      ["free"],
    );
  });
});

describe("arrangeEvents: social", () => {
  const quiet = scoredEvent(event({ id: "quiet", kind: "culture" }), 99);

  it("keeps events whose kind or tags are social", () => {
    const byKind = scoredEvent(event({ id: "by-kind", kind: "nightlife" }), 10);
    const byTag = scoredEvent(event({ id: "by-tag", tags: ["language-exchange"] }), 10);
    const result = arrangeEvents([quiet, byKind, byTag], "social", noEnergy, [], NOW);
    assert.deepEqual(result.map((entry) => entry.item.id).sort(), ["by-kind", "by-tag"]);
  });

  it("keeps a quiet event once someone is looking for company at it", () => {
    const result = arrangeEvents([quiet], "social", noEnergy, [{ anchorId: "quiet" }], NOW);
    assert.deepEqual(
      result.map((entry) => entry.item.id),
      ["quiet"],
    );
  });

  it("keeps a quiet event a friend is interested in", () => {
    const energy = new Map([
      [
        "quiet",
        energyFor({
          friends: [{ userId: "u2", displayName: "Ana", avatarEmoji: "🙂", status: "interested" }],
        }),
      ],
    ]);
    const result = arrangeEvents([quiet], "social", energy, [], NOW);
    assert.deepEqual(
      result.map((entry) => entry.item.id),
      ["quiet"],
    );
  });

  it("ranks friends above people looking for company, and both above raw match", () => {
    const withFriend = scoredEvent(event({ id: "friend", kind: "social" }), 10);
    const withSeekers = scoredEvent(event({ id: "seekers", kind: "social" }), 20);
    const justGood = scoredEvent(event({ id: "good", kind: "social" }), 95);
    const energy = new Map([
      [
        "friend",
        energyFor({ friends: [{ userId: "u2", displayName: "Ana", avatarEmoji: "🙂", status: "going" }] }),
      ],
      ["seekers", energyFor({ lookingForCompany: 3 })],
    ]);
    const result = arrangeEvents([justGood, withSeekers, withFriend], "social", energy, [], NOW);
    assert.deepEqual(
      result.map((entry) => entry.item.id),
      ["friend", "seekers", "good"],
    );
  });
});

describe("arrangeEvents: new", () => {
  it("keeps only rows observed in the last week, newest first", () => {
    const fresh = scoredEvent(event({ id: "fresh", observedAt: "2026-09-09T00:00:00Z" }));
    const newer = scoredEvent(event({ id: "newer", observedAt: "2026-09-10T00:00:00Z" }));
    const stale = scoredEvent(event({ id: "stale", observedAt: "2026-08-01T00:00:00Z" }));
    const result = arrangeEvents([fresh, newer, stale], "new", noEnergy, [], NOW);
    assert.deepEqual(
      result.map((entry) => entry.item.id),
      ["newer", "fresh"],
    );
  });
});

describe("arrangeEvents: trending", () => {
  it("ranks by interest per day since the row was checked, not raw interest", () => {
    /* Forty interested confirmed a month ago is a stale row; twelve confirmed
       yesterday is what the city is actually talking about. */
    const old = scoredEvent(event({ id: "old", interested: 40, observedAt: "2026-08-11T00:00:00Z" }));
    const recent = scoredEvent(event({ id: "recent", interested: 12, observedAt: "2026-09-09T00:00:00Z" }));
    const result = arrangeEvents([old, recent], "trending", noEnergy, [], NOW);
    assert.deepEqual(
      result.map((entry) => entry.item.id),
      ["recent", "old"],
    );
  });

  it("counts responses from the last few days far above old interest", () => {
    const quiet = scoredEvent(event({ id: "quiet", interested: 30 }));
    const moving = scoredEvent(event({ id: "moving", interested: 0 }));
    const energy = new Map([["moving", energyFor({ recent: 6, interested: 6 })]]);
    const result = arrangeEvents([quiet, moving], "trending", energy, [], NOW);
    assert.deepEqual(
      result.map((entry) => entry.item.id),
      ["moving", "quiet"],
    );
  });
});

describe("arrangeEvents: time-ordered views", () => {
  it("puts the soonest thing first on tonight, week and weekend", () => {
    const later = scoredEvent(event({ id: "later", startsAt: "2026-09-11T22:00:00Z" }), 99);
    const sooner = scoredEvent(event({ id: "sooner", startsAt: "2026-09-11T19:00:00Z" }), 10);
    for (const tab of ["tonight", "week", "weekend"] as const) {
      const result = arrangeEvents([later, sooner], tab, noEnergy, [], NOW);
      assert.deepEqual(
        result.map((entry) => entry.item.id),
        ["sooner", "later"],
        tab,
      );
    }
  });

  it("leaves For you in the order the scorer produced", () => {
    const a = scoredEvent(event({ id: "a" }), 90);
    const b = scoredEvent(event({ id: "b" }), 95);
    const result = arrangeEvents([a, b], "for-you", noEnergy, [], NOW);
    assert.deepEqual(
      result.map((entry) => entry.item.id),
      ["a", "b"],
    );
  });
});

describe("eventTabs", () => {
  it("offers under-10, social and new as first-class views", () => {
    const values = eventTabs.map((tab) => String(tab.value));
    for (const wanted of ["under-10", "social", "new"]) {
      assert.ok(values.includes(wanted), `missing ${wanted}`);
    }
  });

  it("has no duplicate values", () => {
    const values = eventTabs.map((tab) => tab.value);
    assert.equal(new Set(values).size, values.length);
  });
});
