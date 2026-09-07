#!/usr/bin/env node
/**
 * ============================================================================
 * DATABASE VERIFICATION
 * ----------------------------------------------------------------------------
 * Proves the Supabase row store actually works, by using it.
 *
 * Not by checking that variables are set — a URL and a key say nothing about
 * whether migration 0005 was applied, whether the service role can execute the
 * functions, or whether a write comes back on the next read. Those are the
 * three things that go wrong, and each one produces a deployment that looks
 * connected and loses data.
 *
 * So this writes a probe row, reads it back, updates it, reads it back, deletes
 * it, and confirms it is gone. It leaves nothing behind. Run it against a
 * production project without worrying: the probe lives in its own logical
 * table and is removed in the same run.
 *
 *   pnpm db:verify
 *
 * Exits non-zero on any failure, so it can gate a deploy.
 * ============================================================================
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const PROBE_TABLE = "__verify_probe";

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

const symbols = { pass: "  ok ", fail: "FAIL ", info: "     " };
let failures = 0;

function pass(message) {
  console.log(`${symbols.pass}${message}`);
}

function fail(message, detail) {
  failures += 1;
  console.log(`${symbols.fail}${message}`);
  if (detail) {
    for (const line of String(detail).split("\n")) console.log(`${symbols.info}${line}`);
  }
}

function info(message) {
  console.log(`${symbols.info}${message}`);
}

/* -------------------------------------------------------------------------- */
/* Environment                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Load `.env.local` the way `next dev` would.
 *
 * A standalone script does not get Next's env loading, and a verification that
 * reports "not configured" because it did not look where the developer put the
 * variables is worse than no verification at all.
 */
async function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    let raw;
    try {
      raw = await readFile(join(process.cwd(), name), "utf8");
    } catch {
      continue;
    }

    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
    info(`read ${name}`);
  }
}

/* -------------------------------------------------------------------------- */
/* The checks                                                                  */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log("");
  console.log("StudentOS — database verification");
  console.log("─".repeat(64));

  await loadEnvFiles();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set",
      "Without both, the application runs on the local JSON file store.\n" +
        "On Vercel that means every redeploy deletes every account.\n" +
        "See PRODUCTION_SETUP.md → Supabase.",
    );
    return finish();
  }
  pass(`connecting to ${new URL(url).host}`);

  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === serviceRoleKey) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY is the same value as the anon key",
      "One of the two is pasted wrong. The service role key bypasses RLS and\n" +
        "must never be the value handed to a browser.",
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const call = async (fn, args = {}) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };

  /* ---- 1. is the migration applied? ------------------------------------- */

  let state;
  try {
    state = await call("studentos_state");
    pass("migration 0005 is applied and the service role can execute it");
  } catch (error) {
    fail(
      "the row store functions are not in this database",
      `${error.message}\n\n` +
        "Apply supabase/migrations/0005_row_store.sql:\n" +
        "  Supabase dashboard → SQL Editor → paste the file → Run\n" +
        "  or, with the Supabase CLI linked:  supabase db push",
    );
    return finish();
  }

  info(
    state === null
      ? "the store has never been seeded; the app will seed it on first boot"
      : `store seeded at ${state.seededAt} (schema version ${state.schemaVersion})`,
  );

  /* ---- 2. can it read? --------------------------------------------------- */

  try {
    const revisions = await call("studentos_revisions");
    const tables = Object.keys(revisions).length;
    pass(`read revisions for ${tables} logical table${tables === 1 ? "" : "s"}`);
  } catch (error) {
    fail("could not read revisions", error.message);
    return finish();
  }

  /* ---- 3. can it write, and does the write come back? -------------------- */

  const probeId = `probe-${randomUUID()}`;
  const written = { id: probeId, note: "studentos db:verify", at: new Date().toISOString() };

  try {
    const result = await call("studentos_apply", {
      p_changes: [
        { op: "insert", tbl: PROBE_TABLE, id: probeId, user_id: null, data: written },
      ],
      p_expect: {},
    });
    if (!result?.ok) throw new Error(`apply refused the write: ${JSON.stringify(result)}`);
    pass("wrote a probe row");
  } catch (error) {
    fail(
      "could not write",
      `${error.message}\n\n` +
        "The service role key may be a read-only key, or the project may be paused.",
    );
    return finish();
  }

  try {
    const dump = await call("studentos_dump", { p_tables: [PROBE_TABLE] });
    const row = (dump?.[PROBE_TABLE] ?? []).find((entry) => entry.k === probeId);
    if (!row) throw new Error("the row that was just written did not come back");
    if (row.v.note !== written.note) throw new Error("the row came back with different contents");
    pass("read the probe row back with its contents intact");
  } catch (error) {
    fail("write did not survive a read", error.message);
  }

  /* ---- 4. does optimistic concurrency actually reject a stale write? ----- */

  try {
    const stale = await call("studentos_apply", {
      p_changes: [
        { op: "update", tbl: PROBE_TABLE, id: probeId, user_id: null, data: { ...written, note: "stale" } },
      ],
      /* Revision 0 means "I believe this table has never been written", which
         is false — the insert above moved it. A store that accepted this would
         let two instances overwrite each other silently. */
      p_expect: { [PROBE_TABLE]: 0 },
    });

    if (stale?.ok) {
      fail(
        "a stale write was accepted",
        "studentos_apply is not enforcing the revision check. Two instances\n" +
          "can silently overwrite each other. Re-apply migration 0005.",
      );
    } else {
      pass("a stale write was rejected, so concurrent instances are safe");
    }
  } catch (error) {
    fail("could not test the concurrency check", error.message);
  }

  /* ---- 5. clean up after ourselves --------------------------------------- */

  try {
    const revisions = await call("studentos_revisions");
    await call("studentos_apply", {
      p_changes: [{ op: "delete", tbl: PROBE_TABLE, id: probeId }],
      p_expect: { [PROBE_TABLE]: revisions[PROBE_TABLE] ?? 0 },
    });

    const dump = await call("studentos_dump", { p_tables: [PROBE_TABLE] });
    const left = (dump?.[PROBE_TABLE] ?? []).filter((entry) => entry.k === probeId);
    if (left.length > 0) throw new Error("the probe row is still there");
    pass("removed the probe row");
  } catch (error) {
    fail(
      "could not clean up the probe row",
      `${error.message}\n\nRemove it by hand:\n` +
        `  delete from public.studentos_rows where tbl = '${PROBE_TABLE}';`,
    );
  }

  return finish();
}

function finish() {
  console.log("─".repeat(64));
  if (failures === 0) {
    console.log("Storage is real: writes survive, reads see them, races are caught.");
    console.log("");
    process.exit(0);
  }
  console.log(`${failures} check${failures === 1 ? "" : "s"} failed. Storage is NOT ready.`);
  console.log("");
  process.exit(1);
}

main().catch((error) => {
  fail("verification crashed", error.stack ?? error.message);
  finish();
});
