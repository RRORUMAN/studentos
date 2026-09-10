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
  /**
   * Which of the three components was scored on something real, and which was
   * scored 0.5 because nothing is known.
   *
   * WITHOUT THIS, THE FIT NUMBER LIES BY OMISSION. Every unknown signal scores
   * a neutral 0.5, which is the right thing to do to a ranking and the wrong
   * thing to show a person: an imported area in Vienna knows no rent, no
   * commute and no traits, scores 0.5 three times, and comes out as "50% fit"
   * — a number with the same shape and typography as the 50% earned by an area
   * that was measured on all three and landed in the middle. One of those is a
   * finding and the other is a shrug, and a student cannot tell them apart.
   *
   * So the engine reports what it knew, and `evidence` below reduces it to the
   * question a surface actually asks.
   */
  knows: { rent: boolean; commute: boolean; traits: boolean };
  /**
   * `"scored"` when at least one component was real, `"listed"` when none was.
   *
   * A `"listed"` area is a real place with a real name in a real position that
   * nobody has said anything about yet. It belongs on the screen — leaving it
   * off would tell a student in Vienna the city has no neighbourhoods — but it
   * does not belong in a league table, and a surface showing one must show the
   * name without the percentage.
   */
  evidence: "scored" | "listed";
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
  /* Two different unknowns, one answer. Either the student has not said what
     they can pay, or nobody has priced this area -- an imported neighbourhood
     carries a name and a coordinate and no rent. Neutral, never zero and never
     a pass, which is this codebase's rule for a missing signal. */
  if (ceiling === null || ceiling <= 0) return { score: 0.5, verdict: "unknown" };
  if (area.rent === null) return { score: 0.5, verdict: "unknown" };

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
  /* An area nobody has rated cannot be scored on what it is like. */
  if (area.traits === null) return 0.5;

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

    /* What was measured, as opposed to what was assumed neutral. Rent counts
       as known only when there is both a band and a ceiling to judge it
       against; traits only when the area is rated AND the student named a
       priority, because an unasked question is not an answer either. */
    const knows = {
      rent: area.rent !== null && prefs.rentCeiling !== null && prefs.rentCeiling > 0,
      commute: commuteMinutes !== null,
      traits: area.traits !== null && Object.values(prefs.priorities).some(Boolean),
    };

    return {
      area,
      fit: Math.max(0, Math.min(100, fit)),
      components: { rent: rent.score, commute, traits },
      rentVerdict: rent.verdict,
      commuteMinutes,
      studentsLiving,
      rentEstimated: area.rent?.basis === "seed-estimate",
      knows,
      evidence: knows.rent || knows.commute || knows.traits ? "scored" : "listed",
      reasons: reasonsFor(area, prefs, commuteMinutes, rent.verdict, studentsLiving, fmt),
      tradeoffs: tradeoffsFor(area, prefs, commuteMinutes, rent.verdict, fmt),
    };
  });

  /**
   * Measured areas first, then fit, then the name.
   *
   * The first key is the one that needs defending. An area nobody has priced
   * or rated scores a neutral 0.5 on every component and lands on exactly 50,
   * which would put it above a real, measured, honestly-mediocre 44 — so the
   * ranking would be led by the areas it knows least about, and the top of the
   * list would be the emptiest part of it. Sorting known evidence above no
   * evidence is not a thumb on the scale; it is the difference between a
   * ranking and an alphabetised list wearing a ranking's clothes.
   *
   * Note this is stable within each group: in a city where nothing is measured
   * every area is `listed`, the first key does nothing, every fit ties, and the
   * result is alphabetical — which is the honest presentation of a set of
   * places we know the names of and nothing more.
   */
  const rank = (entry: NeighbourhoodMatch) => (entry.evidence === "scored" ? 1 : 0);
  return [...scored].sort(
    (a, b) => rank(b) - rank(a) || b.fit - a.fit || a.area.name.localeCompare(b.area.name),
  );
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
  if (verdict === "comfortable" && area.rent) {
    reasons.push(`Rooms from ${fmt(area.rent.room[0])} a month`);
  }

  /* Only the traits they asked about, and only where the area is actually
     strong — a "Good" on something nobody mentioned is filler. The band travels
     with the label, because "Nightlife" on its own is a category, not a claim:
     a student cannot tell whether it means the area has some bars or that it is
     the loudest district in the city. */
  for (const [trait, priority] of Object.entries(prefs.priorities) as [NeighbourhoodTrait, Priority][]) {
    if (!priority) continue;
    const band = area.traits?.[trait];
    if (band === undefined) continue;
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

  if (verdict === "over" && area.rent) out.push(`Rooms start around ${fmt(area.rent.room[0])} a month`);
  else if (verdict === "tight") out.push(`Cheaper rooms go early here`);

  if (commuteMinutes !== null && commuteMinutes > prefs.maxCommuteMinutes) {
    out.push(`${commuteMinutes} min to campus, over your ${prefs.maxCommuteMinutes}`);
  }

  for (const [trait, priority] of Object.entries(prefs.priorities) as [NeighbourhoodTrait, Priority][]) {
    if (priority !== 2) continue;
    if ((area.traits?.[trait] ?? 9) <= 1) out.push(`Weak on ${traitLabel[trait].toLowerCase()}`);
  }

  return out.slice(0, 3);
}

/** The strongest trait band in an area, for a one-line summary chip. */
export function standoutTrait(area: Neighbourhood): { trait: NeighbourhoodTrait; band: TraitBand } | null {
  /* No ratings, no standout. The chip is simply not rendered. */
  if (area.traits === null) return null;
  const entries = Object.entries(area.traits) as [NeighbourhoodTrait, TraitBand][];
  return entries.reduce(
    (best, [trait, band]) => (band > best.band ? { trait, band } : best),
    { trait: entries[0][0], band: entries[0][1] },
  );
}

/* -------------------------------------------------------------------------- */
/* Which area a point is in                                                    */
/* -------------------------------------------------------------------------- */

/**
 * How far from an area's centre a place may be and still be said to be in it.
 *
 * A city neighbourhood is roughly a kilometre across, so 1200 m from the
 * centre point covers it and a little of the edge. It is deliberately not
 * generous: the claim "this is in Malasana" is one a student can check by
 * walking, and being wrong about it is worse than saying nothing. Anything
 * further away gets no area at all rather than the nearest one.
 */
export const AREA_RADIUS_METRES = 1_200;

/**
 * The neighbourhood a point sits in, or null.
 *
 * NEAREST CENTRE INSIDE A RADIUS, which is an approximation and is worth being
 * honest about: a real neighbourhood is a polygon with a jagged edge, and this
 * is a circle around a single point. It is right in the middle of an area and
 * can be wrong at the boundary between two, where a street belongs to whichever
 * centre it happens to be nearer. Boundary polygons would fix that and are a
 * much larger dataset to hold and keep current; for the claim being made here —
 * "this cafe is in Gracia, twenty minutes from your campus" — a centre and a
 * radius is the resolution the answer actually needs.
 *
 * REPLACES A STRING MATCH, and that is the point of it. This used to read the
 * area off the end of the place's own name: "Ramen counter, Malasana" was in
 * Malasana because the text said so. Every invented place was written that way
 * and no real one is, so when the invented places were deleted this silently
 * returned null for everything and a whole section of the place page stopped
 * rendering with nothing failing.
 *
 * Areas with no coordinate are skipped, so an area nobody could geolocate
 * never claims a place.
 */
export function areaForPoint(
  areas: readonly Neighbourhood[],
  point: { lat: number; lng: number },
): Neighbourhood | null {
  let best: { area: Neighbourhood; metres: number } | null = null;

  for (const area of areas) {
    if (area.lat === null || area.lng === null) continue;
    const metres = metresBetween(point, { lat: area.lat, lng: area.lng });
    if (metres > AREA_RADIUS_METRES) continue;
    if (best === null || metres < best.metres) best = { area, metres };
  }

  return best?.area ?? null;
}

/**
 * Great-circle distance in metres.
 *
 * Written here rather than imported from `@/domain/places` so this engine keeps
 * the property every engine in this directory has: it depends on nothing but
 * its arguments and arithmetic.
 */
function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
