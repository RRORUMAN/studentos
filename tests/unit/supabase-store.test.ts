import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { SupabaseStore, type StoreTransport } from "../../src/server/db/supabase-store.ts";
import type { Database } from "../../src/server/db/schema.ts";

/**
 * ============================================================================
 * THE SUPABASE STORE — COORDINATION
 * ----------------------------------------------------------------------------
 * What happens when two instances write at the same moment.
 *
 * This is the part of the data layer that cannot be checked by looking at it.
 * A store can pass every single-process test and still lose a write the first
 * time Vercel runs two lambdas, because the losing writer overwrote the
 * winner's row with a copy it had loaded a moment earlier. That failure is
 * silent, it only happens under load, and by the time anyone notices, the data
 * is gone.
 *
 * So these tests run two `SupabaseStore` instances against one shared fake
 * Postgres and make them race.
 *
 * WHAT THIS DOES AND DOES NOT PROVE. The fake below reimplements the semantics
 * of `studentos_apply` in JavaScript: revision checks, all-or-nothing
 * application, per-table revision bumps. So these tests prove the **store**
 * behaves correctly given those semantics. They do not prove the **migration**
 * implements them — a reimplementation can only ever agree with itself.
 * `pnpm db:verify` is what checks the real function, by attempting a
 * deliberately stale write against a real project and requiring a refusal.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* A fake Postgres                                                             */
/* -------------------------------------------------------------------------- */

type StoredRow = { k: string; v: Record<string, unknown> };

class FakePostgres {
  rows = new Map<string, Map<string, Record<string, unknown>>>();
  revisions = new Map<string, number>();
  state: { schemaVersion: number; seededAt: string } | null = null;

  /** Every RPC name that reached the database, in order. For write-shape tests. */
  calls: { fn: string; args: Record<string, unknown> }[] = [];
  /** Every change set applied, so a test can assert a write was per row. */
  applied: Record<string, unknown>[][] = [];

  /**
   * Fires once, immediately before an apply is checked.
   *
   * This is the only way to produce a genuine lost race in a test. A store that
   * polls revisions before every write will normally see the other instance's
   * change and reload — which is correct, and means the retry path never runs.
   * The race that actually happens in production is narrower: the revision
   * moves in the gap between the poll and the apply. This hook is that gap.
   */
  beforeApply: (() => void) | null = null;

  /** Another instance's write, landing directly. */
  writeBehindTheirBack(table: string, id: string, data: Record<string, unknown>): void {
    const stored = this.rows.get(table) ?? new Map();
    this.rows.set(table, stored);
    stored.set(id, data);
    this.revisions.set(table, (this.revisions.get(table) ?? 0) + 1);
  }

  transport: StoreTransport = async (fn, args) => {
    this.calls.push({ fn, args });

    switch (fn) {
      case "studentos_state":
        return this.state;

      case "studentos_revisions":
        return Object.fromEntries(this.revisions);

      case "studentos_dump": {
        const wanted = (args.p_tables as string[] | undefined) ?? [...this.rows.keys()];
        const dump: Record<string, StoredRow[]> = {};
        for (const table of wanted) {
          const stored = this.rows.get(table);
          if (!stored || stored.size === 0) continue;
          /* Deep copied on the way out, exactly as JSON over the wire would be.
             Handing back the same objects would let a store mutate the
             "database" in place and hide every bug these tests look for. */
          dump[table] = [...stored].map(([k, v]) => ({ k, v: structuredClone(v) }));
        }
        return dump;
      }

      case "studentos_seed": {
        if (this.state) return { ok: true, seeded: false };
        const payload = args.p_data as Record<string, StoredRow[]>;
        for (const [table, entries] of Object.entries(payload)) {
          if (entries.length === 0) continue;
          const stored = new Map<string, Record<string, unknown>>();
          for (const { k, v } of entries) stored.set(k, structuredClone(v));
          this.rows.set(table, stored);
          this.revisions.set(table, 1);
        }
        this.state = {
          schemaVersion: args.p_schema_version as number,
          seededAt: new Date().toISOString(),
        };
        return { ok: true, seeded: true };
      }

      case "studentos_apply": {
        if (this.beforeApply) {
          const hook = this.beforeApply;
          this.beforeApply = null;
          hook();
        }

        const changes = args.p_changes as Record<string, unknown>[];
        const expect = args.p_expect as Record<string, number>;

        /* The check, before anything is applied. */
        const conflict = Object.entries(expect).filter(
          ([table, revision]) => (this.revisions.get(table) ?? 0) !== revision,
        );
        if (conflict.length > 0) {
          return { ok: false, conflict: conflict.map(([table]) => table) };
        }

        this.applied.push(changes);
        const touched = new Set<string>();

        for (const change of changes) {
          const table = change.tbl as string;
          const id = change.id as string;
          touched.add(table);

          const stored = this.rows.get(table) ?? new Map();
          this.rows.set(table, stored);

          if (change.op === "delete") stored.delete(id);
          else stored.set(id, structuredClone(change.data as Record<string, unknown>));
        }

        for (const table of touched) {
          this.revisions.set(table, (this.revisions.get(table) ?? 0) + 1);
        }
        return { ok: true, revisions: Object.fromEntries(this.revisions) };
      }

      case "studentos_set_schema_version":
        if (this.state) this.state.schemaVersion = args.p_version as number;
        return null;

      default:
        throw new Error(`unexpected rpc ${fn}`);
    }
  };
}

/** A store wired to a shared database, seeded with two posts. */
function storeOn(db: FakePostgres): SupabaseStore {
  const store = new SupabaseStore(db.transport);
  store.registerSeeder((database: Database) => {
    database.posts.push(
      { id: "p1", body: "first", hiddenAt: null } as Database["posts"][number],
      { id: "p2", body: "second", hiddenAt: null } as Database["posts"][number],
    );
  });
  return store;
}

/**
 * Freshness is time-based, and a test that waited a real second per assertion
 * would be a test nobody runs. Everything here writes, and a write always
 * forces the revision check regardless of the clock — so the races below are
 * exercised without touching timers.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1100));
}

/* -------------------------------------------------------------------------- */

describe("first boot", () => {
  let db: FakePostgres;

  beforeEach(() => {
    db = new FakePostgres();
  });

  it("seeds an empty database and reads its own seed back", async () => {
    const store = storeOn(db);
    const posts = await store.read((database) => database.posts);

    assert.equal(posts.length, 2);
    assert.equal(db.state?.schemaVersion, 2);
    assert.equal(db.rows.get("posts")?.size, 2);
  });

  it("does not seed twice when another instance got there first", async () => {
    await storeOn(db).load();
    const seedCalls = db.calls.filter((call) => call.fn === "studentos_seed").length;

    const second = storeOn(db);
    const posts = await second.read((database) => database.posts);

    assert.equal(posts.length, 2, "the second instance reads the first instance's seed");
    assert.equal(
      db.calls.filter((call) => call.fn === "studentos_seed").length,
      seedCalls,
      "and does not call the seeder again",
    );
  });
});

describe("what a write sends", () => {
  let db: FakePostgres;

  beforeEach(async () => {
    db = new FakePostgres();
    await storeOn(db).load();
  });

  it("sends one row, not the table", async () => {
    const store = storeOn(db);
    await store.load();
    db.applied.length = 0;

    await store.write((database) => {
      const post = database.posts.find((row) => row.id === "p1");
      if (post) post.hiddenAt = "2026-09-07T10:00:00.000Z";
    });

    assert.equal(db.applied.length, 1);
    assert.equal(db.applied[0].length, 1, "a table of two rows produced one change");
    assert.equal(db.applied[0][0].op, "update");
    assert.equal(db.applied[0][0].id, "p1");
  });

  it("declares only the tables the mutation actually touched", async () => {
    const store = storeOn(db);
    await store.load();
    db.calls.length = 0;

    await store.write((database) => {
      database.posts.push({ id: "p3", body: "third", hiddenAt: null } as Database["posts"][number]);
    });

    const apply = db.calls.find((call) => call.fn === "studentos_apply");
    assert.deepEqual(Object.keys(apply?.args.p_expect as object), ["posts"]);
  });

  it("sends nothing when the mutation changed nothing", async () => {
    const store = storeOn(db);
    await store.load();
    db.applied.length = 0;

    await store.write((database) => database.posts.find((row) => row.id === "p1"));

    assert.equal(db.applied.length, 0);
  });
});

describe("two instances", () => {
  let db: FakePostgres;
  let a: SupabaseStore;
  let b: SupabaseStore;

  beforeEach(async () => {
    db = new FakePostgres();
    a = storeOn(db);
    b = storeOn(db);
    await a.load();
    await b.load();
  });

  it("keeps both writes when they land on the same table", async () => {
    /* The whole point. A and B have each loaded `posts`. A writes. B then
       writes from a copy that predates A's write. If B's change set were
       applied as-is, A's post would vanish — the row would simply not be in the
       array B sends back. The revision check is what stops that. */
    await a.write((database) => {
      database.posts.push({ id: "a1", body: "from A", hiddenAt: null } as Database["posts"][number]);
    });

    await b.write((database) => {
      database.posts.push({ id: "b1", body: "from B", hiddenAt: null } as Database["posts"][number]);
    });

    const ids = [...(db.rows.get("posts")?.keys() ?? [])].sort();
    assert.deepEqual(ids, ["a1", "b1", "p1", "p2"]);
  });

  it("replays the losing mutation rather than dropping it", async () => {
    await a.write((database) => {
      const post = database.posts.find((row) => row.id === "p1");
      if (post) post.body = "edited by A";
    });

    await b.write((database) => {
      const post = database.posts.find((row) => row.id === "p2");
      if (post) post.body = "edited by B";
    });

    assert.equal(db.rows.get("posts")?.get("p1")?.body, "edited by A");
    assert.equal(db.rows.get("posts")?.get("p2")?.body, "edited by B");
  });

  it("applies a losing mutation exactly once, not twice", async () => {
    /* The subtle half of a retry. B's first attempt already mutated B's
       in-memory copy. If the replay ran on top of that copy instead of a
       reloaded one, the append would happen twice and the student would see
       their message duplicated. */
    await a.write((database) => {
      database.chat.push({ id: "a1", channel: "c", body: "A" } as Database["chat"][number]);
    });

    await b.write((database) => {
      database.chat.push({ id: "b1", channel: "c", body: "B" } as Database["chat"][number]);
    });

    assert.equal(db.rows.get("chat")?.size, 2);
    assert.equal(
      (await b.read((database) => database.chat)).filter((row) => row.id === "b1").length,
      1,
    );
  });

  it("retries and keeps both writes when it loses the race outright", async () => {
    /* The real one. B polls, sees nothing new, builds its change set — and only
       then does A's write land. B's apply is refused, and B has to reload and
       replay. Without the retry, B's post exists in B's memory and nowhere
       else, and nothing anywhere reports a failure. */
    db.beforeApply = () => db.writeBehindTheirBack("posts", "a1", { id: "a1", body: "from A" });

    await b.write((database) => {
      database.posts.push({ id: "b1", body: "from B", hiddenAt: null } as Database["posts"][number]);
    });

    const applies = db.calls.filter((call) => call.fn === "studentos_apply");
    assert.equal(applies.length, 2, "the first attempt was refused and a second was made");

    const ids = [...(db.rows.get("posts")?.keys() ?? [])].sort();
    assert.deepEqual(ids, ["a1", "b1", "p1", "p2"], "neither write was lost");
  });

  it("does not duplicate the replayed rows when it loses a race", async () => {
    db.beforeApply = () => db.writeBehindTheirBack("chat", "a1", { id: "a1", channel: "c", body: "A" });

    await b.write((database) => {
      database.chat.push({ id: "b1", channel: "c", body: "B" } as Database["chat"][number]);
    });

    assert.equal(db.rows.get("chat")?.size, 2);
    const mine = (await b.read((database) => database.chat)).filter((row) => row.id === "b1");
    assert.equal(mine.length, 1, "the replay did not append a second copy");
  });

  it("gives up loudly rather than silently when it can never win", async () => {
    /* A write that is refused forever must throw. Returning as if it had worked
       is the one outcome that leaves a student believing their message was
       sent. The hook reinstalls itself, so every attempt loses. */
    let attempts = 0;
    const keepLosing = () => {
      attempts += 1;
      db.writeBehindTheirBack("posts", `noise-${attempts}`, { id: `noise-${attempts}` });
      db.beforeApply = keepLosing;
    };
    db.beforeApply = keepLosing;

    await assert.rejects(
      b.write((database) => {
        database.posts.push({ id: "never", body: "x", hiddenAt: null } as Database["posts"][number]);
      }),
      /Gave up writing/,
    );

    assert.ok(attempts >= 6, `every attempt lost (${attempts})`);
    assert.equal(db.rows.get("posts")?.has("never"), false, "and nothing was written");
  });

  it("sees the other instance's write after the freshness window", async () => {
    await a.write((database) => {
      database.posts.push({ id: "a1", body: "from A", hiddenAt: null } as Database["posts"][number]);
    });

    await settle();
    const seen = await b.read((database) => database.posts.map((row) => row.id));

    assert.ok(seen.includes("a1"), "B reloaded the table A moved");
  });

  it("reloads only the tables that moved", async () => {
    await a.write((database) => {
      database.posts.push({ id: "a1", body: "from A", hiddenAt: null } as Database["posts"][number]);
    });

    await settle();
    db.calls.length = 0;
    await b.read((database) => database.posts);

    const dumps = db.calls.filter((call) => call.fn === "studentos_dump");
    assert.equal(dumps.length, 1);
    assert.deepEqual(dumps[0].args.p_tables, ["posts"]);
  });

  it("does not reload anything when nothing moved", async () => {
    await settle();
    db.calls.length = 0;
    await b.read((database) => database.posts);

    assert.equal(db.calls.filter((call) => call.fn === "studentos_dump").length, 0);
  });
});

describe("deletes", () => {
  it("removes exactly the row that went, in a table with no domain ids", async () => {
    const db = new FakePostgres();
    const store = new SupabaseStore(db.transport);
    store.registerSeeder((database: Database) => {
      database.chatReactions.push(
        { messageId: "m1", userId: "u1", emoji: "a", createdAt: "x" } as Database["chatReactions"][number],
        { messageId: "m1", userId: "u2", emoji: "b", createdAt: "x" } as Database["chatReactions"][number],
      );
    });
    await store.load();

    await store.write((database) => {
      const index = database.chatReactions.findIndex((row) => row.userId === "u2");
      database.chatReactions.splice(index, 1);
    });

    const remaining = [...(db.rows.get("chatReactions")?.values() ?? [])];
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].userId, "u1");
  });
});
