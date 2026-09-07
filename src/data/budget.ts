/**
 * ============================================================================
 * SEEDED BUDGET MONTH
 * ----------------------------------------------------------------------------
 * The month behind every money number on the landing page: Today, Ask,
 * Budget, LifeOps. Every headline figure is derived from these rows, so the
 * page cannot show "Safe to spend today €18" in one section and €19 in another.
 *
 * Nothing here is a live account. Every panel that renders it carries a
 * sample marker.
 * ============================================================================
 */

export type BudgetCategory = {
  key: string;
  label: string;
  /** Planned for the month, excluding rent. */
  planned: number;
  spent: number;
  accent: "flow" | "mint" | "amber" | "pulse" | "signal";
};

export type UpcomingCharge = {
  label: string;
  amount: number;
  inDays: number;
};

export const budgetMonth = {
  label: "September",
  /** Days remaining in the month, including today. */
  daysLeft: 19,
  /** Days the going-out envelope has to cover before the week resets. Today is
      a Thursday in the demo, so Thursday through Sunday: four days. */
  daysUntilMonday: 4,
  /** Rent is tracked separately so it never distorts the daily number. */
  rentPaid: true,
  categories: [
    { key: "food", label: "Food and groceries", planned: 260, spent: 152, accent: "mint" },
    { key: "going-out", label: "Going out", planned: 140, spent: 73, accent: "pulse" },
    { key: "transport", label: "Transport", planned: 40, spent: 20, accent: "flow" },
    { key: "course", label: "Course and supplies", planned: 60, spent: 12, accent: "signal" },
    { key: "everything-else", label: "Everything else", planned: 180, spent: 48, accent: "amber" },
  ] satisfies BudgetCategory[],
  upcoming: [
    { label: "Phone plan", amount: 11, inDays: 4 },
    { label: "Gym", amount: 22, inDays: 9 },
  ] satisfies UpcomingCharge[],
  /** What a normal week should cost at this plan. */
  weeklyTarget: 130,
  /** What this week has actually cost so far. */
  weekSoFar: 69,
} as const;

export function budgetPlanned(): number {
  return budgetMonth.categories.reduce((total, category) => total + category.planned, 0);
}

export function budgetSpent(): number {
  return budgetMonth.categories.reduce((total, category) => total + category.spent, 0);
}

/** What is genuinely left this month. */
export function budgetRemaining(): number {
  return budgetPlanned() - budgetSpent();
}

export function upcomingTotal(): number {
  return budgetMonth.upcoming.reduce((total, charge) => total + charge.amount, 0);
}

/**
 * SAFE TO SPEND TODAY: remaining balance minus the charges already known about, spread
 * over the days left, rounded down to a whole unit so it is never optimistic.
 */
export function safeToday(): number {
  const spendable = budgetRemaining() - upcomingTotal();
  return Math.floor(spendable / budgetMonth.daysLeft);
}

/** SAFE TO SPEND THIS WEEK: what the weekly target still allows. */
export function safeThisWeek(): number {
  return Math.max(0, budgetMonth.weeklyTarget - budgetMonth.weekSoFar);
}

/** The going-out envelope until the week resets. */
export function safeUntilMonday(): number {
  return safeToday() * budgetMonth.daysUntilMonday;
}

export function categoryRemaining(key: string): number {
  const category = budgetMonth.categories.find((item) => item.key === key);
  if (!category) return 0;
  return category.planned - category.spent;
}

/** How far under (positive) or over (negative) the weekly target you are. */
export function weeklyDelta(): number {
  return budgetMonth.weeklyTarget - budgetMonth.weekSoFar;
}

/** Tonight's plan, the one the Budget section checks against. */
export const tonightPlanCost = 14;

/** Cheaper versions of tonight's plan. The saving is derived, never typed. */
export const cheaperAlternatives: readonly { label: string; note: string; price: number }[] = [
  { label: "Same bar, happy hour", note: "In before 21:00, same street", price: 9 },
  { label: "Mensa dinner, then the event", note: "Open to students from any university", price: 6 },
  { label: "Free rooftop only", note: "Eat at home first", price: 0 },
];

/* -------------------------------------------------------------------------- */
/* Can I afford this?                                                          */
/* -------------------------------------------------------------------------- */

export type AffordVerdict = "easy" | "yes-but" | "careful" | "no";

export type AffordCheck = {
  amount: number;
  verdict: AffordVerdict;
  /** The answer, in five words or fewer. */
  headline: string;
  /** The reason, with the number in it. */
  detail: string;
  safeToday: number;
  safeWeek: number;
  leftUntilMonday: number;
  leftThisWeek: number;
  /** A concrete cheaper version, or null when the amount already fits easily. */
  alternative: { label: string; note: string; price: number; saves: number } | null;
  /** 0-100 share of this week's safe amount the spend would take. */
  fraction: number;
};

const eur = (amount: number) => `€${Math.round(amount)}`;

/**
 * The afford engine behind the Budget section and the Ask demo. Pure
 * arithmetic over the seeded month; the product runs the same shape over the
 * student's own rows.
 */
export function affordCheck(amount: number): AffordCheck {
  const today = safeToday();
  const week = safeThisWeek();
  const untilMonday = safeUntilMonday();
  const goingOutLeft = categoryRemaining("going-out");
  const leftUntilMonday = untilMonday - amount;
  const leftThisWeek = week - amount;
  const fraction = week === 0 ? 100 : Math.min(100, Math.max(0, (amount / week) * 100));

  const alternativePrice = Math.max(0, Math.round(amount * 0.55));
  const alternative =
    amount <= today
      ? null
      : {
          label: "Better option nearby",
          note: "The set menu two streets over, at the student price.",
          price: alternativePrice,
          saves: Math.round(amount - alternativePrice),
        };

  const base = { amount, safeToday: today, safeWeek: week, leftUntilMonday, leftThisWeek, alternative, fraction };

  if (amount <= today) {
    return {
      ...base,
      verdict: "easy",
      headline: "Easily.",
      detail: `It sits inside the ${eur(today)} you can safely spend today, and this week still has ${eur(leftThisWeek)} after it.`,
    };
  }
  if (amount <= untilMonday) {
    return {
      ...base,
      verdict: "yes-but",
      headline: "You can. But",
      detail: `it leaves ${eur(leftUntilMonday)} for going out until Monday.`,
    };
  }
  if (amount <= goingOutLeft) {
    return {
      ...base,
      verdict: "careful",
      headline: "Possible. Not smart.",
      detail: `It fits the month, not the week: the next ${budgetMonth.daysUntilMonday} days become ${eur(0)} days.`,
    };
  }
  return {
    ...base,
    verdict: "no",
    headline: "Not this one.",
    detail: `That is ${eur(amount - goingOutLeft)} more than what is left for going out this month.`,
  };
}
