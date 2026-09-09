import "server-only";

import { z } from "zod";

import { phrasesFor } from "@/domain/language";
import { describeProximity, type PlaceLayer } from "@/domain/places";
import { listingKind, listingMode } from "@/domain/social";
import type { Cents } from "@/domain/types";
import { findMany } from "@/server/db";
import { canAfford } from "@/server/engines/afford";
import { cityRatio } from "@/server/engines/missions";
import { missionsForStage } from "@/config/missions";
import { loadLifeOps } from "@/server/queries/lifeops";
import { loadMissions } from "@/server/queries/missions";
import {
  loadDeals,
  loadPlaces,
  loadRecommendContext,
  loadScoredEvents,
} from "@/server/queries/discovery";
import { loadLanguage } from "@/server/queries/language";
import { loadMoney } from "@/server/queries/money";
import { loadOpenInvites } from "@/server/queries/plans";
import { suggestedPeople } from "@/server/queries/social";
import type { Viewer } from "@/server/viewer";
import { money } from "@/lib/utils";

/**
 * ============================================================================
 * AI TOOLS
 * ----------------------------------------------------------------------------
 * The only things the AI layer is allowed to know.
 *
 * This is the enforcement point for the rule the whole product rests on: **a
 * model never sees the database, it sees the output of these functions.** Each
 * one takes typed arguments, runs deterministic retrieval, and returns rows
 * that already exist. There is no tool that writes free text, no tool that
 * takes a raw SQL-ish filter, and deliberately no tool that answers a legal,
 * visa or immigration question — those come from `official_facts` with a
 * source URL, and `runAi` refuses the domain outright.
 *
 * Two consumers, one registry:
 *
 *   1. `askStudentOS` dispatches tools deterministically from the parsed
 *      intent. This is the normal path: retrieval happens whether or not a
 *      model is configured, and the answer is complete before any model is
 *      involved.
 *
 *   2. A provider that supports tool use can be handed `toolSchemas` and call
 *      them itself. The results are identical, because it is the same code.
 *
 * Every result carries `source` so the UI can print provenance next to it.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Result shapes                                                               */
/* -------------------------------------------------------------------------- */

export type ToolCardKind = "place" | "event" | "deal" | "invite" | "post" | "listing" | "task" | "mission" | "person" | "figure" | "phrase";

/**
 * One thing the answer can show. Deliberately flat and uniform: the console
 * renders a list of these, so a new tool does not need a new renderer.
 */
export type ToolCard = {
  kind: ToolCardKind;
  id: string;
  title: string;
  /** One line under the title: venue and time, category and walk, who is in. */
  detail: string;
  priceCents: Cents | null;
  href: string | null;
  /** Facts from the row that explain why it is here. Never generated. */
  reasons: string[];
  source: "students" | "official" | "venue" | "you";
  /** Social proof that exists on the row. */
  social: string | null;
  /** When it happens, for time-bound rows. */
  at: string | null;
  /** Walking minutes, ONLY when a routing provider produced them. */
  walkMinutes: number | null;
  /**
   * Straight-line distance from the student, in metres.
   *
   * Separate from `walkMinutes` on purpose. Most deployments have no routing
   * provider, so `walkMinutes` is null and this is what the card shows — as a
   * distance, which is what it is. Optional because most cards are not places
   * and have no distance of any kind.
   */
  metres?: number | null;
};

export type ToolResult = {
  tool: ToolName;
  /** What was searched for, echoed so the UI can say "no free events tonight". */
  args: Record<string, unknown>;
  cards: ToolCard[];
  /** A figure the tool computed, when the answer is a number rather than a list. */
  figures?: { label: string; value: string; tone?: "good" | "watch" | "bad" }[];
  /** Set when the tool ran and found nothing, with the honest reason. */
  emptyReason?: string;
};

export type ToolName =
  | "search_places"
  | "search_events"
  | "search_deals"
  | "search_student_pulse"
  | "search_exchange"
  | "search_social"
  | "read_budget"
  | "read_lifeops"
  | "read_preferences"
  | "read_saved"
  | "calculate_budget"
  | "suggest_missions"
  | "get_useful_phrases";

/* -------------------------------------------------------------------------- */
/* Argument schemas                                                            */
/* -------------------------------------------------------------------------- */

const whenSchema = z.enum(["now", "tonight", "tomorrow", "weekend", "week", "any"]).default("any");

export const toolSchemas = {
  search_places: z.object({
    layers: z.array(z.enum(["cheap-food", "groceries", "free", "study", "nightlife", "fitness", "events", "deals", "for-you"])).optional(),
    maxPriceCents: z.number().int().min(0).optional(),
    freeOnly: z.boolean().optional(),
    verifiedOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  search_events: z.object({
    when: whenSchema,
    freeOnly: z.boolean().optional(),
    maxPriceCents: z.number().int().min(0).optional(),
    kinds: z.array(z.string()).optional(),
    campusOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  search_deals: z.object({
    category: z.string().optional(),
    limit: z.number().int().min(1).max(10).default(4),
  }),
  search_student_pulse: z.object({
    keywords: z.array(z.string()).default([]),
    channels: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(6).default(3),
  }),
  search_exchange: z.object({
    kind: z.enum(["sell", "borrow", "help", "ride", "free"]).optional(),
    mode: z.enum(["offer", "request"]).optional(),
    keywords: z.array(z.string()).default([]),
    limit: z.number().int().min(1).max(8).default(4),
  }),
  search_social: z.object({
    limit: z.number().int().min(1).max(6).default(4),
  }),
  read_budget: z.object({}),
  read_lifeops: z.object({
    horizon: z.enum(["today", "week", "upcoming"]).default("today"),
  }),
  read_preferences: z.object({}),
  read_saved: z.object({
    limit: z.number().int().min(1).max(10).default(6),
  }),
  calculate_budget: z.object({
    amountCents: z.number().int().min(0),
    category: z.string().optional(),
  }),
  suggest_missions: z.object({
    limit: z.number().int().min(1).max(4).default(3),
  }),
  /**
   * Phrases for a situation, from the student's pack.
   *
   * There is deliberately NO free-text argument here. A model cannot ask this
   * tool to translate an arbitrary sentence, because the answer would be the
   * model's own invention presented with the same authority as the curated
   * pack -- and a student repeating a hallucinated sentence at a pharmacy
   * counter is exactly the failure this codebase refuses everywhere else.
   * The situation is an enum; anything outside it returns nothing.
   */
  get_useful_phrases: z.object({
    situation: z.enum([
      "first-words",
      "getting-around",
      "groceries",
      "eating-out",
      "money",
      "housing",
      "university",
      "meeting-people",
      "work",
      "emergency",
    ]),
    limit: z.number().int().min(1).max(8).default(5),
  }),
} as const;

export type ToolArgs = { [K in ToolName]: z.infer<(typeof toolSchemas)[K]> };

/**
 * What each tool is for, in the words a model would be given. Also what the
 * admin AI page prints, so the two can never drift.
 */
export const toolMeta: Record<ToolName, { label: string; detail: string }> = {
  search_places: { label: "search_places", detail: "Cheap food, groceries, study spots, gyms, nightlife and free places in the student's city, scored for them." },
  search_events: { label: "search_events", detail: "Events tonight, this week or this weekend, with price, venue and how many students are interested." },
  search_deals: { label: "search_deals", detail: "Student discounts with a confidence reading computed from student reports." },
  search_student_pulse: { label: "search_student_pulse", detail: "What students in this city posted, and the top answer on each post." },
  search_exchange: { label: "search_exchange", detail: "Things students are selling, lending, giving away, or asking for help with." },
  search_social: { label: "search_social", detail: "Open Anyone Down? plans and students with shared interests on the same campus." },
  read_budget: { label: "read_budget", detail: "Safe to spend today, safe to spend this week, what is committed, which categories are drifting." },
  read_lifeops: { label: "read_lifeops", detail: "The student's timeline: deadlines, classes, payments, plans, arrival tasks." },
  read_preferences: { label: "read_preferences", detail: "City, campus, interests, diet, transport, travel tolerance, price sensitivity." },
  read_saved: { label: "read_saved", detail: "Places, events, deals and listings this student saved." },
  calculate_budget: { label: "calculate_budget", detail: "Whether a specific amount is affordable, and what it leaves." },
  suggest_missions: { label: "suggest_missions", detail: "Mission templates that fit this student's stage right now." },
  get_useful_phrases: { label: "get_useful_phrases", detail: "Curated phrases in the local language for one situation. Never translates free text: the pack is the only source." },
};

/* -------------------------------------------------------------------------- */
/* Runner                                                                      */
/* -------------------------------------------------------------------------- */

export type ToolContext = {
  viewer: Viewer;
  now: Date;
  /** Explicit ceiling from the question. Null means "use safe-today". */
  budgetCents: Cents | null;
};

async function contextFor(ctx: ToolContext) {
  const money$ = await loadMoney(ctx.viewer.user.id, ctx.now);
  const budgetCents = ctx.budgetCents ?? (money$.unset ? null : money$.reading.safeTodayCents);
  const recommend = await loadRecommendContext({
    userId: ctx.viewer.user.id,
    profile: ctx.viewer.profile,
    budgetCents,
    now: ctx.now,
  });
  return { money: money$, budgetCents, recommend };
}

/** Run one tool. Never throws: a tool that cannot answer returns an empty result with a reason. */
export async function runTool<K extends ToolName>(name: K, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  const schema = toolSchemas[name] as z.ZodTypeAny;
  const parsed = schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { tool: name, args: {}, cards: [], emptyReason: "Those search terms did not parse." };
  }
  const args = parsed.data as ToolArgs[K];
  const fmt = (cents: number) => money(cents / 100, ctx.viewer.currency);

  switch (name) {
    case "search_places": {
      const a = args as ToolArgs["search_places"];
      const { recommend } = await contextFor(ctx);
      const found = await loadPlaces(recommend, {
        layers: a.layers as readonly PlaceLayer[] | undefined,
        cheapOnly: a.maxPriceCents !== undefined && a.maxPriceCents !== null,
        freeOnly: a.freeOnly,
        verifiedOnly: a.verifiedOnly,
      });

      /* A provider outage is reported as one. The model is handed an explicit
         "we could not reach the map" rather than an empty list, because an
         empty list is a fact about the city and this is a fact about us. */
      if (found.unavailable) {
        return { tool: name, args: a, cards: [], emptyReason: found.unavailable.message };
      }
      const rows = found.places;
      return {
        tool: name,
        args: a,
        cards: rows.slice(0, a.limit).map((scored) => ({
          kind: "place" as const,
          id: scored.item.id,
          title: scored.item.name,
          /* Distance, in the words the card uses. `describeProximity` prints
             minutes only when a router produced them. */
          detail: `${scored.item.category} · ${describeProximity(scored.item.proximity)}`,
          /* No place provider publishes an amount, so a place card never
             carries one. The band is in `reasons` where it belongs. */
          priceCents: null,
          href: `/discover/${encodeURIComponent(scored.item.id)}`,
          reasons: scored.reasons,
          /* Where the row came from, which for a place is always a provider.
             "students" would claim a student wrote it. */
          source: "official" as const,
          social:
            scored.item.confirmations >= 10
              ? `${scored.item.confirmations} students confirmed this`
              : null,
          at: null,
          walkMinutes: scored.item.proximity.minutes,
          metres: scored.item.proximity.metres,
        })),
        emptyReason: rows.length === 0 ? `No places match that in ${ctx.viewer.city.name} yet.` : undefined,
      };
    }

    case "search_events": {
      const a = args as ToolArgs["search_events"];
      const { recommend } = await contextFor(ctx);
      const rows = await loadScoredEvents(ctx.viewer.user.id, recommend, {
        when: a.when === "now" || a.when === "tomorrow" ? "tonight" : a.when === "any" ? "all" : a.when,
        freeOnly: a.freeOnly,
        maxPriceCents: a.maxPriceCents ?? null,
        kinds: a.kinds,
        campusOnly: a.campusOnly,
      });
      return {
        tool: name,
        args: a,
        cards: rows.slice(0, a.limit).map((scored) => ({
          kind: "event" as const,
          id: scored.item.id,
          title: scored.item.title,
          detail: scored.item.venue,
          priceCents: scored.item.priceCents,
          href: `/events/${scored.item.id}`,
          reasons: scored.reasons,
          source: scored.item.source,
          social: scored.item.interested >= 5 ? `${scored.item.interested} students interested` : null,
          at: scored.item.startsAt,
          walkMinutes: null,
        })),
        emptyReason:
          rows.length === 0
            ? a.freeOnly
              ? `Nothing free is listed in ${ctx.viewer.city.name} for that window yet.`
              : `Nothing is listed in ${ctx.viewer.city.name} for that window yet.`
            : undefined,
      };
    }

    case "search_deals": {
      const a = args as ToolArgs["search_deals"];
      const rows = await loadDeals(ctx.viewer.profile.citySlug);
      const usable = rows.filter((deal) => deal.confidence !== "expired" && deal.confidence !== "disputed");
      const filtered = a.category ? usable.filter((deal) => deal.category === a.category) : usable;
      return {
        tool: name,
        args: a,
        cards: filtered.slice(0, a.limit).map((deal) => ({
          kind: "deal" as const,
          id: deal.id,
          title: deal.title,
          detail: deal.value,
          priceCents: null,
          href: "/discover?tab=deals",
          reasons: [
            deal.confidence === "verified" ? "Confirmed working by students" : "Not confirmed recently",
            deal.requiresStudentId ? "Bring your student card" : "",
          ].filter(Boolean),
          source: deal.source,
          social: deal.workedCount > 0 ? `${deal.workedCount} students said it worked` : null,
          at: null,
          walkMinutes: null,
        })),
        emptyReason: filtered.length === 0 ? `No live deals in ${ctx.viewer.city.name} for that yet.` : undefined,
      };
    }

    case "search_student_pulse": {
      const a = args as ToolArgs["search_student_pulse"];
      const [posts, comments] = await Promise.all([
        findMany("posts", (row) => row.citySlug === ctx.viewer.profile.citySlug && row.hiddenAt === null),
        findMany("comments", (row) => row.hiddenAt === null && row.parentId === null),
      ]);
      const words = a.keywords.filter((word) => word.length > 3).map((word) => word.toLowerCase());
      const channels = new Set(a.channels ?? []);
      const scored = posts
        .map((post) => {
          const text = `${post.title} ${post.body ?? ""}`.toLowerCase();
          const hits = words.filter((word) => text.includes(word)).length;
          const channelHit = channels.has(post.channel) ? 1 : 0;
          if (hits === 0 && channelHit === 0) return null;
          return { post, score: hits * 3 + channelHit * 1.5 + Math.min(3, post.upvotes / 10) + Math.min(2, post.commentCount / 5) };
        })
        .filter((entry): entry is { post: (typeof posts)[number]; score: number } => entry !== null)
        .sort((a2, b2) => b2.score - a2.score)
        .slice(0, a.limit);

      return {
        tool: name,
        args: a,
        cards: scored.map(({ post }) => {
          const top = comments.filter((comment) => comment.postId === post.id).sort((x, y) => y.upvotes - x.upvotes)[0];
          return {
            kind: "post" as const,
            id: post.id,
            title: post.title,
            detail: top?.body ?? post.body ?? `#${post.channel}`,
            priceCents: null,
            href: `/pulse/${post.id}`,
            reasons: [`#${post.channel}`, post.commentCount > 0 ? `${post.commentCount} replies` : ""].filter(Boolean),
            source: "students" as const,
            social: post.upvotes > 0 ? `${post.upvotes} found it useful` : null,
            at: null,
            walkMinutes: null,
          };
        }),
        emptyReason: scored.length === 0 ? "Nobody in your city has posted about this yet." : undefined,
      };
    }

    case "search_exchange": {
      const a = args as ToolArgs["search_exchange"];
      const rows = await findMany(
        "listings",
        (row) => row.citySlug === ctx.viewer.profile.citySlug && row.status === "active" && row.sellerId !== ctx.viewer.user.id,
      );
      const words = a.keywords.filter((word) => word.length > 2).map((word) => word.toLowerCase());
      const matched = rows.filter((row) => {
        if (a.kind && listingKind(row) !== a.kind) return false;
        if (a.mode && listingMode(row) !== a.mode) return false;
        if (words.length === 0) return true;
        const text = `${row.title} ${row.detail} ${row.category}`.toLowerCase();
        return words.some((word) => text.includes(word));
      });
      return {
        tool: name,
        args: a,
        cards: matched
          .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
          .slice(0, a.limit)
          .map((row) => ({
            kind: "listing" as const,
            id: row.id,
            title: row.title,
            detail: `${listingMode(row) === "request" ? "Looking for" : "Offered"} · ${row.meetArea}`,
            priceCents: row.priceCents,
            href: `/exchange/${row.id}`,
            reasons: [row.fromLeaving ? "From a student leaving soon" : ""].filter(Boolean),
            source: "students" as const,
            social: null,
            at: row.whenAt ?? null,
            walkMinutes: null,
          })),
        emptyReason: matched.length === 0 ? `Nothing on the exchange in ${ctx.viewer.city.name} matches that.` : undefined,
      };
    }

    case "search_social": {
      const a = args as ToolArgs["search_social"];
      if (ctx.viewer.profile.socialGoals.includes("private")) {
        return { tool: name, args: a, cards: [], emptyReason: "Social matching is switched off in your settings." };
      }
      const [invites, people] = await Promise.all([
        loadOpenInvites({ userId: ctx.viewer.user.id, citySlug: ctx.viewer.profile.citySlug, now: ctx.now }),
        suggestedPeople({
          viewerId: ctx.viewer.user.id,
          citySlug: ctx.viewer.profile.citySlug,
          campusSlug: ctx.viewer.profile.campusSlug,
          interests: ctx.viewer.profile.interests,
          limit: 3,
        }),
      ]);
      const cards: ToolCard[] = [
        ...invites.slice(0, a.limit).map((invite) => ({
          kind: "invite" as const,
          id: invite.id,
          title: invite.title,
          detail: invite.hostName ? `${invite.hostName} is looking for people` : "Someone is looking for people",
          priceCents: invite.budgetCents,
          href: `/anyone-down/${invite.id}`,
          reasons: [`${invite.going} in`, `${Math.max(0, invite.capacity - invite.going)} spots left`],
          source: "students" as const,
          social: null,
          at: invite.startsAt,
          walkMinutes: null,
        })),
        ...people.slice(0, Math.max(0, a.limit - invites.length)).map((entry) => ({
          kind: "person" as const,
          id: entry.profile.userId,
          title: entry.profile.displayName,
          detail: entry.sameCampus ? "Your campus" : "In your city",
          priceCents: null,
          href: "/you/friends",
          reasons: entry.shared.length > 0 ? [`Also into ${entry.shared.slice(0, 2).join(" and ").replace(/-/g, " ")}`] : [],
          source: "students" as const,
          social: null,
          at: null,
          walkMinutes: null,
        })),
      ];
      return {
        tool: name,
        args: a,
        cards,
        emptyReason: cards.length === 0 ? "No open plans in your city right now. Posting one takes ten seconds." : undefined,
      };
    }

    case "read_budget": {
      const { money: money$ } = await contextFor(ctx);
      if (money$.unset) {
        return { tool: name, args: {}, cards: [], emptyReason: "No budget set yet, so there is no safe-to-spend figure." };
      }
      const drifting = money$.reading.categories.filter((row) => row.discretionary && row.paceDeltaCents > 0).sort((x, y) => y.paceDeltaCents - x.paceDeltaCents)[0];
      return {
        tool: name,
        args: {},
        cards: [],
        figures: [
          { label: "Safe to spend today", value: fmt(money$.reading.safeTodayCents), tone: money$.reading.safeTodayCents > 0 ? "good" : "bad" },
          { label: "Safe to spend this week", value: fmt(Math.max(0, money$.week.targetCents - money$.week.spentCents)) },
          { label: "Still to come out", value: fmt(money$.reading.committedCents) },
          ...(drifting ? [{ label: `${drifting.label} ahead of pace`, value: fmt(drifting.paceDeltaCents), tone: "watch" as const }] : []),
        ],
      };
    }

    case "read_lifeops": {
      const a = args as ToolArgs["read_lifeops"];
      const timeline = await loadLifeOps(ctx.viewer, ctx.now);
      const items = a.horizon === "today" ? [...timeline.overdue, ...timeline.today] : a.horizon === "week" ? timeline.week : timeline.upcoming;
      return {
        tool: name,
        args: a,
        cards: items.slice(0, 8).map((item) => ({
          kind: "task" as const,
          id: item.key,
          title: item.title,
          detail: item.meta ?? "",
          priceCents: item.priceCents,
          href: item.href,
          reasons: [item.bucket === "overdue" ? "Slipped" : item.bucket === "today" ? "Today" : "", item.unblocks > 0 ? `Unblocks ${item.unblocks}` : ""].filter(Boolean),
          source: item.official ? ("official" as const) : ("you" as const),
          social: item.social,
          at: item.at,
          walkMinutes: null,
        })),
        figures:
          timeline.budgetAfterTodayCents !== null
            ? [{ label: "Left after today's plans", value: fmt(timeline.budgetAfterTodayCents), tone: timeline.budgetAfterTodayCents < 0 ? "bad" : "good" }]
            : undefined,
        emptyReason: items.length === 0 ? "Nothing on your timeline for that window." : undefined,
      };
    }

    case "read_preferences": {
      const profile = ctx.viewer.profile;
      return {
        tool: name,
        args: {},
        cards: [],
        figures: [
          { label: "City", value: ctx.viewer.city.name },
          ...(ctx.viewer.campusName ? [{ label: "University", value: ctx.viewer.campusName }] : []),
          ...(profile.homeArea ? [{ label: "Area", value: profile.homeArea }] : []),
          { label: "Interests", value: profile.interests.length > 0 ? profile.interests.slice(0, 4).join(", ").replace(/-/g, " ") : "none set" },
          { label: "Will travel", value: `${profile.maxTravelMinutes} min` },
          { label: "Price", value: profile.priceSensitivity.replace(/-/g, " ") },
          ...(profile.diets.length > 0 ? [{ label: "Diet", value: profile.diets.join(", ") }] : []),
        ],
      };
    }

    case "read_saved": {
      const a = args as ToolArgs["read_saved"];
      const saved = await findMany("saved", (row) => row.userId === ctx.viewer.user.id);
      if (saved.length === 0) {
        return { tool: name, args: a, cards: [], emptyReason: "You have not saved anything yet." };
      }
      const eventIds = new Set(saved.filter((row) => row.kind === "event").map((row) => row.targetId));
      const listingIds = new Set(saved.filter((row) => row.kind === "listing").map((row) => row.targetId));
      const [events, listings] = await Promise.all([
        eventIds.size > 0 ? findMany("events", (row) => eventIds.has(row.id)) : Promise.resolve([]),
        listingIds.size > 0 ? findMany("listings", (row) => listingIds.has(row.id)) : Promise.resolve([]),
      ]);
      /* Saved places are provider ids and nothing else, so they are looked up
         again rather than read from a table. One that no longer resolves is
         reported as gone rather than rendered from a stale copy. */
      const { loadPlacesByIds } = await import("@/server/queries/places");
      const placeIds = saved.filter((row) => row.kind === "place").map((row) => row.targetId);
      const { places } = await loadPlacesByIds(placeIds, ctx.viewer.profile.citySlug);

      const cards: ToolCard[] = [];
      for (const row of saved.slice(0, a.limit)) {
        if (row.kind === "event") {
          const event = events.find((entry) => entry.id === row.targetId);
          if (event) {
            cards.push({ kind: "event", id: event.id, title: event.title, detail: event.venue, priceCents: event.priceCents, href: `/events/${event.id}`, reasons: ["You saved this"], source: event.source, social: null, at: event.startsAt, walkMinutes: null });
          }
        } else if (row.kind === "place") {
          const place = places.get(row.targetId);
          if (place) {
            cards.push({
              kind: "place",
              id: place.id,
              title: place.name,
              detail: `${place.category} · ${describeProximity(place.proximity)}`,
              priceCents: null,
              href: `/discover/${encodeURIComponent(place.id)}`,
              reasons: ["You saved this"],
              source: "official",
              social: null,
              at: null,
              walkMinutes: place.proximity.minutes,
              metres: place.proximity.metres,
            });
          }
        } else if (row.kind === "listing") {
          const listing = listings.find((entry) => entry.id === row.targetId);
          if (listing) {
            cards.push({ kind: "listing", id: listing.id, title: listing.title, detail: listing.meetArea, priceCents: listing.priceCents, href: `/exchange/${listing.id}`, reasons: ["You saved this"], source: "students", social: null, at: null, walkMinutes: null });
          }
        }
      }
      return { tool: name, args: a, cards, emptyReason: cards.length === 0 ? "Your saved items are no longer listed." : undefined };
    }

    case "calculate_budget": {
      const a = args as ToolArgs["calculate_budget"];
      const { money: money$ } = await contextFor(ctx);
      if (money$.unset) {
        return { tool: name, args: a, cards: [], emptyReason: "Set a budget and this becomes a real answer rather than a guess." };
      }
      const reading = canAfford({ amountCents: a.amountCents, reading: money$.reading, now: ctx.now, formatMoney: fmt });
      return {
        tool: name,
        args: a,
        cards: [],
        figures: [
          { label: `Free until ${reading.horizonLabel}`, value: fmt(reading.horizonCents) },
          { label: "After this", value: fmt(Math.max(0, reading.leftoverCents)), tone: reading.leftoverCents < 0 ? "bad" : reading.verdict === "yes" ? "good" : "watch" },
          { label: "Per day after", value: fmt(reading.leftoverPerDayCents) },
        ],
      };
    }

    case "suggest_missions": {
      const a = args as ToolArgs["suggest_missions"];
      const social = !ctx.viewer.profile.socialGoals.includes("private");
      const [{ active }] = await Promise.all([loadMissions(ctx.viewer.user.id)]);
      const runningKeys = new Set(active.map((entry) => entry.mission.templateKey));
      const ratio = cityRatio(ctx.viewer.city.anchors);
      const templates = missionsForStage(ctx.viewer.stage.stage, social).filter((template) => !runningKeys.has(template.key));
      return {
        tool: name,
        args: a,
        cards: templates.slice(0, a.limit).map((template) => ({
          kind: "mission" as const,
          id: template.key,
          title: `${template.emoji} ${template.title}`,
          detail: template.tagline,
          priceCents: template.budgetCents === null ? null : Math.round((template.budgetCents * ratio) / 50) * 50,
          href: `/missions/preview/${template.key}`,
          reasons: [`${template.steps.length} steps`, template.durationDays === 1 ? "one day" : `${template.durationDays} days`],
          source: "you" as const,
          social: null,
          at: null,
          walkMinutes: null,
        })),
        emptyReason: templates.length === 0 ? "You are already running every mission that fits right now." : undefined,
      };
    }

    case "get_useful_phrases": {
      const a = args as ToolArgs["get_useful_phrases"];
      const view = await loadLanguage({
        userId: ctx.viewer.user.id,
        countryCode: ctx.viewer.city.countryCode,
        timezone: ctx.viewer.city.timezone,
        now: ctx.now,
      });
      if (!view.pack) {
        return {
          tool: name,
          args: a,
          cards: [],
          emptyReason: `There is no phrase pack for ${ctx.viewer.city.country} yet.`,
        };
      }
      const rows = phrasesFor(view.pack, a.situation).slice(0, a.limit);
      return {
        tool: name,
        args: a,
        cards: rows.map((phrase) => ({
          kind: "phrase" as const,
          id: phrase.id,
          title: phrase.text,
          detail: phrase.meaning,
          priceCents: null,
          href: `/speak/${phrase.situation}`,
          /* The respelling and the note are facts from the pack, so they may
             be shown. Nothing here is generated. */
          reasons: [phrase.say, phrase.note].filter((value): value is string => Boolean(value)),
          source: "official" as const,
          social: null,
          at: null,
          walkMinutes: null,
        })),
        emptyReason:
          rows.length === 0 ? `The ${view.pack.name} pack has nothing for that situation yet.` : undefined,
      };
    }

    default:
      return { tool: name, args: {}, cards: [], emptyReason: "Unknown tool." };
  }
}

/** Run several tools in parallel. Order of results matches order of requests. */
export async function runTools(
  requests: readonly { name: ToolName; args?: unknown }[],
  ctx: ToolContext,
): Promise<ToolResult[]> {
  return Promise.all(requests.map((request) => runTool(request.name, request.args ?? {}, ctx)));
}

/**
 * The tool list in the shape a tool-using provider expects. Exposed so a
 * future provider adapter can hand the model the same registry the
 * deterministic path uses, rather than a second, drifting copy.
 */
export function toolDefinitions(): { name: ToolName; description: string; input_schema: unknown }[] {
  return (Object.keys(toolSchemas) as ToolName[]).map((name) => ({
    name,
    description: toolMeta[name].detail,
    input_schema: z.toJSONSchema(toolSchemas[name]),
  }));
}
