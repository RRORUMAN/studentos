import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { neighbourhoods, neighbourhoodsForCity } from "@/data/neighbourhoods";
import { AREA_RADIUS_METRES, areaForPoint } from "@/server/engines/neighbourhood";

/**
 * ============================================================================
 * WHICH AREA A PLACE IS IN
 * ----------------------------------------------------------------------------
 * The join that decides whether the place page can say "in Gràcia, twenty
 * minutes from your campus".
 *
 * It is worth testing at this level because of how the old version failed. It
 * read the neighbourhood off the end of the place's NAME — "Ramen counter,
 * Malasaña" — which was true of every invented place and of no real one, so
 * the day the invented places were deleted it began returning null for
 * everything and nothing anywhere failed. These assertions are about real
 * coordinates of real places, so they cannot pass while the join is dead.
 * ============================================================================
 */

const madrid = neighbourhoodsForCity("madrid");
const barcelona = neighbourhoodsForCity("barcelona");

describe("placing a point in a neighbourhood", () => {
  it("puts a real address in the area it is actually in", () => {
    /* The Mercado de San Ildefonso on Calle Fuencarral, which is in Malasaña
       and which anybody in Madrid would tell you is in Malasaña. */
    assert.equal(areaForPoint(madrid, { lat: 40.4249, lng: -3.7014 })?.slug, "malasana");

    /* Plaza de Lavapiés. */
    assert.equal(areaForPoint(madrid, { lat: 40.4088, lng: -3.7008 })?.slug, "lavapies");

    /* Plaça de la Vila de Gràcia. */
    assert.equal(areaForPoint(barcelona, { lat: 41.4025, lng: 2.1565 })?.slug, "gracia");
  });

  it("says nothing rather than reaching for the nearest area", () => {
    /* Madrid-Barajas airport: inside the city, thirteen kilometres from any
       neighbourhood the product has a row for. The honest answer is that we do
       not know which area it is in, because it is in none of them. Returning
       the closest would produce a confident commute figure for a journey
       nobody is making. */
    assert.equal(areaForPoint(madrid, { lat: 40.4719, lng: -3.5626 }), null);

    /* The middle of the Mediterranean, for the same reason and more so. */
    assert.equal(areaForPoint(barcelona, { lat: 41.0, lng: 2.5 }), null);
  });

  it("does not put a Barcelona point in a Madrid area", () => {
    /* The caller passes one city's areas, so this is really a test that the
       radius is small enough for that to matter — 600 km apart must not
       resolve, whatever list it is given. */
    assert.equal(areaForPoint(madrid, { lat: 41.4025, lng: 2.1565 }), null);
  });

  it("takes the nearer of two overlapping areas", () => {
    /* El Raval and El Born are about 1.2 km apart in Barcelona, so a point
       between them is inside both radii. Nearest wins, and it is the only
       rule that does not need a tie-break nobody could defend. */
    const raval = barcelona.find((area) => area.slug === "el-raval");
    assert.ok(raval?.lat !== null && raval?.lng !== undefined);
    const near = areaForPoint(barcelona, { lat: raval!.lat! + 0.001, lng: raval!.lng! });
    assert.equal(near?.slug, "el-raval");
  });

  it("ignores an area that has no coordinate", () => {
    /**
     * Madrid's La Latina has no point on purpose: Wikidata has a metro station
     * of that name and a district several kilometres away that is a different
     * place, so the import resolves neither. It must therefore never be
     * returned — including for a point in the middle of the real La Latina,
     * which correctly comes back as Lavapiés or nothing rather than as a
     * guess.
     */
    const laLatina = neighbourhoods.find((area) => area.slug === "la-latina");
    assert.ok(laLatina, "la-latina should still be a row");
    assert.equal(laLatina.lat, null);
    assert.equal(laLatina.lng, null);

    for (const point of [
      { lat: 40.4114, lng: -3.7092 },
      { lat: 40.4, lng: -3.7 },
    ]) {
      assert.notEqual(areaForPoint(madrid, point)?.slug, "la-latina");
    }
  });
});

describe("the geography behind it", () => {
  it("gives every area either both coordinates or neither", () => {
    /* Half a coordinate is worse than none: it would place everything on the
       prime meridian. */
    for (const area of neighbourhoods) {
      assert.equal(
        area.lat === null,
        area.lng === null,
        `${area.slug} has one coordinate and not the other`,
      );
    }
  });

  it("carries provenance wherever it carries a coordinate", () => {
    for (const area of neighbourhoods) {
      if (area.lat === null) continue;
      assert.match(
        area.wikidataId ?? "",
        /^Q\d+$/,
        `${area.slug} has a coordinate with no Wikidata id to check it against`,
      );
    }
  });

  it("puts every located area inside its own city", () => {
    /**
     * A neighbourhood pinned to the wrong city is the failure this whole
     * import is designed around — it would be invisible in the interface and
     * would quietly attach every place in one city to an area in another.
     * Twenty-five kilometres is generous for a city neighbourhood and tight
     * enough to catch a continent-level mistake.
     */
    const centres: Record<string, { lat: number; lng: number }> = {
      madrid: { lat: 40.41694, lng: -3.70333 },
      barcelona: { lat: 41.3825, lng: 2.17694 },
      london: { lat: 51.50722, lng: -0.1275 },
      amsterdam: { lat: 52.36667, lng: 4.88333 },
      berlin: { lat: 52.51667, lng: 13.38333 },
    };

    for (const area of neighbourhoods) {
      if (area.lat === null || area.lng === null) continue;
      const centre = centres[area.citySlug];
      assert.ok(centre, `no centre known for ${area.citySlug}`);
      /* Rough degrees-to-km, which is all this needs to be. */
      const dLat = (area.lat - centre.lat) * 111;
      const dLng = (area.lng - centre.lng) * 111 * Math.cos((centre.lat * Math.PI) / 180);
      const km = Math.sqrt(dLat * dLat + dLng * dLng);
      assert.ok(km < 25, `${area.slug} is ${km.toFixed(1)} km from the centre of ${area.citySlug}`);
    }
  });

  it("keeps the radius tight enough to mean something", () => {
    /* A neighbourhood claim a student can check by walking. If this ever grows
       past about two kilometres it stops being a claim about a neighbourhood
       and becomes a claim about a quarter of the city. */
    assert.ok(AREA_RADIUS_METRES <= 2_000);
  });
});
