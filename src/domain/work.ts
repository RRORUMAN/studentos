import type { Cents, Id, Iso } from "@/domain/types";

/**
 * ============================================================================
 * WORK
 * ----------------------------------------------------------------------------
 * The vocabulary for StudentOS Work: one normalised opportunity, wherever it
 * came from — an external feed, a university careers page, an employer who
 * posted here, or a student who needs help carrying a sofa on Saturday.
 *
 * Four rules are enforced by the *types*, not by convention, because each one
 * is a way this product could quietly start lying to people who are deciding
 * where to spend their week:
 *
 *   1. MONEY IS NULLABLE. `payMinCents` is `Cents | null`. A feed that omits
 *      pay produces an opportunity with no pay, and the UI says so. There is
 *      no default, no "competitive", and no inferred band. A student choosing
 *      between a stated €14/hour and a guessed one is being misled, and the
 *      guess is the whole reason they would pick wrong.
 *
 *   2. SO IS SUITABILITY. `studentFriendly` and `internationalStudentFriendly`
 *      are `boolean | null`. Null means the source did not say. Rendering
 *      "international students welcome" because nothing said otherwise is the
 *      single most damaging thing this feature could do.
 *
 *   3. PROVENANCE TRAVELS. Every row carries `provider`, `sourceUrl` and
 *      `fetchedAt`. The canonical source URL is preserved and shown, always.
 *      Nothing is republished as though StudentOS were the origin.
 *
 *   4. WORK RIGHTS ARE NOT OURS TO DECIDE. There is a field for what the
 *      *source* said (`workAuthorizationNotes`) and nothing anywhere that
 *      computes an eligibility answer. See `src/data/work-rights.ts`.
 *
 * Pure. No I/O, no dates from the ambient clock — `now` is always a parameter.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Taxonomy                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The normalised kind of work. Deliberately wide: a provider adapter maps its
 * own vocabulary onto this list once, and every surface downstream reads one
 * set of names.
 *
 * `OTHER` is not a failure state. A feed with a category we have not modelled
 * yet should land in `OTHER` with its original wording preserved in the
 * description, rather than be forced into an adjacent kind that would make it
 * appear in a filter it does not belong to.
 */
export type WorkKind =
  | "PART_TIME"
  | "FULL_TIME"
  | "INTERNSHIP"
  | "FREELANCE"
  | "ONE_OFF_GIG"
  | "SHIFT"
  | "CAMPUS_JOB"
  | "REMOTE_PROJECT"
  | "TUTORING"
  | "EVENT_WORK"
  | "HOSPITALITY"
  | "RETAIL"
  | "DELIVERY"
  | "PET_SITTING"
  | "BABYSITTING"
  | "MOVING_HELP"
  | "PHOTOGRAPHY"
  | "DESIGN"
  | "MARKETING"
  | "SALES"
  | "CODING"
  | "LANGUAGE_HELP"
  | "CONTENT"
  | "ADMIN"
  | "OTHER";

/**
 * The four shapes work actually takes for a student, which is what the views
 * are built from. A kind belongs to exactly one group.
 */
export type WorkGroup = "job" | "gig" | "project" | "internship";

export type WorkKindMeta = {
  label: string;
  group: WorkGroup;
  /** Typical shape, used to pick sensible defaults in the posting form. */
  oneOff: boolean;
};

/**
 * The taxonomy table. Adding a kind is a single row here plus a mapping in the
 * provider adapters; nothing else in the codebase enumerates kinds by hand.
 */
export const workKindMeta: Record<WorkKind, WorkKindMeta> = {
  PART_TIME: { label: "Part-time", group: "job", oneOff: false },
  FULL_TIME: { label: "Full-time", group: "job", oneOff: false },
  INTERNSHIP: { label: "Internship", group: "internship", oneOff: false },
  FREELANCE: { label: "Freelance", group: "project", oneOff: false },
  ONE_OFF_GIG: { label: "One-off gig", group: "gig", oneOff: true },
  SHIFT: { label: "Shift", group: "gig", oneOff: true },
  CAMPUS_JOB: { label: "Campus job", group: "job", oneOff: false },
  REMOTE_PROJECT: { label: "Remote project", group: "project", oneOff: false },
  TUTORING: { label: "Tutoring", group: "gig", oneOff: false },
  EVENT_WORK: { label: "Event work", group: "gig", oneOff: true },
  HOSPITALITY: { label: "Hospitality", group: "job", oneOff: false },
  RETAIL: { label: "Retail", group: "job", oneOff: false },
  DELIVERY: { label: "Delivery", group: "job", oneOff: false },
  PET_SITTING: { label: "Pet sitting", group: "gig", oneOff: true },
  BABYSITTING: { label: "Babysitting", group: "gig", oneOff: true },
  MOVING_HELP: { label: "Moving help", group: "gig", oneOff: true },
  PHOTOGRAPHY: { label: "Photography", group: "gig", oneOff: true },
  DESIGN: { label: "Design", group: "project", oneOff: true },
  MARKETING: { label: "Marketing", group: "project", oneOff: false },
  SALES: { label: "Sales", group: "job", oneOff: false },
  CODING: { label: "Coding", group: "project", oneOff: false },
  LANGUAGE_HELP: { label: "Language help", group: "gig", oneOff: true },
  CONTENT: { label: "Content", group: "project", oneOff: true },
  ADMIN: { label: "Admin", group: "job", oneOff: false },
  OTHER: { label: "Other", group: "job", oneOff: false },
};

export const workKinds = Object.keys(workKindMeta) as readonly WorkKind[];

export function kindsInGroup(group: WorkGroup): readonly WorkKind[] {
  return workKinds.filter((kind) => workKindMeta[kind].group === group);
}

/* -------------------------------------------------------------------------- */
/* Skills, languages, schedule                                                 */
/* -------------------------------------------------------------------------- */

export type SkillKey =
  | "sales"
  | "marketing"
  | "coding"
  | "design"
  | "languages"
  | "tutoring"
  | "hospitality"
  | "retail"
  | "photography"
  | "video"
  | "writing"
  | "fitness"
  | "admin"
  | "childcare"
  | "driving"
  | "events"
  | "manual"
  | "other";

export const skillLabel: Record<SkillKey, string> = {
  sales: "Sales",
  marketing: "Marketing",
  coding: "Coding",
  design: "Design",
  languages: "Languages",
  tutoring: "Tutoring",
  hospitality: "Hospitality",
  retail: "Retail",
  photography: "Photography",
  video: "Video",
  writing: "Writing",
  fitness: "Fitness",
  admin: "Admin",
  childcare: "Childcare",
  driving: "Driving",
  events: "Events",
  manual: "Lifting and moving",
  other: "Other",
};

export const skillKeys = Object.keys(skillLabel) as readonly SkillKey[];

/**
 * Language ability, coarse on purpose.
 *
 * The four bands map onto the only distinction that changes whether a student
 * can take a job: can you deal with a customer, and can you deal with a
 * contract. A CEFR ladder would be more precise and much less honestly
 * answerable by someone filling in a form in ninety seconds.
 */
export type LanguageLevel = "basic" | "conversational" | "fluent" | "native";

export const languageLevelLabel: Record<LanguageLevel, string> = {
  basic: "Basic",
  conversational: "Conversational",
  fluent: "Fluent",
  native: "Native",
};

const LEVEL_RANK: Record<LanguageLevel, number> = {
  basic: 0,
  conversational: 1,
  fluent: 2,
  native: 3,
};

export function levelAtLeast(has: LanguageLevel, needs: LanguageLevel): boolean {
  return LEVEL_RANK[has] >= LEVEL_RANK[needs];
}

export type LanguageRequirement = { code: string; level: LanguageLevel };

/** When a student can actually work, in the only granularity that matters. */
export type ScheduleTag = "weekday" | "evening" | "weekend" | "flexible";

export const scheduleLabel: Record<ScheduleTag, string> = {
  weekday: "Weekdays",
  evening: "Evenings",
  weekend: "Weekends",
  flexible: "Flexible",
};

export const scheduleTags = Object.keys(scheduleLabel) as readonly ScheduleTag[];

export type RemoteType = "onsite" | "hybrid" | "remote";

export const remoteLabel: Record<RemoteType, string> = {
  onsite: "On site",
  hybrid: "Hybrid",
  remote: "Remote",
};

export type RemotePreference = "onsite" | "either" | "remote";

/* -------------------------------------------------------------------------- */
/* Pay                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * `fixed` is the whole-job price for a gig ("€40 to help me move"), which is
 * how students actually price small work and how nearly every job board fails
 * to model it.
 */
export type PayPeriod = "hour" | "day" | "week" | "month" | "year" | "fixed";

export const payPeriodLabel: Record<PayPeriod, string> = {
  hour: "per hour",
  day: "per day",
  week: "per week",
  month: "per month",
  year: "per year",
  fixed: "for the job",
};

/**
 * Stated pay, or the absence of it.
 *
 * There is no constructor that invents a band, and `min` is required once a
 * `Pay` exists at all. The nullable field on `Opportunity` is the entire
 * mechanism: no pay stated means no `Pay` object, never a zero.
 */
export type Pay = {
  minCents: Cents;
  /** Null when the source gave a single figure rather than a range. */
  maxCents: Cents | null;
  period: PayPeriod;
  currency: string;
};

/** The midpoint of a stated band, or the single figure. Never a guess. */
export function payMidpoint(pay: Pay): Cents {
  return pay.maxCents === null ? pay.minCents : Math.round((pay.minCents + pay.maxCents) / 2);
}

/**
 * An hourly equivalent, but only where one genuinely follows.
 *
 * A fixed price for an unspecified amount of work has no hourly rate, and
 * returning one would be inventing the hours. Weekly and monthly figures need
 * the contracted hours to convert, so they take them as an argument and
 * return null without.
 */
export function hourlyEquivalent(pay: Pay, hoursPerWeek: number | null): Cents | null {
  const mid = payMidpoint(pay);
  switch (pay.period) {
    case "hour":
      return mid;
    case "day":
      /* A working day is the one conversion with a defensible constant. */
      return Math.round(mid / 8);
    case "week":
      return hoursPerWeek && hoursPerWeek > 0 ? Math.round(mid / hoursPerWeek) : null;
    case "month":
      return hoursPerWeek && hoursPerWeek > 0 ? Math.round(mid / (hoursPerWeek * 4.33)) : null;
    case "year":
      return hoursPerWeek && hoursPerWeek > 0 ? Math.round(mid / (hoursPerWeek * 52)) : null;
    case "fixed":
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Employers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * What we have actually checked about whoever is offering the work.
 *
 *   unverified  Nothing has been checked. The default, and the honest one.
 *   verified    Someone proved control of an email address at the company's
 *               own domain.
 *   trusted     Verified, plus a human reviewed the account and it has a
 *               history of postings that were not reported.
 *
 * The badge copy in the UI states which of these was done. "Verified" that
 * means "we took their word for it" is worse than no badge, because it
 * transfers our credibility to a stranger.
 */
export type EmployerVerification = "unverified" | "verified" | "trusted";

export const verificationMeta: Record<
  EmployerVerification,
  { label: string; means: string }
> = {
  unverified: {
    label: "Not verified",
    means: "Nobody has checked who posted this. Treat it like a stranger's advert.",
  },
  verified: {
    label: "Email verified",
    means: "Someone proved they control an email address at this organisation's own domain. Nothing else has been checked.",
  },
  trusted: {
    label: "Reviewed",
    means: "Email verified, and a person at StudentOS reviewed the organisation and its past postings.",
  },
};

export type Employer = {
  id: Id;
  name: string;
  /** The organisation's own site. Never a StudentOS page. */
  websiteUrl: string | null;
  /** The domain the verification email was proved against, when there was one. */
  verifiedDomain: string | null;
  verification: EmployerVerification;
  verifiedAt: Iso | null;
  /** Set by a moderator. Blocks every posting from the account. */
  blockedAt: Iso | null;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Providers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Where a row came from.
 *
 *   students   A student posted it here. The student-to-student gig economy.
 *   employer   An organisation posted it here through the product.
 *   feed       An external feed or API we are permitted to read.
 *   campus     A university careers feed.
 *   sample     Seeded illustrative content. Labelled as such on every card.
 *
 * Note what is not here: a scraper. Reading a site that forbids it in its
 * terms or robots rules is not a source this product will have.
 */
export type ProviderKind = "students" | "employer" | "feed" | "campus" | "sample";

export const providerKindLabel: Record<ProviderKind, string> = {
  students: "Posted by a student",
  employer: "Posted by the employer",
  feed: "From a partner feed",
  campus: "From a university feed",
  sample: "Sample content",
};

/**
 * How much weight a source earns before anything else is known about the row.
 *
 * An employer posting on their own account is the most accountable source we
 * have: there is a person attached to it. A sample row scores lowest by a
 * distance so that a real listing always outranks illustrative content, in
 * every ordering, without any surface needing to remember to exclude it.
 */
export const providerPrior: Record<ProviderKind, number> = {
  employer: 1,
  campus: 0.95,
  students: 0.85,
  feed: 0.75,
  sample: 0.2,
};

/* -------------------------------------------------------------------------- */
/* The opportunity                                                             */
/* -------------------------------------------------------------------------- */

/**
 * How a student applies. `internal` means the conversation happens here —
 * only ever true for student-posted gigs, where there is no external system
 * to send them to.
 */
export type ApplicationMethod = "external-url" | "email" | "internal";

/** Moderation state. Nothing reaches a student except `published`. */
export type ModerationState = "published" | "pending" | "hidden";

export type Opportunity = {
  id: Id;

  /* --- provenance -------------------------------------------------------- */
  provider: ProviderKind;
  /** The provider adapter that produced it, e.g. "sample" or a feed slug. */
  providerSlug: string;
  /** The source's own id, so a re-sync updates rather than duplicates. */
  providerJobId: string | null;
  /** Canonical URL at the source. Shown on every card that has one. */
  sourceUrl: string | null;

  /* --- what it is -------------------------------------------------------- */
  title: string;
  description: string;
  kind: WorkKind;
  employerId: Id | null;
  /** Denormalised for listing without a join. Null for student gigs. */
  employerName: string | null;
  /** The student who posted it, for `provider: "students"`. */
  postedByUserId: Id | null;

  /* --- where ------------------------------------------------------------- */
  citySlug: string;
  countryCode: string;
  /** A public area label. Never a street address — see the posting schema. */
  area: string | null;
  campusSlug: string | null;
  remoteType: RemoteType;

  /* --- money ------------------------------------------------------------- */
  /** Null when the source did not state pay. Never inferred. */
  pay: Pay | null;

  /* --- time -------------------------------------------------------------- */
  hoursMin: number | null;
  hoursMax: number | null;
  schedule: readonly ScheduleTag[];
  /** For a gig or shift with a date attached. */
  startsAt: Iso | null;

  /* --- fit --------------------------------------------------------------- */
  languages: readonly LanguageRequirement[];
  skills: readonly SkillKey[];
  /** Null means the source did not say. Never defaulted to true. */
  studentFriendly: boolean | null;
  internationalStudentFriendly: boolean | null;
  /** Verbatim from the source, if it said anything. We add nothing. */
  workAuthorizationNotes: string | null;

  /* --- applying ---------------------------------------------------------- */
  applicationMethod: ApplicationMethod;
  /** The external destination. Required unless the method is `internal`. */
  applicationUrl: string | null;

  /* --- lifecycle --------------------------------------------------------- */
  postedAt: Iso;
  /** From the source. Null means the source set no end date. */
  expiresAt: Iso | null;
  fetchedAt: Iso;
  /** Last time a sync saw this row still present at the source. */
  lastSeenAt: Iso;
  moderation: ModerationState;
  filledAt: Iso | null;
};

/* -------------------------------------------------------------------------- */
/* Freshness                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * How long a posting stays plausible without being seen again, by shape.
 *
 * A Saturday shift is worthless on Sunday; a graduate internship is still real
 * a month later. One global expiry would either bin live jobs or keep dead
 * gigs, and the second is how job boards become untrustworthy.
 */
export function staleAfterDays(kind: WorkKind): number {
  const meta = workKindMeta[kind];
  if (meta.oneOff) return 14;
  if (meta.group === "internship") return 60;
  return 30;
}

export type Freshness = "fresh" | "ageing" | "stale" | "expired";

/**
 * Whether a row is still worth showing.
 *
 * `expired` is definitive: the source's own end date has passed, or the date
 * of the gig itself has. `stale` is our inference from silence — the row has
 * not been seen at the source for longer than its shape survives — and it is
 * deliberately a different word, because we are much less certain about it.
 */
export function freshness(
  opportunity: Pick<Opportunity, "kind" | "expiresAt" | "startsAt" | "lastSeenAt" | "filledAt">,
  now: Date,
): Freshness {
  if (opportunity.filledAt) return "expired";
  if (opportunity.expiresAt && new Date(opportunity.expiresAt).getTime() < now.getTime()) {
    return "expired";
  }
  /* A dated shift that has already started cannot be applied for. */
  if (opportunity.startsAt && new Date(opportunity.startsAt).getTime() < now.getTime()) {
    return "expired";
  }

  const days = (now.getTime() - new Date(opportunity.lastSeenAt).getTime()) / 86_400_000;
  const limit = staleAfterDays(opportunity.kind);
  if (days > limit) return "stale";
  if (days > limit / 2) return "ageing";
  return "fresh";
}

export function isLive(
  opportunity: Pick<
    Opportunity,
    "kind" | "expiresAt" | "startsAt" | "lastSeenAt" | "filledAt" | "moderation"
  >,
  now: Date,
): boolean {
  if (opportunity.moderation !== "published") return false;
  const state = freshness(opportunity, now);
  return state !== "expired" && state !== "stale";
}

/**
 * Confidence in the row as a description of something that currently exists.
 *
 * Provider prior, decayed by how long it has been since anyone confirmed the
 * posting is still there. This is not a quality score and is never rendered as
 * a percentage — it orders results and nothing else.
 */
export function sourceConfidence(
  opportunity: Pick<Opportunity, "provider" | "kind" | "lastSeenAt">,
  now: Date,
): number {
  const prior = providerPrior[opportunity.provider];
  const days = Math.max(0, (now.getTime() - new Date(opportunity.lastSeenAt).getTime()) / 86_400_000);
  const halfLife = staleAfterDays(opportunity.kind) / 2;
  return prior * Math.pow(0.5, days / halfLife);
}

/* -------------------------------------------------------------------------- */
/* Deduplication                                                               */
/* -------------------------------------------------------------------------- */

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Words that carry no identity and appear in roughly half of all postings.
 * Stripping them makes "Bar staff (part-time, urgent!)" and "Part time bar
 * staff" collide, which is the point.
 */
const NOISE = new Set([
  "job",
  "jobs",
  "part",
  "time",
  "full",
  "urgent",
  "hiring",
  "wanted",
  "needed",
  "immediate",
  "now",
  "asap",
  "start",
  "m",
  "f",
  "d",
  "x",
]);

/**
 * The identity of a posting, independent of who is republishing it.
 *
 * Company plus significant title words plus city. Not the description, which
 * every aggregator rewrites, and not the pay, which some strip.
 *
 * Structural, never semantic. An embedding would catch a few more duplicates
 * and would also occasionally merge two genuinely different roles at the same
 * company, which is a worse failure: the student never sees the one they
 * wanted and has no way to know it existed.
 */
export function dedupeKey(
  opportunity: Pick<Opportunity, "employerName" | "title" | "citySlug">,
): string {
  const employer = normalise(opportunity.employerName ?? "");
  const title = normalise(opportunity.title)
    .split(" ")
    .filter((word) => word.length > 1 && !NOISE.has(word))
    .sort()
    .join(" ");
  return `${employer}|${title}|${opportunity.citySlug}`;
}

/**
 * Collapse the same posting arriving from several sources.
 *
 * The survivor is the most accountable source, tie-broken by the row that
 * states pay — between two copies of one job, the one that tells the student
 * what it pays is strictly the more useful, whatever else is equal.
 *
 * Student-posted gigs are exempt: two students genuinely needing help moving a
 * sofa in the same city is two jobs, not one row seen twice, and merging them
 * would delete a real person's request.
 */
export function dedupe<T extends Opportunity>(opportunities: readonly T[]): T[] {
  const best = new Map<string, T>();
  const passthrough: T[] = [];

  for (const opportunity of opportunities) {
    if (opportunity.provider === "students" || !opportunity.employerName) {
      passthrough.push(opportunity);
      continue;
    }

    const id = dedupeKey(opportunity);
    const held = best.get(id);
    if (!held || beats(opportunity, held)) best.set(id, opportunity);
  }

  return [...best.values(), ...passthrough];
}

function beats(candidate: Opportunity, held: Opportunity): boolean {
  const byProvider = providerPrior[candidate.provider] - providerPrior[held.provider];
  if (Math.abs(byProvider) > 0.001) return byProvider > 0;

  const candidatePay = candidate.pay ? 1 : 0;
  const heldPay = held.pay ? 1 : 0;
  if (candidatePay !== heldPay) return candidatePay > heldPay;

  return new Date(candidate.lastSeenAt).getTime() > new Date(held.lastSeenAt).getTime();
}

/* -------------------------------------------------------------------------- */
/* Safety                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The scam patterns that actually target international students, in the order
 * they cost people money.
 *
 * Every one of these is a *structural* signal: a phrase, or a number that
 * cannot be true. None of it is a judgement about the employer, and the copy
 * shown to students says what was matched rather than "this is a scam" — a
 * false positive that libels a real café is its own kind of harm.
 */
export type RiskFlag =
  | "upfront-payment"
  | "money-handling"
  | "credential-request"
  | "off-platform"
  | "implausible-pay"
  | "no-detail";

export const riskFlagCopy: Record<RiskFlag, { label: string; explain: string }> = {
  "upfront-payment": {
    label: "Asks for money up front",
    explain:
      "This posting mentions a fee, deposit or payment from you. Legitimate work never costs money to start.",
  },
  "money-handling": {
    label: "Involves moving money",
    explain:
      "It mentions receiving or transferring funds through your own account. This is how money-laundering recruitment works, and it is a criminal offence for the person doing it.",
  },
  "credential-request": {
    label: "Asks for documents or logins early",
    explain:
      "It asks for a passport copy, bank details or account access before any interview. No real employer needs those to consider you.",
  },
  "off-platform": {
    label: "Moves you to a private chat immediately",
    explain:
      "It pushes you straight to a messaging app. That is not proof of anything, but every protection you have here stops at that point.",
  },
  "implausible-pay": {
    label: "Pay is far above the going rate",
    explain: "The stated pay is several times what this kind of work pays. That is usually the hook.",
  },
  "no-detail": {
    label: "Almost no detail",
    explain: "There is not enough here to tell what the work actually is.",
  },
};

const PATTERNS: readonly { flag: RiskFlag; test: RegExp }[] = [
  {
    flag: "upfront-payment",
    test: /\b(registration|admin|processing|training|placement|application)\s+fee\b|\bpay\s+(a\s+)?(fee|deposit)\b|\bsend\s+(us\s+)?(€|\$|£)?\d+\s+to\s+(start|apply)\b|\bupfront\s+payment\b/i,
  },
  {
    flag: "money-handling",
    test: /\bmoney\s+(transfer|mule)\b|\bwire\s+transfer\b|\bwestern\s+union\b|\breceive\s+(and|then)\s+forward\s+(funds|payments?)\b|\buse\s+your\s+(own\s+)?bank\s+account\b|\bpayment\s+process(or|ing)\s+agent\b|\bcrypto(currency)?\s+(deposit|investment)\b/i,
  },
  {
    flag: "credential-request",
    test: /\b(send|upload|provide)\s+(a\s+)?(copy\s+of\s+your\s+)?(passport|id\s+card|residence\s+permit)\b|\b(bank|iban|account)\s+details\b|\b(password|login\s+credentials)\b|\bsocial\s+security\s+number\b/i,
  },
  {
    flag: "off-platform",
    test: /\b(whatsapp|telegram|signal)\b.{0,40}\b(only|directly|immediately|to\s+apply)\b|\bapply\s+(via|on)\s+(whatsapp|telegram)\b|\btext\s+me\s+on\s+(whatsapp|telegram)\b/i,
  },
];

/**
 * What is structurally wrong with a posting, if anything.
 *
 * `hourlyBaseline` is the going rate for this kind of work in this city, in
 * cents. It is passed in rather than looked up because this module is pure and
 * because the baseline is a per-city fact that belongs with the city data.
 * Without one, the implausible-pay check simply does not run — an absent
 * baseline must never produce a flag.
 */
export function riskFlags(
  opportunity: Pick<Opportunity, "title" | "description" | "pay" | "kind" | "hoursMax">,
  hourlyBaseline: Cents | null,
): readonly RiskFlag[] {
  const text = `${opportunity.title}\n${opportunity.description}`;
  const flags: RiskFlag[] = [];

  for (const pattern of PATTERNS) {
    if (pattern.test.test(text)) flags.push(pattern.flag);
  }

  if (opportunity.description.trim().length < 40) flags.push("no-detail");

  if (hourlyBaseline && hourlyBaseline > 0 && opportunity.pay) {
    const hourly = hourlyEquivalent(opportunity.pay, opportunity.hoursMax ?? null);
    /* Four times the going rate for student work is not a generous employer. */
    if (hourly !== null && hourly > hourlyBaseline * 4) flags.push("implausible-pay");
  }

  return flags;
}

export type RiskLevel = "clear" | "review" | "block";

/**
 * What to do about the flags.
 *
 * The two flags that mean somebody is about to lose money or commit an offence
 * hide the posting immediately, pending a human. Everything else is shown with
 * the warning attached, because hiding every imperfect posting would empty the
 * board and teach students to look somewhere with no warnings at all.
 */
export function riskLevel(flags: readonly RiskFlag[]): RiskLevel {
  if (flags.includes("upfront-payment") || flags.includes("money-handling")) return "block";
  if (flags.length > 0) return "review";
  return "clear";
}

/** Shown on every opportunity, not dismissible. Mirrors the Exchange rule. */
export const workSafety = [
  "No legitimate job asks you to pay a fee, a deposit or for training.",
  "Never move money through your own account for an employer. That is money laundering, whatever they call it.",
  "Keep passport scans and bank details until you have a signed contract.",
  "Meet somewhere public for a first shift or a gig, and tell someone where you are going.",
] as const;

/* -------------------------------------------------------------------------- */
/* The student's work profile                                                  */
/* -------------------------------------------------------------------------- */

export type LookingFor = "yes" | "maybe" | "no";

/**
 * Everything the matcher knows about the student.
 *
 * Private by default and structurally so: `visibleToEmployers` starts false,
 * and the only fields any employer-facing surface may read are the ones listed
 * in `quickCard()` below. The CV, the phone number and the exact availability
 * are not in that list.
 */
export type WorkProfile = {
  userId: Id;
  lookingFor: LookingFor;
  /** Which shapes of work. Empty means no preference stated. */
  groups: readonly WorkGroup[];
  skills: readonly SkillKey[];
  languages: readonly LanguageRequirement[];
  availability: readonly ScheduleTag[];
  hoursPerWeek: number;
  maxCommuteMinutes: number;
  /** The floor the student will accept, in cents per hour. Null for none. */
  minHourlyCents: Cents | null;
  remotePreference: RemotePreference;

  /* --- the money loop ----------------------------------------------------- */
  /** What they want to earn each month. Drives the Budget income gap. */
  monthlyTargetCents: Cents | null;
  /** Income they already have — an allowance, a job elsewhere, savings drawdown. */
  currentIncomeCents: Cents | null;

  /* --- optional attachments ----------------------------------------------- */
  cvUrl: string | null;
  portfolioUrl: string | null;
  linkedinUrl: string | null;
  headline: string | null;

  /* --- privacy ------------------------------------------------------------ */
  visibleToEmployers: boolean;
  /** Opt-in to being notified when a posted gig matches. Never automatic. */
  gigAlerts: boolean;

  updatedAt: Iso;
};

/**
 * A work profile for a student who has not filled one in.
 *
 * Every default is the permissive-to-them, conservative-to-us one: not looking
 * for work, nothing shared, no alerts. A student who has never opened Work
 * must not appear in an employer's search because of a default we chose.
 */
export function emptyWorkProfile(userId: Id, now: Date): WorkProfile {
  return {
    userId,
    lookingFor: "no",
    groups: [],
    skills: [],
    languages: [],
    availability: [],
    hoursPerWeek: 0,
    maxCommuteMinutes: 40,
    minHourlyCents: null,
    remotePreference: "either",
    monthlyTargetCents: null,
    currentIncomeCents: null,
    cvUrl: null,
    portfolioUrl: null,
    linkedinUrl: null,
    headline: null,
    visibleToEmployers: false,
    gigAlerts: false,
    updatedAt: now.toISOString(),
  };
}

/**
 * The 30-second work card — the only projection of a student that may be shown
 * to someone offering work.
 *
 * A whitelist, not a redaction. Anything added to `WorkProfile` in future is
 * private until somebody deliberately adds it here, which is the opposite of
 * the usual failure where a new field leaks because a spread picked it up.
 */
export type QuickWorkCard = {
  displayName: string;
  cityName: string;
  campusName: string | null;
  headline: string | null;
  languages: readonly LanguageRequirement[];
  availability: readonly ScheduleTag[];
  skills: readonly SkillKey[];
  groups: readonly WorkGroup[];
};

export function quickCard(
  profile: WorkProfile,
  who: { displayName: string; cityName: string; campusName: string | null },
): QuickWorkCard {
  return {
    displayName: who.displayName,
    cityName: who.cityName,
    campusName: who.campusName,
    headline: profile.headline,
    languages: profile.languages,
    availability: profile.availability,
    skills: profile.skills,
    groups: profile.groups,
  };
}

/* -------------------------------------------------------------------------- */
/* Applications                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The tracker's states.
 *
 * `saved` is in the same ladder rather than a separate list, because a saved
 * job and an applied one are the same object at different points and a student
 * should not have to re-find it to move it along.
 */
export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interview"
  | "offer"
  | "rejected"
  | "archived";

export const applicationStatusMeta: Record<
  ApplicationStatus,
  { label: string; open: boolean }
> = {
  saved: { label: "Saved", open: true },
  applied: { label: "Applied", open: true },
  interview: { label: "Interview", open: true },
  offer: { label: "Offer", open: true },
  rejected: { label: "Closed", open: false },
  archived: { label: "Archived", open: false },
};

export const applicationStatuses = Object.keys(
  applicationStatusMeta,
) as readonly ApplicationStatus[];

export type Application = {
  id: Id;
  userId: Id;
  opportunityId: Id;
  status: ApplicationStatus;
  /** The student's own note. Never sent anywhere. */
  note: string | null;
  /** A reminder the student set, surfaced in LifeOps. */
  remindAt: Iso | null;
  /**
   * When the student told us they applied.
   *
   * Set by an explicit tap, never inferred from opening the external link —
   * a tracker that quietly marks jobs as applied is a tracker that lies to the
   * person relying on it to know what they have already done.
   */
  appliedAt: Iso | null;
  createdAt: Iso;
  updatedAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Provider runs                                                               */
/* -------------------------------------------------------------------------- */

/**
 * One sync attempt. Written whether it succeeded or not, because a provider
 * that has been failing silently for a week is exactly what the admin health
 * screen exists to show.
 */
export type ProviderRun = {
  id: Id;
  providerSlug: string;
  startedAt: Iso;
  finishedAt: Iso | null;
  ok: boolean;
  imported: number;
  updated: number;
  duplicates: number;
  expired: number;
  /** The real error, kept verbatim. Never flattened to "sync failed". */
  error: string | null;
};
