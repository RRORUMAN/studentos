import type { Neighbourhood, NeighbourhoodTrait, TraitBand } from "@/data/types";

/**
 * ============================================================================
 * NEIGHBOURHOOD MATCH
 * ----------------------------------------------------------------------------
 * "Where should I live" as a ranking over real rows, with the reasoning kept
 * in the open.
 *
 * This is the highest-stakes recommendation the product makes. Everything else
 * it suggests costs a student an evening; this one costs them a year and most
 * of their money, and they will make the decision from a foreign country with
 * three tabs open. So two things matter more here than anywhere else:
 *
 *   THE RANKING MUST BE ARGUABLE. Every row comes back with `components` and
 *   `reasons` built from facts the student can check. A student who disagrees
 *   with the order should be able to see exactly which input produced it and
 *   change that input, rather than being told a number.
 *
 *   NOTHING IS HIDDEN FOR BEING EXPENSIVE. An area the student cannot afford
 *   is ranked last and labelled `over` — never filtered out. Silently dropping
 *   it teaches them the city has six neighbourhoods when it has seven, and the
 *   seventh is the one their friend is about to move to.
 *
 * Pure, `now`-free, and it never reads the rent band without also reading its
 * basis: `estimated` travels on every result so the surface can say the number
 * is a written estimate rather than a market reading.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Inputs                                                                      */
/* -------------------------------------------------------------------------- */

/** How much a trait matters to this student. Three levels; more is false precision. */
export type Priority = 0 | 1 | 2;

export const priorityLabel: Record<Priority, string> = {
  0: "Don't mind",
  1: "Nice to have",
  2: "Important",
};

export type LivingPreferences = {
  /** Where they have to get to most mornings. Null skips the commute term. */
  campusSlug: string | null;
  /**
   * The most they will pay monthly for a room, in whole units of the city's
   * currency. Null means they have not said, and the rent term drops out
   * rather than assuming a figure.
   */
  rentCeiling: number | null;
  /** Minutes each way they are willing to accept. */
  maxCommuteMinutes: number;
  priorities: Partial<Record<NeighbourhoodTrait, Priority>>;
};

export const traitLabel: Record<NeighbourhoodTrait, string> = {
  nightlife: "Nightlife",
  quiet: "Quiet at night",
  groceries: "Cheap groceries",
  transport: "Transport",
  studentDensity: "Other students",
  green: "Parks",
  eatingOut: "Cheap eating out",
};

/** Order the preference form renders them in. */
export const traitOrder: readonly NeighbourhoodTrait[] = [
  "studentDensity",
  "nightlife",
  "quiet",
  "groceries",
  "eatingOut",
  "transport",
  "green",
];

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Whether the band fits the ceiling, as a verdict rather than a boolean.
 *
 * `tight` is the useful one and the reason this is not a boolean: an area
 * whose cheaper rooms are at the ceiling is findable, but only by someone who
 * starts looking in June. A student deserves to be told that is the situation
 * rather than being shown a green tick.
 */
export type RentVerdict = "comfortable" | "tight" | "over" | "unknown";

export const rentVerdictLabel: Record<RentVerdict, string> = {
  comfortable: "Within your budget",
  tight: "At the top of your budget",
  over: "Above your budget",
  unknown: "No budget set",
};

export type NeighbourhoodMatch = {
  area: Neighbourhood;
  /** 0-100. */
  fit: number;
  components: { rent: number; commute: number; traits: number };
  rentVerdict: RentVerdict;
  /** Door-to-door minutes to their campus, or null when we have no figure. */
  commuteMinutes: number | null;
  /** Discoverable students living there, already floored by the graph. Null = not saying. */
  studentsLiving: number | null;
  /** True while the rent band is a written estimate, not a reading. */
  rentEstimated: boolean;
  /** Facts, ordered, that produced this position. */
  reasons: string[];
  /** The honest counterweight. Empty only when there genuinely is not one. */
  tradeoffs: string[];
};

/* -------------------------------------------------------------------------- */
/* Component scores                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Rent against the ceiling, scored on the cheaper end of the band.
 *
 * The cheaper end and not the midpoint, deliberately: a student searching hard
 * gets rooms at the bottom of the range, and the midpoint would rule out
 * areas that are entirely findable for someone who starts early. The dearer
 * end is not discarded — it is what decides `tight` versus `comfortable`, so
 * the number that flatters is used for ranking and the number that warns is
 * used for the label.
 */
export function scoreRent(area: Neighbourhood, ceiling: number | null): { score: number; verdict: RentVerdict } {
  if (ceiling === null || ceiling <= 0) return { score: 0.5, verdict: "unknown" };

  const [low, high] = area.rent.room;
  if (low > ceiling) {
    // How far over, softened: 10% over is a stretch, 50% over is not an option.
    const overshoot = (low - ceiling) / ceiling;
    return { score: Math.max(0, 0.35 - overshoot), verdict: "over" };
  }

  if (high > ceiling) return { score: 0.7, verdict: "tight" };

  // Comfortably under is good and stays good; there is no prize for a cheaper
  // room the student did not ask for, so this does not keep climbing.
  const headroom = (ceiling - high) / ceiling;
  return { score: Math.min(1, 0.85 + headroom), verdict: "comfortable" };
}

/**
 * Commute against tolerance.
 *
 * Flat at 1.0 up to about half the tolerance — nobody prefers an eight-minute
 * commute to a fourteen-minute one — then falls, and keeps falling past the
 * stated limit instead of hitting zero, because "five minutes over what I
 * said" is not the same answer as "an hour over".
 */
export function scoreCommute(minutes: number | null, tolerance: number): number {
  if (minutes === null) return 0.5;
  const easy = Math.max(10, tolerance / 2);
  if (minutes <= easy) return 1;
  if (minutes <= tolerance) return 1 - (0.35 * (minutes - easy)) / Math.max(1, tolerance - easy);
  const over = (minutes - tolerance) / Math.max(10, tolerance);
  return Math.max(0, 0.65 - over * 0.65);
}

/**
 * The traits the student said they cared about, weighted by how much.
 *
 * Normalised over the declared priorities rather than over all seven, so a
 * student who names one thing gets a ranking about that one thing instead of a
 * ranking diluted by six traits they never mentioned. With nothing declared it
 * returns a neutral 0.5 and the other two components decide.
 */
export function scoreTraits(
  area: Neighbourhood,
  priorities: Partial<Record<NeighbourhoodTrait, Priority>>,
): number {
  let total = 0;
  let weight = 0;
  for (const [trait, priority] of Object.entries(priorities) as [NeighbourhoodTrait, Priority][]) {
    if (!priority) continue;
    total += priority * (area.traits[trait] / 4);
    weight += priority;
  }
  return weight === 0 ? 0.5 : total / weight;
}

/* -------------------------------------------------------------------------- */
/* Ranking                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The weights. Product decisions, in one block so a change is reviewable.
 *
 * Rent leads because it is the constraint that cannot be negotiated after the
 * fact, and commute is second because it is the one students consistently
 * underestimate: an extra twenty minutes each way is a hundred and twenty
 * hours a term, and nobody feels that when they are choosing from a map.
 */
export const matchWeights = { rent: 0.4, commute: 0.32, traits: 0.28 } as const;

export type MatchInput = {
  areas: readonly Neighbourhood[];
  preferences: LivingPreferences;
  /** Area slug -> students living there, already floored. From `areaDensity()`. */
  density?: ReadonlyMap<string, number>;
  /**
   * How to write a rent figure in the student's own currency and locale.
   *
   * Injected rather than imported for the same reason `canAfford` takes one:
   * this engine must stay pure and must not know what `Intl` is, and a bare
   * "550" in a sentence about rent is a number a student has to guess the
   * units of. Defaults to the plain figure so a caller that genuinely has no
   * locale still gets a readable string.
   */
  formatMoney?: (value: number) => string;
};

export function matchNeighbourhoods(input: MatchInput): readonly NeighbourhoodMatch[] {
  const { preferences: prefs } = input;
  const fmt = input.formatMoney ?? ((value: number) => String(value));

  const scored = input.areas.map((area): NeighbourhoodMatch => {
    const commuteMinutes = prefs.campusSlug ? area.commuteMinutes[prefs.campusSlug] ?? null : null;
    const rent = scoreRent(area, prefs.rentCeiling);
    const commute = scoreCommute(commuteMinutes, prefs.maxCommuteMinutes);
    const traits = scoreTraits(area, prefs.priorities);

    const fit = Math.round(
      100 * (matchWeights.rent * rent.score + matchWeights.commute * commute + matchWeights.traits * traits),
    );

    const studentsLiving = input.density?.get(area.slug) ?? null;

    return {
      area,
      fit: Math.max(0, Math.min(100, fit)),
      components: { rent: rent.score, commute, traits },
      rentVerdict: rent.verdict,
      commuteMinutes,
      studentsLiving,
      rentEstimated: area.rent.basis === "seed-estimate",
      reasons: reasonsFor(area, prefs, commuteMinutes, rent.verdict, studentsLiving, fmt),
      tradeoffs: tradeoffsFor(area, prefs, commuteMinutes, rent.verdict, fmt),
    };
  });

  return [...scored].sort((a, b) => b.fit - a.fit || a.area.name.localeCompare(b.area.name));
}

/* -------------------------------------------------------------------------- */
/* Explanation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The band words, restated here rather than imported from `data/types`.
 *
 * The engines only ever type-import across the `@/` alias, because node's
 * native type stripping — what the unit tests run on — resolves imports
 * literally and cannot follow it. Five words are a cheaper price than either
 * an untested engine or a relative import that breaks the convention.
 */
const BAND_WORD: Record<TraitBand, string> = {
  0: "barely",
  1: "a little",
  2: "some",
  3: "good",
  4: "strong",
};

function reasonsFor(
  area: Neighbourhood,
  prefs: LivingPreferences,
  commuteMinutes: number | null,
  verdict: RentVerdict,
  studentsLiving: number | null,
  fmt: (value: number) => string,
): string[] {
  const reasons: string[] = [];

  if (commuteMinutes !== null && commuteMinutes <= prefs.maxCommuteMinutes) {
    reasons.push(`${commuteMinutes} min to campus`);
  }
  if (verdict === "comfortable") {
    reasons.push(`Rooms from ${fmt(area.rent.room[0])} a month`);
  }

  /* Only the traits they asked about, and only where the area is actually
     strong — a "Good" on something nobody mentioned is filler. The band travels
     with the label, because "Nightlife" on its own is a category, not a claim:
     a student cannot tell whether it means the area has some bars or that it is
     the loudest district in the city. */
  for (const [trait, priority] of Object.entries(prefs.priorities) as [NeighbourhoodTrait, Priority][]) {
    if (!priority) continue;
    const band = area.traits[trait];
    if (band >= 3) reasons.push(`${traitLabel[trait]}: ${BAND_WORD[band]}`);
  }

  if (studentsLiving !== null) reasons.push(`${studentsLiving} students live here`);

  return reasons.slice(0, 4);
}

/**
 * What is wrong with it.
 *
 * Every result carries these, including the top one, and that is the point.
 * A recommender that only lists reasons to say yes is an advert; the student
 * will discover the tradeoff in week three either way, and finding it in the
 * app first is what makes the rest of the ranking believable.
 */
function tradeoffsFor(
  area: Neighbourhood,
  prefs: LivingPreferences,
  commuteMinutes: number | null,
  verdict: RentVerdict,
  fmt: (value: number) => string,
): string[] {
  const out: string[] = [];

  if (verdict === "over") out.push(`Rooms start around ${fmt(area.rent.room[0])} a month`);
  else if (verdict === "tight") out.push(`Cheaper rooms go early here`);

  if (commuteMinutes !== null && commuteMinutes > prefs.maxCommuteMinutes) {
    out.push(`${commuteMinutes} min to campus, over your ${prefs.maxCommuteMinutes}`);
  }

  for (const [trait, priority] of Object.entries(prefs.priorities) as [NeighbourhoodTrait, Priority][]) {
    if (priority !== 2) continue;
    if (area.traits[trait] <= 1) out.push(`Weak on ${traitLabel[trait].toLowerCase()}`);
  }

  return out.slice(0, 3);
}

/** The strongest trait band in an area, for a one-line summary chip. */
export function standoutTrait(area: Neighbourhood): { trait: NeighbourhoodTrait; band: TraitBand } {
  const entries = Object.entries(area.traits) as [NeighbourhoodTrait, TraitBand][];
  return entries.reduce(
    (best, [trait, band]) => (band > best.band ? { trait, band } : best),
    { trait: entries[0][0], band: entries[0][1] },
  );
}
