import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyDatabase } from "../../src/server/db/schema.ts";
import { countSeededRows, purgeSeededRows, seedDatabase } from "../../src/server/db/seed.ts";

/**
 * ============================================================================
 * UNDOING A SEED
 * ----------------------------------------------------------------------------
 * `STUDENTOS_CONTENT_MODE=real` used to control one thing: whether the UI drew
 * the "this is sample content" notice. The seeder ran either way. So the
 * deployment that had done the honest thing — reviewed its cities, declared
 * its content real — was the one where invented events, invented deals and
 * invented price observations were shown to students with nothing marking
 * them, because the marking was exactly what the flag had switched off.
 *
 * Gating the seeder fixes that going forward. It does nothing for a store that
 * was already seeded, and there was no way back at all: the rows had no flag,
 * no provider, no `sourceUrl`, and deleting a table would have taken the
 * students' rows with it.
 *
 * These tests pin the two halves of the way back.
 *
 *   IT FINDS THEM     — every row the seeder wrote is identifiable, not by a
 *                       guess about how a seeded id looks, but by re-running
 *                       the seeder and comparing.
 *   IT SPARES OURS    — a student's own row in the same table is untouched.
 *                       This is the assertion that matters. A purge that is
 *                       slightly too eager is indistinguishable from data loss,
 *                       and it would be discovered by a student, not by us.
 * ============================================================================
 */

describe("purging seeded content", () => {
  it("counts the rows the seeder wrote", async () => {
    const db = emptyDatabase();
    await seedDatabase(db);

    const found = await countSeededRows(db);

    assert.ok(found.total > 0, "a seeded database should contain seeded rows");

    /* The tables the brief cares about: content a student could mistake for
       real-world fact. If a future seeder stops filling one of these, this
       list is the thing that should be updated deliberately. */
    for (const table of ["events", "deals", "posts", "priceObservations"]) {
      assert.ok(
        (found.removed[table] ?? 0) > 0,
        `expected seeded rows in "${table}", found ${found.removed[table] ?? 0}`,
      );
    }
  });

  it("removes every seeded row", async () => {
    const db = emptyDatabase();
    await seedDatabase(db);

    const before = await countSeededRows(db);
    const purge = await purgeSeededRows(db);
    const after = await countSeededRows(db);

    assert.equal(purge.total, before.total);
    assert.equal(after.total, 0, "a second pass should find nothing left");
  });

  it("leaves a student's own rows alone, in the very tables it empties", async () => {
    const db = emptyDatabase();
    await seedDatabase(db);

    /* A real student's event, in the table the purge is about to clear. Its id
       is a random uuid, exactly as `newId()` would produce — the seeder's ids
       are hashes of a slug, so the two can never collide. */
    const mine = {
      ...db.events[0],
      id: "11111111-2222-4333-a444-555555555555",
      title: "A thing I am actually running",
    };
    db.events.push(mine);

    const seededEvents = db.events.length - 1;

    await purgeSeededRows(db);

    assert.equal(db.events.length, 1, "only the student's event should remain");
    assert.equal(db.events[0]?.id, mine.id);
    assert.equal(db.events[0]?.title, "A thing I am actually running");
    assert.ok(seededEvents > 0, "the fixture should have had seeded events to remove");
  });

  it("is a no-op on a database that was never seeded", async () => {
    const db = emptyDatabase();

    const found = await countSeededRows(db);
    const purge = await purgeSeededRows(db);

    assert.equal(found.total, 0);
    assert.equal(purge.total, 0);
    assert.deepEqual(purge.removed, {});
  });

  it("does not invent price observations attributed to students", async () => {
    /* The sharpest case in the whole file. Seeded price observations carried
       `source: "student-report"` with a null userId and a plausible observation
       date, and the product counts them and tells a student "N students
       reported this". A budgeting product inventing what other people paid is
       the worst fabrication available to it, so after a purge there must be
       none of them left at all. */
    const db = emptyDatabase();
    await seedDatabase(db);

    const invented = db.priceObservations.filter(
      (row) => row.source === "student-report" && row.userId === null,
    );
    assert.ok(invented.length > 0, "fixture check: the seeder writes these");

    await purgeSeededRows(db);

    const remaining = db.priceObservations.filter(
      (row) => row.source === "student-report" && row.userId === null,
    );
    assert.deepEqual(remaining, [], "no unattributed student reports may survive a purge");
  });
});
