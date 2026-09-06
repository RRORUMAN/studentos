import type { LifeStage } from "@/domain/lifecycle";
import type { Cents } from "@/domain/types";

/**
 * ============================================================================
 * ASK SUGGESTIONS
 * ----------------------------------------------------------------------------
 * The prompts under the Ask bar, chosen from the student's actual situation.
 *
 * Every suggestion here is a question this product can answer *well, right
 * now*, with the data it holds. That constraint is the whole design: the
 * fastest way to kill an AI feature is to invite a question it will fumble, and
 * a student whose first two asks return nothing useful never asks a third.
 *
 * Deterministic — no model, no randomness. Randomised suggestions also break
 * hydration and mean two students in identical situations see different
 * products for no reason.
 * ============================================================================
 */

export type SuggestionContext = {
  stage: LifeStage;
  /** Money genuinely free today. Drives whether spending prompts appear. */
  safeTodayCents: Cents | null;
  currencySymbol: string;
  hasBudget: boolean;
  /** Local day, 0 = Sunday. */
  day: number;
  hour: number;
  /** Suppresses every social prompt when the student asked to be left alone. */
  social: boolean;
  cityName: string;
  hasCampus: boolean;
};

/** Rounded down to something a student would say out loud. */
function roundMoney(cents: Cents): number {
  const units = cents / 100;
  if (units >= 50) return Math.floor(units / 10) * 10;
  if (units >= 20) return Math.floor(units / 5) * 5;
  return Math.max(5, Math.floor(units));
}

export function askSuggestions(context: SuggestionContext): string[] {
  const { currencySymbol: sym } = context;
  const out: string[] = [];

  const isEvening = context.hour >= 16;
  const isWeekendish = context.day === 5 || context.day === 6 || context.day === 0;
  const budget = context.safeTodayCents;

  /* ---- pre-arrival: nothing about tonight, everything about setup -------- */
  if (context.stage === "before-arrival") {
    out.push(
      "What should I sort before I arrive?",
      `What does a first month in ${context.cityName} cost?`,
      "What do I need in the first week?",
    );
    if (context.hasCampus) out.push("What is happening on my campus?");
    return out.slice(0, 5);
  }

  /* ---- leaving: the list, not the nightlife ------------------------------ */
  if (context.stage === "leaving") {
    out.push(
      "What do I need to cancel before I go?",
      "Help me sell what I cannot take",
      "What have I not done in this city?",
    );
    if (context.social) out.push("Plan a last weekend");
    return out.slice(0, 5);
  }

  /* ---- first days and weeks --------------------------------------------- */
  if (context.stage === "first-24h" || context.stage === "first-week") {
    out.push(
      "Where should I buy groceries?",
      "What should I do this week?",
      "Find me a cheap lunch near campus",
    );
    if (context.social) out.push("Where can I meet people?");
    out.push("How does transport work here?");
    return out.slice(0, 5);
  }

  /* ---- the settled cases ------------------------------------------------- */

  /* Money first when it is tight — that is the question they came with. */
  if (budget !== null && budget < 1500 && context.hasBudget) {
    out.push(`What can I do for ${sym}0 today?`);
    out.push(`Make ${sym}${roundMoney(budget)} last until Monday`);
  } else if (budget !== null && context.hasBudget) {
    out.push(`What can I do tonight for ${sym}${roundMoney(budget)}?`);
  } else {
    out.push("What is free tonight?");
  }

  if (isWeekendish) out.push("Plan Saturday");
  else if (isEvening) out.push("What is on tonight?");
  else out.push("Somewhere cheap for lunch");

  if (context.social) {
    out.push(isWeekendish ? "Find something social this weekend" : "Who is doing something?");
  }

  out.push("Where should I shop this week?");
  if (context.hasCampus) out.push("What is happening near campus?");

  return out.slice(0, 5);
}

/* -------------------------------------------------------------------------- */
/* Greeting                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Time-of-day greeting.
 *
 * Cut off at 05:00 rather than midnight: a student seeing "Good morning" at
 * 02:00 on a Saturday is a small thing that says the product does not
 * understand who it is for.
 */
export function greeting(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
