/**
 * Seeded budget month used by the Budget section and the "can I afford it"
 * answers. Every headline number in the UI is derived from these rows, so the
 * demo stays internally consistent if a value changes.
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
  /** Rent is tracked separately so it never distorts the daily number. */
  rentPaid: true,
  categories: [
    { key: "food", label: "Food and groceries", planned: 260, spent: 152, accent: "mint" },
    { key: "going-out", label: "Going out", planned: 140, spent: 73, accent: "pulse" },
    { key: "transport", label: "Transport", planned: 40, spent: 20, accent: "flow" },
    { key: "course", label: "Course and supplies", planned: 60, spent: 12, accent: "signal" },
    { key: "everything-else", label: "Everything else", planned: 180, spent: 40, accent: "amber" },
  ] satisfies BudgetCategory[],
  upcoming: [
    { label: "Phone plan", amount: 11, inDays: 4 },
    { label: "Gym", amount: 22, inDays: 9 },
  ] satisfies UpcomingCharge[],
  /** What a normal week should cost at this plan. */
  weeklyTarget: 130,
  /** What this week has actually cost so far. */
  weekSoFar: 109,
} as const;

export function budgetPlanned(): number {
  return budgetMonth.categories.reduce((total, category) => total + category.planned, 0);
}

export function budgetSpent(): number {
  return budgetMonth.categories.reduce((total, category) => total + category.spent, 0);
}

/** The headline number: what is genuinely left this month. */
export function budgetRemaining(): number {
  return budgetPlanned() - budgetSpent();
}

export function upcomingTotal(): number {
  return budgetMonth.upcoming.reduce((total, charge) => total + charge.amount, 0);
}

/**
 * "Safe today" is the number students actually need. It is the remaining
 * balance minus known upcoming charges, spread evenly across the days left —
 * rounded down to ten cents so it is never optimistic.
 */
export function safeToday(): number {
  const spendable = budgetRemaining() - upcomingTotal();
  return Math.floor((spendable / budgetMonth.daysLeft) * 10) / 10;
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

/** The plan the Budget section checks against. Deliberately not the hero plan. */
export const tonightPlanCost = 16;
