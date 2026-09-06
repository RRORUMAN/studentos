import type {
  BudgetEnvelope,
  Cents,
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
 *   and the phone bill that have not left the account yet. A "safe" number
 *   that ignores a €340 charge due on the 28th is worse than no number.
 *
 *   No AI. Every figure here is arithmetic. The model is only ever asked to
 *   *explain* these numbers, never to compute one — see `src/server/ai`.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The default envelope set, in the order students think about them. Housing is
 * first and is the one most often excluded — plenty of students have rent paid
 * by a parent or a grant and only want to track the money they control.
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

export type CategoryKey = (typeof defaultCategories)[number]["key"] | (string & {});

export function categoryLabel(key: string): string {
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
/* Month helpers                                                               */
/* -------------------------------------------------------------------------- */

/** "2026-09" for a date. The month key used by every envelope row. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Days remaining including today — today still has spending left in it. */
export function daysLeftInMonth(now: Date): number {
  return daysInMonth(now) - now.getUTCDate() + 1;
}

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
  /** Positive = ahead of pace (overspending), negative = under. */
  paceDeltaCents: Cents;
  discretionary: boolean;
};

export type BudgetReading = {
  month: string;
  plannedCents: Cents;
  spentCents: Cents;
  remainingCents: Cents;
  /** Recurring charges due before month end that have not been paid yet. */
  committedCents: Cents;
  /** Remaining minus committed. The money genuinely free to spend. */
  availableCents: Cents;
  /** Available spread over the days left. The headline number on Home. */
  safeTodayCents: Cents;
  /** Available for the rest of this week, to the end of Sunday. */
  safeThisWeekCents: Cents;
  daysLeft: number;
  categories: CategoryReading[];
  /** True when the student is spending faster than the month can absorb. */
  overPace: boolean;
  /** Positive when under the even-pace line for the month so far. */
  paceDeltaCents: Cents;
};

/**
 * The whole budget picture for one month.
 *
 * `safeTodayCents` is the number the product is judged on: it is what a
 * student looks at before saying yes to a night out, and it has to be
 * defensible. It is *available* money — after committed recurring charges —
 * divided by days remaining, floored at zero. It is not "remaining ÷ days",
 * which would quietly promise money that rent is going to take.
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
  const availableCents = remainingCents - committedCents;

  const daysLeft = daysLeftInMonth(now);
  const elapsed = now.getUTCDate();
  const total = daysInMonth(now);

  /* Per category. */
  const categories: CategoryReading[] = monthEnvelopes
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

  const pacedTotal = Math.round((plannedCents * elapsed) / total);

  return {
    month,
    plannedCents,
    spentCents,
    remainingCents,
    committedCents,
    availableCents,
    safeTodayCents: Math.max(0, Math.floor(availableCents / Math.max(1, daysLeft))),
    safeThisWeekCents: Math.max(
      0,
      Math.floor((availableCents / Math.max(1, daysLeft)) * Math.min(daysLeft, daysToSunday(now))),
    ),
    daysLeft,
    categories,
    overPace: spentCents > pacedTotal,
    paceDeltaCents: spentCents - pacedTotal,
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
        return alreadyPaid(expense, transactions) ? sum : sum + expense.amountCents;
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

function alreadyPaid(expense: RecurringExpense, transactions: readonly Transaction[]): boolean {
  const tolerance = expense.amountCents * 0.15;
  return transactions.some(
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
/* Forecast (Plus)                                                             */
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
 * The line shown on Home.
 *
 * Rules it follows, from the brand voice: state the number, never scold, and
 * when money is tight offer the cheaper option rather than a judgement. There
 * is no "you overspent on nightlife again" branch, by design — that sentence
 * makes people close the app and does not change behaviour.
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
    action: { label: "Open budget", href: "/budget" },
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

/** This week's slice of the month, and what has gone against it so far. */
export function weeklyTarget(input: {
  now: Date;
  reading: BudgetReading;
  transactions: readonly Transaction[];
}): WeeklyTarget {
  const { now, reading, transactions } = input;

  const day = now.getUTCDay();
  const sinceMonday = day === 0 ? 6 : day - 1;
  const weekStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday),
  );

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
