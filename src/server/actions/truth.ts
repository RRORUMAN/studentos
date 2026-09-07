"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { consensusOf } from "@/domain/questions";
import type { ClaimSubject } from "@/domain/truth";
import { findMany, findOne, insert, newId, nowIso, update } from "@/server/db";
import { recordOutcome } from "@/server/actions/insight";
import { limits, rateLimit } from "@/server/rate-limit";
import { award, loadTrustIndex } from "@/server/reputation";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * LOCAL TRUTH — writes
 * ----------------------------------------------------------------------------
 * Contributing a claim, checking one, and promoting an agreed answer.
 *
 * The rule that shapes every function here: nothing in this file can make a
 * claim true. `submitClaim` creates an unverified row, `verifyClaim` records
 * one person's opinion, `promoteConsensus` creates a *candidate*. Whether any
 * of that adds up to something the product will state is decided by `assess()`
 * in `domain/truth.ts`, on read, from the evidence. There is deliberately no
 * write path that sets a confidence — because the moment one exists, some
 * admin tool or import script will use it, and the number stops meaning what
 * the badge says it means.
 * ============================================================================
 */

export type TruthResult = { ok: true } | { ok: false; message: string };

/* -------------------------------------------------------------------------- */
/* Contributing                                                                */
/* -------------------------------------------------------------------------- */

const subjects = [
  "student-offer",
  "price",
  "hours",
  "amenity",
  "access",
  "recurring-event",
  "closure",
  "requirement",
  "tip",
] as const satisfies readonly ClaimSubject[];

const submitSchema = z.object({
  subject: z.enum(subjects),
  statement: z.string().trim().min(6, "Say what you saw.").max(240),
  targetKind: z.enum(["place", "event", "deal", "route", "neighbourhood"]).nullable(),
  targetId: z.string().trim().max(120).nullable(),
  amount: z.number().min(0).max(100_000).nullable(),
});

/**
 * Add something a student knows about their city.
 *
 * The row lands as `published` with zero verifications, which sounds wrong
 * until you read `assess()`: a published claim with no verifications reads
 * `unconfirmed`, and every surface renders that with the confidence attached.
 * `candidate` is reserved for rows the product inferred rather than rows a
 * student typed — the distinction is "did a human assert this", and a student
 * filling in the form did.
 */
export async function submitClaim(input: {
  subject: ClaimSubject;
  statement: string;
  targetKind?: "place" | "event" | "deal" | "route" | "neighbourhood" | null;
  targetId?: string | null;
  amount?: number | null;
}): Promise<{ ok: true; claimId: string } | { ok: false; message: string }> {
  const userId = await requireUserId();

  const parsed = submitSchema.safeParse({
    subject: input.subject,
    statement: input.statement,
    targetKind: input.targetKind ?? null,
    targetId: input.targetId ?? null,
    amount: input.amount ?? null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "That could not be added." };
  }

  const gate = rateLimit(`claim:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "You have added a lot today. Try again later." };

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const id = newId();
  const at = nowIso();

  await insert("claims", {
    id,
    citySlug: profile.citySlug,
    campusSlug: null,
    subject: parsed.data.subject,
    targetKind: parsed.data.targetKind,
    targetId: parsed.data.targetId,
    statement: parsed.data.statement,
    amountCents: parsed.data.amount === null ? null : Math.round(parsed.data.amount * 100),
    sourceType: "student-report",
    sourceUrl: null,
    submittedBy: userId,
    derivedFromQuestionId: null,
    createdAt: at,
    lastSeenAt: at,
    lastVerifiedAt: null,
    supersededBy: null,
    status: "published",
  });

  await recordOutcome("community-contribution", `added a ${parsed.data.subject} claim`);
  revalidateClaimSurfaces(parsed.data.targetKind, parsed.data.targetId);
  return { ok: true, claimId: id };
}

/* -------------------------------------------------------------------------- */
/* Verifying                                                                   */
/* -------------------------------------------------------------------------- */

const verifySchema = z.object({
  claimId: z.string().trim().min(1).max(120),
  verdict: z.enum(["confirmed", "changed", "gone", "wrong"]),
  correction: z.number().min(0).max(100_000).nullable(),
  note: z.string().trim().max(240).nullable(),
});

/**
 * Record one student's check on one claim.
 *
 * Re-verifying replaces that student's previous verdict rather than adding a
 * second row. `assess()` already takes the latest verdict per person, so a
 * duplicate row would change nothing — but it would make the audit trail lie
 * about how many people looked, and Admin reads those counts.
 *
 * Reputation is awarded on the *claim*, not the verification: confirming three
 * different things earns three times; confirming the same thing three times
 * earns once. See the idempotency note in `server/reputation.ts`.
 */
export async function verifyClaim(input: {
  claimId: string;
  verdict: "confirmed" | "changed" | "gone" | "wrong";
  correction?: number | null;
  note?: string | null;
}): Promise<TruthResult> {
  const userId = await requireUserId();

  const parsed = verifySchema.safeParse({
    claimId: input.claimId,
    verdict: input.verdict,
    correction: input.correction ?? null,
    note: input.note ?? null,
  });
  if (!parsed.success) return { ok: false, message: "That could not be recorded." };

  const gate = rateLimit(`verify:${userId}`, limits.report.limit, limits.report.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment and try again." };

  const claim = await findOne("claims", (row) => row.id === parsed.data.claimId);
  if (!claim) return { ok: false, message: "That is no longer listed." };

  /* Rule 3 of the truth layer, enforced at the door as well as in `assess()`.
     Blocking it here means the student gets told why, rather than silently
     filing a report that is then ignored on read. */
  if (claim.submittedBy === userId) {
    return { ok: false, message: "You added this one — someone else needs to confirm it." };
  }

  const existing = await findOne(
    "verifications",
    (row) => row.claimId === claim.id && row.userId === userId,
  );

  const at = nowIso();
  const correctionCents =
    parsed.data.correction === null ? null : Math.round(parsed.data.correction * 100);

  if (existing) {
    await update("verifications", (row) => row.id === existing.id, {
      verdict: parsed.data.verdict,
      correctionCents,
      note: parsed.data.note,
      createdAt: at,
    });
  } else {
    await insert("verifications", {
      id: newId(),
      claimId: claim.id,
      userId,
      verdict: parsed.data.verdict,
      correctionCents,
      note: parsed.data.note,
      createdAt: at,
    });
  }

  await update("claims", (row) => row.id === claim.id, {
    lastSeenAt: at,
    ...(parsed.data.verdict === "confirmed" ? { lastVerifiedAt: at } : {}),
  });

  await award({
    userId,
    citySlug: claim.citySlug,
    signal: "place-confirmed",
    refKind: "claim",
    refId: claim.id,
  });

  /* The student who submitted a claim that others confirm has earned
     something; the one whose claim is reported gone has not lost anything yet,
     because the claim may simply have expired honestly. Only `wrong` — "this
     was never true" — is a mark against the author, and even then only once
     the evidence has settled, which is a job for the sweep, not this action. */
  if (parsed.data.verdict === "confirmed" && claim.submittedBy) {
    await award({
      userId: claim.submittedBy,
      citySlug: claim.citySlug,
      signal: "deal-confirmed",
      refKind: "claim",
      refId: claim.id,
    });
  }

  await recordOutcome("community-contribution", `checked a ${claim.subject} claim`);
  revalidateClaimSurfaces(claim.targetKind, claim.targetId);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Promotion                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Turn agreeing answers on a question into a claim candidate.
 *
 * The row is created as `candidate`, with `sourceType: "student-answer"` and a
 * prior below a direct student report — so even after promotion it takes three
 * independent verifications before the product will state it. That chain is
 * the whole safety argument for the Ask Students loop: an answer becomes a
 * candidate, a candidate becomes a fact only by being checked, and no single
 * step in the chain can skip the next one.
 *
 * Returns null when there is no consensus, which is the common case and is not
 * an error.
 */
export async function promoteConsensus(questionId: string): Promise<{ claimId: string } | null> {
  const question = await findOne("questions", (row) => row.id === questionId);
  if (!question) return null;

  /* Already promoted. */
  const already = await findOne(
    "claims",
    (row) => row.derivedFromQuestionId === questionId,
  );
  if (already) return { claimId: already.id };

  const answers = await findMany("answers", (row) => row.questionId === questionId);
  const trustOf = await loadTrustIndex(question.citySlug);
  const consensus = consensusOf(answers, trustOf);
  if (!consensus) return null;

  const best = consensus.agreeing[0];
  const id = newId();
  const at = nowIso();

  await insert("claims", {
    id,
    citySlug: question.citySlug,
    campusSlug: question.campusSlug,
    subject: question.expectedSubject ?? "tip",
    targetKind: consensus.placeId ? "place" : null,
    targetId: consensus.placeId,
    statement: best.body.slice(0, 200),
    amountCents: consensus.amountCents,
    sourceType: "student-answer",
    sourceUrl: null,
    /* No single author: this came from several students agreeing, and naming
       one of them as the submitter would both misattribute it and wrongly bar
       that student from verifying it later. */
    submittedBy: null,
    derivedFromQuestionId: questionId,
    createdAt: at,
    lastSeenAt: at,
    lastVerifiedAt: null,
    supersededBy: null,
    status: "candidate",
  });

  return { claimId: id };
}

function revalidateClaimSurfaces(
  targetKind: string | null,
  targetId: string | null,
): void {
  revalidatePath("/discover");
  revalidatePath("/home");
  if (targetKind === "place" && targetId) revalidatePath(`/discover/${targetId}`);
  if (targetKind === "event" && targetId) revalidatePath(`/events/${targetId}`);
}
