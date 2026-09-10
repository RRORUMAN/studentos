import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoveredAreas } from "../../src/data/neighbourhoods/areas.generated.ts";
import {
  areaNamesForCity,
  getNeighbourhood,
  neighbourhoods,
  neighbourhoodsForCity,
} from "../../src/data/neighbourhoods.ts";
import { matchNeighbourhoods, type LivingPreferences } from "../../src/server/engines/neighbourhood.ts";
import type { Neighbourhood } from "../../src/data/types.ts";

/**
 * ============================================================================
 * DISCOVERED AREAS
 * ----------------------------------------------------------------------------
 * The neighbourhood registry stopped being five hand-written cities and became
 * eighty, seventy-five of which are imported from Wikidata with a name, a
 * point and nothing else. Three things about that arrangement would be quiet,
 * plausible disasters if they broke, so they are pinned here.
 *
 * ONE — THE SLUG IS THE IDENTITY. It is what `Profile.areaSlug` stores. A
 * duplicate slug across two cities does not throw, does not warn, and does not
 * look wrong in any diff: it means a student in Turin who set their home area
 * is silently reading Bologna's, forever. A dozen of these cities have an area
 * called Centro or Centrum or Old Town, so this is not hypothetical.
 *
 * TWO — AN IMPORTED AREA MUST NOT PRETEND TO BE A MEASURED ONE. Every unknown
 * signal scores a neutral 0.5, so an area with no rent, no traits and no
 * commute figure computes a perfectly reasonable-looking fit of 50 out of 100.
 * The engine has to label that as evidence-free, or seventy-five cities'
 * worth of shrugs get rendered in the same typography as findings.
 *
 * THREE — WHAT THE IMPORT IS NOT ALLOWED TO CONTAIN. The first run of the
 * importer put the Kraków Ghetto and the Kraków-Płaszów concentration camp in
 * the top four answers to "where should I live", because Wikidata files both
 * under classes that walk up to "district" and both carry a coordinate. The
 * importer gained two gates for that. This is the third: whatever the gates do
 * or stop doing on some future re-import, the file that reaches students is
 * checked here, and a re-import that reintroduces one of those rows fails the
 * build rather than shipping.
 * ============================================================================
 */

describe("discovered areas", () => {
  it("gives every area in the product a slug of its own", () => {
    const seen = new Map<string, string>();
    for (const area of neighbourhoods) {
      const first = seen.get(area.slug);
      assert.equal(
        first,
        undefined,
        `slug "${area.slug}" is used by both ${first} and ${area.citySlug}`,
      );
      seen.set(area.slug, area.citySlug);
    }
    assert.equal(seen.size, neighbourhoods.length);
  });

  it("resolves each slug back to the area it belongs to", () => {
    /* Spot-check rather than exhaustive: `getNeighbourhood` scans linearly and
       the point is that the city prefix survives the round trip. */
    for (const area of [...neighbourhoods.slice(0, 5), ...neighbourhoods.slice(-5)]) {
      const found = getNeighbourhood(area.slug);
      assert.equal(found?.citySlug, area.citySlug, `${area.slug} resolved to the wrong city`);
      assert.equal(found?.name, area.name);
    }
  });

  it("carries a name and a real coordinate on every imported row", () => {
    for (const area of discoveredAreas) {
      assert.ok(area.name.trim().length > 0, `${area.slug} has no name`);
      assert.ok(/^Q\d+$/.test(area.wikidataId), `${area.slug} has no Wikidata id`);
      assert.ok(Number.isFinite(area.lat) && Math.abs(area.lat) <= 90, `${area.slug} latitude`);
      assert.ok(Number.isFinite(area.lng) && Math.abs(area.lng) <= 180, `${area.slug} longitude`);
      /* 0,0 is in the Gulf of Guinea and is what a missing coordinate looks
         like when somebody defaults it to zero instead of leaving it out. */
      assert.ok(area.lat !== 0 || area.lng !== 0, `${area.slug} sits at null island`);
    }
  });

  it("says nothing about what an imported area is like", () => {
    /* The whole bargain: eighty cities' worth of areas, on the condition that
       not one word of what they are like is invented. If this ever fails, the
       thing to look at is not the test. */
    const imported = new Set(discoveredAreas.map((area) => `${area.citySlug}-${area.slug}`));
    for (const area of neighbourhoods) {
      if (!imported.has(area.slug)) continue;
      assert.equal(area.character, null, `${area.slug} has a written character line`);
      assert.equal(area.rent, null, `${area.slug} has a rent band`);
      assert.equal(area.traits, null, `${area.slug} has trait scores`);
    }
  });

  it("contains no site of atrocity or confinement", () => {
    /* See the header. The importer refuses these twice over; this is the check
       on the artefact rather than on the process that made it. */
    const forbidden = [
      "ghetto",
      "concentration camp",
      "extermination",
      "death camp",
      "internment",
      "labour camp",
      "labor camp",
      "prison",
      "penitentiary",
      "cemetery",
      "mass grave",
    ];
    for (const area of discoveredAreas) {
      const name = area.name.toLowerCase();
      for (const term of forbidden) {
        assert.ok(
          !name.includes(term),
          `"${area.name}" (${area.citySlug}, ${area.wikidataId}) is offered as somewhere to live`,
        );
      }
    }
  });

  it("reaches far more than the five written-up cities", () => {
    const cities = new Set(discoveredAreas.map((area) => area.citySlug));
    assert.ok(cities.size >= 50, `only ${cities.size} cities have areas`);
    /* And leaves the deep five to their editorial rows. */
    for (const deep of ["madrid", "barcelona", "london", "amsterdam", "berlin"]) {
      assert.equal(
        discoveredAreas.some((area) => area.citySlug === deep),
        false,
        `${deep} has imported areas, which would bury its written ones`,
      );
      assert.ok(neighbourhoodsForCity(deep).length > 0, `${deep} lost its written areas`);
    }
  });
});

/* -------------------------------------------------------------------------- */

const prefs = (over: Partial<LivingPreferences> = {}): LivingPreferences => ({
  campusSlug: null,
  rentCeiling: null,
  maxCommuteMinutes: 35,
  priorities: {},
  ...over,
});

const bare = (slug: string, name: string): Neighbourhood => ({
  slug,
  citySlug: "vienna",
  name,
  character: null,
  commuteMinutes: {},
  rent: null,
  traits: null,
  lat: 48.2,
  lng: 16.37,
  wikidataId: "Q1",
});

describe("an area nobody has measured", () => {
  it("is reported as listed rather than scored", () => {
    const [result] = matchNeighbourhoods({
      areas: [bare("vienna-favoriten", "Favoriten")],
      preferences: prefs({ rentCeiling: 600, priorities: { nightlife: 2 } }),
    });

    assert.equal(result.evidence, "listed");
    assert.deepEqual(result.knows, { rent: false, commute: false, traits: false });
  });

  it("is still on the page, because leaving it off would be the bigger lie", () => {
    const results = matchNeighbourhoods({
      areas: [bare("vienna-favoriten", "Favoriten"), bare("vienna-wieden", "Wieden")],
      preferences: prefs({ rentCeiling: 600 }),
    });
    assert.equal(results.length, 2);
    /* Nothing to rank by, so alphabetical -- not a fabricated order. */
    assert.deepEqual(results.map((r) => r.area.name), ["Favoriten", "Wieden"]);
  });

  it("does not outrank a measured area that scored below the neutral middle", () => {
    /* The failure this prevents: three unknowns average to exactly 0.5, which
       is 50 out of 100, which beats a real area measured at 44 -- so the top of
       the list would be the part of it we know least about. */
    const measured: Neighbourhood = {
      ...bare("vienna-measured", "Measured"),
      rent: { room: [900, 1100], studio: null, basis: "seed-estimate", checkedOn: "2026-09-07" },
      traits: { nightlife: 0, quiet: 0, groceries: 0, transport: 0, studentDensity: 0, green: 0, eatingOut: 0 },
    };

    const results = matchNeighbourhoods({
      areas: [bare("vienna-unknown", "Unknown"), measured],
      preferences: prefs({ rentCeiling: 500, priorities: { nightlife: 2 } }),
    });

    assert.equal(results[0].area.name, "Measured");
    assert.ok(
      results[0].fit < results[1].fit,
      "the measured area should win on evidence despite the lower fit",
    );
  });
});

/* -------------------------------------------------------------------------- */

describe("areaNamesForCity", () => {
  it("puts the registry first and folds the hand-written names in behind", () => {
    const names = areaNamesForCity("madrid", ["Retiro"]);
    assert.equal(names[0], "Malasaña");
    assert.ok(names.includes("Retiro"), "a hand-written name outside the registry is kept");
  });

  it("treats a name that differs only by case or padding as the same district", () => {
    const names = areaNamesForCity("madrid", ["  malasaña  ", "Retiro", "RETIRO"]);
    assert.equal(names.filter((name) => name.toLowerCase().trim() === "malasaña").length, 1);
    assert.equal(names.filter((name) => name.toLowerCase().trim() === "retiro").length, 1);
  });

  it("has something to offer in a city nobody wrote up", () => {
    /* The bug this closes: the onboarding home step and two public city pages
       read the hand-written list alone, which is empty for seventy-five
       cities, so they rendered a heading over no chips and a sentence with a
       hole where the neighbourhoods should have been. */
    assert.ok(areaNamesForCity("vienna").length > 0);
    assert.ok(areaNamesForCity("seoul").length > 0);
  });

  it("returns nothing for a city that does not exist, rather than throwing", () => {
    assert.deepEqual(areaNamesForCity("atlantis"), []);
  });
});
