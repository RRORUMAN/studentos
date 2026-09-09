import type { AiOperation } from "@/domain/types";
import type { PlanKey } from "@/config/pricing";

/**
 * ============================================================================
 * AI CONFIGURATION — the shape, the defaults, the vocabulary
 * ----------------------------------------------------------------------------
 * Shared between the server (which resolves the live values) and the admin UI
 * (which renders the controls). Nothing here reads the environment or the
 * database; `src/server/ai/config.ts` does that.
 *
 * The routing ladder is the margin. It is stated once, here, so that adding a
 * model call means adding a row to a table someone reviews:
 *
 *   Tier 0  NO MODEL. Budget arithmetic, nearby search, feed ranking, event
 *           filtering, recommendation scoring, the daily brief, LifeOps, the
 *           mission builder. The overwhelming majority of what feels
 *           intelligent in this product is Tier 0.
 *   Tier 1  SMALL MODEL. Classification, tagging, one-line explanations,
 *           short summaries. Cheap, fast, heavily cached.
 *   Tier 2  MID MODEL. Weekend plans, budget coaching, mission phrasing.
 *   Tier 3  STRONG MODEL. Rare, Max-only, deep multi-day planning.
 * ============================================================================
 */

export type Tier = 0 | 1 | 2 | 3;

/** Providers the gateway knows how to talk to. */
export type AiProviderId = "anthropic" | "openai" | "none";

export const providerMeta: Record<AiProviderId, { label: string; detail: string; endpoint: string | null }> = {
  anthropic: {
    label: "Anthropic",
    detail: "Messages API. Default models are Haiku for tier 1, Sonnet for tier 2, Opus for tier 3.",
    endpoint: "https://api.anthropic.com/v1/messages",
  },
  openai: {
    label: "OpenAI",
    detail: "Chat Completions. Defaults are gpt-5.4-mini for tier 1, gpt-5.4 for tier 2, gpt-5.5 for tier 3. Any endpoint speaking the same shape works via AI_BASE_URL.",
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  none: {
    label: "Not connected",
    detail: "Deterministic answers only. Every surface still works; explanations read plainer.",
    endpoint: null,
  },
};

/**
 * Operation to tier. Every operation the product performs is named here.
 * A feature that could be Tier 0 and is not is a bug, not a design choice.
 */
export const defaultOperationTier: Record<AiOperation, Tier> = {
  /** Intent classification for queries the regex parser could not place. */
  classify: 1,
  /** Receipt line extraction. Structured output from a text blob. */
  extract: 1,
  /** Channel and Pulse catch-up. Summarising real messages, never adding to them. */
  summarize: 1,
  /** Explaining why the deterministic scorer picked what it picked. */
  recommend: 1,
  /** Weekend and weekly plans, built from retrieved candidates. */
  plan: 2,
  /** Budget coaching against real transaction rows. */
  budget: 2,
  /** Smart Missions: ordering and phrasing steps built from retrieved rows. */
  mission: 2,
  /** Community moderation triage. */
  moderate: 1,
};

export const operationMeta: Record<AiOperation, { label: string; detail: string }> = {
  classify: { label: "Classify", detail: "Place a question that the parser could not." },
  extract: { label: "Extract", detail: "Pull structured lines out of a receipt." },
  summarize: { label: "Summarize", detail: "Catch-up over real posts and messages." },
  recommend: { label: "Recommend", detail: "Explain a ranked list the scorer produced." },
  plan: { label: "Plan", detail: "Write up a plan assembled from retrieved rows." },
  budget: { label: "Budget", detail: "Coach against the student's own transactions." },
  mission: { label: "Mission", detail: "Phrase and order mission steps." },
  moderate: { label: "Moderate", detail: "Triage a report on community content." },
};

/** Per-tier ceilings. A runaway prompt is capped before it is sent, not after. */
export const tierLimits: Record<Tier, { maxInputTokens: number; maxOutputTokens: number }> = {
  0: { maxInputTokens: 0, maxOutputTokens: 0 },
  1: { maxInputTokens: 2_000, maxOutputTokens: 400 },
  2: { maxInputTokens: 8_000, maxOutputTokens: 1_200 },
  3: { maxInputTokens: 24_000, maxOutputTokens: 3_000 },
};

/** Default model per tier, per provider. Named rather than inferred, so a deployment cannot silently end up on an expensive model. */
export const defaultModels: Record<Exclude<AiProviderId, "none">, Record<1 | 2 | 3, string>> = {
  anthropic: {
    1: "claude-haiku-4-5-20251001",
    2: "claude-sonnet-5",
    3: "claude-opus-5",
  },
  openai: {
    1: "gpt-5.4-mini",
    2: "gpt-5.4",
    3: "gpt-5.5",
  },
};

/**
 * Rough per-million-token euro cost, for the admin cost view and for the spend
 * caps that view enforces. Unknown models fall back to the tier-2 rate rather
 * than to zero: a cost view that under-reports is worse than one that is
 * approximate.
 *
 * Every row is the vendor's published list price converted at 0.9 EUR/USD.
 * The rate is stated here rather than applied per row so that refreshing these
 * numbers is a mechanical job, and so nobody has to guess whether a given row
 * is dollars or euros. Checked against both vendors' pricing pages 2026-09-08.
 */
export const costPerMillionTokens: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.9, output: 4.5 },
  "claude-sonnet-5": { input: 2.7, output: 13.5 },
  "claude-opus-5": { input: 13.5, output: 67.5 },
  "gpt-5.4-nano": { input: 0.18, output: 1.125 },
  "gpt-5.4-mini": { input: 0.675, output: 4.05 },
  "gpt-5.4": { input: 2.25, output: 13.5 },
  "gpt-5.5": { input: 4.5, output: 27.0 },
  "gpt-4.1-mini": { input: 0.36, output: 1.44 },
  "gpt-4.1": { input: 1.8, output: 7.2 },
  none: { input: 0, output: 0 },
};

/** Cache lifetime per operation. Zero means never cached. */
export const cacheTtlMs: Record<AiOperation, number> = {
  classify: 24 * 3_600_000,
  extract: 0, // per-receipt; never reusable
  summarize: 15 * 60_000,
  recommend: 30 * 60_000,
  plan: 10 * 60_000,
  budget: 0, // personal and time-sensitive
  mission: 10 * 60_000,
  moderate: 6 * 3_600_000,
};

/* -------------------------------------------------------------------------- */
/* Admin-settable values                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What an admin can change without a deploy. Each has a code default; a
 * settings row exists only when it was changed, so clearing the row restores
 * the default.
 *
 * The API key is deliberately NOT here. A secret that can be set from a web
 * form is a secret that ends up in a database backup and a screen share.
 */
export type AiSettingKey =
  | "ai.provider"
  | "ai.model.tier1"
  | "ai.model.tier2"
  | "ai.model.tier3"
  | "ai.temperature"
  | "ai.maxOutputTokens.tier1"
  | "ai.maxOutputTokens.tier2"
  | "ai.maxOutputTokens.tier3"
  | "ai.dailyCostCapMicros"
  | "ai.monthlyCostCapMicros"
  | "ai.perUserDailyCalls"
  | "ai.enabled";

export const aiSettingMeta: Record<AiSettingKey, { label: string; detail: string; kind: "text" | "number" | "toggle" }> = {
  "ai.provider": { label: "Provider", detail: "anthropic, openai, or none. Falls back to AI_PROVIDER.", kind: "text" },
  "ai.model.tier1": { label: "Tier 1 model", detail: "Small: classify, tag, one-line summaries.", kind: "text" },
  "ai.model.tier2": { label: "Tier 2 model", detail: "Mid: plans, budget coaching, missions.", kind: "text" },
  "ai.model.tier3": { label: "Tier 3 model", detail: "Strong: rare deep planning, Max only.", kind: "text" },
  "ai.temperature": { label: "Temperature", detail: "0 to 1. Low keeps answers close to the retrieved rows.", kind: "number" },
  "ai.maxOutputTokens.tier1": { label: "Tier 1 max output", detail: "Hard ceiling per call.", kind: "number" },
  "ai.maxOutputTokens.tier2": { label: "Tier 2 max output", detail: "Hard ceiling per call.", kind: "number" },
  "ai.maxOutputTokens.tier3": { label: "Tier 3 max output", detail: "Hard ceiling per call.", kind: "number" },
  "ai.dailyCostCapMicros": { label: "Daily cost cap", detail: "Micro-euros across all users. Past it, every answer is deterministic.", kind: "number" },
  "ai.monthlyCostCapMicros": { label: "Monthly cost cap", detail: "Micro-euros across all users.", kind: "number" },
  "ai.perUserDailyCalls": { label: "Per-user daily calls", detail: "A second ceiling under the weekly plan allowance.", kind: "number" },
  "ai.enabled": { label: "Model calls enabled", detail: "Off makes every answer deterministic without touching keys.", kind: "toggle" },
};

/** Code defaults. Euro cents are micro-euros: 5_000_000 is €5. */
export const aiDefaults = {
  temperature: 0.2,
  /** €12 a day and €200 a month, across everyone. Sized so a runaway loop is capped before it is a problem. */
  dailyCostCapMicros: 12_000_000,
  monthlyCostCapMicros: 200_000_000,
  perUserDailyCalls: 40,
} as const;

export type AiRuntimeConfig = {
  provider: AiProviderId;
  /** True when a key exists and the provider is not "none" and it is switched on. */
  live: boolean;
  models: Record<1 | 2 | 3, string>;
  temperature: number;
  maxOutputTokens: Record<Tier, number>;
  dailyCostCapMicros: number;
  monthlyCostCapMicros: number;
  perUserDailyCalls: number;
  /**
   * Per-plan daily call ceilings, resolved from `AI_DAILY_LIMIT_*`.
   *
   * A plan with no variable set falls back to `perUserDailyCalls`, so a
   * deployment that sets none of them behaves exactly as it did before these
   * existed. Zero means no ceiling for that plan, matching the admin control.
   */
  perPlanDailyCalls: Record<PlanKey, number>;
  /** Why the gateway is not calling a model, when it is not. */
  degradedReason: "no-key" | "disabled" | "provider-none" | "daily-cap" | "monthly-cap" | null;
};
