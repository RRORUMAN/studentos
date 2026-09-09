import type { Place } from "@/data/types";
import { WALK_METRES_PER_MINUTE } from "@/server/engines/recommend";
import type { PriceObservation } from "@/domain/knowledge";
import { summarisePrices } from "@/domain/knowledge";
import type { Cents, Transaction } from "@/domain/types";
import { categoryLabel, isDiscretionary, layersForCategory } from "@/server/engines/budget";

/**
 * ============================================================================
 * MONEY-SAVING ENGINE
 * ----------------------------------------------------------------------------
 * Turns a passive budget into an active one: not "you spent €74 on lunch" but
 * "you spent €74 on lunch, here are three places near you that would have cost
 * €43, and here is what the difference is over a term".
 *
 * ---------------------------------------------------------------------------
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 * **Never state a saving more precisely than the data supports.**
 *
 * It is trivially easy to write "save €312 a year!" from four transactions and
 * one cheap café. It is also the fastest way to lose a student permanently: the
 * first time a confident number turns out to be nonsense, every other number in
 * the product becomes suspect.
 *
 * So every opportunity carries a `confidence`, the thresholds are explicit
 * below, and a low-confidence finding is phrased as a range or suppressed
 * entirely rather than rounded into a headline. `annualise` deliberately does
 * not exist — projecting a term's worth of savings from two weeks of lunches
 * is exactly the fake precision this guards against.
 *
 * When the sample is too small for a saving at all, `cheapOptions` still
 * names cheap places nearby — phrased as options, with no saving attached.
 *
 * No model is called. This is arithmetic over the student's own transactions
 * and the community price graph.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Thresholds                                                                  */
/* -------------------------------------------------------------------------- */

const RULES = {
  /** Below this many transactions in a category, we have an anecdote. */
  minTransactions: 4,
  /** Below this, the weekly difference is noise and not worth a card. */
  minWeeklySavingCents: 400,
  /** An alternative must beat the current average by at least this much. */
  minGapFraction: 0.2,
  /** How far back to look. A term is too long; a week is too jumpy. */
  windowDays: 28,
  /** Price-graph samples needed before a community median is quotable. */
  minPriceSamples: 4,
} as const;

/* -------------------------------------------------------------------------- */
/* Shape                                                                       */
/* -------------------------------------------------------------------------- */

export type SavingConfidence = "measured" | "indicative" | "insufficient";

export type Alternative = {
  placeId: string;
  name: string;
  /**
   * What students reported paying here. Null when nobody has, which is the
   * usual case — no place provider publishes an amount, so this is the only
   * source for one and it is the students themselves.
   */
  priceCents: Cents | null;
  /** The provider's 1-4 band, shown when there is no reported price. */
  priceLevel: number | null;
  /** Straight-line metres. A duration would need a router. */
  metres: number;
  why: string;
  verifiedBy: number;
};

export type CityBand = {
  item: string;
  lowCents: Cents;
  medianCents: Cents;
  highCents: Cents;
  sampleSize: number;
};

export type SavingOpportunity = {
  category: string;
  label: string;
  /** What they actually spent in this category over the window. */
  spentCents: Cents;
  /** Per-transaction average. The number the comparison is built on. */
  averageCents: Cents;
  transactionCount: number;
  /** Cheaper real places, ranked. Never empty for a reported opportunity. */
  alternatives: Alternative[];
  /** Average of the alternatives shown. */
  alternativeAverageCents: Cents;
  /**
   * Weekly difference *if they switched every time*. Stated as a hypothetical
   * in the copy, never as money already lost.
   */
  weeklyDifferenceCents: Cents;
  confidence: SavingConfidence;
  /** What students here report paying for the matching item, when enough have. */
  city: CityBand | null;
  /** The honest sentence for this opportunity. */
  headline: string;
  detail: string;
};

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export function findSavings(input: {
  now: Date;
  transactions: readonly Transaction[];
  places: readonly Place[];
  priceObservations: readonly PriceObservation[];
  /** How far the student will walk. Alternatives beyond it are not options. */
  maxWalkMinutes: number;
  formatMoney: (cents: Cents) => string;
}): SavingOpportunity[] {
  const { now, transactions, places, priceObservations, maxWalkMinutes, formatMoney } = input;

  /* The tolerance arrives in minutes because that is how a student states it,
     and everything below measures in metres because that is what we can
     actually measure. Converted once, here, and never rendered — a figure
     derived this way is not a walking time and must not be shown as one. */
  const maxMetres = Math.max(400, maxWalkMinutes * WALK_METRES_PER_MINUTE);

  /* What students reported paying, by place: the only source in the product
     for what somewhere actually costs. The median of the reports, so one
     unlucky evening does not become the price. */
  const observed = medianByPlace(priceObservations);

  const since = now.getTime() - RULES.windowDays * 86_400_000;
  const recent = transactions.filter((tx) => Date.parse(tx.spentAt) >= since);

  /* Group by category, discretionary only. There is no cheaper alternative to
     rent, and suggesting one would be insulting rather than helpful. */
  const byCategory = new Map<string, Transaction[]>();
  for (const tx of recent) {
    if (!isDiscretionary(tx.category)) continue;
    const list = byCategory.get(tx.category) ?? [];
    list.push(tx);
    byCategory.set(tx.category, list);
  }

  const opportunities: SavingOpportunity[] = [];

  for (const [category, rows] of byCategory) {
    if (rows.length < RULES.minTransactions) continue;

    const spentCents = rows.reduce((sum, tx) => sum + tx.amountCents, 0);
    const averageCents = Math.round(spentCents / rows.length);

    const alternatives = cheaperPlaces({ category, averageCents, places, maxMetres, observed });

    if (alternatives.length === 0) continue;

    /* A WEEKLY SAVING IS A NUMBER, so it may only be computed from numbers.
       An alternative priced only by its band tells us it is cheaper; it does
       not tell us by how much. So the average is taken over the alternatives
       students have actually reported a price for, and with fewer than two of
       those there is no figure to state — the caller falls through to
       `cheapOptions`, which recommends without claiming an amount. */
    const priced = alternatives
      .map((place) => place.priceCents)
      .filter((cents): cents is Cents => cents !== null);

    if (priced.length < 2) continue;

    const alternativeAverageCents = Math.round(
      priced.reduce((sum, cents) => sum + cents, 0) / priced.length,
    );

    /* Weekly rate from the observed window, not from an assumed frequency. */
    const perWeek = rows.length / (RULES.windowDays / 7);
    const weeklyDifferenceCents = Math.round((averageCents - alternativeAverageCents) * perWeek);

    if (weeklyDifferenceCents < RULES.minWeeklySavingCents) continue;

    const confidence = confidenceFor(rows.length, alternatives.length);
    if (confidence === "insufficient") continue;

    const item = benchmarkItemFor(category);
    const city = item ? cityBand(priceObservations, item) : null;

    opportunities.push({
      category,
      label: categoryLabel(category),
      spentCents,
      averageCents,
      transactionCount: rows.length,
      alternatives,
      alternativeAverageCents,
      weeklyDifferenceCents,
      confidence,
      city,
      ...phrase({
        category,
        averageCents,
        alternativeAverageCents,
        weeklyDifferenceCents,
        transactionCount: rows.length,
        confidence,
        city,
        formatMoney,
      }),
    });
  }

  return opportunities.sort((a, b) => b.weeklyDifferenceCents - a.weeklyDifferenceCents);
}

/* -------------------------------------------------------------------------- */
/* Alternatives                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Cheaper places for a category the student overspends in.
 *
 * WHAT CHANGED, AND WHY IT MATTERS HERE MOST. This used to compare a euro
 * price on the place against the student's own average spend. Only half of
 * that comparison was ever real: the average is genuinely theirs, computed
 * from their transactions, and the place price was hand-written.
 *
 * A place now carries a price BAND rather than an amount, so the comparison is
 * between a real average and a band. That is still a recommendation worth
 * making — "you spend £11 on lunch and these three are in the cheap band" —
 * and it is one this engine can make honestly. What it can no longer do is put
 * a figure on the saving from the place's side, so `priceCents` is null unless
 * students have reported paying something.
 */
function cheaperPlaces(input: {
  category: string;
  averageCents: Cents;
  places: readonly Place[];
  maxMetres: number;
  observed?: ReadonlyMap<string, Cents>;
}): Alternative[] {
  const layers = layersForCategory(input.category);
  if (layers.length === 0) return [];

  const ceiling = Math.round(input.averageCents * (1 - RULES.minGapFraction));

  return input.places
    .filter((place) => place.layers.some((layer) => layers.includes(layer)))
    .filter((place) => {
      const reported = input.observed?.get(place.id);
      /* A reported price has to actually beat the ceiling. With no report the
         cheap band is the qualification — weaker evidence, which the
         confidence band already reflects. */
      if (reported !== undefined) return reported <= ceiling;
      return place.priceLevel !== null && place.priceLevel <= 1;
    })
    .filter((place) => place.proximity.metres <= input.maxMetres)
    /* Confirmed places first: recommending a swap nobody has verified is how a
       "saving" turns into a wasted trip. */
    .sort((a, b) => b.confirmations - a.confirmations || a.proximity.metres - b.proximity.metres)
    .slice(0, 3)
    .map((place) => toAlternative(place, input.observed?.get(place.id) ?? null));
}

/**
 * The median reported price per place.
 *
 * Median rather than mean, for the same reason `PriceReading` uses one: a
 * single €40 report should not become the price of a place forty students pay
 * €9 at.
 */
function medianByPlace(observations: readonly PriceObservation[]): Map<string, Cents> {
  const byPlace = new Map<string, Cents[]>();
  for (const row of observations) {
    if (!row.placeId) continue;
    const held = byPlace.get(row.placeId);
    if (held) held.push(row.amountCents);
    else byPlace.set(row.placeId, [row.amountCents]);
  }

  const out = new Map<string, Cents>();
  for (const [placeId, amounts] of byPlace) {
    amounts.sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    if (median !== undefined) out.set(placeId, median);
  }
  return out;
}

function toAlternative(place: Place, reportedCents: Cents | null): Alternative {
  return {
    placeId: place.id,
    name: place.name,
    priceCents: reportedCents,
    priceLevel: place.priceLevel,
    metres: place.proximity.metres,
    why: place.value.reasons.join(" · ") || place.category,
    verifiedBy: place.confirmations,
  };
}

/**
 * Cheap places for a category, with no saving claimed.
 *
 * This is what the Budget screen shows when a category is drifting but the
 * student has too few transactions for `findSavings` to say anything honest:
 * "cheap options nearby" is true with one transaction; "saves €9 a week" is
 * not. Cheapest first, verified breaking ties.
 */
export function cheapOptions(input: {
  category: string;
  places: readonly Place[];
  maxMetres: number;
  observed?: ReadonlyMap<string, Cents>;
  limit?: number;
}): Alternative[] {
  const layers = layersForCategory(input.category);
  if (layers.length === 0) return [];

  return input.places
    .filter((place) => place.layers.some((layer) => layers.includes(layer)))
    .filter((place) => place.proximity.metres <= input.maxMetres)
    /* Cheapest band first; an unknown band sorts behind both, because "nobody
       published a price" is not a claim to be cheap. Confirmations break ties,
       then distance. */
    .sort(
      (a, b) =>
        (a.priceLevel ?? 3) - (b.priceLevel ?? 3) ||
        b.confirmations - a.confirmations ||
        a.proximity.metres - b.proximity.metres,
    )
    .slice(0, input.limit ?? 3)
    .map((place) => toAlternative(place, input.observed?.get(place.id) ?? null));
}

/* -------------------------------------------------------------------------- */
/* Confidence                                                                  */
/* -------------------------------------------------------------------------- */

function confidenceFor(transactionCount: number, alternativeCount: number): SavingConfidence {
  if (transactionCount >= 8 && alternativeCount >= 2) return "measured";
  if (transactionCount >= RULES.minTransactions && alternativeCount >= 1) return "indicative";
  return "insufficient";
}

/**
 * The copy.
 *
 * "measured" gets a number. "indicative" gets a range and says the sample is
 * small. Neither ever says the student wasted money — the framing is always a
 * future choice, because the past one is not changeable and telling someone off
 * about it is the fastest way to make them stop logging spending at all.
 */
function phrase(input: {
  category: string;
  averageCents: Cents;
  alternativeAverageCents: Cents;
  weeklyDifferenceCents: Cents;
  transactionCount: number;
  confidence: SavingConfidence;
  city: CityBand | null;
  formatMoney: (cents: Cents) => string;
}): { headline: string; detail: string } {
  const { formatMoney: fmt } = input;
  const label = categoryLabel(input.category).toLowerCase();
  const cityNote = input.city
    ? ` Students here report ${fmt(input.city.lowCents)}–${fmt(input.city.highCents)} for ${itemLabel(input.city.item)}.`
    : "";

  if (input.confidence === "measured") {
    return {
      headline: `You average ${fmt(input.averageCents)} on ${label}.`,
      detail: `These are around ${fmt(
        input.alternativeAverageCents,
      )}. Switching where it suits you is about ${fmt(
        input.weeklyDifferenceCents,
      )} a week — from ${input.transactionCount} of your own transactions, not an estimate.${cityNote}`,
    };
  }

  /* Indicative: a band, and the sample size said out loud. */
  const low = Math.round(input.weeklyDifferenceCents * 0.6);
  const high = Math.round(input.weeklyDifferenceCents * 1.2);

  return {
    headline: `Your ${label} could be cheaper.`,
    detail: `Around ${fmt(input.averageCents)} on average against ${fmt(
      input.alternativeAverageCents,
    )} nearby — roughly ${fmt(low)}–${fmt(high)} a week. Only ${
      input.transactionCount
    } transactions so far, so treat that as a direction rather than a figure.${cityNote}`,
  };
}

/* -------------------------------------------------------------------------- */
/* City price context                                                          */
/* -------------------------------------------------------------------------- */

/** Which price-graph item stands in for a budget category, if any. */
export function benchmarkItemFor(category: string): string | null {
  return (
    (
      {
        "eating-out": "lunch",
        nightlife: "pint",
        groceries: "weekly-basket",
        fitness: "gym-month",
      } as Record<string, string>
    )[category] ?? null
  );
}

export function itemLabel(item: string): string {
  return (
    (
      {
        lunch: "lunch",
        pint: "a pint",
        "weekly-basket": "a weekly shop",
        "gym-month": "a month of gym",
        coffee: "a coffee",
      } as Record<string, string>
    )[item] ?? item.replace(/-/g, " ")
  );
}

/**
 * What a thing costs here, from community reports.
 *
 * Returns null below the sample threshold rather than a lonely median. One
 * student's €14 lunch is not the city price, and printing it as one is how the
 * price graph would start lying.
 */
export function cityPrice(
  observations: readonly PriceObservation[],
  item: string,
): { lowCents: Cents; medianCents: Cents; highCents: Cents; sampleSize: number } | null {
  const reading = summarisePrices(observations, item);
  if (reading.sampleSize < RULES.minPriceSamples) return null;

  return {
    lowCents: reading.lowCents,
    medianCents: reading.medianCents,
    highCents: reading.highCents,
    sampleSize: reading.sampleSize,
  };
}

function cityBand(observations: readonly PriceObservation[], item: string): CityBand | null {
  const price = cityPrice(observations, item);
  return price ? { item, ...price } : null;
}

/**
 * Compare what this student pays against what students here report paying.
 *
 * The comparison is only offered when both sides have enough data, and it is
 * framed neutrally: "students here report €8-13" is information, "you are
 * overpaying" is a judgement the data cannot support.
 */
export function compareToCity(input: {
  transactions: readonly Transaction[];
  observations: readonly PriceObservation[];
  category: string;
  item: string;
  now: Date;
}): { yoursCents: Cents; cityMedianCents: Cents; above: boolean; sampleSize: number } | null {
  const since = input.now.getTime() - RULES.windowDays * 86_400_000;
  const rows = input.transactions.filter(
    (tx) => tx.category === input.category && Date.parse(tx.spentAt) >= since,
  );

  if (rows.length < RULES.minTransactions) return null;

  const city = cityPrice(input.observations, input.item);
  if (!city) return null;

  const yoursCents = Math.round(
    rows.reduce((sum, tx) => sum + tx.amountCents, 0) / rows.length,
  );

  return {
    yoursCents,
    cityMedianCents: city.medianCents,
    above: yoursCents > city.medianCents,
    sampleSize: city.sampleSize,
  };
}

/**
 * The benchmark line for the Budget screen.
 *
 * Two sentences, two audiences. `cityLine` is the community figure and is
 * free to everyone — it is other students' data, not a paid insight.
 * `personalLine` is the comparison against the student's own average and is
 * the Max feature; it is null when either side lacks data.
 */
export type SpendBenchmark = {
  category: string;
  item: string;
  city: CityBand;
  cityLine: string;
  comparison: { yoursCents: Cents; above: boolean } | null;
  personalLine: string | null;
};

export function spendBenchmark(input: {
  transactions: readonly Transaction[];
  observations: readonly PriceObservation[];
  category: string;
  now: Date;
  formatMoney: (cents: Cents) => string;
}): SpendBenchmark | null {
  const item = benchmarkItemFor(input.category);
  if (!item) return null;
  const city = cityBand(input.observations, item);
  if (!city) return null;

  const fmt = input.formatMoney;
  const label = itemLabel(item);
  const comparison = compareToCity({ ...input, item });

  return {
    category: input.category,
    item,
    city,
    cityLine: `Students here report ${fmt(city.lowCents)}–${fmt(city.highCents)} for ${label} (${city.sampleSize} reports).`,
    comparison: comparison ? { yoursCents: comparison.yoursCents, above: comparison.above } : null,
    personalLine: comparison
      ? comparison.above
        ? `You average ${fmt(comparison.yoursCents)} — above the ${fmt(city.medianCents)} most students here pay.`
        : `You average ${fmt(comparison.yoursCents)} — at or under the ${fmt(city.medianCents)} most students here pay.`
      : null,
  };
}
