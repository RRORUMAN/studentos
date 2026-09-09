import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Place } from "../../src/data/types.ts";
import type { Transaction } from "../../src/domain/types.ts";
import { isCheapPlace } from "../../src/domain/places.ts";
import { findSavings } from "../../src/server/engines/savings.ts";

/**
 * ============================================================================
 * "SOMEWHERE CHEAPER", ON A PROVIDER THAT PUBLISHES NO PRICES
 * ----------------------------------------------------------------------------
 * The regression this file exists for.
 *
 * Every "cheap" path in the product tested `priceLevel !== null &&
 * priceLevel <= 1`. That is right against the twenty-five invented places,
 * which all carried a price level, and empty against the real ones:
 * OpenStreetMap has no price field, so the adapter sets `priceLevel: null` on
 * every row. Explore's cheap filter and Ask's "somewhere cheaper" therefore
 * returned nothing — in every city, for every deployment without a Google
 * Places key — and an empty list reads as "there is nowhere cheap here", which
 * is a claim about the city rather than about our data.
 *
 * THE FIXTURES ARE SHAPED LIKE REAL OSM ROWS: a genuine `cheap-eat` category
 * and no price level. A test whose fixtures carry a price level cannot catch
 * this, and the existing ones all did.
 * ============================================================================
 */

const NOW = new Date("2026-03-04T12:00:00.000Z");

/** A place as the OpenStreetMap adapter actually produces one. */
function osmPlace(overrides: Partial<Place> & { metres?: number } = {}): Place {
  const { metres = 400, ...rest } = overrides;
  return {
    id: "p1",
    citySlug: "madrid",
    name: "Casa Toni",
    category: "Cheap eat",
    categoryKey: "cheap-eat",
    layers: ["cheap-food"],
    /* THE POINT OF THIS FIXTURE. OpenStreetMap has no price data. */
    priceLevel: null,
    proximity: { kind: "straight-line", metres, minutes: null },
    value: { band: "good", reasons: [] },
    confirmations: 0,
    saves: 0,
    lat: 40.4168,
    lng: -3.7038,
    address: null,
    brand: null,
    website: null,
    phone: null,
    openingHours: null,
    rating: null,
    ratingCount: null,
    provider: "osm",
    sourceUrl: "https://www.openstreetmap.org/node/1",
    attribution: "© OpenStreetMap contributors",
    confidence: "recent",
    fetchedAt: NOW.toISOString(),
    ...rest,
  };
}

describe("what counts as cheap", () => {
  it("accepts a real cheap-eat that carries no price level at all", () => {
    /* The exact row the old rule rejected, and the reason Explore's cheap
       filter and Ask both came back empty on the default provider. */
    assert.equal(isCheapPlace(osmPlace()), true);
  });

  it("still accepts a provider price band where one exists", () => {
    /* A Google-backed deployment keeps the stronger signal. */
    assert.equal(isCheapPlace({ layers: ["everyday"], priceLevel: 1 }), true);
    assert.equal(isCheapPlace({ layers: ["everyday"], priceLevel: 0 }), true);
  });

  it("refuses a place that is neither", () => {
    /* The guard has to stay a guard. A restaurant with no price data is not
       evidence of being cheap, and treating it as such would be exactly the
       fabrication this layer exists to prevent. */
    assert.equal(isCheapPlace({ layers: ["everyday"], priceLevel: null }), false);
    assert.equal(isCheapPlace({ layers: ["nightlife"], priceLevel: 3 }), false);
  });

  it("does not treat an expensive band as cheap just because it is known", () => {
    assert.equal(isCheapPlace({ layers: ["everyday"], priceLevel: 2 }), false);
  });
});

/* -------------------------------------------------------------------------- */
/* The saving figure itself                                                    */
/* -------------------------------------------------------------------------- */

/** Enough lunches, dear enough, to be an opportunity rather than an anecdote. */
function lunches(amountCents: number, count = 6): Transaction[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `t${index}`,
    userId: "u1",
    category: "eating-out",
    amountCents,
    merchant: null,
    note: null,
    spentAt: new Date(NOW.getTime() - (index + 1) * 86_400_000).toISOString(),
    source: "manual" as const,
    receiptId: null,
    createdAt: NOW.toISOString(),
  }));
}

const money = (cents: number) => `€${(cents / 100).toFixed(2)}`;

describe("stating a saving in euro", () => {
  it("refuses to name a figure from places nobody has reported a price for", () => {
    /**
     * THIS IS NOT THE BUG ABOVE, it is the rule that survived it. Qualifying a
     * place as cheap is a claim about the place; naming a weekly saving is a
     * claim about an amount, and no provider publishes one. Two reported
     * prices are the floor, and with none there is no figure — the caller
     * falls through to `cheapOptions`, which suggests without claiming.
     */
    const found = findSavings({
      now: NOW,
      transactions: lunches(1_400),
      places: [osmPlace(), osmPlace({ id: "p2", name: "El Brillante", metres: 500 })],
      priceObservations: [],
      maxWalkMinutes: 15,
      formatMoney: money,
    });

    assert.deepEqual(found, []);
  });

  it("says nothing at all when there are too few transactions to mean anything", () => {
    /* Four is the floor. Three lunches is an anecdote, and the engine will not
       build a weekly figure out of one. */
    const found = findSavings({
      now: NOW,
      transactions: lunches(1_400, 3),
      places: [osmPlace()],
      priceObservations: [],
      maxWalkMinutes: 15,
      formatMoney: money,
    });

    assert.deepEqual(found, []);
  });
});
