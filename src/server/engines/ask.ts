import type { SituationKey } from "@/domain/language";
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
 *
 * ---------------------------------------------------------------------------
 * ONE RULE ABOUT KEYWORDS, learned the hard way
 *
 * Leftover words are used to *rank* community posts and exchange listings.
 * They are never used as a hard filter on places or events. An earlier version
 * passed `keywords[0]` into a substring match over place names, so the shipped
 * suggestion "Where should I buy groceries?" filtered every supermarket out on
 * the word "buy" and returned nothing. A word the student typed is a hint, not
 * a constraint.
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
  | "find-deals"
  | "find-exchange"
  | "budget-question"
  | "afford-question"
  | "lifeops-question"
  | "pulse-question"
  | "mission-question"
  | "arrival-question"
  | "language-question";

export const intentMeta: Record<AskIntent, { label: string; detail: string }> = {
  "plan-night": { label: "Plan tonight", detail: "An evening assembled inside your number." },
  "plan-day": { label: "Plan a day", detail: "A day assembled inside your number." },
  "plan-weekend": { label: "Plan the weekend", detail: "Friday to Sunday, priced." },
  "find-food": { label: "Somewhere to eat", detail: "Cheap places students actually go." },
  "find-groceries": { label: "Where to shop", detail: "The cheap supermarket, not the close one." },
  "find-study": { label: "Somewhere to work", detail: "Quiet, cheap, has plugs." },
  "find-free": { label: "Free things", detail: "Everything that costs nothing." },
  "find-social": { label: "People", detail: "Open plans and students with shared interests." },
  "find-place": { label: "Places", detail: "Scored for your budget, interests and distance." },
  "find-deals": { label: "Student deals", detail: "Discounts with a confidence reading from student reports." },
  "find-exchange": { label: "Student Exchange", detail: "Buy, borrow, help and shared rides." },
  "budget-question": { label: "Money", detail: "What is safe, what is committed, what is drifting." },
  "afford-question": { label: "Can I afford this?", detail: "A verdict, and what it leaves." },
  "lifeops-question": { label: "What am I forgetting?", detail: "Your timeline: deadlines, payments, plans." },
  "pulse-question": { label: "What students say", detail: "Posts and the top answer on each." },
  "mission-question": { label: "Missions", detail: "A short plan with steps and a budget." },
  "arrival-question": { label: "Official information", detail: "From verified sources, never generated." },
  "language-question": { label: "What to say", detail: "Phrases from the local pack. Never translated on the fly." },
};

export type ParsedAsk = {
  intent: AskIntent;
  /** Explicit ceiling from the query, in cents. Null when unstated. */
  budgetCents: Cents | null;
  when: "now" | "tonight" | "tomorrow" | "weekend" | "week" | "any";
  /** True when the question is explicitly about free things. */
  freeOnly: boolean;
  /** True when the student asked for something cheaper than a previous answer. */
  cheaper: boolean;
  /** True when the student asked for something more social. */
  social: boolean;
  /** True when the student asked for something closer. */
  nearby: boolean;
  /** Words left after the structured bits. Used for ranking, never filtering. */
  keywords: string[];
  /**
   * Which phrase situation the question is about. Only set for
   * `language-question`, and it falls back to the first words rather than to
   * nothing: somebody who asks how to say something and gives no context is
   * usually at the start.
   */
  situation: SituationKey | null;
};

/**
 * The moment a "how do I say" question is about.
 *
 * Keyword matching, in the order that resolves the overlaps: "the bill" is
 * eating out even though it is also money, and "chemist" is an emergency even
 * though it is also a shop. Anything unmatched is `first-words`, which is the
 * right answer for "teach me some Spanish".
 */
function situationFrom(text: string): SituationKey {
  if (/\bpharmac|\bchemist\b|\bdoctor\b|\bhospital\b|\bill\b|\bsick\b|\bhurt|\bemergenc|\bpain\b/.test(text)) return "emergency";
  if (/\border|\brestaurant\b|\bmenu\b|\bbill\b|\bwaiter\b|\btable\b|\bcafe\b|\bbar\b|\bcoffee\b|\bbeer\b|\ballerg/.test(text)) return "eating-out";
  if (/\bsupermarket|\bgrocer|\bshop\b|\bshopping\b|\bmarket\b|\btill\b|\bcheckout\b/.test(text)) return "groceries";
  if (/\brent\b|\blandlord\b|\bdeposit\b|\bflat\b|\bapartment\b|\bcontract\b|\bbills\b|\bboiler\b|\bheating\b/.test(text)) return "housing";
  if (/\bjob\b|\bwork\b|\bhiring\b|\bshift\b|\bwage\b|\binterview\b|\bcv\b/.test(text)) return "work";
  if (/\bticket\b|\btrain\b|\bbus\b|\bmetro\b|\bplatform\b|\bstation\b|\btram\b|\btravel card\b/.test(text)) return "getting-around";
  if (/\buniversit|\bclass\b|\blecture\b|\bexam\b|\benrol|\blibrary\b|\bdeadline\b/.test(text)) return "university";
  if (/\bmeet\b|\bintroduc|\bname\b|\bfriend|\bparty\b|\binvite\b/.test(text)) return "meeting-people";
  if (/\bpay\b|\bcard\b|\bcash\b|\bdiscount\b|\bprice\b|\bcost\b|\bhow much\b|\breceipt\b/.test(text)) return "money";
  return "first-words";
}

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
  "that", "tonight", "today", "tomorrow", "weekend", "cheap", "free", "but",
  "buy", "somewhere", "something", "anyone", "there", "here", "about", "help",
  "which", "who", "how", "when", "am", "are", "have", "has", "was", "would",
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

  const freeOnly = /\bfree\b|\bno money\b|\bskint\b|\bbroke\b|\bnothing\b|\bzero\b|€0|\b0\s?(?:euro|eur)\b/.test(text);
  const cheaper = /\bcheaper\b|\bless\b.*\bmoney\b|\bcheapest\b/.test(text);
  const social = /\bmeet\b|\bpeople\b|\bfriends\b|\bsocial\b|\bjoin\b|\balone\b|\bwith others\b|\bgroup\b/.test(text);
  const nearby = /\bnear\b|\bclose\b|\bwalk\b|\bnearby\b|\baround here\b/.test(text);

  const intent: AskIntent = (() => {
    /* Official first: getting a visa answer from the wrong branch is the one
       failure this product must never have.

       `regist` rather than `registr`: "register" has no "registr" in it
       (r-e-g-i-s-t-e-r), so the tighter stem silently sent "how do I register
       my address" — the single most-asked question a new arrival has — down
       the generic places branch. The stems here are deliberately short. */
    if (
      /\bvisa\b|\bresiden|\bimmigration\b|\bregist|\bempadron|\banmeldung\b|\bpermit\b|\bpaperwork\b|\btax\b|\bhealthcare\b|\bhealth cover|\binsurance\b|\bemergency number\b|\bnie\b|\btie\b|\bbiometric|\bwork rules\b|\blegally\b/.test(
        text,
      )
    ) {
      return "arrival-question";
    }
    /* Language next, before food and money. "How do I say the bill please"
       contains "bill" and would otherwise be read as a money question; "what
       do I say when ordering" contains "ordering" and would be read as food.
       The phrasing is distinctive enough to test for ahead of both. */
    if (
      /\bhow do (?:i|you) say\b|\bhow to say\b|\bwhat do i say\b|\bwhat should i say\b|\bword for\b|\bphrase|\bteach me\b|\bpronounc|\bin (?:spanish|french|german|italian|portuguese|dutch|polish|czech|hungarian|finnish|swedish|estonian)\b/.test(
        text,
      )
    ) {
      return "language-question";
    }
    if (/\bafford\b|\bcan i spend\b|\bis it ok to spend\b/.test(text)) return "afford-question";
    if (/\bforget|\bforgot|\bdue\b|\bdeadline\b|\bmy week\b|\bmy day\b|\bwhat.s on my\b|\bschedule\b|\btimeline\b|\bremind/.test(text)) {
      return "lifeops-question";
    }
    if (/\bmission\b|\bchallenge\b|\bgive me a plan for\b/.test(text)) return "mission-question";
    if (/\bdiscount|\bdeal\b|\bdeals\b|\bstudent price|\bstudent card\b|\boffer\b/.test(text)) return "find-deals";
    if (/\bsell\b|\bselling\b|\bsecond hand\b|\bsecond-hand\b|\bborrow\b|\blend\b|\bgive away\b|\bmarketplace\b|\bexchange\b|\bshare a (?:taxi|ride|car)\b|\bsplit a (?:taxi|ride|fare)\b|\bairport (?:taxi|transfer|run)\b/.test(text)) {
      return "find-exchange";
    }
    if (/\bwhat are (?:students|people) (?:saying|talking)\b|\bstudents say\b|\bpulse\b|\banyone know\b/.test(text)) {
      return "pulse-question";
    }
    if (/\bplan\b.*\b(weekend|saturday|sunday)\b|\bweekend\b.*\bplan\b/.test(text)) return "plan-weekend";
    /* "what can I do", "what should I do" and "things to do" all mean: build me
       something. Matching only "plan" left the most natural phrasing of the
       question falling through to a bare list. */
    if (/\bplan\b|\bitinerary\b|\bwhat (?:should|can) i do\b|\bthings to do\b|\bwhat to do\b/.test(text)) {
      return when === "tonight" || when === "now" ? "plan-night" : "plan-day";
    }
    if (/\blast until\b|\bmake .* last\b|\bstretch\b|\bsurvive\b|\bbudget\b|\bhow much can i\b|\bmy money\b|\bspending\b/.test(text)) {
      return "budget-question";
    }
    if (/\bgrocer|\bsupermarket|\bfood shop|\bshop for food\b|\bweekly shop\b/.test(text)) return "find-groceries";
    if (/\bstudy\b|\blibrary\b|\bquiet\b|\bwork from\b|\brevise\b|\bexam\b/.test(text)) return "find-study";
    if (/\beat\b|\bfood\b|\blunch\b|\bdinner\b|\brestaurant\b|\bpizza\b|\bbreakfast\b|\bcoffee\b|\bhungry\b/.test(text)) {
      return "find-food";
    }
    if (social) return "find-social";
    if (freeOnly) return "find-free";
    if (/\bwhat.s on\b|\bevent\b|\bhappening\b|\bgig\b|\bconcert\b|\bnight out\b|\bclub\b/.test(text)) return "plan-night";
    return "find-place";
  })();

  const keywords = text
    .replace(/[€$£]\s?\d+(?:[.,]\d{1,2})?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  return {
    intent,
    budgetCents,
    when,
    freeOnly,
    cheaper,
    social,
    nearby,
    keywords,
    situation: intent === "language-question" ? situationFrom(text) : null,
  };
}

/** A one-line, human restatement of what was understood, so it can be corrected. */
export function describeParse(parsed: ParsedAsk, formatMoney: (cents: Cents) => string): string {
  const parts: string[] = [intentMeta[parsed.intent].label];
  if (parsed.budgetCents !== null) parts.push(`under ${formatMoney(parsed.budgetCents)}`);
  if (parsed.freeOnly) parts.push("free only");
  if (parsed.when !== "any") parts.push(parsed.when === "now" ? "right now" : parsed.when);
  if (parsed.nearby) parts.push("close by");
  if (parsed.social) parts.push("with people");
  return parts.join(" · ");
}

/* -------------------------------------------------------------------------- */
/* Answer shapes                                                               */
/* -------------------------------------------------------------------------- */

/**
 * One stop on a plan.
 *
 * MONEY IS NULLABLE, and that is the whole design. An event published a price
 * and a transport fare comes from the city's own transport authority, so those
 * are known. A restaurant did not: no place provider publishes an amount, only
 * a band. The old version turned that gap into a number by reading a
 * hand-written `price` off an invented place, which is how a plan came to say
 * "€23 total" about an evening nobody had priced.
 *
 * So a line either KNOWS what it costs, or it carries an ESTIMATE that names
 * its basis, or it says neither. The three states are separate fields rather
 * than one nullable number, because a caller must not be able to add an
 * estimate into a total by forgetting to check.
 */
export type AskLine = {
  kind: "food" | "event" | "drink" | "transport" | "culture" | "activity";
  title: string;
  detail: string;
  /** What it costs, when a source published it. Null means nobody said. */
  priceCents: Cents | null;
  /**
   * A range from the city's own price anchors, for a line whose source has no
   * price. Never summed into `totalCents`; reported beside it.
   */
  estimateCents: [Cents, Cents] | null;
  /** What the estimate is based on. Never set without an estimate. */
  estimateBasis: "city-anchor" | null;
  /** How far, in metres. Distances, not fabricated walking times. */
  metres: number | null;
  /** What the line was built from, so the UI can link back to the real row. */
  refKind: "place" | "event" | null;
  refId: string | null;
  source: "students" | "official" | "venue" | "provider";
};

/**
 * What a plan costs: what is known, and what is only estimated, kept apart.
 *
 * `totalCents` is the sum of prices somebody published. `estimateLowCents` and
 * `estimateHighCents` are the sum of the anchor ranges for the lines nobody
 * priced, and `unpricedLines` counts the lines that had neither. A caller that
 * wants one number must decide for itself which of the three to show; there is
 * deliberately no field that quietly merges them.
 */
export type PlanCost = {
  totalCents: Cents;
  estimateLowCents: Cents;
  estimateHighCents: Cents;
  unpricedLines: number;
};

export type AskAnswer = {
  kind: "plan" | "list" | "official" | "figures" | "empty";
  /** Headline. Always states the money when there is money involved. */
  title: string;
  /** One paragraph. Model-written where available, deterministic otherwise. */
  summary: string;
  lines: AskLine[];
  /** Known money and estimated money, kept apart. See `PlanCost`. */
  cost: PlanCost;
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
  /**
   * The city's own price anchors, in whole currency units, used ONLY to
   * estimate a line the provider could not price. Null for a city with no
   * anchors, and then a food line simply carries no figure at all.
   */
  anchors: { lunch: [number, number]; pint: [number, number] } | null;
  wantsFood: boolean;
  /** Prefer the cheapest fill at every step. */
  cheaper?: boolean;
}): { lines: AskLine[]; cost: PlanCost } {
  const budget = input.budgetCents ?? Number.POSITIVE_INFINITY;
  const lines: AskLine[] = [];
  let total = 0;

  const fits = (cents: number) => total + cents <= budget;

  /* An anchor range in cents, or null when the city has none. */
  const anchor = (key: "lunch" | "pint"): [Cents, Cents] | null => {
    const range = input.anchors?.[key];
    if (!range) return null;
    return [Math.round(range[0] * 100), Math.round(range[1] * 100)];
  };

  /* Whether an estimated line can plausibly fit what is left. The LOW end is
     used, because rejecting a €8-13 lunch from a €10 budget would be deciding
     against the student on a figure we admit we do not know. */
  const mightFit = (estimate: [Cents, Cents] | null) =>
    estimate === null || total + estimate[0] <= budget;

  /* 1. An event. Free ones first, then the cheapest that still fits. */
  const events = [...input.events].sort(
    (a, b) => a.item.priceCents - b.item.priceCents || b.match - a.match,
  );
  const event = events.find((entry) => fits(entry.item.priceCents));

  if (event) {
    lines.push({
      kind: event.item.kind === "culture" ? "culture" : "event",
      title: event.item.title,
      detail: event.item.blurb,
      priceCents: event.item.priceCents,
      estimateCents: null,
      estimateBasis: null,
      metres: null,
      refKind: "event",
      refId: event.item.id,
      source: event.item.source,
    });
    total += event.item.priceCents;
  }

  /* 2. Food, if the question implies it.
        Ordered by price BAND then by match, because there is no amount to sort
        on. A band of 1 is the cheap end; a null band sorts after both, since
        an unknown is not a claim to be cheap. */
  if (input.wantsFood) {
    const lunch = anchor("lunch");
    const food = input.places
      .filter((entry) => entry.item.layers.some((layer) => layer === "cheap-food"))
      .sort(
        (a, b) =>
          (a.item.priceLevel ?? 3) - (b.item.priceLevel ?? 3) || b.match - a.match,
      )
      .find(() => mightFit(lunch));

    if (food) {
      lines.push({
        kind: "food",
        title: food.item.name,
        detail: food.item.value.reasons.join(" · ") || food.item.category,
        priceCents: null,
        estimateCents: lunch,
        estimateBasis: lunch ? "city-anchor" : null,
        metres: food.item.proximity.metres,
        refKind: "place",
        refId: food.item.id,
        source: "provider",
      });
    }
  }

  /* 3. One more thing, only if there is genuine room. Anything under a fifth
        of the budget left is change, not an activity. Skipped when the student
        explicitly asked for cheaper. */
  const headroom = budget - total;
  if (!input.cheaper && Number.isFinite(headroom) && headroom > budget * 0.2) {
    const extra = input.places.find(
      (entry) => !lines.some((line) => line.refId === entry.item.id),
    );

    if (extra) {
      const nightlife = extra.item.layers.includes("nightlife");
      const estimate = nightlife ? anchor("pint") : null;
      if (mightFit(estimate)) {
        lines.push({
          kind: nightlife ? "drink" : "activity",
          title: extra.item.name,
          detail: extra.item.value.reasons.join(" · ") || extra.item.category,
          priceCents: null,
          estimateCents: estimate,
          estimateBasis: estimate ? "city-anchor" : null,
          metres: extra.item.proximity.metres,
          refKind: "place",
          refId: extra.item.id,
          source: "provider",
        });
      }
    }
  }

  /* 4. Transport, only when the plan actually spans a distance worth paying
        for and the fare fits. A fare line on a plan you can walk is padding.
        The threshold is in metres now: two kilometres is about the point where
        a student stops walking it without thinking. */
  const furthest = Math.max(0, ...lines.map((line) => line.metres ?? 0));
  if (furthest > 2_000 && input.fareCents > 0 && fits(input.fareCents)) {
    lines.push({
      kind: "transport",
      title: "Transport",
      detail: "One journey each way. Covered already if you hold a monthly pass.",
      priceCents: input.fareCents,
      estimateCents: null,
      estimateBasis: null,
      metres: null,
      refKind: null,
      refId: null,
      source: "official",
    });
    total += input.fareCents;
  }

  return { lines, cost: costOf(lines) };
}

/** Add a plan up, keeping known money and estimated money apart. */
export function costOf(lines: readonly AskLine[]): PlanCost {
  let totalCents = 0;
  let estimateLowCents = 0;
  let estimateHighCents = 0;
  let unpricedLines = 0;

  for (const line of lines) {
    if (line.priceCents !== null) totalCents += line.priceCents;
    else if (line.estimateCents) {
      estimateLowCents += line.estimateCents[0];
      estimateHighCents += line.estimateCents[1];
    } else unpricedLines += 1;
  }

  return { totalCents, estimateLowCents, estimateHighCents, unpricedLines };
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
  cost: PlanCost;
  budgetCents: Cents | null;
  formatMoney: (cents: Cents) => string;
}): string {
  const { lines, cost, budgetCents, formatMoney } = input;

  if (lines.length === 0) return "Nothing in your city matches that yet.";

  const freeCount = lines.filter((line) => line.priceCents === 0).length;
  /* Derived from the lines, never from the total. A total that happens to be
     zero because nothing was costed is not a free plan, and announcing "all of
     this is free" over a list of unpriced rows is exactly the sort of confident
     wrongness that loses a student's trust in every other number on screen. */
  const allFree = lines.every((line) => line.priceCents === 0);
  const estimated = cost.estimateHighCents > 0;
  const parts: string[] = [];

  const stops = `${lines.length} ${lines.length === 1 ? "stop" : "stops"}`;

  if (allFree && !estimated && cost.unpricedLines === 0) {
    parts.push("All of this is free.");
  } else if (estimated) {
    /* The known money and the estimate are stated separately, in that order,
       and the estimate says it is one. Merging them into a single figure is
       the thing this whole shape exists to prevent. */
    const range =
      cost.estimateLowCents === cost.estimateHighCents
        ? formatMoney(cost.estimateLowCents)
        : `${formatMoney(cost.estimateLowCents)}–${formatMoney(cost.estimateHighCents)}`;
    parts.push(
      cost.totalCents > 0
        ? `${stops}: ${formatMoney(cost.totalCents)} booked, plus about ${range} for food and drink.`
        : `${stops}, and about ${range} for food and drink.`,
    );
    parts.push("The estimate is this city's typical student prices, not a menu.");
  } else {
    parts.push(`${stops}, ${formatMoney(cost.totalCents)} in total.`);
  }

  if (freeCount > 0 && !allFree) {
    parts.push(`${freeCount} of them ${freeCount === 1 ? "costs" : "cost"} nothing.`);
  }

  if (cost.unpricedLines > 0) {
    parts.push(
      `${cost.unpricedLines} ${cost.unpricedLines === 1 ? "stop has" : "stops have"} no published price.`,
    );
  }

  if (budgetCents !== null && cost.totalCents < budgetCents && !allFree && !estimated) {
    parts.push(`${formatMoney(budgetCents - cost.totalCents)} left over.`);
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

  const priced = lines
    .map((line) => line.priceCents)
    .filter((cents): cents is Cents => cents !== null && cents > 0);
  const freeCount = lines.filter((line) => line.priceCents === 0).length;
  const unpriced = lines.filter((line) => line.priceCents === null).length;

  /* "Every one is free" may only be said when every one was actually priced at
     zero. A list where nobody published a price is not a free list. */
  if (priced.length === 0 && unpriced === 0) {
    return `${lines.length} of these, and every one is free.`;
  }
  if (priced.length === 0) {
    return `${lines.length} of these. ${unpriced === lines.length ? "None" : "Some"} of them publish a price.`;
  }

  const low = Math.min(...priced);
  const high = Math.max(...priced);
  const range = low === high ? formatMoney(low) : `${formatMoney(low)}–${formatMoney(high)}`;

  return freeCount > 0
    ? `${lines.length} options: ${freeCount} free, the rest ${range}.`
    : `${lines.length} options, ${range}.`;
}

/* -------------------------------------------------------------------------- */
/* Follow-ups                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What to offer next.
 *
 * These are *new questions*, not the original with words glued on the end. An
 * earlier version appended " but cheaper" to the student's sentence and
 * re-asked it, which kept the original budget, changed nothing, and added a
 * stray keyword. A follow-up has to be a question the parser reads correctly
 * on its own.
 */
export function followUps(input: {
  parsed: ParsedAsk;
  hasLines: boolean;
  currencySymbol: string;
  safeTodayCents: Cents | null;
  cityName: string;
  social: boolean;
}): { label: string; query: string }[] {
  const { parsed } = input;
  const out: { label: string; query: string }[] = [];
  const budget = parsed.budgetCents ?? input.safeTodayCents;
  const roundDown = (cents: Cents) => Math.max(5, Math.floor(cents / 100 / 5) * 5);

  if (input.hasLines && !parsed.freeOnly) {
    out.push({ label: "Free only", query: `What is free ${parsed.when === "any" ? "this week" : parsed.when}?` });
  }
  if (input.hasLines && budget !== null && budget > 1000 && !parsed.cheaper) {
    out.push({ label: "Cheaper", query: `What can I do ${parsed.when === "any" ? "" : parsed.when} for ${input.currencySymbol}${roundDown(budget / 2)}?`.replace("  ", " ") });
  }
  if (input.hasLines && !parsed.nearby) {
    out.push({ label: "Closer", query: `Somewhere near me to ${parsed.intent === "find-food" ? "eat" : parsed.intent === "find-study" ? "study" : "go"}` });
  }
  if (input.social && !parsed.social) {
    out.push({ label: "With people", query: "Find people doing something this week" });
  }

  /* Intent-specific next questions, which is where most of the value is. */
  switch (parsed.intent) {
    case "find-food":
      out.push({ label: "Where to shop", query: "Where should I buy groceries?" });
      break;
    case "find-groceries":
      out.push({ label: "Cheap lunch", query: "Somewhere cheap to eat near campus" });
      break;
    case "afford-question":
      out.push({ label: "What is free", query: "What is free this week?" });
      break;
    case "budget-question":
      out.push({ label: "Can I afford this?", query: `Can I afford ${input.currencySymbol}30 tonight?` });
      break;
    case "lifeops-question":
      out.push({ label: "Plan my week", query: "Plan my week" });
      break;
    case "find-social":
      out.push({ label: "What is on", query: "What is on this week?" });
      break;
    case "find-exchange":
      out.push({ label: "Free stuff", query: "What are students giving away?" });
      break;
    default:
      out.push({ label: "What am I forgetting?", query: "What am I forgetting this week?" });
  }

  const seen = new Set<string>();
  return out.filter((entry) => (seen.has(entry.label) ? false : (seen.add(entry.label), true))).slice(0, 4);
}
