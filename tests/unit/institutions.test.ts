import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  acronym,
  editDistance,
  fold,
  searchInstitutions,
  type Institution,
} from "../../src/domain/institutions.ts";
import {
  institutions,
  institutionForCampus,
  institutionsInCity,
  IMPORTED_COUNTRIES,
} from "../../src/data/institutions/index.ts";
import { campuses } from "../../src/data/cities.ts";

/**
 * ============================================================================
 * INSTITUTIONS
 * ----------------------------------------------------------------------------
 * Two things are being defended here.
 *
 * The first is that a student can find their own university. Every assertion in
 * "finding a university in Madrid" is a real query somebody types -- an
 * abbreviation, a half-remembered word, a name without its accents -- and the
 * expected answer is the institution they meant. A dropdown that fails these is
 * a student who concludes in two seconds that the product was not built for
 * them.
 *
 * The second is that the registry did not quietly break while nobody was
 * looking: no duplicates, no curated row that lost its campus, no imported row
 * pretending to know a neighbourhood.
 * ============================================================================
 */

const find = (query: string, citySlug: string | null = "madrid") =>
  searchInstitutions(institutions, query, { citySlug, countryCode: "ES", limit: 5 });

const top = (query: string, citySlug: string | null = "madrid") =>
  find(query, citySlug)[0]?.institution.officialName ?? null;

describe("folding", () => {
  it("strips accents so a phone keyboard is enough", () => {
    assert.equal(fold("Universidad Autónoma"), "universidad autonoma");
    assert.equal(fold("Universitat Politècnica"), "universitat politecnica");
    assert.equal(fold("Charité – Universitätsmedizin"), "charite universitatsmedizin");
  });

  it("collapses punctuation rather than keeping it as a word", () => {
    assert.equal(fold("City, University of London"), "city university of london");
    assert.equal(fold("King's  College-London"), "king s college london");
  });
});

describe("acronyms", () => {
  it("skips the words nobody says", () => {
    assert.equal(acronym("Universidad Autónoma de Madrid"), "uam");
    assert.equal(acronym("Universidad Complutense de Madrid"), "ucm");
    assert.equal(acronym("Universidad Politécnica de Madrid"), "upm");
    assert.equal(acronym("Universitat Pompeu Fabra"), "upf");
  });
});

describe("edit distance", () => {
  it("gives up as soon as the cap is exceeded", () => {
    assert.equal(editDistance("madrid", "madrid", 1), 0);
    assert.equal(editDistance("madrid", "madird", 2), 2);
    assert.equal(editDistance("madrid", "barcelona", 1), 2);
  });
});

describe("finding a university in Madrid", () => {
  it("finds Complutense from the word its students actually use", () => {
    assert.equal(top("complu"), "Universidad Complutense de Madrid");
    assert.equal(top("Complutense"), "Universidad Complutense de Madrid");
  });

  it("finds a university from its abbreviation", () => {
    assert.equal(top("UAM"), "Universidad Autónoma de Madrid");
    assert.equal(top("UCM"), "Universidad Complutense de Madrid");
    assert.equal(top("UPM"), "Universidad Politécnica de Madrid");
    assert.equal(top("UC3M"), "Universidad Carlos III de Madrid");
  });

  it("finds IE, whose name is shorter than most abbreviations", () => {
    assert.equal(top("IE"), "IE University");
  });

  it("does not need the accents", () => {
    assert.equal(top("autonoma"), "Universidad Autónoma de Madrid");
    assert.equal(top("politecnica"), "Universidad Politécnica de Madrid");
  });

  it("finds Rey Juan Carlos from the half a student remembers", () => {
    assert.equal(top("rey juan"), "Universidad Rey Juan Carlos");
    assert.equal(top("juan carlos"), "Universidad Rey Juan Carlos");
  });

  it("survives one typo once the query is long enough to have meant something", () => {
    assert.equal(top("complutence"), "Universidad Complutense de Madrid");
  });

  it("does not guess at two letters", () => {
    /* "co" is a prefix of a dozen names and a typo for none of them. Whatever
       comes back must be a real prefix hit, never a fuzzy one. */
    assert.ok(find("co").every((hit) => hit.matched !== "fuzzy"));
  });
});

describe("ranking by the student's own city", () => {
  it("puts the Madrid Politécnica first for a student in Madrid", () => {
    assert.equal(top("politecnica", "madrid"), "Universidad Politécnica de Madrid");
  });

  it("and does not hide the others", () => {
    const names = find("politecnica", "madrid").map((hit) => hit.institution.officialName);
    assert.ok(names.length > 1, "other polytechnics should still be reachable");
    assert.ok(names.some((name) => !name.includes("Madrid")));
  });

  it("opens with the city's own institutions before anything is typed", () => {
    const opening = searchInstitutions(institutions, "", { citySlug: "madrid", limit: 8 });
    assert.ok(opening.length >= 8);
    assert.ok(opening.every((hit) => hit.institution.citySlug === "madrid"));
  });
});

describe("searching the whole country", () => {
  it("reaches an institution outside the student's city", () => {
    assert.equal(top("Universidad de Granada", "madrid"), "Universidad de Granada");
    assert.equal(top("Universidad de Sevilla", "madrid"), "Universidad de Sevilla");
  });

  it("covers Spain rather than one city", () => {
    const spanish = institutions.filter((row) => row.countryCode === "ES");
    assert.ok(spanish.length > 150, `expected the whole country, got ${spanish.length}`);
    const cities = new Set(spanish.map((row) => row.city));
    assert.ok(cities.size > 40, `expected institutions across Spain, got ${cities.size} towns`);
  });
});

describe("the registry itself", () => {
  it("has no duplicate ids", () => {
    const ids = new Set(institutions.map((row) => row.id));
    assert.equal(ids.size, institutions.length);
  });

  it("merged rather than duplicated the curated universities", () => {
    /* The imported dataset has its own row for the Complutense. If the merge
       failed there would be two, and a student could pick the one with no
       campus behind it. */
    const complutense = institutions.filter((row) => fold(row.officialName).includes("complutense"));
    assert.equal(complutense.length, 1);
    assert.equal(complutense[0]?.campusSlug, "ucm");
  });

  it("gave the curated rows what the import knew and they did not", () => {
    const ucm = institutions.find((row) => row.id === "es-ucm");
    assert.ok(ucm);
    assert.ok(ucm.website, "the website should have come across from the import");
    assert.ok(ucm.sourceId?.startsWith("Q"), "and the entity it was matched to");
    assert.equal(ucm.source, "curated");
    assert.equal(ucm.city, "Madrid", "the curated city wins");
  });

  it("keeps both the spoken and the registry names searchable", () => {
    assert.equal(top("la complu"), "Universidad Complutense de Madrid");
    const upc = institutions.find((row) => row.id === "es-upc");
    assert.ok(upc?.aliases.some((alias) => fold(alias) === "barcelonatech"));
  });

  it("never lets an imported row claim a campus", () => {
    const imported = institutions.filter((row) => row.source === "wikidata");
    assert.ok(imported.length > 100);
    assert.ok(imported.every((row) => row.campusSlug === null));
  });

  it("points every curated campus at a campus row that exists", () => {
    const slugs = new Set(campuses.map((campus) => campus.slug));
    for (const row of institutions) {
      if (!row.campusSlug) continue;
      assert.ok(slugs.has(row.campusSlug), `${row.id} points at a missing campus ${row.campusSlug}`);
    }
  });

  it("has an institution for every campus, so nothing is unreachable", () => {
    for (const campus of campuses) {
      assert.ok(institutionForCampus(campus.slug), `no institution maps to campus ${campus.slug}`);
    }
  });

  it("assigns the Madrid metro rather than only the city of Madrid", () => {
    const madrid = institutionsInCity("madrid");
    assert.ok(madrid.length > 20, `expected the metro, got ${madrid.length}`);
    /* Carlos III is in Getafe and rides the same fare system. */
    assert.ok(madrid.some((row) => row.city === "Getafe" || row.city === "Alcalá de Henares"));
  });

  it("does not put the whole of Catalonia in Barcelona", () => {
    const barcelona = institutionsInCity("barcelona");
    assert.ok(barcelona.every((row) => !["Girona", "Lleida", "Tarragona"].includes(row.city)));
  });
});

describe("a dataset that does not exist yet", () => {
  it("returns nothing rather than throwing", () => {
    assert.deepEqual(searchInstitutions([], "anything", { citySlug: "madrid" }), []);
  });

  it("never blocks on an empty query with no city", () => {
    assert.deepEqual(searchInstitutions(institutions, "", {}), []);
  });

  it("scores a row with no aliases and no short name", () => {
    const bare: Institution = {
      id: "xx-1",
      officialName: "Tallinna Tehnikaülikool",
      shortName: null,
      aliases: [],
      countryCode: "EE",
      city: "Tallinn",
      region: null,
      citySlug: null,
      campusSlug: null,
      type: "university",
      website: null,
      lat: null,
      lng: null,
      source: "wikidata",
      sourceId: "Q1",
      verified: false,
      lastUpdatedAt: "2026-09-08",
    };
    assert.equal(searchInstitutions([bare], "tallinna")[0]?.institution.id, "xx-1");
    assert.equal(searchInstitutions([bare], "tehnikaulikool")[0]?.institution.id, "xx-1");
  });
});

/**
 * ============================================================================
 * THE REGISTRY ACROSS EIGHTEEN COUNTRIES
 * ----------------------------------------------------------------------------
 * These pin two things that broke while the registry grew from one country to
 * eighteen, both of which were silent.
 * ============================================================================
 */
describe("the multi-country registry", () => {
  it("holds more than one country, and says which", () => {
    /* `IMPORTED_COUNTRIES` was the literal ["ES"] and stayed that way while
       seventeen more countries were imported, so the product would have told a
       French student their country was not covered while holding four hundred
       French universities. It is derived from the data now. */
    assert.ok(IMPORTED_COUNTRIES.length > 1);
    assert.ok(IMPORTED_COUNTRIES.includes("ES"));
    assert.ok(IMPORTED_COUNTRIES.includes("FR"));
    assert.deepEqual([...IMPORTED_COUNTRIES].sort(), [...IMPORTED_COUNTRIES]);

    /* Every declared country must actually have rows behind it. */
    for (const code of IMPORTED_COUNTRIES) {
      assert.ok(
        institutions.some((row) => row.countryCode === code),
        `${code} is declared imported but has no institutions`,
      );
    }
  });

  it("never puts a whole country's universities in one city by accident", () => {
    /**
     * THE GREEK BUG. `fold` keeps only [a-z0-9], so any name in a non-Latin
     * script folds to the empty string: "Αθήνα" and "Θεσσαλονίκη" both become
     * "". The city matcher compares folded strings for equality, so without a
     * guard `"" === ""` is true and EVERY Greek institution is assigned to
     * whichever Greek city is listed first — silently, and looking entirely
     * plausible on screen.
     *
     * Athens therefore has no institutions attached, which is the honest
     * answer: we cannot read the town, so we do not claim to know it.
     */
    assert.equal(fold("Αθήνα"), "");
    assert.equal(institutionsInCity("athens").length, 0);

    /* And no city has absorbed an implausible share of one country. */
    const greek = institutions.filter((row) => row.countryCode === "GR");
    assert.ok(greek.length > 0, "Greece should still be searchable");
    assert.equal(
      greek.filter((row) => row.citySlug !== null).length,
      0,
      "no Greek institution should be attached to a city while fold() cannot read Greek",
    );
  });

  it("attaches universities to the cities students actually name them by", () => {
    /* The registry labels municipalities in the local language, so the metro
       table has to say Praha and Warszawa rather than Prague and Warsaw. A
       wrong name here is invisible: the city simply looks like it has no
       universities. */
    for (const [city, atLeast] of [
      ["paris", 20],
      ["rome", 10],
      ["prague", 10],
      ["warsaw", 10],
      ["dublin", 5],
      ["lisbon", 5],
    ] as const) {
      assert.ok(
        institutionsInCity(city).length >= atLeast,
        `${city} has ${institutionsInCity(city).length} institutions, expected at least ${atLeast}`,
      );
    }
  });
});
