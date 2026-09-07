import type { Place } from "@/data/types";
import type { Cents, CityEvent } from "@/domain/types";
import type { Scored } from "@/server/engines/recommend";

/**
 * ============================================================================
 * SMART WEEK
 * ----------------------------------------------------------------------------
 * Two to four things across the coming week, inside the budget, without
 * overscheduling anyone.
 *
 * The constraint that shapes it: **at most one thing per day, at most four in
 * the week, and never more money than the week can spare.** A planner that
 * fills every evening is a planner students ignore by Wednesday. The five
 * dials — cheaper, more social, more free, more active, less travel — re-run
 * the same selection with shifted weights rather than asking a model, so the
 * plan changes instantly and predictably.
 *
 * Pure. Retrieval and scoring happen upstream.
 * ============================================================================
 */

export type WeekDial = "cheaper" | "social" | "free" | "active" | "less-travel";

/** Every dial, in the order the screen shows them. */
export const weekDials: readonly WeekDial[] = ["cheaper", "free", "social", "active", "less-travel"];

/**
 * The dials free accounts can turn. The money dials are free at every tier
 * because a planner that cannot be told "cheaper" is useless to the student
 * this product is for; the taste dials are what Plus adds.
 */
export const freeWeekDials: readonly WeekDial[] = ["cheaper", "free"];

export type WeekItem = {
  /** 0-6, local day of week of the slot. */
  day: number;
  /** ISO date of the slot's day, so the UI can print "Tue 9". */
  dateIso: string;
  kind: "event" | "place";
  refId: string;
  title: string;
  detail: string;
  priceCents: Cents;
  walkMinutes: number | null;
  reasons: string[];
  href: string;
};

export type WeekPlan = {
  items: WeekItem[];
  totalCents: Cents;
  budgetCents: Cents | null;
  /** True when the dials pushed the plan below two items. */
  thin: boolean;
  summary: string;
};

const ACTIVE_TAGS = new Set(["sports", "football", "gym", "running", "cycling", "fitness", "outdoor", "nature"]);
const SOCIAL_TAGS = new Set(["social", "networking", "nightlife", "language-exchange", "meet-friends"]);

export function planWeek(input: {
  now: Date;
  events: readonly Scored<CityEvent>[];
  places: readonly Scored<Place>[];
  /** Money free for the coming seven days. Null when no budget is set. */
  weekBudgetCents: Cents | null;
  dials: readonly WeekDial[];
  maxItems?: number;
  formatMoney: (cents: Cents) => string;
}): WeekPlan {
  const { now, dials } = input;
  const maxItems = Math.min(4, Math.max(2, input.maxItems ?? 4));
  const dialSet = new Set(dials);

  /* A deliberate margin: the week's plan may use at most 70% of what is free,
     because groceries and the unexpected are not on it. */
  const budget = input.weekBudgetCents === null ? null : Math.floor(input.weekBudgetCents * 0.7);

  const weekEnd = now.getTime() + 7 * 86_400_000;

  type Candidate = {
    kind: "event" | "place";
    score: number;
    priceCents: Cents;
    walk: number | null;
    day: number;
    dateIso: string;
    title: string;
    detail: string;
    reasons: string[];
    refId: string;
    href: string;
    tags: readonly string[];
  };

  const candidates: Candidate[] = [];

  for (const scored of input.events) {
    const at = Date.parse(scored.item.startsAt);
    if (at < now.getTime() - 3_600_000 || at > weekEnd) continue;
    const date = new Date(at);
    candidates.push({
      kind: "event",
      score: adjust(scored.match, {
        priceCents: scored.item.priceCents,
        tags: [scored.item.kind, ...scored.item.tags],
        walk: null,
        dialSet,
      }),
      priceCents: scored.item.priceCents,
      walk: null,
      day: date.getDay(),
      dateIso: date.toISOString(),
      title: scored.item.title,
      detail: `${scored.item.venue} · ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
      reasons: scored.reasons,
      refId: scored.item.id,
      href: `/events/${scored.item.id}`,
      tags: [scored.item.kind, ...scored.item.tags],
    });
  }

  /* Places have no date; they fill days events left open, and only the two
     best so the week does not become a list of cafés. */
  for (const scored of input.places.slice(0, 8)) {
    const cents = scored.item.price === null ? 0 : Math.round(scored.item.price * 100);
    candidates.push({
      kind: "place",
      score:
        adjust(scored.match, { priceCents: cents, tags: scored.item.layers, walk: scored.item.walkMinutes, dialSet }) -
        6,
      priceCents: cents,
      walk: scored.item.walkMinutes,
      day: -1,
      dateIso: "",
      title: scored.item.name,
      detail: scored.item.why,
      reasons: scored.reasons,
      refId: scored.item.id,
      href: `/discover/${scored.item.id}`,
      tags: scored.item.layers,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const takenDays = new Set<number>();
  const items: WeekItem[] = [];
  let total = 0;
  let placesUsed = 0;

  const fits = (cents: number) => budget === null || total + cents <= budget;

  for (const candidate of candidates) {
    if (items.length >= maxItems) break;
    if (!fits(candidate.priceCents)) continue;
    if (dialSet.has("free") && candidate.priceCents > 0) continue;

    let day = candidate.day;
    let dateIso = candidate.dateIso;

    if (candidate.kind === "place") {
      if (placesUsed >= 2) continue;
      /* First free day from tomorrow. */
      const slot = firstOpenDay(now, takenDays);
      if (!slot) continue;
      day = slot.day;
      dateIso = slot.dateIso;
      placesUsed += 1;
    } else if (takenDays.has(day)) {
      continue;
    }

    takenDays.add(day);
    total += candidate.priceCents;
    items.push({
      day,
      dateIso,
      kind: candidate.kind,
      refId: candidate.refId,
      title: candidate.title,
      detail: candidate.detail,
      priceCents: candidate.priceCents,
      walkMinutes: candidate.walk,
      reasons: candidate.reasons,
      href: candidate.href,
    });
  }

  items.sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  const fmt = input.formatMoney;
  const free = items.filter((item) => item.priceCents === 0).length;
  const summary =
    items.length === 0
      ? "Nothing fits those settings this week. Loosen a dial."
      : items.every((item) => item.priceCents === 0)
        ? `${items.length} things, all free.`
        : `${items.length} things, ${fmt(total)} in total${free > 0 ? `, ${free} of them free` : ""}${
            budget !== null ? `. Leaves ${fmt(Math.max(0, budget - total))} of the week's room.` : "."
          }`;

  return { items, totalCents: total, budgetCents: budget, thin: items.length < 2, summary };
}

function adjust(
  base: number,
  input: { priceCents: Cents; tags: readonly string[]; walk: number | null; dialSet: ReadonlySet<WeekDial> },
): number {
  let score = base;
  if (input.dialSet.has("cheaper")) score += input.priceCents === 0 ? 14 : input.priceCents <= 800 ? 6 : -12;
  if (input.dialSet.has("free")) score += input.priceCents === 0 ? 20 : -40;
  if (input.dialSet.has("social")) score += input.tags.some((tag) => SOCIAL_TAGS.has(tag)) ? 14 : -4;
  if (input.dialSet.has("active")) score += input.tags.some((tag) => ACTIVE_TAGS.has(tag)) ? 16 : -4;
  if (input.dialSet.has("less-travel") && input.walk !== null) score += input.walk <= 12 ? 10 : input.walk > 25 ? -14 : 0;
  return score;
}

function firstOpenDay(now: Date, taken: ReadonlySet<number>): { day: number; dateIso: string } | null {
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    date.setHours(18, 0, 0, 0);
    if (!taken.has(date.getDay())) return { day: date.getDay(), dateIso: date.toISOString() };
  }
  return null;
}

export const weekDialMeta: Record<WeekDial, string> = {
  cheaper: "Cheaper",
  social: "More social",
  free: "More free",
  active: "More active",
  "less-travel": "Less travel",
};
