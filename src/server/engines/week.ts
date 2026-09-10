import type { Place } from "@/data/types";
import type { Cents, CityEvent } from "@/domain/types";
import { fmtTime, weekdayIn } from "@/lib/dates";
import { WALK_METRES_PER_MINUTE, type Scored } from "@/server/engines/recommend";

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
  /**
   * 0-6, day of the week in the STUDENT'S CITY.
   *
   * It used to be `date.getDay()`, which is the day of the week where the
   * server happens to be. The comment already said "local" and the code could
   * not have known what local meant: on a UTC instance, a Madrid gig at 00:30
   * on Tuesday is 22:30 Monday, so the plan put it on Monday, refused to put
   * anything else on Monday, and left the student's Tuesday looking empty.
   * Every day in this engine now comes from `weekdayIn` with the city's zone.
   */
  day: number;
  /** The instant of the slot. The UI prints it with `fmtDay` in the city's zone. */
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
  /** The student's city, so a day of the week means their day of the week. */
  timeZone: string;
  events: readonly Scored<CityEvent>[];
  places: readonly Scored<Place>[];
  /** Money free for the coming seven days. Null when no budget is set. */
  weekBudgetCents: Cents | null;
  dials: readonly WeekDial[];
  maxItems?: number;
  formatMoney: (cents: Cents) => string;
}): WeekPlan {
  const { now, dials, timeZone } = input;
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
    /* The week plan prices every day and totals the week, so an event whose
       source published no price cannot be in it — counting it as zero would
       understate the week and guessing would invent the figure. It is still
       reachable everywhere events are listed rather than added up. */
    const priceCents = scored.item.priceCents;
    if (priceCents === null) continue;
    const date = new Date(at);
    candidates.push({
      kind: "event",
      score: adjust(scored.match, {
        priceCents,
        tags: [scored.item.kind, ...scored.item.tags],
        walk: null,
        dialSet,
      }),
      priceCents,
      walk: null,
      day: weekdayIn(date, timeZone),
      dateIso: date.toISOString(),
      title: scored.item.title,
      detail: `${scored.item.venue} · ${fmtTime(scored.item.startsAt, timeZone)}`,
      reasons: scored.reasons,
      refId: scored.item.id,
      href: `/events/${scored.item.id}`,
      tags: [scored.item.kind, ...scored.item.tags],
    });
  }

  /* Places have no date; they fill days events left open, and only the two
     best so the week does not become a list of cafés. */
  for (const scored of input.places.slice(0, 8)) {
    /* A place contributes NO money to the week. It used to contribute a
       hand-written price, which is how a week's budget came to include a
       number for a café nobody had been to. Zero is correct here because the
       week's total is money committed, and walking past a supermarket commits
       none of it. */
    const walkEquivalent = Math.round(scored.item.proximity.metres / WALK_METRES_PER_MINUTE);
    candidates.push({
      kind: "place",
      score:
        adjust(scored.match, {
          priceCents: 0,
          tags: scored.item.layers,
          walk: walkEquivalent,
          dialSet,
        }) - 6,
      priceCents: 0,
      walk: walkEquivalent,
      day: -1,
      dateIso: "",
      title: scored.item.name,
      detail: scored.item.value.reasons.join(" · ") || scored.item.category,
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
      const slot = firstOpenDay(now, takenDays, timeZone);
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

/**
 * The first day from tomorrow that nothing is on yet, in the city's week.
 *
 * It used to `setHours(18, 0, 0, 0)` — six in the evening where the server is,
 * which is eight in Madrid and eleven in the morning in New York, for a place
 * that has no time at all. Nothing rendered that hour; only the day was ever
 * printed. So the slot is now simply the same moment of day, that many days
 * later, and the day it falls on is asked of the city rather than of the
 * machine. Day and instant therefore always agree, which is the property the
 * screen depends on: it prints `day` from one and the date from the other.
 */
function firstOpenDay(
  now: Date,
  taken: ReadonlySet<number>,
  timeZone: string,
): { day: number; dateIso: string } | null {
  for (let offset = 1; offset <= 7; offset += 1) {
    const at = new Date(now.getTime() + offset * 86_400_000);
    const day = weekdayIn(at, timeZone);
    if (!taken.has(day)) return { day, dateIso: at.toISOString() };
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
