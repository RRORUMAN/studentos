import "server-only";

import { cache } from "react";

import {
  type AiProviderId,
  type AiRuntimeConfig,
  type AiSettingKey,
  aiDefaults,
  defaultModels,
  tierLimits,
  type Tier,
} from "@/config/ai";
import { findMany } from "@/server/db";
import { loadSettings } from "@/server/queries/settings";
import { env, isAiConfigured } from "@/services/env";

/**
 * ============================================================================
 * AI RUNTIME CONFIGURATION
 * ----------------------------------------------------------------------------
 * Resolves what the gateway should actually do on this request: which
 * provider, which model per tier, what the ceilings are, and whether a cost
 * cap has already been reached today.
 *
 * Precedence, highest first:
 *
 *   1. a cost cap that has been hit          → deterministic, and says so
 *   2. an admin setting                      → editable without a deploy
 *   3. an environment variable               → set at deploy time
 *   4. the code default                      → in `src/config/ai.ts`
 *
 * The API key is only ever read from the environment. There is deliberately no
 * admin control for it: a secret settable from a web form is a secret that
 * ends up in a database backup.
 * ============================================================================
 */

function readNumber(settings: Map<string, string>, key: AiSettingKey, fallback: number): number {
  const raw = settings.get(key);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Spend so far, in micro-euros, since an instant. Counted from the usage ledger. */
export async function spendSince(sinceIso: string): Promise<number> {
  const rows = await findMany("aiUsage", (row) => row.createdAt >= sinceIso);
  return rows.reduce((sum, row) => sum + row.costMicros, 0);
}

/**
 * The live configuration. Memoised per request: the Home screen alone can ask
 * for it several times, and it costs two table scans.
 */
export const aiConfig = cache(async (): Promise<AiRuntimeConfig> => {
  const settings = await loadSettings();

  const providerRaw = settings.get("ai.provider") ?? env.ai.provider ?? (isAiConfigured ? "anthropic" : "none");
  const provider: AiProviderId =
    providerRaw === "anthropic" || providerRaw === "openai" || providerRaw === "none" ? providerRaw : "anthropic";

  const enabled = settings.get("ai.enabled") !== "off";

  /**
   * Most specific wins: an admin who changed it in `/admin`, then a per-tier
   * environment variable, then a deployment-wide pin, then the default for the
   * provider. `AI_MODEL` sits below `AI_SMALL_MODEL` and friends because
   * setting both means "this one everywhere, except here".
   */
  const modelTier = (tier: 1 | 2 | 3): string => {
    const setting = settings.get(`ai.model.tier${tier}` as AiSettingKey);
    if (setting) return setting;
    const perTier = env.ai.models[tier];
    if (perTier) return perTier;
    if (env.ai.model) return env.ai.model;
    return provider === "none" ? "none" : defaultModels[provider][tier];
  };

  /**
   * `AI_MAX_TOKENS` caps every tier. It lowers a ceiling, never raises one: a
   * deployment-wide cap that let tier 1 write more than its budget allows would
   * be a cost control that increases cost.
   */
  const capTokens = (value: number): number =>
    env.ai.maxTokens === null ? value : Math.min(value, env.ai.maxTokens);

  const perUserDailyCalls = readNumber(settings, "ai.perUserDailyCalls", aiDefaults.perUserDailyCalls);
  const dailyCostCapMicros = readNumber(settings, "ai.dailyCostCapMicros", aiDefaults.dailyCostCapMicros);
  const monthlyCostCapMicros = readNumber(settings, "ai.monthlyCostCapMicros", aiDefaults.monthlyCostCapMicros);

  /* ---- degradation, in order of precedence ------------------------------ */
  let degradedReason: AiRuntimeConfig["degradedReason"] = null;
  if (provider === "none") degradedReason = "provider-none";
  else if (!enabled) degradedReason = "disabled";
  else if (!isAiConfigured) degradedReason = "no-key";

  if (degradedReason === null) {
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const [today, month] = await Promise.all([spendSince(dayStart), spendSince(monthStart)]);
    if (dailyCostCapMicros > 0 && today >= dailyCostCapMicros) degradedReason = "daily-cap";
    else if (monthlyCostCapMicros > 0 && month >= monthlyCostCapMicros) degradedReason = "monthly-cap";
  }

  return {
    provider,
    live: degradedReason === null,
    models: { 1: modelTier(1), 2: modelTier(2), 3: modelTier(3) },
    temperature: Math.min(1, Math.max(0, readNumber(settings, "ai.temperature", aiDefaults.temperature))),
    maxOutputTokens: {
      0: 0,
      1: capTokens(readNumber(settings, "ai.maxOutputTokens.tier1", tierLimits[1].maxOutputTokens)),
      2: capTokens(readNumber(settings, "ai.maxOutputTokens.tier2", tierLimits[2].maxOutputTokens)),
      3: capTokens(readNumber(settings, "ai.maxOutputTokens.tier3", tierLimits[3].maxOutputTokens)),
    } as Record<Tier, number>,
    dailyCostCapMicros,
    monthlyCostCapMicros,
    perUserDailyCalls,
    perPlanDailyCalls: {
      free: env.ai.dailyCalls.free ?? perUserDailyCalls,
      plus: env.ai.dailyCalls.plus ?? perUserDailyCalls,
      pro: env.ai.dailyCalls.pro ?? perUserDailyCalls,
      max: env.ai.dailyCalls.max ?? perUserDailyCalls,
    },
    degradedReason,
  };
});

/** How many model calls this student has made today. The second ceiling. */
export async function callsToday(userId: string): Promise<number> {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const rows = await findMany(
    "aiUsage",
    (row) => row.userId === userId && row.createdAt >= dayStart && row.tier > 0 && !row.cacheHit,
  );
  return rows.length;
}

/** One line an admin or a student can be shown about why answers are plain today. */
export const degradedCopy: Record<NonNullable<AiRuntimeConfig["degradedReason"]>, string> = {
  "no-key": "No AI key is configured, so answers are written by the product rather than a model.",
  disabled: "Model calls are switched off in admin. Answers are written by the product.",
  "provider-none": "No AI provider is selected. Answers are written by the product.",
  "daily-cap": "Today's AI spending cap has been reached. Answers are written by the product until midnight.",
  "monthly-cap": "This month's AI spending cap has been reached. Answers are written by the product.",
};
