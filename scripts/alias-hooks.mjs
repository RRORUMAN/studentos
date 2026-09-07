import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * ============================================================================
 * `@/` FOR THE UNIT TESTS
 * ----------------------------------------------------------------------------
 * A module resolution hook that teaches plain Node the alias TypeScript and
 * Next already understand.
 *
 * Why this exists: `pnpm test` runs `node --test --experimental-strip-types`
 * over the real source files, with no bundler in the way. That is the whole
 * point — the unit tests exercise the same code the product runs, not a
 * transpiled copy. But Node resolves import specifiers literally, so a pure
 * module that value-imports `@/domain/work` was simply untestable, and the
 * rule that grew up around it ("engines may only *type*-import across the
 * alias") was a workaround for a missing thirty lines rather than a design.
 *
 * The cost of that workaround was real: a scoring engine that could not read
 * its own taxonomy had to restate it, and two copies of a list of job kinds
 * drift the first time somebody adds one.
 *
 * Registered from `scripts/test-register.mjs` via `--import`. Nothing in the
 * application loads this file; `next build` and `next dev` resolve the alias
 * through `tsconfig.json` as they always did.
 * ============================================================================
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Mirrors the `paths` entry in tsconfig.json. Kept to one alias deliberately:
   this hook should never become a second module system with its own rules. */
const PREFIX = "@/";

const EXTENSIONS = [".ts", ".tsx", ".mts", ".js"];

function firstExisting(base) {
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  for (const extension of EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * `server-only` is a build-time guard: it exists so a bundler errors when a
 * server module is pulled into a client bundle. There is no bundler here and no
 * client, so under `node --test` it has nothing to guard and importing it
 * throws. Resolving it to an empty module is what lets a server module be unit
 * tested at all — and the alternative, dropping the import from files that need
 * testing, would remove the guard from the build where it does its job.
 */
const EMPTY_MODULE = pathToFileURL(path.join(ROOT, "scripts", "empty-module.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: EMPTY_MODULE, shortCircuit: true };

  if (!specifier.startsWith(PREFIX)) return nextResolve(specifier, context);

  const resolved = firstExisting(path.join(ROOT, "src", specifier.slice(PREFIX.length)));
  /* Fall through rather than throw our own error: Node's message names the
     importing file, which is what someone debugging actually needs. */
  if (!resolved) return nextResolve(specifier, context);

  return nextResolve(pathToFileURL(resolved).href, context);
}
