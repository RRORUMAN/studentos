import "server-only";

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/services/env";
import {
  DATABASE_VERSION,
  emptyDatabase,
  type Database,
  type Persistence,
  type StudentOsStore,
  type TableName,
} from "@/server/db/schema";
import {
  adoptRows,
  diffTable,
  snapshotTable,
  type Row,
  type RowChange,
  type RowKey,
  type TableSnapshot,
} from "@/server/db/rows";

/**
 * ============================================================================
 * THE SUPABASE STORE
 * ----------------------------------------------------------------------------
 * One row per record in Postgres, addressed by (logical table, id), with the
 * record itself as jsonb. `supabase/migrations/0005_row_store.sql` is the other
 * half of this file and its header explains why the shape is what it is.
 *
 * The application is written in JavaScript predicates over arrays — roughly
 * seven hundred call sites of `findMany("events", (row) => …)`. This store does
 * not try to translate those into SQL. It materialises the table, lets the
 * predicate run where it was written to run, and turns whatever the caller
 * changed back into per-row INSERT/UPDATE/DELETE inside one transaction.
 *
 * Three things make that safe rather than merely convenient:
 *
 * 1. **Writes are per row.** A student sending a chat message writes one row,
 *    not the chat table. This is the difference between a store that survives a
 *    launch and one that rewrites megabytes per keystroke.
 *
 * 2. **Concurrency is optimistic and checked.** Every write declares which
 *    tables it read and the revision it believed they were at. If another
 *    instance moved one of them first, Postgres rejects the whole change set
 *    and this store reloads and replays. Nothing lands half-applied.
 *
 * 3. **Staleness is bounded and visible.** Instances poll a revision table and
 *    reload only what moved. A write always re-checks first, so a
 *    read-modify-write is never based on a cache another instance has already
 *    invalidated. A plain read may be up to `FRESHNESS_MS` behind.
 *
 * What this is not: an indexed relational schema. Filtering happens in the
 * application, so a logical table is held in memory by the instance that reads
 * it. That is fine for a launch and it has a ceiling — see `docs/data-layer.md`
 * for the number and for how a hot table gets promoted to a real one without
 * any call site changing.
 * ============================================================================
 */

/**
 * How long a plain read may serve a table without asking Postgres whether it
 * moved. Writes ignore this and always check.
 *
 * One second is chosen against the product rather than in the abstract: the
 * things two students do to each other in the same second are chat messages and
 * Anyone Down joins, and both already poll. A student never waits a second to
 * see their own write, because their own write refreshed this instance.
 */
const FRESHNESS_MS = 1_000;

/** How many times a write replays after losing an optimistic check. */
const MAX_WRITE_ATTEMPTS = 6;

type DumpPayload = Record<string, { k: RowKey; v: Row }[] | null>;
type RevisionMap = Record<string, number>;

type ApplyResult =
  | { ok: true; revisions: RevisionMap }
  | { ok: false; conflict: string[] };

type StoreState = { schemaVersion: number; seededAt: string } | null;

/**
 * A missing function means migration 0005 has not been applied. That has to be
 * loud: falling back to the JSON store here would give a deployment that looks
 * connected, accepts sign-ups, and loses them on the next deploy.
 */
function describeRpcFailure(fn: string, message: string): string {
  const missing =
    message.includes("does not exist") ||
    message.includes("Could not find the function") ||
    message.includes("schema cache");

  if (missing) {
    return (
      `[studentos] Supabase is configured but \`${fn}\` is not in the database. ` +
      `Apply supabase/migrations/0005_row_store.sql (see docs/data-layer.md), ` +
      `then redeploy. Refusing to fall back to the local file store: a ` +
      `deployment that accepts sign-ups and loses them is worse than one that ` +
      `will not start.`
    );
  }
  return `[studentos] Supabase call \`${fn}\` failed: ${message}`;
}

/**
 * How a call reaches Postgres. One function, because there are only six of them
 * and they are all `rpc(name, args)`.
 *
 * Injectable so the coordination logic above it — optimistic retry, replaying a
 * mutation after losing a race, reloading only what moved — can be tested
 * without a database. That logic is where a bug loses somebody's data silently,
 * and it was otherwise reachable only by having two servers race each other
 * against a live project. The SQL semantics it is tested against are a
 * reimplementation, so they prove the store, not the migration; `pnpm db:verify`
 * is what proves the migration.
 */
export type StoreTransport = (fn: string, args: Record<string, unknown>) => Promise<unknown>;

export class SupabaseStore implements StudentOsStore {
  private client: SupabaseClient | null = null;
  private readonly transport: StoreTransport | null;

  constructor(transport?: StoreTransport) {
    this.transport = transport ?? null;
  }

  private data: Database | null = null;
  private loading: Promise<Database> | null = null;

  /** Per table, the keys and serialised values last known to be in Postgres. */
  private snapshots = new Map<string, TableSnapshot>();
  /** Per table, the revision this instance last saw. Absent means never read. */
  private revisions: RevisionMap = {};
  private lastFreshnessCheck = 0;
  private freshnessInFlight: Promise<void> | null = null;

  private writeChain: Promise<unknown> = Promise.resolve();

  private seeder: ((db: Database) => void | Promise<void>) | null = null;
  private migrator: ((db: Database, from: number) => void | Promise<void>) | null = null;

  registerSeeder(seeder: (db: Database) => void | Promise<void>): void {
    this.seeder = seeder;
  }

  registerMigrator(migrator: (db: Database, from: number) => void | Promise<void>): void {
    this.migrator = migrator;
  }

  /* ---------------------------------------------------------------------- */
  /* Transport                                                              */
  /* ---------------------------------------------------------------------- */

  private connection(): SupabaseClient {
    if (this.client) return this.client;

    const { url, serviceRoleKey } = env.supabase;
    if (!url || !serviceRoleKey) {
      /* `access.ts` only constructs this store when both are present, so this
         is a programming error rather than a configuration one. */
      throw new Error(
        "[studentos] SupabaseStore constructed without a URL and service role key.",
      );
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      /* The service role must never be handed a user's JWT by accident. */
      global: { headers: { "x-studentos-store": "row-store" } },
    });
    return this.client;
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    if (this.transport) return (await this.transport(fn, args)) as T;

    const { data, error } = await this.connection().rpc(fn, args);
    if (error) throw new Error(describeRpcFailure(fn, error.message));
    return data as T;
  }

  /* ---------------------------------------------------------------------- */
  /* Loading                                                                */
  /* ---------------------------------------------------------------------- */

  async load(): Promise<Database> {
    return this.loadFresh(FRESHNESS_MS);
  }

  /**
   * `load`, with control over how stale a cached copy may be.
   *
   * Writes pass 0 to force the revision poll. They cannot go through `load`
   * and then force a second check, because that is two round trips to learn one
   * thing.
   */
  private async loadFresh(maxAge: number): Promise<Database> {
    if (this.data) {
      await this.ensureFresh(maxAge);
      return this.data;
    }
    this.loading ??= this.readOrSeed();
    try {
      this.data = await this.loading;
    } finally {
      this.loading = null;
    }
    return this.data;
  }

  /**
   * Fill an empty `Database` from a dump, binding every row to the key it came
   * back under so the next diff can recognise it.
   */
  private absorb(db: Database, dump: DumpPayload, tables: readonly string[]): void {
    for (const table of tables) {
      const loaded = dump[table] ?? [];
      const { rows, snapshot } = adoptRows(loaded);

      /* Replace the contents rather than the array. Callers hold references to
         `db.events` across a refresh, and swapping the array under them would
         leave them reading a detached copy.

         Assigned by index rather than spread into `push`: a spread passes every
         row as a separate argument, and a table of a hundred thousand chat
         messages overflows the call stack. That failure would arrive exactly
         when the product started working. */
      const target = db[table as TableName] as unknown as Row[];
      target.length = rows.length;
      for (let index = 0; index < rows.length; index += 1) target[index] = rows[index];

      this.snapshots.set(table, snapshot);
    }
  }

  private tableNames(db: Database): string[] {
    return Object.keys(db).filter((key) => Array.isArray((db as Record<string, unknown>)[key]));
  }

  private async readOrSeed(): Promise<Database> {
    const state = await this.rpc<StoreState>("studentos_state", {});
    const db = emptyDatabase();
    const tables = this.tableNames(db);

    if (state === null) {
      /* Nothing has ever been written. Build the seeded database locally and
         hand it over in one call, which is also the only moment this store
         writes a whole database rather than a change set. */
      if (this.seeder) await this.seeder(db);

      const payload: Record<string, { k: RowKey; v: Row }[]> = {};
      for (const table of tables) {
        const rows = db[table as TableName] as unknown as Row[];
        payload[table] = rows.map((row) => ({
          k: typeof row.id === "string" && row.id.length > 0 ? row.id : randomUUID(),
          v: row,
        }));
      }

      const result = await this.rpc<{ ok: boolean; seeded: boolean }>("studentos_seed", {
        p_data: payload,
        p_schema_version: DATABASE_VERSION,
      });

      if (result.seeded) {
        /* Our payload is what landed, so adopt it without a round trip. */
        for (const table of tables) {
          const { snapshot } = adoptRows(payload[table]);
          this.snapshots.set(table, snapshot);
        }
        await this.refreshRevisions();
        return db;
      }

      /* Another instance seeded first. Theirs is authoritative. */
    }

    /* No argument rather than an explicit null: PostgREST then lets the SQL
       default apply, which is the same "every table" and avoids asking it to
       cast a JSON null into a text[]. */
    const dump = await this.rpc<DumpPayload>("studentos_dump", {});
    this.absorb(db, dump, tables);
    await this.refreshRevisions();

    const from = state?.schemaVersion ?? 0;
    if (from < DATABASE_VERSION && this.migrator) {
      await this.migrator(db, from);
      await this.commit(db, tables);
      await this.rpc<null>("studentos_set_schema_version", { p_version: DATABASE_VERSION });
    }

    return db;
  }

  /* ---------------------------------------------------------------------- */
  /* Freshness                                                              */
  /* ---------------------------------------------------------------------- */

  private async refreshRevisions(): Promise<RevisionMap> {
    const revisions = await this.rpc<RevisionMap>("studentos_revisions", {});
    this.revisions = revisions;
    this.lastFreshnessCheck = Date.now();
    return revisions;
  }

  /**
   * Bring this instance's copy up to date, reloading only the tables another
   * instance has written since the last check.
   *
   * `maxAge` of 0 forces the check; every write does that, because a
   * read-modify-write on a stale table is how two instances silently overwrite
   * each other even with optimistic concurrency doing its job.
   */
  private async ensureFresh(maxAge: number): Promise<void> {
    if (!this.data) return;
    if (Date.now() - this.lastFreshnessCheck < maxAge) return;

    /* Concurrent requests on the same instance share one poll rather than
       each issuing their own. */
    this.freshnessInFlight ??= (async () => {
      try {
        const previous = this.revisions;
        const current = await this.rpc<RevisionMap>("studentos_revisions", {});
        this.lastFreshnessCheck = Date.now();

        const stale = Object.keys(current).filter((tbl) => previous[tbl] !== current[tbl]);
        this.revisions = current;

        if (stale.length > 0 && this.data) {
          const dump = await this.rpc<DumpPayload>("studentos_dump", { p_tables: stale });
          this.absorb(this.data, dump, stale);
        }
      } finally {
        this.freshnessInFlight = null;
      }
    })();

    await this.freshnessInFlight;
  }

  /* ---------------------------------------------------------------------- */
  /* Reading                                                                */
  /* ---------------------------------------------------------------------- */

  async read<T>(select: (db: Database) => T): Promise<T> {
    return select(await this.load());
  }

  async persistence(): Promise<Persistence> {
    return "disk";
  }

  /* ---------------------------------------------------------------------- */
  /* Writing                                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Diff the named tables and send whatever changed.
   *
   * Returns false when another instance got there first, in which case nothing
   * was applied and the caller replays.
   */
  private async commit(db: Database, tables: readonly string[]): Promise<boolean> {
    const changes: RowChange[] = [];

    for (const table of tables) {
      const rows = db[table as TableName] as unknown as Row[];
      const snapshot = this.snapshots.get(table) ?? new Map();
      changes.push(...diffTable(table, rows, snapshot));
    }

    if (changes.length === 0) return true;

    const expect: RevisionMap = {};
    for (const table of tables) expect[table] = this.revisions[table] ?? 0;

    const result = await this.rpc<ApplyResult>("studentos_apply", {
      p_changes: changes,
      p_expect: expect,
    });

    if (!result.ok) return false;

    for (const table of tables) {
      const rows = db[table as TableName] as unknown as Row[];
      this.snapshots.set(table, snapshotTable(rows));
    }
    this.revisions = result.revisions;
    this.lastFreshnessCheck = Date.now();
    return true;
  }

  /**
   * Which tables a mutation touched, discovered by watching what it reads.
   *
   * A mutation cannot change `db.chat` without first reading the property, so a
   * getter is enough to see it coming, and it means the 700 call sites did not
   * have to be rewritten to declare their tables. Reading a table without
   * changing it counts as touching it, which is deliberate: a decision made
   * from a table that has since moved is a decision made on stale data, and the
   * optimistic check should catch it.
   */
  private watch(db: Database): { view: Database; touched: Set<string> } {
    const touched = new Set<string>();
    const view = new Proxy(db, {
      get(target, property, receiver) {
        if (typeof property === "string" && Array.isArray(Reflect.get(target, property))) {
          touched.add(property);
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    return { view, touched };
  }

  async write<T>(mutate: (db: Database) => T | Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      for (let attempt = 1; ; attempt += 1) {
        /* Zero: never write from a copy another instance has already moved on
           from, however recently this one last checked. */
        const db = await this.loadFresh(0);

        const { view, touched } = this.watch(db);
        const result = await mutate(view);
        const tables = [...touched];

        if (tables.length === 0) return result;
        if (await this.commit(db, tables)) return result;

        if (attempt >= MAX_WRITE_ATTEMPTS) {
          throw new Error(
            `[studentos] Gave up writing ${tables.join(", ")} after ${MAX_WRITE_ATTEMPTS} ` +
              `attempts: another instance kept winning the optimistic check. ` +
              `Nothing was written.`,
          );
        }

        /* Reload every table the mutation touched, not only the ones that
           conflicted. The others already carry this attempt's half-applied
           mutation in memory, and replaying on top of that would apply it
           twice. */
        const dump = await this.rpc<DumpPayload>("studentos_dump", { p_tables: tables });
        this.absorb(db, dump, tables);
        await this.refreshRevisions();
      }
    };

    const next = this.writeChain.then(run, run);
    this.writeChain = next.catch(() => undefined);
    return next;
  }

  reset(): void {
    this.data = null;
    this.loading = null;
    this.snapshots.clear();
    this.revisions = {};
    this.lastFreshnessCheck = 0;
  }
}
