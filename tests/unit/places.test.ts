import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MIN_VALUE_SIGNALS,
  categoriesFor,
  dedupePlaces,
  describeProximity,
  distanceMetres,
  formatDistance,
  freshnessLabel,
  layersFor,
  mercator,
  openStateFrom,
  positionIn,
  priceLevelLabel,
  rankPlaces,
  straightLine,
  studentValue,
  viewportFor,
  wantsCheap,
  type RealPlace,
} from "../../src/domain/places.ts";
import { buildLookupQuery, buildQuery, parseElements } from "../../src/server/places/osm.ts";
import { cacheKey, snapRadius } from "../../src/server/places/cache.ts";

/**
 * ============================================================================
 * PLACES
 * ----------------------------------------------------------------------------
 * The rules that keep a real-world recommendation honest, pinned as tests.
 *
 * Most of these exist because the previous version of this product did the
 * opposite of what is asserted here, and every one of those was invisible on
 * screen: a walking time that was a haversine, a value score computed from
 * nothing, a confirmation count with no students behind it.
 * ============================================================================
 */

const NOW = new Date("2026-09-09T12:00:00.000Z");

function realPlace(overrides: Partial<RealPlace> = {}): RealPlace {
  return {
    id: "osm:node/1",
    provider: "osm",
    providerPlaceId: "node/1",
    name: "Mercadona",
    category: "supermarket",
    subcategories: [],
    address: null,
    lat: 40.4168,
    lng: -3.7038,
    brand: null,
    website: null,
    phone: null,
    openingHours: null,
    rating: null,
    ratingCount: null,
    priceLevel: null,
    sourceUrl: "https://www.openstreetmap.org/node/1",
    fetchedAt: NOW.toISOString(),
    attribution: "© OpenStreetMap contributors",
    confidence: "recent",
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Distance is not travel time                                                 */
/* -------------------------------------------------------------------------- */

describe("proximity", () => {
  it("measures a real distance", () => {
    /* Puerta del Sol to the Prado, which is about 1.2 km on the map. */
    const metres = distanceMetres({ lat: 40.4169, lng: -3.7035 }, { lat: 40.4138, lng: -3.6921 });
    assert.ok(metres > 900 && metres < 1_300, `expected ~1 km, got ${Math.round(metres)} m`);
  });

  it("NEVER turns a straight line into a duration", () => {
    const proximity = straightLine({ lat: 40.4169, lng: -3.7035 }, { lat: 40.4138, lng: -3.6921 });

    assert.equal(proximity.kind, "straight-line");
    assert.equal(
      proximity.minutes,
      null,
      "a haversine is a distance; only a router may produce minutes",
    );
    assert.match(describeProximity(proximity), /away$/);
    assert.doesNotMatch(describeProximity(proximity), /walk/);
  });

  it("says minutes only when something routed", () => {
    const routed = describeProximity({ kind: "walking-route", metres: 900, minutes: 12 });
    assert.match(routed, /12 min walk/);
  });

  it("rounds metres coarsely and kilometres to one decimal", () => {
    assert.equal(formatDistance(4), "10 m");
    assert.equal(formatDistance(340), "340 m");
    assert.equal(formatDistance(1_240), "1.2 km");
  });
});

/* -------------------------------------------------------------------------- */
/* Student value                                                               */
/* -------------------------------------------------------------------------- */

describe("studentValue", () => {
  const none = {
    metres: null,
    priceLevel: null,
    rating: null,
    ratingCount: null,
    saves: 0,
    confirmations: 0,
    hasVerifiedDeal: false,
  };

  it("says it does not know, rather than guessing, below the signal floor", () => {
    const value = studentValue({ ...none, metres: 300 });
    assert.equal(value.band, "insufficient");
    assert.deepEqual(value.reasons, [], "no reasons, because there is nothing to say");
  });

  it("needs two independent signals before it says anything", () => {
    const one = studentValue({ ...none, metres: 200 });
    const two = studentValue({ ...none, metres: 200, priceLevel: 1 });

    assert.equal(one.band, "insufficient");
    assert.notEqual(two.band, "insufficient");
    assert.equal(MIN_VALUE_SIGNALS, 2);
  });

  it("ignores a rating with almost nobody behind it", () => {
    const thin = studentValue({ ...none, metres: 200, rating: 5, ratingCount: 2 });
    assert.equal(
      thin.band,
      "insufficient",
      "a 5.0 from two reviews is not a second signal",
    );
  });

  it("counts a rating with enough people behind it", () => {
    const value = studentValue({ ...none, metres: 200, rating: 4.6, ratingCount: 400 });
    assert.notEqual(value.band, "insufficient");
    assert.ok(value.reasons.some((reason) => reason.includes("4.6")));
  });

  it("cannot reach the top band on two signals alone", () => {
    /* Both signals at their maximum still only score four, and `strong` needs
       five. That is the intended shape: "strong student value" is a claim that
       several different things agree, and two of them agreeing is "good". */
    const two = studentValue({ ...none, metres: 100, rating: 4.9, ratingCount: 900 });
    assert.equal(two.band, "good");

    const three = studentValue({
      ...none,
      metres: 100,
      rating: 4.9,
      ratingCount: 900,
      confirmations: 6,
    });
    assert.equal(three.band, "strong");
  });

  it("every reason names the signal it came from", () => {
    const value = studentValue({
      ...none,
      metres: 150,
      priceLevel: 1,
      saves: 9,
      confirmations: 4,
      hasVerifiedDeal: true,
    });

    assert.equal(value.band, "strong");
    assert.ok(value.reasons.length > 0 && value.reasons.length <= 3);
    for (const reason of value.reasons) {
      assert.ok(reason.length > 0);
      assert.doesNotMatch(reason, /\d+(\.\d+)?%/, "never a percentage");
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Layers                                                                      */
/* -------------------------------------------------------------------------- */

describe("layersFor", () => {
  it("treats free as free to enter, not as cheap", () => {
    assert.ok(layersFor("park", { priceLevel: null, hasVerifiedDeal: false }).includes("free"));
    assert.ok(layersFor("library", { priceLevel: null, hasVerifiedDeal: false }).includes("free"));
    assert.ok(
      !layersFor("cheap-eat", { priceLevel: 1, hasVerifiedDeal: false }).includes("free"),
      "a cheap kebab is not free",
    );
  });

  it("does not put a restaurant on the cheap rail without a price band", () => {
    const unknown = layersFor("restaurant", { priceLevel: null, hasVerifiedDeal: false });
    const cheap = layersFor("restaurant", { priceLevel: 1, hasVerifiedDeal: false });

    assert.ok(!unknown.includes("cheap-food"), "an unknown price is not a claim to be cheap");
    assert.ok(cheap.includes("cheap-food"));
  });

  it("puts a place on the deals rail only when a deal was verified", () => {
    assert.ok(!layersFor("cafe", { priceLevel: 2, hasVerifiedDeal: false }).includes("deals"));
    assert.ok(layersFor("cafe", { priceLevel: 2, hasVerifiedDeal: true }).includes("deals"));
  });
});

/* -------------------------------------------------------------------------- */
/* Opening hours                                                               */
/* -------------------------------------------------------------------------- */

describe("openStateFrom", () => {
  const MONDAY = 1;

  it("reads the ordinary OpenStreetMap grammar", () => {
    /* Mo-Sa 09:15-21:30, asked at 14:00 on a Monday. */
    const state = openStateFrom("Mo-Sa 09:15-21:30", MONDAY, 14 * 60);
    assert.equal(state.state, "open");
    assert.equal(state.state === "open" ? state.until : null, "21:30");
  });

  it("knows a day it is not open", () => {
    const state = openStateFrom("Mo-Sa 09:15-21:30", 0, 14 * 60);
    assert.equal(state.state, "closed");
  });

  it("says when it opens next on the same day", () => {
    const state = openStateFrom("Mo-Fr 09:00-17:00", MONDAY, 7 * 60);
    assert.equal(state.state, "closed");
    assert.equal(state.state === "closed" ? state.opensAt : null, "09:00");
  });

  it("handles 24/7", () => {
    assert.equal(openStateFrom("24/7", MONDAY, 3 * 60).state, "open");
  });

  it("REFUSES anything it does not fully understand", () => {
    /* Sunset offsets, public holidays and seasons are all real syntax this
       parser does not implement. Half-reading one and printing a time is how a
       student ends up outside a closed pharmacy at 22:00. */
    for (const rule of [
      "Mo-Su sunrise-sunset",
      "Apr-Sep Mo-Su 10:00-20:00; PH off",
      "Mo-Fr 09:00-17:00 open \"by appointment\"",
      "",
    ]) {
      assert.equal(openStateFrom(rule || null, MONDAY, 12 * 60).state, "unknown", rule);
    }
  });

  it("is unknown when there is no string at all", () => {
    assert.equal(openStateFrom(null, MONDAY, 12 * 60).state, "unknown");
  });
});

/* -------------------------------------------------------------------------- */
/* Price and freshness                                                         */
/* -------------------------------------------------------------------------- */

describe("price and freshness", () => {
  it("never invents an amount", () => {
    assert.equal(priceLevelLabel(null), "Price not listed");
    assert.equal(priceLevelLabel(1), "€");
    assert.equal(priceLevelLabel(4), "€€€€");
  });

  it("says when the row was checked", () => {
    const twoDays = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    assert.match(freshnessLabel(twoDays, NOW), /2 days ago/);
    assert.match(freshnessLabel(NOW.toISOString(), NOW), /last hour/);
  });
});

/* -------------------------------------------------------------------------- */
/* Projection                                                                  */
/* -------------------------------------------------------------------------- */

describe("projection", () => {
  it("puts the prime meridian and the equator in the middle", () => {
    const origin = mercator({ lat: 0, lng: 0 });
    assert.ok(Math.abs(origin.x - 0.5) < 1e-9);
    assert.ok(Math.abs(origin.y - 0.5) < 1e-9);
  });

  it("grows y downward as latitude falls", () => {
    assert.ok(mercator({ lat: 50, lng: 0 }).y < mercator({ lat: 40, lng: 0 }).y);
  });

  it("keeps relative geography true on the canvas", () => {
    /* Three points: one north-west, one centre, one south-east. Whatever the
       viewport, that ordering must survive projection — it is the entire
       reason the map stopped using hand-written percentages. */
    const points = [
      { lat: 40.43, lng: -3.72 },
      { lat: 40.42, lng: -3.70 },
      { lat: 40.41, lng: -3.68 },
    ];
    const viewport = viewportFor(points);
    assert.ok(viewport);

    const [nw, mid, se] = points.map((point) => positionIn(point, viewport));
    assert.ok(nw && mid && se);
    assert.ok(nw.left < mid.left && mid.left < se.left, "west to east");
    assert.ok(nw.top < mid.top && mid.top < se.top, "north to south");
  });

  it("refuses to place a point outside the viewport", () => {
    const viewport = viewportFor([{ lat: 40.42, lng: -3.7 }]);
    assert.ok(viewport);
    assert.equal(positionIn({ lat: 52.5, lng: 13.4 }, viewport), null);
  });

  it("does not zoom into a single street", () => {
    /* Five shops on one block would otherwise produce a hundred-metre
       viewport, which draws a block and looks like a city. */
    const viewport = viewportFor([
      { lat: 40.4168, lng: -3.7038 },
      { lat: 40.4169, lng: -3.7039 },
    ]);
    assert.ok(viewport);
    const spanMetres = distanceMetres(
      { lat: viewport.south, lng: viewport.west },
      { lat: viewport.north, lng: viewport.west },
    );
    assert.ok(spanMetres > 500, `expected a floor, got ${Math.round(spanMetres)} m`);
  });
});

/* -------------------------------------------------------------------------- */
/* De-duplication and ranking                                                  */
/* -------------------------------------------------------------------------- */

describe("dedupePlaces", () => {
  it("merges the same shop seen by two providers", () => {
    const osm = realPlace({ id: "osm:node/1", name: "Mercadona" });
    const google = realPlace({
      id: "google:abc",
      provider: "google",
      providerPlaceId: "abc",
      name: "Mercadona",
      lat: 40.41682,
      lng: -3.70382,
      rating: 4.2,
      ratingCount: 900,
      attribution: "Places data © Google",
    });

    const kept = dedupePlaces([[google], [osm]]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.provider, "google", "the first list wins");
    assert.equal(
      kept[0]?.attribution,
      "Places data © Google",
      "and it is NOT enriched from the other, which would make attribution a lie",
    );
  });

  it("keeps two branches of a chain on the same street apart", () => {
    /* 300 m apart. Merging them loses the nearer one, which is the whole
       answer to "where is the closest". */
    const a = realPlace({ id: "osm:node/1", lat: 40.4168, lng: -3.7038 });
    const b = realPlace({ id: "osm:node/2", providerPlaceId: "node/2", lat: 40.4195, lng: -3.7038 });
    assert.equal(dedupePlaces([[a, b]]).length, 2);
  });
});

describe("rankPlaces", () => {
  it("puts the nearer place first, and only breaks ties on value", () => {
    const near = {
      place: realPlace({ id: "near" }),
      proximity: { kind: "straight-line" as const, metres: 150, minutes: null },
      value: { band: "insufficient" as const, reasons: [] },
    };
    const farButGood = {
      place: realPlace({ id: "far" }),
      proximity: { kind: "straight-line" as const, metres: 1_400, minutes: null },
      value: { band: "strong" as const, reasons: ["Cheap for the category"] },
    };

    assert.equal(rankPlaces([farButGood, near])[0]?.place.id, "near");
  });

  it("prefers the better one inside the same distance band", () => {
    const plain = {
      place: realPlace({ id: "plain" }),
      proximity: { kind: "straight-line" as const, metres: 150, minutes: null },
      value: { band: "mixed" as const, reasons: [] },
    };
    const strong = {
      place: realPlace({ id: "strong" }),
      proximity: { kind: "straight-line" as const, metres: 180, minutes: null },
      value: { band: "strong" as const, reasons: ["Saved by 8 students"] },
    };

    assert.equal(rankPlaces([plain, strong])[0]?.place.id, "strong");
  });
});

/* -------------------------------------------------------------------------- */
/* Intent                                                                      */
/* -------------------------------------------------------------------------- */

describe("categoriesFor", () => {
  it("reads the obvious asks without a model", () => {
    assert.deepEqual(categoriesFor("cheap supermarket near me"), ["supermarket"]);
    assert.ok(categoriesFor("where is a pharmacy").includes("pharmacy"));
    assert.ok(categoriesFor("somewhere to study").includes("study-space"));
  });

  it("prefers the more specific phrase", () => {
    const hits = categoriesFor("cheap food tonight");
    assert.equal(hits[0], "cheap-eat", "'cheap food' beats the 'food' inside it");
  });

  it("finds nothing in a question about something else", () => {
    assert.deepEqual(categoriesFor("how do I register with the police"), []);
  });

  it("notices when the cheap end is being asked for", () => {
    assert.ok(wantsCheap("cheapest lunch near campus"));
    assert.ok(!wantsCheap("best lunch near campus"));
  });
});

/* -------------------------------------------------------------------------- */
/* The OpenStreetMap adapter                                                   */
/* -------------------------------------------------------------------------- */

describe("overpass query", () => {
  it("asks only for named objects", () => {
    const query = buildQuery({
      centre: { lat: 40.4168, lng: -3.7038 },
      radiusMetres: 1_500,
      categories: ["supermarket"],
      limit: 20,
    });

    assert.match(query, /\["name"\]/, "an unnamed dot is not a recommendation");
    assert.match(query, /nwr/, "nodes, ways and relations: a shop is a building in half of Europe");
    assert.match(query, /around:1500,40.4168,-3.7038/);
  });

  it("covers every requested category in ONE query", () => {
    const query = buildQuery({
      centre: { lat: 40.4168, lng: -3.7038 },
      radiusMetres: 800,
      categories: ["supermarket", "pharmacy", "cafe"],
      limit: 20,
    });

    assert.equal(query.split("nwr").length - 1, 3);
    assert.equal(query.split("[out:json]").length - 1, 1);
  });

  it("clamps a radius rather than sending an unbounded one", () => {
    const query = buildQuery({
      centre: { lat: 40.4168, lng: -3.7038 },
      radiusMetres: 99_000,
      categories: ["supermarket"],
      limit: 20,
    });
    assert.match(query, /around:5000,/);
  });

  it("refuses to interpolate an id it did not write", () => {
    /* The id arrives from a stored row and goes into a query language. */
    assert.equal(buildLookupQuery(["node/1; out; /*"]), "");
    assert.equal(buildLookupQuery(["../../etc/passwd"]), "");
    assert.match(buildLookupQuery(["node/26472667"]), /node\(id:26472667\);/);
  });

  it("groups a lookup by object type", () => {
    const query = buildLookupQuery(["node/1", "node/2", "way/3"]);
    assert.match(query, /node\(id:1,2\);/);
    assert.match(query, /way\(id:3\);/);
  });
});

describe("overpass parsing", () => {
  const ATTRIBUTION = "© OpenStreetMap contributors";

  it("normalises a real element", () => {
    const [place] = parseElements(
      [
        {
          type: "node",
          id: 624783119,
          lat: 40.4203315,
          lon: -3.6980193,
          tags: {
            brand: "Dia",
            name: "Dia",
            opening_hours: "Mo-Sa 09:15-21:30",
            operator: "Dia",
            shop: "supermarket",
            "addr:street": "Calle de Toledo",
            "addr:housenumber": "53",
          },
        },
      ],
      NOW.toISOString(),
      ATTRIBUTION,
    );

    assert.ok(place);
    assert.equal(place.name, "Dia");
    assert.equal(place.category, "supermarket");
    assert.equal(place.brand, "Dia");
    assert.equal(place.address, "Calle de Toledo 53");
    assert.equal(place.sourceUrl, "https://www.openstreetmap.org/node/624783119");
    assert.equal(place.attribution, ATTRIBUTION);
  });

  it("NEVER invents a rating or a price for OpenStreetMap data", () => {
    /* OSM publishes neither. A row that carries one means something in the
       adapter made a number up. */
    const [place] = parseElements(
      [{ type: "node", id: 1, lat: 40.4, lon: -3.7, tags: { name: "Bar Paco", amenity: "bar" } }],
      NOW.toISOString(),
      ATTRIBUTION,
    );

    assert.ok(place);
    assert.equal(place.rating, null);
    assert.equal(place.ratingCount, null);
    assert.equal(place.priceLevel, null);
  });

  it("drops anything with no name or no coordinate", () => {
    const places = parseElements(
      [
        { type: "node", id: 1, lat: 40.4, lon: -3.7, tags: { amenity: "bar" } },
        { type: "node", id: 2, tags: { name: "Nowhere", amenity: "bar" } },
        { type: "node", id: 3, lat: 40.4, lon: -3.7, tags: { name: "Unmapped kind", foo: "bar" } },
      ],
      NOW.toISOString(),
      ATTRIBUTION,
    );
    assert.equal(places.length, 0);
  });

  it("takes the centre point of a way", () => {
    const [place] = parseElements(
      [
        {
          type: "way",
          id: 42,
          center: { lat: 40.41, lon: -3.71 },
          tags: { name: "Mercado", amenity: "marketplace" },
        },
      ],
      NOW.toISOString(),
      ATTRIBUTION,
    );
    assert.ok(place);
    assert.equal(place.lat, 40.41);
    assert.equal(place.providerPlaceId, "way/42");
  });
});

/* -------------------------------------------------------------------------- */
/* The cache key                                                               */
/* -------------------------------------------------------------------------- */

describe("cache key", () => {
  it("snaps nearby students onto one entry", () => {
    /* Forty metres apart. If these were two entries the cache would never
       warm and every student would pay a provider call. */
    const a = cacheKey({
      provider: "osm",
      centre: { lat: 40.41680, lng: -3.70380 },
      radiusMetres: 1_500,
      categories: ["supermarket"],
    });
    const b = cacheKey({
      provider: "osm",
      centre: { lat: 40.41712, lng: -3.70392 },
      radiusMetres: 1_500,
      categories: ["supermarket"],
    });
    assert.equal(a, b);
  });

  it("does not confuse one district with the next", () => {
    const sol = cacheKey({
      provider: "osm",
      centre: { lat: 40.4168, lng: -3.7038 },
      radiusMetres: 1_500,
      categories: ["supermarket"],
    });
    const chamberi = cacheKey({
      provider: "osm",
      centre: { lat: 40.4350, lng: -3.7030 },
      radiusMetres: 1_500,
      categories: ["supermarket"],
    });
    assert.notEqual(sol, chamberi);
  });

  it("is order-independent in the categories", () => {
    const centre = { lat: 40.4168, lng: -3.7038 };
    assert.equal(
      cacheKey({ provider: "osm", centre, radiusMetres: 800, categories: ["gym", "cafe"] }),
      cacheKey({ provider: "osm", centre, radiusMetres: 800, categories: ["cafe", "gym"] }),
    );
  });

  it("separates the providers", () => {
    const centre = { lat: 40.4168, lng: -3.7038 };
    assert.notEqual(
      cacheKey({ provider: "osm", centre, radiusMetres: 800, categories: ["cafe"] }),
      cacheKey({ provider: "google", centre, radiusMetres: 800, categories: ["cafe"] }),
    );
  });

  it("snaps a radius so a slider cannot create hundreds of keys", () => {
    assert.equal(snapRadius(410), snapRadius(790));
    assert.notEqual(snapRadius(410), snapRadius(1_100));
  });
});
