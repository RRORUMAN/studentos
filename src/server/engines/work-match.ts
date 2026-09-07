import {
  type EmployerVerification,
  type LanguageLevel,
  type Opportunity,
  type RiskFlag,
  type ScheduleTag,
  type SkillKey,
  type WorkProfile,
  freshness,
  hourlyEquivalent,
  levelAtLeast,
  providerPrior,
  riskFlags,
  riskLevel,
  skillLabel,
  workKindMeta,
} from "@/domain/work";
import type { Cents } from "@/domain/types";

/**
 * ============================================================================
 * STUDENT FIT
 * ----------------------------------------------------------------------------
 * The ranking behind "here are the seven that actually fit you".
 *
 * The shape is deliberate and it is not an LLM. A model ranks fluently and
 * cannot tell you why, cannot be tested, and costs money per student per
 * scroll. This is arithmetic over stated facts, and every point of the score
 * comes back attached to the fact that produced it — so a student who
 * disagrees with the order can see which input caused it and change that
 * input. A model's job here is downstream: turning these typed signals into a
 * sentence, never deciding them.
 *
 * THREE RULES, each of which exists because breaking it is how a job board
 * starts costing students money:
 *
 *   AN UNKNOWN IS NEVER A BONUS. A posting that does not state pay scores
 *   `NEUTRAL` on pay, not zero and not the average of the ones that do. It
 *   also emits a `pay-not-stated` signal, so silence is visible rather than
 *   quietly rounded into "fine". The same holds for hours, languages and
 *   whether international students are welcome.
 *
 *   THE CATCH IS RETURNED WITH THE MATCH. `shortfalls` is populated for the
 *   top result too. A 94% that does not mention the shift ends at midnight in
 *   a city where the metro stops at half past is not a 94%.
 *
 *   NOTHING IS HIDDEN FOR BEING IMPERFECT — except a posting whose risk level
 *   says somebody is about to be defrauded. That one is withheld pending a
 *   human, and `blocked` says so rather than the row silently vanishing.
 *
 * Pure: `now` is a parameter, money is integer cents, and commute minutes
 * arrive as a lookup function so this file never touches geography.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Signals                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A fact about how this opportunity meets this student, in structured form.
 *
 * Facts, not sentences — `describeSignal` is the single place they become
 * English, so the copy can be translated, shortened for a card, or expanded on
 * a detail page without the scoring ever being touched.
 */
export type FitSignal =
  /* --- money ------------------------------------------------------------- */
  | { kind: "pay-meets-floor"; hourlyCents: Cents }
  | { kind: "pay-below-floor"; hourlyCents: Cents; floorCents: Cents }
  | { kind: "pay-fixed"; totalCents: Cents }
  | { kind: "pay-not-stated" }
  /* --- time -------------------------------------------------------------- */
  | { kind: "schedule-match"; tags: readonly ScheduleTag[] }
  | { kind: "schedule-clash"; needs: readonly ScheduleTag[] }
  | { kind: "hours-fit"; hours: number }
  | { kind: "hours-over"; hours: number; wanted: number }
  | { kind: "hours-not-stated" }
  /* --- place ------------------------------------------------------------- */
  | { kind: "remote" }
  | { kind: "near"; minutes: number }
  | { kind: "far"; minutes: number; tolerance: number }
  | { kind: "distance-unknown"; area: string | null }
  /* --- language ---------------------------------------------------------- */
  | { kind: "language-ok"; code: string }
  | { kind: "language-gap"; code: string; level: LanguageLevel }
  | { kind: "no-language-stated" }
  /* --- you --------------------------------------------------------------- */
  | { kind: "skill-match"; skills: readonly SkillKey[] }
  | { kind: "no-skill-overlap" }
  | { kind: "student-friendly" }
  | { kind: "international-friendly" }
  | { kind: "suitability-not-stated" }
  /* --- the source -------------------------------------------------------- */
  | { kind: "posted-recently"; days: number }
  | { kind: "ageing"; days: number }
  | { kind: "employer-checked"; state: EmployerVerification }
  | { kind: "employer-unchecked" }
  | { kind: "risk"; flags: readonly RiskFlag[] };

/**
 * How much a shortfall should worry the student, most first.
 *
 * A card has room for one, and the one it shows must be a genuine objection.
 * "No language requirement stated" is not a catch — it is the absence of a
 * wall — and printing it under "The catch:" makes the product look like it
 * cannot tell a problem from a blank field. Absences sort last; the things
 * that would actually stop somebody taking the job sort first.
 */
const SHORTFALL_SEVERITY: Record<FitSignal["kind"], number> = {
  risk: 0,
  "language-gap": 1,
  "schedule-clash": 2,
  "pay-below-floor": 3,
  far: 4,
  "hours-over": 5,
  "no-skill-overlap": 6,
  "pay-not-stated": 7,
  "distance-unknown": 8,
  ageing: 9,
  "hours-not-stated": 10,
  "suitability-not-stated": 11,
  "no-language-stated": 12,
  "employer-unchecked": 13,
  /* Positives never reach this table, but the record must be total. */
  "pay-meets-floor": 99,
  "pay-fixed": 99,
  "schedule-match": 99,
  "hours-fit": 99,
  remote: 99,
  near: 99,
  "language-ok": 99,
  "skill-match": 99,
  "student-friendly": 99,
  "international-friendly": 99,
  "posted-recently": 99,
  "employer-checked": 99,
};

/**
 * The shortfalls worth showing, worst first.
 *
 * Callers with room for one take the head; the detail screen shows them all.
 */
export function rankedShortfalls(shortfalls: readonly FitSignal[]): readonly FitSignal[] {
  return [...shortfalls].sort(
    (a, b) => SHORTFALL_SEVERITY[a.kind] - SHORTFALL_SEVERITY[b.kind],
  );
}

/**
 * The one shortfall a card should print, or null.
 *
 * Null when everything we know is merely unstated: a card that says "The
 * catch: nobody has checked who posted this" on every single row has trained
 * the student to skip the line by the fourth card, which is exactly when it
 * matters.
 */
export function headlineShortfall(shortfalls: readonly FitSignal[]): FitSignal | null {
  const worst = rankedShortfalls(shortfalls)[0];
  if (!worst) return null;
  return SHORTFALL_SEVERITY[worst.kind] <= 6 ? worst : null;
}

/** Whether a signal is a reason to apply or a reason to hesitate. */
export function isPositive(signal: FitSignal): boolean {
  switch (signal.kind) {
    case "pay-meets-floor":
    case "pay-fixed":
    case "schedule-match":
    case "hours-fit":
    case "remote":
    case "near":
    case "language-ok":
    case "skill-match":
    case "student-friendly":
    case "international-friendly":
    case "posted-recently":
    case "employer-checked":
      return true;
    default:
      return false;
  }
}

/**
 * Signals into English.
 *
 * `formatMoney` is injected rather than imported so this file stays free of
 * `Intl` and can be unit tested against exact strings — the same convention
 * the budget and neighbourhood engines use.
 */
export function describeSignal(
  signal: FitSignal,
  formatMoney: (cents: Cents) => string,
): string {
  switch (signal.kind) {
    case "pay-meets-floor":
      return `${formatMoney(signal.hourlyCents)} an hour`;
    case "pay-below-floor":
      return `${formatMoney(signal.hourlyCents)} an hour, under the ${formatMoney(signal.floorCents)} you set`;
    case "pay-fixed":
      return `${formatMoney(signal.totalCents)} for the job`;
    case "pay-not-stated":
      return "Pay not stated";
    case "schedule-match":
      return signal.tags.map(scheduleWord).join(" and ");
    case "schedule-clash":
      return `Wants ${signal.needs.map(scheduleWord).join(" or ")}, which you did not pick`;
    case "hours-fit":
      return `${signal.hours} hours a week`;
    case "hours-over":
      return `${signal.hours} hours a week, more than the ${signal.wanted} you want`;
    case "hours-not-stated":
      return "Hours not stated";
    case "remote":
      return "Remote";
    case "near":
      return `${signal.minutes} min from campus`;
    case "far":
      return `${signal.minutes} min away, past your ${signal.tolerance} min limit`;
    case "distance-unknown":
      return signal.area ? `In ${signal.area}, travel time unknown` : "No location given";
    case "language-ok":
      return `${languageName(signal.code)} is enough`;
    case "language-gap":
      return `Needs ${languageName(signal.code)} at ${signal.level} level`;
    case "no-language-stated":
      return "No language requirement stated";
    case "skill-match":
      return signal.skills.map((skill) => skillLabel[skill]).join(", ");
    case "no-skill-overlap":
      return "Nothing here matches the skills you listed";
    case "student-friendly":
      return "Says it suits students";
    case "international-friendly":
      return "Says international students are welcome";
    case "suitability-not-stated":
      return "Does not say whether it suits international students";
    case "posted-recently":
      if (signal.days < 1) return "Posted today";
      if (signal.days < 2) return "Posted yesterday";
      return `Posted ${Math.round(signal.days)} days ago`;
    case "ageing":
      return `Last seen ${Math.round(signal.days)} ${Math.round(signal.days) === 1 ? "day" : "days"} ago`;
    case "employer-checked":
      return signal.state === "trusted" ? "Employer reviewed" : "Employer email verified";
    case "employer-unchecked":
      return "Nobody has checked who posted this";
    case "risk":
      return "Flagged for review";
  }
}

function scheduleWord(tag: ScheduleTag): string {
  switch (tag) {
    case "weekday":
      return "Weekdays";
    case "evening":
      return "Evenings";
    case "weekend":
      return "Weekends";
    case "flexible":
      return "Flexible hours";
  }
}

/**
 * A display name for a language code.
 *
 * Deliberately a small table rather than `Intl.DisplayNames`: this module is
 * pure and `Intl` availability differs between the Node the tests run on and
 * the browser. An unknown code falls back to the code itself in upper case,
 * which is wrong-looking enough to get noticed and fixed, and never invents a
 * language name.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  ca: "Catalan",
  de: "German",
  fr: "French",
  it: "Italian",
  nl: "Dutch",
  pt: "Portuguese",
  et: "Estonian",
  pl: "Polish",
  cs: "Czech",
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Components                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The eight things §11 asks the ranking to weigh, and what each is worth.
 *
 * Pay and schedule lead because they are the two reasons a student takes or
 * refuses a job, and the two a general job board is worst at. Freshness and
 * trust are small: they are tie-breakers between comparable roles, not reasons
 * to bury a good match behind a stale one from a verified employer.
 */
export const fitWeights = {
  pay: 0.18,
  schedule: 0.18,
  language: 0.16,
  skills: 0.16,
  location: 0.14,
  suitability: 0.08,
  freshness: 0.05,
  trust: 0.05,
} as const;

export type FitComponent = keyof typeof fitWeights;

export const componentLabel: Record<FitComponent, string> = {
  pay: "Pay",
  schedule: "Schedule",
  language: "Language",
  skills: "Skills",
  location: "Distance",
  suitability: "Suits students",
  freshness: "Freshness",
  trust: "Who posted it",
};

/**
 * The score an unknown gets.
 *
 * Not zero, which would punish a source for being terse, and not one, which
 * would reward silence over a stated fact that happens to be unwelcome. The
 * accompanying "not stated" signal carries the information that we do not
 * know, which is the part that matters.
 */
const NEUTRAL = 0.5;

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

export type MatchInput = {
  opportunities: readonly Opportunity[];
  profile: WorkProfile;
  /**
   * Travel time to an opportunity, in minutes, or null when unknown.
   *
   * A function rather than a field on the row: distance depends on where the
   * *student* lives, and baking it into the opportunity would mean either a
   * per-student copy of every row or a distance from the wrong origin.
   */
  commuteMinutes?: (opportunity: Opportunity) => number | null;
  /** Employer verification by employer id. Absent ids are unverified. */
  verification?: ReadonlyMap<string, EmployerVerification>;
  /**
   * The going hourly rate for student work in this city, in cents.
   *
   * Feeds the implausible-pay check only. Null disables that check entirely —
   * an absent baseline must never manufacture a scam warning.
   */
  hourlyBaseline?: Cents | null;
  now: Date;
};

export type Match = {
  opportunity: Opportunity;
  /** 0–100. The number on the card. */
  fit: number;
  components: Record<FitComponent, number>;
  /** Why it fits. Ordered by weight, so the strongest reason reads first. */
  reasons: readonly FitSignal[];
  /** The catch. Populated for the top result too, deliberately. */
  shortfalls: readonly FitSignal[];
  /** Structural risk flags. Empty for almost everything. */
  risks: readonly RiskFlag[];
  /**
   * True when the posting is withheld pending moderation.
   *
   * The match is still returned, so the caller can decide between hiding it
   * and showing why it was withheld. Silently dropping it would leave a
   * student who saw it yesterday wondering whether they imagined it.
   */
  blocked: boolean;
};

/* -------------------------------------------------------------------------- */
/* The components, one function each                                           */
/* -------------------------------------------------------------------------- */

function scorePay(
  opportunity: Opportunity,
  profile: WorkProfile,
  push: (signal: FitSignal) => void,
): number {
  const pay = opportunity.pay;
  if (!pay) {
    push({ kind: "pay-not-stated" });
    return NEUTRAL;
  }

  if (pay.period === "fixed") {
    /* A fixed price for a gig is a complete answer on its own terms: the
       student can see the whole number and decide. There is no floor to
       compare it against without knowing the hours, and inventing those to
       manufacture an hourly rate is exactly what rule one forbids. */
    push({ kind: "pay-fixed", totalCents: pay.minCents });
    return 0.8;
  }

  const hourly = hourlyEquivalent(pay, opportunity.hoursMax ?? opportunity.hoursMin ?? null);
  if (hourly === null) {
    push({ kind: "pay-not-stated" });
    return NEUTRAL;
  }

  const floor = profile.minHourlyCents;
  if (floor === null || floor <= 0) {
    push({ kind: "pay-meets-floor", hourlyCents: hourly });
    return 0.75;
  }

  if (hourly < floor) {
    push({ kind: "pay-below-floor", hourlyCents: hourly, floorCents: floor });
    /* Under the floor is a real objection, not a disqualification: students
       take a job under their stated minimum all the time when the hours or
       the place are right, and removing it would decide that for them. */
    const ratio = hourly / floor;
    return Math.max(0, ratio * 0.6);
  }

  push({ kind: "pay-meets-floor", hourlyCents: hourly });
  /* Above the floor, more money is better, but with sharply diminishing
     returns — a job paying double the student's minimum is not twice as good
     as one paying it, and letting pay run away would flatten every other
     component into noise. */
  const headroom = Math.min(1, (hourly - floor) / floor);
  return 0.8 + 0.2 * headroom;
}

function scoreSchedule(
  opportunity: Opportunity,
  profile: WorkProfile,
  push: (signal: FitSignal) => void,
): number {
  const wanted = new Set(profile.availability);
  const offered = opportunity.schedule;

  let score: number;

  if (wanted.size === 0 || offered.length === 0) {
    /* Either side silent means we cannot say. */
    if (offered.length === 0) push({ kind: "hours-not-stated" });
    score = NEUTRAL;
  } else if (offered.includes("flexible")) {
    push({ kind: "schedule-match", tags: ["flexible"] });
    score = 1;
  } else {
    const overlap = offered.filter((tag) => wanted.has(tag));
    if (overlap.length > 0) {
      push({ kind: "schedule-match", tags: overlap });
      score = 0.8 + 0.2 * (overlap.length / offered.length);
    } else {
      push({ kind: "schedule-clash", needs: offered });
      score = 0.15;
    }
  }

  /* Hours are a second, softer question: a schedule that fits in principle can
     still be twenty hours a week the student does not have. */
  const hours = opportunity.hoursMin ?? opportunity.hoursMax;
  const wantedHours = profile.hoursPerWeek;
  if (hours !== null && hours !== undefined && wantedHours > 0) {
    if (hours > wantedHours * 1.25) {
      push({ kind: "hours-over", hours, wanted: wantedHours });
      score = Math.min(score, score * 0.65);
    } else {
      push({ kind: "hours-fit", hours });
    }
  }

  return score;
}

function scoreLocation(
  opportunity: Opportunity,
  profile: WorkProfile,
  minutes: number | null,
  push: (signal: FitSignal) => void,
): number {
  if (opportunity.remoteType === "remote") {
    push({ kind: "remote" });
    /* Remote is perfect for a student who wants it and merely fine for one who
       said they would rather be on site — some people take a job to get out of
       their room, and the preference is there to be respected. */
    return profile.remotePreference === "onsite" ? 0.55 : 1;
  }

  if (minutes === null) {
    push({ kind: "distance-unknown", area: opportunity.area });
    return NEUTRAL;
  }

  const tolerance = Math.max(10, profile.maxCommuteMinutes);
  if (minutes <= tolerance / 2) {
    push({ kind: "near", minutes });
    return 1;
  }
  if (minutes <= tolerance) {
    push({ kind: "near", minutes });
    return 1 - (0.3 * (minutes - tolerance / 2)) / Math.max(1, tolerance / 2);
  }

  push({ kind: "far", minutes, tolerance });
  const over = (minutes - tolerance) / Math.max(10, tolerance);
  return Math.max(0, 0.6 - over * 0.6);
}

function scoreLanguage(
  opportunity: Opportunity,
  profile: WorkProfile,
  push: (signal: FitSignal) => void,
): number {
  if (opportunity.languages.length === 0) {
    push({ kind: "no-language-stated" });
    return NEUTRAL;
  }

  const has = new Map(profile.languages.map((entry) => [entry.code.toLowerCase(), entry.level]));

  let met = 0;
  for (const requirement of opportunity.languages) {
    const level = has.get(requirement.code.toLowerCase());
    if (level && levelAtLeast(level, requirement.level)) {
      met += 1;
      push({ kind: "language-ok", code: requirement.code });
    } else {
      push({ kind: "language-gap", code: requirement.code, level: requirement.level });
    }
  }

  /* Language is the hardest wall an international student hits, and the one
     job boards are worst at surfacing. A missed requirement costs most of the
     component rather than a fraction of it. */
  return met === opportunity.languages.length ? 1 : met === 0 ? 0.1 : 0.45;
}

function scoreSkills(
  opportunity: Opportunity,
  profile: WorkProfile,
  push: (signal: FitSignal) => void,
): number {
  if (opportunity.skills.length === 0 || profile.skills.length === 0) return NEUTRAL;

  const mine = new Set(profile.skills);
  const overlap = opportunity.skills.filter((skill) => mine.has(skill));

  if (overlap.length === 0) {
    push({ kind: "no-skill-overlap" });
    /* Not near zero: most student work is learnable in a shift, and a product
       that only ever showed people what they had already done would be useless
       to a first-year with no history at all. */
    return 0.4;
  }

  push({ kind: "skill-match", skills: overlap });
  return 0.7 + 0.3 * (overlap.length / opportunity.skills.length);
}

function scoreSuitability(opportunity: Opportunity, push: (signal: FitSignal) => void): number {
  const student = opportunity.studentFriendly;
  const international = opportunity.internationalStudentFriendly;

  if (student === null && international === null) {
    push({ kind: "suitability-not-stated" });
    return NEUTRAL;
  }

  let score = NEUTRAL;
  if (student === true) {
    push({ kind: "student-friendly" });
    score = 0.8;
  }
  if (international === true) {
    push({ kind: "international-friendly" });
    score = 1;
  }
  /* An explicit "no" is the only case that scores below neutral, and it is
     information the student badly wants before spending an evening applying. */
  if (student === false || international === false) score = 0.15;

  return score;
}

function scoreFreshness(
  opportunity: Opportunity,
  now: Date,
  push: (signal: FitSignal) => void,
): number {
  const days = Math.max(0, (now.getTime() - new Date(opportunity.postedAt).getTime()) / 86_400_000);
  const state = freshness(opportunity, now);

  if (state === "fresh") {
    push({ kind: "posted-recently", days });
    return 1;
  }
  if (state === "ageing") {
    push({ kind: "ageing", days });
    return 0.6;
  }
  return 0.2;
}

function scoreTrust(
  opportunity: Opportunity,
  verification: EmployerVerification,
  push: (signal: FitSignal) => void,
): number {
  if (opportunity.provider === "students") {
    /* A student posting a gig is not an employer and is not pretending to be
       one. Neither a badge nor a warning is the honest answer; the safety copy
       on the card is. */
    return 0.7;
  }

  if (verification === "trusted") {
    push({ kind: "employer-checked", state: "trusted" });
    return 1;
  }
  if (verification === "verified") {
    push({ kind: "employer-checked", state: "verified" });
    return 0.85;
  }

  push({ kind: "employer-unchecked" });
  return providerPrior[opportunity.provider] * 0.6;
}

/* -------------------------------------------------------------------------- */
/* The ranking                                                                 */
/* -------------------------------------------------------------------------- */

const COMPONENT_ORDER: readonly FitComponent[] = [
  "pay",
  "schedule",
  "language",
  "skills",
  "location",
  "suitability",
  "freshness",
  "trust",
];

export function scoreOpportunity(
  opportunity: Opportunity,
  input: Omit<MatchInput, "opportunities">,
): Match {
  const signals: FitSignal[] = [];
  const push = (signal: FitSignal) => signals.push(signal);

  const minutes = input.commuteMinutes?.(opportunity) ?? null;
  const verification =
    (opportunity.employerId && input.verification?.get(opportunity.employerId)) || "unverified";

  const components: Record<FitComponent, number> = {
    pay: scorePay(opportunity, input.profile, push),
    schedule: scoreSchedule(opportunity, input.profile, push),
    language: scoreLanguage(opportunity, input.profile, push),
    skills: scoreSkills(opportunity, input.profile, push),
    location: scoreLocation(opportunity, input.profile, minutes, push),
    suitability: scoreSuitability(opportunity, push),
    freshness: scoreFreshness(opportunity, input.now, push),
    trust: scoreTrust(opportunity, verification, push),
  };

  const total = COMPONENT_ORDER.reduce(
    (sum, component) => sum + components[component] * fitWeights[component],
    0,
  );

  const risks = riskFlags(opportunity, input.hourlyBaseline ?? null);
  if (risks.length > 0) push({ kind: "risk", flags: risks });

  return {
    opportunity,
    fit: Math.round(clamp(total) * 100),
    components,
    reasons: signals.filter(isPositive),
    shortfalls: signals.filter((signal) => !isPositive(signal)),
    risks,
    blocked: riskLevel(risks) === "block",
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Rank a set of opportunities for one student.
 *
 * Blocked postings are returned at the end rather than dropped, so a caller
 * that renders a moderation queue and a caller that renders a student's feed
 * both read one function. `matchesForStudents` below is the one a student
 * surface should use.
 */
export function rankOpportunities(input: MatchInput): readonly Match[] {
  const { opportunities, ...context } = input;

  return opportunities
    .map((opportunity) => scoreOpportunity(opportunity, context))
    .sort((a, b) => {
      if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
      if (b.fit !== a.fit) return b.fit - a.fit;
      /* A stated wage breaks a tie: between two equally fitting roles, the one
         that tells the student what it pays is strictly more useful. */
      const pay = Number(Boolean(b.opportunity.pay)) - Number(Boolean(a.opportunity.pay));
      if (pay !== 0) return pay;
      return (
        new Date(b.opportunity.postedAt).getTime() - new Date(a.opportunity.postedAt).getTime()
      );
    });
}

/** What a student's feed shows: everything ranked, minus what is withheld. */
export function matchesForStudents(input: MatchInput): readonly Match[] {
  return rankOpportunities(input).filter((match) => !match.blocked);
}

/* -------------------------------------------------------------------------- */
/* Views                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The tabs on the Work screen, as predicates over a row.
 *
 * Views are filters over one ranked list rather than separate queries, so
 * "Weekend" is the same scoring in a narrower slice and a student never sees
 * one job rank differently in two places.
 */
export type WorkView =
  | "for-you"
  | "part-time"
  | "gigs"
  | "projects"
  | "remote"
  | "internships"
  | "campus"
  | "weekend"
  | "urgent";

export const workViewLabel: Record<WorkView, string> = {
  "for-you": "For you",
  "part-time": "Part-time",
  gigs: "Gigs",
  projects: "Projects",
  remote: "Remote",
  internships: "Internships",
  campus: "Campus",
  weekend: "Weekend",
  urgent: "Starting soon",
};

export const workViews = Object.keys(workViewLabel) as readonly WorkView[];

const URGENT_WINDOW_DAYS = 7;

export function inView(opportunity: Opportunity, view: WorkView, now: Date): boolean {
  const group = workKindMeta[opportunity.kind].group;

  switch (view) {
    case "for-you":
      return true;
    case "part-time":
      return opportunity.kind === "PART_TIME" || (group === "job" && (opportunity.hoursMax ?? 0) <= 30);
    case "gigs":
      return group === "gig";
    case "projects":
      return group === "project";
    case "remote":
      return opportunity.remoteType === "remote";
    case "internships":
      return group === "internship";
    case "campus":
      return opportunity.kind === "CAMPUS_JOB" || opportunity.campusSlug !== null;
    case "weekend":
      return opportunity.schedule.includes("weekend") || opportunity.schedule.includes("flexible");
    case "urgent": {
      if (!opportunity.startsAt) return false;
      const days = (new Date(opportunity.startsAt).getTime() - now.getTime()) / 86_400_000;
      return days >= 0 && days <= URGENT_WINDOW_DAYS;
    }
  }
}
