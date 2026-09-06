import type { LifeStage } from "@/domain/lifecycle";
import type { Cents } from "@/domain/types";

/**
 * ============================================================================
 * QUICK ACTIONS
 * ----------------------------------------------------------------------------
 * Four to six contextual shortcuts under the daily summary. Each is either a
 * question for Ask or a destination, chosen from who this student is right now:
 * a new arrival gets "Help me settle in", a tight week gets "Make €40 last", a
 * social student on a Friday gets "Find something tonight".
 *
 * Deterministic — no model, no randomness — so two students in the same
 * situation see the same product and nothing hydrates as a mismatch.
 * ============================================================================
 */

export type QuickAction = {
  key: string;
  label: string;
  /** Either an Ask query or an in-app destination. */
  href: string;
  icon: "free" | "tonight" | "food" | "weekend" | "people" | "study" | "settle" | "stretch" | "afford" | "shop";
};

export type QuickActionContext = {
  stage: LifeStage;
  safeTodayCents: Cents | null;
  hasBudget: boolean;
  /** Spending faster than the month can absorb. */
  overPace: boolean;
  social: boolean;
  /** Local day 0-6, 0 = Sunday. */
  day: number;
  hour: number;
  currencySymbol: string;
  /** Interest tags, to bias towards study or sport. */
  interests: readonly string[];
  hasCampus: boolean;
};

function round(cents: Cents): number {
  const units = cents / 100;
  if (units >= 50) return Math.floor(units / 10) * 10;
  if (units >= 20) return Math.floor(units / 5) * 5;
  return Math.max(5, Math.floor(units));
}

const ask = (query: string) => `/ask?q=${encodeURIComponent(query)}`;

export function quickActions(context: QuickActionContext): QuickAction[] {
  const out: QuickAction[] = [];
  const sym = context.currencySymbol;
  const weekendish = context.day === 5 || context.day === 6 || context.day === 0;
  const evening = context.hour >= 16;
  const arriving =
    context.stage === "before-arrival" ||
    context.stage === "first-24h" ||
    context.stage === "first-week";

  /* New student: settling in comes first. */
  if (arriving) {
    out.push({ key: "settle", label: "Help me settle in", href: "/arrival", icon: "settle" });
    out.push({ key: "shop", label: "Where should I buy groceries?", href: ask("Where should I buy groceries?"), icon: "shop" });
  }

  /* Money pressure: stretch, before anything that costs money. */
  if (context.hasBudget && context.safeTodayCents !== null) {
    if (context.overPace || context.safeTodayCents < 1500) {
      const amount = Math.max(10, round(Math.max(context.safeTodayCents, 1000) * 3));
      out.push({
        key: "stretch",
        label: `Make ${sym}${amount} last`,
        href: `/budget/survival?amount=${amount}&days=4`,
        icon: "stretch",
      });
    }
    out.push({ key: "afford", label: "Can I afford this?", href: "/budget/afford", icon: "afford" });
  }

  /* Free is always worth offering. */
  out.push({ key: "free", label: "Find something free", href: "/events?tab=free", icon: "free" });

  /* Tonight or the weekend. */
  if (weekendish && !evening) {
    out.push({ key: "weekend", label: "Plan my weekend", href: "/plans/week", icon: "weekend" });
  } else if (context.hasBudget && context.safeTodayCents && context.safeTodayCents >= 1500) {
    out.push({
      key: "tonight",
      label: `Tonight under ${sym}${round(context.safeTodayCents)}`,
      href: ask(`What can I do tonight for ${sym}${round(context.safeTodayCents)}?`),
      icon: "tonight",
    });
  } else {
    out.push({ key: "tonight", label: "What's on tonight?", href: "/events?tab=tonight", icon: "tonight" });
  }

  out.push({ key: "food", label: "Cheap food near me", href: "/discover?tab=food", icon: "food" });

  if (context.social) {
    out.push({
      key: "people",
      label: weekendish || evening ? "Find something social" : "Find people",
      href: "/anyone-down",
      icon: "people",
    });
  }

  if (context.interests.includes("study-groups") || context.hasCampus) {
    out.push({ key: "study", label: "Where should I study?", href: "/discover?tab=study", icon: "study" });
  }

  if (!weekendish) {
    out.push({ key: "week", label: "Plan my week", href: "/plans/week", icon: "weekend" });
  }

  /* De-duplicate by key, cap at six. */
  const seen = new Set<string>();
  return out.filter((action) => (seen.has(action.key) ? false : (seen.add(action.key), true))).slice(0, 6);
}
