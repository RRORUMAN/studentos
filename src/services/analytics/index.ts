import { env } from "@/services/env";

/**
 * ============================================================================
 * ANALYTICS
 * ----------------------------------------------------------------------------
 * A closed event vocabulary. Free-text event names rot within a month, so
 * every call site picks from `AnalyticsEvent` and the compiler enforces it.
 *
 * With no PostHog key configured this is a no-op in production and a console
 * trace in development, which is exactly what the marketing build wants.
 * ============================================================================
 */

export type AnalyticsEvent =
  | "cta_clicked"
  | "hero_query_run"
  /* The live demo. Together these say which of the three controls a visitor
     actually reached for, which is the question the section exists to answer. */
  | "demo_city_changed"
  | "demo_intent_changed"
  | "demo_budget_changed"
  | "demo_tab_changed"
  | "coverage_region_changed"
  | "plan_saved"
  | "plan_shared"
  | "plan_copied"
  | "invite_responded"
  | "pulse_voted"
  | "pulse_filter_changed"
  | "map_layer_toggled"
  | "place_opened"
  | "budget_scenario_changed"
  /* Survival Mode. The amount and the horizon are tracked separately because
     they answer different questions: how much money students are actually
     working with, and how far ahead they are trying to make it stretch. */
  | "survival_amount_changed"
  | "survival_horizon_changed"
  | "survival_plan_copied"
  | "arrival_task_toggled"
  | "pricing_period_changed"
  | "pricing_plan_selected"
  | "waitlist_submitted"
  | "onboarding_step_completed"
  | "onboarding_completed";

type Properties = Record<string, string | number | boolean | null | undefined>;

type PostHogLike = {
  capture: (event: string, properties?: Properties) => void;
};

declare global {
  interface Window {
    posthog?: PostHogLike;
  }
}

/** Fire and forget. Analytics must never be able to break an interaction. */
export function track(event: AnalyticsEvent, properties?: Properties): void {
  try {
    if (typeof window === "undefined") return;

    if (env.posthog.key && window.posthog) {
      window.posthog.capture(event, properties);
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.debug(`[analytics] ${event}`, properties ?? {});
    }
  } catch {
    // Swallowed on purpose.
  }
}
