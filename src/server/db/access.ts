import "server-only";

import { randomUUID } from "node:crypto";

import { env } from "@/services/env";
import type { Database, Persistence, StudentOsStore, TableName } from "@/server/db/schema";
import { store as jsonStore } from "@/server/db/store";
import { SupabaseStore } from "@/server/db/supabase-store";
import { transferKey } from "@/server/db/rows";

/**
 * ============================================================================
 * DATA ACCESS
 * ----------------------------------------------------------------------------
 * The eight functions every call site in `src/server/**` is written against,
 * and the one place that decides which store they run on.
 *
 * The choice is made from the environment and nowhere else:
 *
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  → Postgres row store
 *   neither                                               → JSON file
 *
 * Note which two variables those are. The anon key does not appear: it is the
 * key a browser is allowed to hold, and this store is reached only from the
 * server. A deployment with a URL and an anon key but no service role key gets
 * the file store and says so, rather than half-connecting.
 *
 * `STUDENTOS_STORE` overrides the choice — `file` to keep a Supabase-configured
 * developer on the local file, `supabase` to make a misconfiguration fail
 * loudly instead of quietly running on a file nobody expected.
 * ============================================================================
 */

function chooseStore(): { store: StudentOsStore; kind: "file" | "supabase" } {
  const configured = Boolean(env.supabase.url && env.supabase.serviceRoleKey);
  const override = env.storeOverride;

  if (override === "file") return { store: jsonStore, kind: "file" };

  if (override === "supabase" && !configured) {
    throw new Error(
      "[studentos] STUDENTOS_STORE=supabase but NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY are not both set. Refusing to start on the " +
        "file store when the deployment asked for Postgres.",
    );
  }

  if (configured || override === "supabase") {
    return { store: new SupabaseStore(), kind: "supabase" };
  }

  return { store: jsonStore, kind: "file" };
}

/**
 * Next.js re-evaluates modules on hot reload, and a second store would fork the
 * write chain and hold a second cache. Pinned to the global object for the same
 * reason the JSON store is.
 */
const globalForAccess = globalThis as unknown as {
  __studentosActiveStore?: { store: StudentOsStore; kind: "file" | "supabase" };
};

const active = (globalForAccess.__studentosActiveStore ??= chooseStore());

export const store: StudentOsStore = active.store;

/** Which store is actually serving reads and writes. Shown in `/admin`. */
export const storeKind: "file" | "supabase" = active.kind;

/* -------------------------------------------------------------------------- */
/* Generic helpers                                                             */
/* -------------------------------------------------------------------------- */

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** `disk` when writes outlive the process, `ephemeral` on a serverless host. */
export async function storePersistence(): Promise<Persistence> {
  return store.persistence();
}

/** `select` a whole table. */
export async function all<K extends TableName>(table: K): Promise<Database[K]> {
  return store.read((db) => db[table]);
}

/** First row matching a predicate, or null. */
export async function findOne<K extends TableName>(
  table: K,
  match: (row: Database[K][number]) => boolean,
): Promise<Database[K][number] | null> {
  return store.read((db) => (db[table] as Database[K][number][]).find(match) ?? null);
}

/** Every row matching a predicate. */
export async function findMany<K extends TableName>(
  table: K,
  match: (row: Database[K][number]) => boolean,
): Promise<Database[K][number][]> {
  return store.read((db) => (db[table] as Database[K][number][]).filter(match));
}

export async function insert<K extends TableName>(
  table: K,
  row: Database[K][number],
): Promise<Database[K][number]> {
  return store.write((db) => {
    (db[table] as Database[K][number][]).push(row);
    return row;
  });
}

export async function insertMany<K extends TableName>(
  table: K,
  rows: readonly Database[K][number][],
): Promise<void> {
  await store.write((db) => {
    (db[table] as Database[K][number][]).push(...rows);
  });
}

/**
 * Update the first matching row. Returns the updated row, or null when nothing
 * matched — callers treat null as "not found" rather than silently succeeding.
 */
export async function update<K extends TableName>(
  table: K,
  match: (row: Database[K][number]) => boolean,
  patch: Partial<Database[K][number]>,
): Promise<Database[K][number] | null> {
  return store.write((db) => {
    const rows = db[table] as Database[K][number][];
    const index = rows.findIndex(match);
    if (index === -1) return null;

    const previous = rows[index];
    const next = { ...previous, ...patch };
    /* The new object is a different object, and to the row store a different
       object is a different row unless the storage key comes across with it. */
    transferKey(previous as object, next as object);

    rows[index] = next;
    return rows[index];
  });
}

/** Insert, or patch the existing row when one matches. */
export async function upsert<K extends TableName>(
  table: K,
  match: (row: Database[K][number]) => boolean,
  row: Database[K][number],
): Promise<Database[K][number]> {
  return store.write((db) => {
    const rows = db[table] as Database[K][number][];
    const index = rows.findIndex(match);
    if (index === -1) {
      rows.push(row);
      return row;
    }

    const previous = rows[index];
    const next = { ...previous, ...row };
    transferKey(previous as object, next as object);

    rows[index] = next;
    return rows[index];
  });
}

/** Remove every matching row. Returns how many went. */
export async function remove<K extends TableName>(
  table: K,
  match: (row: Database[K][number]) => boolean,
): Promise<number> {
  return store.write((db) => {
    const rows = db[table] as Database[K][number][];
    const kept = rows.filter((row) => !match(row));
    const removed = rows.length - kept.length;

    /* In place, so anything holding this array sees the removal — and by index
       rather than a spread into `push`, which passes one argument per row and
       overflows the stack on a table large enough to matter. */
    rows.length = kept.length;
    for (let index = 0; index < kept.length; index += 1) rows[index] = kept[index];
    return removed;
  });
}

/** Multiple mutations under one persist. Use for anything that must be atomic. */
export async function transaction<T>(mutate: (db: Database) => T | Promise<T>): Promise<T> {
  return store.write(mutate);
}
