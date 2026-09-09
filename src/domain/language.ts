import type { Iso } from "@/domain/types";

/**
 * ============================================================================
 * SPEAK LOCAL
 * ----------------------------------------------------------------------------
 * The words a student needs to live in the city they moved to, and nothing
 * else.
 *
 * This is NOT a language course and the shape of the data says so. There is no
 * grammar, no unit, no streak to protect, no lesson to finish. There is a list
 * of things a person actually says in a shop, at a doctor's desk, to a
 * landlord, at a bar, and a record of which of them a student has decided they
 * know. Duolingo teaches you a language over two years. This gets you through
 * Tuesday.
 *
 * Three ideas hold it together.
 *
 * 1. SITUATIONS, NOT TOPICS. A phrase belongs to a moment -- paying, being
 *    asked something at the till, moving in, not understanding. That is how a
 *    student retrieves it, because that is how they meet it. "Vocabulary about
 *    food" is a textbook's organising principle and helps nobody standing at a
 *    counter.
 *
 * 2. TIERS, NOT LEVELS. `tier: 1` means you need it on day one; 3 means it is
 *    worth having once you are settled. There is no A1/B2 anywhere, because
 *    the question this answers is "what do I need next", not "how good am I".
 *
 * 3. AN UNKNOWN IS ADMITTED. `say` -- the rough English approximation -- is
 *    NULLABLE, and is null wherever an English respelling would teach somebody
 *    to say it wrong. Dutch and Hungarian have sounds English does not spell.
 *    Where the pack cannot help, the UI offers the device's own voice and says
 *    plainly that there is no honest respelling, rather than printing one that
 *    produces an accent nobody understands.
 *
 * The same restraint governs COVERAGE. A pack declares how complete it is and
 * the interface prints that word. A starter pack with eighteen phrases that
 * says "starter pack" is worth having; the same eighteen phrases presented as
 * "Estonian" is a promise the product cannot keep, and the first student who
 * looks for the word for "deposit" finds out.
 *
 * Everything in this file is pure. Packs are passed in.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Shape                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The languages a pack can exist for. Adding one is a code point here, a pack
 * file, and a line in `LOCAL_LANGUAGES` -- nothing else in the product names a
 * language.
 */
export type LanguageCode =
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "nl"
  | "pl"
  | "cs"
  | "hu"
  | "fi"
  | "sv"
  | "et"
  | "en";

/**
 * The ten moments. Ordered by when a student first hits them, which is also
 * the order the situations screen lists them in.
 */
export type SituationKey =
  | "first-words"
  | "getting-around"
  | "groceries"
  | "eating-out"
  | "money"
  | "housing"
  | "university"
  | "meeting-people"
  | "work"
  | "emergency";

export const SITUATIONS: readonly SituationKey[] = [
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
];

export const situationLabel: Record<SituationKey, string> = {
  "first-words": "First words",
  "getting-around": "Getting around",
  groceries: "At the supermarket",
  "eating-out": "Eating out",
  money: "Paying for things",
  housing: "Your flat",
  university: "At university",
  "meeting-people": "Meeting people",
  work: "Looking for work",
  emergency: "When something is wrong",
};

export const situationLead: Record<SituationKey, string> = {
  "first-words": "The six you will use before you have unpacked.",
  "getting-around": "Tickets, platforms, and asking whether this one goes there.",
  groceries: "Finding things, prices, and the questions the till asks you.",
  "eating-out": "Ordering, allergies, splitting it, and the bill.",
  money: "Cards, cash, deposits and what a price actually includes.",
  housing: "Rent, bills, the landlord, and the thing that has broken.",
  university: "Enrolment, the library, and asking for the deadline again.",
  "meeting-people": "Introducing yourself and making the second meeting happen.",
  work: "Asking whether they are hiring, and what the hours are.",
  emergency: "The pharmacy, the doctor, and being clear when it matters.",
};

/**
 * How near the front of a student's life a phrase is.
 *
 *   1  needed on the first day
 *   2  needed in the first month
 *   3  useful once settled
 */
export type PhraseTier = 1 | 2 | 3;

export type Phrase = {
  /** Stable and namespaced: "es.groceries.how-much". Progress rows key on it. */
  id: string;
  situation: SituationKey;
  /** Exactly as it should be said. */
  text: string;
  /** What it means. Idiomatic English, not a word-for-word gloss. */
  meaning: string;
  /**
   * A rough English-speaker's approximation, hyphenated by syllable with the
   * stressed one in capitals. NULL where English spelling cannot get close
   * enough to be worth printing -- see the note at the top of this file.
   */
  say: string | null;
  /** When to use it, or what you are likely to hear back. */
  note: string | null;
  tier: PhraseTier;
};

export type PackCoverage = "full" | "core" | "starter";

export const coverageLabel: Record<PackCoverage, string> = {
  full: "Full pack",
  core: "Core pack",
  starter: "Starter pack",
};

export type PhrasePack = {
  code: LanguageCode;
  /** What its speakers call it. */
  endonym: string;
  /** English name, for the interface. */
  name: string;
  /** BCP-47, handed to the device's speech synthesiser. */
  speechTag: string;
  coverage: PackCoverage;
  phrases: readonly Phrase[];
};

/* -------------------------------------------------------------------------- */
/* What the student has done with a phrase                                     */
/* -------------------------------------------------------------------------- */

/**
 * Three states, and the middle one is the student's own judgement rather than
 * a test result.
 *
 *   seen   it has been in front of them
 *   saved  they want it again
 *   known  they say they have it
 *
 * Nothing here scores anybody. A product that decides a student does not know
 * a word they believe they know has picked a fight it cannot win, and the only
 * thing at stake is which phrase gets shown tomorrow.
 */
export type PhraseStatus = "seen" | "saved" | "known";

export type PhraseProgress = {
  userId: string;
  language: LanguageCode;
  phraseId: string;
  status: PhraseStatus;
  seenCount: number;
  updatedAt: Iso;
};

/** How much of the local language a student already has. Their own answer. */
export type LanguageAbility = "none" | "few-words" | "basic" | "conversational" | "fluent";

export const abilityLabel: Record<LanguageAbility, string> = {
  none: "None at all",
  "few-words": "A few words",
  basic: "Basic",
  conversational: "Conversational",
  fluent: "Fluent",
};

export type LanguageProfile = {
  userId: string;
  /** The language being learned. Chosen from the city, changeable by the student. */
  language: LanguageCode;
  ability: LanguageAbility;
  /** Whether Home carries the daily phrase. On by default; one tap to stop. */
  dailyBite: boolean;
  startedAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Which language                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The language of the street, by country.
 *
 * Deliberately ONE per country, and deliberately not a claim about national
 * identity: Barcelona is a Catalan-speaking city and this returns Spanish for
 * ES, because a student who learns "cuanto cuesta" will be understood in every
 * shop in Spain and the pack for Catalan does not exist yet. The student can
 * change it, and that setting is what the rest of the product reads.
 *
 * A country with no entry has no local pack, and the feature says so rather
 * than defaulting to English and pretending that is the local language.
 */
const LANGUAGE_BY_COUNTRY: Record<string, LanguageCode> = {
  ES: "es",
  FR: "fr",
  DE: "de",
  AT: "de",
  CH: "de",
  IT: "it",
  PT: "pt",
  BR: "pt",
  NL: "nl",
  BE: "nl",
  PL: "pl",
  CZ: "cs",
  HU: "hu",
  FI: "fi",
  SE: "sv",
  EE: "et",
  GB: "en",
  IE: "en",
  US: "en",
  CA: "en",
  AU: "en",
  NZ: "en",
};

export function localLanguageFor(countryCode: string | null | undefined): LanguageCode | null {
  if (!countryCode) return null;
  return LANGUAGE_BY_COUNTRY[countryCode.toUpperCase()] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Selecting                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A small, stable hash. Same inputs, same number, on every machine and in
 * every process -- which is the only property that matters here, because two
 * requests on the same day must show the same phrase or the student has been
 * lied to about what "today's phrase" means.
 */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type DailyPick = {
  phrase: Phrase;
  /** How many phrases in this pack are still unseen at the phrase's tier. */
  remainingAtTier: number;
};

/**
 * Today's phrase.
 *
 * The rules, in order:
 *
 *   1. Never something the student has marked known. That is the one signal
 *      they gave and ignoring it makes the feature feel deaf.
 *   2. The lowest tier with anything left. Somebody who arrived yesterday gets
 *      "excuse me" before they get "the boiler is broken".
 *   3. Within a tier, a stable pick from the day and the student -- so it does
 *      not change on reload, two students do not get the same phrase, and no
 *      state has to be written to make either true.
 *
 * Null when the pack has nothing left, which the caller renders as the honest
 * end of the pack rather than by starting again.
 */
export function dailyPhrase(
  pack: PhrasePack,
  options: { dayKey: string; userId: string; known: ReadonlySet<string> },
): DailyPick | null {
  const { dayKey, userId, known } = options;
  const available = pack.phrases.filter((phrase) => !known.has(phrase.id));
  if (available.length === 0) return null;

  const tiers: PhraseTier[] = [1, 2, 3];
  for (const tier of tiers) {
    const pool = available.filter((phrase) => phrase.tier === tier);
    if (pool.length === 0) continue;
    const index = hash(`${userId}:${dayKey}:${pack.code}`) % pool.length;
    const phrase = pool[index];
    if (!phrase) continue;
    return { phrase, remainingAtTier: pool.length };
  }
  return null;
}

/** Everything in one situation, easiest first. */
export function phrasesFor(pack: PhrasePack, situation: SituationKey): Phrase[] {
  return pack.phrases
    .filter((phrase) => phrase.situation === situation)
    .sort((a, b) => a.tier - b.tier);
}

/** Situations this pack actually covers, with how many phrases each holds. */
export function situationsIn(pack: PhrasePack): { situation: SituationKey; count: number }[] {
  return SITUATIONS.map((situation) => ({
    situation,
    count: pack.phrases.filter((phrase) => phrase.situation === situation).length,
  })).filter((row) => row.count > 0);
}

export type LanguageProgress = {
  total: number;
  known: number;
  saved: number;
  seen: number;
  /** Per situation, for the progress screen. */
  bySituation: { situation: SituationKey; total: number; known: number }[];
  /** The situation with the most left to learn at the lowest tier. */
  nextUp: SituationKey | null;
};

export function summarise(
  pack: PhrasePack,
  rows: readonly PhraseProgress[],
): LanguageProgress {
  const mine = rows.filter((row) => row.language === pack.code);
  const status = new Map(mine.map((row) => [row.phraseId, row.status]));

  const bySituation = situationsIn(pack).map(({ situation, count }) => ({
    situation,
    total: count,
    known: phrasesFor(pack, situation).filter((phrase) => status.get(phrase.id) === "known").length,
  }));

  /* The situation to point at next is the one with the most tier-1 phrases the
     student has not marked known -- the largest gap closest to the door,
     rather than the emptiest bar. */
  let nextUp: SituationKey | null = null;
  let best = 0;
  for (const { situation } of bySituation) {
    const gap = phrasesFor(pack, situation).filter(
      (phrase) => phrase.tier === 1 && status.get(phrase.id) !== "known",
    ).length;
    if (gap > best) {
      best = gap;
      nextUp = situation;
    }
  }

  return {
    total: pack.phrases.length,
    known: mine.filter((row) => row.status === "known").length,
    saved: mine.filter((row) => row.status === "saved").length,
    seen: mine.length,
    bySituation,
    nextUp,
  };
}

/* -------------------------------------------------------------------------- */
/* Context                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Where in the product a phrase is being asked for.
 *
 * This is the difference between a language feature and a language tab. A
 * student looking at a restaurant at seven in the evening is about to need one
 * specific sentence, and showing it there costs them nothing and saves them
 * the moment of standing at a table unable to ask for the bill.
 */
export type PhraseContext =
  | { kind: "place"; category: string }
  | { kind: "situation"; situation: SituationKey }
  | { kind: "arrival"; taskKey: string }
  | { kind: "work" };

/**
 * Which situation a place category belongs to.
 *
 * Unrecognised categories return null and the caller shows nothing, which is
 * the correct behaviour: a gym has no phrase that is obviously the one you
 * need, and inventing a connection to fill the slot is how a good idea becomes
 * clutter.
 */
const PLACE_SITUATIONS: readonly { match: RegExp; situation: SituationKey }[] = [
  { match: /supermarket|grocer|market/i, situation: "groceries" },
  { match: /restaurant|cafe|café|bar|canteen|lunch|ramen|food|bakery|club/i, situation: "eating-out" },
  { match: /pharmac|clinic|hospital|doctor/i, situation: "emergency" },
  { match: /station|transport|metro|bus/i, situation: "getting-around" },
  { match: /librar|campus|study/i, situation: "university" },
  /* A museum, a gym, a cinema: places where the useful sentence is not about
     the place at all, it is "is there a student discount". */
  { match: /museum|gallery|gym|sport|swim|cinema|theatre|pool/i, situation: "money" },
];

export function situationForContext(context: PhraseContext): SituationKey | null {
  switch (context.kind) {
    case "situation":
      return context.situation;
    case "place":
      return PLACE_SITUATIONS.find((row) => row.match.test(context.category))?.situation ?? null;
    case "arrival":
      return ARRIVAL_SITUATIONS[context.taskKey] ?? null;
    case "work":
      return "work";
  }
}

/**
 * Arrival tasks that have an obvious sentence attached. Keyed by the task keys
 * in `src/config/arrival-plan.ts`; anything not listed shows nothing.
 */
const ARRIVAL_SITUATIONS: Record<string, SituationKey> = {
  /* Keys are the task ids in `src/config/arrival-plan.ts`. Only the tasks a
     student does by SPEAKING TO SOMEBODY are listed: "save your home address"
     is a task you do alone and needs no phrase. */
  "sim-card": "money",
  "bank-account": "money",
  "transport-card": "getting-around",
  "route-to-campus": "getting-around",
  "transport-pass": "getting-around",
  registration: "housing",
  "confirm-accommodation": "housing",
  deposit: "housing",
  "final-bills": "housing",
  "residency-requirements": "housing",
  "check-enrolment": "university",
  "student-card": "university",
  "return-university": "university",
  "find-supermarket": "groceries",
  "cheap-food": "eating-out",
  "find-pharmacy": "emergency",
  "healthcare-cover": "emergency",
  "emergency-numbers": "emergency",
  "join-campus": "meeting-people",
  "join-group": "meeting-people",
  "sell-furniture": "money",
};

/**
 * The one or two phrases worth putting next to something else on screen.
 *
 * Capped hard. A contextual hint that grows into a list is a second feature
 * competing with the first one on the same screen, and the student came to
 * look at the restaurant.
 */
export function contextPhrases(
  pack: PhrasePack,
  context: PhraseContext,
  limit = 2,
): Phrase[] {
  const situation = situationForContext(context);
  if (!situation) return [];
  return phrasesFor(pack, situation).slice(0, limit);
}
