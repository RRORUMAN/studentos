import type { Place, PlaceLayer } from "@/data/types";
import type { Cents } from "@/domain/types";

/**
 * ============================================================================
 * BETTER OPTION
 * ----------------------------------------------------------------------------
 * Given something a student is looking at, find the cheaper thing nearby that
 * does the same job about as well.
 *
 * Four conditions, all of which must hold, or nothing is suggested:
 *
 *   same job     shares a layer with the original (cheap food for cheap food)
 *   cheaper      a lower price band, or a lower observed price where students
 *                have reported one
 *   as good      value band no worse than one step below the original
 *   near         not meaningfully further away
 *
 * "About as good" is the condition that keeps this honest. Suggesting a kebab
 * counter as the better option to a sit-down dinner is not a better option, it
 * is a different evening, and a student who takes the swap once and regrets it
 * never trusts the card again.
 *
 * ---------------------------------------------------------------------------
 * WHERE THE MONEY FIGURE COMES FROM, AND WHEN THERE ISN'T ONE
 *
 * This engine used to say "saves €6" by subtracting two hand-written euro
 * prices. Those prices are gone: a provider publishes a price BAND, not an
 * amount, so an amount can only come from somewhere a student can point at.
 *
 * There is exactly one such source and the product already collects it —
 * `priceObservations`, what students actually paid. So:
 *
 *   both places have a confident reading  ->  "saves about €6"
 *   otherwise                             ->  "cheaper band" and no number
 *
 * The second case is the common one and it is not a degraded answer. "One
 * price band cheaper, two minutes closer, rated as well" is a real recommendation
 * a student can act on. An invented "saves €6" is a better-looking one that
 * stops being true the first time somebody checks.
 *
 * Pure. No model, no I/O.
 * ============================================================================
 */

/** What students have paid here, when enough of them have said. */
export type ObservedPrice = {
  medianCents: Cents;
  sampleSize: number;
  lastObservedAt: string | null;
};

export type BetterOption = {
  place: Place;
  /**
   * What the swap saves per visit, in cents — ONLY when both places have a
   * confident student price reading. Null the rest of the time, and the
   * interface must render the reason rather than a zero.
   */
  savingCents: Cents | null;
  /** How the saving is known, so the card can cite it. */
  savingBasis: "student-reports" | null;
  /** Metres further away. Negative means closer. */
  extraMetres: number;
  /** Price bands, for the sentence when there is no figure. */
  fromPriceLevel: number | null;
  toPriceLevel: number | null;
  why: string;
};

const RULES = {
  /** A price reading below this many reports is a rumour, not a price. */
  minObservations: 3,
  /** Minimum saving worth interrupting somebody for. */
  minGapCents: 300,
  minGapFraction: 0.2,
  /** How much further the alternative may be, in metres. */
  extraMetresTolerance: 700,
} as const;

/** strong > good > mixed > insufficient, as a number so it can be compared. */
const VALUE_RANK: Record<Place["value"]["band"], number> = {
  strong: 3,
  good: 2,
  insufficient: 1,
  mixed: 0,
};

export function betterOption(input: {
  current: Place;
  candidates: readonly Place[];
  /** Metres the student is willing to travel. */
  maxMetres: number;
  /** Student price reports by place id. Absent ids simply have no reading. */
  observed?: ReadonlyMap<string, ObservedPrice>;
  /**
   * Skip both distance rules.
   *
   * Set only by `betterOptionForSpend`, where the thing being compared against
   * is an amount of money rather than somewhere on the map. With no origin,
   * "not much further than the original" has nothing to be further than, and
   * leaving the rule on silently rejected every candidate over 700 m away.
   */
  ignoreDistance?: boolean;
}): BetterOption | null {
  const { current, candidates, maxMetres, observed } = input;
  const ignoreDistance = input.ignoreDistance ?? false;

  const currentPrice = confidentPrice(observed?.get(current.id));
  const currentRank = VALUE_RANK[current.value.band];
  const layers = new Set<string>(current.layers.filter((layer) => layer !== "for-you"));
  if (layers.size === 0) return null;

  const options = candidates
    .filter((place) => place.id !== current.id && place.citySlug === current.citySlug)
    .filter((place) => place.layers.some((layer) => layers.has(layer)))
    /* No worse than one band below. `insufficient` outranks `mixed` on
       purpose: "nobody has said" is a better bet than "people said it was
       middling". */
    .filter((place) => VALUE_RANK[place.value.band] >= currentRank - 1)
    .filter((place) => ignoreDistance || place.proximity.metres <= maxMetres)
    .filter(
      (place) =>
        ignoreDistance ||
        place.proximity.metres - current.proximity.metres <= RULES.extraMetresTolerance,
    )
    .map((place) => {
      const price = confidentPrice(observed?.get(place.id));
      const saving =
        currentPrice !== null && price !== null && isWorthwhile(currentPrice, price)
          ? currentPrice - price
          : null;

      return {
        place,
        savingCents: saving,
        savingBasis: saving === null ? null : ("student-reports" as const),
        extraMetres: place.proximity.metres - current.proximity.metres,
        fromPriceLevel: current.priceLevel,
        toPriceLevel: place.priceLevel,
        cheaperBand:
          current.priceLevel !== null &&
          place.priceLevel !== null &&
          place.priceLevel < current.priceLevel,
      };
    })
    /* Cheaper by SOME measure, or there is nothing to suggest. A place that is
       merely closer is not a better option, it is a different place. */
    .filter((option) => option.savingCents !== null || option.cheaperBand)
    /* A real reported saving first, then a cheaper band, then the nearer one. */
    .sort(
      (a, b) =>
        (b.savingCents ?? 0) - (a.savingCents ?? 0) ||
        Number(b.cheaperBand) - Number(a.cheaperBand) ||
        a.extraMetres - b.extraMetres,
    );

  const best = options[0];
  if (!best) return null;

  const reasons: string[] = [];
  if (!ignoreDistance) {
    if (best.extraMetres <= 0) reasons.push(`${Math.abs(Math.round(best.extraMetres))} m closer`);
    else if (best.extraMetres > 200) reasons.push(`${Math.round(best.extraMetres)} m further`);
  }

  if (VALUE_RANK[best.place.value.band] >= currentRank) reasons.push("rated as well or better");
  else reasons.push("rated nearly as well");

  if (best.place.confirmations >= 10) {
    reasons.push(`confirmed by ${best.place.confirmations} students`);
  }

  return {
    place: best.place,
    savingCents: best.savingCents,
    savingBasis: best.savingBasis,
    extraMetres: best.extraMetres,
    fromPriceLevel: best.fromPriceLevel,
    toPriceLevel: best.toPriceLevel,
    why: reasons.join(", "),
  };
}

function confidentPrice(observed: ObservedPrice | undefined): Cents | null {
  if (!observed || observed.sampleSize < RULES.minObservations) return null;
  return observed.medianCents;
}

function isWorthwhile(from: Cents, to: Cents): boolean {
  if (to >= from) return false;
  const gap = from - to;
  return gap >= RULES.minGapCents && gap >= from * RULES.minGapFraction;
}

/**
 * The cheaper way to spend an amount the student named — "€35 on eating out".
 *
 * The amount is real: they typed it. What is NOT known is what the alternatives
 * cost, unless students have reported. So this returns the cheapest-band place
 * that does the same job, and the caller states the saving only if
 * `savingCents` came back set.
 *
 * The stand-in place used to be given a hand-computed median student value so
 * that "about as good" had something to compare against. It is now given the
 * median VALUE BAND of the candidate pool, which is the same idea over the
 * data that actually exists.
 */
export function betterOptionForSpend(input: {
  amountCents: Cents;
  layers: readonly string[];
  citySlug: string;
  candidates: readonly Place[];
  maxMetres: number;
  observed?: ReadonlyMap<string, ObservedPrice>;
}): BetterOption | null {
  const layers = input.layers as readonly PlaceLayer[];
  if (layers.length === 0 || input.amountCents <= 0) return null;

  const pool = input.candidates.filter(
    (place) =>
      place.citySlug === input.citySlug && place.layers.some((layer) => layers.includes(layer)),
  );
  if (pool.length === 0) return null;

  const ranks = pool.map((place) => VALUE_RANK[place.value.band]).sort((a, b) => a - b);
  const medianRank = ranks[Math.floor(ranks.length / 2)] ?? 1;
  const medianBand =
    (Object.keys(VALUE_RANK) as Place["value"]["band"][]).find(
      (band) => VALUE_RANK[band] === medianRank,
    ) ?? "insufficient";

  const current: Place = {
    id: "this-spend",
    citySlug: input.citySlug,
    name: "This spend",
    category: "Spend",
    categoryKey: "restaurant",
    layers,
    /* The stand-in is priced at the top band, so any cheaper-band place
       qualifies. The amount the student typed is carried separately, into
       `observed`, where it is treated as one confident reading about this
       imaginary place — which is exactly what it is. */
    priceLevel: 4,
    proximity: { kind: "straight-line", metres: 0, minutes: null },
    value: { band: medianBand, reasons: [] },
    confirmations: 0,
    saves: 0,
    lat: 0,
    lng: 0,
    address: null,
    brand: null,
    website: null,
    phone: null,
    openingHours: null,
    rating: null,
    ratingCount: null,
    provider: "students",
    sourceUrl: "",
    attribution: "",
    confidence: "unknown",
    fetchedAt: new Date(0).toISOString(),
  };

  const observed = new Map(input.observed ?? []);
  observed.set("this-spend", {
    medianCents: input.amountCents,
    sampleSize: RULES.minObservations,
    lastObservedAt: null,
  });

  return betterOption({
    current,
    candidates: pool,
    maxMetres: input.maxMetres,
    observed,
    /* The stand-in has no origin, so "further away" is meaningless and the
       distance rules must not be able to reject anything. */
    ignoreDistance: true,
  });
}
