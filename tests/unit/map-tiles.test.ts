import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { positionIn, tileUrl, tilesFor, viewportFor } from "../../src/domain/places.ts";

/**
 * ============================================================================
 * THE STREETS HAVE TO LINE UP WITH THE PINS
 * ----------------------------------------------------------------------------
 * `NEXT_PUBLIC_MAP_TILE_URL` was parsed in `services/env.ts` and read by
 * nothing. The map component's own header said "with it set, tiles are drawn
 * and attributed", and four documents — the launch checklist, the setup guide,
 * the data notes, `.env.example` — told an operator the same. Setting it did
 * nothing at all.
 *
 * Now it draws. The property worth testing is not that tiles appear; it is
 * that they appear in the RIGHT PLACE. A basemap a few pixels out of register
 * with the pins is worse than no basemap, because it looks authoritative while
 * putting the supermarket on the wrong corner — so the tiles and the pins are
 * projected by the same `mercator`, and the test below checks them against
 * each other rather than against a hand-computed constant.
 * ============================================================================
 */

const MADRID = { lat: 40.41694, lng: -3.70333 };
const REYKJAVIK = { lat: 64.1475, lng: -21.935 };

describe("basemap tiles", () => {
  it("covers the viewport", () => {
    const viewport = viewportFor([MADRID, { lat: 40.43, lng: -3.68 }])!;
    const { tiles } = tilesFor(viewport);

    assert.ok(tiles.length > 0);

    /* Every corner of the viewport must be inside some tile: a gap is a hole
       in the map. Tiles are positioned in percent, so the union has to span
       0-100 on both axes. */
    const left = Math.min(...tiles.map((t) => t.left));
    const top = Math.min(...tiles.map((t) => t.top));
    const right = Math.max(...tiles.map((t) => t.left + t.width));
    const bottom = Math.max(...tiles.map((t) => t.top + t.height));

    assert.ok(left <= 0, `left edge uncovered: ${left}`);
    assert.ok(top <= 0, `top edge uncovered: ${top}`);
    assert.ok(right >= 100, `right edge uncovered: ${right}`);
    assert.ok(bottom >= 100, `bottom edge uncovered: ${bottom}`);
  });

  it("puts a point on the same spot as the pin does", () => {
    /* THE ASSERTION THE WHOLE FEATURE RESTS ON. Take a real coordinate, find
       where `positionIn` draws its pin, find the tile that contains it, and
       check the pin lands inside that tile's own rectangle. If the two
       projections ever diverge this fails. */
    const viewport = viewportFor([MADRID, { lat: 40.44, lng: -3.66 }])!;
    const { tiles, zoom } = tilesFor(viewport);
    const pin = positionIn(MADRID, viewport)!;

    const containing = tiles.filter(
      (t) =>
        pin.left >= t.left &&
        pin.left <= t.left + t.width &&
        pin.top >= t.top &&
        pin.top <= t.top + t.height,
    );

    assert.equal(containing.length, 1, `expected exactly one tile under the pin at z${zoom}`);
  });

  it("asks for a sensible number of tiles at any scale", () => {
    /* A Discover screen that fetches sixty images to draw one neighbourhood is
       a bill and a slow page; four to draw a whole city is a blur. */
    for (const points of [
      [MADRID, { lat: 40.418, lng: -3.7 }], // one street
      [MADRID, { lat: 40.46, lng: -3.65 }], // a district
      [MADRID, { lat: 40.6, lng: -3.4 }], // the metro area
    ]) {
      const { tiles } = tilesFor(viewportFor(points)!);
      assert.ok(tiles.length >= 4, `too few tiles: ${tiles.length}`);
      assert.ok(tiles.length <= 36, `too many tiles: ${tiles.length}`);
    }
  });

  it("zooms in for a small viewport and out for a large one", () => {
    const street = tilesFor(viewportFor([MADRID, { lat: 40.4175, lng: -3.7025 }])!);
    const metro = tilesFor(viewportFor([MADRID, { lat: 40.6, lng: -3.4 }])!);
    assert.ok(street.zoom > metro.zoom, `${street.zoom} should exceed ${metro.zoom}`);
  });

  it("stays inside the world at a high latitude", () => {
    /* Iceland is a coverage city, and y does not wrap: a tile index off the
       top of the world is not a tile, it is a 404 per pin. */
    const { tiles, zoom } = tilesFor(viewportFor([REYKJAVIK, { lat: 64.17, lng: -21.86 }])!);
    const n = 2 ** zoom;
    for (const tile of tiles) {
      assert.ok(tile.y >= 0 && tile.y < n, `y ${tile.y} outside 0..${n - 1}`);
      assert.ok(tile.x >= 0 && tile.x < n, `x ${tile.x} outside 0..${n - 1}`);
    }
  });

  it("fills a template, and refuses one that is not a template", () => {
    const tile = { z: 12, x: 2005, y: 1541 };
    assert.equal(
      tileUrl("https://tiles.example.com/{z}/{x}/{y}.png?key=abc", tile),
      "https://tiles.example.com/12/2005/1541.png?key=abc",
    );

    /* A URL with no placeholders would be requested once per tile, all
       identical — worse than drawing nothing, so it is refused here and the
       component falls back to the plain ground. */
    assert.equal(tileUrl("https://tiles.example.com/static.png", tile), null);
  });
});
