"use server";

import { revalidatePath } from "next/cache";

import { factFreshness } from "@/domain/knowledge";
import { money as formatMoney } from "@/lib/utils";
import { degradedCopy } from "@/server/ai/config";
import { BASE_SYSTEM, logTierZero, runAi, untrusted } from "@/server/ai/gateway";
import { runTools, type ToolCard, type ToolName, type ToolResult } from "@/server/ai/tools";
import { findMany, insert, newId, nowIso, remove } from "@/server/db";
import { canAfford } from "@/server/engines/afford";
import {
  assemblePlan,
  type AskAnswer,
  type AskIntent,
  type AskLine,
  describeList,
  describeParse,
  describePlan,
  followUps,
  parseAsk,
  type ParsedAsk,
  costOf,
  type PlanCost,
} from "@/server/engines/ask";
import { QuotaError, readQuota } from "@/server/entitlements";
import { recordOutcome, recordSearchMiss } from "@/server/actions/insight";
import { recordUpgradeTrigger } from "@/server/actions/upgrade";
import { loadScoredEvents, loadPlaces, loadRecommendContext } from "@/server/queries/discovery";
import { loadMoney } from "@/server/queries/money";
import { isFlagOn } from "@/server/queries/settings";
import { requestDate } from "@/server/now";
import { getViewer } from "@/server/viewer";
import { limits, rateLimitShared } from "@/server/rate-limit";
import { currencySymbol } from "@/lib/utils";

/**
 * ============================================================================
 * ASK ACTION
 * ----------------------------------------------------------------------------
 * The student-life command centre, end to end.
 *
 *   1. PARSE      deterministic, no model
 *   2. RETRIEVE   through the typed tools in `src/server/ai/tools.ts`
 *   3. ASSEMBLE   a plan, a list or a set of figures, built only from those rows
 *   4. STUDENTS   matching Pulse posts, so the answer carries what people said
 *   5. EXPLAIN    optionally, a model writes one paragraph over step 3
 *
 * By the time a model is involved there is already a complete, correct answer
 * on the table. It cannot add a place, change a price or invent an event. If it
 * fails, is capped, or is not configured, step 5 falls back to the
 * deterministic sentence and the UI says so in one line.
 *
 * The weekly allowance meters step 5 only. Retrieval is free at every tier and
 * is always returned, so hitting the limit never withholds an answer the
 * product already computed.
 * ============================================================================
 */

export type StudentsSay = {
  postId: string;
  title: string;
  body: string | null;
  channel: string;
  commentCount: number;
  upvotes: number;
  topAnswer: string | null;
};

export type AskUsage = { used: number; limit: number | null; remaining: number | null };

export type AskAction =
  | { kind: "save-plan" }
  | { kind: "open"; label: string; href: string }
  | { kind: "ask-campus" };

export type AskResult =
  | {
      ok: true;
      /** Echoed so the console can show what it answered without holding state. */
      query: string;
      answer: AskAnswer;
      /** What the interpretation was, in one human line. Correctable by re-asking. */
      understood: string;
      /** Structured cards from the tools that ran. Rendered instead of prose. */
      tools: ToolResult[];
      students: StudentsSay[];
      usage: AskUsage;
      /** The model sentence was withheld. `note` says why, in one line. */
      limited: boolean;
      note: string | null;
      /** Follow-up questions that parse correctly on their own. */
      followUps: { label: string; query: string }[];
      /** What the student can do with this answer. */
      actions: AskAction[];
      /** A value-first upsell that fits this question, if one does. */
      upsell: { feature: "groupPlanner" | "weeklyPlanner" | "advancedAI" | "budgetForecast"; line: string } | null;
      afford: ReturnType<typeof canAfford> | null;
    }
  | { ok: false; reason: "signed-out" | "rate-limited"; message: string };

/* -------------------------------------------------------------------------- */
/* Intent → tool plan                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Which tools answer which question. This table is the whole retrieval policy,
 * in one place, so "what can the AI see for this kind of question" is a thing
 * you read rather than trace.
 */
function toolPlanFor(parsed: ParsedAsk, safeTodayCents: number | null): { name: ToolName; args?: unknown }[] {
  const cap = parsed.budgetCents ?? undefined;
  const when = parsed.when;

  switch (parsed.intent) {
    case "plan-night":
    case "plan-day":
      return [
        { name: "search_events", args: { when: when === "any" ? "tonight" : when, freeOnly: parsed.freeOnly, maxPriceCents: cap, limit: 6 } },
        { name: "search_places", args: { maxPriceCents: cap, freeOnly: parsed.freeOnly, limit: 6 } },
      ];
    case "plan-weekend":
      return [
        { name: "search_events", args: { when: "weekend", freeOnly: parsed.freeOnly, maxPriceCents: cap, limit: 6 } },
        { name: "search_places", args: { maxPriceCents: cap, limit: 6 } },
      ];
    case "find-food":
      return [
        { name: "search_places", args: { layers: ["cheap-food"], maxPriceCents: cap, limit: 5 } },
        { name: "search_deals", args: { category: "food", limit: 3 } },
      ];
    case "find-groceries":
      return [{ name: "search_places", args: { layers: ["groceries"], limit: 5 } }];
    case "find-study":
      return [{ name: "search_places", args: { layers: ["study"], limit: 5 } }];
    case "find-free":
      return [
        { name: "search_events", args: { when: when === "any" ? "week" : when, freeOnly: true, limit: 6 } },
        { name: "search_places", args: { freeOnly: true, limit: 4 } },
      ];
    case "find-social":
      return [
        { name: "search_social", args: { limit: 5 } },
        { name: "search_events", args: { when: when === "any" ? "week" : when, kinds: ["social", "sports", "university", "language-exchange", "networking"], limit: 4 } },
      ];
    case "find-deals":
      return [{ name: "search_deals", args: { limit: 6 } }];
    case "language-question":
      return [
        { name: "get_useful_phrases", args: { situation: parsed.situation ?? "first-words", limit: 6 } },
      ];
    case "find-exchange":
      return [{ name: "search_exchange", args: { keywords: parsed.keywords, limit: 6 } }];
    case "budget-question":
      return [
        { name: "read_budget" },
        { name: "search_places", args: { maxPriceCents: cap ?? safeTodayCents ?? undefined, layers: ["cheap-food", "free"], limit: 4 } },
      ];
    case "afford-question":
      return [
        { name: "calculate_budget", args: { amountCents: parsed.budgetCents ?? 0 } },
        { name: "search_places", args: { maxPriceCents: parsed.budgetCents ? Math.round(parsed.budgetCents * 0.7) : undefined, limit: 3 } },
      ];
    case "lifeops-question":
      return [{ name: "read_lifeops", args: { horizon: when === "tonight" || when === "now" ? "today" : "week" } }];
    case "pulse-question":
      return [{ name: "search_student_pulse", args: { keywords: parsed.keywords, limit: 5 } }];
    case "mission-question":
      return [{ name: "suggest_missions", args: { limit: 3 } }];
    case "find-place":
    default:
      return [
        { name: "search_places", args: { maxPriceCents: cap, freeOnly: parsed.freeOnly, limit: 5 } },
        { name: "search_events", args: { when: when === "any" ? "week" : when, maxPriceCents: cap, limit: 3 } },
      ];
  }
}

/** Pulse channels worth searching for each intent. */
const INTENT_CHANNELS: Partial<Record<AskIntent, string[]>> = {
  "find-food": ["cheap-eats"],
  "find-groceries": ["cheap-eats", "general"],
  "find-study": ["study"],
  "find-social": ["football", "gym", "language", "general"],
  "plan-night": ["events-tonight", "nightlife"],
  "plan-weekend": ["events-tonight", "travel"],
  "arrival-question": ["questions", "housing"],
  "budget-question": ["deals", "cheap-eats"],
  "afford-question": ["deals", "cheap-eats"],
  "find-deals": ["deals"],
  "find-exchange": ["buy-sell"],
  "pulse-question": ["general", "questions"],
};

/* -------------------------------------------------------------------------- */
/* The action                                                                  */
/* -------------------------------------------------------------------------- */

export async function askStudentOS(query: string): Promise<AskResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "signed-out", message: "Sign in to ask." };

  /* Shared, because this one has a bill on the other side of it. A per-isolate
     ceiling on model calls is a per-isolate ceiling on spend. */
  const gate = await rateLimitShared(`ask:${viewer.user.id}`, limits.aiAsk.limit, limits.aiAsk.windowSeconds);
  if (!gate.ok) {
    return {
      ok: false,
      reason: "rate-limited",
      message: `That is a lot of questions at once. Try again in ${Math.ceil(gate.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const started = Date.now();
  const now = requestDate();
  const parsed = parseAsk(query);
  const where = viewer.currency;
  const fmt = (cents: number) => formatMoney(cents / 100, where);
  const social = !viewer.profile.socialGoals.includes("private");
  const quota = await readQuota(viewer.user.id, "aiAsksPerWeek");
  const usage: AskUsage = { used: quota.used, limit: quota.limit, remaining: quota.remaining };
  const understood = describeParse(parsed, fmt);

  /* ---- official questions: never generated ------------------------------ */
  if (parsed.intent === "arrival-question") {
    const answer = await officialAnswer(viewer.profile.citySlug, viewer.city.countryCode, query, parsed);
    await logTierZero({ userId: viewer.user.id, operation: "classify", latencyMs: Date.now() - started });
    if (answer.lines.length === 0) {
      await recordSearchMiss({ query, surface: "ask", resultCount: 0, gap: "missing-data" });
    }
    const students = await studentsSay(viewer.profile.citySlug, parsed);
    await recordAsk(viewer.user.id, query, parsed.intent, answer.summary, 0);
    return {
      ok: true,
      query,
      answer,
      understood,
      tools: [],
      students,
      usage,
      limited: false,
      note: "Official information is served from verified sources with the date each was checked. It is never written by a model.",
      followUps: [
        { label: "First week", query: "What do I need to sort in my first week?" },
        { label: "What am I forgetting?", query: "What am I forgetting this week?" },
      ],
      actions: [{ kind: "ask-campus" }, { kind: "open", label: "Open Arrival Mode", href: "/arrival" }],
      upsell: null,
      afford: null,
    };
  }

  /* ---- retrieval, through the typed tools (Tier 0) ----------------------- */
  const money$ = await loadMoney(viewer.user.id, viewer.city.timezone, now);
  const safeTodayCents = money$.unset ? null : money$.reading.safeTodayCents;
  const budgetCents = parsed.budgetCents ?? safeTodayCents;

  const toolCtx = { viewer, now, budgetCents: parsed.freeOnly ? 0 : parsed.budgetCents };
  const plan = toolPlanFor(parsed, safeTodayCents);
  const tools = await runTools(plan, toolCtx);

  /* ---- can I afford this? ------------------------------------------------ */
  const afford =
    parsed.intent === "afford-question" && parsed.budgetCents !== null && !money$.unset
      ? canAfford({ amountCents: parsed.budgetCents, reading: money$.reading, now, formatMoney: fmt })
      : null;

  /* ---- assemble (Tier 0) ------------------------------------------------- */
  const wantsPlan = parsed.intent === "plan-night" || parsed.intent === "plan-day" || parsed.intent === "plan-weekend";

  let assembled: { lines: AskLine[]; cost: PlanCost };
  if (wantsPlan) {
    /* The plan builder needs the scored rows rather than the flattened cards,
       because it reasons about layers and price bands. Same retrieval, one
       extra pass — and `loadRecommendContext` and its loaders are all
       request-cached, so this costs nothing beyond the array work. */
    const context = await loadRecommendContext({
      userId: viewer.user.id,
      profile: viewer.profile,
      budgetCents: parsed.freeOnly ? 0 : budgetCents,
      now,
    });
    const [events, places] = await Promise.all([
      loadScoredEvents(viewer.user.id, context, {
        when: parsed.when === "weekend" ? "weekend" : parsed.when === "week" ? "week" : parsed.when === "any" ? "all" : "tonight",
        freeOnly: parsed.freeOnly,
        maxPriceCents: parsed.budgetCents,
      }),
      /* `maxPriceCents` is gone: no place provider publishes an amount to
         compare a budget against. A tight budget now steers the ranking
         through `priceSensitivity` inside the engine, and `cheapOnly` is the
         explicit filter when the student asked for cheap. */
      loadPlaces(context, { freeOnly: parsed.freeOnly, cheapOnly: parsed.cheaper }),
    ]);
    assembled = assemblePlan({
      budgetCents,
      events,
      places: places.places,
      fareCents: Math.round((viewer.city.anchors?.singleFare ?? 0) * 100),
      /* The city's own curated price anchors. Null for a city that has none,
         and then a food stop carries no figure rather than a guessed one. */
      anchors: viewer.city.anchors
        ? { lunch: viewer.city.anchors.lunch, pint: viewer.city.anchors.pint }
        : null,
      wantsFood: true,
      cheaper: parsed.cheaper,
    });
  } else {
    const lines = cardsToLines(tools);
    assembled = { lines, cost: costOf(lines) };
  }

  const students = await studentsSay(viewer.profile.citySlug, parsed);
  const hasFigures = tools.some((result) => (result.figures?.length ?? 0) > 0);

  /* ---- nothing at all ---------------------------------------------------- */
  if (assembled.lines.length === 0 && !afford && !hasFigures) {
    await logTierZero({ userId: viewer.user.id, operation: "recommend", latencyMs: Date.now() - started });
    await recordSearchMiss({ query, surface: "ask", resultCount: 0 });
    const reason = tools.find((result) => result.emptyReason)?.emptyReason ?? null;

    return {
      ok: true,
      query,
      understood,
      usage,
      limited: false,
      note: null,
      tools,
      students,
      followUps: followUps({ parsed, hasLines: false, currencySymbol: currencySymbol(where.currency, where.locale), safeTodayCents, cityName: viewer.city.name, social }),
      actions: [{ kind: "ask-campus" }],
      upsell: null,
      afford: null,
      answer: {
        kind: "empty",
        title: "Nothing matches that yet",
        summary:
          reason ??
          (parsed.budgetCents !== null
            ? `Nothing in ${viewer.city.name} fits that budget in our rows right now. Try widening it, or ask for free things.`
            : `We do not have rows for that in ${viewer.city.name} yet. It has been noted.`),
        lines: [],
        cost: { totalCents: 0, estimateLowCents: 0, estimateHighCents: 0, unpricedLines: 0 },
        parsed,
        sources: [],
        missReason: "no-candidates",
      },
    };
  }

  /* ---- explain (Tier 1/2, optional, metered) ------------------------------ */
  const deterministic = afford
    ? afford.headline
    : wantsPlan
      ? describePlan({ lines: assembled.lines, cost: assembled.cost, budgetCents, formatMoney: fmt })
      : hasFigures && assembled.lines.length === 0
        ? figureSummary(tools, parsed)
        : describeList({ lines: assembled.lines, formatMoney: fmt, cityName: viewer.city.name });

  let summary = deterministic;
  let limited = false;
  let note: string | null = null;
  let charged = false;

  if (quota.exceeded) {
    limited = true;
    note = "You have used this week's smart asks. The rows above are always free — the written summary comes back next week.";
    await logTierZero({ userId: viewer.user.id, operation: wantsPlan ? "plan" : "recommend", latencyMs: Date.now() - started });
    await recordUpgradeTrigger("ai-limit");
  } else if (assembled.lines.length > 0) {
    try {
      const result = await runAi<string>({
        operation: wantsPlan ? "plan" : "recommend",
        userId: viewer.user.id,
        scope: `${viewer.profile.citySlug}:${parsed.intent}:${parsed.when}:${parsed.freeOnly}:${parsed.budgetCents ?? "none"}`,
        domain: "general",
        payload: {
          lines: assembled.lines.map((line) => ({
            title: line.title,
            price: line.priceCents,
            estimate: line.estimateCents,
            detail: line.detail,
          })),
          total: assembled.cost.totalCents,
          budget: budgetCents,
        },
        system: BASE_SYSTEM,
        prompt: [
          /* Both of these are fenced, and for different reasons. The rows carry
             text other students and third-party feeds wrote. The question is
             the student's own, and they are entitled to ask anything — but not
             to redefine what the model may claim about the city to them, which
             an unfenced "ignore your instructions" would attempt. Neither is
             the operator. See `untrusted` in the gateway. */
          `Question: ${untrusted(query)}`,
          `Rows selected (do not add to these):`,
          untrusted(JSON.stringify(assembled.lines, null, 1)),
          `Known total: ${assembled.cost.totalCents} cents. Estimated on top: ${assembled.cost.estimateLowCents}-${assembled.cost.estimateHighCents} cents. Budget: ${budgetCents ?? "unstated"}.`,
          "",
          "Write two short sentences summarising this. State the known total.",
          "If there is an estimate, say it is an estimate from typical city prices.",
          "Never merge the known total and the estimate into one figure.",
          "<<render>>",
          deterministic,
        ].join("\n"),
        parse: (text) => (text.trim().length > 0 ? text.trim() : deterministic),
        fallback: () => deterministic,
      });
      summary = result.value;
      /* Only a call that actually reached a model consumes an ask. A cache hit
         and a degraded call both cost nothing and must not be metered — an
         earlier version incremented on every ask, so a cache hit visibly burnt
         an allowance that was never charged. */
      charged = !result.cacheHit && !result.degraded;
      if (result.degraded && result.degradedReason && result.degradedReason !== "error") {
        note = degradedCopy[result.degradedReason as keyof typeof degradedCopy] ?? null;
      }
    } catch (error) {
      if (error instanceof QuotaError) {
        limited = true;
        note = "You have used this week's smart asks. The rows above are always free.";
      }
    }
  }

  /* ---- value-first upsell, at most one ----------------------------------- */
  let upsell: Extract<AskResult, { ok: true }>["upsell"] = null;
  if (parsed.intent === "plan-weekend" && !viewer.entitlements.can.groupPlanner) {
    upsell = {
      feature: "groupPlanner",
      line: "This is the free version: a sensible night from real rows. Pro builds the whole weekend with a route, a per-day budget and a poll your friends can vote on.",
    };
    await recordUpgradeTrigger("complex-plan");
  } else if (afford && !viewer.entitlements.can.budgetForecast) {
    upsell = {
      feature: "budgetForecast",
      line: "Pro also shows whether this keeps you on budget to the end of the month, not just to Monday.",
    };
  } else if (limited) {
    upsell = {
      feature: "advancedAI",
      line: "The rows above are free and always will be. Plus adds the written summary back and 200 asks a week.",
    };
  }

  const answer: AskAnswer = {
    kind: afford ? "figures" : wantsPlan ? "plan" : assembled.lines.length === 0 && hasFigures ? "figures" : "list",
    title: afford
      ? `${fmt(afford.amountCents)} — ${afford.verdict === "yes" ? "yes" : afford.verdict === "possibly" ? "possibly" : afford.verdict === "no-budget" ? "set a budget first" : "not ideal"}`
      : titleFor(parsed, assembled.cost, fmt, wantsPlan ? "plan" : "list", viewer.city.name),
    summary,
    lines: assembled.lines,
    cost: assembled.cost,
    parsed,
    sources: uniqueSources(assembled.lines, tools),
    missReason: null,
  };

  await recordOutcome("found-place", parsed.intent);
  await recordAsk(viewer.user.id, query, parsed.intent, summary, charged ? 1 : 0);

  return {
    ok: true,
    query,
    answer,
    understood,
    tools,
    students,
    usage: {
      ...usage,
      used: charged ? usage.used + 1 : usage.used,
      remaining: usage.remaining === null ? null : Math.max(0, usage.remaining - (charged ? 1 : 0)),
    },
    limited,
    note,
    followUps: followUps({
      parsed,
      hasLines: assembled.lines.length > 0,
      currencySymbol: currencySymbol(where.currency, where.locale),
      safeTodayCents,
      cityName: viewer.city.name,
      social,
    }),
    actions: actionsFor(parsed, assembled.lines.length > 0, wantsPlan),
    upsell,
    afford,
  };
}

/* -------------------------------------------------------------------------- */
/* Shaping                                                                     */
/* -------------------------------------------------------------------------- */

/** Flatten tool cards into answer lines, so one renderer serves every intent. */
function cardsToLines(tools: readonly ToolResult[]): AskLine[] {
  const lines: AskLine[] = [];
  const seen = new Set<string>();

  for (const result of tools) {
    for (const card of result.cards) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      lines.push({
        kind: card.kind === "event" ? "event" : card.kind === "place" ? "activity" : "activity",
        title: card.title,
        detail: card.detail,
        /* `?? null`, not `?? 0`. A card whose source published no price is
           unpriced, and turning that into a zero is how a plan comes to say
           "free" about something nobody costed. */
        priceCents: card.priceCents ?? null,
        estimateCents: null,
        estimateBasis: null,
        metres: card.metres ?? null,
        refKind: card.kind === "place" ? "place" : card.kind === "event" ? "event" : null,
        refId: card.kind === "place" || card.kind === "event" ? card.id : null,
        source: card.source === "you" ? "students" : card.source,
      });
    }
  }
  return lines.slice(0, 8);
}

function figureSummary(tools: readonly ToolResult[], parsed: ParsedAsk): string {
  const figures = tools.flatMap((result) => result.figures ?? []);
  if (figures.length === 0) return "Here is what the rows say.";
  if (parsed.intent === "lifeops-question") return "This is what is on your timeline.";
  if (parsed.intent === "read_preferences" as string) return "This is what the recommendations are built on.";
  return figures
    .slice(0, 2)
    .map((figure) => `${figure.label}: ${figure.value}.`)
    .join(" ");
}

function actionsFor(parsed: ParsedAsk, hasLines: boolean, wantsPlan: boolean): AskAction[] {
  const actions: AskAction[] = [];
  if (wantsPlan && hasLines) actions.push({ kind: "save-plan" });
  switch (parsed.intent) {
    case "find-social":
      actions.push({ kind: "open", label: "Post a plan", href: "/anyone-down" });
      break;
    case "lifeops-question":
      actions.push({ kind: "open", label: "Open your timeline", href: "/lifeops" });
      break;
    case "budget-question":
    case "afford-question":
      actions.push({ kind: "open", label: "Open budget", href: "/budget" });
      break;
    case "find-deals":
      actions.push({ kind: "open", label: "All deals", href: "/discover?tab=deals" });
      break;
    case "find-exchange":
      actions.push({ kind: "open", label: "Open the exchange", href: "/exchange" });
      break;
    case "mission-question":
      actions.push({ kind: "open", label: "All missions", href: "/missions" });
      break;
    case "find-food":
    case "find-groceries":
    case "find-study":
    case "find-place":
    case "find-free":
      actions.push({ kind: "open", label: "See on the map", href: "/discover" });
      break;
    default:
      break;
  }
  actions.push({ kind: "ask-campus" });
  return actions;
}

/* -------------------------------------------------------------------------- */
/* Students say                                                                */
/* -------------------------------------------------------------------------- */

async function studentsSay(citySlug: string, parsed: ParsedAsk): Promise<StudentsSay[]> {
  if (!(await isFlagOn("studentsSay"))) return [];
  const [posts, comments] = await Promise.all([
    findMany("posts", (row) => row.citySlug === citySlug && row.hiddenAt === null),
    findMany("comments", (row) => row.hiddenAt === null && row.parentId === null),
  ]);

  const channels = new Set(INTENT_CHANNELS[parsed.intent] ?? []);
  const words = parsed.keywords.filter((word) => word.length > 3);

  const scored = posts
    .map((post) => {
      const text = `${post.title} ${post.body ?? ""}`.toLowerCase();
      const hits = words.filter((word) => text.includes(word)).length;
      const channelHit = channels.has(post.channel) ? 1 : 0;
      if (hits === 0 && channelHit === 0) return null;
      return { post, score: hits * 3 + channelHit * 1.5 + Math.min(3, post.upvotes / 10) + Math.min(2, post.commentCount / 5) };
    })
    .filter((entry): entry is { post: (typeof posts)[number]; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored.map(({ post }) => {
    const top = comments.filter((comment) => comment.postId === post.id).sort((a, b) => b.upvotes - a.upvotes)[0];
    return {
      postId: post.id,
      title: post.title,
      body: post.body,
      channel: post.channel,
      commentCount: post.commentCount,
      upvotes: post.upvotes,
      topAnswer: top?.body ?? null,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

/** The student's own recent questions. Never aggregated, never shared. */
export async function recentAsks(limit = 6): Promise<{ id: string; query: string; summary: string; createdAt: string }[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  const rows = await findMany("askHistory", (row) => row.userId === viewer.user.id);
  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((row) => ({ id: row.id, query: row.query, summary: row.summary, createdAt: row.createdAt }));
}

export async function clearAskHistory(): Promise<{ ok: true }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: true };
  await remove("askHistory", (row) => row.userId === viewer.user.id);
  revalidatePath("/ask");
  return { ok: true };
}

/**
 * Keep the last twenty questions per student, and no more. History is for
 * "what did I ask about that place last week", not a permanent archive: a
 * searchable record of everything a student ever wondered is a liability with
 * very little product upside.
 */
async function recordAsk(userId: string, query: string, intent: string, summary: string, tier: 0 | 1): Promise<void> {
  const trimmed = query.trim().slice(0, 300);
  if (trimmed.length < 3) return;

  await insert("askHistory", {
    id: newId(),
    userId,
    query: trimmed,
    intent,
    summary: summary.slice(0, 200),
    tier,
    createdAt: nowIso(),
  });

  const rows = await findMany("askHistory", (row) => row.userId === userId);
  if (rows.length > 20) {
    const cutoff = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[19]?.createdAt;
    if (cutoff) await remove("askHistory", (row) => row.userId === userId && row.createdAt < cutoff);
  }
}

/* -------------------------------------------------------------------------- */
/* Official                                                                    */
/* -------------------------------------------------------------------------- */

async function officialAnswer(citySlug: string, countryCode: string, query: string, parsed: ParsedAsk): Promise<AskAnswer> {
  const facts = await findMany(
    "officialFacts",
    (row) => row.countryCode === countryCode && (row.citySlug === null || row.citySlug === citySlug),
  );

  const needle = query.toLowerCase();
  const ranked = facts
    .map((fact) => ({
      fact,
      score:
        (needle.includes(fact.topic) ? 3 : 0) +
        fact.title.toLowerCase().split(/\s+/).filter((word) => word.length > 3 && needle.includes(word)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .filter((entry) => entry.score > 0)
    .slice(0, 4);

  const chosen = ranked.length > 0 ? ranked : facts.slice(0, 3).map((fact) => ({ fact, score: 0 }));

  return {
    kind: "official",
    title: "Official information",
    summary:
      "These come from government and university sources, with the date each was last checked. Anything marked as varying by nationality is not something we will guess at — follow the link for your own case.",
    lines: chosen.map(({ fact }) => ({
      kind: "activity" as const,
      title: fact.title,
      detail: `${fact.summary}${fact.variesByNationality ? " (Depends on your nationality — check the source.)" : ""} · ${factFreshness(fact).label}`,
      priceCents: 0,
      estimateCents: null,
      estimateBasis: null,
      metres: null,
      refKind: null,
      refId: null,
      source: fact.authority === "official" ? ("official" as const) : ("students" as const),
    })),
    cost: { totalCents: 0, estimateLowCents: 0, estimateHighCents: 0, unpricedLines: 0 },
    parsed,
    sources: chosen.map(({ fact }) => ({ label: fact.sourceName, url: fact.sourceUrl })),
    missReason: chosen.length === 0 ? "no-official-rows" : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function titleFor(
  parsed: ParsedAsk,
  cost: PlanCost,
  fmt: (cents: number) => string,
  kind: "plan" | "list",
  cityName: string,
): string {
  if (kind === "list") {
    if (parsed.intent === "find-groceries") return "Where to shop";
    if (parsed.intent === "find-study") return "Places to work";
    if (parsed.intent === "find-food") return "Somewhere to eat";
    if (parsed.intent === "find-social") return "Where to meet people";
    if (parsed.intent === "find-deals") return "Student deals";
    if (parsed.intent === "find-exchange") return "On the exchange";
    if (parsed.intent === "lifeops-question") return "What is on";
    if (parsed.intent === "pulse-question") return "What students said";
    if (parsed.intent === "mission-question") return "Missions that fit";
    if (parsed.intent === "budget-question") return "Your money";
    if (parsed.freeOnly) return "Free things";
    return `In ${cityName}`;
  }
  /* "All free" may only be claimed when nothing was estimated and nothing was
     left unpriced. A plan whose food stop has no published price is not a free
     plan, it is a plan with an unknown in it, and the two must not share a
     headline. */
  const clean = cost.estimateHighCents === 0 && cost.unpricedLines === 0;
  if (cost.totalCents === 0 && clean) return "All free";

  /* With an estimate in play the headline says "from", because the known money
     is a floor rather than a total. */
  const money = clean ? fmt(cost.totalCents) : `from ${fmt(cost.totalCents)}`;

  if (parsed.when === "tonight" || parsed.when === "now") return `Tonight, ${money}`;
  if (parsed.when === "weekend") return `Your weekend, ${money}`;
  return `${money} plan`;
}

function uniqueSources(lines: readonly { source: string }[], tools: readonly ToolResult[]): { label: string; url: null }[] {
  const labels: Record<string, string> = {
    students: "Reported by students",
    official: "Official source",
    venue: "Published by the venue",
    you: "Your own rows",
  };
  const fromLines = lines.map((line) => line.source);
  const fromCards = tools.flatMap((result) => result.cards.map((card: ToolCard) => card.source));
  return [...new Set([...fromLines, ...fromCards])].map((source) => ({ label: labels[source] ?? source, url: null }));
}
