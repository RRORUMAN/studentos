import "server-only";

import { isRowStoreConfigured, isSampleContent } from "@/services/env";
import { migrateDatabase, rollSeededEventsForward, seedDatabase } from "@/server/db/seed";
import { store, storeKind, transaction } from "@/server/db/access";

/**
 * ============================================================================
 * DATA ACCESS — entry point
 * ----------------------------------------------------------------------------
 * Registers the seeder and exposes the cross-cutting concerns that do not
 * belong to any single repository.
 *
 * ---------------------------------------------------------------------------
 * WHAT ACTUALLY RUNS, stated plainly
 *
 * Two stores exist and `access.ts` chooses between them from the environment:
 *
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *       → the Postgres row store (`supabase-store.ts`). One row per record,
 *         per-row writes, optimistic concurrency, survives a redeploy and
 *         several instances.
 *
 *   neither
 *       → the JSON file (`store.ts`). Durable for one Node process, which is
 *         what `next dev` and `next start` are, and wiped on every redeploy of
 *         a serverless host, which is why `isEphemeralStore` puts a standing
 *         notice on the page when that is what is running.
 *
 * `supabase/migrations/0005_row_store.sql` is the schema the row store speaks.
 * Migrations 0001–0004 describe the relational schema the product is heading
 * for, table by table; nothing reads them yet, and `docs/data-layer.md` says so
 * and explains the route from here to there.
 *
 * This note exists because an earlier version of it claimed Supabase "takes
 * over" when configured, at a time when it did not. A comment that overstates
 * what is wired up is the same defect as a UI that does — so if the store ever
 * changes again, this paragraph changes with it.
 * ============================================================================
 */

store.registerSeeder(seedDatabase);
store.registerMigrator(migrateDatabase);

/**
 * True when the product is answering from seeded sample content.
 *
 * The UI reads this and renders a standing notice. That notice is not
 * decoration: showing invented events and deals as if they were live listings
 * is the most damaging thing this product could do to its own credibility, and
 * a demo that quietly looks like production is how it happens.
 *
 * It is *not* derived from whether a database is connected, because those are
 * different claims. Connecting Postgres moves where rows live; it does not make
 * an invented event real. Dropping the notice needs two separate things to be
 * true — somebody reviewed the cities and set `STUDENTOS_CONTENT_MODE=real`,
 * and the rows are somewhere a redeploy does not delete.
 */
export const isSeededData = isSampleContent;

/** Which store is serving this process. Reported in `/admin`. */
export const activeStore = storeKind;

/** Kept referenced so the env contract stays visible from here. */
export const backendConfigured = isRowStoreConfigured;

/* -------------------------------------------------------------------------- */
/* Freshness                                                                   */
/* -------------------------------------------------------------------------- */

let lastRoll = 0;
const ROLL_INTERVAL_MS = 60 * 60_000;

/**
 * Keep seeded events in the future.
 *
 * Called from the surfaces that read events. Throttled to once an hour per
 * process, because the check is a full table pass and the answer cannot change
 * meaningfully faster than that.
 */
export async function ensureFreshSeedData(): Promise<void> {
  const now = Date.now();
  if (now - lastRoll < ROLL_INTERVAL_MS) return;
  lastRoll = now;

  await transaction((db) => rollSeededEventsForward(db));
}

/* -------------------------------------------------------------------------- */
/* Re-exports                                                                  */
/* -------------------------------------------------------------------------- */

export {
  all,
  findMany,
  findOne,
  insert,
  insertMany,
  newId,
  nowIso,
  remove,
  storePersistence,
  storePing,
  transaction,
  update,
  upsert,
} from "@/server/db/access";
export type { Database, Persistence, StorePing, TableName } from "@/server/db/schema";
