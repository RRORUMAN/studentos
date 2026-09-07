import "server-only";

import { cache } from "react";

import { confidenceMeta } from "@/domain/knowledge";
import {
  assess,
  claimSubjectMeta,
  isPublishable,
  needsVerification,
  type Claim,
  type TruthAssessment,
} from "@/domain/truth";
import { findMany } from "@/server/db";
import { loadTrustIndex } from "@/server/reputation";

/**
 * ============================================================================
 * LOCAL TRUTH — reads
 * ----------------------------------------------------------------------------
 * Claims, assessed, ready to render.
 *
 * Every surface that shows a student-contributed fact goes through here rather
 * than reading `claims` directly, for one reason: an unassessed claim row is a
 * loaded gun. It has a `statement` field that reads like a fact, and any
 * component that renders it without the verdict from `assess()` will show a
 * student a discount that three people reported dead last week. Returning
 * `ClaimView` — where the statement and its confidence are the same object —
 * makes that mistake awkward to write.
 * ============================================================================
 */

export type ClaimView = {
  claim: Claim;
  assessment: TruthAssessment;
  /** Label and accent for the confidence chip. */
  meta: (typeof confidenceMeta)[keyof typeof confidenceMeta];
  subjectLabel: string;
  /** The prompt shown on the verify button: "Still available?" */
  verifyPrompt: string;
  /** Safe to state as fact. Below this the UI must show the confidence. */
  publishable: boolean;
  /** Worth asking students to re-check. */
  wanted: boolean;
};

async function assessAll(claims: readonly Claim[], citySlug: string): Promise<readonly ClaimView[]> {
  if (claims.length === 0) return [];

  const [verifications, trustOf] = await Promise.all([
    findMany("verifications", (row) => claims.some((c) => c.id === row.claimId)),
    loadTrustIndex(citySlug),
  ]);

  const now = new Date();

  return claims.map((claim) => {
    const assessment = assess(
      claim,
      verifications.filter((v) => v.claimId === claim.id),
      trustOf,
      now,
    );

    return {
      claim,
      assessment,
      meta: confidenceMeta[assessment.confidence],
      subjectLabel: claimSubjectMeta[claim.subject].label,
      verifyPrompt: claimSubjectMeta[claim.subject].verb,
      publishable: isPublishable(assessment),
      wanted: needsVerification(assessment, claim.subject),
    };
  });
}

/**
 * What students know about one place, event or deal.
 *
 * Ordered by confidence then recency, so the row a student reads first is the
 * one the product is most sure of. Superseded and retired rows never appear:
 * they are kept for history, and history is not something to render on a place
 * card.
 */
export const loadClaimsFor = cache(
  async (
    targetKind: NonNullable<Claim["targetKind"]>,
    targetId: string,
    citySlug: string,
  ): Promise<readonly ClaimView[]> => {
    const claims = await findMany(
      "claims",
      (row) =>
        row.targetKind === targetKind &&
        row.targetId === targetId &&
        row.supersededBy === null &&
        row.status !== "retired",
    );

    const views = await assessAll(claims, citySlug);
    return [...views].sort(byConfidenceThenFreshness);
  },
);

/**
 * The verification queue: claims this city most needs someone to check.
 *
 * Ordered by how much damage a wrong answer would do, which is not the same as
 * how old it is. A stale `verified` discount outranks an `unconfirmed` tip,
 * because the product is currently telling students to act on the first one.
 */
export const loadVerificationQueue = cache(
  async (citySlug: string, campusSlug: string | null, limit = 6): Promise<readonly ClaimView[]> => {
    const claims = await findMany(
      "claims",
      (row) =>
        row.citySlug === citySlug &&
        row.supersededBy === null &&
        row.status !== "retired" &&
        (row.campusSlug === null || row.campusSlug === campusSlug),
    );

    const views = await assessAll(claims, citySlug);

    return views
      .filter((view) => view.wanted)
      .sort((a, b) => {
        const weight = (view: ClaimView) =>
          (view.publishable ? 2 : 0) + (view.assessment.confidence === "disputed" ? 3 : 0);
        const byWeight = weight(b) - weight(a);
        return byWeight !== 0 ? byWeight : b.assessment.ageDays - a.assessment.ageDays;
      })
      .slice(0, limit);
  },
);

/**
 * Published claims for a city, for the AI's tool layer and the city graph.
 *
 * Only `publishable` rows come back. The AI must never be handed an
 * unconfirmed claim: given a plausible sentence in its context, a model will
 * repeat it without the hedge, and no amount of prompt instruction reliably
 * prevents that. Filtering at the source is the only version of this that
 * holds.
 */
export const loadPublishedClaims = cache(
  async (citySlug: string): Promise<readonly ClaimView[]> => {
    const claims = await findMany(
      "claims",
      (row) =>
        row.citySlug === citySlug &&
        row.status === "published" &&
        row.supersededBy === null,
    );

    const views = await assessAll(claims, citySlug);
    return views.filter((view) => view.publishable).sort(byConfidenceThenFreshness);
  },
);

/** How much of a city the product actually knows. Admin's coverage read. */
export async function claimCoverage(citySlug: string): Promise<{
  total: number;
  published: number;
  candidates: number;
  disputed: number;
  stale: number;
  needsCheck: number;
}> {
  const claims = await findMany("claims", (row) => row.citySlug === citySlug);
  const views = await assessAll(claims, citySlug);

  return {
    total: views.length,
    published: views.filter((v) => v.publishable).length,
    candidates: views.filter((v) => v.claim.status === "candidate").length,
    disputed: views.filter((v) => v.assessment.confidence === "disputed").length,
    stale: views.filter((v) => v.assessment.stale).length,
    needsCheck: views.filter((v) => v.wanted).length,
  };
}

const confidenceRank: Record<string, number> = {
  verified: 0,
  likely: 1,
  unconfirmed: 2,
  disputed: 3,
  expired: 4,
};

function byConfidenceThenFreshness(a: ClaimView, b: ClaimView): number {
  const rank = confidenceRank[a.assessment.confidence] - confidenceRank[b.assessment.confidence];
  return rank !== 0 ? rank : a.assessment.ageDays - b.assessment.ageDays;
}
