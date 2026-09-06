import type { Cents, Id, Iso } from "@/domain/types";

/**
 * ============================================================================
 * KNOWLEDGE
 * ----------------------------------------------------------------------------
 * Everything the product asserts about the world, and the provenance that
 * makes each assertion publishable.
 *
 * The rule that shapes this whole module: a claim without a source is not a
 * claim, it is a guess wearing a UI. So `sourceUrl` and `checkedAt` are
 * required on official rows rather than optional, `confidence` is computed
 * rather than asserted, and the AI gateway refuses to author anything in the
 * `official` domain — it may only explain rows that already exist here.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Official information                                                        */
/* -------------------------------------------------------------------------- */

export type OfficialTopic =
  | "immigration"
  | "residency"
  | "visa"
  | "registration"
  | "healthcare"
  | "tax"
  | "legal"
  | "university"
  | "transport"
  | "emergency";

export const officialTopicLabel: Record<OfficialTopic, string> = {
  immigration: "Immigration",
  residency: "Residency",
  visa: "Visas",
  registration: "Registration",
  healthcare: "Healthcare",
  tax: "Tax",
  legal: "Legal",
  university: "University",
  transport: "Transport",
  emergency: "Emergency",
};

/**
 * A single verified statement about a requirement or an official process.
 *
 * `authority` is the field that does the most work in the UI. "official" gets
 * a government-source badge and a link; "community" gets "students report" and
 * is never presented as a requirement. Collapsing those two is how a product
 * ends up telling an international student the wrong thing about a visa.
 */
export type OfficialFact = {
  id: Id;
  /** Null means country-wide rather than tied to one city. */
  citySlug: string | null;
  countryCode: string;
  topic: OfficialTopic;
  title: string;
  summary: string;
  /** Required. A row without a source cannot be created — see the CHECK. */
  sourceName: string;
  sourceUrl: string;
  /** When a human last confirmed this against the source. */
  checkedAt: Iso;
  authority: "official" | "university" | "community";
  /**
   * Set when the rule depends on the student's nationality. The UI then refuses
   * to state a single answer and links the source instead, which is the only
   * honest thing a product can do with, say, EU vs non-EU registration.
   */
  variesByNationality: boolean;
};

/** How stale a checked fact is allowed to get before the UI says so. */
export const FACT_FRESH_DAYS = 120;

export function factFreshness(fact: Pick<OfficialFact, "checkedAt">, now = new Date()) {
  const days = Math.floor((now.getTime() - Date.parse(fact.checkedAt)) / 86_400_000);
  return {
    days,
    stale: days > FACT_FRESH_DAYS,
    label: days <= 1 ? "Checked today" : days < 30 ? `Checked ${days}d ago` : `Checked ${Math.round(days / 30)}mo ago`,
  };
}

/* -------------------------------------------------------------------------- */
/* Guides — the Survival Hub                                                   */
/* -------------------------------------------------------------------------- */

export type GuideCategory =
  | "money"
  | "food"
  | "transport"
  | "housing"
  | "health"
  | "safety"
  | "university"
  | "admin"
  | "social"
  | "travel"
  | "jobs"
  | "language"
  | "culture";

export const guideCategoryMeta: Record<
  GuideCategory,
  { label: string; blurb: string; emoji: string }
> = {
  money: { label: "Money", blurb: "What things cost and how not to overpay.", emoji: "💶" },
  food: { label: "Food", blurb: "Eating well on a student budget.", emoji: "🍜" },
  transport: { label: "Transport", blurb: "Getting around for the least money.", emoji: "🚇" },
  housing: { label: "Housing", blurb: "Finding somewhere, and not getting caught out.", emoji: "🔑" },
  health: { label: "Health", blurb: "Pharmacies, doctors and what cover you need.", emoji: "🩺" },
  safety: { label: "Safety", blurb: "Emergency numbers and common scams.", emoji: "🛟" },
  university: { label: "University", blurb: "How the academic system actually works.", emoji: "🎓" },
  admin: { label: "Admin", blurb: "Registration, paperwork and deadlines.", emoji: "📄" },
  social: { label: "Social", blurb: "Meeting people when you know nobody.", emoji: "👋" },
  travel: { label: "Travel", blurb: "Weekends away without wrecking the month.", emoji: "🚄" },
  jobs: { label: "Jobs", blurb: "Part-time work and the rules around it.", emoji: "💼" },
  language: { label: "Language", blurb: "Enough to get by, and where to practise.", emoji: "💬" },
  culture: { label: "Culture", blurb: "Local norms nobody tells you about.", emoji: "🧭" },
};

/**
 * A short, actionable answer. Guides are deliberately not articles: a student
 * standing in a supermarket needs four bullets, not eight hundred words.
 */
export type Guide = {
  id: Id;
  citySlug: string | null;
  countryCode: string | null;
  category: GuideCategory;
  title: string;
  /** One line that answers the question in the title. */
  answer: string;
  points: readonly string[];
  source: "official" | "students" | "editorial";
  sourceUrl: string | null;
  checkedAt: Iso;
  confirmations: number;
};

/* -------------------------------------------------------------------------- */
/* Deal verification                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A student's report on whether a deal actually worked.
 *
 * This is the most defensible data the product can hold. A list of student
 * discounts is trivially copyable and half of any such list is dead within a
 * year. A list that knows which discounts worked *this week*, because students
 * said so, cannot be copied without the students.
 */
export type DealReport = {
  id: Id;
  dealId: Id;
  userId: Id;
  outcome: "worked" | "did-not-work" | "expired" | "requirements-changed";
  note: string | null;
  createdAt: Iso;
};

export type Confidence = "verified" | "likely" | "unconfirmed" | "disputed" | "expired";

/**
 * Confidence from reports, with recency weighting.
 *
 * Two properties matter and neither is negotiable:
 *
 *   Recent failures outweigh old successes. A deal that worked forty times last
 *   term and failed twice this week is broken, and a naive ratio would still
 *   call it verified.
 *
 *   Small samples never reach "verified". Two positive reports is two people,
 *   not a fact, so the threshold is on absolute count as well as ratio.
 */
export function dealConfidence(
  reports: readonly Pick<DealReport, "outcome" | "createdAt">[],
  now = new Date(),
): { confidence: Confidence; workedCount: number; lastConfirmedAt: Iso | null } {
  if (reports.length === 0) {
    return { confidence: "unconfirmed", workedCount: 0, lastConfirmedAt: null };
  }

  const HALF_LIFE_DAYS = 30;
  let positive = 0;
  let negative = 0;
  let workedCount = 0;
  let lastConfirmedAt: string | null = null;
  let expiredRecently = false;

  for (const report of reports) {
    const ageDays = Math.max(0, (now.getTime() - Date.parse(report.createdAt)) / 86_400_000);
    /* Exponential decay: a report is worth half as much every 30 days. */
    const weight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);

    if (report.outcome === "worked") {
      positive += weight;
      workedCount += 1;
      if (!lastConfirmedAt || report.createdAt > lastConfirmedAt) {
        lastConfirmedAt = report.createdAt;
      }
    } else {
      negative += weight;
      if (report.outcome === "expired" && ageDays <= 14) expiredRecently = true;
    }
  }

  if (expiredRecently && negative >= positive) {
    return { confidence: "expired", workedCount, lastConfirmedAt };
  }

  const total = positive + negative;
  const ratio = total === 0 ? 0 : positive / total;

  if (negative > positive) return { confidence: "disputed", workedCount, lastConfirmedAt };
  if (workedCount >= 5 && ratio >= 0.8) return { confidence: "verified", workedCount, lastConfirmedAt };
  if (workedCount >= 2 && ratio >= 0.6) return { confidence: "likely", workedCount, lastConfirmedAt };
  return { confidence: "unconfirmed", workedCount, lastConfirmedAt };
}

export const confidenceMeta: Record<
  Confidence,
  { label: string; accent: "mint" | "amber" | "pulse" | "signal"; note: string }
> = {
  verified: { label: "Verified", accent: "mint", note: "Confirmed by students recently." },
  likely: { label: "Likely live", accent: "signal", note: "A couple of students confirmed it." },
  unconfirmed: { label: "Unconfirmed", accent: "amber", note: "Nobody has checked this yet." },
  disputed: { label: "Disputed", accent: "pulse", note: "Recent reports say it did not work." },
  expired: { label: "Expired", accent: "pulse", note: "Students report this has ended." },
};

/* -------------------------------------------------------------------------- */
/* Price graph                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * An observed student price. Rows come from community reports and opt-in
 * receipt lines — never from scraping a merchant, and never invented.
 */
export type PriceObservation = {
  id: Id;
  citySlug: string;
  placeId: Id | null;
  /** "lunch" | "pint" | "coffee" | "weekly-basket" | "gym-month" | ... */
  item: string;
  amountCents: Cents;
  currency: string;
  source: "student-report" | "receipt" | "official" | "venue";
  userId: Id | null;
  observedAt: Iso;
};

export type PriceReading = {
  item: string;
  /** Median, not mean: one €40 outlier should not move the student price. */
  medianCents: Cents;
  lowCents: Cents;
  highCents: Cents;
  sampleSize: number;
  /** Never shown as a hard number below this. */
  confident: boolean;
  lastObservedAt: Iso | null;
};

/** The floor below which a price band is a rumour rather than a reading. */
export const PRICE_CONFIDENCE_MIN_SAMPLES = 4;

/**
 * Summarise observations into something printable.
 *
 * Median and an interquartile-ish band rather than mean and standard
 * deviation: student prices are not normally distributed (a handful of tourist
 * -priced outliers sit in every category) and a mean would quietly overstate
 * every category in the product.
 */
export function summarisePrices(
  observations: readonly PriceObservation[],
  item: string,
): PriceReading {
  const relevant = observations
    .filter((o) => o.item === item)
    .sort((a, b) => a.amountCents - b.amountCents);

  if (relevant.length === 0) {
    return {
      item,
      medianCents: 0,
      lowCents: 0,
      highCents: 0,
      sampleSize: 0,
      confident: false,
      lastObservedAt: null,
    };
  }

  const at = (fraction: number) =>
    relevant[Math.min(relevant.length - 1, Math.floor(relevant.length * fraction))].amountCents;

  const lastObservedAt = relevant.reduce<string | null>(
    (latest, o) => (!latest || o.observedAt > latest ? o.observedAt : latest),
    null,
  );

  return {
    item,
    medianCents: at(0.5),
    lowCents: at(0.15),
    highCents: at(0.85),
    sampleSize: relevant.length,
    confident: relevant.length >= PRICE_CONFIDENCE_MIN_SAMPLES,
    lastObservedAt,
  };
}
