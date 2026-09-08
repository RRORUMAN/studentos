import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { env } from "@/services/env";

import {
  DATABASE_VERSION,
  emptyDatabase,
  type Database,
  type Persistence,
  type StorePing,
  type StudentOsStore,
  type TableName,
} from "@/server/db/schema";

export {
  DATABASE_VERSION,
  emptyDatabase,
  type Database,
  type Persistence,
  type StudentOsStore,
  type TableName,
};

/**
 * ============================================================================
 * PERSISTENCE
 * ----------------------------------------------------------------------------
 * A durable, transactional-enough JSON store, used when no Supabase project is
 * configured.
 *
 * Why this exists rather than an in-memory mock: every button in this product
 * writes something. A mock that forgets on reload cannot answer "does the
 * budget actually update?", and a product where the demo data resets is a
 * product nobody can evaluate. This store writes to disk, survives restarts,
 * and is the reason the end-to-end flows in `tests/e2e` are real.
 *
 * What it is NOT: a database. There are no indexes, the whole file is held in
 * memory, and concurrent writers on separate processes would clobber each
 * other. It is correct for one Node process, which is what `next dev` and
 * `next start` are, and it is explicitly the *fallback*: when
 * `NEXT_PUBLIC_SUPABASE_URL` is set, `src/server/db/index.ts` resolves the
 * Supabase-backed repository instead and this file is never loaded.
 *
 * Durability: writes go to a temp file and are renamed over the target, so a
 * crash mid-write leaves the previous good file rather than a truncated one.
 * Writes are serialised through a promise chain, so two concurrent server
 * actions cannot interleave a read-modify-write.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* File location                                                               */
/* -------------------------------------------------------------------------- */


/**
 * Where the file lives, in order of preference:
 *
 * 1. `STUDENTOS_DATA_DIR`, which the e2e suite uses to point at a throwaway
 *    directory so a test run never touches the development data.
 * 2. On a serverless host (Vercel, Lambda, Netlify) the deployment is mounted
 *    read-only and the only writable path is the OS temp directory. It is
 *    per-instance and wiped on restart, so the store is *ephemeral* there and
 *    `isEphemeralStore` puts a standing notice on every page. That is the
 *    honest state of a deployment without a database, not a bug to hide.
 * 3. `.data/` under the working directory: the durable development default.
 */
function preferredDir(): string {
  if (env.dataDir) return env.dataDir;
  if (env.hosting.ephemeralFilesystem) return join(tmpdir(), "studentos");
  return join(process.cwd(), ".data");
}

function fallbackDir(): string {
  return join(tmpdir(), "studentos");
}

function isReadOnlyError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EROFS" || code === "EACCES" || code === "EPERM";
}

/**
 * Prove a directory is writable with a real file rather than trusting
 * `access()`, which reports success on some read-only mounts.
 */
async function proveWritable(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const probe = join(dir, `.probe-${randomUUID()}`);
  await writeFile(probe, "", "utf8");
  await rm(probe, { force: true });
}

/* -------------------------------------------------------------------------- */
/* The store                                                                   */
/* -------------------------------------------------------------------------- */

class JsonStore implements StudentOsStore {
  private data: Database | null = null;
  private loading: Promise<Database> | null = null;
  /** Serialises writes. Every mutation appends to this chain. */
  private writeChain: Promise<unknown> = Promise.resolve();

  private dir: string | null = null;
  private mode: Persistence = env.hosting.ephemeralFilesystem ? "ephemeral" : "disk";

  /** Registered once by `seed.ts`, called the first time the file is absent. */
  private seeder: ((db: Database) => void | Promise<void>) | null = null;
  private migrator: ((db: Database, from: number) => void | Promise<void>) | null = null;

  registerSeeder(seeder: (db: Database) => void | Promise<void>): void {
    this.seeder = seeder;
  }

  /**
   * Run once when an existing file is older than `DATABASE_VERSION`.
   *
   * Adding a table is already forward-compatible — the spread in `readOrSeed`
   * fills a missing one with an empty array. What that cannot do is *populate*
   * it, so a store written before Work existed came back with an empty job
   * board and no way to tell that from a city where nobody has posted. This is
   * the hook that fills a newly added table with its seed rows.
   */
  registerMigrator(migrator: (db: Database, from: number) => void | Promise<void>): void {
    this.migrator = migrator;
  }

  async load(): Promise<Database> {
    if (this.data) return this.data;
    /* Concurrent first-hits must share one load, or two requests each parse the
       file and the second overwrites the first's in-memory copy. */
    this.loading ??= this.readOrSeed();
    this.data = await this.loading;
    return this.data;
  }

  /**
   * Resolve the directory once. A directory that cannot be written falls back
   * to the temp directory and flips the store to ephemeral, with a warning in
   * the server log so the condition is never silent.
   */
  private async resolveDir(): Promise<string> {
    if (this.dir) return this.dir;
    const preferred = preferredDir();
    try {
      await proveWritable(preferred);
      this.dir = preferred;
    } catch (error) {
      if (!isReadOnlyError(error)) throw error;
      const fallback = fallbackDir();
      await proveWritable(fallback);
      console.warn(
        `[studentos] ${preferred} is not writable (${(error as NodeJS.ErrnoException).code}); ` +
          `using ${fallback}. Data on this instance is ephemeral.`,
      );
      this.dir = fallback;
      this.mode = "ephemeral";
    }
    return this.dir;
  }

  private async file(): Promise<string> {
    return join(await this.resolveDir(), "studentos.json");
  }

  /** Whether writes outlive this process. */
  async persistence(): Promise<Persistence> {
    await this.resolveDir();
    return this.mode;
  }

  /**
   * Reachability for the file store is "can this process still write here".
   *
   * The probe writes and deletes a real file, because the interesting failure
   * is a directory that vanished or turned read-only under a running process,
   * and `access()` reports success on some read-only mounts. It is one small
   * write, which is cheap enough for a health check.
   */
  async ping(): Promise<StorePing> {
    const started = Date.now();
    try {
      await proveWritable(await this.resolveDir());
      return { ok: true, kind: "file", ms: Date.now() - started };
    } catch (error) {
      return {
        ok: false,
        kind: "file",
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async readOrSeed(): Promise<Database> {
    const file = await this.file();
    try {
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw) as Database;
      /* Forward-compatible: a file written by an older shape gets the missing
         tables filled in rather than being rejected. */
      const merged = { ...emptyDatabase(), ...parsed, version: DATABASE_VERSION };

      const from = typeof parsed.version === "number" ? parsed.version : 0;
      if (from < DATABASE_VERSION && this.migrator) {
        await this.migrator(merged, from);
        await this.persist(merged);
      }

      return merged;
    } catch {
      const fresh = emptyDatabase();
      if (this.seeder) await this.seeder(fresh);
      await this.persist(fresh);
      return fresh;
    }
  }

  private async persist(db: Database): Promise<void> {
    const file = await this.file();

    /* Write-then-rename. `rename` is atomic within a filesystem, so a reader
       never observes a half-written file and a crash cannot corrupt the good
       one. The temp name carries a uuid so two writers cannot collide. */
    const temp = `${file}.${randomUUID()}.tmp`;
    const payload = JSON.stringify(db, null, 2);

    try {
      await writeFile(temp, payload, "utf8");
    } catch (error) {
      /* The directory was proved writable once, at startup. It can still go
         away underneath a long-running process: an ephemeral volume, a cleanup
         job, a mount that blips. Without this, the first such write throws
         ENOENT and *every* write after it throws too, so the product silently
         stops saving anything until someone restarts it.

         Recreate the directory and try once more. If that fails as well, the
         error propagates — a write that genuinely cannot happen must not be
         reported as success. */
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(await this.resolveDir(), { recursive: true });
      await writeFile(temp, payload, "utf8");
    }

    /* Windows refuses `rename` over a file that another process still has open
       — antivirus and file indexers both do this routinely, and it surfaces as
       EPERM/EBUSY under concurrent load. On POSIX the rename simply succeeds,
       so this loop costs nothing there.
       Retrying a few times clears the transient case; if the handle is held
       longer than that, overwriting in place is the correct trade. It gives up
       atomicity for that one write, which is a far better outcome than losing
       the write entirely and crashing the request. */
    for (let attempt = 0; ; attempt += 1) {
      try {
        await rename(temp, file);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        const transient = code === "EPERM" || code === "EBUSY" || code === "EACCES";

        if (!transient || attempt >= 4) {
          if (!transient) throw error;

          await writeFile(file, payload, "utf8");
          await rm(temp, { force: true });
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)));
      }
    }
  }

  /**
   * The only mutation entry point. Runs `mutate` against the loaded database
   * and persists the result, with every call serialised behind the previous
   * one so a read-modify-write is never interleaved.
   */
  async write<T>(mutate: (db: Database) => T | Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const db = await this.load();
      const result = await mutate(db);
      await this.persist(db);
      return result;
    };
    const next = this.writeChain.then(run, run);
    /* Keep the chain alive after a rejection, but do not swallow the error for
       the caller — `next` still rejects, `writeChain` does not. */
    this.writeChain = next.catch(() => undefined);
    return next;
  }

  /** Read-only access. Callers must not mutate what they receive. */
  async read<T>(select: (db: Database) => T): Promise<T> {
    return select(await this.load());
  }

  /** Test hook: drop the in-memory copy so the next read re-reads the file. */
  reset(): void {
    this.data = null;
    this.loading = null;
    this.dir = null;
    this.mode = env.hosting.ephemeralFilesystem ? "ephemeral" : "disk";
  }
}

/**
 * Next.js re-evaluates modules on hot reload. Without this the store would be
 * re-created on every edit and the write chain would fork, so the singleton is
 * pinned to the global object.
 */
const globalForStore = globalThis as unknown as { __studentosStore?: JsonStore };

export const store: JsonStore = (globalForStore.__studentosStore ??= new JsonStore());

