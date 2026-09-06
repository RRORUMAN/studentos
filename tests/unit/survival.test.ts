import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { City } from "../../src/data/types.ts";
import { buildSurvivalPlan, previewSurvivalPlan } from "../../src/server/engines/survival.ts";

/**
 * ============================================================================
 * SURVIVAL MODE
 * ----------------------------------------------------------------------------
 * The highest-stakes screen in the product. A student opening it is worried and
 * needs a number they can act on, so the invariants here are not cosmetic:
 *
 *   - food is allocated before anything discretionary
 *   - the buffer is never zero
 *   - the plan never allocates more than the student actually has
 *   - when the money genuinely does not stretch, it says so
 * ============================================================================
 */

const MADRID: City = {
  slug: "madrid",
  name: "Madrid",
  country: "Spain",
  countryCode: "ES",
  currency: { code: "EUR", symbol: "€" },
  status: "live",
  locale: "es-ES",
  timezone: "Europe/Madrid",
  languages: ["Spanish", "English"],
  hook: "",
  intro: "",
  anchors: {
    lunch: [8, 13],
    pint: [2.5, 5],
    monthlyTransport: 20,
    weeklyGroceries: [28, 45],
    singleFare: 1.5,
  },
  neighbourhoods: ["Malasaña"],
  campusSlugs: ["ucm"],
  transport: { card: "Abono Joven", studentNote: "", officialUrl: "" },
  mapSeed: 11,
};

describe("buildSurvivalPlan", () => {
  it("never allocates more than the student has", () => {
    for (const amount of [500, 1_500, 4_200, 9_000, 15_000]) {
      for (const days of [1, 2, 4, 7, 14]) {
        const plan = buildSurvivalPlan({ amountCents: amount, days, city: MADRID });
        assert.ok(
          plan.allocatedCents <= amount,
          `allocated ${plan.allocatedCents} of ${amount} over ${days} days`,
        );
      }
    }
  });

  it("allocates every cent — money not spent goes back to the buffer", () => {
    const plan = buildSurvivalPlan({ amountCents: 4_200, days: 4, city: MADRID });
    assert.equal(plan.allocatedCents, 4_200);
  });

  it("always keeps a buffer, even on a tiny amount", () => {
    for (const amount of [300, 800, 2_000]) {
      const plan = buildSurvivalPlan({ amountCents: amount, days: 3, city: MADRID });
      const buffer = plan.lines.find((line) => line.key === "buffer");
      assert.ok(
        (buffer?.amountCents ?? 0) > 0,
        `buffer must never be zero (amount ${amount})`,
      );
    }
  });

  it("feeds the student before anything discretionary", () => {
    const plan = buildSurvivalPlan({ amountCents: 4_200, days: 4, city: MADRID });
    const groceries = plan.lines.find((line) => line.key === "groceries")!;
    const meals = plan.lines.find((line) => line.key === "meals")!;

    assert.ok(groceries.amountCents > 0, "groceries must be funded");
    assert.ok(
      groceries.amountCents >= meals.amountCents,
      "cooking is funded ahead of eating out",
    );
  });

  it("keeps activities free at every amount", () => {
    for (const amount of [1_000, 5_000, 20_000]) {
      const plan = buildSurvivalPlan({ amountCents: amount, days: 5, city: MADRID });
      const activities = plan.lines.find((line) => line.key === "activities")!;
      assert.equal(activities.amountCents, 0);
      assert.equal(activities.free, true);
    }
  });

  it("flags a genuinely tight plan rather than quietly shrinking food", () => {
    /* €9 for four days does not cover a Madrid shop. The plan has to say so. */
    const plan = buildSurvivalPlan({ amountCents: 900, days: 4, city: MADRID });
    assert.equal(plan.tight, true);
    assert.match(plan.verdict, /under a normal food shop|nothing spare/i);
  });

  it("does not flag a comfortable plan as tight", () => {
    const plan = buildSurvivalPlan({ amountCents: 12_000, days: 3, city: MADRID });
    assert.equal(plan.tight, false);
  });

  it("charges no transport when the student already has a pass", () => {
    const plan = buildSurvivalPlan({
      amountCents: 6_000,
      days: 5,
      city: MADRID,
      hasTransportPass: true,
    });
    const transport = plan.lines.find((line) => line.key === "transport")!;
    assert.equal(transport.amountCents, 0);
    assert.match(transport.basis, /pass/i);
  });

  it("gives concrete, ordered moves", () => {
    const plan = buildSurvivalPlan({ amountCents: 4_200, days: 4, city: MADRID });
    assert.ok(plan.moves.length >= 3);
    assert.match(plan.moves[0], /shop once/i);
  });

  it("treats a zero-day request as one day rather than dividing by zero", () => {
    const plan = buildSurvivalPlan({ amountCents: 2_000, days: 0, city: MADRID });
    assert.equal(plan.days, 1);
    assert.ok(Number.isFinite(plan.perDayCents));
  });
});

describe("previewSurvivalPlan", () => {
  it("keeps the free lines visible for a free user", () => {
    const preview = previewSurvivalPlan({ amountCents: 4_200, days: 4, city: MADRID });
    const activities = preview.lines.find((line) => line.label === "Things to do");

    /* "This part costs nothing" is the most useful thing on the screen, so it
       is never withheld behind the paywall. */
    assert.equal(activities?.free, true);
    assert.ok(preview.verdict.length > 0);
  });
});
