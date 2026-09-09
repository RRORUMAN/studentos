#!/usr/bin/env node
/**
 * ============================================================================
 * FIRST RUN ON A NEW MACHINE
 * ----------------------------------------------------------------------------
 *   pnpm setup
 *
 * Gets a fresh clone from nothing to a running dev server, and says what is
 * still missing rather than guessing on your behalf.
 *
 * It exists because the gap between "the README lists five commands" and
 * "somebody on a different laptop actually got it running" is where a project
 * quietly becomes one-machine software. Everything here is idempotent — run it
 * as often as you like.
 * ============================================================================
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const problems = [];

function say(symbol, message) {
  console.log(`${symbol} ${message}`);
}

function ok(message) {
  say("  ok ", message);
}

function warn(message, detail) {
  problems.push({ message, detail });
  say("  !! ", message);
  if (detail) console.log(`       ${detail}`);
}

function run(command, label) {
  console.log(`\n> ${command}\n`);
  const result = spawnSync(command, { shell: true, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n${label} failed. Fix the error above and run \`pnpm setup\` again.`);
    process.exit(1);
  }
}

console.log("\nStudentOS — first run");
console.log("─".repeat(64));

/* ---- node -------------------------------------------------------------- */

const wanted = existsSync(join(root, ".nvmrc"))
  ? readFileSync(join(root, ".nvmrc"), "utf8").trim()
  : null;
const major = Number(process.versions.node.split(".")[0]);

if (wanted && major < Number(wanted)) {
  /* Hard stop rather than a warning: the build uses APIs that are not in older
     runtimes, and the failure it produces two minutes from now names a file
     rather than the actual cause. */
  console.error(
    `\nNode ${wanted} or newer is required; this is ${process.versions.node}.\n` +
      `With nvm:  nvm install ${wanted} && nvm use ${wanted}\n`,
  );
  process.exit(1);
}
ok(`Node ${process.versions.node}`);

/* ---- dependencies ------------------------------------------------------ */

run("pnpm install --frozen-lockfile", "Install");

/* ---- local environment ------------------------------------------------- */

const envLocal = join(root, ".env.local");
if (!existsSync(envLocal)) {
  /* Deliberately not a copy of .env.example. That file is a documented list of
     every variable with its consequences, and pasting it in wholesale creates
     a dozen empty keys that then look configured-but-broken. The product runs
     with none of them set. */
  writeFileSync(
    envLocal,
    [
      "# Local development. Gitignored. See .env.example for every variable and",
      "# what it costs to leave each one unset.",
      "#",
      "# The product runs with none of these set: storage falls back to a JSON",
      "# file under .data/ and every integration degrades honestly.",
      "",
      "# Seeds demo@studentos.local with this password. Never set in production.",
      "STUDENTOS_DEMO_PASSWORD=demo-local",
      "",
      "# Lets that account reach /admin locally.",
      "ADMIN_EMAILS=demo@studentos.local",
      "",
    ].join("\n"),
    "utf8",
  );
  ok("wrote .env.local with a local demo account");
} else {
  ok(".env.local already exists, left alone");
}

/* ---- browsers for the e2e suite ---------------------------------------- */

let browsersReady = false;
try {
  execSync("pnpm exec playwright --version", { stdio: "ignore" });
  browsersReady = true;
} catch {
  browsersReady = false;
}

if (browsersReady) {
  console.log("\nInstalling Playwright browsers (skipped if already present)…");
  const result = spawnSync("pnpm exec playwright install chromium", {
    shell: true,
    stdio: "inherit",
  });
  if (result.status === 0) ok("Playwright browsers ready");
  else warn("Playwright browsers did not install", "`pnpm test:e2e` will not run until they do.");
} else {
  warn("Playwright is not available", "Run `pnpm install` again, then `pnpm exec playwright install`.");
}

/* ---- what is still missing --------------------------------------------- */

console.log("\nConnected services");
console.log("─".repeat(64));

const env = existsSync(envLocal) ? readFileSync(envLocal, "utf8") : "";
const has = (key) => new RegExp(`^${key}=.+$`, "m").test(env);

/* Each row lists every variable that would configure the service; one is
   enough. AI has three names because either vendor key, or the generic
   OpenAI-compatible one, switches it on. */
const services = [
  [["NEXT_PUBLIC_SUPABASE_URL"], "Database", "Storage is a JSON file under .data/. Fine locally."],
  [["RESEND_API_KEY"], "Email", "Verification links print to the screen instead of sending."],
  [["STRIPE_SECRET_KEY"], "Payments", "Checkout is unavailable. Paid features stay locked."],
  [
    ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "AI_API_KEY"],
    "AI",
    "Every surface answers deterministically. Nothing is broken.",
  ],
];

for (const [keys, label, consequence] of services) {
  if (keys.some(has)) ok(`${label} configured`);
  else say("  -- ", `${label} not configured. ${consequence}`);
}

console.log(`
To pull the real values from Vercel instead:

  vercel link          # once per machine
  vercel env pull .env.local

Then \`pnpm db:verify\` proves the database actually works.
`);

console.log("─".repeat(64));
if (problems.length === 0) {
  console.log("Ready. Start with:  pnpm dev\n");
} else {
  console.log(`Ready, with ${problems.length} thing${problems.length === 1 ? "" : "s"} to look at above.`);
  console.log("Start with:  pnpm dev\n");
}
