import type { Settlement } from "@/domain/social";
import type {
  BudgetEnvelope,
  Cents,
  Id,
  RecurringExpense,
  Transaction,
} from "@/domain/types";

/**
 * ============================================================================
 * BUDGET ENGINE
 * ----------------------------------------------------------------------------
 * All of the product's money maths, as pure functions over rows. No I/O, no
 * clock of its own — `now` is always a parameter — so every number on the
 * Budget screen is reproducible and unit tested against fixed dates.
 *
 * Three principles the whole file obeys:
 *
 *   Integer cents everywhere. A budget that drifts by a cent per operation is
 *   a budget nobody trusts by week three.
 *
 *   Committed money is not available money. Safe-to-spend subtracts the rent
 *   and the phone bill that have not left the account yet, and the money set
 *   aside for a trip that has not started. A "safe" number that ignores a €340
 *   charge due on the 28th is worse than no number.
 *
 *   No AI. Every figure here is arithmetic. The model is only ever asked to
 *   *explain* these numbers, never to compute one — see `src/server/ai`.
 *
 * Sign convention, stated once because it was documented wrongly before:
 * every `paceDeltaCents` in this file is `spent − paced`. Positive means the
 * student is AHEAD of an even pace (spending faster than the month can
 * absorb); negative means under. `overPace` is `paceDeltaCents > 0`.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The default envelope set, in the order students think about them. Housing is
 * first and is the one most often excluded — plenty of students have rent paid
 * by a parent or a grant and only want to track the money they control.
 *
 * `src/config/onboarding.ts` carries a second copy of these keys and labels
 * for the detailed onboarding step. It is not owned by this module; keep the
 * two in step when a category is added.
 */
export const defaultCategories = [
  { key: "housing", label: "Housing", essential: true, share: 0.4 },
  { key: "groceries", label: "Groceries", essential: true, share: 0.16 },
  { key: "eating-out", label: "Eating out", essential: false, share: 0.12 },
  { key: "transport", label: "Transport", essential: true, share: 0.06 },
  { key: "nightlife", label: "Nightlife", essential: false, share: 0.09 },
  { key: "shopping", label: "Shopping", essential: false, share: 0.05 },
  { key: "fitness", label: "Fitness", essential: false, share: 0.03 },
  { key: "entertainment", label: "Entertainment", essential: false, share: 0.03 },
  { key: "travel", label: "Travel", essential: false, share: 0.03 },
  { key: "subscriptions", label: "Subscriptions", essential: true, share: 0.02 },
  { key: "other", label: "Other", essential: false, share: 0.01 },
] as const;

/**
 * Which place layers stand in for a budget category when the product looks
 * for a cheaper real alternative. Categories with no entry (rent, transport)
 * have no alternative worth suggesting.
 */
export const categoryLayers: Record<string, readonly string[]> = {
  "eating-out": ["cheap-food"],
  groceries: ["groceries"],
  nightlife: ["nightlife"],
  fitness: ["fitness"],
  entertainment: ["free", "events"],
  shopping: ["deals"],
};

export function layersForCategory(key: string): readonly string[] {
  return categoryLayers[key] ?? [];
}

/** Which deal categories are relevant to a budget category. */
export const categoryDealKinds: Record<string, readonly string[]> = {
  "eating-out": ["food"],
  groceries: ["food"],
  transport: ["transport"],
  fitness: ["fitness"],
  entertainment: ["entertainment", "culture"],
  nightlife: ["social", "entertainment"],
  subscriptions: ["money"],
  shopping: ["money"],
};

export function categoryLabel(key: string): string {
  const trip = parseTripCategory(key);
  if (trip) return tripLabel(trip);
  return (
    defaultCategories.find((category) => category.key === key)?.label ??
    key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " ")
  );
}

/** Categories a student can cut when money is tight. Drives Survival Mode. */
export function isDiscretionary(key: string): boolean {
  const known = defaultCategories.find((category) => category.key === key);
  return known ? !known.essential : true;
}

/**
 * Split a monthly total into starting envelopes.
 *
 * Used once, at the end of onboarding, so a student who chose "simple" still
 * lands on a real per-category budget rather than one undifferentiated number.
 * The shares are a starting point that the student then edits — presenting
 * them as a recommendation would be inventing advice we cannot support.
 *
 * When housing is excluded, its share is redistributed proportionally across
 * the rest rather than left as slack, or the envelopes would sum to 60% of the
 * budget and every category would look permanently under-funded.
 */
export function suggestEnvelopes(
  monthlyTotalCents: Cents,
  options: { excludeHousing: boolean } = { excludeHousing: false },
): { category: string; plannedCents: Cents }[] {
  const included = defaultCategories.filter(
    (category) => !(options.excludeHousing && category.key === "housing"),
  );

  const shareTotal = included.reduce((sum, category) => sum + category.share, 0);

  const rows = included.map((category) => ({
    category: category.key,
    plannedCents: Math.round((monthlyTotalCents * category.share) / shareTotal),
  }));

  /* Rounding each share independently loses or gains a few cents. Push the
     difference into "other" so the envelopes always sum to the total exactly. */
  const drift = monthlyTotalCents - rows.reduce((sum, row) => sum + row.plannedCents, 0);
  const other = rows.find((row) => row.category === "other");
  if (other) other.plannedCents += drift;

  return rows;
}

/* -------------------------------------------------------------------------- */
/* Amounts                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Parse what a student typed into a money field.
 *
 * Accepts "12", "12.5", "12,50" and " 12.50 ". Returns null for anything that
 * is not a positive amount with at most two decimals — never NaN, never zero.
 * Every surface that reads an amount from a URL or an input goes through this
 * one function, so a comma behaves identically on Afford and Survival.
 */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** `parseAmount`, in integer cents. */
export function parseAmountCents(raw: string | null | undefined): Cents | null {
  const value = parseAmount(raw);
  return value === null ? null : Math.round(value * 100);
}

/* -------------------------------------------------------------------------- */
/* Month helpers                                                               */
/* -------------------------------------------------------------------------- */

/** "2026-09" for a date. The month key used by every envelope row. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09-10" for a date, in UTC. The day key used for grouping. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Days remaining including today — today still has spending left in it. */
export function daysLeftInMonth(now: Date): number {
  return daysInMonth(now) - now.getUTCDate() + 1;
}

/** Whole days from `from` to `to`, by calendar day in UTC. Negative when past. */
function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* Trips                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A trip envelope is an ordinary `envelopes` row whose category carries the
 * trip: `travel:<slug>:<start>:<end>`, with `custom: true` so re-running setup
 * never discards it. Encoding the dates in the key keeps trips inside the
 * tables the budget already owns — there is no trips table, and inventing a
 * side-store for two dates would be worse than a readable key.
 *
 * The money in a trip envelope is *reserved*: it counts in the month's plan
 * but is subtracted from safe-to-spend until the trip starts. A weekend away
 * should not quietly inflate the "safe to spend today" figure the week before it.
 */
export const TRIP_PREFIX = "travel:";

export type TripKey = {
  category: string;
  slug: string;
  name: string;
  /** YYYY-MM-DD. */
  start: string;
  end: string;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function tripSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "trip";
}

export function tripCategory(input: { name: string; start: string; end: string }): string {
  return `${TRIP_PREFIX}${tripSlug(input.name)}:${input.start}:${input.end}`;
}

export function isTripCategory(key: string): boolean {
  return key.startsWith(TRIP_PREFIX);
}

export function parseTripCategory(key: string): TripKey | null {
  if (!isTripCategory(key)) return null;
  const [slug, start, end] = key.slice(TRIP_PREFIX.length).split(":");
  if (!slug || !start || !end || !ISO_DAY.test(start) || !ISO_DAY.test(end)) return null;
  const name = slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return { category: key, slug, name, start, end };
}

export function tripLabel(trip: Pick<TripKey, "name">): string {
  return /\btrip\b/i.test(trip.name) ? trip.name : `${trip.name} trip`;
}

export type TripStatus = "upcoming" | "active" | "past";

export function tripStatus(trip: Pick<TripKey, "start" | "end">, now: Date): TripStatus {
  const today = dayKey(now);
  if (today < trip.start) return "upcoming";
  if (today > trip.end) return "past";
  return "active";
}

export type TripReading = TripKey & {
  plannedCents: Cents;
  spentCents: Cents;
  remainingCents: Cents;
  status: TripStatus;
  /** Days until it starts. Zero on the day; negative once started. */
  daysUntil: number;
  /** True while the money is held back from safe-to-spend. */
  reserved: boolean;
};

/* -------------------------------------------------------------------------- */
/* The core reading                                                            */
/* -------------------------------------------------------------------------- */

export type CategoryReading = {
  category: string;
  label: string;
  plannedCents: Cents;
  spentCents: Cents;
  remainingCents: Cents;
  /** 0-1+, where >1 means over budget. Drives the meter. */
  fraction: number;
  /** Where they should be by now if spending were even. */
  pacedCents: Cents;
  /** `spent − paced`. Positive = ahead of pace (overspending), negative = under. */
  paceDeltaCents: Cents;
  discretionary: boolean;
};

export type BudgetReading = {
  month: string;
  /** Every envelope for the month, trips included. */
  plannedCents: Cents;
  spentCents: Cents;
  remainingCents: Cents;
  /** Recurring charges due before month end that have not been paid yet. */
  committedCents: Cents;
  /** Money held for trips that have not started. Never spendable today. */
  reservedCents: Cents;
  /** Remaining minus committed minus reserved. The money genuinely free to spend. */
  availableCents: Cents;
  /** Available spread over the days left. The headline number on Home. */
  safeTodayCents: Cents;
  /** Available for the rest of this week, to the end of Sunday. */
  safeThisWeekCents: Cents;
  daysLeft: number;
  /** Ordinary envelopes only; trips are in `trips`. */
  categories: CategoryReading[];
  trips: TripReading[];
  /** True when the student is spending faster than the month can absorb. */
  overPace: boolean;
  /** `spent − paced` for the month so far. Positive = over the even-pace line. */
  paceDeltaCents: Cents;
  /** Where the month would be at an even pace, in cents. Drives the pace marker. */
  pacedCents: Cents;
};

/**
 * The whole budget picture for one month.
 *
 * `safeTodayCents` is the number the product is judged on: it is what a
 * student looks at before saying yes to a night out, and it has to be
 * defensible. It is *available* money — after committed recurring charges and
 * reserved trip money — divided by days remaining, floored at zero. It is not
 * "remaining ÷ days", which would quietly promise money that rent is going to
 * take.
 */
export function readBudget(input: {
  now: Date;
  envelopes: readonly BudgetEnvelope[];
  transactions: readonly Transaction[];
  recurring: readonly RecurringExpense[];
}): BudgetReading {
  const { now, envelopes, transactions, recurring } = input;
  const month = monthKey(now);

  const monthEnvelopes = envelopes.filter((envelope) => envelope.month === month);
  const monthTransactions = transactions.filter((tx) => monthKey(new Date(tx.spentAt)) === month);

  const plannedCents = monthEnvelopes.reduce((sum, envelope) => sum + envelope.plannedCents, 0);
  const spentCents = monthTransactions.reduce((sum, tx) => sum + tx.amountCents, 0);
  const remainingCents = plannedCents - spentCents;

  const committedCents = committedRemaining({ now, recurring, transactions: monthTransactions });

  const daysLeft = daysLeftInMonth(now);
  const elapsed = now.getUTCDate();
  const total = daysInMonth(now);

  /* Trips: reserved until they start. */
  const trips: TripReading[] = monthEnvelopes
    .map((envelope) => {
      const key = parseTripCategory(envelope.category);
      if (!key) return null;
      const tripSpent = monthTransactions
        .filter((tx) => tx.category === envelope.category)
        .reduce((sum, tx) => sum + tx.amountCents, 0);
      const status = tripStatus(key, now);
      const remaining = envelope.plannedCents - tripSpent;
      return {
        ...key,
        plannedCents: envelope.plannedCents,
        spentCents: tripSpent,
        remainingCents: remaining,
        status,
        daysUntil: daysBetween(now, new Date(`${key.start}T12:00:00Z`)),
        reserved: status === "upcoming" && remaining > 0,
      };
    })
    .filter((trip): trip is TripReading => trip !== null)
    .sort((a, b) => a.start.localeCompare(b.start));

  const reservedCents = trips.filter((trip) => trip.reserved).reduce((sum, trip) => sum + trip.remainingCents, 0);
  const availableCents = remainingCents - committedCents - reservedCents;

  /* Per category. Trips are excluded: a pace marker on a weekend away means
     nothing, and a label like "Barcelona trip" in a categories list built for
     rent and groceries would be a different object pretending to be the same. */
  const categories: CategoryReading[] = monthEnvelopes
    .filter((envelope) => !isTripCategory(envelope.category))
    .map((envelope) => {
      const categorySpent = monthTransactions
        .filter((tx) => tx.category === envelope.category)
        .reduce((sum, tx) => sum + tx.amountCents, 0);

      const pacedCents = Math.round((envelope.plannedCents * elapsed) / total);

      return {
        category: envelope.category,
        label: categoryLabel(envelope.category),
        plannedCents: envelope.plannedCents,
        spentCents: categorySpent,
        remainingCents: envelope.plannedCents - categorySpent,
        fraction: envelope.plannedCents === 0 ? 0 : categorySpent / envelope.plannedCents,
        pacedCents,
        paceDeltaCents: categorySpent - pacedCents,
        discretionary: isDiscretionary(envelope.category),
      };
    })
    .sort((a, b) => b.spentCents - a.spentCents);

  /* Pace is measured on the ordinary envelopes. Trip money is spent in a
     burst on its dates, so folding it in would put everyone "under pace"
     before the trip and "over pace" during it for no reason. */
  const regularPlanned = categories.reduce((sum, category) => sum + category.plannedCents, 0);
  const regularSpent = categories.reduce((sum, category) => sum + category.spentCents, 0);
  const pacedTotal = Math.round((regularPlanned * elapsed) / total);

  return {
    month,
    plannedCents,
    spentCents,
    remainingCents,
    committedCents,
    reservedCents,
    availableCents,
    safeTodayCents: Math.max(0, Math.floor(availableCents / Math.max(1, daysLeft))),
    safeThisWeekCents: Math.max(
      0,
      Math.floor((availableCents / Math.max(1, daysLeft)) * Math.min(daysLeft, daysToSunday(now))),
    ),
    daysLeft,
    categories,
    trips,
    overPace: regularSpent > pacedTotal,
    paceDeltaCents: regularSpent - pacedTotal,
    pacedCents: pacedTotal,
  };
}

/** Days remaining in the week, counting today, week ending Sunday. */
export function daysToSunday(now: Date): number {
  const day = now.getUTCDay(); // 0 = Sunday
  return day === 0 ? 1 : 8 - day;
}

/**
 * Recurring charges still to land this month.
 *
 * A charge counts as already paid when a transaction in the same category and
 * roughly the same amount exists on or after its due day. Matching on category
 * plus a 15% amount tolerance rather than an exact figure, because a "€45 gym"
 * that actually charged €45.99 is the same commitment and double-counting it
 * would understate safe-to-spend for the rest of the month.
 */
export function committedRemaining(input: {
  now: Date;
  recurring: readonly RecurringExpense[];
  transactions: readonly Transaction[];
}): Cents {
  const { now, recurring, transactions } = input;
  const today = now.getUTCDate();
  const total = daysInMonth(now);

  return recurring
    .filter((expense) => expense.active)
    .reduce((sum, expense) => {
      if (expense.cadence === "monthly") {
        const dueDay = Math.min(expense.dayOfPeriod, total);
        if (dueDay < today) return sum;
        return paidThisMonth(expense, transactions) ? sum : sum + expense.amountCents;
      }

      if (expense.cadence === "weekly") {
        /* Count the remaining occurrences of that weekday this month. */
        let occurrences = 0;
        for (let day = today; day <= total; day += 1) {
          const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
          if (date.getUTCDay() === expense.dayOfPeriod) occurrences += 1;
        }
        return sum + expense.amountCents * occurrences;
      }

      /* Termly charges are not modelled as monthly commitments. */
      return sum;
    }, 0);
}

/** A transaction in this month's rows that looks like this charge landing. */
export function paidThisMonth(
  expense: Pick<RecurringExpense, "category" | "amountCents">,
  monthTransactions: readonly Transaction[],
): boolean {
  const tolerance = expense.amountCents * 0.15;
  return monthTransactions.some(
    (tx) =>
      tx.category === expense.category &&
      Math.abs(tx.amountCents - expense.amountCents) <= tolerance,
  );
}

/* -------------------------------------------------------------------------- */
/* Safe until a date                                                           */
/* -------------------------------------------------------------------------- */

/**
 * "Safe until Monday" — available money divided over the days to a horizon.
 *
 * Clamped to the end of the month: promising a student they can spend €57 by
 * Monday when Monday is in the next budget month would be borrowing from a
 * budget that does not exist yet.
 */
export function safeUntil(reading: BudgetReading, now: Date, until: Date): Cents {
  const days = Math.max(
    1,
    Math.min(reading.daysLeft, Math.ceil((until.getTime() - now.getTime()) / 86_400_000)),
  );
  return Math.max(0, Math.floor((reading.availableCents / Math.max(1, reading.daysLeft)) * days));
}

/* -------------------------------------------------------------------------- */
/* Forecast (Pro)                                                              */
/* -------------------------------------------------------------------------- */

export type Forecast = {
  /** Projected total spend for the month at the current rate. */
  projectedCents: Cents;
  /** Projected end position: positive = under budget. */
  projectedDeltaCents: Cents;
  /** Days of data the projection is based on. Below 5 it is not shown. */
  basisDays: number;
  confident: boolean;
  /** What the daily rate would have to be to land on target. */
  requiredDailyCents: Cents;
  currentDailyCents: Cents;
};

/**
 * Straight-line projection from spend so far, plus known commitments.
 *
 * Deliberately simple. A seasonal or day-of-week model would be more accurate
 * in the abstract and completely unexplainable in a UI — a student who cannot
 * see why the number moved stops believing it. This one is one sentence:
 * "you have spent €X in Y days, so at that rate the month ends at €Z".
 *
 * `confident` gates display: four days of data at the start of a month
 * projects wildly, and showing a confident-looking wrong number is worse than
 * showing nothing.
 */
export function forecast(reading: BudgetReading, now: Date): Forecast {
  const elapsed = now.getUTCDate();
  const total = daysInMonth(now);
  const discretionarySpend = reading.spentCents;

  const currentDailyCents = elapsed === 0 ? 0 : Math.round(discretionarySpend / elapsed);
  const projectedCents = currentDailyCents * total + reading.committedCents;

  return {
    projectedCents,
    projectedDeltaCents: reading.plannedCents - projectedCents,
    basisDays: elapsed,
    confident: elapsed >= 5,
    requiredDailyCents: Math.max(
      0,
      Math.floor((reading.plannedCents - discretionarySpend - reading.committedCents) / Math.max(1, reading.daysLeft)),
    ),
    currentDailyCents,
  };
}

/**
 * The month as a line: cumulative spend per day so far, then the straight-line
 * projection to month end with committed charges landing on the last day. This
 * is the series the forecast sparkline draws — the number and the picture come
 * from the same arithmetic, so they can never disagree.
 */
export type Trajectory = {
  daysInMonth: number;
  /** 1-based day of month. */
  today: number;
  plannedCents: Cents;
  committedCents: Cents;
  /** Cumulative spend, index 0 = day 1, through today. */
  actual: Cents[];
  /** Cumulative projection, index 0 = day 1, through the last day. */
  projected: Cents[];
};

export function spendTrajectory(input: {
  now: Date;
  transactions: readonly Transaction[];
  reading: BudgetReading;
  forecast: Forecast;
}): Trajectory {
  const { now, transactions, reading } = input;
  const total = daysInMonth(now);
  const today = now.getUTCDate();
  const month = monthKey(now);

  const perDay = new Array<number>(total).fill(0);
  for (const tx of transactions) {
    const at = new Date(tx.spentAt);
    if (monthKey(at) !== month) continue;
    perDay[at.getUTCDate() - 1] += tx.amountCents;
  }

  const actual: Cents[] = [];
  let running = 0;
  for (let day = 1; day <= today; day += 1) {
    running += perDay[day - 1];
    actual.push(running);
  }

  const projected: Cents[] = [...actual];
  const daily = input.forecast.currentDailyCents;
  for (let day = today + 1; day <= total; day += 1) {
    projected.push(running + daily * (day - today));
  }
  if (projected.length > 0) projected[projected.length - 1] += reading.committedCents;

  return {
    daysInMonth: total,
    today,
    plannedCents: reading.plannedCents,
    committedCents: reading.committedCents,
    actual,
    projected,
  };
}

/* -------------------------------------------------------------------------- */
/* Insight                                                                     */
/* -------------------------------------------------------------------------- */

export type BudgetInsight = {
  tone: "good" | "watch" | "tight";
  /** One sentence. Always states a number. */
  headline: string;
  /** The concrete next thing, or null when nothing needs doing. */
  action: { label: string; href: string } | null;
  /** The category driving the insight, when there is one. */
  category: string | null;
};

/**
 * The line shown on Home and at the top of Budget.
 *
 * Rules it follows, from the brand voice: state the number, never scold, and
 * when money is tight offer the cheaper option rather than a judgement. There
 * is no "you overspent on nightlife again" branch, by design — that sentence
 * makes people close the app and does not change behaviour.
 *
 * Every action leads somewhere other than the screen the line is on. A link
 * back to the page you are reading is not an action.
 */
export function budgetInsight(reading: BudgetReading, currencyFormat: (cents: Cents) => string): BudgetInsight {
  if (reading.plannedCents === 0) {
    return {
      tone: "watch",
      headline: "No budget set yet.",
      action: { label: "Set a budget", href: "/budget/setup" },
      category: null,
    };
  }

  /* The worst-offending discretionary category, if any is meaningfully ahead. */
  const drifting = reading.categories
    .filter((category) => category.discretionary && category.paceDeltaCents > 0)
    .sort((a, b) => b.paceDeltaCents - a.paceDeltaCents)[0];

  if (reading.availableCents <= 0) {
    return {
      tone: "tight",
      headline: `Committed costs use what is left this month.`,
      action: { label: "Build a plan for what you have", href: "/budget/survival" },
      category: drifting?.category ?? null,
    };
  }

  if (reading.overPace && drifting && drifting.paceDeltaCents > reading.plannedCents * 0.03) {
    return {
      tone: "watch",
      headline: `${drifting.label} is ${currencyFormat(drifting.paceDeltaCents)} ahead of pace.`,
      action: { label: "See cheaper alternatives", href: "/discover?filter=under-10" },
      category: drifting.category,
    };
  }

  if (!reading.overPace) {
    return {
      tone: "good",
      headline: `You are ${currencyFormat(Math.abs(reading.paceDeltaCents))} under your pace for the month.`,
      action: { label: "See what is on tonight", href: "/events?when=tonight" },
      category: null,
    };
  }

  return {
    tone: "watch",
    headline: `${currencyFormat(reading.safeTodayCents)} a day keeps you on track.`,
    action: { label: "Find something free this week", href: "/events?tab=free" },
    category: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Weekly target                                                               */
/* -------------------------------------------------------------------------- */

export type WeeklyTarget = {
  targetCents: Cents;
  spentCents: Cents;
  remainingCents: Cents;
  /** Monday of the current week, ISO. */
  weekStart: string;
};

/** Monday 00:00 UTC of the week containing `now`. */
export function weekStartOf(now: Date): Date {
  const day = now.getUTCDay();
  const sinceMonday = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday));
}

/** This week's slice of the month, and what has gone against it so far. */
export function weeklyTarget(input: {
  now: Date;
  reading: BudgetReading;
  transactions: readonly Transaction[];
}): WeeklyTarget {
  const { now, reading, transactions } = input;
  const weekStart = weekStartOf(now);

  const spentCents = transactions
    .filter((tx) => new Date(tx.spentAt) >= weekStart)
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  /* A week's worth of the *available* daily rate, not of the raw budget. */
  const dailyRate = reading.availableCents / Math.max(1, reading.daysLeft);
  const targetCents = Math.max(0, Math.round(dailyRate * 7));

  return {
    targetCents,
    spentCents,
    remainingCents: targetCents - spentCents,
    weekStart: weekStart.toISOString(),
  };
}

/**
 * The last few weeks as bars, this week last.
 *
 * The target line is *this* week's target drawn across every bar. Earlier
 * weeks had their own targets that were not recorded, and inventing them
 * would be a guess drawn as a fact; one honest reference line is better.
 */
export type WeekBar = {
  /** Monday, YYYY-MM-DD. */
  weekStart: string;
  spentCents: Cents;
  targetCents: Cents;
  current: boolean;
};

export function weeklyBars(input: {
  now: Date;
  transactions: readonly Transaction[];
  targetCents: Cents;
  weeks?: number;
}): WeekBar[] {
  const weeks = Math.max(1, input.weeks ?? 6);
  const thisMonday = weekStartOf(input.now);
  const out: WeekBar[] = [];

  for (let back = weeks - 1; back >= 0; back -= 1) {
    const start = new Date(thisMonday.getTime() - back * 7 * 86_400_000);
    const end = new Date(start.getTime() + 7 * 86_400_000);
    const spentCents = input.transactions
      .filter((tx) => {
        const at = Date.parse(tx.spentAt);
        return at >= start.getTime() && at < end.getTime();
      })
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    out.push({ weekStart: dayKey(start), spentCents, targetCents: input.targetCents, current: back === 0 });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Subscriptions and repeating costs                                           */
/* -------------------------------------------------------------------------- */

export type SubscriptionRow = {
  id: Id;
  label: string;
  category: string;
  amountCents: Cents;
  cadence: RecurringExpense["cadence"];
  dayOfPeriod: number;
  /** Next charge as YYYY-MM-DD. Null for termly rows, whose day is not modelled. */
  nextDue: string | null;
  daysUntil: number | null;
  /** What it costs per month, so a weekly and a monthly row can be compared. */
  monthlyCents: Cents;
  /** A matching transaction has already landed this month. */
  paidThisMonth: boolean;
};

export type SubscriptionsReading = {
  rows: SubscriptionRow[];
  monthlyTotalCents: Cents;
  /** Unpaid charges landing within seven days. */
  dueSoonCents: Cents;
  dueSoonCount: number;
  /** What is still to come out this month. Identical to `committedCents`. */
  stillToComeCents: Cents;
};

/** The next date a repeating charge lands, counting today. Null for termly. */
export function nextDueDate(expense: Pick<RecurringExpense, "cadence" | "dayOfPeriod">, now: Date): Date | null {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = now.getUTCDate();

  if (expense.cadence === "monthly") {
    const thisMonthDue = Math.min(expense.dayOfPeriod, daysInMonth(now));
    if (thisMonthDue >= today) return new Date(Date.UTC(year, month, thisMonthDue));
    const next = new Date(Date.UTC(year, month + 1, 1));
    return new Date(Date.UTC(year, month + 1, Math.min(expense.dayOfPeriod, daysInMonth(next))));
  }

  if (expense.cadence === "weekly") {
    const delta = (expense.dayOfPeriod - now.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(year, month, today + delta));
  }

  return null;
}

/** Monthly equivalent of a charge. A term is taken as four months. */
export function monthlyEquivalent(expense: Pick<RecurringExpense, "cadence" | "amountCents">): Cents {
  if (expense.cadence === "weekly") return Math.round((expense.amountCents * 52) / 12);
  if (expense.cadence === "termly") return Math.round(expense.amountCents / 4);
  return expense.amountCents;
}

export function subscriptionsReading(input: {
  now: Date;
  recurring: readonly RecurringExpense[];
  transactions: readonly Transaction[];
}): SubscriptionsReading {
  const { now, recurring, transactions } = input;
  const month = monthKey(now);
  const monthTransactions = transactions.filter((tx) => monthKey(new Date(tx.spentAt)) === month);

  const rows: SubscriptionRow[] = recurring
    .filter((expense) => expense.active)
    .map((expense) => {
      const due = nextDueDate(expense, now);
      return {
        id: expense.id,
        label: expense.label,
        category: expense.category,
        amountCents: expense.amountCents,
        cadence: expense.cadence,
        dayOfPeriod: expense.dayOfPeriod,
        nextDue: due ? dayKey(due) : null,
        daysUntil: due ? daysBetween(now, due) : null,
        monthlyCents: monthlyEquivalent(expense),
        paidThisMonth: expense.cadence === "monthly" && paidThisMonth(expense, monthTransactions),
      };
    })
    .sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999) || b.amountCents - a.amountCents);

  const dueSoon = rows.filter((row) => row.daysUntil !== null && row.daysUntil <= 7 && !row.paidThisMonth);

  return {
    rows,
    monthlyTotalCents: rows.reduce((sum, row) => sum + row.monthlyCents, 0),
    dueSoonCents: dueSoon.reduce((sum, row) => sum + row.amountCents, 0),
    dueSoonCount: dueSoon.length,
    stillToComeCents: committedRemaining({ now, recurring, transactions: monthTransactions }),
  };
}

/**
 * Charges that look like a subscription nobody has told the budget about.
 *
 * The rule, stated plainly so it can be argued with: the same category, an
 * amount within 15% of itself, in at least two consecutive months, with the
 * run still alive (its last month is this month or last). Anything already
 * covered by a repeating row is skipped. Two matches is a hint, not a fact,
 * which is why the UI offers "add as repeating" and never adds it silently.
 */
export type DetectedSubscription = {
  key: string;
  category: string;
  label: string;
  amountCents: Cents;
  /** Median day of month the charge lands. */
  dayOfMonth: number;
  /** The consecutive months it was seen in, oldest first. */
  months: string[];
  merchant: string | null;
};

const DETECT = { tolerance: 0.15, minMonths: 2, lookbackMonths: 6 } as const;

function monthIndex(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return year * 12 + (month - 1);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export function detectSubscriptions(input: {
  transactions: readonly Transaction[];
  recurring: readonly RecurringExpense[];
  now: Date;
  lookbackMonths?: number;
}): DetectedSubscription[] {
  const { transactions, recurring, now } = input;
  const lookback = input.lookbackMonths ?? DETECT.lookbackMonths;
  const currentIndex = monthIndex(monthKey(now));
  const floor = currentIndex - (lookback - 1);

  const window = transactions
    .map((tx) => ({ tx, month: monthKey(new Date(tx.spentAt)) }))
    .filter((entry) => {
      const index = monthIndex(entry.month);
      return index >= floor && index <= currentIndex;
    });

  const byCategory = new Map<string, typeof window>();
  for (const entry of window) {
    const list = byCategory.get(entry.tx.category) ?? [];
    list.push(entry);
    byCategory.set(entry.tx.category, list);
  }

  const covered = (category: string, amountCents: Cents) =>
    recurring.some(
      (expense) =>
        expense.active &&
        expense.category === category &&
        Math.abs(expense.amountCents - amountCents) <= expense.amountCents * DETECT.tolerance,
    );

  const out: DetectedSubscription[] = [];

  for (const [category, entries] of byCategory) {
    const found: DetectedSubscription[] = [];

    for (const anchor of entries) {
      const tolerance = anchor.tx.amountCents * DETECT.tolerance;
      /* One matching row per month, nearest in amount to the anchor. */
      const perMonth = new Map<string, Transaction>();
      for (const entry of entries) {
        const gap = Math.abs(entry.tx.amountCents - anchor.tx.amountCents);
        if (gap > tolerance) continue;
        const existing = perMonth.get(entry.month);
        if (!existing || gap < Math.abs(existing.amountCents - anchor.tx.amountCents)) {
          perMonth.set(entry.month, entry.tx);
        }
      }

      /* The run of consecutive months that contains the anchor's month. */
      const months = [...perMonth.keys()].sort();
      const anchorIndex = monthIndex(anchor.month);
      const indices = new Set(months.map(monthIndex));
      let start = anchorIndex;
      while (indices.has(start - 1)) start -= 1;
      let end = anchorIndex;
      while (indices.has(end + 1)) end += 1;
      const run = months.filter((key) => monthIndex(key) >= start && monthIndex(key) <= end);

      if (run.length < DETECT.minMonths) continue;
      /* A run that stopped more than a month ago is a past subscription, not a live one. */
      if (end < currentIndex - 1) continue;

      const matched = run.map((key) => perMonth.get(key)!);
      const amountCents = median(matched.map((tx) => tx.amountCents));
      if (covered(category, amountCents)) continue;
      if (found.some((candidate) => Math.abs(candidate.amountCents - amountCents) <= candidate.amountCents * DETECT.tolerance)) continue;

      const merchants = matched.map((tx) => tx.merchant).filter((name): name is string => Boolean(name));
      const merchant =
        merchants.length > 0
          ? [...merchants].sort(
              (a, b) => merchants.filter((name) => name === b).length - merchants.filter((name) => name === a).length,
            )[0]
          : null;

      found.push({
        key: `${category}:${amountCents}`,
        category,
        label: merchant ?? categoryLabel(category),
        amountCents,
        dayOfMonth: median(matched.map((tx) => new Date(tx.spentAt).getUTCDate())),
        months: run,
        merchant,
      });
    }

    out.push(...found);
  }

  return out.sort((a, b) => b.months.length - a.months.length || b.amountCents - a.amountCents);
}

/* -------------------------------------------------------------------------- */
/* History grouping                                                            */
/* -------------------------------------------------------------------------- */

export type DayGroup = {
  /** YYYY-MM-DD, UTC. */
  day: string;
  totalCents: Cents;
  transactions: Transaction[];
};

/** Transactions grouped by the day they were spent, newest day first. */
export function groupTransactionsByDay(transactions: readonly Transaction[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const tx of [...transactions].sort((a, b) => b.spentAt.localeCompare(a.spentAt))) {
    const day = tx.spentAt.slice(0, 10);
    const group = groups.get(day) ?? { day, totalCents: 0, transactions: [] };
    group.totalCents += tx.amountCents;
    group.transactions.push(tx);
    groups.set(day, group);
  }
  return [...groups.values()].sort((a, b) => b.day.localeCompare(a.day));
}

/* -------------------------------------------------------------------------- */
/* Shared buckets: settle-up                                                   */
/* -------------------------------------------------------------------------- */

/** One payment that, with the others, clears a bucket. */
export type SettleTransfer = { from: Id; to: Id; amountCents: Cents };

/**
 * Turn per-person positions into the fewest sensible payments.
 *
 * Greedy: the person who owes most pays the person who is owed most, and so
 * on. It is not always the theoretical minimum number of transfers, but it is
 * always correct, always explainable ("you owe Ana €7"), and never asks
 * someone to pay a person who does not need paying.
 */
export function settleUpTransfers(settlements: readonly Settlement[]): SettleTransfer[] {
  const debtors = settlements
    .filter((row) => row.netCents < 0)
    .map((row) => ({ userId: row.userId, cents: -row.netCents }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = settlements
    .filter((row) => row.netCents > 0)
    .map((row) => ({ userId: row.userId, cents: row.netCents }))
    .sort((a, b) => b.cents - a.cents);

  const out: SettleTransfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].cents, creditors[j].cents);
    if (amount > 0) out.push({ from: debtors[i].userId, to: creditors[j].userId, amountCents: amount });
    debtors[i].cents -= amount;
    creditors[j].cents -= amount;
    if (debtors[i].cents === 0) i += 1;
    if (creditors[j].cents === 0) j += 1;
  }
  return out;
}
