import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  featureCopy,
  featureTier,
  featuresAddedBy,
  isShipped,
  sellableFeatures,
  UNBUILT_FEATURES,
  planHasFeature,
  quotaFor,
  quotaState,
  tierAtLeast,
  tierOrder,
} from "../../src/config/entitlements.ts";
import { effectivePlan } from "../../src/domain/types.ts";
import { dealConfidence } from "../../src/domain/knowledge.ts";
import { settleBucket } from "../../src/domain/social.ts";

/**
 * ============================================================================
 * ENTITLEMENTS, CONFIDENCE AND SETTLEMENT
 * ----------------------------------------------------------------------------
 * Three pieces of logic that are individually small and expensive to get wrong:
 * what a plan unlocks, whether a deal can be called verified, and who owes
 * whom.
 * ============================================================================
 */

describe("tier ladder", () => {
  it("is strictly ordered", () => {
    assert.deepEqual(tierOrder, ["free", "plus", "pro", "max"]);
    assert.ok(tierAtLeast("pro", "plus"));
    assert.ok(tierAtLeast("max", "max"));
    assert.ok(!tierAtLeast("free", "plus"));
  });

  it("grants everything below a tier implicitly", () => {
    /* A Max user must have every Plus and Pro feature without any of them
       being restated. */
    for (const feature of Object.keys(featureTier) as (keyof typeof featureTier)[]) {
      assert.ok(planHasFeature("max", feature), `max is missing ${feature}`);
    }
  });

  it("gives every feature copy the paywall can show", () => {
    /* A locked feature with no promise renders "upgrade to continue", which is
       the one paywall this product refuses to ship. */
    for (const feature of Object.keys(featureTier) as (keyof typeof featureTier)[]) {
      assert.ok(featureCopy[feature]?.promise?.length > 0, `${feature} has no promise copy`);
    }
  });

  it("keeps the community out of the entitlement map entirely", () => {
    const keys = Object.keys(featureTier);
    for (const forbidden of ["posting", "chat", "joinPlan", "readFeed", "events"]) {
      assert.ok(!keys.includes(forbidden), `${forbidden} must never be gated`);
    }
  });
});

describe("quotas", () => {
  it("gives free a usable weekly allowance rather than a token one", () => {
    const free = quotaFor("free");
    assert.ok((free.aiAsksPerWeek ?? 0) >= 5, "free must answer a real week");
    assert.ok(free.savedItems !== null, "free is capped, but the cap exists");
    assert.equal(free.hostedPlans, 2);
  });

  it("uncaps the paid tiers where it says it does", () => {
    assert.equal(quotaFor("plus").savedItems, null);
    assert.equal(quotaFor("pro").hostedPlans, null);
    assert.equal(quotaFor("max").historyMonths, null);
  });

  it("reports an uncapped quota as never exceeded and draws no bar", () => {
    const state = quotaState(9_999, null);
    assert.equal(state.exceeded, false);
    assert.equal(state.fraction, 0);
    assert.equal(state.remaining, null);
  });

  it("marks a quota exceeded at the limit, not past it", () => {
    assert.equal(quotaState(9, 10).exceeded, false);
    assert.equal(quotaState(10, 10).exceeded, true);
    assert.equal(quotaState(11, 10).remaining, 0, "remaining never goes negative");
  });
});

describe("effectivePlan", () => {
  const base = {
    userId: "u1",
    period: "monthly" as const,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
    updatedAt: "2026-09-01T00:00:00Z",
  };

  it("falls back to free with no subscription", () => {
    assert.equal(effectivePlan(null), "free");
  });

  it("keeps access through the dunning window on a failed card", () => {
    /* Revoking a student's budget the hour a card expires churns people who
       would have paid. */
    assert.equal(
      effectivePlan({ ...base, plan: "pro", status: "past_due", currentPeriodEnd: null }),
      "pro",
    );
  });

  it("honours a cancelled subscription until the period it paid for ends", () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const past = new Date(Date.now() - 10 * 86_400_000).toISOString();

    assert.equal(
      effectivePlan({ ...base, plan: "max", status: "canceled", currentPeriodEnd: future }),
      "max",
    );
    assert.equal(
      effectivePlan({ ...base, plan: "max", status: "canceled", currentPeriodEnd: past }),
      "free",
    );
  });

  it("grants nothing on an incomplete checkout", () => {
    assert.equal(
      effectivePlan({ ...base, plan: "max", status: "incomplete", currentPeriodEnd: null }),
      "free",
    );
  });
});

/* -------------------------------------------------------------------------- */

describe("dealConfidence", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const report = (outcome: "worked" | "did-not-work" | "expired", daysAgo: number) => ({
    outcome,
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  });

  it("is unconfirmed with no reports", () => {
    assert.equal(dealConfidence([], now).confidence, "unconfirmed");
  });

  it("needs a real sample, not two people, to be verified", () => {
    const two = dealConfidence([report("worked", 1), report("worked", 2)], now);
    assert.equal(two.confidence, "likely");

    const five = dealConfidence(
      [1, 2, 3, 4, 5].map((day) => report("worked", day)),
      now,
    );
    assert.equal(five.confidence, "verified");
  });

  it("lets recent failures outweigh a pile of old successes", () => {
    /* Forty confirmations last term and two failures this week means the deal
       is broken. A naive ratio would still call it verified. */
    const reports = [
      ...Array.from({ length: 40 }, (_, index) => report("worked", 120 + index)),
      report("did-not-work", 1),
      report("did-not-work", 2),
    ];

    assert.equal(dealConfidence(reports, now).confidence, "disputed");
  });

  it("marks a recently expired deal as expired", () => {
    const reports = [report("worked", 60), report("expired", 3), report("expired", 5)];
    assert.equal(dealConfidence(reports, now).confidence, "expired");
  });

  it("reports when it was last confirmed", () => {
    const result = dealConfidence([report("worked", 3), report("worked", 9)], now);
    assert.ok(result.lastConfirmedAt?.startsWith("2026-09-07"));
  });
});

/* -------------------------------------------------------------------------- */

describe("settleBucket", () => {
  const entry = (id: string, paidBy: string, amountCents: number) => ({
    id,
    bucketId: "b1",
    userId: paidBy,
    label: id,
    amountCents,
    paidBy,
    createdAt: "2026-09-10T12:00:00Z",
  });

  it("splits to exactly the total, cents and all", () => {
    /* Three people splitting €10: naive rounding gives 3 × €3.33 = €9.99 and a
       bucket that never closes. */
    const { total, settlements } = settleBucket([entry("dinner", "a", 1_000)], ["a", "b", "c"]);

    assert.equal(total, 1_000);
    assert.equal(
      settlements.reduce((sum, row) => sum + row.shareCents, 0),
      1_000,
    );
  });

  it("nets the payer positive and the others negative", () => {
    const { settlements } = settleBucket([entry("taxi", "a", 1_200)], ["a", "b", "c"]);
    const a = settlements.find((row) => row.userId === "a")!;
    const b = settlements.find((row) => row.userId === "b")!;

    assert.equal(a.paidCents, 1_200);
    assert.equal(a.netCents, 800);
    assert.equal(b.netCents, -400);
    assert.equal(
      settlements.reduce((sum, row) => sum + row.netCents, 0),
      0,
      "the group must net to zero",
    );
  });

  it("handles several payers", () => {
    const { total, settlements } = settleBucket(
      [entry("food", "a", 2_000), entry("drinks", "b", 1_000)],
      ["a", "b"],
    );

    assert.equal(total, 3_000);
    assert.equal(settlements.find((row) => row.userId === "a")?.netCents, 500);
    assert.equal(settlements.find((row) => row.userId === "b")?.netCents, -500);
  });

  it("returns nothing for an empty group rather than dividing by zero", () => {
    const { settlements } = settleBucket([entry("x", "a", 500)], []);
    assert.equal(settlements.length, 0);
  });
});

/**
 * ============================================================================
 * NOTHING UNBUILT MAY BE SOLD
 * ----------------------------------------------------------------------------
 * `featureTier` was rendered verbatim as the public comparison table and the
 * in-app upgrade screen, in the present tense, as capabilities a paid plan
 * gives you today. Nineteen of its forty-three keys had no `assertFeature`
 * call, no `can.*` read and no interface anywhere in the codebase.
 *
 * So a checkout page was describing receipt scanning, offline city packs and
 * scenario planning — none of which exist. This is the guard that keeps the
 * list honest in both directions.
 * ============================================================================
 */
describe("what a plan is allowed to claim", () => {
  /** Every .ts/.tsx under src/, except the declaration file itself. */
  function sourceOutsideEntitlements(): string {
    const files: string[] = [];
    (function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !p.includes("entitlements.ts")) files.push(p);
      }
    })("src");
    return files.map((f) => readFileSync(f, "utf8")).join("\n");
  }

  /**
   * Whether a feature key appears as a whole word anywhere in the source.
   *
   * `String.raw` rather than a plain `"\\b"`, and that is not style. A `\b`
   * written with one backslash is the BACKSPACE character, not a word
   * boundary, and the resulting regex silently matches nothing — so every
   * feature reads as unenforced and the assertion below inverts itself. The
   * same corruption has already been found once in
   * `scripts/import-institutions.mjs`, where it had disabled a filter for
   * months. `String.raw` gives a real backslash whichever way the file is
   * written.
   */
  const mentions = (blob: string, feature: string) =>
    new RegExp(String.raw`\b` + feature + String.raw`\b`).test(blob);

  it("sells only features something actually enforces", () => {
    const blob = sourceOutsideEntitlements();

    const sold = sellableFeatures.filter((feature) => !mentions(blob, feature));

    assert.deepEqual(
      sold,
      [],
      `these appear on a pricing surface and are enforced nowhere: ${sold.join(", ")}`,
    );
  });

  it("keeps the unbuilt list from going stale once something ships", () => {
    /* The other direction, and the one that rots quietly: a feature gets built
       and nobody removes it from UNBUILT_FEATURES, so a real capability stays
       invisible on the pricing page forever. */
    const blob = sourceOutsideEntitlements();

    const shipped = UNBUILT_FEATURES.filter((feature) => mentions(blob, feature));

    assert.deepEqual(
      shipped,
      [],
      `these are built now and should be removed from UNBUILT_FEATURES: ${shipped.join(", ")}`,
    );
  });

  it("never offers an unbuilt feature as a reason to upgrade", () => {
    for (const tier of tierOrder) {
      for (const feature of featuresAddedBy(tier)) {
        assert.ok(isShipped(feature), `${tier} is sold on ${feature}, which does not exist`);
      }
    }
  });

  it("still describes every feature it declares, built or not", () => {
    /* The roadmap entries keep their copy — they are simply never rendered as
       a benefit. Losing the copy would lose the intent. */
    for (const feature of UNBUILT_FEATURES) {
      assert.ok(featureCopy[feature]?.label, `${feature} has no copy`);
      assert.ok(featureTier[feature], `${feature} has no tier`);
    }
  });
});
