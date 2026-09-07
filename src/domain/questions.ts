import type { Cents, Id, Iso } from "@/domain/types";
import type { ClaimSubject } from "@/domain/truth";

/**
 * ============================================================================
 * ASK STUDENTS
 * ----------------------------------------------------------------------------
 * What happens when the product does not know.
 *
 * Every other AI product answers anyway. That is the whole reason this module
 * exists: a confident wrong answer about where to print a thesis at 11pm costs
 * a student an evening, and costs the product the only thing it is actually
 * selling, which is that its answers are worth acting on. So when the truth
 * layer cannot reach `likely`, Ask does not guess and it does not shrug. It
 * turns the miss into a question, puts it in front of the students most likely
 * to know, and notifies the asker when someone answers.
 *
 * The loop that makes this compound:
 *
 *      a question nobody could answer
 *   →  routed to the smallest audience that plausibly knows
 *   →  answers from students who were there
 *   →  answers that agree become a Claim candidate  (see truth.ts)
 *   →  verified by other students
 *   →  the next student who asks gets an instant, sourced answer
 *
 * Each turn of that loop makes the product better at the thing it was worst
 * at, which is the definition of a moat that a general model cannot copy — the
 * model has the reasoning; it does not have the eleven students on this campus
 * who know which printer takes coins.
 *
 * The unanswered questions are as valuable as the answered ones and are fed to
 * the Unmet Need engine in `insight.ts`: a city with forty unanswered questions
 * about laundry is a roadmap.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Routing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Who gets shown a question.
 *
 * Narrow first, widen on silence (see `escalate`). A question about a specific
 * campus printer sent city-wide is noise for a thousand students and gets
 * ignored; the same question sent to the two hundred people on that campus
 * gets answered in an hour. Broadcasting is what kills community products, so
 * the default here is always the smallest audience that plausibly knows.
 */
export type QuestionAudience = "campus" | "city" | "community";

export const audienceLabel: Record<QuestionAudience, string> = {
  campus: "Students on your campus",
  city: "Students in your city",
  community: "A community you're in",
};

/**
 * Which audience an intent should start with.
 *
 * Anything about a specific building, timetable or service on site is a campus
 * question. Anything about the city as a whole starts city-wide because campus
 * is too narrow to have the answer. The intents are the ones already
 * classified by `classifyIntent` in `insight.ts`, so this table stays in step
 * with what the search-miss logger records.
 */
const campusIntents = new Set([
  "printing",
  "study-spot",
  "university",
  "library",
  "student-jobs",
  "societies",
]);

export function routeQuestion(intent: string, hasCampus: boolean): QuestionAudience {
  if (hasCampus && campusIntents.has(intent)) return "campus";
  return "city";
}

/**
 * How long a question waits before it is shown to a wider audience.
 *
 * Eighteen hours. Long enough that a campus question posted at midnight gets
 * the morning; short enough that a student asking about tonight is not still
 * waiting tomorrow night. A question that widens is never re-notified to the
 * people who already saw it.
 */
export const ESCALATE_AFTER_HOURS = 18;

/** A question with no answers goes quiet rather than sitting open forever. */
export const CLOSE_UNANSWERED_AFTER_DAYS = 21;

/* -------------------------------------------------------------------------- */
/* Rows                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * What kind of claim a good answer would yield, when the question is specific
 * enough to say. Null is the common case and is not a failure: "is this
 * neighbourhood any good" produces no structured claim, and pretending it does
 * is how a knowledge base fills with rows nobody can verify.
 */
export type ClaimSubjectHint = ClaimSubject | null;

export type Question = {
  id: Id;
  askerId: Id;
  citySlug: string;
  campusSlug: string | null;
  audience: QuestionAudience;
  /** Set when `audience` is "community". */
  communityId: Id | null;
  /** From `classifyIntent`. Groups questions for the Unmet Need engine. */
  intent: string;
  /** The question as a student would ask it. One line. */
  title: string;
  detail: string | null;
  /**
   * The Ask query that produced this, when it came from a low-confidence
   * answer rather than being typed directly. This is what lets the product
   * close the loop: when the question gets answered, the original asker is
   * told, and the answer is attached to the query that failed.
   */
  originQuery: string | null;
  /**
   * What kind of claim a good answer would produce. Set when the miss was
   * specific enough to know — a price question yields a `price` claim. Null
   * when the question is open-ended.
   */
  expectedSubject: ClaimSubject | null;
  status: "open" | "answered" | "closed";
  acceptedAnswerId: Id | null;
  /** Set when the question was widened past its original audience. */
  escalatedAt: Iso | null;
  createdAt: Iso;
  closedAt: Iso | null;
};

export type Answer = {
  id: Id;
  questionId: Id;
  userId: Id;
  body: string;
  /** Set when the answer names a place the product already knows. */
  placeId: Id | null;
  /** Set when the answer states a price. Feeds claim extraction. */
  amountCents: Cents | null;
  /** Other students marking this answer useful. Distinct users. */
  usefulCount: number;
  /** The asker's own verdict. Worth more than a stranger's upvote. */
  markedUsefulByAsker: boolean;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Consensus                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Distinct students who must agree before answers become a claim candidate.
 *
 * Two, not three. This is deliberately *lower* than the bar to publish a claim
 * (`MIN_DISTINCT_VERIFIERS`), because consensus here does not publish
 * anything — it creates a `candidate` row that still has to be verified by
 * three people before it can appear anywhere as fact. Two agreeing students is
 * a good enough reason to ask the rest of the city "is this right?", and a
 * higher bar here just means the loop rarely closes in a small city.
 */
export const CONSENSUS_MIN_ANSWERS = 2;

/**
 * How close two stated prices have to be to count as the same answer.
 *
 * A fifth. Students round, they remember the meal not the receipt, and one of
 * them had a drink with it. Requiring exact agreement would mean the loop
 * almost never closes on price questions, which are the questions students ask
 * most.
 */
export const PRICE_AGREEMENT_TOLERANCE = 0.2;

export type Consensus = {
  /** The answers that agree with each other. */
  agreeing: readonly Answer[];
  /** Distinct students behind the agreement. */
  voices: number;
  /** The place they agree on, when they named one. */
  placeId: Id | null;
  /** The median of the prices they gave, when they gave prices. */
  amountCents: Cents | null;
  /** Trust-weighted strength, used only to order candidates for review. */
  strength: number;
};

/**
 * Find the largest group of answers that are saying the same thing.
 *
 * "The same thing" is defined structurally, not semantically: same place, or
 * prices within `PRICE_AGREEMENT_TOLERANCE` of each other. This is a
 * deliberate refusal to use a model here. Semantic clustering of free text is
 * exactly the step where a plausible-sounding wrong grouping would enter the
 * knowledge base with a "students agree" badge on it, and once that happens
 * nothing else in the truth layer can catch it. Structured agreement is
 * narrower and it is checkable.
 *
 * Returns null when nothing agrees. That is a normal outcome and the caller
 * must handle it by leaving the question open rather than promoting the
 * best single answer.
 */
export function consensusOf(
  answers: readonly Answer[],
  trustOf: (userId: Id | null) => number = () => 1,
): Consensus | null {
  if (answers.length < CONSENSUS_MIN_ANSWERS) return null;

  /* One answer per student. Somebody adding three replies to their own answer
     is one voice, and treating it as three is how a single user manufactures
     consensus. */
  const byUser = new Map<Id, Answer>();
  for (const a of answers) {
    const held = byUser.get(a.userId);
    if (!held || a.createdAt < held.createdAt) byUser.set(a.userId, a);
  }
  const distinct = [...byUser.values()];
  if (distinct.length < CONSENSUS_MIN_ANSWERS) return null;

  const clusters: Answer[][] = [];

  for (const answer of distinct) {
    const fit = clusters.find((cluster) => cluster.every((other) => agree(answer, other)));
    if (fit) fit.push(answer);
    else clusters.push([answer]);
  }

  const best = clusters
    .filter((c) => c.length >= CONSENSUS_MIN_ANSWERS)
    .sort((a, b) => b.length - a.length)[0];

  if (!best) return null;

  const prices = best.map((a) => a.amountCents).filter((c): c is Cents => c !== null);
  const strength = best.reduce(
    (sum, a) => sum + trustOf(a.userId) * (a.markedUsefulByAsker ? 1.5 : 1) + a.usefulCount * 0.25,
    0,
  );

  return {
    agreeing: best,
    voices: best.length,
    placeId: best.find((a) => a.placeId)?.placeId ?? null,
    amountCents: prices.length ? median(prices) : null,
    strength: Number(strength.toFixed(3)),
  };
}

/**
 * Do two answers say the same thing?
 *
 * Both name the same place, or both give a price close enough to be the same
 * price. Two answers that share neither a place nor a price do not agree, even
 * if the prose looks similar — there is nothing here to check them against.
 */
function agree(a: Answer, b: Answer): boolean {
  if (a.placeId && b.placeId) {
    if (a.placeId !== b.placeId) return false;
    if (a.amountCents === null || b.amountCents === null) return true;
    return withinTolerance(a.amountCents, b.amountCents);
  }
  if (a.amountCents !== null && b.amountCents !== null) {
    /* Neither named a place we know. Agreeing on a number alone is weaker, but
       for "what does a haircut cost round here" it is the whole answer. */
    return !a.placeId && !b.placeId && withinTolerance(a.amountCents, b.amountCents);
  }
  return false;
}

function withinTolerance(a: Cents, b: Cents): boolean {
  const larger = Math.max(a, b);
  if (larger === 0) return a === b;
  return Math.abs(a - b) / larger <= PRICE_AGREEMENT_TOLERANCE;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                   */
/* -------------------------------------------------------------------------- */

/** Whether an open question has waited long enough to be shown more widely. */
export function shouldEscalate(question: Pick<Question, "status" | "audience" | "createdAt" | "escalatedAt">, answerCount: number, now = new Date()): boolean {
  if (question.status !== "open") return false;
  if (question.escalatedAt) return false;
  if (question.audience === "city") return false;
  if (answerCount > 0) return false;
  return now.getTime() - Date.parse(question.createdAt) >= ESCALATE_AFTER_HOURS * 3_600_000;
}

/** Whether an unanswered question should stop being shown. */
export function shouldClose(question: Pick<Question, "status" | "createdAt">, answerCount: number, now = new Date()): boolean {
  if (question.status !== "open") return false;
  if (answerCount > 0) return false;
  return now.getTime() - Date.parse(question.createdAt) >= CLOSE_UNANSWERED_AFTER_DAYS * 86_400_000;
}

/**
 * How well a question matches a student, for the "you could answer this" slot.
 *
 * Ranking rather than filtering: everyone in the audience *can* answer, but
 * showing a random open question is how a help feed becomes a chore. Score
 * favours questions this student is unusually likely to know — their campus,
 * their neighbourhood, a place they have saved or been to, a subject they have
 * contributed to before — and heavily favours questions nobody has answered,
 * because the second answer to a question is worth far less than the first.
 */
export function answerRelevance(
  question: Pick<Question, "campusSlug" | "intent" | "createdAt">,
  student: {
    campusSlug: string | null;
    /** Intents this student has answered or contributed claims about before. */
    knownIntents: readonly string[];
    /** Places they have saved, been to, or reported on. */
    familiarPlaceIds: readonly Id[];
  },
  answerCount: number,
  now = new Date(),
): number {
  let score = 0;

  if (question.campusSlug && question.campusSlug === student.campusSlug) score += 40;
  if (student.knownIntents.includes(question.intent)) score += 25;

  /* Unanswered questions dominate. A student who opens the help tab and sees
     one question they can be the first to answer will answer it; a student who
     sees six already-answered ones closes the tab. */
  if (answerCount === 0) score += 35;
  else score += Math.max(0, 12 - answerCount * 4);

  const ageHours = (now.getTime() - Date.parse(question.createdAt)) / 3_600_000;
  /* Fresh questions first, but never zero: a three-day-old unanswered question
     is a failure of the product, not of the question. */
  score += Math.max(0, 20 - ageHours);

  return score;
}
