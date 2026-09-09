import type { LifeOpsItem } from "@/domain/lifeops";
import type { MissionStep } from "@/domain/missions";
import type { Cents } from "@/domain/types";
import type { FeedItem } from "@/server/engines/feed";
import type { RightNowItem } from "@/server/engines/right-now";

/**
 * ============================================================================
 * TODAY FOR YOU
 * ----------------------------------------------------------------------------
 * The three to five things at the top of Home. Not a feed: one of each kind
 * of thing that matters today, ranked, with the reason it is here.
 *
 * The mix is the point. A Home that opens with five events is an events app;
 * one that opens with five tasks is a to-do list. This picks at most one from
 * each family — something to do, something to sort, someone to join, something
 * to save on, the next mission step — and orders them by how much today
 * depends on them.
 *
 * Pure and deterministic: the same rows produce the same five.
 * ============================================================================
 */

export type TodayPickKind = "task" | "event" | "social" | "deal" | "place" | "mission" | "language";

export type TodayPick = {
  kind: TodayPickKind;
  id: string;
  title: string;
  meta: string;
  href: string;
  /** Why it is at the top. Facts from the rows, never generated. */
  reason: string;
  priceCents: Cents | null;
  /** 0-100. Ordering only. */
  score: number;
  tag: "now" | "free" | "friends" | "due" | "deal" | "step" | null;
};

export type TodayInput = {
  hour: number;
  safeTodayCents: Cents | null;
  timeline: { overdue: readonly LifeOpsItem[]; today: readonly LifeOpsItem[]; week: readonly LifeOpsItem[] };
  feed: readonly FeedItem[];
  rightNow: readonly RightNowItem[];
  mission: { id: string; title: string; emoji: string; nextStep: MissionStep | null; done: number; total: number } | null;
  /**
   * Today's phrase, already chosen by `dailyPhrase`. Null when the student has
   * turned the daily phrase off, when their country has no pack, or when they
   * have marked every phrase known -- three different reasons that all mean
   * the same thing here: do not put language on Home today.
   */
  language: { phraseId: string; text: string; meaning: string; packName: string } | null;
  formatMoney: (cents: Cents) => string;
  limit?: number;
};

const TASK_WEIGHT: Record<LifeOpsItem["kind"], number> = {
  deadline: 95,
  payment: 90,
  task: 70,
  class: 60,
  reminder: 55,
  travel: 75,
  invite: 0,
  event: 0,
  plan: 0,
  mission: 0,
  social: 40,
};

function taskPick(input: TodayInput): TodayPick | null {
  const candidates = [...input.timeline.overdue, ...input.timeline.today, ...input.timeline.week.slice(0, 3)].filter(
    (item) => item.source !== "event" && item.source !== "invite" && item.source !== "plan" && item.source !== "mission",
  );
  if (candidates.length === 0) return null;
  const best = [...candidates].sort((a, b) => {
    const urgency = (item: LifeOpsItem) => (item.bucket === "overdue" ? 30 : item.bucket === "today" ? 20 : 0);
    return urgency(b) + TASK_WEIGHT[b.kind] + b.unblocks * 3 - (urgency(a) + TASK_WEIGHT[a.kind] + a.unblocks * 3);
  })[0];
  const slipped = best.bucket === "overdue";
  return {
    kind: "task",
    id: best.key,
    title: best.title,
    meta: best.meta ?? "",
    href: best.href ?? "/lifeops",
    reason: slipped ? "Slipped — still open" : best.bucket === "today" ? "Due today" : best.unblocks > 0 ? `Unblocks ${best.unblocks} other things` : "Coming up this week",
    priceCents: best.priceCents,
    score: (slipped ? 96 : best.bucket === "today" ? 88 : 62) + Math.min(6, best.unblocks * 2),
    tag: best.bucket === "overdue" || best.bucket === "today" ? "due" : null,
  };
}

function eventPick(input: TodayInput): TodayPick | null {
  const live = input.rightNow.find((item) => item.kind === "happening" || item.kind === "free-now" || item.kind === "soon");
  if (live) {
    return {
      kind: "event",
      id: live.id,
      title: live.title,
      meta: live.meta,
      href: live.href,
      reason: live.kind === "happening" ? "Happening now" : live.free ? "Free, starting soon" : "Starting soon",
      priceCents: live.free ? 0 : null,
      score: live.kind === "happening" ? 92 : 84,
      tag: live.free ? "free" : "now",
    };
  }
  const event = input.feed.find((item) => item.kind === "event" && (item.tag === "tonight" || item.tag === "friends" || item.tag === "free"));
  const fallback = event ?? input.feed.find((item) => item.kind === "event");
  if (!fallback) return null;
  const fits = input.safeTodayCents === null || fallback.priceCents === null || fallback.priceCents <= input.safeTodayCents;
  return {
    kind: "event",
    id: fallback.id,
    title: fallback.title,
    meta: fallback.meta,
    href: fallback.href,
    reason: fallback.reasons[0] ?? (fits ? "Fits today's number" : "Matches you"),
    priceCents: fallback.priceCents,
    score: (fallback.tag === "tonight" ? 80 : fallback.tag === "friends" ? 78 : 66) + (fits ? 4 : -10),
    tag: fallback.tag === "friends" ? "friends" : fallback.priceCents === 0 ? "free" : fallback.tag === "tonight" ? "now" : null,
  };
}

function socialPick(input: TodayInput): TodayPick | null {
  const filling = input.rightNow.find((item) => item.kind === "filling");
  if (filling) {
    return {
      kind: "social",
      id: filling.id,
      title: filling.title,
      meta: filling.meta,
      href: filling.href,
      reason: "Needs people, starting soon",
      priceCents: filling.free ? 0 : null,
      score: 82,
      tag: "friends",
    };
  }
  const invite = input.feed.find((item) => item.kind === "invite");
  if (!invite) return null;
  return {
    kind: "social",
    id: invite.id,
    title: invite.title,
    meta: invite.meta,
    href: invite.href,
    reason: invite.reasons[0] ?? "Someone is looking for people",
    priceCents: invite.priceCents,
    score: 64,
    tag: "friends",
  };
}

function dealPick(input: TodayInput): TodayPick | null {
  const deal = input.feed.find((item) => item.kind === "deal");
  if (deal) {
    return {
      kind: "deal",
      id: deal.id,
      title: deal.title,
      meta: deal.meta,
      href: deal.href,
      reason: deal.reasons[0] ?? "A deal students confirmed",
      priceCents: null,
      score: 58,
      tag: "deal",
    };
  }
  const place = input.feed.find((item) => item.kind === "place");
  if (!place) return null;
  const lunchtime = input.hour >= 11 && input.hour <= 14;
  return {
    kind: "place",
    id: place.id,
    title: place.title,
    meta: place.meta,
    href: place.href,
    reason: place.reasons[0] ?? "Worth the walk",
    priceCents: place.priceCents,
    score: lunchtime ? 60 : 50,
    tag: place.priceCents === 0 ? "free" : null,
  };
}

function missionPick(input: TodayInput): TodayPick | null {
  const mission = input.mission;
  if (!mission || !mission.nextStep) return null;
  return {
    kind: "mission",
    id: mission.id,
    title: mission.nextStep.label,
    meta: `${mission.emoji} ${mission.title} · ${mission.done}/${mission.total}`,
    href: mission.nextStep.href ?? `/missions/${mission.id}`,
    reason: "Your next mission step",
    priceCents: mission.nextStep.priceCents,
    score: 54 + Math.min(10, mission.done * 3),
    tag: "step",
  };
}

/**
 * Today's phrase, as a pick.
 *
 * Scored below anything with a deadline and above anything merely nice, which
 * is the correct place for a thirty-second habit: it should be the fourth
 * thing a student sees on a normal day and the thing that drops off entirely
 * on a day when the visa office wants them.
 */
function languagePick(input: TodayInput): TodayPick | null {
  if (!input.language) return null;
  return {
    kind: "language",
    id: input.language.phraseId,
    title: input.language.text,
    meta: input.language.meaning,
    href: "/speak",
    reason: `Today's ${input.language.packName} · 30 sec`,
    priceCents: null,
    score: 52,
    tag: null,
  };
}

export function todayForYou(input: TodayInput): TodayPick[] {
  const picks = [
    taskPick(input),
    eventPick(input),
    socialPick(input),
    dealPick(input),
    missionPick(input),
    languagePick(input),
  ].filter(
    (pick): pick is TodayPick => pick !== null,
  );
  return picks.sort((a, b) => b.score - a.score).slice(0, input.limit ?? 5);
}
