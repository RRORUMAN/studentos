import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { arrivalTasksByCity, arrivalTasksFor, genericArrivalTasks } from "../../src/data/arrival.ts";
import { cityDirectory } from "../../src/data/cities.ts";

/**
 * ============================================================================
 * ARRIVAL MODE
 * ----------------------------------------------------------------------------
 * The fallback list used to be `arrivalTasksByCity.madrid`, verbatim. One city
 * has a seeded list, so every student in the other seventy-nine opened the
 * screen for their first two weeks abroad and read that they should get the
 * Abono Joven, that it costs about €20 a month, and that the authority for
 * their residency is the Spanish Ministry of Foreign Affairs. In Seoul.
 *
 * These cases pin the two properties that make that impossible to reintroduce:
 * the fallback carries no claim specific to one country, and a row flagged
 * `legal` never links to an authority that is not the student's.
 * ============================================================================
 */

/**
 * The named things in Madrid's list, which exist only in Madrid.
 *
 * "Spain" is deliberately not on this list: Barcelona's residency row says
 * "What Spain requires of you…", which is right. The country check is the
 * separate case below, and it is the more precise one — it asks whether a city
 * is being told about a country that is not its own.
 */
const MADRID_ONLY = ["abono joven", "consorcio regional", "crtm", "exteriores.gob.es"];

describe("arrival tasks outside a seeded city", () => {
  it("tells no city about another country's transport card", () => {
    for (const city of cityDirectory) {
      if (arrivalTasksByCity[city.slug]) continue;
      const text = JSON.stringify(arrivalTasksFor(city.slug)).toLowerCase();
      for (const term of MADRID_ONLY) {
        assert.ok(!text.includes(term), `${city.slug} is being told about "${term}"`);
      }
    }
  });

  it("names no country but the student's own", () => {
    /* THE ACTUAL BUG, stated as a property. A student in Seoul was reading
       about the Spanish Ministry of Foreign Affairs, and nothing in the type
       system, the tests or the interface objected. */
    const countries = [...new Set(cityDirectory.map((city) => city.country.toLowerCase()))];

    for (const city of cityDirectory) {
      if (arrivalTasksByCity[city.slug]) continue;
      const text = JSON.stringify(arrivalTasksFor(city.slug)).toLowerCase();
      const mine = city.country.toLowerCase();
      for (const country of countries) {
        if (country === mine) continue;
        /* Substring, not word match: a URL on a foreign ministry's domain is
           exactly the failure being guarded against, and it has no spaces. */
        assert.ok(
          !text.includes(country),
          `a student in ${city.name} is being told about ${country}`,
        );
      }
    }
  });

  it("quotes no price, because a price is a claim about one economy", () => {
    /* Currency symbols and bare amounts both. The generic list is read in
       eighty countries and there is no figure that is true in all of them. */
    for (const city of cityDirectory) {
      if (arrivalTasksByCity[city.slug]) continue;
      for (const task of arrivalTasksFor(city.slug)) {
        assert.equal(task.cost, undefined, `${city.slug}/${task.id} quotes a cost`);
        assert.ok(
          !/[€$£¥₩]|\d+\s*(a month|per month|a week)/i.test(task.detail),
          `${city.slug}/${task.id} quotes a price in its detail`,
        );
      }
    }
  });

  it("links a transport authority only where the city record carries one", () => {
    for (const city of cityDirectory) {
      if (arrivalTasksByCity[city.slug]) continue;
      const transport = arrivalTasksFor(city.slug).find((task) => task.id === "transport");
      assert.ok(transport, `${city.slug} has no transport task`);
      if (city.transport) {
        assert.equal(transport.source?.url, city.transport.officialUrl);
      } else {
        assert.equal(transport.source, undefined, `${city.slug} invented a transport source`);
      }
    }
  });

  it("never points a legal row at a source we did not check for that country", () => {
    /* The residency row is the dangerous one: the interface gives a `legal`
       row extra weight, so a wrong link there is a wrong link with an official
       badge next to it. Until there is a checked per-country source, it links
       nothing and names the international office instead. */
    for (const city of cityDirectory) {
      if (arrivalTasksByCity[city.slug]) continue;
      const registration = arrivalTasksFor(city.slug).find((task) => task.id === "registration");
      assert.ok(registration?.legal, `${city.slug} does not flag residency as legal`);
      assert.equal(registration.source, undefined, `${city.slug} links a residency authority`);
      assert.ok(
        registration.detail.toLowerCase().includes("international office"),
        `${city.slug} does not say who to actually ask`,
      );
    }
  });

  it("still gives every city a finishable list", () => {
    for (const city of cityDirectory) {
      const tasks = arrivalTasksFor(city.slug);
      assert.ok(tasks.length >= 6, `${city.slug} has only ${tasks.length} arrival tasks`);
      for (const task of tasks) {
        assert.ok(task.label.trim().length > 0, `${city.slug} has an unlabelled task`);
        assert.ok(task.detail.trim().length > 0, `${city.slug}/${task.id} has no detail`);
        assert.ok(task.effort.trim().length > 0, `${city.slug}/${task.id} has no effort`);
      }
      /* Ids are how completion is stored, so a duplicate would tick two rows. */
      const ids = new Set(tasks.map((task) => task.id));
      assert.equal(ids.size, tasks.length, `${city.slug} repeats a task id`);
    }
  });

  it("stands up with no city at all", () => {
    assert.ok(genericArrivalTasks.length >= 6);
    const text = JSON.stringify(genericArrivalTasks).toLowerCase();
    for (const term of MADRID_ONLY) assert.ok(!text.includes(term), term);
    assert.ok(!text.includes("undefined"), "an interpolation fell through to undefined");
    assert.ok(!text.includes("null"), "an interpolation fell through to null");
  });
});
