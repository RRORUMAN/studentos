import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { interfaceLanguages } from "../../src/config/regions.ts";
import { formatLocaleFor } from "../../src/lib/locale.ts";
import { money } from "../../src/lib/utils.ts";

/**
 * ============================================================================
 * THE PICKER SAYS WHAT IT DOES NOW
 * ----------------------------------------------------------------------------
 * Onboarding offered sixteen "interface languages" under the hint "Prices and
 * dates always use the city's format. This only changes the interface."
 *
 * Both halves were the opposite of the truth. There is no translation layer in
 * this codebase — no dictionary, no message catalogue, no `t()` — so the
 * interface is in English whatever is chosen. What the choice DOES do is feed
 * `formatLocaleFor`, which sets `profile.locale`, which formats every price
 * and every date in the product.
 *
 * So the control was real, useful, and described backwards. It is named for
 * its effect now, and these tests pin the effect — because a control whose
 * label is a promise needs the promise to be checkable.
 * ============================================================================
 */

const MADRID = { locale: "es-ES", currency: { code: "EUR" } };
const LONDON = { locale: "en-GB", currency: { code: "GBP" } };
const NEW_YORK = { locale: "en-US", currency: { code: "USD" } };

describe("the format a student picked", () => {
  it("actually changes how a price is written", () => {
    /* The claim on the label. If these two ever produce the same string the
       control does nothing and the label is a lie again. */
    const german = money(1234.5, { currency: "EUR", locale: formatLocaleFor("de", MADRID) });
    const english = money(1234.5, { currency: "EUR", locale: formatLocaleFor("en", MADRID) });

    assert.notEqual(german, english, `both rendered as ${german}`);
    assert.ok(german.includes("1.234"), `German grouping expected, got ${german}`);
    assert.ok(english.includes("1,234"), `English grouping expected, got ${english}`);
  });

  it("keeps the city's currency whatever the student picked", () => {
    /* The half of the old hint that was almost right: the CURRENCY is the
       city's and is not up for selection. A student in London reading German
       formatting still sees pounds, because that is what they will be charged. */
    const value = money(20, { currency: "GBP", locale: formatLocaleFor("de", LONDON) });
    assert.ok(value.includes("£") || value.toUpperCase().includes("GBP"), value);
  });

  it("gives every offered language a locale Intl accepts", () => {
    /* Sixteen options in a select, and any one of them reaching `Intl` as an
       unsupported tag would throw on a page that renders a price — which is
       every page. */
    for (const language of interfaceLanguages) {
      for (const city of [MADRID, LONDON, NEW_YORK]) {
        const locale = formatLocaleFor(language.code, city);
        assert.doesNotThrow(
          () => money(9.99, { currency: city.currency.code, locale }),
          `${language.code} produced an unusable locale: ${locale}`,
        );
      }
    }
  });

  it("prefers the city's own locale when the language matches it", () => {
    /* A Spanish speaker in Madrid gets es-ES rather than a bare "es": the
       regional tag carries the conventions they actually see around them. */
    assert.equal(formatLocaleFor("es", MADRID), "es-ES");
  });

  it("splits English by where the student is", () => {
    assert.equal(formatLocaleFor("en", NEW_YORK), "en-US");
    assert.equal(formatLocaleFor("en", MADRID), "en-GB");
  });
});
