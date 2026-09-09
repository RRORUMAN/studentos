import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  costOf,
  describeList,
  describePlan,
  parseAsk,
  parseBudgetCents,
} from "../../src/server/engines/ask.ts";

/**
 * ============================================================================
 * ASK — parsing and description
 * ----------------------------------------------------------------------------
 * Query understanding is deterministic, which is both cheaper and more reliable
 * than asking a language model to extract "€20" from a sentence.
 *
 * The `describePlan` tests pin a real bug that shipped and was caught in
 * review: a list answer has no computed total, and describing it with the plan
 * wording announced "all of this is free" over a list of priced rows.
 * ============================================================================
 */

describe("parseBudgetCents", () => {
  it("reads the common money formats", () => {
    assert.equal(parseBudgetCents("What can I do tonight for €20?"), 2_000);
    assert.equal(parseBudgetCents("dinner under 15 euros"), 1_500);
    assert.equal(parseBudgetCents("£8.50 lunch"), 850);
    assert.equal(parseBudgetCents("$12 max"), 1_200);
    assert.equal(parseBudgetCents("I have 40e left"), 4_000);
  });

  it("does not mistake counts for budgets", () => {
    /* "2 people" and "3 days" are the two most common false positives, and
       reading either as money produces a confidently wrong answer. */
    assert.equal(parseBudgetCents("find something for 2 people"), null);
    assert.equal(parseBudgetCents("what is on in 3 days"), null);
  });

  it("reads a bare number only when the sentence is about money", () => {
    assert.equal(parseBudgetCents("make 40 last until Friday"), 4_000);
    assert.equal(parseBudgetCents("football at 5"), null);
  });

  it("ignores an implausibly large bare number", () => {
    /* 900 in a sentence like this is a rent figure, not tonight's budget. */
    assert.equal(parseBudgetCents("my budget is 900"), null);
  });
});

describe("parseAsk", () => {
  it("treats natural phrasings as a request for a plan", () => {
    for (const query of [
      "What can I do tonight for €20?",
      "what should i do this weekend",
      "plan Saturday",
      "things to do tonight",
    ]) {
      const parsed = parseAsk(query);
      assert.ok(
        parsed.intent.startsWith("plan"),
        `"${query}" should build a plan, got ${parsed.intent}`,
      );
    }
  });

  it("extracts the time horizon", () => {
    assert.equal(parseAsk("what is free tonight").when, "tonight");
    assert.equal(parseAsk("plan my weekend").when, "weekend");
    assert.equal(parseAsk("something this week").when, "week");
    assert.equal(parseAsk("cheap gym").when, "any");
  });

  it("detects a free-only question", () => {
    assert.equal(parseAsk("what is free tonight").freeOnly, true);
    assert.equal(parseAsk("I am broke, what can I do").freeOnly, true);
    assert.equal(parseAsk("cheap dinner").freeOnly, false);
  });

  it("routes official questions away from generation", () => {
    for (const query of ["how do I register my address", "what do I need for residency"]) {
      assert.equal(parseAsk(query).intent, "arrival-question");
    }
  });

  it("classifies the practical categories", () => {
    assert.equal(parseAsk("where should I buy groceries").intent, "find-groceries");
    assert.equal(parseAsk("somewhere quiet to study").intent, "find-study");
    assert.equal(parseAsk("cheap lunch near campus").intent, "find-food");
    assert.equal(parseAsk("make €45 last until Friday").intent, "budget-question");
  });

  it("strips money and stop words from the keywords", () => {
    const parsed = parseAsk("find me a cheap pizza place for €10");
    assert.ok(parsed.keywords.includes("pizza"));
    assert.ok(!parsed.keywords.includes("find"));
    assert.ok(!parsed.keywords.some((word) => /\d/.test(word)));
  });
});

/* -------------------------------------------------------------------------- */

/** A plan line with a published price. */
const line = (title: string, priceCents: number) => ({
  kind: "activity" as const,
  title,
  detail: "",
  priceCents,
  estimateCents: null,
  estimateBasis: null,
  metres: null,
  refKind: null,
  refId: null,
  source: "students" as const,
});

/** A plan line nobody published a price for, carrying a city-anchor estimate. */
const estimated = (title: string, low: number, high: number) => ({
  kind: "food" as const,
  title,
  detail: "",
  priceCents: null,
  estimateCents: [low, high] as [number, number],
  estimateBasis: "city-anchor" as const,
  metres: 400,
  refKind: "place" as const,
  refId: "osm:node/1",
  source: "provider" as const,
});

/** A plan line with no price and no basis for estimating one. */
const unpriced = (title: string) => ({
  kind: "activity" as const,
  title,
  detail: "",
  priceCents: null,
  estimateCents: null,
  estimateBasis: null,
  metres: null,
  refKind: null,
  refId: null,
  source: "provider" as const,
});

const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;

describe("describePlan", () => {
  it("only claims free when every line is actually free", () => {
    const summary = describePlan({
      lines: [line("Prado", 0), line("Café", 220), line("Menú", 500)],
      cost: costOf([line("Prado", 0), line("Café", 220), line("Menú", 500)]),
      budgetCents: 2_000,
      formatMoney: fmt,
    });

    assert.doesNotMatch(summary, /all of this is free/i);
    assert.match(summary, /€7\.20/);
  });

  it("says all free when it genuinely is", () => {
    const summary = describePlan({
      lines: [line("Prado", 0), line("Retiro", 0)],
      cost: costOf([line("Prado", 0), line("Retiro", 0)]),
      budgetCents: 2_000,
      formatMoney: fmt,
    });

    assert.match(summary, /all of this is free/i);
  });

  it("reports the leftover against a stated budget", () => {
    const summary = describePlan({
      lines: [line("Menú", 500)],
      cost: costOf([line("Menú", 500)]),
      budgetCents: 2_000,
      formatMoney: fmt,
    });

    assert.match(summary, /€15\.00 left over/);
  });

  /* The three tests below are the reason `PlanCost` has three fields instead
     of one number. Each is a different claim, and merging them was how a plan
     came to announce a total for an evening nobody had priced. */

  it("never merges an estimate into the total", () => {
    const lines = [line("Prado", 0), estimated("Casa Paco", 800, 1_300)];
    const summary = describePlan({
      lines,
      cost: costOf(lines),
      budgetCents: 3_000,
      formatMoney: fmt,
    });

    assert.match(summary, /about €8\.00–€13\.00/, "the estimate is stated as a range");
    assert.match(summary, /estimate/i, "and it is labelled as an estimate");
    assert.doesNotMatch(summary, /€13\.00 in total/, "never presented as a total");
  });

  it("does not claim a plan is free when nothing was priced", () => {
    const lines = [unpriced("A supermarket"), unpriced("A park")];
    const cost = costOf(lines);

    assert.equal(cost.totalCents, 0);
    assert.equal(cost.unpricedLines, 2);

    const summary = describePlan({ lines, cost, budgetCents: 2_000, formatMoney: fmt });
    assert.doesNotMatch(
      summary,
      /all of this is free/i,
      "a zero total from unpriced rows is not a free plan",
    );
    assert.match(summary, /no published price/i);
  });

  it("keeps known money and estimated money apart in the cost", () => {
    const cost = costOf([line("Ticket", 1_200), estimated("Dinner", 900, 1_500), unpriced("Walk")]);

    assert.equal(cost.totalCents, 1_200);
    assert.equal(cost.estimateLowCents, 900);
    assert.equal(cost.estimateHighCents, 1_500);
    assert.equal(cost.unpricedLines, 1);
  });
});

describe("describeList", () => {
  it("reports a price range rather than a meaningless total", () => {
    const summary = describeList({
      lines: [line("A", 500), line("B", 850), line("C", 0)],
      formatMoney: fmt,
      cityName: "Madrid",
    });

    assert.match(summary, /1 free/);
    assert.match(summary, /€5\.00–€8\.50/);
    assert.doesNotMatch(summary, /total/i);
  });

  it("handles an all-free list", () => {
    const summary = describeList({
      lines: [line("A", 0), line("B", 0)],
      formatMoney: fmt,
      cityName: "Madrid",
    });
    assert.match(summary, /every one is free/i);
  });

  it("names the city when there is nothing", () => {
    assert.match(describeList({ lines: [], formatMoney: fmt, cityName: "Madrid" }), /Madrid/);
  });
});
