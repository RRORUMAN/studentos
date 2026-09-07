import type { Cents, Id, Iso } from "@/domain/types";
import type { Confidence } from "@/domain/knowledge";

/**
 * ============================================================================
 * LOCAL TRUTH
 * ----------------------------------------------------------------------------
 * One shape for everything the product knows about a city because a student
 * told it, and one function that decides whether that thing is safe to print.
 *
 * Why this exists as its own layer rather than a `confirmations` column on
 * each table: the product asserts prices, opening hours, discounts, "they let
 * you sit here for three hours", "the 8pm one is free for students". Those
 * came from different places, go stale at wildly different speeds, and were
 * true when they were written. A per-table integer counter cannot express any
 * of that, so every surface ends up inventing its own idea of "verified" and
 * they disagree. One `Claim` with one `assess()` means the badge on Explore,
 * the answer in Ask, and the row in the AI's tool output all mean the same
 * thing.
 *
 * The rules that produce that number, in the order they matter:
 *
 *   1. NEGATIVE EVIDENCE OUTRANKS POSITIVE. Someone standing in the shop being
 *      told the discount ended knows something that forty people who used it
 *      last term do not. Recent contradiction moves a claim to `disputed`
 *      before any amount of stale agreement can hold it at `verified`.
 *
 *   2. PEOPLE, NOT REPORTS. Confidence counts distinct verifiers. Ten
 *      confirmations from one account is one person who likes tapping.
 *
 *   3. THE AUTHOR IS NOT A WITNESS. The student who submitted a claim cannot
 *      verify it. Neither can the merchant whose shop it is about.
 *
 *   4. TRUST WEIGHTS, IT DOES NOT DECIDE. A City Expert counts for 2.5
 *      ordinary students (see `reputation.ts`), which is never enough to reach
 *      `verified` alone — that needs `MIN_DISTINCT_VERIFIERS` real people.
 *
 *   5. EVERYTHING ROTS AT ITS OWN RATE. A lunch price is a different kind of
 *      fact from a visa requirement. `subjectHalfLife` is the only place that
 *      difference is encoded.
 *
 * The existing `dealConfidence` in `knowledge.ts` is the ancestor of this
 * function and stays where it is: it is what the shipped deal surfaces use and
 * it has tests pinned to its exact thresholds. `assess()` is the general case
 * and reports the same `Confidence` union, so a caller can move from one to
 * the other without every badge in the product changing meaning.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* What a claim can be about                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The kind of fact being asserted. This decides how fast it goes stale and how
 * loudly the UI hedges, so it is a closed union rather than a string.
 */
export type ClaimSubject =
  /** "20% off with student ID." */
  | "student-offer"
  /** "Lunch is about €8." Carries `amountCents`. */
  | "price"
  /** "Open until 23:00 on weekdays." */
  | "hours"
  /** "There are plugs at the back and nobody minds if you stay." */
  | "amenity"
  /** "Free entry before 21:00 for students." */
  | "access"
  /** "The Tuesday language exchange is at this bar." */
  | "recurring-event"
  /** "This place closed." The retraction of everything else about it. */
  | "closure"
  /** "You need your enrolment letter, not just the card." */
  | "requirement"
  /** Anything a student found useful that does not fit above. */
  | "tip";

export const claimSubjectMeta: Record<
  ClaimSubject,
  { label: string; verb: string; /** Days after which the UI starts hedging. */ staleAfterDays: number }
> = {
  "student-offer": { label: "Student offer", verb: "Still available?", staleAfterDays: 30 },
  price: { label: "Price", verb: "Still about right?", staleAfterDays: 45 },
  hours: { label: "Opening hours", verb: "Still open then?", staleAfterDays: 90 },
  amenity: { label: "What it's like", verb: "Still true?", staleAfterDays: 180 },
  access: { label: "Student access", verb: "Still free?", staleAfterDays: 45 },
  "recurring-event": { label: "Regular event", verb: "Still running?", staleAfterDays: 30 },
  closure: { label: "Closed", verb: "Confirm it's gone?", staleAfterDays: 365 },
  requirement: { label: "What you need", verb: "Still what they ask for?", staleAfterDays: 120 },
  tip: { label: "Student tip", verb: "Still good advice?", staleAfterDays: 180 },
};

/**
 * How quickly evidence about each subject loses its weight, in days.
 *
 * These are half-lives, not expiry dates. A three-week-old confirmation of a
 * lunch price is worth about two thirds of a fresh one; a three-week-old
 * confirmation of a visa requirement is worth almost all of one. Getting this
 * wrong in either direction is a real product failure — too fast and nothing
 * is ever verified in a small city, too slow and the app confidently sends a
 * student to a discount that died in the summer.
 */
export const subjectHalfLife: Record<ClaimSubject, number> = {
  "student-offer": 25,
  price: 40,
  hours: 75,
  amenity: 160,
  access: 40,
  "recurring-event": 21,
  closure: 240,
  requirement: 110,
  tip: 150,
};

/** Where a claim came from, before anyone verified it. */
export type ClaimSourceType =
  /** A student typed it into the product deliberately. */
  | "student-report"
  /** Pulled out of a community post by the extractor. Never published unread. */
  | "extracted-post"
  /** An answer to an Ask Students question that several students agreed with. */
  | "student-answer"
  /** The venue itself, through the merchant portal. Interested party. */
  | "merchant"
  /** A university, transit authority or government page, with a URL. */
  | "official"
  /** Written by the StudentOS team from a cited source. */
  | "editorial";

/**
 * How much the source alone is worth before a single student verifies it.
 *
 * `merchant` sits *below* `student-report` on purpose. A shop has every
 * incentive to say its discount is live and none to tell us it ended, so a
 * merchant claim is a lead, not a fact, until students confirm it. Saying that
 * out loud in a constant is better than discovering it in a post-mortem.
 */
export const sourcePrior: Record<ClaimSourceType, number> = {
  official: 3.5,
  editorial: 1.5,
  "student-report": 1,
  "student-answer": 1,
  merchant: 0.6,
  "extracted-post": 0.4,
};

/* -------------------------------------------------------------------------- */
/* The claim                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A single assertion about a city, with everything needed to decide whether to
 * show it and everything needed to explain that decision to a student.
 */
export type Claim = {
  id: Id;
  citySlug: string;
  /** Set when the claim is only relevant to one campus's students. */
  campusSlug: string | null;
  subject: ClaimSubject;
  /** What the claim is about. Null target means it is about the city itself. */
  targetKind: "place" | "event" | "deal" | "route" | "neighbourhood" | null;
  targetId: Id | null;
  /** One sentence, as a student would say it. This is what gets rendered. */
  statement: string;
  /**
   * The machine-readable core, when there is one. `price` claims carry
   * `amountCents`; `hours` carry `untilHour`. Engines read this; the UI reads
   * `statement`. Keeping both means a claim stays useful to the budget engine
   * without the feed having to render a struct.
   */
  amountCents: Cents | null;
  sourceType: ClaimSourceType;
  /** Required for `official`. Null otherwise — students are not URLs. */
  sourceUrl: string | null;
  /** Null for editorial and official rows. */
  submittedBy: Id | null;
  /**
   * The Ask Students question whose agreeing answers produced this, when it
   * came from that loop rather than from a form.
   *
   * A column rather than a marker inside `statement`, because provenance that
   * lives in the display string has to be stripped at every render site and
   * will eventually be shown to a student by the one that forgot. It also
   * makes promotion idempotent with a real uniqueness check.
   */
  derivedFromQuestionId: Id | null;
  createdAt: Iso;
  /** Last time ANY evidence touched this claim, positive or negative. */
  lastSeenAt: Iso;
  /** Last time someone other than the author confirmed it. */
  lastVerifiedAt: Iso | null;
  /**
   * Set when a newer claim replaces this one — a price that moved, hours that
   * changed. Superseded claims are never shown but are never deleted either:
   * the history is what lets the product say "this went up in October".
   */
  supersededBy: Id | null;
  /**
   * `candidate` rows are extracted or unverified and appear only where the UI
   * explicitly asks students to check them. `published` rows can appear
   * anywhere. `retired` rows are gone.
   */
  status: "candidate" | "published" | "retired";
};

/** One student's verdict on one claim. */
export type Verification = {
  id: Id;
  claimId: Id;
  userId: Id;
  verdict:
    /** "I was there, this is right." */
    | "confirmed"
    /** "Right thing, wrong number." Carries `correctionCents` where relevant. */
    | "changed"
    /** "This is over / this place is gone." */
    | "gone"
    /** "This was never true." The strongest negative. */
    | "wrong";
  correctionCents: Cents | null;
  note: string | null;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Thresholds                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Distinct people required before a claim can read `verified`.
 *
 * Three. Two is a pair of friends and one is an anecdote. This is a hard gate
 * that no amount of reputation can open, which is the single most important
 * line in the file: it means a well-reputed account cannot unilaterally
 * publish a price into the recommendation engine.
 */
export const MIN_DISTINCT_VERIFIERS = 3;

/** Distinct people required for `likely`. */
export const MIN_LIKELY_VERIFIERS = 2;

/** Weighted positive share needed for `verified`, then for `likely`. */
export const VERIFIED_RATIO = 0.8;
export const LIKELY_RATIO = 0.6;

/**
 * How recent a negative report has to be to force `disputed` on its own.
 *
 * Two weeks. Someone who was turned away yesterday is describing the world as
 * it is now; someone turned away in April may have hit a closed-for-holidays
 * week. Inside the window a single credible negative is enough to pull the
 * badge down, because the cost of sending a student to a dead discount is much
 * higher than the cost of showing "unconfirmed" on a live one.
 */
export const FRESH_NEGATIVE_DAYS = 14;

/**
 * The trust multiplier used when a caller supplies no reputation index.
 *
 * One, meaning "weight every student equally". Deliberately a local constant
 * rather than an import from `reputation.ts`: the truth layer must be usable —
 * and unit-testable — without the reputation table, and a caller that has not
 * loaded reputation should get an even-handed reading rather than one silently
 * pinned to the floor trust of a brand-new account.
 */
const UNWEIGHTED = 1;

const DAY_MS = 86_400_000;

/* -------------------------------------------------------------------------- */
/* Assessment                                                                  */
/* -------------------------------------------------------------------------- */

export type TruthAssessment = {
  confidence: Confidence;
  /** Distinct people who said yes. The number the UI is allowed to print. */
  verificationCount: number;
  /** Distinct people who said no. */
  negativeVerificationCount: number;
  lastVerifiedAt: Iso | null;
  /** Whole days since the last verification, or since creation if never. */
  ageDays: number;
  /** True once past this subject's `staleAfterDays`. The UI must hedge. */
  stale: boolean;
  /** A correction the evidence agrees on, when verifiers supplied one. */
  suggestedCents: Cents | null;
  /** One line explaining the verdict, in the student's words not ours. */
  reason: string;
};

/**
 * Decide what a claim is worth right now.
 *
 * Pure, and `now` is a parameter, so the whole table above is testable against
 * a fixed clock rather than "whatever today is" — which matters more here than
 * anywhere else in the product, because every threshold in this file is a
 * decision about time.
 *
 * `trustOf` comes from `trustIndex()` in `reputation.ts`. Passing it in rather
 * than importing a lookup keeps this function pure and lets the caller decide
 * which city's reputation applies.
 */
export function assess(
  claim: Pick<
    Claim,
    "id" | "subject" | "sourceType" | "submittedBy" | "createdAt" | "lastVerifiedAt"
  >,
  verifications: readonly Verification[],
  trustOf: (userId: Id | null) => number = () => UNWEIGHTED,
  now = new Date(),
): TruthAssessment {
  const halfLife = subjectHalfLife[claim.subject];

  /* One verdict per person: the most recent one they filed. A student who
     confirmed a discount in March and reported it gone in October is telling
     us it is gone, not both. */
  const latestByUser = new Map<Id, Verification>();
  for (const v of verifications) {
    /* Rule 3: the author is not a witness. */
    if (v.userId === claim.submittedBy) continue;
    const held = latestByUser.get(v.userId);
    if (!held || v.createdAt > held.createdAt) latestByUser.set(v.userId, v);
  }

  let positive = sourcePrior[claim.sourceType] * Math.pow(0.5, ageInDays(claim.createdAt, now) / halfLife);
  let negative = 0;
  let confirms = 0;
  let denials = 0;
  let lastVerifiedAt: Iso | null = null;
  let freshNegative = false;
  const corrections: Cents[] = [];

  for (const v of latestByUser.values()) {
    const ageDays = ageInDays(v.createdAt, now);
    const weight = trustOf(v.userId) * Math.pow(0.5, ageDays / halfLife);

    if (v.verdict === "confirmed") {
      positive += weight;
      confirms += 1;
      if (!lastVerifiedAt || v.createdAt > lastVerifiedAt) lastVerifiedAt = v.createdAt;
      continue;
    }

    denials += 1;
    /* "wrong" is a stronger signal than "changed": one says the claim never
       held, the other says the shape is right and a detail moved. */
    negative += weight * (v.verdict === "wrong" ? 1.5 : v.verdict === "gone" ? 1.3 : 1);
    if (ageDays <= FRESH_NEGATIVE_DAYS) freshNegative = true;
    if (v.verdict === "changed" && v.correctionCents !== null) corrections.push(v.correctionCents);
  }

  const anchorAt = lastVerifiedAt ?? claim.lastVerifiedAt ?? claim.createdAt;
  const ageDays = ageInDays(anchorAt, now);
  const stale = ageDays > claimSubjectMeta[claim.subject].staleAfterDays;
  const suggestedCents = corrections.length ? median(corrections) : null;

  const base = {
    verificationCount: confirms,
    negativeVerificationCount: denials,
    lastVerifiedAt,
    ageDays,
    stale,
    suggestedCents,
  };

  /* Rule 1, applied before anything else can rescue the claim. */
  if (freshNegative && negative >= positive * 0.5) {
    const gone = [...latestByUser.values()].some(
      (v) => v.verdict === "gone" && ageInDays(v.createdAt, now) <= FRESH_NEGATIVE_DAYS,
    );
    return {
      ...base,
      confidence: gone ? "expired" : "disputed",
      reason: gone
        ? `${denials === 1 ? "A student" : `${denials} students`} recently reported this has ended.`
        : `Recent reports disagree with this.`,
    };
  }

  if (negative > positive) {
    return { ...base, confidence: "disputed", reason: "More students say this is wrong than right." };
  }

  const total = positive + negative;
  const ratio = total === 0 ? 0 : positive / total;

  if (confirms >= MIN_DISTINCT_VERIFIERS && ratio >= VERIFIED_RATIO && !stale) {
    return {
      ...base,
      confidence: "verified",
      reason: `Confirmed by ${confirms} students${ageDays <= 2 ? " today" : ` — last ${ageDays} days ago`}.`,
    };
  }

  if (confirms >= MIN_LIKELY_VERIFIERS && ratio >= LIKELY_RATIO) {
    return {
      ...base,
      confidence: "likely",
      reason: stale
        ? `${confirms} students confirmed this, but not recently.`
        : `${confirms} students have confirmed this.`,
    };
  }

  /* An official source with a URL is not "unconfirmed" in the way a student
     tip is — nobody needs to verify a transit authority's own fare table. It
     still goes stale, and `factFreshness` in `knowledge.ts` is what says so. */
  if (claim.sourceType === "official" && !stale) {
    return { ...base, confidence: "likely", reason: "From an official source." };
  }

  return {
    ...base,
    confidence: "unconfirmed",
    reason:
      confirms === 0
        ? "Nobody has confirmed this yet."
        : `Only ${confirms} student${confirms === 1 ? " has" : "s have"} confirmed this.`,
  };
}

/**
 * Whether a claim is solid enough to state without hedging.
 *
 * The single predicate the AI layer and the recommendation engine both use, so
 * that "confident enough to answer" cannot drift apart between them. Anything
 * below this threshold must be shown with its confidence attached, or routed to
 * Ask Students instead — see `questions.ts`.
 */
export function isPublishable(assessment: TruthAssessment): boolean {
  return assessment.confidence === "verified" || assessment.confidence === "likely";
}

/**
 * Whether the product should be actively asking students about this.
 *
 * Drives the "Still true?" prompts and the verification queue. Deliberately
 * includes `verified` rows that have gone stale: the claims most worth
 * re-checking are the ones the product is currently most confident about,
 * because those are the ones it is telling students to act on.
 */
export function needsVerification(assessment: TruthAssessment, subject: ClaimSubject): boolean {
  if (assessment.confidence === "disputed") return true;
  if (assessment.confidence === "expired") return false;
  if (assessment.stale) return true;
  return assessment.verificationCount < MIN_DISTINCT_VERIFIERS &&
    assessment.ageDays > claimSubjectMeta[subject].staleAfterDays / 3;
}

function ageInDays(at: Iso, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(at)) / DAY_MS));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
