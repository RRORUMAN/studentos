import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Opportunity,
  type WorkProfile,
  dedupe,
  dedupeKey,
  emptyWorkProfile,
  freshness,
  hourlyEquivalent,
  isLive,
  riskFlags,
  riskLevel,
  sourceConfidence,
  staleAfterDays,
} from "@/domain/work";
import {
  fitWeights,
  inView,
  matchesForStudents,
  rankOpportunities,
  scoreOpportunity,
} from "@/server/engines/work-match";
import { budgetShortfall, earnPlan, estimateMonthly, incomeGap } from "@/server/engines/earn";

/**
 * ============================================================================
 * WORK
 * ----------------------------------------------------------------------------
 * These tests are almost entirely about one thing: what the product does when
 * it does not know something.
 *
 * The scoring maths is easy to get right and easy to test. The failure that
 * would actually cost a student money is subtler — a posting with no stated
 * wage quietly scoring as though the wage were fine, an estimate built on an
 * assumed rate, a stale listing surviving because nothing expired it. So most
 * of what is pinned below is the treatment of absence.
 * ============================================================================
 */

const NOW = new Date("2026-09-07T12:00:00.000Z");
const iso = (daysFromNow: number) =>
  new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString();

function opportunity(patch: Partial<Opportunity> = {}): Opportunity {
  return {
    id: patch.id ?? "o1",
    provider: "feed",
    providerSlug: "test",
    providerJobId: null,
    sourceUrl: "https://example.org/job/1",
    title: "Event staff",
    description:
      "Setting up and clearing down at conferences. Shifts are eight hours, mostly on Saturdays.",
    kind: "EVENT_WORK",
    employerId: null,
    employerName: "An agency",
    postedByUserId: null,
    citySlug: "madrid",
    countryCode: "ES",
    area: "Lavapiés",
    campusSlug: null,
    remoteType: "onsite",
    pay: { minCents: 1200, maxCents: null, period: "hour", currency: "EUR" },
    hoursMin: 8,
    hoursMax: 8,
    schedule: ["weekend"],
    startsAt: null,
    languages: [],
    skills: ["events"],
    studentFriendly: null,
    internationalStudentFriendly: null,
    workAuthorizationNotes: null,
    applicationMethod: "external-url",
    applicationUrl: "https://example.org/job/1",
    postedAt: iso(-2),
    expiresAt: null,
    fetchedAt: iso(-2),
    lastSeenAt: iso(0),
    moderation: "published",
    filledAt: null,
    ...patch,
  };
}

function profile(patch: Partial<WorkProfile> = {}): WorkProfile {
  return { ...emptyWorkProfile("u1", NOW), ...patch };
}

const context = { profile: profile(), now: NOW };

/* -------------------------------------------------------------------------- */

describe("pay", () => {
  it("has no hourly rate for a fixed price, because the hours are unknown", () => {
    /* €40 to move a sofa is €40. Dividing it by an assumed duration would
       invent the one number the poster deliberately did not give. */
    const rate = hourlyEquivalent(
      { minCents: 4000, maxCents: null, period: "fixed", currency: "EUR" },
      null,
    );
    assert.equal(rate, null);
  });

  it("converts a monthly wage only when the hours are known", () => {
    const pay = { minCents: 45000, maxCents: null, period: "month" as const, currency: "EUR" };
    assert.equal(hourlyEquivalent(pay, null), null);
    assert.equal(hourlyEquivalent(pay, 12), Math.round(45000 / (12 * 4.33)));
  });

  it("uses the midpoint of a stated band, never the top of it", () => {
    const rate = hourlyEquivalent(
      { minCents: 1200, maxCents: 1600, period: "hour", currency: "EUR" },
      null,
    );
    assert.equal(rate, 1400);
  });
});

describe("freshness", () => {
  it("expires a dated shift the moment it has started", () => {
    const gig = opportunity({ kind: "SHIFT", startsAt: iso(-0.5) });
    assert.equal(freshness(gig, NOW), "expired");
    assert.equal(isLive(gig, NOW), false);
  });

  it("gives a one-off gig a shorter life than an internship", () => {
    assert.ok(staleAfterDays("ONE_OFF_GIG") < staleAfterDays("INTERNSHIP"));
  });

  it("calls silence stale rather than expired, because we are less sure", () => {
    const old = opportunity({ kind: "ONE_OFF_GIG", lastSeenAt: iso(-20) });
    assert.equal(freshness(old, NOW), "stale");
    /* Stale still leaves the board: a job board that keeps dead listings to
       look busy is the thing this product is competing against. */
    assert.equal(isLive(old, NOW), false);
  });

  it("never shows a posting held for moderation", () => {
    assert.equal(isLive(opportunity({ moderation: "pending" }), NOW), false);
  });

  it("decays confidence with silence, and ranks a sample row below a real one", () => {
    const fresh = sourceConfidence(opportunity(), NOW);
    const quiet = sourceConfidence(opportunity({ lastSeenAt: iso(-10) }), NOW);
    assert.ok(quiet < fresh);
    assert.ok(sourceConfidence(opportunity({ provider: "sample" }), NOW) < fresh);
  });
});

describe("deduplication", () => {
  it("collapses the same job from two aggregators to the more accountable one", () => {
    const rows = [
      opportunity({ id: "a", provider: "feed", pay: null }),
      opportunity({ id: "b", provider: "campus" }),
    ];
    const kept = dedupe(rows);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].id, "b");
  });

  it("prefers the copy that states pay when the sources are equal", () => {
    const kept = dedupe([
      opportunity({ id: "a", pay: null }),
      opportunity({ id: "b" }),
    ]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].id, "b");
  });

  it("ignores wording noise when deciding two rows are the same job", () => {
    const a = dedupeKey(opportunity({ title: "Bar staff (part-time, urgent!)" }));
    const b = dedupeKey(opportunity({ title: "Part time bar staff — hiring now" }));
    assert.equal(a, b);
  });

  it("never merges two students who both need help moving", () => {
    /* Two people genuinely needing a sofa carried is two jobs. Merging them
       would delete a real person's request. */
    const rows = [
      opportunity({ id: "a", provider: "students", employerName: null, title: "Help me move" }),
      opportunity({ id: "b", provider: "students", employerName: null, title: "Help me move" }),
    ];
    assert.equal(dedupe(rows).length, 2);
  });
});

describe("risk", () => {
  it("withholds a posting that asks for money up front", () => {
    const flags = riskFlags(
      opportunity({
        description: "Great opportunity for students. A small registration fee of €30 is required.",
      }),
      1200,
    );
    assert.ok(flags.includes("upfront-payment"));
    assert.equal(riskLevel(flags), "block");
  });

  it("withholds recruitment into moving money through a student's account", () => {
    const flags = riskFlags(
      opportunity({
        description:
          "Work from home as a payment processing agent. You receive and forward funds using your own bank account.",
      }),
      1200,
    );
    assert.ok(flags.includes("money-handling"));
    assert.equal(riskLevel(flags), "block");
  });

  it("warns about implausible pay only when there is a baseline to compare with", () => {
    const rich = opportunity({
      pay: { minCents: 9000, maxCents: null, period: "hour", currency: "EUR" },
    });
    assert.ok(riskFlags(rich, 1200).includes("implausible-pay"));
    /* No baseline, no flag. An absent number must never manufacture a warning
       about a real employer. */
    assert.equal(riskFlags(rich, null).includes("implausible-pay"), false);
  });

  it("shows a merely thin posting rather than hiding it", () => {
    const flags = riskFlags(opportunity({ description: "Bar work." }), 1200);
    assert.deepEqual(flags, ["no-detail"]);
    assert.equal(riskLevel(flags), "review");
  });

  it("says nothing about an ordinary posting", () => {
    assert.deepEqual(riskFlags(opportunity(), 1200), []);
    assert.equal(riskLevel([]), "clear");
  });
});

/* -------------------------------------------------------------------------- */

describe("student fit", () => {
  it("scores an unknown at neutral, not at zero and not as a pass", () => {
    const unknown = scoreOpportunity(opportunity({ pay: null }), context);
    assert.equal(unknown.components.pay, 0.5);
    /* And it is visible rather than rounded away. */
    assert.ok(unknown.shortfalls.some((signal) => signal.kind === "pay-not-stated"));
  });

  it("never lets an unstated wage outscore a stated one that meets the floor", () => {
    const me = profile({ minHourlyCents: 1000 });
    const stated = scoreOpportunity(opportunity(), { profile: me, now: NOW });
    const silent = scoreOpportunity(opportunity({ pay: null }), { profile: me, now: NOW });
    assert.ok(stated.components.pay > silent.components.pay);
  });

  it("ranks a job below the student's floor without removing it", () => {
    const me = profile({ minHourlyCents: 1500 });
    const ranked = rankOpportunities({
      opportunities: [
        opportunity({ id: "low", pay: { minCents: 900, maxCents: null, period: "hour", currency: "EUR" } }),
        opportunity({ id: "ok", pay: { minCents: 1600, maxCents: null, period: "hour", currency: "EUR" } }),
      ],
      profile: me,
      now: NOW,
    });
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].opportunity.id, "ok");
    assert.ok(
      ranked[1].shortfalls.some((signal) => signal.kind === "pay-below-floor"),
      "the underpaid one is labelled, not hidden",
    );
  });

  it("costs most of the language component when a requirement is not met", () => {
    const me = profile({ languages: [{ code: "en", level: "fluent" }] });
    const spanish = opportunity({ languages: [{ code: "es", level: "fluent" }] });
    const english = opportunity({ languages: [{ code: "en", level: "conversational" }] });

    const missed = scoreOpportunity(spanish, { profile: me, now: NOW });
    const met = scoreOpportunity(english, { profile: me, now: NOW });

    assert.ok(missed.components.language < 0.2);
    assert.equal(met.components.language, 1);
    assert.ok(
      missed.shortfalls.some((signal) => signal.kind === "language-gap"),
      "the wall is named",
    );
  });

  it("does not treat silence about international students as a welcome", () => {
    const silent = scoreOpportunity(opportunity(), context);
    const welcoming = scoreOpportunity(
      opportunity({ internationalStudentFriendly: true }),
      context,
    );
    assert.equal(silent.components.suitability, 0.5);
    assert.equal(welcoming.components.suitability, 1);
    assert.ok(silent.shortfalls.some((signal) => signal.kind === "suitability-not-stated"));
  });

  it("returns the catch alongside the best match, not only the worst", () => {
    const me = profile({ availability: ["weekend"], minHourlyCents: 1000, skills: ["events"] });
    const [best] = rankOpportunities({
      opportunities: [opportunity()],
      profile: me,
      now: NOW,
    });
    assert.ok(best.fit > 60);
    assert.ok(best.shortfalls.length > 0, "even a good match states what is unknown about it");
  });

  it("withholds a defrauding posting from students but not from the caller", () => {
    const scam = opportunity({
      id: "scam",
      description: "Earn from home. A €40 training fee is required before your first shift.",
    });
    const all = rankOpportunities({
      opportunities: [scam, opportunity({ id: "real" })],
      profile: profile(),
      hourlyBaseline: 1200,
      now: NOW,
    });
    assert.equal(all.length, 2, "moderation surfaces still see it");
    assert.equal(all[1].opportunity.id, "scam", "and it sorts last");
    assert.ok(all[1].blocked);

    const shown = matchesForStudents({
      opportunities: [scam, opportunity({ id: "real" })],
      profile: profile(),
      hourlyBaseline: 1200,
      now: NOW,
    });
    assert.deepEqual(
      shown.map((match) => match.opportunity.id),
      ["real"],
    );
  });

  it("weighs pay and schedule above who posted it", () => {
    assert.ok(fitWeights.pay > fitWeights.trust);
    assert.ok(fitWeights.schedule > fitWeights.freshness);
    const total = Object.values(fitWeights).reduce((sum, weight) => sum + weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, "the weights are a distribution");
  });

  it("puts a job in exactly the views it belongs to", () => {
    const weekendGig = opportunity({ kind: "ONE_OFF_GIG", schedule: ["weekend"] });
    assert.equal(inView(weekendGig, "gigs", NOW), true);
    assert.equal(inView(weekendGig, "weekend", NOW), true);
    assert.equal(inView(weekendGig, "internships", NOW), false);
    assert.equal(inView(weekendGig, "urgent", NOW), false, "undated work is never urgent");
    assert.equal(inView(opportunity({ startsAt: iso(3) }), "urgent", NOW), true);
  });
});

/* -------------------------------------------------------------------------- */

describe("earning", () => {
  it("has no gap when no target was ever set", () => {
    assert.equal(incomeGap({ targetCents: null, currentIncomeCents: 20000 }), null);
  });

  it("floors a surplus at zero rather than reporting a negative gap", () => {
    const gap = incomeGap({ targetCents: 30000, currentIncomeCents: 40000 });
    assert.equal(gap?.gapCents, 0);
    assert.equal(gap?.closed, true);
  });

  it("declines to compute a budget shortfall from an income it was never told", () => {
    /* Treating "I never said" as "I have nothing" would greet most accounts
       with an alarming number about a fact we do not have. */
    assert.equal(budgetShortfall({ monthlyPlannedCents: 90000, currentIncomeCents: null }), null);
    assert.equal(budgetShortfall({ monthlyPlannedCents: 90000, currentIncomeCents: 60000 }), 30000);
  });

  it("refuses to price a posting that does not state pay", () => {
    assert.equal(estimateMonthly(opportunity({ pay: null }), 10), null);
  });

  it("assumes the posting's own lower bound, capped by the hours a student has", () => {
    const job = opportunity({ hoursMin: 12, hoursMax: 20 });
    const generous = estimateMonthly(job, 20);
    const tight = estimateMonthly(job, 6);

    assert.equal(generous?.hoursPerWeek, 12, "a 12–20 hour role guarantees twelve");
    assert.equal(tight?.hoursPerWeek, 6, "and never more than the student has");
    assert.equal(generous?.basis, "hourly-x-hours");
  });

  it("counts a one-off once and says so", () => {
    const gig = opportunity({
      kind: "ONE_OFF_GIG",
      pay: { minCents: 4000, maxCents: null, period: "fixed", currency: "EUR" },
    });
    const estimate = estimateMonthly(gig, 10);
    assert.equal(estimate?.monthlyCents, 4000);
    assert.equal(estimate?.basis, "fixed-one-off");
    assert.equal(estimate?.hoursPerWeek, null);
  });

  it("builds a plan inside the hours the student actually has", () => {
    const matches = rankOpportunities({
      opportunities: [
        opportunity({ id: "a", hoursMin: 6, hoursMax: 6 }),
        opportunity({ id: "b", hoursMin: 6, hoursMax: 6 }),
        opportunity({ id: "c", hoursMin: 20, hoursMax: 20 }),
      ],
      profile: profile(),
      now: NOW,
    });

    const plan = earnPlan({ matches, targetCents: 1_000_00, hoursAvailable: 8 });
    assert.ok(plan.hoursUsed <= 8, "the plan never spends hours the student does not have");
    assert.ok(plan.picks.length >= 1);
  });

  it("names the postings it could not price instead of hiding them", () => {
    const matches = rankOpportunities({
      opportunities: [
        opportunity({ id: "priced" }),
        opportunity({ id: "silent-1", pay: null }),
        opportunity({ id: "silent-2", pay: null }),
      ],
      profile: profile(),
      now: NOW,
    });

    const plan = earnPlan({ matches, targetCents: 100_000_00, hoursAvailable: 20 });
    assert.equal(plan.unpriced, 2);
    assert.ok(plan.picks.every((pick) => pick.opportunity.pay !== null));
  });

  it("answers what it would take, from rates observed in these results", () => {
    const matches = rankOpportunities({
      opportunities: [
        opportunity({ id: "a", pay: { minCents: 1000, maxCents: null, period: "hour", currency: "EUR" }, hoursMin: 2, hoursMax: 2 }),
        opportunity({ id: "b", pay: { minCents: 1500, maxCents: null, period: "hour", currency: "EUR" }, hoursMin: 2, hoursMax: 2 }),
        opportunity({ id: "c", pay: { minCents: 2000, maxCents: null, period: "hour", currency: "EUR" }, hoursMin: 2, hoursMax: 2 }),
      ],
      profile: profile(),
      now: NOW,
    });

    const plan = earnPlan({ matches, targetCents: 100_000, hoursAvailable: 6 });
    assert.equal(plan.reachesTarget, false);
    assert.equal(plan.needed?.atHourlyCents, 1500, "the median of what is advertised here");
    assert.ok((plan.needed?.hoursPerWeek ?? 0) > 0);
  });

  it("gives no hours answer when there are too few rates for a median to mean anything", () => {
    const matches = rankOpportunities({
      opportunities: [opportunity({ id: "a", hoursMin: 2, hoursMax: 2 })],
      profile: profile(),
      now: NOW,
    });
    const plan = earnPlan({ matches, targetCents: 100_000, hoursAvailable: 4 });
    assert.equal(plan.reachesTarget, false);
    assert.equal(plan.needed, null);
  });
});
