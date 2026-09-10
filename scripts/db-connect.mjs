#!/usr/bin/env node
/**
 * ============================================================================
 * CONNECT SUPABASE
 * ----------------------------------------------------------------------------
 * Takes a project from "exists and is empty" to "the product is running on it",
 * in one command.
 *
 *   supabase login                                  # once. Yours to do.
 *   pnpm db:connect                                 # lists your projects
 *   pnpm db:connect --create "studentos" --vercel   # from nothing to serving
 *   pnpm db:connect --project <ref> --vercel        # an existing project
 *
 * THE ONE STEP THAT IS NOT AUTOMATED is authorising it, and that is deliberate.
 * `supabase login` signs in as the account owner in a browser; a personal
 * access token from the dashboard, placed in `.env.local`, does the same job
 * without one. Everything after that point is this script's job.
 *
 * WHAT IT DOES, in order, and it is safe to re-run at any point:
 *
 *   0. With `--create`, provisions the project: picks your organisation (or
 *      takes `--org`), generates a database password and records it in
 *      `.env.local`, creates the project in `--region` (default eu-central-1,
 *      which matches Vercel's fra1), and waits for it to go healthy.
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
import { randomBytes } from "node:crypto";
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
 * The access token, from the environment, `.env.local`, or the CLI's session.
 *
 * THREE PLACES, because there are two reasonable ways to authorise this and
 * they end up in different files. `supabase login` writes a session under the
 * home directory and involves no copying. A personal access token from the
 * dashboard is the alternative when a browser flow is inconvenient, and the
 * right home for it is `.env.local` -- which is gitignored, is where every
 * other secret in this project lives, and is already what `db-verify` reads.
 *
 * A token is never printed, and it never needs to be pasted anywhere but into
 * that file.
 */
async function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();

  /* `.env.local`, read the way `next dev` and `db-verify` read it. */
  try {
    const raw = await readFile(join(ROOT, ".env.local"), "utf8");
    const match = /^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)$/m.exec(raw);
    const value = match?.[1]?.trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  } catch {
    /* no .env.local; try the CLI session */
  }

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
    "Either of these works. Neither needs the token pasted anywhere but your\n" +
      "own machine:\n\n" +
      "  1.  supabase login\n" +
      "      Opens a browser, signs in as you, writes a session. Nothing to copy.\n\n" +
      "  2.  Create a token at https://supabase.com/dashboard/account/tokens\n" +
      "      and add one line to .env.local (which is gitignored):\n\n" +
      "        SUPABASE_ACCESS_TOKEN=sbp_...\n\n" +
      "Then re-run this command.",
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
const flag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

let projectRef = flag("--project");
const createName = flag("--create");
const region = flag("--region") ?? "eu-central-1";
const orgFlag = flag("--org");
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

/* ---- create one, if asked ------------------------------------------------ */

if (createName && !projectRef) {
  step(`Creating project "${createName}" in ${region}`);

  let organisations;
  try {
    organisations = await api(token, "/v1/organizations");
  } catch (error) {
    die("could not list your organisations", error.message);
  }

  const organisation = orgFlag
    ? organisations.find((row) => row.id === orgFlag)
    : organisations.length === 1
      ? organisations[0]
      : null;

  if (!organisation) {
    die(
      orgFlag ? `no organisation ${orgFlag}` : "several organisations; say which",
      `${organisations.map((row) => `  ${row.id}  ${row.name}`).join("\n")}\n\n` +
        "Re-run with --org <id>",
    );
  }
  ok(`organisation ${organisation.name}`);

  /**
   * The database password.
   *
   * Generated here rather than asked for, and written to `.env.local` with the
   * rest. It is not used to sign in to anything -- the application reaches the
   * store with the service-role key -- but Supabase requires one at creation
   * and you need it later for direct psql access, and a password nobody
   * recorded is the kind of thing that turns a routine afternoon into a project
   * restore.
   */
  const dbPass = randomBytes(24).toString("base64url");

  let created;
  try {
    created = await api(token, "/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        name: createName,
        organization_id: organisation.id,
        region,
        db_pass: dbPass,
      }),
    });
  } catch (error) {
    die("could not create the project", error.message);
  }

  projectRef = created.id;
  ok(`created ${projectRef}`);

  await writeEnvLocal({ SUPABASE_DB_PASSWORD: dbPass, SUPABASE_PROJECT_REF: projectRef });
  ok(`database password saved to .env.local ${redact(dbPass)}`);

  /* Provisioning takes a couple of minutes and everything below needs a live
     database, so wait rather than failing on a project that is nearly there. */
  step("Waiting for it to finish provisioning");
  const deadline = Date.now() + 8 * 60_000;
  for (;;) {
    const rows = await api(token, "/v1/projects");
    const status = rows.find((row) => row.id === projectRef)?.status;
    if (status === "ACTIVE_HEALTHY") {
      ok("healthy");
      break;
    }
    if (Date.now() > deadline) {
      die(
        `still ${status} after eight minutes`,
        `The project exists (${projectRef}). Re-run:\n\n` +
          `  pnpm db:connect --project ${projectRef} --vercel`,
      );
    }
    info(`${status ?? "unknown"}…`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }

  projects = await api(token, "/v1/projects");
}

if (!projectRef) {
  step("Your projects:");
  if (projects.length === 0) {
    info("none yet.");
    console.log("");
    info("Create and connect one in a single command:");
    info('  pnpm db:connect --create "studentos" --vercel');
    console.log("");
    info("eu-central-1 is the default region and matches Vercel's fra1.");
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

step("Applying the schema (0005, 0006, 0007 — not the four that must not be applied)");

/**
 * `required` is what the product cannot run correctly without. The other two
 * need `pg_cron`, which some plans do not offer, and each degrades to something
 * the product survives — so they warn rather than stop, and say what the
 * deployment is left doing instead.
 */
const files = [
  {
    name: "0005_row_store",
    file: "0005_row_store.sql",
    required: true,
    without: null,
  },
  {
    name: "0006_scheduled_cleanup",
    file: "0006_scheduled_cleanup.sql",
    required: false,
    without: "Expired sessions and spent password tokens will accumulate until something prunes them.",
  },
  {
    name: "0007_shared_rate_limit",
    file: "0007_shared_rate_limit.sql",
    required: false,
    without:
      "Rate limits stay per serverless isolate, so the sign-in and sign-up ceilings multiply by however many isolates are running. /admin says so.",
  },
];

for (const migration of files) {
  const query = await readFile(join(ROOT, "supabase", "migrations", migration.file), "utf8");
  try {
    await api(token, `/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      body: JSON.stringify({ query }),
    });
    ok(`${migration.name} applied`);
  } catch (error) {
    if (migration.required) die(`${migration.name} failed to apply`, error.message);
    info(`${migration.name} did not apply — ${error.message.slice(0, 160)}`);
    info(migration.without);
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
