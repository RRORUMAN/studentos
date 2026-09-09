import type { LifeStage } from "@/domain/lifecycle";
import type { Cents, CityEvent } from "@/domain/types";

/**
 * ============================================================================
 * DAILY BRIEF
 * ----------------------------------------------------------------------------
 * The compact read at the top of Home: what is on tonight, what it costs, who
 * is around, what is worth knowing, and the one thing to do next.
 *
 * Built entirely from counts over rows already loaded for the screen, so it
 * costs nothing to render and is identical on every reload. Every line links to
 * the thing it counts — a brief that cannot be tapped is a notification, and
 * this is not a notification.
 *
 * Lines are only emitted when they have something to say. A brief that reads
 * "0 events, 0 friends, 0 deals" is worse than no brief.
 * ============================================================================
 */

export type BriefLine = {
  kind: "tonight" | "free" | "friends" | "deal" | "money" | "task" | "people" | "pulse" | "payment" | "mission" | "exchange" | "language";
  text: string;
  href: string;
  /** Secondary detail shown smaller, when there is one. */
  detail?: string;
};

export type BriefInput = {
  stage: LifeStage;
  tonight: readonly CityEvent[];
  /** Ids of tonight's events at least one friend is interested in or going to. */
  friendEventIds: ReadonlySet<string>;
  /** Deals added in the last week that fit the student's categories. */
  newDeals: readonly { id: string; title: string; value: string }[];
  safeTodayCents: Cents | null;
  hasBudget: boolean;
  /** The next open arrival task, if any. */
  nextTask: { id: string; label: string } | null;
  /** Anyone Down? plans in the city starting in the next 48 hours. */
  openInvites: number;
  /** Trending posts in the last 24 hours. */
  trendingPosts: number;
  formatMoney: (cents: Cents) => string;
  /** Local hour, to decide whether "tonight" is still meaningful. */
  hour: number;
  /** LifeOps: dated items due today and items that slipped. */
  lifeops?: { dueToday: number; slipped: number; firstTitle: string | null };
  /** Repeating charges landing in the next three days. */
  paymentsDue?: { count: number; totalCents: Cents; firstLabel: string | null };
  /** The active mission's next open step. */
  mission?: { title: string; step: string; href: string } | null;
  /** Exchange requests in the city that match something the student listed, or new departing stock for arrivals. */
  exchange?: { count: number; label: string; href: string } | null;
  /**
   * Today's phrase. Null when there is no pack, the student turned it off, or
   * they have finished the pack -- the brief then simply has one fewer line.
   */
  language?: { packName: string; text: string } | null;
};

export function buildDailyBrief(input: BriefInput): BriefLine[] {
  const lines: BriefLine[] = [];
  const fmt = input.formatMoney;

  /* ---- what slipped ------------------------------------------------------ */
  if (input.lifeops && input.lifeops.slipped > 0) {
    lines.push({
      kind: "task",
      text: `${input.lifeops.slipped} ${input.lifeops.slipped === 1 ? "thing" : "things"} slipped past ${input.lifeops.slipped === 1 ? "its" : "their"} date`,
      detail: input.lifeops.firstTitle ?? undefined,
      href: "/lifeops",
    });
  }

  /* ---- money going out --------------------------------------------------- */
  if (input.paymentsDue && input.paymentsDue.count > 0) {
    lines.push({
      kind: "payment",
      text: `${fmt(input.paymentsDue.totalCents)} goes out in the next three days`,
      detail: input.paymentsDue.count === 1 ? (input.paymentsDue.firstLabel ?? undefined) : `${input.paymentsDue.count} repeating charges`,
      href: "/lifeops?view=week",
    });
  }

  /* ---- tonight ---------------------------------------------------------- */
  if (input.tonight.length > 0 && input.hour < 23) {
    const free = input.tonight.filter((event) => event.priceCents === 0).length;
    const withFriends = input.tonight.filter((event) => input.friendEventIds.has(event.id)).length;

    const parts = [
      `${input.tonight.length} ${input.tonight.length === 1 ? "event matches" : "events match"} you tonight`,
    ];
    if (free > 0) parts.push(`${free} ${free === 1 ? "is" : "are"} free`);
    if (withFriends > 0) parts.push(`${withFriends === 1 ? "a friend is" : `${withFriends} friends are`} interested`);

    lines.push({
      kind: "tonight",
      text: parts[0],
      detail: parts.slice(1).join(" · ") || undefined,
      href: "/events?tab=tonight",
    });
  }

  /* ---- money ------------------------------------------------------------ */
  if (input.hasBudget && input.safeTodayCents !== null) {
    lines.push({
      kind: "money",
      text:
        input.safeTodayCents > 0
          ? `You can safely spend around ${fmt(input.safeTodayCents)} today`
          : "Nothing free to spend today — committed costs take the rest",
      href: "/budget",
    });
  }

  /* ---- deals ------------------------------------------------------------ */
  const deal = input.newDeals[0];
  if (deal) {
    lines.push({
      kind: "deal",
      text: `New: ${deal.title}`,
      detail: deal.value,
      href: "/discover?tab=deals",
    });
  }

  /* ---- people ----------------------------------------------------------- */
  if (input.openInvites > 0) {
    lines.push({
      kind: "people",
      text: `${input.openInvites} ${input.openInvites === 1 ? "student wants" : "students want"} company for something in the next two days`,
      href: "/anyone-down",
    });
  }

  /* ---- arrival ---------------------------------------------------------- */
  if (input.nextTask && input.stage !== "established") {
    lines.push({
      kind: "task",
      text: `Next: ${input.nextTask.label}`,
      detail: input.lifeops && input.lifeops.dueToday > 0 ? `${input.lifeops.dueToday} on your timeline today` : undefined,
      href: "/lifeops",
    });
  } else if (input.lifeops && input.lifeops.dueToday > 0 && input.lifeops.slipped === 0) {
    lines.push({
      kind: "task",
      text: `${input.lifeops.dueToday} ${input.lifeops.dueToday === 1 ? "thing" : "things"} on your timeline today`,
      detail: input.lifeops.firstTitle ?? undefined,
      href: "/lifeops",
    });
  }

  /* ---- mission ----------------------------------------------------------- */
  if (input.mission && lines.length < 6) {
    lines.push({
      kind: "mission",
      text: `Next mission step: ${input.mission.step}`,
      detail: input.mission.title,
      href: input.mission.href,
    });
  }

  /* ---- exchange ---------------------------------------------------------- */
  if (input.exchange && input.exchange.count > 0 && lines.length < 6) {
    lines.push({
      kind: "exchange",
      text: input.exchange.label,
      href: input.exchange.href,
    });
  }

  /* ---- language ----------------------------------------------------------
     Last, and only when there is room. It is the one line here with no
     deadline attached, so it yields to every line that has one -- but on a
     quiet day it is the most useful thirty seconds on the screen. */
  if (input.language && lines.length < 6) {
    lines.push({
      kind: "language",
      text: `Today's ${input.language.packName} takes 30 seconds`,
      detail: input.language.text,
      href: "/speak",
    });
  }

  /* ---- pulse ------------------------------------------------------------ */
  if (input.trendingPosts > 0 && lines.length < 6) {
    lines.push({
      kind: "pulse",
      text: `${input.trendingPosts} ${input.trendingPosts === 1 ? "post" : "posts"} students in your city are talking about`,
      href: "/pulse?view=trending",
    });
  }

  return lines.slice(0, 6);
}

/**
 * The one intelligent sentence under the money figures.
 *
 * Deliberately not the budget insight (that lives on the money block). This is
 * the sentence that ties money to the day: what tonight can cost, or that
 * nothing needs spending at all.
 */
export function daySentence(input: {
  safeTodayCents: Cents | null;
  hasBudget: boolean;
  paceDeltaCents: Cents;
  weekTargetCents: Cents;
  weekSpentCents: Cents;
  freeTonight: number;
  formatMoney: (cents: Cents) => string;
}): string {
  const fmt = input.formatMoney;

  if (!input.hasBudget) {
    return input.freeTonight > 0
      ? `${input.freeTonight} free ${input.freeTonight === 1 ? "thing" : "things"} on tonight. Set a budget and the rest gets a number too.`
      : "Set a budget and every recommendation gets a number next to it.";
  }

  const weekLeft = input.weekTargetCents - input.weekSpentCents;
  if (weekLeft > 0 && input.paceDeltaCents <= 0) {
    return `You're ${fmt(Math.abs(input.paceDeltaCents))} under your target this week.`;
  }
  if (weekLeft > 0) {
    return `${fmt(weekLeft)} left for the week. ${input.freeTonight > 0 ? `Tonight has ${input.freeTonight} free ${input.freeTonight === 1 ? "option" : "options"}.` : "You're good for tonight."}`;
  }
  return input.freeTonight > 0
    ? `Over this week's target by ${fmt(-weekLeft)}. Tonight has ${input.freeTonight} free ${input.freeTonight === 1 ? "option" : "options"}.`
    : `Over this week's target by ${fmt(-weekLeft)}. A quiet night gets you back on track.`;
}
