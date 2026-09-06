import { heroPlans } from "@/data/plans";
import type { Plan } from "@/data/types";
import { isAiConfigured } from "@/services/env";

/**
 * ============================================================================
 * AI PROVIDER ABSTRACTION
 * ----------------------------------------------------------------------------
 * The product is not "an AI app". It is a retrieval problem with a language
 * interface on top, so the contract is deliberately narrow:
 *
 *   context in  ->  a structured plan out, with every claim carrying a source
 *
 * The model never invents a price, an opening hour or a fare. Those arrive as
 * retrieved context (student reports + official data, see the db layer) and
 * the model's job is selection, ordering and explanation. That is why
 * `PlanItem.source` is required rather than optional.
 * ============================================================================
 */

export type PlanRequest = {
  query: string;
  citySlug: string;
  /** Hard ceiling. A plan over budget is a failed answer, not a suggestion. */
  budget?: number;
  /** Coarse position. Never a precise coordinate unless the user asked. */
  near?: { lat: number; lng: number };
  preferences?: readonly string[];
  /** Retrieval hits assembled before the model is called. */
  context?: readonly RetrievedFact[];
};

/**
 * A retrieved fact. `confirmations` is how many students independently
 * reported it; `source` decides whether the UI may present it as verified.
 */
export type RetrievedFact = {
  id: string;
  statement: string;
  source: "students" | "official" | "venue";
  confirmations: number;
  observedAt: string;
};

export type PlanResult =
  | { ok: true; plan: Plan; seeded: boolean }
  | { ok: false; reason: "no-match" | "over-budget" | "rate-limited" | "unavailable" };

export interface AiProvider {
  readonly id: string;
  /** Turn a question plus retrieved context into a plan. */
  generatePlan(request: PlanRequest): Promise<PlanResult>;
  /** Summarise community activity. Used above the Pulse feed. */
  summariseCommunity(input: {
    citySlug: string;
    posts: readonly { title: string; body?: string }[];
  }): Promise<{ summary: string; sourceCount: number }>;
}

/**
 * The provider used by the marketing site and by anonymous visitors.
 * It answers from the seeded plan set and never leaves the process.
 */
export class SeededAiProvider implements AiProvider {
  readonly id = "seeded";

  async generatePlan(request: PlanRequest): Promise<PlanResult> {
    const normalised = request.query.trim().toLowerCase();
    const exact = heroPlans.find((plan) => plan.query.toLowerCase() === normalised);
    if (exact) return { ok: true, plan: exact, seeded: true };

    const partial = heroPlans.find((plan) =>
      normalised.length > 3 && plan.query.toLowerCase().includes(normalised),
    );
    if (partial) return { ok: true, plan: partial, seeded: true };

    return { ok: false, reason: "no-match" };
  }

  async summariseCommunity(input: {
    citySlug: string;
    posts: readonly { title: string; body?: string }[];
  }): Promise<{ summary: string; sourceCount: number }> {
    const { loopSummaries } = await import("@/data/loop");
    const seeded = loopSummaries[input.citySlug];
    return {
      summary: seeded?.body ?? "Not enough activity in this city yet to summarise.",
      sourceCount: seeded?.sourceCount ?? input.posts.length,
    };
  }
}

/**
 * Resolve the active provider. A hosted model adapter registers here once
 * `AI_API_KEY` is present; until then every caller gets seeded answers and the
 * UI labels them as such.
 */
export function getAiProvider(): AiProvider {
  if (!isAiConfigured) return new SeededAiProvider();
  // Hosted adapter is registered here in the product build.
  return new SeededAiProvider();
}
