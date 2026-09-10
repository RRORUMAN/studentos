import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { neighbourhoods, findNeighbourhood, neighbourhoodsForCity } from "../../src/data/neighbourhoods.ts";
import type { Neighbourhood } from "../../src/data/types.ts";
import {
  MIN_COHORT,
  areaDensity,
  buildCityGraph,
  cohortCount,
  describe as describeRelation,
  relate,
  type GraphInput,
  type GraphStudent,
  type Relation,
} from "../../src/domain/graph.ts";
import {
  matchNeighbourhoods,
  scoreCommute,
  scoreRent,
  scoreTraits,
  type LivingPreferences,
} from "../../src/server/engines/neighbourhood.ts";

/**
 * ============================================================================
 * STUDENT CITY GRAPH AND NEIGHBOURHOOD MATCH
 * ----------------------------------------------------------------------------
 * Two rules here would each be a real incident if they broke quietly.
 *
 * The first is the cohort floor. Every count the graph publishes about other
 * students passes through `cohortCount`, and the failure mode when it stops
 * doing so is not a wrong number on a card — it is "1 student from your campus
 * saved this" in a city with four users, which is a name with the label taken
 * off. That is why the floor is tested from both sides of the boundary and why
 * friends are tested as the deliberate exception rather than as an oversight.
 *
 * The second is that the neighbourhood ranking never drops a row. An area a
 * student cannot afford must come back last and labelled, never filtered:
 * hiding it teaches them the city is smaller than it is, and the hidden one is
 * the area their friend is about to move to.
 * ============================================================================
 */

const NOW = new Date("2026-09-10T12:00:00Z");

/**
 * The campuses and listed area names from `src/data/cities.ts`, restated here.
 *
 * Not laziness and not a second source of truth: node's native type stripping
 * resolves imports literally, so a unit test cannot import a module that uses
 * the `@/` alias, and `cities.ts` does. Restating the two lists lets the
 * cross-file invariants below run at all. The residual gap — someone editing
 * `cities.ts` and this fixture is what fails, rather than the product — is
 * called out here so the next person does not assume it is airtight.
 */
const CITY_CAMPUSES: Record<string, readonly string[]> = {
  madrid: ["ucm", "uam", "uc3m", "upm"],
  barcelona: ["ub", "upf", "upc"],
  london: ["ucl", "kcl", "qmul"],
  amsterdam: ["uva", "vu"],
  berlin: ["hu", "fu", "tu"],
};

const CITY_AREA_NAMES: Record<string, readonly string[]> = {
  madrid: ["Malasaña", "Lavapiés", "Chamberí", "Moncloa", "La Latina", "Argüelles"],
  barcelona: ["Gràcia", "El Raval", "Poblenou", "Sants", "El Born"],
  london: ["Bloomsbury", "Peckham", "Shoreditch", "Camden", "New Cross"],
  amsterdam: ["De Pijp", "Oost", "Westerpark", "Noord", "Bijlmer"],
  berlin: ["Neukölln", "Kreuzberg", "Wedding", "Friedrichshain", "Charlottenburg"],
};

const campusesFor = (citySlug: string) =>
  (CITY_CAMPUSES[citySlug] ?? []).map((slug) => ({
    slug,
    name: slug,
    shortName: slug.toUpperCase(),
    citySlug,
    area: "",
  }));

function student(id: string, over: Partial<GraphStudent> = {}): GraphStudent {
  return { userId: id, campusSlug: "ucm", areaSlug: "malasana", discoverable: true, ...over };
}

function graphOf(over: Partial<GraphInput> = {}) {
  return buildCityGraph({
    citySlug: "madrid",
    campuses: campusesFor("madrid"),
    areas: neighbourhoodsForCity("madrid"),
    students: [],
    saves: [],
    friendships: [],
    claims: [],
    now: NOW,
    ...over,
  });
}

/* -------------------------------------------------------------------------- */
/* The privacy floor                                                           */
/* -------------------------------------------------------------------------- */

describe("cohort floor", () => {
  it("withholds a count below the floor and returns null, not zero", () => {
    assert.equal(cohortCount(MIN_COHORT - 1), null);
    assert.equal(cohortCount(0), null);
    assert.equal(cohortCount(MIN_COHORT), MIN_COHORT);
  });

  it("does not publish a campus-saves relation below the floor", () => {
    const viewer = student("me");
    const others = Array.from({ length: MIN_COHORT - 1 }, (_, i) => student(`u${i}`));

    const graph = graphOf({
      students: [viewer, ...others],
      saves: others.map((s) => ({ userId: s.userId, targetKind: "place" as const, targetId: "p1" })),
    });

    const relations = relate(graph, viewer, { kind: "place", id: "p1" });
    assert.equal(relations.find((r) => r.kind === "campus-saves"), undefined);
  });

  it("publishes it once the floor is reached", () => {
    const viewer = student("me");
    const others = Array.from({ length: MIN_COHORT }, (_, i) => student(`u${i}`));

    const graph = graphOf({
      students: [viewer, ...others],
      saves: others.map((s) => ({ userId: s.userId, targetKind: "place" as const, targetId: "p1" })),
    });

    const found = relate(graph, viewer, { kind: "place", id: "p1" }).find(
      (r): r is Extract<Relation, { kind: "campus-saves" }> => r.kind === "campus-saves",
    );
    assert.equal(found?.count, MIN_COHORT);
  });

  it("excludes students who have not opted in from the count", () => {
    const viewer = student("me");
    const hidden = Array.from({ length: MIN_COHORT + 2 }, (_, i) =>
      student(`u${i}`, { discoverable: false }),
    );

    const graph = graphOf({
      students: [viewer, ...hidden],
      saves: hidden.map((s) => ({ userId: s.userId, targetKind: "place" as const, targetId: "p1" })),
    });

    assert.equal(
      relate(graph, viewer, { kind: "place", id: "p1" }).find((r) => r.kind === "campus-saves"),
      undefined,
    );
  });

  it("counts friends without a floor, because a friend is already known to the viewer", () => {
    const viewer = student("me");
    const friend = student("friend");

    const graph = graphOf({
      students: [viewer, friend],
      saves: [{ userId: "friend", targetKind: "place", targetId: "p1" }],
      friendships: [{ a: "me", b: "friend" }],
    });

    const found = relate(graph, viewer, { kind: "place", id: "p1" }).find(
      (r): r is Extract<Relation, { kind: "friend-saves" }> => r.kind === "friend-saves",
    );
    assert.equal(found?.count, 1);
    assert.equal(describeRelation(found!), "Saved by a friend");
  });

  it("omits an under-floor area from the density map rather than reporting zero", () => {
    const graph = graphOf({
      students: [student("a"), student("b", { areaSlug: "lavapies" })],
    });
    const density = areaDensity(graph);
    assert.equal(density.has("malasana"), false);
    assert.equal(density.has("lavapies"), false);
  });
});

/* -------------------------------------------------------------------------- */
/* Relations                                                                   */
/* -------------------------------------------------------------------------- */

describe("relations", () => {
  it("puts a friend's save above every aggregate", () => {
    const viewer = student("me");
    const friend = student("friend");
    const cohort = Array.from({ length: MIN_COHORT }, (_, i) => student(`u${i}`));

    const graph = graphOf({
      students: [viewer, friend, ...cohort],
      saves: [friend, ...cohort].map((s) => ({
        userId: s.userId,
        targetKind: "place" as const,
        targetId: "p1",
      })),
      friendships: [{ a: "me", b: "friend" }],
    });

    assert.equal(relate(graph, viewer, { kind: "place", id: "p1" })[0]?.kind, "friend-saves");
  });

  it("says the place is in the viewer's own area rather than naming it neutrally", () => {
    const viewer = student("me", { areaSlug: "malasana" });
    const graph = graphOf({ students: [viewer] });
    const kinds = relate(graph, viewer, { kind: "place", id: "p1" }, { areaSlug: "malasana" }).map(
      (r) => r.kind,
    );
    assert.ok(kinds.includes("home-area"));
    assert.ok(!kinds.includes("in-area"));
  });

  it("gives a commute from the area to the viewer's campus", () => {
    const viewer = student("me", { areaSlug: "lavapies", campusSlug: "ucm" });
    const graph = graphOf({ students: [viewer] });
    const commute = relate(graph, viewer, { kind: "place", id: "p1" }, { areaSlug: "malasana" }).find(
      (r): r is Extract<Relation, { kind: "commute" }> => r.kind === "commute",
    );
    assert.equal(commute?.minutes, neighbourhoods.find((a) => a.slug === "malasana")!.commuteMinutes.ucm);
  });

  it("returns nothing rather than guessing when the node has no area", () => {
    const viewer = student("me");
    const graph = graphOf({ students: [viewer] });
    const kinds = relate(graph, viewer, { kind: "place", id: "p1" }).map((r) => r.kind);
    assert.ok(!kinds.includes("in-area"));
    assert.ok(!kinds.includes("commute"));
  });
});

/* -------------------------------------------------------------------------- */
/* Neighbourhood rows                                                          */
/* -------------------------------------------------------------------------- */

describe("neighbourhood rows", () => {
  it("covers every name the city record lists", () => {
    for (const [citySlug, names] of Object.entries(CITY_AREA_NAMES)) {
      for (const name of names) {
        assert.ok(
          findNeighbourhood(citySlug, name),
          `${citySlug} lists "${name}" with no neighbourhood row`,
        );
      }
      assert.equal(neighbourhoodsForCity(citySlug).length, names.length);
    }
  });

  it("has a commute figure for every campus in its own city", () => {
    for (const area of neighbourhoods) {
      for (const slug of CITY_CAMPUSES[area.citySlug] ?? []) {
        assert.equal(
          typeof area.commuteMinutes[slug],
          "number",
          `${area.name} has no commute to ${slug}`,
        );
      }
    }
  });

  it("keeps every rent band the right way round", () => {
    for (const area of neighbourhoods) {
      /* An imported area carries no band at all, which is not a band the
         wrong way round. Only priced areas have an ordering to check. */
      const rent = area.rent;
      if (!rent) continue;
      assert.ok(rent.room[0] < rent.room[1], `${area.name} room band inverted`);
      if (rent.studio) {
        assert.ok(rent.studio[0] < rent.studio[1], `${area.name} studio band inverted`);
        assert.ok(rent.studio[0] > rent.room[0], `${area.name} studio cheaper than a room`);
      }
    }
  });

  it("matches an accented name typed without its accents", () => {
    assert.equal(findNeighbourhood("madrid", "Malasana")?.slug, "malasana");
    assert.equal(findNeighbourhood("madrid", "Argüelles")?.slug, "arguelles");
    assert.equal(findNeighbourhood("madrid", "Nowhere"), undefined);
  });
});

/* -------------------------------------------------------------------------- */
/* Matching                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * An editorial area, with its band proved present rather than assumed.
 *
 * Rent is nullable now that imported areas carry a name and a coordinate and
 * nothing else. These cases are about how a *priced* area ranks, so they say
 * out loud that they picked one -- rather than reaching through the null with
 * a non-null assertion that would go quiet on the day the row loses its band.
 */
type PricedArea = Neighbourhood & { rent: NonNullable<Neighbourhood["rent"]> };

function priced(slug: string): PricedArea {
  const area = neighbourhoods.find((a) => a.slug === slug);
  assert.ok(area, `no area called ${slug}`);
  assert.ok(area.rent, `${slug} carries no rent band, so it cannot stand in for a priced one`);
  return area as PricedArea;
}

const prefs = (over: Partial<LivingPreferences> = {}): LivingPreferences => ({
  campusSlug: "ucm",
  rentCeiling: null,
  maxCommuteMinutes: 35,
  priorities: {},
  ...over,
});

describe("neighbourhood match", () => {
  it("ranks every area and drops none, including the unaffordable ones", () => {
    const areas = neighbourhoodsForCity("london");
    const results = matchNeighbourhoods({ areas, preferences: prefs({ campusSlug: "ucl", rentCeiling: 700 }) });

    assert.equal(results.length, areas.length);
    assert.ok(results.some((r) => r.rentVerdict === "over"), "expected at least one over-budget area");
    assert.equal(results.at(-1)?.rentVerdict, "over", "an over-budget area should sort last");
  });

  it("labels a band that straddles the ceiling as tight rather than affordable", () => {
    const area = priced("wedding");
    assert.equal(scoreRent(area, area.rent.room[1] - 50).verdict, "tight");
    assert.equal(scoreRent(area, area.rent.room[1] + 200).verdict, "comfortable");
    assert.equal(scoreRent(area, area.rent.room[0] - 50).verdict, "over");
  });

  it("drops rent out of the ranking entirely when no ceiling is set", () => {
    const area = priced("wedding");
    const { score, verdict } = scoreRent(area, null);
    assert.equal(verdict, "unknown");
    assert.equal(score, 0.5);
  });

  it("does not reward a commute for being shorter than anyone notices", () => {
    assert.equal(scoreCommute(5, 40), 1);
    assert.equal(scoreCommute(20, 40), scoreCommute(20, 40));
    assert.ok(scoreCommute(45, 40) < scoreCommute(35, 40));
    assert.ok(scoreCommute(90, 40) < scoreCommute(45, 40));
    assert.equal(scoreCommute(null, 40), 0.5, "no figure is neutral, never a penalty");
  });

  it("normalises traits over what was asked for, not over all seven", () => {
    const area = neighbourhoods.find((a) => a.slug === "charlottenburg")!;
    // Charlottenburg is quiet: 4. Asking only about quiet must give a full score.
    assert.equal(scoreTraits(area, { quiet: 2 }), 1);
    // Adding a trait it is weak on must pull it down, not leave it unchanged.
    assert.ok(scoreTraits(area, { quiet: 2, nightlife: 2 }) < 1);
    assert.equal(scoreTraits(area, {}), 0.5);
  });

  it("puts the area a student asked for at the top", () => {
    const results = matchNeighbourhoods({
      areas: neighbourhoodsForCity("berlin"),
      preferences: prefs({ campusSlug: "tu", priorities: { quiet: 2, groceries: 2 } }),
    });
    assert.equal(results[0]?.area.slug, "charlottenburg");
  });

  it("gives the winner a tradeoff too when there is one", () => {
    const results = matchNeighbourhoods({
      areas: neighbourhoodsForCity("madrid"),
      preferences: prefs({ rentCeiling: 500, priorities: { nightlife: 2 } }),
    });
    // Nothing central in Madrid is both cheap and loud; whatever wins here has
    // something to admit, and the card must be able to say so.
    assert.ok(results[0]!.tradeoffs.length > 0);
  });

  it("carries the rent basis through to the result", () => {
    const results = matchNeighbourhoods({
      areas: neighbourhoodsForCity("madrid"),
      preferences: prefs(),
    });
    assert.ok(results.every((r) => r.rentEstimated), "seeded bands must be marked as estimates");
  });
});
