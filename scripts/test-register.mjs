import { register } from "node:module";

/**
 * Installs the `@/` resolution hook for the unit test run. Split from
 * `alias-hooks.mjs` because `register` must run on the main thread while the
 * hooks themselves are loaded into Node's separate loader thread.
 */
register("./alias-hooks.mjs", import.meta.url);
