import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { areaOrigin, neighbourhoodsForCity } from "../../src/data/neighbourhoods.ts";

/**
 * ============================================================================
 * THE STUDENT NEVER TOLD US WHERE THEY LIVE
 * ----------------------------------------------------------------------------
 * `Profile.homePoint` — the precise coordinate, isolated behind its own
 * greppable reader, protected by its own RLS policy, kept off the `Viewer`
 * object so it cannot be spread into a client component — is written by
 * nothing. Onboarding sends `homePoint: null` on every path, no screen sets it
 * afterwards, and relocating clears it. The only row that has ever carried one
 * is the seeded demo account.
 *
 * So every consumer was dead for every real student: the map's home pin never
 * drew, the recommender's distance signal never fired, and the routing chain
 * had nothing to route from — which is a large part of why that chain looked
 * unused.
 *
 * The student does answer one question about where they live: their AREA. Areas
 * carry a coordinate, so that is a real origin — accurate to a neighbourhood
 * rather than a doorway, which is exactly right for ranking and has to be
 * labelled wherever a number is shown.
 * ============================================================================
 */

describe("an origin to measure from", () => {
  it("finds the area a student picked, by its display name", () => {
    /* The onboarding chips are display names and the rows are keyed by slug.
       Matching on one alone finds nothing, which looks identical to a student
       who never answered — so both are tried. */
    const origin = areaOrigin("madrid", "Malasaña");
    assert.ok(origin, "Malasaña is a Madrid area and should resolve");
    assert.equal(origin.name, "Malasaña");
    assert.ok(Math.abs(origin.lat - 40.42) < 0.1, `latitude ${origin.lat}`);
    assert.ok(Math.abs(origin.lng - -3.7) < 0.1, `longitude ${origin.lng}`);
  });

  it("finds it by slug too", () => {
    const byName = areaOrigin("madrid", "Malasaña");
    const bySlug = areaOrigin("madrid", "malasana");
    assert.deepEqual(bySlug, byName);
  });

  it("answers null rather than guessing", () => {
    /* Every one of these is a real state, and none of them is an origin. A
       fallback to the city centre would be a confident wrong number: it would
       put a student in Vallecas fifteen minutes from things they are an hour
       from, silently. */
    assert.equal(areaOrigin("madrid", null), null, "no area given");
    assert.equal(areaOrigin("madrid", "Somewhere I typed myself"), null, "free text");
    assert.equal(areaOrigin("madrid", ""), null, "empty string");
    assert.equal(areaOrigin("no-such-city", "Malasaña"), null, "unknown city");
  });

  it("works in a city whose areas were imported rather than written", () => {
    /* Madrid's areas are hand-written; Vienna's come from the Wikidata import
       and carry a coordinate for the same reason. If the imported rows ever
       stop carrying one, every non-editorial city silently loses its origin. */
    const vienna = neighbourhoodsForCity("vienna");
    assert.ok(vienna.length > 0, "fixture check: Vienna has imported areas");

    const first = vienna.find((area) => area.lat !== null);
    assert.ok(first, "no Vienna area carries a coordinate");

    const origin = areaOrigin("vienna", first.name);
    assert.ok(origin);
    assert.equal(origin.name, first.name);
  });

  it("puts the origin inside its own city", () => {
    /* A sanity bound rather than a precise one: an area coordinate that landed
       in the wrong country would produce plausible-looking walking times for
       every place in the city. */
    const madrid = areaOrigin("madrid", "Malasaña")!;
    assert.ok(madrid.lat > 39.5 && madrid.lat < 41.5, `latitude ${madrid.lat} is not Madrid`);
    assert.ok(madrid.lng > -4.5 && madrid.lng < -3, `longitude ${madrid.lng} is not Madrid`);
  });
});
