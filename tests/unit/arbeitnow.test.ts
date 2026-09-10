import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cityFor, plainText } from "../../src/server/work/arbeitnow.ts";

/**
 * ============================================================================
 * READING A REAL JOB BOARD
 * ----------------------------------------------------------------------------
 * The two decisions in the Arbeitnow adapter that can be wrong without
 * anything failing: which city a free-text location names, and what a
 * doubly-escaped HTML description says once it is text.
 *
 * The network call is not tested here. What matters is that a posting is never
 * filed under a city nobody typed, because a job shown in the wrong city costs
 * a student a bus fare and a morning.
 * ============================================================================
 */

const SERVED = ["berlin", "munich", "hamburg", "amsterdam", "madrid", "new-york"];

describe("placing a free-text location", () => {
  it("matches a city by its own name", () => {
    assert.equal(cityFor("Berlin", SERVED), "berlin");
    assert.equal(cityFor("Hamburg", SERVED), "hamburg");
    assert.equal(cityFor("Amsterdam", SERVED), "amsterdam");
  });

  it("takes the town off the front of a longer string", () => {
    /* "Hamburg, Germany" is how half the postings write it. */
    assert.equal(cityFor("Hamburg, Germany", SERVED), "hamburg");
    assert.equal(cityFor("Berlin, Deutschland", SERVED), "berlin");
  });

  it("ignores accents and case, because employers type both", () => {
    assert.equal(cityFor("münchen", SERVED), "munich");
    assert.equal(cityFor("MADRID", SERVED), "madrid");
  });

  it("matches a multi-word city written with a hyphen in its slug", () => {
    assert.equal(cityFor("New York", SERVED), "new-york");
  });

  it("refuses anything it cannot place exactly", () => {
    /**
     * THE POINT OF THE WHOLE FUNCTION. A near match is worse than no match:
     * "Greater Hamburg Area" is a region, "Cambridge" is two cities on two
     * continents, and "Remote" is not a place. Each returns null, and the
     * caller drops the posting rather than filing it under a guess.
     */
    assert.equal(cityFor("Greater Hamburg Area", SERVED), null);
    assert.equal(cityFor("Remote", SERVED), null);
    assert.equal(cityFor("Anywhere in Europe", SERVED), null);
    assert.equal(cityFor("", SERVED), null);
  });

  it("will not place a posting in a city the student's product does not serve", () => {
    /* Paris is a real city and a real StudentOS city, but not in this call's
       served list — the caller decides the scope, not the matcher. */
    assert.equal(cityFor("Paris", SERVED), null);
  });
});

describe("turning the description into words", () => {
  it("decodes entities the feed escaped twice", () => {
    /* The payload arrives as &amp;lt;p&amp;gt;, which is "&lt;p&gt;" escaped
       again. One pass leaves visible tag text on a student's screen. */
    assert.equal(plainText("&amp;lt;p&amp;gt;Hello&amp;lt;/p&amp;gt;"), "Hello");
  });

  it("drops markup rather than rendering a third party's HTML", () => {
    assert.equal(plainText("<div class='x'><p>Shift work</p></div>"), "Shift work");
    assert.equal(plainText("<script>alert(1)</script>Safe"), "alert(1) Safe");
  });

  it("collapses the whitespace that markup leaves behind", () => {
    assert.equal(plainText("<p>One</p>\n\n<p>Two</p>"), "One Two");
  });

  it("caps the length so one posting cannot dominate a page", () => {
    assert.ok(plainText("<p>" + "word ".repeat(2_000) + "</p>").length <= 2_000);
  });

  it("survives a description with no markup at all", () => {
    assert.equal(plainText("Just text"), "Just text");
    assert.equal(plainText(""), "");
  });
});
