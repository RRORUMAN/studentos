import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";

import { MORE_DESTINATIONS } from "@/config/destinations";
import { SEARCH_DESTINATIONS } from "@/config/search";
import { fold, scoreDestination, searchDestinations } from "@/domain/command";

/**
 * ============================================================================
 * QUICK COMMAND
 * ----------------------------------------------------------------------------
 * That typing the word a student is actually looking at finds the screen.
 *
 * The dialog is not tested here; the ranking is. A palette fails by returning
 * the wrong first row, and the first row is the only one most people read.
 * ============================================================================
 */

/** The href of the top result, which is what pressing Enter would open. */
function first(query: string): string | null {
  return searchDestinations(query)[0]?.destination.href ?? null;
}

describe("finding a screen", () => {
  it("puts the screen whose name you are typing first", () => {
    assert.equal(first("budg"), "/budget");
    assert.equal(first("pul"), "/pulse");
    assert.equal(first("miss"), "/missions");
  });

  it("prefers the general screen over the specific one on a tie", () => {
    /* "budget" is in the label of Budget, Travel budget and Can I afford it's
       keywords. A student typing six letters of "budget" wants Budget. */
    assert.equal(first("budget"), "/budget");
  });

  it("finds a screen by the word on the form, not the word we named it", () => {
    /* The four this product exists for. Nobody types "Arrival" while holding
       a residency appointment slip. */
    assert.equal(first("nie"), "/arrival");
    assert.equal(first("empadronamiento"), "/arrival");
    assert.equal(first("padron"), "/arrival");
    assert.equal(first("abono"), "/starter-pack");
  });

  it("finds money screens by what is actually going on", () => {
    assert.equal(first("broke"), "/budget/survival");
    assert.equal(first("split"), "/budget/shared");
    assert.equal(first("can i afford"), "/budget/afford");
  });

  it("ignores accents and punctuation on both sides", () => {
    /* A student typing on a Spanish keyboard, and one who is not. */
    assert.equal(first("padrón"), "/arrival");
    assert.equal(first("what's on"), "/events");
    assert.equal(fold("Universitat  Politècnica-de"), "universitat politecnica de");
  });

  it("is case-insensitive", () => {
    assert.equal(first("EXPLORE"), "/discover");
    assert.equal(first("Explore"), "/discover");
  });
});

describe("what it refuses to guess", () => {
  it("returns nothing rather than a confident wrong answer", () => {
    /* A palette that answers everything sends students to screens they did
       not ask for. The caller offers Ask instead, which can actually help. */
    assert.deepEqual(searchDestinations("cheapest gym near atocha"), []);
    assert.deepEqual(searchDestinations("zzzzz"), []);
  });

  it("does not fuzzy-match dropped letters", () => {
    assert.deepEqual(searchDestinations("bdgt"), []);
  });

  it("scores a non-match at zero", () => {
    const budget = SEARCH_DESTINATIONS.find((row) => row.href === "/budget");
    assert.ok(budget);
    assert.equal(scoreDestination(budget, "elephant"), 0);
    assert.equal(scoreDestination(budget, ""), 0);
    assert.equal(scoreDestination(budget, "   "), 0);
  });
});

describe("the opening list", () => {
  it("offers six things to do rather than the whole product", () => {
    const opening = searchDestinations("");
    assert.equal(opening.length, 6);
    assert.deepEqual(
      opening.map((result) => result.destination.href),
      ["/discover", "/budget", "/lifeops", "/events", "/pulse/chat", "/speak"],
    );
  });

  it("caps a broad query so the dialog stays a list, not a menu", () => {
    /* "you" matches a great many hints. The limit is what keeps the panel
       from becoming the sitemap. */
    assert.ok(searchDestinations("you").length <= 8);
  });
});

describe("the registry itself", () => {
  it("has no duplicate destinations", () => {
    const hrefs = SEARCH_DESTINATIONS.map((row) => row.href);
    assert.equal(new Set(hrefs).size, hrefs.length);
  });

  it("gives every destination a hint, because the label is not enough", () => {
    for (const row of SEARCH_DESTINATIONS) {
      assert.ok(row.hint.length > 0, `${row.href} has no hint`);
      assert.ok(row.label.length > 0, `${row.href} has no label`);
      assert.ok(row.href.startsWith("/"), `${row.href} is not an internal path`);
    }
  });

  it("can find everything the You page puts on a card", () => {
    /**
     * Two lists, two jobs -- the You grid is nine chosen cards with icons,
     * this is the whole search index -- and the way they go wrong is drift:
     * a screen featured on You that the palette has never heard of. The
     * containment only has to hold in one direction. The palette knowing
     * about settings screens that will never get a card is the point of it.
     */
    const searchable = new Set(SEARCH_DESTINATIONS.map((row) => row.href));
    for (const row of MORE_DESTINATIONS) {
      assert.ok(
        searchable.has(row.href),
        `${row.label} (${row.href}) is on the You page but cannot be searched for`,
      );
    }
  });

  it("points only at routes that exist", () => {
    /**
     * The failure this catches is a dead row in the palette, which is the
     * worst kind of dead button: it looks like the product knows about a
     * screen and then 404s. Nothing else notices -- the href is a string,
     * TypeScript is happy, and the row only breaks when a student picks it.
     *
     * Checked against the filesystem rather than by visiting the routes,
     * because a route file existing is exactly the claim being made and it
     * costs a millisecond instead of thirty-six page loads.
     */
    for (const row of SEARCH_DESTINATIONS) {
      const page = `src/app/(app)${row.href}/page.tsx`;
      assert.ok(existsSync(page), `${row.href} is in the palette but ${page} does not exist`);
    }
  });

  it("finds every destination by its own label", () => {
    /* The registry is only useful if each row is reachable. A label that
       cannot find itself means a keyword collision has buried it. */
    for (const row of SEARCH_DESTINATIONS) {
      const found = searchDestinations(row.label, SEARCH_DESTINATIONS.length).some(
        (result) => result.destination.href === row.href,
      );
      assert.ok(found, `${row.label} (${row.href}) cannot be found by its own name`);
    }
  });
});
