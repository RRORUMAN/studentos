#!/usr/bin/env node
/**
 * ============================================================================
 * CONNECT SUPABASE
 * ----------------------------------------------------------------------------
 * Takes a project from "exists and is empty" to "the product is running on it",
 * in one command.
 *
 *   supabase login            # once, in a browser. Yours to do.
 *   pnpm db:connect           # lists your projects and stops
 *   pnpm db:connect --project <ref>
 *   pnpm db:connect --project <ref> --vercel   # also configure production
 *
 * WHAT IT DOES, in order, and it is safe to re-run at any point:
 *
 *   1. Applies migrations 0005 and 0006 through the Management API, which is
 *      the same path the dashboard SQL editor uses. It does NOT run
 *      `supabase db push`, which would apply all six migrations including the
 *      four that must never be applied -- see `scripts/db-sql.mjs`.
 *   2. Reads the project's anon and service-role keys.
 *   3. Writes them into `.env.local`, preserving whatever is already there.
 *   4. With `--vercel`, sets the same variables on the Vercel production
 *      environment.
 *   5. Runs `pnpm db:verify`, which writes a probe row, reads it back, updates
 *      it, deletes it and confirms it is gone. That, not the absence of an
 *      error above, is what proves the store works.
 *
 * SECRETS ARE NEVER PRINTED. The keys are read, written to files and handed to
 * the Vercel CLI on stdin. Nothing echoes them, and the log lines say how many
 * characters a key had rather than what it was. If you are running this with a
 * colleague watching, nothing on screen is a credential.
 *
 * WHY NOT `supabase db push`: it applies every file in `supabase/migrations/`.
 * Four of those describe a relational schema nothing reads, need `postgis` and
 * `vector`, and leave behind empty tables that look authoritative. The whole
 * point of doing this through the API is to apply exactly two files.
 *
 * NOT YET RUN AGAINST A LIVE PROJECT. No Supabase credentials existed in the
 * session that wrote this, so every path below is reasoned rather than
 * observed -- the same standing `0005_row_store.sql` itself had until somebody
 * ran it. It fails loudly rather than continuing on a bad assumption, and
 * `pnpm db:verify` is the independent check that does not trust any of it.
 * ============================================================================
 */

import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.supabase.com";

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

const ok = (message) => console.log(`  ok  ${message}`);
const step = (message) => console.log(`\n${message}`);
const info = (message) => console.log(`      ${message}`);

function die(message, detail) {
  console.error(`\nFAIL  ${message}`);
  if (detail) console.error(`\n${detail}\n`);
  process.exit(1);
}

/** Never print a secret. Say how long it was instead. */
const redact = (value) => (value ? `[${value.length} chars]` : "[missing]");

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The access token, from the environment or from the CLI's own session file.
 *
 * Reading the CLI's session rather than asking for a token keeps this command
 * to one prerequisite -- `supabase login` -- instead of two.
 */
async function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();

  const candidates = [
    join(homedir(), ".supabase", "access-token"),
    join(process.env.APPDATA ?? "", "supabase", "access-token"),
  ].filter(Boolean);

  for (const path of candidates) {
    try {
      const raw = (await readFile(path, "utf8")).trim();
      if (raw) return raw;
    } catch {
      /* try the next one */
    }
  }

  die(
    "not signed in to Supabase",
    "Run this once, in a browser:\n\n" +
      "  supabase login\n\n" +
      "or set SUPABASE_ACCESS_TOKEN from a personal access token at\n" +
      "https://supabase.com/dashboard/account/tokens",
  );
}

async function api(token, path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${response.status}: ${body.slice(0, 400)}`);
  }
  return body ? JSON.parse(body) : null;
}

/* -------------------------------------------------------------------------- */
/* .env.local                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Set variables in `.env.local` without disturbing what is already there.
 *
 * A developer's `.env.local` holds things this script knows nothing about --
 * an OpenAI key, a demo password. Rewriting the file wholesale would lose them,
 * so existing lines are replaced in place and new ones appended.
 */
async function writeEnvLocal(values) {
  const path = join(ROOT, ".env.local");
  let existing = "";
  try {
    existing = await readFile(path, "utf8");
  } catch {
    /* first run; the file is created below */
  }

  const lines = existing.split(/\r?\n/);
  const seen = new Set();

  const updated = lines.map((line) => {
    const match = /^\s*([A-Z0-9_]+)\s*=/.exec(line);
    if (!match) return line;
    const key = match[1];
    if (!(key in values)) return line;
    seen.add(key);
    return `${key}=${values[key]}`;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) updated.push(`${key}=${value}`);
  }

  const body = `${updated.join("\n").replace(/\n+$/, "")}\n`;
  await writeFile(path, body, "utf8");
}

/* -------------------------------------------------------------------------- */
/* Subprocesses                                                                */
/* -------------------------------------------------------------------------- */

/** Run a command, optionally feeding it something on stdin. Never logs stdin. */
function run(command, args, { stdin } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      shell: process.platform === "win32",
      stdio: [stdin === undefined ? "inherit" : "pipe", "inherit", "inherit"],
    });
    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

const args = process.argv.slice(2);
const projectIndex = args.indexOf("--project");
const projectRef = projectIndex >= 0 ? args[projectIndex + 1] : null;
const toVercel = args.includes("--vercel");

console.log("");
console.log("StudentOS — connect Supabase");
console.log("─".repeat(64));

const token = await accessToken();
ok(`signed in ${redact(token)}`);

/* ---- which project ------------------------------------------------------- */

let projects;
try {
  projects = await api(token, "/v1/projects");
} catch (error) {
  die("could not list your projects", error.message);
}

if (!projectRef) {
  step("Your projects:");
  if (projects.length === 0) {
    info("none yet — create one at https://supabase.com/dashboard/projects");
    info("Pick the region nearest your students; eu-central-1 matches Vercel's fra1.");
  }
  for (const project of projects) {
    info(`${project.id}   ${project.name}  (${project.region}, ${project.status})`);
  }
  console.log("");
  info("Then: pnpm db:connect --project <ref> --vercel");
  console.log("");
  process.exit(projects.length === 0 ? 1 : 0);
}

const project = projects.find((row) => row.id === projectRef);
if (!project) {
  die(
    `no project ${projectRef} on this account`,
    `Found: ${projects.map((row) => row.id).join(", ") || "(none)"}`,
  );
}
ok(`project ${project.name} (${project.region}, ${project.status})`);

if (project.status !== "ACTIVE_HEALTHY") {
  info(`status is ${project.status}; if this fails, wait for it to finish provisioning`);
}

/* ---- 1. schema ----------------------------------------------------------- */

step("Applying the schema (0005, 0006 — not the four that must not be applied)");

const sql = [
  await readFile(join(ROOT, "supabase", "migrations", "0005_row_store.sql"), "utf8"),
  await readFile(join(ROOT, "supabase", "migrations", "0006_scheduled_cleanup.sql"), "utf8"),
];

const names = ["0005_row_store", "0006_scheduled_cleanup"];

for (const [index, query] of sql.entries()) {
  try {
    await api(token, `/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      body: JSON.stringify({ query }),
    });
    ok(`${names[index]} applied`);
  } catch (error) {
    /* 0006 needs pg_cron, which some plans do not offer. That is survivable:
       the product runs correctly, those four kinds of row simply accumulate. */
    if (index === 1) {
      info(`${names[index]} did not apply — ${error.message.slice(0, 160)}`);
      info("This is the pg_cron cleanup. The product runs without it; expired");
      info("sessions and spent tokens will accumulate until something prunes them.");
    } else {
      die(`${names[index]} failed to apply`, error.message);
    }
  }
}

/* ---- 2. keys ------------------------------------------------------------- */

step("Reading the project keys");

let keys;
try {
  keys = await api(token, `/v1/projects/${projectRef}/api-keys`);
} catch (error) {
  die("could not read the project's API keys", error.message);
}

const anon = keys.find((row) => row.name === "anon")?.api_key;
const serviceRole = keys.find((row) => row.name === "service_role")?.api_key;

if (!anon || !serviceRole) {
  die(
    "the project did not return both an anon and a service_role key",
    `Got: ${keys.map((row) => row.name).join(", ")}`,
  );
}

const url = `https://${projectRef}.supabase.co`;
ok(`url ${url}`);
ok(`anon key ${redact(anon)}`);
ok(`service role key ${redact(serviceRole)}  (never printed, never logged)`);

/* ---- 3. .env.local ------------------------------------------------------- */

step("Writing .env.local");

await writeEnvLocal({
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: serviceRole,
  STUDENTOS_STORE: "supabase",
});
ok("four variables set, everything else left alone");

/* ---- 4. Vercel ----------------------------------------------------------- */

if (toVercel) {
  step("Setting the same variables on Vercel production");

  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    SUPABASE_SERVICE_ROLE_KEY: serviceRole,
    STUDENTOS_STORE: "supabase",
  };

  for (const [key, value] of Object.entries(vars)) {
    /* Remove first so a re-run updates rather than erroring on a duplicate.
       A missing variable makes this a no-op, which is why the code is ignored. */
    await run("npx", ["--no-install", "vercel", "env", "rm", key, "production", "--yes"], {
      stdin: "",
    });
    const code = await run("npx", ["--no-install", "vercel", "env", "add", key, "production"], {
      stdin: `${value}\n`,
    });
    if (code !== 0) die(`could not set ${key} on Vercel`, "Is `vercel` linked to this project?");
    ok(`${key} set`);
  }

  info("These take effect on the next deployment: vercel --prod");
}

/* ---- 5. prove it --------------------------------------------------------- */

step("Verifying — a probe row written, read back, updated, deleted");

const code = await run("node", ["scripts/db-verify.mjs"]);

console.log("");
if (code === 0) {
  console.log("Storage is ready. Next:");
  console.log("");
  console.log("  vercel --prod                                    # deploy onto it");
  console.log("  curl -s <your-url>/api/health                    # expect \"store\":\"supabase\"");
  console.log("");
  console.log("The 'nothing is kept' banner disappears on its own once that says supabase.");
  console.log("");
} else {
  console.log("The schema and keys are in place but verification failed — read it above.");
  console.log("");
}

process.exit(code);
