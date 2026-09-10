import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allCoverageCities } from "../../src/config/regions.ts";
import { institutions } from "../../src/data/institutions/index.ts";

/**
 * ============================================================================
 * ATTACHING AN INSTITUTION TO A CITY
 * ----------------------------------------------------------------------------
 * A university with no `citySlug` is searchable and pickable and has no local
 * content behind it — no price anchors, no transport card, no place search
 * origin. That is the documented honest degradation, and it was the state of
 * every institution in the 181 cities added with the European expansion,
 * because the hand-written metro list could not grow to meet them: it compares
 * a typed town name against the label Wikidata holds, which is in the local
 * language for a Latin-script country and folds to nothing for a Cyrillic or
 * Greek one.
 *
 * Three mechanisms now run in order — hand-written claim, then coordinates,
 * then the town's own name — and the tests here pin the two properties that
 * make the added ones safe rather than merely useful.
 * ============================================================================
 */

const bySlug = (slug: string) => institutions.filter((row) => row.citySlug === slug);

describe("institution to city attachment", () => {
  it("attaches universities in the newly covered countries", () => {
    /* Before the expansion every one of these was null. */
    const cases: [string, string][] = [
      ["cluj-napoca", "RO"],
      ["riga", "LV"],
      ["vilnius", "LT"],
      ["sofia", "BG"],
      ["zagreb", "HR"],
      ["reykjavik", "IS"],
      ["tirana", "AL"],
      ["bratislava", "SK"],
      ["ljubljana", "SI"],
    ];

    for (const [slug, countryCode] of cases) {
      const rows = bySlug(slug);
      assert.ok(rows.length > 0, `${slug} has no institutions attached`);
      for (const row of rows) {
        assert.equal(row.countryCode, countryCode, `${row.officialName} attached across a border`);
      }
    }
  });

  it("attaches a university Wikidata has no coordinate for", () => {
    /* 29% of imported institutions have no coordinate, so geography alone
       would have left KU Leuven — one of the largest universities in Europe —
       with no city at all. The town name catches it. */
    const ku = institutions.find((row) => row.officialName === "Katholieke Universiteit Leuven");
    assert.ok(ku, "fixture check: KU Leuven is in the registry");
    assert.equal(ku.lat, null, "fixture check: it is one of the rows with no coordinate");
    assert.equal(ku.citySlug, "leuven");
  });

  it("does not send a Belgian school to Norway", () => {
    /* Haute École Louvain en Hainaut records its town as "Bergen", the Dutch
       name for Mons. Bergen is also a coverage city — in Norway. This is the
       reason name matching is scoped to the country, and it is the kind of
       mistake that looks entirely plausible on a screen. */
    const row = institutions.find((entry) => entry.officialName === "Haute École Louvain en Hainaut");
    assert.ok(row, "fixture check: the row exists");
    assert.notEqual(row.citySlug, "bergen");
  });

  it("never attaches an institution to a city in another country", () => {
    const countryOf = new Map(
      allCoverageCities.map((city) => [city.slug ?? city.key, city.countryCode]),
    );

    const crossings = institutions
      .filter((row) => row.citySlug !== null)
      .filter((row) => {
        const cityCountry = countryOf.get(row.citySlug!);
        return cityCountry !== undefined && cityCountry !== row.countryCode;
      })
      .map((row) => `${row.officialName} (${row.countryCode}) -> ${row.citySlug}`);

    assert.deepEqual(crossings, []);
  });

  it("keeps every attachment pointing at a city that exists", () => {
    const known = new Set(allCoverageCities.map((city) => city.slug ?? city.key));
    const dangling = institutions
      .filter((row) => row.citySlug !== null && !known.has(row.citySlug))
      .map((row) => `${row.officialName} -> ${row.citySlug}`);

    assert.deepEqual(dangling, []);
  });

  it("leaves the curated metro decisions in charge", () => {
    /* The five deep cities carry transport cards and price anchors, so a wrong
       attachment there costs a student real money. Their assignments come from
       the hand-written list only; the two added mechanisms skip any city that
       list claims. Madrid's is the widest claim in the file — the whole
       Comunidad — and it must still hold. */
    const madrid = bySlug("madrid");
    assert.ok(madrid.length > 0);
    for (const row of madrid) assert.equal(row.countryCode, "ES");

    /* Getafe is inside the Comunidad and rides the same Abono. It is the case
       the region rule exists for. */
    const carlos = institutions.find((row) => /Carlos III/i.test(row.officialName));
    if (carlos) assert.equal(carlos.citySlug, "madrid");
  });
});
