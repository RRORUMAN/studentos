import "server-only";

import { createHash } from "node:crypto";

import type { PlanKey } from "@/config/pricing";
import type { AiOperation } from "@/domain/types";
import { insert, newId, nowIso } from "@/server/db";
import { assertQuota, planFor } from "@/server/entitlements";
import { env, isAiConfigured } from "@/services/env";

/**
 * ============================================================================
 * AI GATEWAY
 * ----------------------------------------------------------------------------
 * The single door every model call goes through. Nothing in the product calls
 * a provider directly, and that is enforced by convention plus the fact that
 * no provider SDK is imported anywhere else.
 *
 * The gateway owns six decisions that must not be scattered:
 *
 *   ROUTING     which tier, and therefore which model (or none at all)
 *   CACHE       whether an identical question was already answered
 *   QUOTA       whether this student has asks left this week
 *   BUDGET      a hard per-call token ceiling, per tier
 *   LOGGING     one usage row per call, with an estimated cost
 *   SAFETY      which domains a model may not author at all
 *
 * ---------------------------------------------------------------------------
 * THE ROUTING LADDER — this is the margin
 *
 * Tier 0  NO MODEL. Budget arithmetic, nearby search, feed ranking, free-event
 *         filtering, recommendation scoring, deal sorting, trending, map
 *         filters. All of it is SQL and array work in `src/server/engines`.
 *         The overwhelming majority of what feels intelligent in this product
 *         is Tier 0, and that is the entire reason the free tier is
 *         affordable: a thousand students loading Home costs nothing.
 *
 * Tier 1  SMALL MODEL. Classification, tagging, query parsing, one-line
 *         explanations, short summaries. Cheap, fast, and heavily cached.
 *
 * Tier 2  MID MODEL. Weekend planning, Survival Mode narration, budget
 *         optimisation, complex recommendation write-ups.
 *
 * Tier 3  STRONG MODEL. Rare, Max-only, deep multi-day planning.
 *
 * A feature that could be Tier 0 and is not is a bug, not a design choice.
 *
 * ---------------------------------------------------------------------------
 * WHAT A MODEL IS NEVER ALLOWED TO DO
 *
 * Invent a place, an event, a price, a deal, an opening hour, or — above all —
 * a legal or immigration requirement. Retrieval happens first, in Tier 0 code;
 * the model receives real rows and its job is selection, ordering and
 * explanation. `guard.refuseAuthoring` enforces the hard case: any call
 * touching the `official` domain is rejected before a request is built, so
 * there is no prompt anywhere that could produce a fabricated visa rule.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Routing table                                                               */
/* -------------------------------------------------------------------------- */

export type Tier = 0 | 1 | 2 | 3;

/**
 * Operation to tier. Every operation the product performs is named here, so
 * adding a model call means adding a row to this table — which is exactly the
 * review checkpoint the cost discipline needs.
 */
export const operationTier: Record<AiOperation, Tier> = {
  /* Intent classification for search misses. Small and constantly cached. */
  classify: 1,
  /* Receipt line extraction. Structured output from an image or text blob. */
  extract: 1,
  /* Channel catch-up. Summarising real messages, never adding to them. */
  summarize: 1,
  /* Explaining why the deterministic scorer picked what it picked. */
  recommend: 1,
  /* Weekend and weekly plans, built from retrieved candidates. */
  plan: 2,
  /* Budget coaching against real transaction rows. */
  budget: 2,
  /* Community moderation triage. */
  moderate: 1,
};

/** Per-tier ceilings. A runaway prompt is capped before it is sent, not after. */
const TIER_LIMITS: Record<Tier, { maxInputTokens: number; maxOutputTokens: number }> = {
  0: { maxInputTokens: 0, maxOutputTokens: 0 },
  1: { maxInputTokens: 2_000, maxOutputTokens: 400 },
  2: { maxInputTokens: 8_000, maxOutputTokens: 1_200 },
  3: { maxInputTokens: 24_000, maxOutputTokens: 3_000 },
};

/**
 * Model selection per tier, resolved from configuration.
 *
 * The strong tier is gated on plan as well as operation: a Tier 2 operation
 * requested by a Max user may be promoted, and a Tier 3 operation requested by
 * anyone below Max is demoted rather than refused. Demotion beats refusal here
 * — a slightly less thorough plan is a far better outcome than an error.
 */
function modelFor(tier: Tier, plan: PlanKey): string {
  if (tier === 0) return "none";
  const configured = env.ai.model;
  if (configured) return configured;

  /* Sensible defaults when only a key is set. Named rather than inferred so a
     deployment cannot silently end up on an expensive model. */
  if (tier === 1) return "claude-haiku-4-5-20251001";
  if (tier === 2) return "claude-sonnet-5";
  return plan === "max" ? "claude-opus-5" : "claude-sonnet-5";
}

/** Rough per-million-token euro cost, for the admin cost view. */
const COST_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.9, output: 4.5 },
  "claude-sonnet-5": { input: 2.7, output: 13.5 },
  "claude-opus-5": { input: 13.5, output: 67.5 },
  none: { input: 0, output: 0 },
};

function estimateCostMicros(model: string, inputTokens: number, outputTokens: number): number {
  const rate = COST_PER_MTOK[model] ?? COST_PER_MTOK["claude-sonnet-5"];
  /* Micro-euros, integer, so a million summed rows stay exact. */
  return Math.round(
    (inputTokens / 1_000_000) * rate.input * 1_000_000 +
      (outputTokens / 1_000_000) * rate.output * 1_000_000,
  );
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
 * genuinely personal. One computation serves thousands of students.
 */
type CacheEntry = { value: unknown; expiresAt: number };

const globalForCache = globalThis as unknown as { __studentosAiCache?: Map<string, CacheEntry> };
const cache: Map<string, CacheEntry> = (globalForCache.__studentosAiCache ??= new Map());

const CACHE_TTL_MS: Record<AiOperation, number> = {
  classify: 24 * 3_600_000,
  extract: 0, // per-receipt; never reusable
  summarize: 15 * 60_000,
  recommend: 30 * 60_000,
  plan: 10 * 60_000,
  budget: 0, // personal and time-sensitive
  moderate: 6 * 3_600_000,
};

function cacheKey(operation: AiOperation, payload: unknown, scope: string): string {
  const hash = createHash("sha256")
    .update(JSON.stringify({ operation, payload, scope }))
    .digest("hex")
    .slice(0, 32);
  return `${operation}:${hash}`;
}

function sweepCache(now: number): void {
  if (cache.size < 2_000) return;
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

export type CompletionRequest = {
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
};

export type CompletionResponse = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export interface AiProvider {
  readonly id: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

/**
 * The provider used when no API key is configured.
 *
 * It does not pretend to be a model. It returns a deterministic rendering of
 * the *structured input it was given* — which, because retrieval already
 * happened in Tier 0, is real data about real rows. The result is a product
 * that is fully functional without an AI vendor: slightly less fluent, never
 * wrong, and never fabricated.
 *
 * This is also what the test suite runs against, so assertions about AI
 * surfaces are stable.
 */
class DeterministicProvider implements AiProvider {
  readonly id = "deterministic";

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    /* The prompt already carries the structured facts as JSON; echo the
       human-readable part rather than inventing prose around it. */
    const text = request.prompt.includes("<<render>>")
      ? request.prompt.split("<<render>>")[1]?.trim() ?? ""
      : "";

    return {
      text,
      inputTokens: Math.ceil(request.prompt.length / 4),
      outputTokens: Math.ceil(text.length / 4),
    };
  }
}

/**
 * The hosted adapter. Constructed only when a key exists.
 *
 * Deliberately `fetch` against the REST API rather than a vendor SDK. The
 * Messages API surface this needs is one POST with four fields, and an SDK
 * would add a dependency, a bundle, and a version to keep current in exchange
 * for nothing. It also keeps the adapter honest about being swappable: another
 * provider is another twenty lines in this shape, not a second SDK.
 */
class HostedProvider implements AiProvider {
  readonly id = env.ai.provider ?? "anthropic";

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
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxOutputTokens,
          system: request.system,
          messages: [{ role: "user", content: request.prompt }],
        }),
      });

      if (!response.ok) throw new AiRefusedError(`provider-${response.status}`);

      const body = (await response.json()) as {
        content: { type: string; text?: string }[];
        usage: { input_tokens: number; output_tokens: number };
      };

      return {
        text: body.content
          .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
          .join("")
          .trim(),
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function resolveProvider(): AiProvider {
  return isAiConfigured ? new HostedProvider() : new DeterministicProvider();
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
};

export type GatewayResult<T> = {
  value: T;
  tier: Tier;
  model: string;
  cacheHit: boolean;
  /** True when the deterministic fallback produced the value. */
  degraded: boolean;
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
    throw new AiRefusedError(
      "Official requirements are served from verified sources, never generated.",
    );
  }

  const plan: PlanKey = call.userId ? await planFor(call.userId) : "free";
  const tier = operationTier[call.operation];
  const model = modelFor(tier, plan);

  /* ---- cache ------------------------------------------------------------ */
  const ttl = CACHE_TTL_MS[call.operation];
  const key = cacheKey(call.operation, call.payload, call.scope);
  const now = Date.now();
  sweepCache(now);

  if (ttl > 0) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
      await logUsage({
        userId: call.userId,
        operation: call.operation,
        tier,
        model,
        inputTokens: 0,
        outputTokens: 0,
        costMicros: 0,
        cacheHit: true,
        latencyMs: Date.now() - started,
        plan,
      });
      return { value: hit.value as T, tier, model, cacheHit: true, degraded: false };
    }
  }

  /* ---- quota ------------------------------------------------------------
     Checked only for student-initiated work, and only when a model will
     actually be called. Cache hits above never consume an ask, which is what
     makes a shared city summary free to the tenth student who opens it. */
  if (call.userId && !call.skipQuota && tier > 0) {
    await assertQuota(call.userId, "aiAsksPerWeek");
  }

  /* ---- call ------------------------------------------------------------- */
  const limits = TIER_LIMITS[tier];
  const provider = resolveProvider();

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
      maxOutputTokens: limits.maxOutputTokens,
    });

    inputTokens = response.inputTokens;
    outputTokens = response.outputTokens;

    const parsed = call.parse(response.text);
    value = parsed;
  } catch {
    value = call.fallback();
    degraded = true;
  }

  if (ttl > 0 && !degraded) {
    cache.set(key, { value, expiresAt: Date.now() + ttl });
  }

  await logUsage({
    userId: call.userId,
    operation: call.operation,
    tier,
    model,
    inputTokens,
    outputTokens,
    costMicros: estimateCostMicros(model, inputTokens, outputTokens),
    cacheHit: false,
    latencyMs: Date.now() - started,
    plan,
  });

  return { value, tier, model, cacheHit: false, degraded };
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
export async function logTierZero(input: {
  userId: string | null;
  operation: AiOperation;
  latencyMs: number;
}): Promise<void> {
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
