import type { Place } from "@/data/types";
import type { PriceObservation } from "@/domain/knowledge";
import { summarisePrices } from "@/domain/knowledge";
import type { Cents, Transaction } from "@/domain/types";
import { categoryLabel, isDiscretionary } from "@/server/engines/budget";

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
  priceCents: Cents;
  walkMinutes: number;
  why: string;
  verifiedBy: number;
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
  const { now, transactions, places, maxWalkMinutes, formatMoney } = input;

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

    const alternatives = cheaperPlaces({
      category,
      averageCents,
      places,
      maxWalkMinutes,
    });

    if (alternatives.length === 0) continue;

    const alternativeAverageCents = Math.round(
      alternatives.reduce((sum, place) => sum + place.priceCents, 0) / alternatives.length,
    );

    /* Weekly rate from the observed window, not from an assumed frequency. */
    const perWeek = rows.length / (RULES.windowDays / 7);
    const weeklyDifferenceCents = Math.round((averageCents - alternativeAverageCents) * perWeek);

    if (weeklyDifferenceCents < RULES.minWeeklySavingCents) continue;

    const confidence = confidenceFor(rows.length, alternatives.length);
    if (confidence === "insufficient") continue;

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
      ...phrase({
        category,
        averageCents,
        alternativeAverageCents,
        weeklyDifferenceCents,
        transactionCount: rows.length,
        confidence,
        formatMoney,
      }),
    });
  }

  return opportunities.sort((a, b) => b.weeklyDifferenceCents - a.weeklyDifferenceCents);
}

/* -------------------------------------------------------------------------- */
/* Alternatives                                                                */
/* -------------------------------------------------------------------------- */

/** Which place layers stand in for which budget category. */
const CATEGORY_LAYERS: Record<string, readonly string[]> = {
  "eating-out": ["cheap-food"],
  groceries: ["groceries"],
  nightlife: ["nightlife"],
  fitness: ["fitness"],
  entertainment: ["free", "events"],
  shopping: ["deals"],
};

function cheaperPlaces(input: {
  category: string;
  averageCents: Cents;
  places: readonly Place[];
  maxWalkMinutes: number;
}): Alternative[] {
  const layers = CATEGORY_LAYERS[input.category];
  if (!layers) return [];

  const ceiling = Math.round(input.averageCents * (1 - RULES.minGapFraction));

  return input.places
    .filter((place) => place.layers.some((layer) => layers.includes(layer)))
    .filter((place) => place.price !== null && Math.round(place.price * 100) <= ceiling)
    .filter((place) => place.walkMinutes <= input.maxWalkMinutes)
    /* Confirmed places first: recommending a swap nobody has verified is how a
       "saving" turns into a wasted trip. */
    .sort((a, b) => b.verifiedBy - a.verifiedBy || a.walkMinutes - b.walkMinutes)
    .slice(0, 3)
    .map((place) => ({
      placeId: place.id,
      name: place.name,
      priceCents: Math.round((place.price ?? 0) * 100),
      walkMinutes: place.walkMinutes,
      why: place.why,
      verifiedBy: place.verifiedBy,
    }));
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
  formatMoney: (cents: Cents) => string;
}): { headline: string; detail: string } {
  const { formatMoney: fmt } = input;
  const label = categoryLabel(input.category).toLowerCase();

  if (input.confidence === "measured") {
    return {
      headline: `You average ${fmt(input.averageCents)} on ${label}.`,
      detail: `These three are around ${fmt(
        input.alternativeAverageCents,
      )}. Switching where it suits you is about ${fmt(
        input.weeklyDifferenceCents,
      )} a week — from ${input.transactionCount} of your own transactions, not an estimate.`,
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
    } transactions so far, so treat that as a direction rather than a figure.`,
  };
}

/* -------------------------------------------------------------------------- */
/* City price context                                                          */
/* -------------------------------------------------------------------------- */

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
