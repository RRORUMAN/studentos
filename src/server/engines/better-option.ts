import type { Place, PlaceLayer } from "@/data/types";
import type { Cents } from "@/domain/types";

/**
 * ============================================================================
 * BETTER OPTION
 * ----------------------------------------------------------------------------
 * Given something a student is looking at, find the cheaper thing nearby that
 * does the same job about as well.
 *
 * Three conditions, all of which must hold, or nothing is suggested:
 *
 *   same job      shares a layer with the original (cheap food for cheap food)
 *   genuinely cheaper  at least a fifth less, and at least the minimum gap
 *   about as good      student value within a tolerance of the original
 *
 * "About as good" is the one that keeps this honest. Suggesting a €4 kebab as
 * the better option to a €19 dinner is not a better option, it is a different
 * evening, and a student who takes the swap once and regrets it never trusts
 * the card again.
 *
 * Pure. No model, no I/O.
 * ============================================================================
 */

export type BetterOption = {
  place: Place;
  /** What the swap saves, per visit. */
  savingCents: Cents;
  /** Extra minutes of walking, if any. Negative means closer. */
  extraWalkMinutes: number;
  /** Difference in student value. Small negative is acceptable. */
  valueDelta: number;
  why: string;
};

const RULES = {
  minGapFraction: 0.2,
  minGapCents: 300,
  /** How much student value the alternative may lose and still count. */
  valueTolerance: 12,
  /** How much further the alternative may be. */
  extraWalkTolerance: 10,
} as const;

export function betterOption(input: {
  current: Place;
  candidates: readonly Place[];
  maxWalkMinutes: number;
}): BetterOption | null {
  const { current, candidates, maxWalkMinutes } = input;
  if (current.price === null || current.price <= 0) return null;

  const currentCents = Math.round(current.price * 100);
  const ceiling = Math.min(
    currentCents - RULES.minGapCents,
    Math.round(currentCents * (1 - RULES.minGapFraction)),
  );
  if (ceiling <= 0) return null;

  const layers = new Set<string>(current.layers.filter((layer) => layer !== "for-you"));

  const options = candidates
    .filter((place) => place.id !== current.id && place.citySlug === current.citySlug)
    .filter((place) => place.price !== null && Math.round(place.price * 100) <= ceiling)
    .filter((place) => place.layers.some((layer) => layers.has(layer)))
    .filter((place) => place.studentValue >= current.studentValue - RULES.valueTolerance)
    .filter((place) => place.walkMinutes <= maxWalkMinutes)
    .filter((place) => place.walkMinutes - current.walkMinutes <= RULES.extraWalkTolerance)
    .map((place) => {
      const cents = Math.round((place.price ?? 0) * 100);
      return {
        place,
        savingCents: currentCents - cents,
        extraWalkMinutes: place.walkMinutes - current.walkMinutes,
        valueDelta: place.studentValue - current.studentValue,
      };
    })
    /* Best saving first, then the one that is not further away. */
    .sort((a, b) => b.savingCents - a.savingCents || a.extraWalkMinutes - b.extraWalkMinutes);

  const best = options[0];
  if (!best) return null;

  const reasons: string[] = [];
  if (best.extraWalkMinutes <= 0) reasons.push("no further to walk");
  else reasons.push(`${best.extraWalkMinutes} min further`);
  if (best.valueDelta >= 0) reasons.push("rated as well or better by students");
  else reasons.push("rated nearly as well");
  if (best.place.verifiedBy >= 10) reasons.push(`confirmed by ${best.place.verifiedBy} students`);

  return { ...best, why: reasons.join(", ") };
}

/**
 * The better option for a spend that is not yet a place — "€35 on eating out".
 *
 * The spend is expressed as a stand-in place in the given layers, priced at
 * the amount, and run through the same three conditions as a real one. Two
 * choices make the stand-in fair rather than a loophole:
 *
 *   walk     set to the student's own limit, so the "not much further" rule
 *            cannot fire — there is no origin to be further from
 *   value    the median student value of the candidates, so "about as good"
 *            still means "at least as good as a typical place here", not
 *            "anything at all"
 *
 * `layers` is passed in rather than looked up from a budget category on
 * purpose: this engine knows about places, not about envelopes, and the
 * category vocabulary lives in `engines/budget.ts` (`layersForCategory`).
 * Keeping the dependency pointing that way is also what lets this file be
 * imported by the unit tests, which resolve paths literally.
 */
export function betterOptionForSpend(input: {
  amountCents: Cents;
  layers: readonly string[];
  citySlug: string;
  candidates: readonly Place[];
  maxWalkMinutes: number;
}): BetterOption | null {
  const layers = input.layers as readonly PlaceLayer[];
  if (layers.length === 0 || input.amountCents <= 0) return null;

  const pool = input.candidates.filter(
    (place) => place.citySlug === input.citySlug && place.layers.some((layer) => layers.includes(layer)),
  );
  if (pool.length === 0) return null;

  const values = pool.map((place) => place.studentValue).sort((a, b) => a - b);
  const medianValue = values[Math.floor(values.length / 2)];

  const current: Place = {
    id: "this-spend",
    citySlug: input.citySlug,
    name: "This spend",
    category: "spend",
    layers,
    price: input.amountCents / 100,
    priceLabel: "",
    walkMinutes: input.maxWalkMinutes,
    studentValue: medianValue,
    verifiedBy: 0,
    why: "",
    source: "students",
    x: 0,
    y: 0,
  };

  return betterOption({ current, candidates: pool, maxWalkMinutes: input.maxWalkMinutes });
}
