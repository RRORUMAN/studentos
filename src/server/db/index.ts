import "server-only";

import { isBackendConfigured } from "@/services/env";
import { rollSeededEventsForward, seedDatabase } from "@/server/db/seed";
import { store, transaction } from "@/server/db/store";

/**
 * ============================================================================
 * DATA ACCESS — entry point
 * ----------------------------------------------------------------------------
 * Registers the seeder and exposes the cross-cutting concerns that do not
 * belong to any single repository.
 *
 * ---------------------------------------------------------------------------
 * WHAT ACTUALLY RUNS TODAY, stated plainly
 *
 * Every read and write in this application goes through the JSON store in
 * `store.ts`. It is durable, serialised and correct for a single Node process,
 * which is what `next dev` and `next start` are.
 *
 * `supabase/migrations/0001_init.sql` is the production schema — same shapes,
 * same units, plus the constraints and RLS policies the JSON store cannot
 * express. **The Supabase-backed repository that would read and write it is not
 * implemented yet.** Setting `NEXT_PUBLIC_SUPABASE_URL` today changes exactly
 * one thing: it hides the "sample city data" notice. It does not move storage.
 *
 * Writing that adapter is the remaining step to production, and it is a
 * mechanical one: the call sites all go through `findOne` / `findMany` /
 * `insert` / `update` / `remove` / `transaction`, so it is those six functions
 * that need a Supabase implementation, not the forty files that use them.
 *
 * This note exists because the previous version of this comment claimed
 * Supabase "takes over" when configured, which was not true. A comment that
 * overstates what is wired up is the same defect as a UI that does.
 * ============================================================================
 */

store.registerSeeder(seedDatabase);

/**
 * True when the product is answering from seeded sample content.
 *
 * The UI reads this and renders a standing notice. That notice is not
 * decoration: showing invented events and deals as if they were live listings
 * is the most damaging thing this product could do to its own credibility, and
 * a demo that quietly looks like production is how it happens.
 *
 * It is hard-coded true, not derived from `isBackendConfigured`, and stays that
 * way until the Supabase repository above actually exists. Letting an env var
 * silence a truthful warning about invented content, while the content is still
 * invented, would be precisely the dishonesty the notice guards against.
 */
export const isSeededData = true;

/** Kept referenced so the env contract stays visible from here. */
export const backendConfigured = isBackendConfigured;

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
  transaction,
  update,
  upsert,
} from "@/server/db/store";
export type { Database, TableName } from "@/server/db/store";
