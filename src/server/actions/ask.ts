"use server";

import { revalidatePath } from "next/cache";

import { factFreshness } from "@/domain/knowledge";
import type { CommunityPost } from "@/domain/types";
import { money as formatMoney } from "@/lib/utils";
import { BASE_SYSTEM, logTierZero, runAi } from "@/server/ai/gateway";
import { findMany, findOne, insert, newId, nowIso } from "@/server/db";
import { canAfford } from "@/server/engines/afford";
import {
  assemblePlan,
  type AskAnswer,
  type AskIntent,
  describeList,
  describePlan,
  parseAsk,
} from "@/server/engines/ask";
import { QuotaError, readQuota } from "@/server/entitlements";
import { recordOutcome, recordSearchMiss } from "@/server/actions/insight";
import { recordUpgradeTrigger } from "@/server/actions/upgrade";
import { loadPlaces, loadRecommendContext, loadScoredEvents } from "@/server/queries/discovery";
import { loadMoney } from "@/server/queries/money";
import { isFlagOn } from "@/server/queries/settings";
import { getViewer } from "@/server/viewer";
import { limits, rateLimit } from "@/server/rate-limit";

/**
 * ============================================================================
 * ASK ACTION
 * ----------------------------------------------------------------------------
 * The concierge, end to end.
 *
 *   1. PARSE      deterministic, no model
 *   2. RETRIEVE   real rows from the database, no model
 *   3. ASSEMBLE   a plan or a list built only from those rows, no model
 *   4. STUDENTS   matching Pulse posts, so the answer carries what people said
 *   5. EXPLAIN    optionally, a model writes one paragraph over step 3
 *
 * By the time a model is involved there is already a complete, correct answer
 * on the table. It cannot add a place, change a price or invent an event. If it
 * fails or is not configured, step 5 falls back to `describePlan`.
 *
 * The weekly allowance meters step 5 only. Retrieval is free at every tier and
 * is always returned, so hitting the limit never withholds an answer the
 * product already computed — it only withholds the sentence a model would have
 * written over it, and says so.
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

export type AskResult =
  | {
      ok: true;
      answer: AskAnswer;
      students: StudentsSay[];
      usage: AskUsage;
      /** The model sentence was withheld because the weekly allowance is used. */
      limited: boolean;
      /** A value-first upsell that fits this question, if one does. */
      upsell: { feature: "groupPlanner" | "weeklyPlanner" | "advancedAI" | "budgetForecast"; line: string } | null;
      afford: ReturnType<typeof canAfford> | null;
    }
  | { ok: false; reason: "signed-out" | "rate-limited"; message: string };

export async function askStudentOS(query: string): Promise<AskResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "signed-out", message: "Sign in to ask." };

  const gate = rateLimit(`ask:${viewer.user.id}`, limits.aiAsk.limit, limits.aiAsk.windowSeconds);
  if (!gate.ok) {
    return { ok: false, reason: "rate-limited", message: "That is a lot of questions at once. Try again in a few minutes." };
  }

  const started = Date.now();
  const parsed = parseAsk(query);
  const where = viewer.currency;
  const fmt = (cents: number) => formatMoney(cents / 100, where);
  const quota = await readQuota(viewer.user.id, "aiAsksPerWeek");
  const usage: AskUsage = { used: quota.used, limit: quota.limit, remaining: quota.remaining };

  /* ---- official questions: never generated ------------------------------ */
  if (parsed.intent === "arrival-question") {
    const answer = await officialAnswer(viewer.profile.citySlug, viewer.city.countryCode, query);
    await logTierZero({ userId: viewer.user.id, operation: "classify", latencyMs: Date.now() - started });
    if (answer.lines.length === 0) {
      await recordSearchMiss({ query, surface: "ask", resultCount: 0, gap: "missing-data" });
    }
    const students = await studentsSay(viewer.profile.citySlug, parsed.intent, parsed.keywords);
    return { ok: true, answer, students, usage, limited: false, upsell: null, afford: null };
  }

  /* ---- retrieval (Tier 0) ------------------------------------------------ */
  const money$ = await loadMoney(viewer.user.id);
  const budgetCents = parsed.budgetCents ?? (money$.unset ? null : money$.reading.safeTodayCents);

  const context = await loadRecommendContext({
    userId: viewer.user.id,
    profile: viewer.profile,
    budgetCents: parsed.freeOnly ? 0 : budgetCents,
  });

  const [events, places] = await Promise.all([
    loadScoredEvents(viewer.user.id, context, {
      when: parsed.when === "tonight" ? "tonight" : parsed.when === "weekend" ? "weekend" : parsed.when === "week" ? "week" : "all",
      freeOnly: parsed.freeOnly,
      maxPriceCents: parsed.budgetCents,
    }),
    loadPlaces(context, {
      freeOnly: parsed.freeOnly,
      maxPriceCents: parsed.budgetCents,
      layers:
        parsed.intent === "find-groceries"
          ? ["groceries"]
          : parsed.intent === "find-study"
            ? ["study"]
            : parsed.intent === "find-food"
              ? ["cheap-food"]
              : undefined,
      query: parsed.keywords[0],
    }),
  ]);

  /* ---- can I afford this? ------------------------------------------------ */
  const affordQuestion =
    parsed.intent === "budget-question" && parsed.budgetCents !== null && /\bafford\b/.test(query.toLowerCase());
  const afford =
    affordQuestion && !money$.unset
      ? canAfford({ amountCents: parsed.budgetCents!, reading: money$.reading, now: new Date(), formatMoney: fmt })
      : null;

  /* ---- assemble (Tier 0) ------------------------------------------------- */
  const wantsPlan =
    parsed.intent === "plan-night" || parsed.intent === "plan-day" || parsed.intent === "plan-weekend" || parsed.intent === "budget-question";

  const assembled = wantsPlan
    ? assemblePlan({
        budgetCents,
        events,
        places,
        fareCents: Math.round((viewer.city.anchors?.singleFare ?? 0) * 100),
        wantsFood: parsed.intent !== "find-free",
      })
    : {
        lines: [
          ...places.slice(0, 5).map((scored) => ({
            kind: "activity" as const,
            title: scored.item.name,
            detail: scored.item.why,
            priceCents: scored.item.price === null ? 0 : Math.round(scored.item.price * 100),
            walkMinutes: scored.item.walkMinutes,
            refKind: "place" as const,
            refId: scored.item.id,
            source: (scored.item.source === "mixed" ? "students" : scored.item.source) as "students" | "official" | "venue",
          })),
          ...events.slice(0, 3).map((scored) => ({
            kind: "event" as const,
            title: scored.item.title,
            detail: `${scored.item.venue} · ${new Date(scored.item.startsAt).toLocaleDateString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`,
            priceCents: scored.item.priceCents,
            walkMinutes: null,
            refKind: "event" as const,
            refId: scored.item.id,
            source: scored.item.source,
          })),
        ],
        totalCents: 0,
      };

  const students = await studentsSay(viewer.profile.citySlug, parsed.intent, parsed.keywords);

  if (assembled.lines.length === 0 && !afford) {
    await logTierZero({ userId: viewer.user.id, operation: "recommend", latencyMs: Date.now() - started });
    await recordSearchMiss({ query, surface: "ask", resultCount: 0 });

    return {
      ok: true,
      usage,
      limited: false,
      upsell: null,
      afford: null,
      students,
      answer: {
        kind: "empty",
        title: "Nothing matches that yet",
        summary:
          parsed.budgetCents !== null
            ? `Nothing in ${viewer.city.name} fits that budget in our rows right now. Try widening it, or ask for free things.`
            : `We do not have rows for that in ${viewer.city.name} yet. It has been noted.`,
        lines: [],
        totalCents: 0,
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
      ? describePlan({ lines: assembled.lines, totalCents: assembled.totalCents, budgetCents, formatMoney: fmt })
      : describeList({ lines: assembled.lines, formatMoney: fmt, cityName: viewer.city.name });

  let summary = deterministic;
  let limited = false;

  if (quota.exceeded) {
    limited = true;
    await logTierZero({ userId: viewer.user.id, operation: wantsPlan ? "plan" : "recommend", latencyMs: Date.now() - started });
    await recordUpgradeTrigger("ai-limit");
  } else if (assembled.lines.length > 0) {
    try {
      const result = await runAi<string>({
        operation: wantsPlan ? "plan" : "recommend",
        userId: viewer.user.id,
        scope: `${viewer.profile.citySlug}:${parsed.intent}:${parsed.when}:${parsed.freeOnly}`,
        domain: "general",
        payload: {
          lines: assembled.lines.map((line) => ({ title: line.title, price: line.priceCents, detail: line.detail })),
          total: assembled.totalCents,
          budget: budgetCents,
        },
        system: BASE_SYSTEM,
        prompt: [
          `Question: ${query}`,
          `Rows selected (do not add to these):`,
          JSON.stringify(assembled.lines, null, 1),
          `Total: ${assembled.totalCents} cents. Budget: ${budgetCents ?? "unstated"}.`,
          "",
          "Write two short sentences summarising this. State the total.",
          "<<render>>",
          deterministic,
        ].join("\n"),
        parse: (text) => (text.trim().length > 0 ? text.trim() : deterministic),
        fallback: () => deterministic,
      });
      summary = result.value;
    } catch (error) {
      if (error instanceof QuotaError) limited = true;
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

  await recordOutcome("found-place", parsed.intent);

  return {
    ok: true,
    usage: { ...usage, used: limited ? usage.used : usage.used + (quota.limit === null ? 0 : 1), remaining: quota.remaining === null ? null : Math.max(0, quota.remaining - (limited ? 0 : 1)) },
    limited,
    upsell,
    afford,
    students,
    answer: {
      kind: afford ? "list" : wantsPlan ? "plan" : "list",
      title: afford
        ? `${fmt(afford.amountCents)} — ${afford.verdict === "yes" ? "yes" : afford.verdict === "possibly" ? "possibly" : afford.verdict === "no-budget" ? "set a budget first" : "not ideal"}`
        : titleFor(parsed, assembled.totalCents, fmt, wantsPlan ? "plan" : "list", viewer.city.name),
      summary,
      lines: assembled.lines,
      totalCents: assembled.totalCents,
      parsed,
      sources: uniqueSources(assembled.lines),
      missReason: null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Students say                                                                */
/* -------------------------------------------------------------------------- */

const INTENT_CHANNELS: Partial<Record<AskIntent, string[]>> = {
  "find-food": ["cheap-eats"],
  "find-groceries": ["cheap-eats", "general"],
  "find-study": ["study"],
  "find-social": ["football", "gym", "language", "general"],
  "plan-night": ["events-tonight", "nightlife"],
  "plan-weekend": ["events-tonight", "travel"],
  "arrival-question": ["questions", "housing"],
  "budget-question": ["deals", "cheap-eats"],
};

/**
 * Pulse posts that speak to the question. Keyword match on title and body,
 * then channel affinity for the intent. Never more than three, ranked by how
 * many people engaged with them.
 */
async function studentsSay(citySlug: string, intent: AskIntent, keywords: string[]): Promise<StudentsSay[]> {
  if (!(await isFlagOn("studentsSay"))) return [];
  const [posts, comments] = await Promise.all([
    findMany("posts", (row) => row.citySlug === citySlug && row.hiddenAt === null),
    findMany("comments", (row) => row.hiddenAt === null && row.parentId === null),
  ]);

  const channels = new Set(INTENT_CHANNELS[intent] ?? []);
  const words = keywords.filter((word) => word.length > 3);

  const scored = posts
    .map((post) => {
      const text = `${post.title} ${post.body ?? ""}`.toLowerCase();
      const hits = words.filter((word) => text.includes(word)).length;
      const channelHit = channels.has(post.channel) ? 1 : 0;
      if (hits === 0 && channelHit === 0) return null;
      return { post, score: hits * 3 + channelHit * 1.5 + Math.min(3, post.upvotes / 10) + Math.min(2, post.commentCount / 5) };
    })
    .filter((entry): entry is { post: CommunityPost; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored.map(({ post }) => {
    const top = comments
      .filter((comment) => comment.postId === post.id)
      .sort((a, b) => b.upvotes - a.upvotes)[0];
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

/**
 * "Ask this question to my campus." Posts the question into Pulse so students
 * can answer where the AI could not, and returns the new post id.
 */
export async function askCampus(query: string): Promise<{ ok: true; postId: string } | { ok: false; message: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Sign in to ask." };

  const gate = rateLimit(`post:${viewer.user.id}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const title = query.trim().slice(0, 160);
  if (title.length < 4) return { ok: false, message: "Say a bit more than that." };

  const parsed = parseAsk(title);
  const channel = INTENT_CHANNELS[parsed.intent]?.[0] ?? "questions";

  const existing = await findOne(
    "posts",
    (row) => row.authorId === viewer.user.id && row.title.toLowerCase() === title.toLowerCase() && row.hiddenAt === null,
  );
  if (existing) return { ok: true, postId: existing.id };

  const id = newId();
  await insert("posts", {
    id,
    citySlug: viewer.profile.citySlug,
    campusSlug: viewer.profile.campusSlug,
    channel: viewer.profile.campusSlug ? "campus" : channel,
    authorId: viewer.user.id,
    kind: "question",
    title,
    body: null,
    placeId: null,
    upvotes: 0,
    commentCount: 0,
    hiddenAt: null,
    createdAt: nowIso(),
  });

  await recordOutcome("community-contribution", "ask-campus");
  revalidatePath("/pulse");
  return { ok: true, postId: id };
}

/* -------------------------------------------------------------------------- */
/* Official                                                                    */
/* -------------------------------------------------------------------------- */

async function officialAnswer(citySlug: string, countryCode: string, query: string): Promise<AskAnswer> {
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
      walkMinutes: null,
      refKind: null,
      refId: null,
      source: fact.authority === "official" ? ("official" as const) : ("students" as const),
    })),
    totalCents: 0,
    parsed: parseAsk(query),
    sources: chosen.map(({ fact }) => ({ label: fact.sourceName, url: fact.sourceUrl })),
    missReason: chosen.length === 0 ? "no-official-rows" : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function titleFor(
  parsed: ReturnType<typeof parseAsk>,
  totalCents: number,
  fmt: (cents: number) => string,
  kind: "plan" | "list",
  cityName: string,
): string {
  if (kind === "list") {
    if (parsed.freeOnly) return "Free things";
    if (parsed.intent === "find-groceries") return "Where to shop";
    if (parsed.intent === "find-study") return "Places to work";
    if (parsed.intent === "find-food") return "Somewhere to eat";
    if (parsed.intent === "find-social") return "Where to meet people";
    return `In ${cityName}`;
  }
  if (totalCents === 0) return "All free";
  if (parsed.when === "tonight") return `Tonight, ${fmt(totalCents)}`;
  if (parsed.when === "weekend") return `Your weekend, ${fmt(totalCents)}`;
  return `${fmt(totalCents)} plan`;
}

function uniqueSources(lines: readonly { source: string }[]): { label: string; url: null }[] {
  const labels: Record<string, string> = {
    students: "Reported by students",
    official: "Official source",
    venue: "Published by the venue",
  };
  return [...new Set(lines.map((line) => line.source))].map((source) => ({ label: labels[source] ?? source, url: null }));
}
