import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { env } from "@/services/env";

import type { Move } from "@/domain/lifecycle";
import type { DealReport, Guide, OfficialFact, PriceObservation } from "@/domain/knowledge";
import type {
  Challenge,
  ChallengeEntry,
  Exploration,
  SearchMiss,
  UnmetNeed,
} from "@/domain/insight";
import type {
  Bucket,
  BucketEntry,
  Community,
  CommunityMember,
  Group,
  GroupMember,
  Listing,
  Memory,
} from "@/domain/social";
import type {
  AdminSetting,
  ArrivalProgress,
  AiUsage,
  AuthToken,
  BudgetEnvelope,
  BudgetSetup,
  ChatMessageRow,
  ChatPrefs,
  ChatReaction,
  Collection,
  Comment,
  CommunityPost,
  CityEvent,
  Deal,
  EventResponse,
  Friendship,
  Invite,
  InviteResponse,
  Notification,
  NotificationPrefs,
  PlanMember,
  PlanVote,
  Profile,
  RecurringExpense,
  SavedItem,
  SavedPlan,
  Session,
  Subscription,
  Transaction,
  UpgradeTriggerRow,
  UsefulOutcome,
  User,
  Vote,
} from "@/domain/types";

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
/* Shape                                                                       */
/* -------------------------------------------------------------------------- */

export type Database = {
  /** Bumped when a migration changes the on-disk shape. */
  version: number;
  users: User[];
  sessions: Session[];
  authTokens: AuthToken[];
  profiles: Profile[];
  subscriptions: Subscription[];
  budgetSetups: BudgetSetup[];
  envelopes: BudgetEnvelope[];
  transactions: Transaction[];
  recurring: RecurringExpense[];
  events: CityEvent[];
  deals: Deal[];
  saved: SavedItem[];
  collections: Collection[];
  posts: CommunityPost[];
  comments: Comment[];
  votes: Vote[];
  chat: ChatMessageRow[];
  chatReactions: ChatReaction[];
  chatPrefs: ChatPrefs[];
  eventResponses: EventResponse[];
  invites: Invite[];
  inviteResponses: InviteResponse[];
  friendships: Friendship[];
  plans: SavedPlan[];
  planMembers: PlanMember[];
  planVotes: PlanVote[];
  arrival: ArrivalProgress[];
  notifications: Notification[];
  notificationPrefs: NotificationPrefs[];
  aiUsage: AiUsage[];
  outcomes: UsefulOutcome[];
  upgradeTriggers: UpgradeTriggerRow[];
  adminSettings: AdminSetting[];
  /** Stripe event ids already processed. The idempotency guard for webhooks. */
  processedStripeEvents: { id: string; at: string }[];

  /* --- lifecycle --------------------------------------------------------- */
  moves: Move[];

  /* --- knowledge --------------------------------------------------------- */
  officialFacts: OfficialFact[];
  guides: Guide[];
  dealReports: DealReport[];
  priceObservations: PriceObservation[];

  /* --- social ------------------------------------------------------------ */
  communities: Community[];
  communityMembers: CommunityMember[];
  groups: Group[];
  groupMembers: GroupMember[];
  buckets: Bucket[];
  bucketEntries: BucketEntry[];
  listings: Listing[];
  memories: Memory[];

  /* --- insight ----------------------------------------------------------- */
  searchMisses: SearchMiss[];
  unmetNeeds: UnmetNeed[];
  challenges: Challenge[];
  challengeEntries: ChallengeEntry[];
  explorations: Exploration[];
};

export const DATABASE_VERSION = 1;

function emptyDatabase(): Database {
  return {
    version: DATABASE_VERSION,
    users: [],
    sessions: [],
    authTokens: [],
    profiles: [],
    subscriptions: [],
    budgetSetups: [],
    envelopes: [],
    transactions: [],
    recurring: [],
    events: [],
    deals: [],
    saved: [],
    collections: [],
    posts: [],
    comments: [],
    votes: [],
    chat: [],
    chatReactions: [],
    chatPrefs: [],
    eventResponses: [],
    invites: [],
    inviteResponses: [],
    friendships: [],
    plans: [],
    planMembers: [],
    planVotes: [],
    arrival: [],
    notifications: [],
    notificationPrefs: [],
    aiUsage: [],
    outcomes: [],
    upgradeTriggers: [],
    adminSettings: [],
    processedStripeEvents: [],
    moves: [],
    officialFacts: [],
    guides: [],
    dealReports: [],
    priceObservations: [],
    communities: [],
    communityMembers: [],
    groups: [],
    groupMembers: [],
    buckets: [],
    bucketEntries: [],
    listings: [],
    memories: [],
    searchMisses: [],
    unmetNeeds: [],
    challenges: [],
    challengeEntries: [],
    explorations: [],
  };
}

export type TableName = {
  [K in keyof Database]: Database[K] extends unknown[] ? K : never;
}[keyof Database];

/* -------------------------------------------------------------------------- */
/* File location                                                               */
/* -------------------------------------------------------------------------- */

export type Persistence = "disk" | "ephemeral";

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

class JsonStore {
  private data: Database | null = null;
  private loading: Promise<Database> | null = null;
  /** Serialises writes. Every mutation appends to this chain. */
  private writeChain: Promise<unknown> = Promise.resolve();

  private dir: string | null = null;
  private mode: Persistence = env.hosting.ephemeralFilesystem ? "ephemeral" : "disk";

  /** Registered once by `seed.ts`, called the first time the file is absent. */
  private seeder: ((db: Database) => void | Promise<void>) | null = null;

  registerSeeder(seeder: (db: Database) => void | Promise<void>): void {
    this.seeder = seeder;
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

  private async readOrSeed(): Promise<Database> {
    const file = await this.file();
    try {
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw) as Database;
      /* Forward-compatible: a file written by an older shape gets the missing
         tables filled in rather than being rejected. */
      return { ...emptyDatabase(), ...parsed, version: DATABASE_VERSION };
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
    await writeFile(temp, payload, "utf8");

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
    rows[index] = { ...rows[index], ...patch };
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
    rows[index] = { ...rows[index], ...row };
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
    (db[table] as Database[K][number][]).length = 0;
    (db[table] as Database[K][number][]).push(...kept);
    return removed;
  });
}

/** Multiple mutations under one persist. Use for anything that must be atomic. */
export async function transaction<T>(mutate: (db: Database) => T | Promise<T>): Promise<T> {
  return store.write(mutate);
}
