import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planTotal } from "../../src/domain/types.ts";
import { PRICE_NOT_LISTED, priceLabel } from "../../src/lib/utils.ts";

/**
 * ============================================================================
 * "NOBODY SAID" IS NOT "FREE"
 * ----------------------------------------------------------------------------
 * An ICS feed has no price field. Every event imported from a calendar
 * therefore arrives with no price at all — and `CityEvent.priceCents` was
 * `Cents`, not `Cents | null`, so the ingest wrote `priceCents ?? 0` for all of
 * them. `event-card.tsx` then printed a solid mint "Free" badge over each one.
 *
 * The header of `src/server/events/providers.ts` stated the rule it could not
 * keep: "PRICE IS NULLABLE, AND NULL IS NOT ZERO... 'Free' is a claim and a
 * calendar entry does not make one." The only record of the difference was a
 * counter on the import run, which no student ever sees.
 *
 * A student turning up to something they were told was free and being asked
 * for twelve euro at the door is the product inventing a fact about money.
 *
 * These tests pin the three ways that zero and null must part company:
 * the LABEL, the TOTAL, and the promise a budget verdict makes.
 * ============================================================================
 */

const eur = { currency: "EUR", locale: "en-IE" };

describe("an unpriced row is not a free row", () => {
  it("labels the three states differently", () => {
    assert.equal(priceLabel(0, eur), "Free");
    assert.equal(priceLabel(1200, eur), "€12");
    assert.equal(priceLabel(null, eur), PRICE_NOT_LISTED);
  });

  it("never labels an unknown price as free, in any currency", () => {
    for (const where of [eur, { currency: "SEK", locale: "sv-SE" }, { currency: "JPY", locale: "ja-JP" }]) {
      assert.equal(priceLabel(null, where), PRICE_NOT_LISTED);
      assert.notEqual(priceLabel(null, where), priceLabel(0, where));
    }
  });

  it("keeps a plan total separate from the stops it could not price", () => {
    const items = [
      { priceCents: 1200 },
      { priceCents: 0 },
      { priceCents: null },
      { priceCents: 800 },
    ];

    const { cents, unpriced } = planTotal(items);

    /* The unpriced stop contributes nothing and is COUNTED, rather than
       silently treated as zero — which is what `sum + (item.priceCents ?? 0)`
       would have done at each of the three call sites. */
    assert.equal(cents, 2000);
    assert.equal(unpriced, 1);
  });

  it("reports a fully priced plan as having nothing missing", () => {
    const { cents, unpriced } = planTotal([{ priceCents: 500 }, { priceCents: 0 }]);
    assert.equal(cents, 500);
    assert.equal(unpriced, 0);
  });

  it("does not call an all-unpriced plan free", () => {
    /* The sharpest case: every stop unknown sums to zero, and zero is the
       exact value that means "free" everywhere else in the product. The count
       is the only thing separating them, which is why it is returned. */
    const { cents, unpriced } = planTotal([{ priceCents: null }, { priceCents: null }]);
    assert.equal(cents, 0);
    assert.equal(unpriced, 2, "a zero total with unpriced stops must be distinguishable from free");
  });

  it("treats an empty plan as free rather than unknown", () => {
    const { cents, unpriced } = planTotal([]);
    assert.equal(cents, 0);
    assert.equal(unpriced, 0);
  });
});
