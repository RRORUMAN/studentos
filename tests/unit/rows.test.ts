import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adoptRows,
  diffTable,
  keyFor,
  snapshotTable,
  stableStringify,
  transferKey,
  userIdOf,
  type Row,
} from "../../src/server/db/rows.ts";

/**
 * ============================================================================
 * ROW IDENTITY AND DIFFING
 * ----------------------------------------------------------------------------
 * This module decides what a write actually sends to Postgres, which makes it
 * the one place in the data layer where a quiet bug costs a student their data
 * rather than showing them an error.
 *
 * Two failure modes are worth naming, because the tests below exist for them
 * and not for coverage:
 *
 *   A change that is not detected is a write that silently does not happen.
 *   The student sees their post, the next page load does not.
 *
 *   An identity that is not carried across a replacement turns one update into
 *   a delete and an insert. The data survives; the row's key does not, and
 *   anything holding that key — a foreign reference, a share link — breaks.
 *
 * Everything here is synchronous and in-memory. No database is involved, which
 * is the point: the risky logic is the diff, and the diff is pure.
 * ============================================================================
 */

/** A table as it comes back from `studentos_dump`. */
function loaded(rows: readonly Row[]): { k: string; v: Row }[] {
  return rows.map((row) => ({ k: String(row.id ?? `k-${Math.random()}`), v: row }));
}

describe("stable serialisation", () => {
  it("ignores key order, so a spread that only reorders is not a write", () => {
    const a = { id: "1", city: "barcelona", cents: 900 };
    const b = { cents: 900, id: "1", city: "barcelona" };

    assert.equal(stableStringify(a), stableStringify(b));
  });

  it("sorts nested objects too", () => {
    const a = { id: "1", pay: { currency: "EUR", cents: 900 } };
    const b = { id: "1", pay: { cents: 900, currency: "EUR" } };

    assert.equal(stableStringify(a), stableStringify(b));
  });

  it("keeps array order, which is data rather than presentation", () => {
    const a = { id: "1", steps: ["a", "b"] };
    const b = { id: "1", steps: ["b", "a"] };

    assert.notEqual(stableStringify(a), stableStringify(b));
  });

  it("distinguishes a missing field from an explicitly null one", () => {
    /* `pay: null` means the source did not state a wage; no `pay` key at all is
       a different record, and collapsing the two would let a migration lose the
       distinction the Work board is built on. */
    assert.notEqual(stableStringify({ id: "1", pay: null }), stableStringify({ id: "1" }));
  });
});

describe("row identity", () => {
  it("uses the domain id when a row has one", () => {
    assert.equal(keyFor({ id: "post-1", body: "hello" }), "post-1");
  });

  it("mints a stable key for a row with no id, and keeps giving the same one", () => {
    const vote: Row = { userId: "u1", targetId: "p1", value: 1 };

    const first = keyFor(vote);
    const second = keyFor(vote);

    assert.equal(first, second);
    assert.notEqual(first, "");
  });

  it("gives two identical keyless rows different keys", () => {
    /* Two students can cast the same vote on different posts, and two rows that
       serialise alike are still two rows. Keying by content would merge them. */
    const a: Row = { userId: "u1", value: 1 };
    const b: Row = { userId: "u1", value: 1 };

    assert.notEqual(keyFor(a), keyFor(b));
  });

  it("carries identity across a replacement when the key is transferred", () => {
    const before: Row = { userId: "u1", channel: "c1", muted: false };
    const key = keyFor(before);

    const after: Row = { ...before, muted: true };
    transferKey(before, after);

    assert.equal(keyFor(after), key);
  });
});

describe("what a write sends", () => {
  it("reports nothing when nothing changed", () => {
    const rows: Row[] = [{ id: "a", n: 1 }, { id: "b", n: 2 }];
    const snapshot = snapshotTable(rows);

    assert.deepEqual(diffTable("events", rows, snapshot), []);
  });

  it("reports an appended row as an insert", () => {
    const rows: Row[] = [{ id: "a", n: 1 }];
    const snapshot = snapshotTable(rows);

    rows.push({ id: "b", n: 2, userId: "u9" });
    const changes = diffTable("events", rows, snapshot);

    assert.equal(changes.length, 1);
    assert.equal(changes[0].op, "insert");
    assert.equal(changes[0].id, "b");
    assert.equal(changes[0].op === "insert" ? changes[0].user_id : null, "u9");
  });

  it("reports an in-place mutation as an update", () => {
    /* `post.hiddenAt = nowIso()` is how half the transactions in this codebase
       are written. The object is the same object; only its contents moved. */
    const post: Row = { id: "p1", hiddenAt: null };
    const rows: Row[] = [post];
    const snapshot = snapshotTable(rows);

    post.hiddenAt = "2026-09-07T10:00:00.000Z";
    const changes = diffTable("posts", rows, snapshot);

    assert.equal(changes.length, 1);
    assert.equal(changes[0].op, "update");
    assert.equal(changes[0].id, "p1");
  });

  it("reports a wholesale replacement of an id-bearing row as one update", () => {
    /* Not a delete and an insert. The share link for a mission points at its
       id, and a row that changes key on every edit breaks every link to it. */
    const rows: Row[] = [{ id: "m1", step: 1 }];
    const snapshot = snapshotTable(rows);

    rows[0] = { ...rows[0], step: 2 };
    const changes = diffTable("missions", rows, snapshot);

    assert.equal(changes.length, 1);
    assert.equal(changes[0].op, "update");
    assert.equal(changes[0].id, "m1");
  });

  it("reports a removed row as a delete", () => {
    const rows: Row[] = [{ id: "a" }, { id: "b" }];
    const snapshot = snapshotTable(rows);

    rows.splice(0, 1);
    const changes = diffTable("saved", rows, snapshot);

    assert.deepEqual(changes, [{ op: "delete", tbl: "saved", id: "a" }]);
  });

  it("handles a splice out of the middle of a keyless table", () => {
    /* `toggleReaction` does exactly this: find the index, splice it out. The
       rows either side keep their keys because they keep their objects. */
    const rows: Row[] = [
      { userId: "u1", emoji: "a" },
      { userId: "u2", emoji: "b" },
      { userId: "u3", emoji: "c" },
    ];
    const snapshot = snapshotTable(rows);
    const removedKey = keyFor(rows[1]);

    rows.splice(1, 1);
    const changes = diffTable("chatReactions", rows, snapshot);

    assert.deepEqual(changes, [{ op: "delete", tbl: "chatReactions", id: removedKey }]);
  });

  it("reports an insert and a delete together without confusing them", () => {
    const rows: Row[] = [{ id: "a" }, { id: "b" }];
    const snapshot = snapshotTable(rows);

    rows.splice(0, 1);
    rows.push({ id: "c" });
    const changes = diffTable("deals", rows, snapshot);

    assert.equal(changes.length, 2);
    assert.deepEqual(
      changes.map((change) => `${change.op}:${change.id}`).sort(),
      ["delete:a", "insert:c"],
    );
  });

  it("does not report a row whose fields were reordered", () => {
    const rows: Row[] = [{ id: "a", x: 1, y: 2 }];
    const snapshot = snapshotTable(rows);

    rows[0] = { y: 2, x: 1, id: "a" };

    assert.deepEqual(diffTable("events", rows, snapshot), []);
  });
});

describe("loading and reloading", () => {
  it("adopts loaded rows so an untouched table writes nothing", () => {
    /* The regression this guards: without binding the loaded key to the object,
       a keyless row is minted a new uuid on first diff, and every reload turns
       the whole table into a delete-and-insert. */
    const table = adoptRows([
      { k: "row-1", v: { userId: "u1", channel: "c1", muted: false } },
      { k: "row-2", v: { userId: "u2", channel: "c1", muted: true } },
    ]);

    assert.deepEqual(diffTable("chatPrefs", table.rows, table.snapshot), []);
  });

  it("keeps a loaded row's storage key even when it also has a domain id", () => {
    /* The key that came back from Postgres wins over anything derivable. If
       they ever disagree, the database is right — it is the side that persists. */
    const table = adoptRows([{ k: "storage-key", v: { id: "domain-id", n: 1 } }]);

    assert.equal(keyFor(table.rows[0]), "storage-key");

    table.rows[0].n = 2;
    const changes = diffTable("events", table.rows, table.snapshot);

    assert.equal(changes.length, 1);
    assert.equal(changes[0].id, "storage-key");
  });

  it("survives a round trip: load, change one row, reload, change nothing", () => {
    const first = adoptRows(loaded([{ id: "a", n: 1 }, { id: "b", n: 2 }]));
    first.rows[0].n = 99;

    const changes = diffTable("events", first.rows, first.snapshot);
    assert.equal(changes.length, 1);

    /* What Postgres would hand back afterwards. */
    const second = adoptRows(loaded([{ id: "a", n: 99 }, { id: "b", n: 2 }]));
    assert.deepEqual(diffTable("events", second.rows, second.snapshot), []);
  });
});

describe("the owner column", () => {
  it("reads userId", () => {
    assert.equal(userIdOf({ id: "a", userId: "u1" }), "u1");
  });

  it("is null when the row does not belong to one student", () => {
    /* A city event has an `id` and no owner, and null is the honest answer.
       Reaching for `authorId` here would make the column mean something
       different per table. */
    assert.equal(userIdOf({ id: "a", authorId: "u1" }), null);
    assert.equal(userIdOf({ id: "a" }), null);
    assert.equal(userIdOf({ id: "a", userId: "" }), null);
  });
});
