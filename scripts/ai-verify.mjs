#!/usr/bin/env node
/**
 * ============================================================================
 * AI VERIFICATION
 * ----------------------------------------------------------------------------
 * Proves the configured AI provider actually answers, by asking it — through
 * the product's own gateway, not through a hand-written fetch.
 *
 * Checking that a variable is set says nothing useful. A key can be revoked, be
 * the other vendor's, belong to a project with no credit, or name a model the
 * account cannot reach, and every one of those produces a deployment that looks
 * connected. Worse, `runAi` is built to swallow exactly these failures: every
 * AI surface sits on top of a correct Tier 0 answer, so a dead provider does
 * not break the product, it just quietly stops improving it. That is the right
 * behaviour for a student and a terrible property for a deploy — hence this.
 *
 *   pnpm ai:verify
 *
 * It makes two real, paid calls: one at tier 1 and one at tier 2, a few hundred
 * tokens in total, well under a cent. They are logged in `aiUsage` like any
 * other call, because they were real ones.
 *
 * Exits non-zero on any failure, so it can gate a deploy.
 * ============================================================================
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const symbols = { pass: "  ok ", fail: "FAIL ", info: "     " };
let failures = 0;

const pass = (message) => console.log(`${symbols.pass}${message}`);
const info = (message) => console.log(`${symbols.info}${message}`);

function fail(message, detail) {
  failures += 1;
  console.log(`${symbols.fail}${message}`);
  if (detail) for (const line of String(detail).split("\n")) console.log(`${symbols.info}${line}`);
}

/**
 * Load `.env.local` the way `next dev` would, before anything imports
 * `@/services/env` — that module reads `process.env` once, at import time.
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

/** A sentinel the model cannot produce, so a fallback can never pass as an answer. */
const FALLBACK = "__deterministic_fallback__";

async function main() {
  console.log("");
  console.log("StudentOS — AI verification");
  console.log("─".repeat(64));

  await loadEnvFiles();

  const { env, isAiConfigured } = await import("@/services/env");
  const { costPerMillionTokens, defaultModels } = await import("@/config/ai");

  if (!isAiConfigured) {
    fail(
      "No AI key in the environment",
      "Set OPENAI_API_KEY or ANTHROPIC_API_KEY. Without one every surface\n" +
        "answers deterministically, which is a supported way to run — but it\n" +
        "is not what this script is for. See PRODUCTION_SETUP.md → AI.",
    );
    return finish();
  }

  const provider = env.ai.provider ?? "anthropic";
  pass(`key present from ${env.ai.keySource} (${env.ai.apiKey.length} characters), provider ${provider}`);

  if (provider === "none") {
    fail("AI_PROVIDER=none", "A key is set but the provider is switched off, so no model is ever called.");
    return finish();
  }

  /* Config before conduct: a model with no price row is billed at the tier-2
     rate, which silently makes the spend caps wrong in whichever direction the
     real price differs. */
  const { aiConfig } = await import("@/server/ai/config");
  const config = await aiConfig();
  for (const tier of [1, 2, 3]) {
    const model = config.models[tier];
    const priced = costPerMillionTokens[model];
    if (priced) pass(`tier ${tier}: ${model} (€${priced.input}/€${priced.output} per M tokens)`);
    else
      fail(
        `tier ${tier}: ${model} has no row in costPerMillionTokens`,
        "It will be costed at the tier-2 rate, so /admin and the spend caps\n" +
          "will be wrong. Add the model to src/config/ai.ts.",
      );
  }

  if (!config.live) {
    fail(`the gateway is not live: ${config.degradedReason}`, "Nothing below would have called a model.");
    return finish();
  }

  info(`defaults for this provider: ${Object.values(defaultModels[provider]).join(", ")}`);

  /* ---- the calls -------------------------------------------------------- */

  const { runAi } = await import("@/server/ai/gateway");

  const cases = [
    {
      tier: 1,
      operation: "summarize",
      prompt: "Three students posted about the same tram strike on Tuesday. Summarise in one short sentence.",
    },
    {
      tier: 2,
      operation: "plan",
      prompt:
        "A student has Saturday free and €20. Nearby: a free museum morning and a €6 market lunch. " +
        "Write two short lines naming both.",
    },
  ];

  for (const testCase of cases) {
    const started = Date.now();
    const result = await runAi({
      operation: testCase.operation,
      userId: null,
      /* Unique per run, so a cache hit can never stand in for a live call. */
      scope: `ai-verify-${Date.now()}`,
      payload: { probe: testCase.operation, at: new Date().toISOString() },
      system: "You are verifying a connection. Answer in plain text, briefly.",
      prompt: testCase.prompt,
      parse: (text) => text,
      fallback: () => FALLBACK,
      skipQuota: true,
    });

    const elapsed = Date.now() - started;

    if (result.degraded || result.value === FALLBACK) {
      fail(
        `tier ${testCase.tier} (${testCase.operation}) fell back to the deterministic answer: ${result.degradedReason}`,
        "The request was refused, timed out, or the key is not valid for this\n" +
          "model. The reason is on the server logs and in Sentry if configured.",
      );
      continue;
    }

    if (result.tier !== testCase.tier) {
      fail(`tier ${testCase.tier} (${testCase.operation}) ran at tier ${result.tier}`);
      continue;
    }

    pass(`tier ${testCase.tier} ${testCase.operation} → ${result.model} in ${elapsed}ms`);
    info(`"${result.value.replace(/\s+/g, " ").trim().slice(0, 120)}"`);
  }

  return finish();
}

function finish() {
  console.log("─".repeat(64));
  if (failures === 0) console.log("The AI provider answered. Every surface can use a model.\n");
  else console.log(`${failures} check${failures === 1 ? "" : "s"} failed. Answers stay deterministic.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  fail("verification threw", error?.stack ?? error);
  finish();
});
