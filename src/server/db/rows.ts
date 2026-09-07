/**
 * ============================================================================
 * ROW IDENTITY AND DIFFING
 * ----------------------------------------------------------------------------
 * The application mutates plain arrays of plain objects. `db.posts.push(row)`,
 * `post.hiddenAt = nowIso()`, `db.votes.splice(i, 1)` — all three are ordinary
 * JavaScript and none of them announce themselves. A durable backend needs the
 * opposite: a list of rows that were added, changed or removed, addressed by a
 * stable key.
 *
 * This module is the translation, and it is deliberately pure: no I/O, no
 * imports from the store, nothing that needs a database to test. Given the
 * array a caller finished mutating and the snapshot taken when it was loaded,
 * it says what changed.
 *
 * The key question is identity. Most records carry a domain `id`, and using it
 * as the storage key means a row in Postgres is findable by the id the product
 * already talks about. Some do not — `Vote`, `ChatPrefs` and the other join
 * shapes are identified by their columns — so those get a synthetic key held in
 * a `WeakMap` keyed by the object itself, which survives in-place mutation and
 * is collected with the row.
 *
 * The one case identity cannot survive is a caller replacing a keyless row
 * wholesale (`rows[i] = { ...rows[i], changed: true }`). There is no thread
 * from the old object to the new one, so it reads as a delete and an insert.
 * The data is right either way; only the storage key changes, and for the
 * tables this can happen to that key is not something anything refers to.
 * ============================================================================
 */

import { randomUUID } from "node:crypto";

export type RowKey = string;

/** A record as it sits in the store: an opaque object with unknown fields. */
export type Row = Record<string, unknown>;

/**
 * What one logical table looked like when it was loaded: key to serialised
 * value. Serialised rather than a reference because rows are mutated in place,
 * so holding the object would compare it against itself.
 */
export type TableSnapshot = Map<RowKey, string>;

export type RowChange =
  | { op: "insert"; tbl: string; id: RowKey; user_id: string | null; data: Row }
  | { op: "update"; tbl: string; id: RowKey; user_id: string | null; data: Row }
  | { op: "delete"; tbl: string; id: RowKey };

/**
 * Object to storage key. Weak so a row that leaves the loaded table is not
 * pinned in memory by this map alone.
 */
const rowKeys = new WeakMap<object, RowKey>();

/** Remember the key a row already has in storage. */
export function rememberKey(row: object, key: RowKey): void {
  rowKeys.set(row, key);
}

/** The key a row is already known by, if any. */
export function knownKey(row: object): RowKey | undefined {
  return rowKeys.get(row);
}

/**
 * Move a key from one object to its replacement.
 *
 * `update()` in the store builds a new object rather than mutating the old one
 * (`{ ...row, ...patch }`), which is the right thing for callers holding a
 * reference to the previous value and the wrong thing for identity unless the
 * key comes with it.
 */
export function transferKey(from: object, to: object): void {
  const key = rowKeys.get(from);
  if (key !== undefined) rowKeys.set(to, key);
}

/**
 * Deterministic JSON: keys sorted at every level.
 *
 * `JSON.stringify` preserves insertion order, so `{ ...row, a: 1 }` and
 * `{ a: 1, ...row }` serialise differently while being the same record. Sorting
 * means a spread that only reorders fields is not reported as a change, and the
 * write it would have caused does not happen.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val === null || typeof val !== "object" || Array.isArray(val)) return val;
    const source = val as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = source[key];
    return sorted;
  });
}

/**
 * The student a row belongs to, denormalised into its own column.
 *
 * Only `userId` counts. A post has an `authorId` and a friendship has a
 * `requesterId`, and either could plausibly be "the owner", but a column that
 * means different things for different tables is worse than one that is null.
 */
export function userIdOf(row: Row): string | null {
  const value = row.userId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The storage key for a row, minting one when it has none.
 *
 * Order matters. A key already recorded wins, because it is the only evidence
 * that survives in-place mutation. A domain `id` comes next, and using it
 * directly is what carries identity across a wholesale replacement: the
 * replacement is a different object with the same `id`, so it resolves to the
 * same key and reads as an update rather than a delete and an insert. Anything
 * else is a keyless row — a vote, a chat preference — and gets a uuid that
 * lives beside it for as long as the object does.
 */
export function keyFor(row: Row): RowKey {
  const known = rowKeys.get(row);
  if (known !== undefined) return known;

  const id = row.id;
  if (typeof id === "string" && id.length > 0) {
    rowKeys.set(row, id);
    return id;
  }

  const minted = randomUUID();
  rowKeys.set(row, minted);
  return minted;
}

/**
 * What changed in one logical table.
 *
 * A row present in both with identical serialisations produces nothing at all;
 * this is the common case for a transaction that touched one row in a table of
 * thousands, and it is why a write does not rewrite a table.
 */
export function diffTable(
  tbl: string,
  rows: readonly Row[],
  snapshot: TableSnapshot,
): RowChange[] {
  const changes: RowChange[] = [];
  const present = new Set<RowKey>();

  for (const row of rows) {
    const key = keyFor(row);
    present.add(key);

    const serialised = stableStringify(row);
    const before = snapshot.get(key);

    if (before === undefined) {
      changes.push({ op: "insert", tbl, id: key, user_id: userIdOf(row), data: row });
    } else if (before !== serialised) {
      changes.push({ op: "update", tbl, id: key, user_id: userIdOf(row), data: row });
    }
  }

  for (const key of snapshot.keys()) {
    if (!present.has(key)) changes.push({ op: "delete", tbl, id: key });
  }

  return changes;
}

/** The snapshot a table should be remembered by once its changes have landed. */
export function snapshotTable(rows: readonly Row[]): TableSnapshot {
  const snapshot: TableSnapshot = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    snapshot.set(key, stableStringify(row));
  }
  return snapshot;
}

/**
 * Adopt rows loaded from storage: bind each object to the key it came back
 * under, and build the snapshot the next diff will compare against.
 *
 * Binding matters more than it looks. Without it a keyless row loaded from
 * Postgres would be minted a fresh uuid the first time anything diffed its
 * table, and every reload would move it — one row, a new key each time, and a
 * delete-and-insert on every write.
 */
export function adoptRows(loaded: readonly { k: RowKey; v: Row }[]): {
  rows: Row[];
  snapshot: TableSnapshot;
} {
  const rows: Row[] = [];
  const snapshot: TableSnapshot = new Map();

  for (const { k, v } of loaded) {
    rememberKey(v, k);
    rows.push(v);
    snapshot.set(k, stableStringify(v));
  }

  return { rows, snapshot };
}
