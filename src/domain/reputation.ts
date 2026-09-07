import type { Id, Iso } from "@/domain/types";

/**
 * ============================================================================
 * CONTRIBUTOR REPUTATION
 * ----------------------------------------------------------------------------
 * How much a student's word is worth, and why.
 *
 * This module exists for one reason: `truth.ts` has to decide whether three
 * people saying a discount is dead outweighs eleven people who said it worked
 * last term. Counting heads gets that wrong, because heads are cheap — a
 * merchant with four accounts can bury a bad report, and a first-day arrival
 * confirming a price they have not paid is noise wearing the same badge as a
 * student who eats there weekly.
 *
 * So reputation here is NOT a score to show off. It is an input to the truth
 * layer, and the visible level is a by-product. Three properties follow from
 * that and none of them are negotiable:
 *
 *   It is earned by being right, not by being active. Posting does nothing.
 *   Confirming something that later turns out to be wrong costs you. The only
 *   signals that pay are ones an outcome eventually validated.
 *
 *   It is per city. A student who spent four terms mapping cheap Madrid lunches
 *   knows nothing about Berlin transport on their first week there. Trust
 *   carries across cities at a discount (`CROSS_CITY_CARRY`) rather than at
 *   full value — enough that the Student Passport is worth having, not so much
 *   that it launders authority into a city they just landed in.
 *
 *   It decays. A City Expert who left eighteen months ago is a former City
 *   Expert; their reading of what a coffee costs today is out of date, and the
 *   product should not weight it as though they were still here.
 *
 * The visible ladder is deliberately shallow and unshowy — five rungs, no
 * points on screen. Reputation that becomes a game gets played, and a gamed
 * reputation is worse than no reputation because the truth layer trusts it.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Signals                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The things a student can do that earn trust.
 *
 * Every one of these is *validated by someone else*: a deal you submitted that
 * others then confirmed, an answer another student marked useful, a correction
 * that the later evidence agreed with. Nothing on this list can be triggered
 * by acting alone, which is what makes the score expensive to fake.
 */
export type ReputationSignal =
  /** Submitted a deal that independent students later confirmed works. */
  | "deal-confirmed"
  /** Reported a deal as dead, and the evidence went on to agree. */
  | "correction-upheld"
  /** Answered an Ask Students question and the asker marked it useful. */
  | "answer-useful"
  /** Answered, and the answer became the accepted one for that question. */
  | "answer-accepted"
  /** Submitted an event that ran and had attendance. */
  | "event-verified"
  /** Confirmed a place detail that later verifications agreed with. */
  | "place-confirmed"
  /** Contributed to a guide that students then saved in volume. */
  | "guide-saved"
  /** Completed an Exchange handover both sides marked fine. */
  | "exchange-completed"
  /** A price observation that sat inside the eventual student band. */
  | "price-accurate"
  /* --- the negatives ---------------------------------------------------- */
  /** Confirmed something that the evidence then showed was already dead. */
  | "confirmation-refuted"
  /** A contribution moderators removed. */
  | "contribution-removed";

/**
 * What each signal is worth.
 *
 * The asymmetry is intentional and it is the whole design: being wrong costs
 * roughly three times what being right pays. A contributor who confirms
 * indiscriminately to farm a level ends up below where they started, so the
 * cheapest strategy for a high score is to only confirm things you actually
 * checked — which is exactly the behaviour the truth layer needs.
 */
export const signalWeight: Record<ReputationSignal, number> = {
  "deal-confirmed": 6,
  "correction-upheld": 8,
  "answer-useful": 3,
  "answer-accepted": 7,
  "event-verified": 4,
  "place-confirmed": 2,
  "guide-saved": 3,
  "exchange-completed": 3,
  "price-accurate": 2,
  "confirmation-refuted": -12,
  "contribution-removed": -25,
};

export const signalLabel: Record<ReputationSignal, string> = {
  "deal-confirmed": "Deal confirmed by others",
  "correction-upheld": "Correction upheld",
  "answer-useful": "Helpful answer",
  "answer-accepted": "Accepted answer",
  "event-verified": "Event verified",
  "place-confirmed": "Place detail confirmed",
  "guide-saved": "Guide saved by students",
  "exchange-completed": "Exchange completed",
  "price-accurate": "Accurate price report",
  "confirmation-refuted": "Confirmed something that was already dead",
  "contribution-removed": "Contribution removed",
};

/**
 * One earned (or lost) signal.
 *
 * `refId` points at whatever validated it — the deal, the question, the
 * listing — so a student can always be shown *why* they hold the level they
 * hold. A reputation you cannot audit is a reputation students will not trust,
 * and staff cannot debug.
 */
export type ReputationEvent = {
  id: Id;
  userId: Id;
  /** The city the contribution was about, not where the student is now. */
  citySlug: string;
  signal: ReputationSignal;
  refKind: "deal" | "claim" | "question" | "answer" | "event" | "place" | "guide" | "listing" | "price";
  refId: Id;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Levels                                                                      */
/* -------------------------------------------------------------------------- */

export type ReputationLevel = "student" | "local" | "contributor" | "campus-insider" | "city-expert";

export const reputationLevels: readonly {
  level: ReputationLevel;
  /** Decayed points at or above which the level is held. */
  min: number;
  label: string;
  /** Shown once, on the passport. Never as a badge next to every post. */
  note: string;
}[] = [
  { level: "student", min: 0, label: "Student", note: "Everyone starts here." },
  { level: "local", min: 25, label: "Local", note: "Knows their way around." },
  { level: "contributor", min: 90, label: "Contributor", note: "Adds things other students rely on." },
  { level: "campus-insider", min: 220, label: "Campus Insider", note: "The person to ask about this campus." },
  { level: "city-expert", min: 500, label: "City Expert", note: "Consistently right about this city." },
];

export function levelOf(points: number): ReputationLevel {
  let held: ReputationLevel = "student";
  for (const rung of reputationLevels) if (points >= rung.min) held = rung.level;
  return held;
}

export function levelLabel(level: ReputationLevel): string {
  return reputationLevels.find((r) => r.level === level)?.label ?? "Student";
}

/* -------------------------------------------------------------------------- */
/* Decay and trust                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Half-life of a reputation signal, in days.
 *
 * A year. Long enough that a student who contributed heavily in first term is
 * still trusted in second term; short enough that someone who left two years
 * ago has faded to a quarter of their peak, which is about right for how much
 * their knowledge of current prices is worth.
 */
export const REPUTATION_HALF_LIFE_DAYS = 365;

/** What a student's out-of-city reputation is worth in a city they just moved to. */
export const CROSS_CITY_CARRY = 0.35;

/**
 * The ceiling on how much one student's verification can be worth.
 *
 * Trust is a multiplier applied to a single verification in `truth.ts`. If it
 * could grow without bound, one City Expert would be able to publish a claim
 * alone, and the whole layer would collapse into "whatever the most active
 * account says". Capping at 2.5 means the very best contributor is worth two
 * and a half ordinary students — meaningful, never decisive.
 */
export const MAX_TRUST = 2.5;

/** Below this, a brand-new account still counts, but only just. */
export const MIN_TRUST = 0.5;

const DAY_MS = 86_400_000;

function decayed(events: readonly ReputationEvent[], now: Date): number {
  let points = 0;
  for (const event of events) {
    const ageDays = Math.max(0, (now.getTime() - Date.parse(event.createdAt)) / DAY_MS);
    const weight = signalWeight[event.signal] ?? 0;
    /* Penalties do NOT decay as fast as credit. Something removed for being
       wrong stays relevant longer than something right stays impressive —
       otherwise waiting out a penalty is a strategy. */
    const halfLife = weight < 0 ? REPUTATION_HALF_LIFE_DAYS * 2 : REPUTATION_HALF_LIFE_DAYS;
    points += weight * Math.pow(0.5, ageDays / halfLife);
  }
  return points;
}

export type Reputation = {
  /** Decayed points in this city. Never shown as a number in the product. */
  points: number;
  level: ReputationLevel;
  label: string;
  /** Multiplier the truth layer applies to this student's verifications. */
  trust: number;
  /** Points needed for the next rung, or null at the top. */
  toNext: number | null;
  nextLabel: string | null;
  /** How many validated contributions are behind the level. */
  contributions: number;
};

/**
 * A student's standing, from their whole signal history.
 *
 * `citySlug` is the city being asked about. Signals earned elsewhere are
 * carried in at `CROSS_CITY_CARRY`, which is what makes the Student Passport
 * mean something when a Madrid student starts a semester in Berlin without
 * making them an instant authority on Berlin.
 */
export function reputationFor(
  events: readonly ReputationEvent[],
  citySlug: string,
  now = new Date(),
): Reputation {
  const here = events.filter((e) => e.citySlug === citySlug);
  const elsewhere = events.filter((e) => e.citySlug !== citySlug);

  const points = decayed(here, now) + decayed(elsewhere, now) * CROSS_CITY_CARRY;
  const level = levelOf(points);
  const rungIndex = reputationLevels.findIndex((r) => r.level === level);
  const next = reputationLevels[rungIndex + 1] ?? null;

  return {
    points,
    level,
    label: levelLabel(level),
    trust: trustFromPoints(points),
    toNext: next ? Math.max(0, Math.round(next.min - points)) : null,
    nextLabel: next?.label ?? null,
    contributions: here.filter((e) => signalWeight[e.signal] > 0).length,
  };
}

/**
 * Points to a verification multiplier.
 *
 * Logarithmic rather than linear, so the gap between a new student and a solid
 * contributor is large and the gap between a solid contributor and the single
 * most prolific account in the city is small. The alternative — linear growth —
 * hands the city to whoever posts most, which is a popularity contest, not a
 * measure of being right.
 *
 * A student with a negative history falls below `MIN_TRUST` to a floor of
 * near-zero: their reports are still recorded (we never silently discard a
 * report) but they no longer move confidence on their own.
 */
export function trustFromPoints(points: number): number {
  if (points < 0) return Math.max(0.05, MIN_TRUST + points / 200);
  const raw = MIN_TRUST + Math.log10(1 + points / 10) * 1.15;
  return Math.min(MAX_TRUST, Number(raw.toFixed(3)));
}

/**
 * Trust for a set of users in one call.
 *
 * Every consumer in `truth.ts` needs "trust of the person who filed this
 * verification" for a whole list at once, and doing it per row would mean
 * re-scanning the event table per verification. Returns a plain lookup with a
 * default, so callers never have to handle a missing user.
 */
export function trustIndex(
  events: readonly ReputationEvent[],
  citySlug: string,
  now = new Date(),
): (userId: Id | null) => number {
  const byUser = new Map<Id, ReputationEvent[]>();
  for (const event of events) {
    const list = byUser.get(event.userId);
    if (list) list.push(event);
    else byUser.set(event.userId, [event]);
  }

  const cache = new Map<Id, number>();
  return (userId) => {
    if (!userId) return MIN_TRUST;
    const hit = cache.get(userId);
    if (hit !== undefined) return hit;
    const trust = reputationFor(byUser.get(userId) ?? [], citySlug, now).trust;
    cache.set(userId, trust);
    return trust;
  };
}
