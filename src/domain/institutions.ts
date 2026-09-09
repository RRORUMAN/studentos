import type { Iso } from "@/domain/types";

/**
 * ============================================================================
 * INSTITUTIONS
 * ----------------------------------------------------------------------------
 * The registry a student searches when onboarding asks where they study, and
 * the pure ranking that decides what the field shows after four keystrokes.
 *
 * Before this existed the answer was a list of thirty-eight campuses typed by
 * hand. That list is still here -- it is now `source: "curated"` -- because it
 * knows something a registry does not: which neighbourhood the buildings are
 * in. `area` feeds the commute figures in the neighbourhood engine, so it may
 * only ever be written by someone who checked. Everything imported therefore
 * arrives with `campusSlug: null` and degrades exactly the way an unlisted
 * university already did: `scoreCommute(null)` returns 0.5, the codebase's own
 * rule that an unknown scores neutral, never zero and never a pass.
 *
 * So a row here makes one of two different claims, and the type keeps them
 * apart:
 *
 *   campusSlug set     StudentOS knows where this institution's students
 *                      commute from, and will say "18 min from campus".
 *
 *   campusSlug null    StudentOS knows this institution exists, in this city,
 *                      under these names. It will not guess a commute.
 *
 * The second is worth having on its own. A student at Rey Juan Carlos who
 * types "rey juan" and is found has been told the product was built for them,
 * which is most of what onboarding is for.
 *
 * SEARCH is deliberately boring and deterministic. No model, no service call,
 * no index to rebuild -- a few hundred rows scored in a loop, which costs well
 * under a millisecond on the largest country in the dataset. The rules, in the
 * order they fire:
 *
 *   1. FOLD EVERYTHING. "autonoma" must find Autonoma and "politecnica" must
 *      find Politecnica. A student typing on a phone keyboard in their second
 *      language should not have to get the diacritics right to be found.
 *
 *   2. ACRONYMS ARE FIRST-CLASS. Nobody types "Universidad Autonoma de
 *      Madrid". They type UAM. Acronyms are derived from the official name
 *      rather than listed, so an imported row gets one for free.
 *
 *   3. TOKEN PREFIXES BEAT SUBSTRINGS. "complu" is a prefix of the word
 *      "Complutense", so Complutense ranks above anything that merely contains
 *      those letters somewhere in the middle.
 *
 *   4. TYPOS COST, THEY DO NOT DISQUALIFY. One edit inside a word still
 *      matches, at a much lower score, and only for queries long enough that
 *      the edit distance means something.
 *
 *   5. THE STUDENT'S OWN CITY WINS TIES. Someone onboarding in Madrid who
 *      types "poli" means the Politecnica in Madrid, not the one in Valencia.
 *
 * Everything in this file is pure. The dataset is passed in.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Shape                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What kind of place this is, in the words a student would use rather than the
 * legal category. `other` is a real answer: the registries disagree about
 * conservatoires and the difference does not change what StudentOS does.
 */
export type InstitutionType =
  | "university"
  | "business-school"
  | "applied-sciences"
  | "art-school"
  | "conservatoire"
  | "other";

/**
 * Where the row came from, which is the only thing that licenses trusting it.
 *
 *   curated           typed by hand and checked; the only source allowed to
 *                     claim a campus location
 *   wikidata          imported by `scripts/import-institutions.mjs`, carries
 *                     the entity id it came from
 *   student-submitted a student typed a name onboarding could not find; never
 *                     shown in search until an admin verifies it
 */
export type InstitutionSource = "curated" | "wikidata" | "student-submitted";

export type Institution = {
  /** Stable and country-scoped: "es-ucm", "es-q214158". */
  id: string;
  officialName: string;
  /** What its own students call it. Null when nothing but the full name is known. */
  shortName: string | null;
  /** Extra spellings and abbreviations. Acronyms are derived, not listed here. */
  aliases: readonly string[];
  /** ISO-3166 alpha-2. */
  countryCode: string;
  /** The municipality of the seat: "Getafe", not "Madrid", when that is the truth. */
  city: string;
  /** First-level subdivision. Null when the source did not say. */
  region: string | null;
  /**
   * The StudentOS city whose students go here, which is a metro area and so is
   * often not `city`. Null when the institution sits outside every city the
   * product covers; it is still searchable, it just has no local content.
   */
  citySlug: string | null;
  /**
   * Set only when a human confirmed which neighbourhood the buildings are in,
   * linking to a row in `campuses`. Null everywhere else, forever, unless
   * somebody checks. See the note at the top.
   */
  campusSlug: string | null;
  type: InstitutionType;
  website: string | null;
  lat: number | null;
  lng: number | null;
  source: InstitutionSource;
  /** The id in that source: a Wikidata QID, or null for curated rows. */
  sourceId: string | null;
  /** A human confirmed this row. Student submissions start false. */
  verified: boolean;
  lastUpdatedAt: Iso;
};

/** One search hit, with the reason it matched so the UI can explain itself. */
export type InstitutionHit = {
  institution: Institution;
  score: number;
  /** Which rule fired hardest. The picker shows the alias when it was an alias. */
  matched: "acronym" | "short-name" | "alias" | "name" | "city" | "fuzzy";
  /** The exact string that matched, when it was not the official name. */
  matchedText: string | null;
};

/* -------------------------------------------------------------------------- */
/* Folding                                                                     */
/* -------------------------------------------------------------------------- */

/** Combining marks, stripped after NFD so accented letters fold to plain ones. */
const COMBINING = /[̀-ͯ]/g;

/**
 * Lowercase, strip diacritics, collapse punctuation to single spaces.
 *
 * "Universitat Politecnica de Catalunya" with and without its accents, and with
 * a hyphen where a space belongs, all fold to the same string. That is the
 * whole point: the student is not spelling, they are remembering.
 */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Words that carry no signal in an institution name, in every language the
 * dataset currently contains. Dropping them is what makes "Universidad
 * Autonoma de Madrid" produce UAM rather than UADM.
 */
const STOPWORDS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "i", "of", "the", "and", "for",
  "di", "della", "delle", "da", "do", "dos", "das", "des", "du", "le", "les",
  "van", "von", "zu", "der", "die", "das", "und", "en", "a", "at", "in",
]);

function tokens(value: string): string[] {
  return fold(value).split(" ").filter(Boolean);
}

/**
 * The acronym a student would actually type, from the official name.
 *
 * Derived rather than stored so that an imported row gets one without anybody
 * curating it. Institutions whose name is already short produce a useless
 * two-letter acronym -- "IE University" gives "IU" -- which is harmless
 * because the short name and the name itself both match "IE" more strongly.
 */
export function acronym(name: string): string {
  return tokens(name)
    .filter((word) => !STOPWORDS.has(word))
    .map((word) => word[0])
    .join("");
}

/**
 * Edit distance, capped. Returns `cap + 1` as soon as it is certain the real
 * distance exceeds `cap`, because the caller only ever asks "is this within one
 * edit" and the full matrix is wasted work at a few hundred rows a keystroke.
 */
export function editDistance(a: string, b: string, cap: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > cap) return cap + 1;
    previous = current;
  }
  return previous[b.length] ?? cap + 1;
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Scores are absolute rather than normalised, and the gaps between the bands
 * are wide on purpose: an acronym hit must outrank a substring hit no matter
 * how many words the substring covered.
 */
const SCORE = {
  acronymExact: 1000,
  shortNameExact: 950,
  aliasExact: 900,
  nameExact: 880,
  shortNamePrefix: 700,
  /**
   * A word of the official name outranks a word of an alias, and that ordering
   * is load-bearing rather than aesthetic. Typing "granada" matches the name
   * "Universidad de Granada" and also the Basque alias "Granadako
   * Unibertsitatea"; with the alias winning, the same row came back labelled
   * "also known as Granadako Unibertsitatea", which is true, unhelpful, and
   * reads as though the search found something other than what was typed.
   */
  namePrefixLead: 720,
  namePrefixOther: 680,
  aliasPrefix: 660,
  acronymPrefix: 380,
  substring: 260,
  fuzzy: 140,
  cityName: 90,
} as const;

const BOOST = {
  sameCity: 260,
  curated: 45,
  verified: 12,
} as const;

/** Below this a hit is noise and is dropped rather than shown. */
const MIN_SCORE = 100;

/**
 * A query short enough that one edit changes what it means: "ie" is not a typo
 * for "if". Fuzzy matching only starts once the student has committed.
 */
const MIN_FUZZY_LENGTH = 5;

type Scored = {
  score: number;
  matched: InstitutionHit["matched"];
  matchedText: string | null;
};

function scoreOne(institution: Institution, query: string): Scored | null {
  const q = fold(query);
  if (!q) return null;

  const name = fold(institution.officialName);
  const short = institution.shortName ? fold(institution.shortName) : null;
  const initials = acronym(institution.officialName);
  const aliases = institution.aliases.map(fold);

  let best: Scored | null = null;
  const consider = (score: number, matched: Scored["matched"], text: string | null) => {
    if (!best || score > best.score) best = { score, matched, matchedText: text };
  };

  /* 1 -- exact hits, in the order a student expects them to win. */
  if (initials && q === initials) {
    consider(SCORE.acronymExact, "acronym", institution.shortName ?? institution.officialName);
  }
  if (short && q === short) consider(SCORE.shortNameExact, "short-name", institution.shortName);
  const exactAlias = aliases.indexOf(q);
  if (exactAlias >= 0) consider(SCORE.aliasExact, "alias", institution.aliases[exactAlias] ?? null);
  if (q === name) consider(SCORE.nameExact, "name", null);

  /* 2 -- prefixes, on the whole string first. */
  if (short && short.startsWith(q)) consider(SCORE.shortNamePrefix, "short-name", institution.shortName);
  aliases.forEach((alias, index) => {
    if (alias.startsWith(q)) consider(SCORE.aliasPrefix, "alias", institution.aliases[index] ?? null);
  });

  const nameTokens = tokens(institution.officialName);
  const queryTokens = q.split(" ").filter(Boolean);

  /* Every query word must land on some word of the name, or this is not a
     multi-word match at all -- otherwise "madrid business" would match every
     institution in Madrid on the strength of one word. */
  const allLand = queryTokens.every((part) => nameTokens.some((word) => word.startsWith(part)));
  if (allLand) {
    const firstSignificant = nameTokens.findIndex((word) => !STOPWORDS.has(word));
    const leadIndex = nameTokens.findIndex((word) => word.startsWith(queryTokens[0] ?? ""));
    const isLead = leadIndex >= 0 && leadIndex <= Math.max(firstSignificant, 0) + 1;
    consider(
      (isLead ? SCORE.namePrefixLead : SCORE.namePrefixOther) + queryTokens.length * 20,
      "name",
      null,
    );
  }

  if (initials && q.length >= 2 && initials.startsWith(q)) {
    consider(SCORE.acronymPrefix, "acronym", institution.shortName ?? institution.officialName);
  }

  /* 3 -- plain substring, for the student who remembers the middle of a name. */
  if (q.length >= 3 && name.includes(q)) consider(SCORE.substring, "name", null);

  /* 4 -- one edit, per word, only once the query is long enough to mean it. */
  if (!best && q.length >= MIN_FUZZY_LENGTH) {
    const near = (candidate: string) =>
      candidate.length >= MIN_FUZZY_LENGTH && editDistance(candidate, q, 1) <= 1;
    if (nameTokens.some(near) || (short !== null && near(short)) || aliases.some(near)) {
      consider(SCORE.fuzzy, "fuzzy", null);
    }
  }

  /* 5 -- the city, last and lowest. Typing "getafe" should surface what is
        there, but never above an institution whose name you actually typed. */
  if (!best && q.length >= 3 && fold(institution.city).startsWith(q)) {
    consider(SCORE.cityName, "city", institution.city);
  }

  return best;
}

export type InstitutionSearchOptions = {
  /** Restrict to one country. Omit to search the whole dataset. */
  countryCode?: string | null;
  /** The student's city. Ranks its institutions first; never excludes others. */
  citySlug?: string | null;
  limit?: number;
};

/**
 * Rank `dataset` against `query`.
 *
 * With an empty query this is not a search but a default list, and returns the
 * institutions of `citySlug` -- which is what the picker shows before the
 * student has typed anything, and is the reason the field no longer opens with
 * four names that belong to somebody else.
 */
export function searchInstitutions(
  dataset: readonly Institution[],
  query: string,
  options: InstitutionSearchOptions = {},
): InstitutionHit[] {
  const { countryCode = null, citySlug = null, limit = 8 } = options;
  const pool = countryCode
    ? dataset.filter((row) => row.countryCode.toUpperCase() === countryCode.toUpperCase())
    : dataset;

  const trimmed = query.trim();

  if (!trimmed) {
    const local = citySlug ? pool.filter((row) => row.citySlug === citySlug) : [];
    return sortHits(
      local.map((institution) => ({
        institution,
        score: BOOST.sameCity + (institution.campusSlug ? BOOST.curated : 0),
        matched: "city" as const,
        matchedText: null,
      })),
    ).slice(0, limit);
  }

  const hits: InstitutionHit[] = [];
  for (const institution of pool) {
    const scored = scoreOne(institution, trimmed);
    if (!scored) continue;
    let score = scored.score;
    if (citySlug && institution.citySlug === citySlug) score += BOOST.sameCity;
    if (institution.source === "curated") score += BOOST.curated;
    if (institution.verified) score += BOOST.verified;
    if (score < MIN_SCORE) continue;
    hits.push({ institution, score, matched: scored.matched, matchedText: scored.matchedText });
  }

  return sortHits(hits).slice(0, limit);
}

/** Score first, then shortest official name, then id -- so results never jitter. */
function sortHits(hits: InstitutionHit[]): InstitutionHit[] {
  return hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const lengths = a.institution.officialName.length - b.institution.officialName.length;
    if (lengths !== 0) return lengths;
    return a.institution.id.localeCompare(b.institution.id);
  });
}

const TYPE_LABELS: Record<InstitutionType, string> = {
  university: "University",
  "business-school": "Business school",
  "applied-sciences": "University of applied sciences",
  "art-school": "Art school",
  conservatoire: "Conservatoire",
  other: "Higher education",
};

/** The secondary line in the picker: what kind of place, and where it is. */
export function describeInstitution(institution: Institution): string {
  return `${TYPE_LABELS[institution.type]} · ${institution.city}`;
}

/* -------------------------------------------------------------------------- */
/* Submissions                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A university a student typed because the registry did not have it.
 *
 * Onboarding never blocks on this. The name goes on the profile immediately and
 * the student carries on; the submission is a separate row whose only job is to
 * reach an admin. Nothing here is shown in search until somebody verifies it,
 * because an unreviewed row is a name one person typed once and could be a
 * typo, a department, or a joke.
 *
 * `status` is the whole state machine:
 *
 *   pending    waiting for review
 *   verified   a real institution; an admin has added it to the curated list
 *   merged     the same place as an institution already in the registry, under
 *              a name the search did not know. `mergedIntoId` says which, and
 *              that name becomes an alias -- which is the outcome that actually
 *              improves the product, because it means the next student who
 *              types it is found.
 *   rejected   not an institution
 */
export type InstitutionSubmission = {
  id: string;
  /** Null when it came from the signed-out onboarding preview. */
  userId: string | null;
  /** Exactly what the student typed, trimmed. Never cleaned up silently. */
  name: string;
  citySlug: string;
  countryCode: string;
  status: "pending" | "verified" | "merged" | "rejected";
  /** Set when merged: the institution this turned out to be. */
  mergedIntoId: string | null;
  reviewedBy: string | null;
  reviewedAt: Iso | null;
  createdAt: Iso;
};
