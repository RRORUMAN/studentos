import "server-only";

import { createHash } from "node:crypto";

import {
  type AiProviderId,
  type AiRuntimeConfig,
  cacheTtlMs,
  costPerMillionTokens,
  defaultOperationTier,
  providerMeta,
  type Tier,
  tierLimits,
} from "@/config/ai";
import type { PlanKey } from "@/config/pricing";
import type { AiOperation } from "@/domain/types";
import { aiConfig, callsToday } from "@/server/ai/config";
import { insert, newId, nowIso } from "@/server/db";
import { assertQuota, planFor } from "@/server/entitlements";
import { env } from "@/services/env";
import { captureError } from "@/services/monitoring";

/**
 * ============================================================================
 * AI GATEWAY
 * ----------------------------------------------------------------------------
 * The single door every model call goes through. Nothing in the product calls
 * a provider directly, and that is enforced by convention plus the fact that
 * no provider SDK is imported anywhere else.
 *
 * The gateway owns seven decisions that must not be scattered:
 *
 *   ROUTING     which tier, and therefore which model (or none at all)
 *   CACHE       whether an identical question was already answered
 *   QUOTA       whether this student has asks left this week, and today
 *   BUDGET      a hard per-call token ceiling, plus a global spend cap
 *   LOGGING     one usage row per call, with an estimated cost
 *   SAFETY      which domains a model may not author at all
 *   RETRIEVAL   that it never happens here — see `src/server/ai/tools.ts`
 *
 * ---------------------------------------------------------------------------
 * THE ROUTING LADDER — this is the margin
 *
 * Tier 0 is no model at all: budget arithmetic, nearby search, feed ranking,
 * the daily brief, LifeOps, the mission builder, deal confidence. The
 * overwhelming majority of what feels intelligent in this product is Tier 0,
 * and that is the entire reason the free tier is affordable — a thousand
 * students loading Home costs nothing. Tiers 1 to 3 are declared in
 * `src/config/ai.ts` so that adding a model call means editing a table
 * somebody reviews.
 *
 * ---------------------------------------------------------------------------
 * WHAT A MODEL IS NEVER ALLOWED TO DO
 *
 * Invent a place, an event, a price, a deal, an opening hour, or — above all —
 * a legal or immigration requirement. Retrieval happens first, in Tier 0 code,
 * through the typed tools in `tools.ts`; the model receives real rows and its
 * job is selection, ordering and explanation. `domain: "official"` is rejected
 * before a request is built, so there is no prompt anywhere that could produce
 * a fabricated visa rule.
 * ============================================================================
 */

export const operationTier: Record<AiOperation, Tier> = defaultOperationTier;

/* -------------------------------------------------------------------------- */
/* Cost                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Estimated cost in micro-euros. Integer, so summing a million rows stays
 * exact.
 *
 * The deterministic provider costs nothing and must report nothing: an earlier
 * version fed its estimated token counts through the real price table, so a
 * deployment with no API key showed a growing euro figure on the admin cost
 * panel for calls that never left the process.
 */
function estimateCostMicros(model: string, inputTokens: number, outputTokens: number): number {
  if (model === "none") return 0;
  const rate = costPerMillionTokens[model] ?? costPerMillionTokens["claude-sonnet-5"];
  return Math.round((inputTokens / 1_000_000) * rate.input * 1_000_000 + (outputTokens / 1_000_000) * rate.output * 1_000_000);
}

/* -------------------------------------------------------------------------- */
/* Safety                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Domains a model may not author content in.
 *
 * `official` is the one that matters. Immigration, residency, visa, tax and
 * healthcare requirements come from `official_facts` rows with a source URL
 * and a checked date, and the model's only permitted role is rephrasing a row
 * that already exists. There is deliberately no prompt path that produces one.
 */
export type AiDomain = "general" | "official";

export class AiRefusedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AiRefusedError";
  }
}

/* -------------------------------------------------------------------------- */
/* Cache                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * In-process response cache.
 *
 * The hit rate here is the second-biggest cost lever after Tier 0. Most AI
 * work in this product is city-scoped rather than person-scoped — "summarise
 * tonight in Madrid" has the same answer for every student in Madrid — so the
 * cache key deliberately excludes the user id unless the operation is
 * genuinely personal.  One computation serves thousands of students.
 */
type CacheEntry = { value: unknown; expiresAt: number };

const globalForCache = globalThis as unknown as { __studentosAiCache?: Map<string, CacheEntry> };
const cache: Map<string, CacheEntry> = (globalForCache.__studentosAiCache ??= new Map());

function cacheKey(operation: AiOperation, payload: unknown, scope: string, model: string): string {
  const hash = createHash("sha256").update(JSON.stringify({ operation, payload, scope, model })).digest("hex").slice(0, 32);
  return `${operation}:${hash}`;
}

function sweepCache(now: number): void {
  if (cache.size < 2_000) return;
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

/** Test and admin hook: how many answers are being served from memory. */
export function cacheSize(): number {
  return cache.size;
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

export type CompletionRequest = {
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
  /** Ask the provider for JSON. The caller still validates what comes back. */
  json?: boolean;
};

export type CompletionResponse = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export interface AiProvider {
  readonly id: AiProviderId | "deterministic";
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

/**
 * The provider used when no API key is configured, when an admin has switched
 * model calls off, or when a spend cap has been reached.
 *
 * It does not pretend to be a model. It returns the deterministic rendering
 * the caller already computed and passed after `<<render>>` — which, because
 * retrieval already happened in Tier 0, is real data about real rows. The
 * result is a product that is fully functional without an AI vendor: slightly
 * less fluent, never wrong, never fabricated.
 *
 * It reports a model of "none", so it can never contribute to the cost panel.
 */
class DeterministicProvider implements AiProvider {
  readonly id = "deterministic" as const;

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const text = request.prompt.includes("<<render>>") ? (request.prompt.split("<<render>>")[1]?.trim() ?? "") : "";
    return { text, inputTokens: 0, outputTokens: 0 };
  }
}

/**
 * The hosted adapters. Constructed only when a key exists and a cap has not
 * been hit.
 *
 * Deliberately `fetch` against each REST API rather than a vendor SDK. The
 * surface this needs is one POST with a handful of fields, and an SDK would
 * add a dependency, a bundle and a version to keep current in exchange for
 * nothing. It also keeps the abstraction honest about being swappable: a
 * second provider is thirty lines in this shape, not a second SDK.
 */
/**
 * A refused request, described well enough to fix.
 *
 * `provider-401` is indistinguishable from `provider-500` once it has been
 * swallowed by the fallback, and the difference is the whole diagnosis: one is
 * a key that is wrong or revoked, the other is somebody else's outage. Both
 * vendors put a usable sentence in the body, so it is carried through — capped,
 * because an error message is not a place to paste a page of HTML.
 */
async function describeFailure(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  return `provider-${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`;
}

class AnthropicProvider implements AiProvider {
  readonly id = "anthropic" as const;

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = env.ai.apiKey;
    if (!apiKey) throw new AiRefusedError("provider-unavailable");

    /* A hard timeout. Without one a hung provider connection holds a server
       action open until the platform kills the whole request, and the student
       sees a spinner rather than the perfectly good Tier 0 answer we already
       have in `fallback`. */
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(providerMeta.anthropic.endpoint!, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          system: request.system,
          messages: [{ role: "user", content: request.prompt }],
        }),
      });

      if (!response.ok) throw new AiRefusedError(await describeFailure(response));

      const body = (await response.json()) as {
        content: { type: string; text?: string }[];
        usage: { input_tokens: number; output_tokens: number };
      };

      return {
        text: body.content.map((block) => (block.type === "text" ? (block.text ?? "") : "")).join("").trim(),
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

class OpenAiProvider implements AiProvider {
  readonly id = "openai" as const;

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = env.ai.apiKey;
    if (!apiKey) throw new AiRefusedError("provider-unavailable");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(env.ai.baseUrl ?? providerMeta.openai.endpoint!, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: request.model,
          max_completion_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          ...(request.json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
        }),
      });

      if (!response.ok) throw new AiRefusedError(await describeFailure(response));

      const body = (await response.json()) as {
        choices: { message: { content: string | null } }[];
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      return {
        text: (body.choices[0]?.message.content ?? "").trim(),
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function resolveProvider(config: AiRuntimeConfig): AiProvider {
  if (!config.live) return new DeterministicProvider();
  if (config.provider === "openai") return new OpenAiProvider();
  if (config.provider === "anthropic") return new AnthropicProvider();
  return new DeterministicProvider();
}

/* -------------------------------------------------------------------------- */
/* The gateway                                                                 */
/* -------------------------------------------------------------------------- */

export type GatewayCall<T> = {
  operation: AiOperation;
  /** Null for background/system work with no owning student. */
  userId: string | null;
  /** Cache scope. Use a city slug for shared work, the user id for personal. */
  scope: string;
  domain?: AiDomain;
  /** The retrieved, structured facts. Never free text from the student alone. */
  payload: unknown;
  system: string;
  /** Built from `payload`. Must contain everything the model may rely on. */
  prompt: string;
  /** Turns raw model text into the typed result the caller wants. */
  parse: (text: string) => T;
  /** Used when the model is unavailable, refuses, or returns nonsense. */
  fallback: () => T;
  /** Skip the weekly-ask quota. For system work, never for student requests. */
  skipQuota?: boolean;
  /** Ask the provider for JSON where it supports it. */
  json?: boolean;
};

export type GatewayResult<T> = {
  value: T;
  tier: Tier;
  model: string;
  cacheHit: boolean;
  /** True when the deterministic fallback produced the value. */
  degraded: boolean;
  /** Why, when it is degraded. Shown to the student as one honest line. */
  degradedReason: AiRuntimeConfig["degradedReason"] | "error" | "daily-calls" | null;
};

/**
 * Run one operation.
 *
 * Failure is never propagated to the caller as an exception unless it is a
 * quota or entitlement problem the UI must handle. A model timeout falls back
 * to the deterministic result, because every AI surface in this product is
 * built on top of a Tier 0 answer that is already correct — the model was only
 * making it read better.
 */
export async function runAi<T>(call: GatewayCall<T>): Promise<GatewayResult<T>> {
  const started = Date.now();

  if (call.domain === "official") {
    throw new AiRefusedError("Official requirements are served from verified sources, never generated.");
  }

  const [plan, config] = await Promise.all([
    call.userId ? planFor(call.userId) : Promise.resolve<PlanKey>("free"),
    aiConfig(),
  ]);

  const tier = operationTier[call.operation];
  /* Tier 3 is Max-only; anyone below is demoted rather than refused. A
     slightly less thorough answer beats an error. */
  const effectiveTier: Tier = tier === 3 && plan !== "max" ? 2 : tier;
  const model = config.live && effectiveTier > 0 ? config.models[effectiveTier as 1 | 2 | 3] : "none";

  /* ---- cache ------------------------------------------------------------ */
  const ttl = cacheTtlMs[call.operation];
  const key = cacheKey(call.operation, call.payload, call.scope, model);
  const now = Date.now();
  sweepCache(now);

  if (ttl > 0) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
      await logUsage({
        userId: call.userId,
        operation: call.operation,
        tier: effectiveTier,
        model,
        inputTokens: 0,
        outputTokens: 0,
        costMicros: 0,
        cacheHit: true,
        latencyMs: Date.now() - started,
        plan,
      });
      return { value: hit.value as T, tier: effectiveTier, model, cacheHit: true, degraded: false, degradedReason: null };
    }
  }

  /* ---- degraded: no model will be called -------------------------------- */
  if (!config.live || effectiveTier === 0) {
    const value = call.fallback();
    await logUsage({
      userId: call.userId,
      operation: call.operation,
      tier: 0,
      model: "none",
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
      cacheHit: false,
      latencyMs: Date.now() - started,
      plan,
    });
    return { value, tier: 0, model: "none", cacheHit: false, degraded: true, degradedReason: config.degradedReason };
  }

  /* ---- quota -------------------------------------------------------------
     Checked only for student-initiated work, and only when a model will
     actually be called. Cache hits above never consume an ask, which is what
     makes a shared city summary free to the tenth student who opens it. */
  if (call.userId && !call.skipQuota) {
    await assertQuota(call.userId, "aiAsksPerWeek");

    /* A second ceiling under the weekly allowance: a per-user daily cap, so a
       single account cannot burn a week's worth of the global budget in an
       afternoon. Hitting it degrades rather than errors. */
    const dailyCallCeiling = config.perPlanDailyCalls[plan];
    if (dailyCallCeiling > 0 && (await callsToday(call.userId)) >= dailyCallCeiling) {
      const value = call.fallback();
      await logUsage({
        userId: call.userId,
        operation: call.operation,
        tier: 0,
        model: "none",
        inputTokens: 0,
        outputTokens: 0,
        costMicros: 0,
        cacheHit: false,
        latencyMs: Date.now() - started,
        plan,
      });
      return { value, tier: 0, model: "none", cacheHit: false, degraded: true, degradedReason: "daily-calls" };
    }
  }

  /* ---- call ------------------------------------------------------------- */
  const limits = tierLimits[effectiveTier];
  const provider = resolveProvider(config);

  let value: T;
  let degraded = false;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await provider.complete({
      model,
      system: call.system,
      /* Hard truncation rather than a soft warning: an oversized prompt is a
         bug somewhere upstream, and paying for it silently hides the bug. */
      prompt: call.prompt.slice(0, limits.maxInputTokens * 4),
      maxOutputTokens: config.maxOutputTokens[effectiveTier],
      temperature: config.temperature,
      json: call.json,
    });

    inputTokens = response.inputTokens;
    outputTokens = response.outputTokens;
    value = call.parse(response.text);
  } catch (error) {
    /* The student still gets the Tier 0 answer, which is correct — but a
       provider that is failing every call must not be invisible. Without this,
       a revoked key and a healthy deployment look identical from the outside:
       every surface simply reads a little plainer, forever. */
    captureError(error, { area: "ai", operation: call.operation, provider: provider.id, model });
    value = call.fallback();
    degraded = true;
  }

  if (ttl > 0 && !degraded) {
    cache.set(key, { value, expiresAt: Date.now() + ttl });
  }

  await logUsage({
    userId: call.userId,
    operation: call.operation,
    tier: degraded ? 0 : effectiveTier,
    model: degraded ? "none" : model,
    inputTokens,
    outputTokens,
    costMicros: degraded ? 0 : estimateCostMicros(model, inputTokens, outputTokens),
    cacheHit: false,
    latencyMs: Date.now() - started,
    plan,
  });

  return {
    value,
    tier: degraded ? 0 : effectiveTier,
    model: degraded ? "none" : model,
    cacheHit: false,
    degraded,
    degradedReason: degraded ? "error" : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Tier 0                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Record that an answer was produced with no model at all.
 *
 * Worth logging precisely because it is free: the admin cost view is only
 * meaningful next to a count of the work that cost nothing, and "94% of asks
 * were Tier 0" is the single number that says whether the architecture is
 * holding.
 */
export async function logTierZero(input: { userId: string | null; operation: AiOperation; latencyMs: number }): Promise<void> {
  const plan: PlanKey = input.userId ? await planFor(input.userId) : "free";
  await logUsage({
    userId: input.userId,
    operation: input.operation,
    tier: 0,
    model: "none",
    inputTokens: 0,
    outputTokens: 0,
    costMicros: 0,
    cacheHit: false,
    latencyMs: input.latencyMs,
    plan,
  });
}

async function logUsage(row: {
  userId: string | null;
  operation: AiOperation;
  tier: Tier;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  cacheHit: boolean;
  latencyMs: number;
  plan: PlanKey;
}): Promise<void> {
  await insert("aiUsage", { id: newId(), createdAt: nowIso(), ...row });
}

/* -------------------------------------------------------------------------- */
/* Shared system prompt                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The constitution every call inherits.
 *
 * The negative instructions are the important half. A model asked to be
 * helpful about a city will happily invent a plausible café, and a plausible
 * café that does not exist is worse than no answer — it is the failure that
 * makes a student stop trusting every other recommendation on the screen.
 */
export const BASE_SYSTEM = [
  "You help students who live in or are moving to a city.",
  "",
  "You are given retrieved rows: places, events, deals, prices, budget figures.",
  "Use ONLY those rows. Select, order and explain them.",
  "",
  "Never invent a place, an event, a price, a deal or an opening time.",
  "Never state a legal, visa, immigration, tax or healthcare requirement.",
  "If the rows do not answer the question, say what is missing.",
  "",
  "Voice: short sentences. State the number. Never lecture about money;",
  "offer the cheaper option instead. No hype, no emoji, no exclamation marks.",
].join("\n");

/** Extra instruction for calls that must come back as JSON. */
export const JSON_SYSTEM = [
  BASE_SYSTEM,
  "",
  "Reply with a single JSON object and nothing else. No prose, no code fence.",
].join("\n");

/**
 * Parse a JSON reply defensively. Providers wrap JSON in fences often enough
 * that stripping them is cheaper than a retry, and a failed parse must fall
 * through to the caller's deterministic answer rather than throw.
 */
export function parseJson<T>(text: string, guard: (value: unknown) => value is T): T | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value: unknown = JSON.parse(cleaned);
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}
