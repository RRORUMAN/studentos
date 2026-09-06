import type { Place } from "@/data/types";
import type { Cents, CityEvent } from "@/domain/types";
import type { Scored } from "@/server/engines/recommend";

/**
 * ============================================================================
 * ASK — query understanding and plan assembly
 * ----------------------------------------------------------------------------
 * Turns a sentence a student typed into a structured request, then assembles
 * an answer from retrieved rows.
 *
 * Every line of this file is Tier 0: no model is called to understand the
 * question or to choose the answer. That is not a cost compromise, it is the
 * correct architecture — a model asked "what is free tonight" would either
 * invent an event or need the same retrieval anyway, and parsing "€20" out of
 * a sentence with a regex is both faster and more reliable than asking a
 * language model to do arithmetic.
 *
 * The model's only job, later and optionally, is writing one sentence of
 * explanation over the plan this file already produced. If the model is
 * unavailable, the answer is unchanged — it just reads slightly plainer.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

export type AskIntent =
  | "plan-night"
  | "plan-day"
  | "plan-weekend"
  | "find-food"
  | "find-groceries"
  | "find-study"
  | "find-free"
  | "find-social"
  | "find-place"
  | "budget-question"
  | "arrival-question"
  | "unknown";

export type ParsedAsk = {
  intent: AskIntent;
  /** Explicit ceiling from the query, in cents. Null when unstated. */
  budgetCents: Cents | null;
  when: "now" | "tonight" | "tomorrow" | "weekend" | "week" | "any";
  /** True when the question is explicitly about free things. */
  freeOnly: boolean;
  /** Words left after the structured bits, used for text matching. */
  keywords: string[];
};

/**
 * Money out of a sentence.
 *
 * Handles "€20", "20 euros", "20e", "$15", "£8.50" and a bare "40" when the
 * sentence is clearly about a budget. Deliberately does NOT treat every bare
 * number as money — "2 people" and "3 days" are common and misreading them as
 * a budget produces a confidently wrong answer.
 */
export function parseBudgetCents(query: string): Cents | null {
  const text = query.toLowerCase();

  const symbol = text.match(/[€$£]\s?(\d+(?:[.,]\d{1,2})?)/);
  if (symbol) return Math.round(Number(symbol[1].replace(",", ".")) * 100);

  const named = text.match(/(\d+(?:[.,]\d{1,2})?)\s?(?:euros?|eur|e\b|dollars?|usd|pounds?|gbp)/);
  if (named) return Math.round(Number(named[1].replace(",", ".")) * 100);

  /* A bare number only counts when the sentence is about money. "last" and
     "stretch" are in the list because "make 40 last until Friday" is the
     Survival Mode phrasing, and it is very often typed without a symbol. */
  if (/\b(budget|spend|afford|have|left|cost|under|below|max|last|stretch)\b/.test(text)) {
    const bare = text.match(/\b(\d{1,4}(?:[.,]\d{1,2})?)\b/);
    if (bare) {
      const value = Number(bare[1].replace(",", "."));
      /* Above 500 in a sentence like this is far more likely a monthly rent or
         a year than tonight's budget, so leave it unparsed rather than guess. */
      if (value > 0 && value <= 500) return Math.round(value * 100);
    }
  }

  return null;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "for", "to", "in", "on", "at", "me", "my", "i", "is", "it",
  "what", "where", "can", "do", "should", "with", "and", "or", "of", "some",
  "find", "get", "go", "want", "need", "good", "best", "under", "near", "this",
  "that", "tonight", "today", "tomorrow", "weekend", "cheap", "free",
]);

export function parseAsk(query: string): ParsedAsk {
  const text = query.toLowerCase().trim();

  const budgetCents = parseBudgetCents(query);

  const when: ParsedAsk["when"] = /\btonight\b|\bthis evening\b/.test(text)
    ? "tonight"
    : /\btomorrow\b/.test(text)
      ? "tomorrow"
      : /\bweekend\b|\bsaturday\b|\bsunday\b|\bfriday night\b/.test(text)
        ? "weekend"
        : /\bthis week\b|\bweek\b/.test(text)
          ? "week"
          : /\bnow\b|\bright now\b/.test(text)
            ? "now"
            : "any";

  const freeOnly = /\bfree\b|\bno money\b|\b0\b|\bnothing\b|\bskint\b|\bbroke\b/.test(text);

  const intent: AskIntent = (() => {
    if (/\bplan\b.*\b(weekend|saturday|sunday)\b|\bweekend\b.*\bplan\b/.test(text))
      return "plan-weekend";
    /* "what can I do", "what should I do" and "things to do" all mean: build me
       something. Matching only "plan" left the most natural phrasing of the
       question falling through to a bare list. */
    if (
      /\bplan\b|\bitinerary\b|\bwhat (should|can) i do\b|\bthings to do\b|\bwhat to do\b/.test(text)
    ) {
      return when === "tonight" ? "plan-night" : "plan-day";
    }
    if (/\blast until\b|\bmake .* last\b|\bstretch\b|\bsurvive\b/.test(text)) return "budget-question";
    if (/\bafford\b|\bbudget\b|\bhow much\b|\bspend\b/.test(text)) return "budget-question";
    if (/\bgrocer|\bsupermarket|\bfood shop|\bshop for food\b/.test(text)) return "find-groceries";
    if (/\bstudy\b|\blibrary\b|\bquiet\b|\bwork from\b/.test(text)) return "find-study";
    if (/\beat\b|\bfood\b|\blunch\b|\bdinner\b|\brestaurant\b|\bpizza\b|\bbreakfast\b/.test(text))
      return "find-food";
    if (/\bmeet\b|\bpeople\b|\bfriends\b|\bsocial\b|\bjoin\b/.test(text)) return "find-social";
    if (/\barriv|\bregister|\bvisa\b|\bresidency\b|\bpaperwork\b|\bsort out\b/.test(text))
      return "arrival-question";
    if (freeOnly) return "find-free";
    if (/\bwhat.s on\b|\bevent\b|\bhappening\b|\bgig\b|\bconcert\b/.test(text)) return "plan-night";
    return "find-place";
  })();

  const keywords = text
    .replace(/[€$£]\s?\d+(?:[.,]\d{1,2})?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  return { intent, budgetCents, when, freeOnly, keywords };
}

/* -------------------------------------------------------------------------- */
/* Answer shapes                                                               */
/* -------------------------------------------------------------------------- */

export type AskLine = {
  kind: "food" | "event" | "drink" | "transport" | "culture" | "activity";
  title: string;
  detail: string;
  priceCents: Cents;
  walkMinutes: number | null;
  /** What the line was built from, so the UI can link back to the real row. */
  refKind: "place" | "event" | null;
  refId: string | null;
  source: "students" | "official" | "venue";
};

export type AskAnswer = {
  kind: "plan" | "list" | "official" | "empty";
  /** Headline. Always states the money when there is money involved. */
  title: string;
  /** One paragraph. Model-written where available, deterministic otherwise. */
  summary: string;
  lines: AskLine[];
  totalCents: Cents;
  /** What the student asked for, parsed. Shown so they can correct it. */
  parsed: ParsedAsk;
  /** Where the answer's facts came from. Never empty for a non-empty answer. */
  sources: { label: string; url: string | null }[];
  /** Set when nothing matched, so the caller can record an unmet need. */
  missReason: string | null;
};

/* -------------------------------------------------------------------------- */
/* Plan assembly                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Build an evening or a day inside a budget.
 *
 * Greedy, in a deliberate order: the free event first (it anchors the night and
 * costs nothing), then food, then one paid thing if there is room. A knapsack
 * optimiser would fill the budget more exactly and produce worse plans —
 * spending €19.60 of €20 is not a better night than spending €12 and walking
 * home with change.
 *
 * Nothing is added that pushes the total over budget. A plan that exceeds the
 * number the student gave is a failed answer, not a suggestion.
 */
export function assemblePlan(input: {
  budgetCents: Cents | null;
  events: readonly Scored<CityEvent>[];
  places: readonly Scored<Place>[];
  /** Single-journey fare, so transport can be costed honestly or omitted. */
  fareCents: number;
  wantsFood: boolean;
}): { lines: AskLine[]; totalCents: Cents } {
  const budget = input.budgetCents ?? Number.POSITIVE_INFINITY;
  const lines: AskLine[] = [];
  let total = 0;

  const fits = (cents: number) => total + cents <= budget;

  /* 1. An event. Free ones first, then the cheapest that still fits. */
  const events = [...input.events].sort(
    (a, b) => a.item.priceCents - b.item.priceCents || b.match - a.match,
  );
  const event = events.find((entry) => fits(entry.item.priceCents));

  if (event) {
    lines.push({
      kind: event.item.priceCents === 0 ? "culture" : "event",
      title: event.item.title,
      detail: `${event.item.venue} · ${new Date(event.item.startsAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      priceCents: event.item.priceCents,
      walkMinutes: null,
      refKind: "event",
      refId: event.item.id,
      source: event.item.source,
    });
    total += event.item.priceCents;
  }

  /* 2. Food, if the question implies it. */
  if (input.wantsFood) {
    const food = input.places
      .filter((entry) => entry.item.layers.some((layer) => layer === "cheap-food"))
      .sort((a, b) => (a.item.price ?? 0) - (b.item.price ?? 0) || b.match - a.match)
      .find((entry) => fits(Math.round((entry.item.price ?? 0) * 100)));

    if (food) {
      const cents = Math.round((food.item.price ?? 0) * 100);
      lines.push({
        kind: "food",
        title: food.item.name,
        detail: food.item.why,
        priceCents: cents,
        walkMinutes: food.item.walkMinutes,
        refKind: "place",
        refId: food.item.id,
        source: food.item.source === "mixed" ? "students" : food.item.source,
      });
      total += cents;
    }
  }

  /* 3. One more thing, only if there is genuine room. Anything under a fifth
        of the budget left is change, not an activity. */
  const headroom = budget - total;
  if (Number.isFinite(headroom) && headroom > budget * 0.2) {
    const extra = input.places
      .filter((entry) => !lines.some((line) => line.refId === entry.item.id))
      .find((entry) => fits(Math.round((entry.item.price ?? 0) * 100)));

    if (extra) {
      const cents = Math.round((extra.item.price ?? 0) * 100);
      lines.push({
        kind: extra.item.layers.includes("nightlife") ? "drink" : "activity",
        title: extra.item.name,
        detail: extra.item.why,
        priceCents: cents,
        walkMinutes: extra.item.walkMinutes,
        refKind: "place",
        refId: extra.item.id,
        source: extra.item.source === "mixed" ? "students" : extra.item.source,
      });
      total += cents;
    }
  }

  /* 4. Transport, only when the plan actually spans a distance worth paying
        for and the fare fits. A €1.50 line on a plan you can walk is padding. */
  const furthest = Math.max(0, ...lines.map((line) => line.walkMinutes ?? 0));
  if (furthest > 25 && input.fareCents > 0 && fits(input.fareCents)) {
    lines.push({
      kind: "transport",
      title: "Transport",
      detail: "One journey each way is already covered by a monthly pass.",
      priceCents: input.fareCents,
      walkMinutes: null,
      refKind: null,
      refId: null,
      source: "official",
    });
    total += input.fareCents;
  }

  return { lines, totalCents: total };
}

/* -------------------------------------------------------------------------- */
/* Deterministic summary                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The fallback summary, written without a model.
 *
 * Used whenever no AI provider is configured, and whenever one is configured
 * but fails. It is deliberately good enough to ship on its own: the product
 * has to be fully usable with the AI switched off, or the AI is load-bearing
 * in a way the cost model cannot support.
 */
export function describePlan(input: {
  lines: readonly AskLine[];
  totalCents: Cents;
  budgetCents: Cents | null;
  formatMoney: (cents: Cents) => string;
}): string {
  const { lines, totalCents, budgetCents, formatMoney } = input;

  if (lines.length === 0) return "Nothing in your city matches that yet.";

  const freeCount = lines.filter((line) => line.priceCents === 0).length;
  /* Derived from the lines, never from the total. A total that happens to be
     zero because nothing was costed is not a free plan, and announcing "all of
     this is free" over a list of priced rows is exactly the sort of confident
     wrongness that loses a student's trust in every other number on screen. */
  const allFree = lines.every((line) => line.priceCents === 0);
  const parts: string[] = [];

  parts.push(
    allFree
      ? "All of this is free."
      : `${lines.length} ${lines.length === 1 ? "stop" : "stops"}, ${formatMoney(totalCents)} in total.`,
  );

  if (freeCount > 0 && !allFree) {
    parts.push(`${freeCount} of them ${freeCount === 1 ? "costs" : "cost"} nothing.`);
  }

  if (budgetCents !== null && totalCents < budgetCents && !allFree) {
    parts.push(`${formatMoney(budgetCents - totalCents)} left over.`);
  }

  return parts.join(" ");
}

/**
 * The summary for a *list* answer, where there is no itinerary and so no total.
 *
 * Reports the price range instead, which is what someone scanning options
 * actually wants, and cannot accidentally claim a zero total means free.
 */
export function describeList(input: {
  lines: readonly AskLine[];
  formatMoney: (cents: Cents) => string;
  cityName: string;
}): string {
  const { lines, formatMoney, cityName } = input;
  if (lines.length === 0) return `Nothing in ${cityName} matches that yet.`;

  const priced = lines.filter((line) => line.priceCents > 0).map((line) => line.priceCents);
  const freeCount = lines.length - priced.length;

  if (priced.length === 0) return `${lines.length} of these, and every one is free.`;

  const low = Math.min(...priced);
  const high = Math.max(...priced);
  const range = low === high ? formatMoney(low) : `${formatMoney(low)}–${formatMoney(high)}`;

  return freeCount > 0
    ? `${lines.length} options: ${freeCount} free, the rest ${range}.`
    : `${lines.length} options, ${range}.`;
}
