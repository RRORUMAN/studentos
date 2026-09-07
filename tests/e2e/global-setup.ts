import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Delete the end-to-end store before the server starts, so every run really
 * does begin from a freshly seeded database.
 *
 * The config has always said it did. It did not: `STUDENTOS_DATA_DIR` only
 * moved the file somewhere harmless, and the store seeds *when the file is
 * absent*, so a second run inherited whatever the first run wrote. That is
 * benign for tests that only create rows, and quietly corrosive for any test
 * that reads a seeded fixture — a test that confirms a seeded claim makes that
 * claim fresh, and the next run's test that needed a stale one skips itself
 * and reports green. A suite that silently stops testing something is worse
 * than one that fails.
 *
 * One caveat, deliberately not worked around: with `reuseExistingServer` a
 * server left running from a previous session already holds the old database
 * in memory, and deleting the file underneath it changes nothing until it
 * restarts. Stop the server if a run behaves as though the store is stale.
 */
export default async function globalSetup(): Promise<void> {
  await rm(join(process.cwd(), ".data", "e2e"), { recursive: true, force: true });
}
