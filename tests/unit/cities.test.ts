import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allCoverageCities, coverageStats } from "../../src/config/regions.ts";
import { searchCities } from "../../src/domain/cities.ts";

/**
 * ============================================================================
 * CITIES
 * ----------------------------------------------------------------------------
 * The geography every place query starts from, and the search that finds it.
 *
 * The search tests exist because the previous one was
 * `name.toLowerCase().includes(query)`, which was correct for a list of cities
 * that happened to have no accents in them. The geography import added Málaga,
 * Kraków, São Paulo, Bogotá and Zürich, and on that day the search silently
 * stopped finding five cities — a student in Málaga typing "malaga" was told
 * their city was not on the list.
 * ============================================================================
 */

const searchable = allCoverageCities.map((city) => ({
  slug: city.key,
  name: city.name,
  country: city.country,
  countryCode: city.countryCode,
  deep: city.depth === "deep",
}));

const first = (query: string) => searchCities(searchable, query)[0]?.city.name ?? null;
const names = (query: string) => searchCities(searchable, query).map((hit) => hit.city.name);

describe("city geography", () => {
  it("gives every city a coordinate", () => {
    const missing = allCoverageCities.filter(
      (city) => !Number.isFinite(city.lat) || !Number.isFinite(city.lng),
    );
    assert.deepEqual(
      missing.map((city) => city.key),
      [],
      "a city with no coordinate has no place search, no distances and no map",
    );
  });

  it("puts every city somewhere plausible", () => {
    for (const city of allCoverageCities) {
      assert.ok(Math.abs(city.lat) <= 85, `${city.key} latitude ${city.lat}`);
      assert.ok(Math.abs(city.lng) <= 180, `${city.key} longitude ${city.lng}`);
      assert.ok(city.lat !== 0 || city.lng !== 0, `${city.key} is at null island`);
    }
  });

  it("pins the cities that resolved to the wrong entity while this was written", () => {
    /* Each of these was, at some point during the import, the province, the
       autonomous community, the state or a hotel of the same name. The
       coordinates below are the CITY, checked against the map. */
    const expected: Record<string, [number, number]> = {
      madrid: [40.4, -3.7],
      "sao-paulo": [-23.5, -46.6],
      london: [51.5, -0.1],
      dublin: [53.3, -6.3],
      bangkok: [13.7, 100.5],
      seville: [37.4, -6.0],
      bologna: [44.5, 11.3],
      manchester: [53.5, -2.2],
    };

    for (const [key, [lat, lng]] of Object.entries(expected)) {
      const city = allCoverageCities.find((row) => row.key === key);
      assert.ok(city, `${key} is missing`);
      assert.ok(Math.abs(city.lat - lat) < 0.2, `${key} latitude ${city.lat}, expected ~${lat}`);
      assert.ok(Math.abs(city.lng - lng) < 0.2, `${key} longitude ${city.lng}, expected ~${lng}`);
    }
  });

  it("gives every city a currency, a locale and a timezone", () => {
    for (const city of allCoverageCities) {
      assert.match(city.currency, /^[A-Z]{3}$/, city.key);
      assert.match(city.locale, /^[a-z]{2}-[A-Z]{2}$/, city.key);
      assert.match(city.timezone, /^[A-Za-z]+\/[A-Za-z_+\-/]+$/, city.key);
    }
  });

  it("derives its headline numbers rather than stating them", () => {
    assert.equal(coverageStats.cities, allCoverageCities.length);
    assert.equal(
      coverageStats.countries,
      new Set(allCoverageCities.map((city) => city.countryCode)).size,
    );
  });
});

describe("searchCities", () => {
  it("finds an accented city from an unaccented query", () => {
    /* Every one of these returned nothing before the fold. */
    assert.equal(first("malaga"), "Málaga");
    assert.equal(first("krakow"), "Kraków");
    assert.equal(first("sao paulo"), "São Paulo");
    assert.equal(first("bogota"), "Bogotá");
    assert.equal(first("zurich"), "Zurich");
  });

  it("finds an accented city from the accented spelling too", () => {
    assert.equal(first("Málaga"), "Málaga");
    assert.equal(first("Kraków"), "Kraków");
  });

  it("ranks a prefix above a substring", () => {
    /* "bo" is in Bologna, Bogotá and Lisbon. The first two start with it. */
    const hits = names("bo");
    assert.ok(hits.length >= 2);
    assert.ok(
      ["Bologna", "Bogotá", "Boston"].includes(hits[0] ?? ""),
      `expected a prefix match first, got ${hits[0]}`,
    );
  });

  it("takes the English name for a city that has one", () => {
    assert.equal(first("munich"), "Munich");
    assert.equal(first("munchen"), "Munich");
    assert.equal(first("wien"), "Vienna");
    assert.equal(first("firenze"), "Florence");
  });

  it("finds cities by country", () => {
    const spanish = names("spain");
    assert.ok(spanish.includes("Madrid"));
    assert.ok(spanish.includes("Seville"));
  });

  it("prefers a name match over a country match", () => {
    /* "port" is the start of Porto and inside Portugal. Porto wins. */
    assert.equal(first("porto"), "Porto");
  });

  it("returns nothing for an empty query rather than everything", () => {
    assert.deepEqual(searchCities(searchable, ""), []);
    assert.deepEqual(searchCities(searchable, "   "), []);
  });

  it("returns nothing for a city that is not offered", () => {
    assert.deepEqual(names("atlantis"), []);
  });

  it("finds every city in the directory by its own name", () => {
    /* The strongest form of the accent bug: if any city cannot be found by
       typing its own name, a student in it is told it does not exist. */
    const unfindable = searchable.filter(
      (city) => !names(city.name).includes(city.name),
    );
    assert.deepEqual(unfindable.map((city) => city.name), []);
  });
});
