import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MIN_DISTINCT_VERIFIERS,
  assess,
  isPublishable,
  needsVerification,
  type Claim,
  type Verification,
} from "../../src/domain/truth.ts";
import {
  reputationFor,
  trustFromPoints,
  trustIndex,
  type ReputationEvent,
} from "../../src/domain/reputation.ts";

/**
 * ============================================================================
 * LOCAL TRUTH
 * ----------------------------------------------------------------------------
 * This is the layer that decides whether the product states something as fact.
 * Every test below pins a rule that, if it broke silently, would send a student
 * to a discount that no longer exists — which is the specific failure the whole
 * module was written to prevent.
 *
 * The two most important are the ones nobody would think to write: that a
 * highly-reputed account cannot publish a claim alone, and that the author of a
 * claim cannot verify it.
 * ============================================================================
 */

const NOW = new Date("2026-09-10T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function claim(over: Partial<Claim> = {}): Claim {
  return {
    id: "claim-1",
    citySlug: "madrid",
    campusSlug: null,
    subject: "student-offer",
    targetKind: "place",
    targetId: "place-1",
    statement: "€8 student lunch until 3pm.",
    amountCents: 800,
    sourceType: "student-report",
    sourceUrl: null,
    submittedBy: "author",
    derivedFromQuestionId: null,
    createdAt: daysAgo(10),
    lastSeenAt: daysAgo(1),
    lastVerifiedAt: null,
    supersededBy: null,
    status: "published",
    ...over,
  };
}

let seq = 0;
function verify(over: Partial<Verification>): Verification {
  return {
    id: `v-${(seq += 1)}`,
    claimId: "claim-1",
    userId: "student-a",
    verdict: "confirmed",
    correctionCents: null,
    note: null,
    createdAt: daysAgo(1),
    ...over,
  };
}

const flat = () => 1;

describe("assess — reaching verified", () => {
  it("needs distinct people, not repeated reports", () => {
    /* Ten confirmations from one account is one person who likes tapping. */
    const spam = Array.from({ length: 10 }, () =>
      verify({ userId: "student-a", createdAt: daysAgo(1) }),
    );
    const result = assess(claim(), spam, flat, NOW);

    assert.equal(result.verificationCount, 1);
    assert.notEqual(result.confidence, "verified");
  });

  it("reaches verified on three independent recent confirmations", () => {
    const result = assess(
      claim(),
      [
        verify({ userId: "a", createdAt: daysAgo(1) }),
        verify({ userId: "b", createdAt: daysAgo(2) }),
        verify({ userId: "c", createdAt: daysAgo(3) }),
      ],
      flat,
      NOW,
    );

    assert.equal(result.confidence, "verified");
    assert.equal(result.verificationCount, MIN_DISTINCT_VERIFIERS);
    assert.ok(isPublishable(result));
  });

  it("will not let one trusted account publish alone", () => {
    /* The single most important line in the module. A City Expert is worth
       2.5 ordinary students, and 2.5 is still not three people. */
    const cityExpert = () => 2.5;
    const result = assess(claim(), [verify({ userId: "expert" })], cityExpert, NOW);

    assert.notEqual(result.confidence, "verified");
    assert.equal(result.verificationCount, 1);
  });

  it("does not count the author as a witness", () => {
    const result = assess(
      claim({ submittedBy: "author" }),
      [
        verify({ userId: "author" }),
        verify({ userId: "b" }),
        verify({ userId: "c" }),
      ],
      flat,
      NOW,
    );

    assert.equal(result.verificationCount, 2);
    assert.equal(result.confidence, "likely");
  });
});

describe("assess — negative evidence", () => {
  it("lets one fresh 'gone' report override a pile of old confirmations", () => {
    /* Someone standing in the shop being told it ended knows something forty
       people who used it last term do not. */
    const old = Array.from({ length: 12 }, (_, i) =>
      verify({ userId: `old-${i}`, createdAt: daysAgo(120) }),
    );
    const result = assess(
      claim({ createdAt: daysAgo(150) }),
      [...old, verify({ userId: "fresh", verdict: "gone", createdAt: daysAgo(1) })],
      flat,
      NOW,
    );

    assert.equal(result.confidence, "expired");
    assert.match(result.reason, /ended/);
  });

  it("keeps a claim alive when the negative is old and the positives are fresh", () => {
    const result = assess(
      claim(),
      [
        verify({ userId: "stale-no", verdict: "gone", createdAt: daysAgo(200) }),
        verify({ userId: "a", createdAt: daysAgo(1) }),
        verify({ userId: "b", createdAt: daysAgo(1) }),
        verify({ userId: "c", createdAt: daysAgo(2) }),
      ],
      flat,
      NOW,
    );

    assert.equal(result.confidence, "verified");
  });

  it("takes the most recent verdict per person, not both", () => {
    /* A student who confirmed in March and reported it gone in October is
       telling us it is gone. */
    const result = assess(
      claim(),
      [
        verify({ userId: "a", verdict: "confirmed", createdAt: daysAgo(60) }),
        verify({ userId: "a", verdict: "gone", createdAt: daysAgo(2) }),
      ],
      flat,
      NOW,
    );

    assert.equal(result.verificationCount, 0);
    assert.equal(result.negativeVerificationCount, 1);
  });

  it("surfaces an agreed correction so the UI can offer the new number", () => {
    const result = assess(
      claim(),
      [
        verify({ userId: "a", verdict: "changed", correctionCents: 950, createdAt: daysAgo(2) }),
        verify({ userId: "b", verdict: "changed", correctionCents: 1000, createdAt: daysAgo(1) }),
      ],
      flat,
      NOW,
    );

    assert.equal(result.suggestedCents, 975);
    assert.equal(result.confidence, "disputed");
  });
});

describe("assess — staleness by subject", () => {
  it("goes stale fast for an offer and slowly for a requirement", () => {
    const confirms = [
      verify({ userId: "a", createdAt: daysAgo(60) }),
      verify({ userId: "b", createdAt: daysAgo(60) }),
      verify({ userId: "c", createdAt: daysAgo(60) }),
    ];

    const offer = assess(claim({ subject: "student-offer" }), confirms, flat, NOW);
    const requirement = assess(claim({ subject: "requirement" }), confirms, flat, NOW);

    assert.equal(offer.stale, true, "a 60-day-old discount confirmation is stale");
    assert.equal(offer.confidence, "likely", "stale claims cannot read verified");
    assert.equal(requirement.stale, false, "a 60-day-old requirement is not");
    assert.equal(requirement.confidence, "verified");
  });

  it("treats an official source as likely without any student verification", () => {
    const result = assess(
      claim({ sourceType: "official", sourceUrl: "https://example.gov", submittedBy: null }),
      [],
      flat,
      NOW,
    );

    assert.equal(result.confidence, "likely");
    assert.ok(isPublishable(result));
  });

  it("does not extend that courtesy to a merchant's own claim", () => {
    const result = assess(
      claim({ sourceType: "merchant", submittedBy: null }),
      [],
      flat,
      NOW,
    );

    assert.equal(result.confidence, "unconfirmed");
    assert.equal(isPublishable(result), false);
  });
});

describe("needsVerification", () => {
  it("asks students to re-check the claims the product is most confident about", () => {
    const stale = assess(
      claim({ subject: "student-offer" }),
      [
        verify({ userId: "a", createdAt: daysAgo(70) }),
        verify({ userId: "b", createdAt: daysAgo(70) }),
        verify({ userId: "c", createdAt: daysAgo(70) }),
      ],
      flat,
      NOW,
    );

    assert.ok(needsVerification(stale, "student-offer"));
  });

  it("stops asking about something students already said is gone", () => {
    const dead = assess(
      claim(),
      [verify({ userId: "a", verdict: "gone", createdAt: daysAgo(1) })],
      flat,
      NOW,
    );

    assert.equal(dead.confidence, "expired");
    assert.equal(needsVerification(dead, "student-offer"), false);
  });
});

/* -------------------------------------------------------------------------- */
/* Reputation                                                                  */
/* -------------------------------------------------------------------------- */

let repSeq = 0;
function event(over: Partial<ReputationEvent>): ReputationEvent {
  return {
    id: `r-${(repSeq += 1)}`,
    userId: "student-a",
    citySlug: "madrid",
    signal: "deal-confirmed",
    refKind: "deal",
    refId: "deal-1",
    createdAt: daysAgo(30),
    ...over,
  };
}

describe("reputation", () => {
  it("caps trust so no contributor is decisive", () => {
    assert.ok(trustFromPoints(100_000) <= 2.5);
  });

  it("carries reputation across cities at a discount", () => {
    const madrid = Array.from({ length: 20 }, () => event({ citySlug: "madrid" }));

    const home = reputationFor(madrid, "madrid", NOW);
    const away = reputationFor(madrid, "berlin", NOW);

    assert.ok(away.points < home.points, "a Madrid expert is not a Berlin expert");
    assert.ok(away.points > 0, "but the passport is still worth something");
    assert.ok(away.trust < home.trust);
  });

  it("costs more to be wrong than it pays to be right", () => {
    const right = reputationFor([event({ signal: "deal-confirmed" })], "madrid", NOW);
    const wrong = reputationFor(
      [event({ signal: "deal-confirmed" }), event({ signal: "confirmation-refuted" })],
      "madrid",
      NOW,
    );

    assert.ok(wrong.points < 0, "one refuted confirmation outweighs one good one");
    assert.ok(wrong.trust < right.trust);
  });

  it("drops a bad actor below the floor without discarding their reports", () => {
    const bad = reputationFor(
      Array.from({ length: 4 }, () => event({ signal: "contribution-removed" })),
      "madrid",
      NOW,
    );

    assert.ok(bad.trust > 0, "reports are still recorded");
    assert.ok(bad.trust < 0.5, "they just no longer move confidence on their own");
  });

  it("decays, so a contributor who left is not still an authority", () => {
    const recent = reputationFor([event({ createdAt: daysAgo(30) })], "madrid", NOW);
    const ancient = reputationFor([event({ createdAt: daysAgo(730) })], "madrid", NOW);

    assert.ok(ancient.points < recent.points / 3);
  });

  it("indexes trust per user with a default for strangers", () => {
    const trust = trustIndex(
      Array.from({ length: 30 }, () => event({ userId: "veteran" })),
      "madrid",
      NOW,
    );

    assert.ok(trust("veteran") > trust("nobody"));
    assert.equal(trust(null), trust("nobody"));
  });
});
