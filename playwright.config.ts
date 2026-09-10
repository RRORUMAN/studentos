import { defineConfig, devices } from "@playwright/test";

/**
 * ============================================================================
 * END-TO-END
 * ----------------------------------------------------------------------------
 * The flows a student actually walks, run against a real server and a real
 * database.
 *
 * `STUDENTOS_DATA_DIR` points the JSON store at a throwaway directory, so a
 * test run never touches development data. That is the whole reason the store
 * reads its location from the environment. `globalSetup` then deletes that
 * directory, which is what actually makes every run start from a freshly
 * seeded database — see the note in `tests/e2e/global-setup.ts` for why
 * pointing it elsewhere was not enough on its own.
 *
 * Mobile-first is not a slogan here: the default project is an iPhone viewport,
 * because that is where this product is used and where the bottom navigation,
 * the sticky Continue button and the horizontal rails can actually break.
 * ============================================================================
 */

const PORT = 3311;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * A local Overpass, so the suite does not depend on a volunteer service.
 *
 * The first run against the real API made several hundred requests to
 * overpass-api.de — every page that shows a place, on two browser profiles —
 * and timed out on most of them. `tests/e2e/overpass-server.mjs` answers the
 * same protocol with real objects copied from that API, so the product runs
 * exactly the code it runs in production and only the host changes. A break in
 * the query builder, the content-type check or the element parser still fails
 * the suite.
 */
const OVERPASS_PORT = 3312;
const OSRM_PORT = 3313;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false, // one JSON store, one writer
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  /**
   * Both projects are Chromium. The mobile one is a Pixel profile rather than
   * an iPhone because the iPhone descriptors run on WebKit, which means a CI
   * box has to download a second browser engine to run what is really a
   * viewport-and-touch test. The things this suite checks on mobile — the
   * bottom bar clearing the safe area, the sticky Continue button, the
   * horizontal rails — are layout and touch behaviour, not engine behaviour.
   *
   * Genuine WebKit coverage belongs in a separate, less frequent run.
   */
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: [
    {
      /* Started first, because the build itself renders pages that ask for
         places and would otherwise reach for the public API. */
      command: `node tests/e2e/overpass-server.mjs ${OVERPASS_PORT}`,
      url: `http://127.0.0.1:${OVERPASS_PORT}/api/interpreter`,
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
    },
    {
      /* A routing provider, so the suite exercises the routing chain at all.
         Until this existed nothing ever called it: `withRoutedProximity` had
         no caller, so the providers, the cache and the straight-line fallback
         were dead code that /admin listed as a working capability. */
      command: `node tests/e2e/osrm-server.mjs ${OSRM_PORT}`,
      url: `http://127.0.0.1:${OSRM_PORT}/route/v1/foot/0,0;1,1`,
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
    },
    {
      /* Production build, so the tests exercise what actually ships. */
      command: `pnpm build && pnpm start --port ${PORT}`,
      url: BASE_URL,
      /**
       * REUSED LOCALLY, AND THAT HAS A SHARP EDGE.
       *
       * Playwright only checks whether the port answers. A server left running
       * from an earlier run is reused as-is, so a change to application code —
       * or to the environment a run needs — does not reach the tests, and the
       * report describes a build that no longer exists. That cost two full
       * runs and a wrong diagnosis while the place route was being fixed.
       *
       * The trade is still worth it: a rebuild is two minutes on every
       * iteration. When a run's results look impossible, kill whatever is on
       * this port first. CI never reuses.
       */
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        STUDENTOS_DATA_DIR: ".data/e2e",
        NODE_ENV: "production",
        OVERPASS_URL: `http://127.0.0.1:${OVERPASS_PORT}/api/interpreter`,
        ROUTING_OSRM_URL: `http://127.0.0.1:${OSRM_PORT}`,

        /**
         * FORCE THE FILE STORE. This is not belt-and-braces; without it the
         * suite writes to whatever database `.env.local` points at.
         *
         * `STUDENTOS_DATA_DIR` only chooses WHERE the JSON file lives. It does
         * not choose the file store — `chooseStore()` picks Supabase whenever
         * it sees a URL and a service role key, and Next loads `.env.local` for
         * a production build. So the day a developer connects a real database
         * for the first time, the e2e suite silently stops using the throwaway
         * directory and starts signing up a hundred test accounts against
         * production. That is exactly what happened here: 110 accounts named
         * `e2e-...@universidad.edu` landed in the live database, and the tests
         * then failed because they were sharing state with it.
         *
         * `STUDENTOS_STORE=file` is the documented override in
         * `src/server/db/access.ts` for precisely this — keeping a
         * Supabase-configured developer on the local file. Blanking the two
         * Supabase variables as well means the choice cannot be made even if
         * the override is ever removed.
         */
        STUDENTOS_STORE: "file",
        NEXT_PUBLIC_SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",

        /**
         * An admin allowlist the suite can actually try to walk into.
         *
         * `requireAdmin` grants on this list plus a confirmed address, and the
         * test that matters is that an unconfirmed one does NOT get in — an
         * address on this list that nobody has registered was otherwise a
         * console waiting for whoever typed it into the sign-up form first.
         * Without a known value here that test cannot be written.
         */
        ADMIN_EMAILS: "e2e-admin@studentos.local",
      },
    },
  ],
});
