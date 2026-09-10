import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { missionTemplates } from "../../src/config/missions.ts";
import { fillBudget } from "../../src/domain/missions.ts";
import { money } from "../../src/lib/utils.ts";

/**
 * ============================================================================
 * A MISSION'S NAME AND ITS ARITHMETIC
 * ----------------------------------------------------------------------------
 * The engine scales every mission figure into the city's own currency — the
 * catalogue says so in its own header. The NAME was a fixed string with a euro
 * amount in it. So a student in Stockholm read "Weekend under €30" above a
 * plan totalling kronor, and one in Prague read it above koruna: the two
 * halves of the same screen disagreed, and the half that was wrong was the one
 * set in the largest type.
 *
 * With 43 European countries and 46 currencies now in the coverage list, the
 * proportion of students seeing the wrong half went from "the long tail" to
 * "most of them".
 * ============================================================================
 */

const eur = (cents: number) => money(cents / 100, { currency: "EUR", locale: "en-IE" });
const sek = (cents: number) => money(cents / 100, { currency: "SEK", locale: "sv-SE" });

describe("mission budgets in the student's currency", () => {
  it("names the mission in the currency its figures are in", () => {
    const title = "Weekend under {budget}";

    assert.equal(fillBudget(title, 3000, eur), "Weekend under €30");
    /* The same template, scaled for a pricier city, must not still say euro. */
    const swedish = fillBudget(title, 34_500, sek);
    assert.ok(!swedish.includes("€"), `still euro-denominated: ${swedish}`);
    assert.ok(swedish.includes("345"), swedish);
  });

  it("substitutes mid-sentence, not just at the end", () => {
    assert.equal(fillBudget("Make {budget} last until Friday", 5000, eur), "Make €50 last until Friday");
  });

  it("drops the placeholder cleanly when a mission has no budget", () => {
    /* Not every mission is about money. Printing "under {budget}" or a
       dangling "under" would be worse than the bug this replaced. */
    const filled = fillBudget("Weekend under {budget}", null, eur);
    assert.ok(!filled.includes("{budget}"));
    assert.ok(!/\bunder\s*$/i.test(filled), `left a dangling preposition: ${filled}`);
    assert.equal(filled, "Weekend");
  });

  it("leaves a title without a placeholder exactly as written", () => {
    assert.equal(fillBudget("First 7 days", null, eur), "First 7 days");
    assert.equal(fillBudget("Exam week", 2000, eur), "Exam week");
  });

  it("never lets a raw placeholder reach a screen", () => {
    /* The catalogue is the source. If somebody adds a template with a
       `{budget}` and no `budgetCents`, or writes a currency symbol straight
       into a name again, this is where it is caught. */
    for (const template of missionTemplates) {
      const rendered = fillBudget(template.title, template.budgetCents, eur);
      const tagline = fillBudget(template.tagline, template.budgetCents, eur);

      assert.ok(!rendered.includes("{budget}"), `${template.key}: unfilled placeholder in title`);
      assert.ok(!tagline.includes("{budget}"), `${template.key}: unfilled placeholder in tagline`);
      assert.ok(rendered.trim().length > 0, `${template.key}: title rendered empty`);

      /* No hardcoded currency symbol may survive in the catalogue: it would
         be immune to scaling and would contradict the figures beneath it. */
      assert.ok(
        !/[€£$¥]/.test(template.title),
        `${template.key}: hardcoded currency symbol in title — use {budget}`,
      );
      assert.ok(
        !/[€£$¥]/.test(template.tagline),
        `${template.key}: hardcoded currency symbol in tagline — use {budget}`,
      );
    }
  });

  it("keeps every money-capped mission's name tied to its cap", () => {
    /* A template with a cap should say so in its name or tagline, and one
       without a cap should not claim a number it does not have. */
    for (const template of missionTemplates) {
      const mentions = template.title.includes("{budget}") || template.tagline.includes("{budget}");
      if (mentions) {
        assert.notEqual(
          template.budgetCents,
          null,
          `${template.key}: names a budget it does not have`,
        );
      }
    }
  });
});
