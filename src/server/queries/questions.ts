import "server-only";

import { cache } from "react";

import { intentLabel } from "@/domain/insight";
import {
  answerRelevance,
  audienceLabel,
  consensusOf,
  type Answer,
  type Question,
  type QuestionAudience,
} from "@/domain/questions";
import { trustIndex, type ReputationEvent } from "@/domain/reputation";
import type { Profile } from "@/domain/types";
import { findMany, findOne } from "@/server/db";
import { requestDate } from "@/server/now";

/**
 * ============================================================================
 * ASK STUDENTS — reads
 * ----------------------------------------------------------------------------
 * Who can see which question, and which question is worth putting in front of
 * this particular student.
 *
 * Visibility lives here rather than in `actions/` for the reason set out at the
 * top of `queries/social.ts`: a `"use server"` module exports every async
 * function as a callable endpoint, so an exported predicate that answers "can
 * X see Y?" is a public oracle. Both the list and the write path import the
 * same `visibleTo` from here, which is what stops the feed and the reply
 * endpoint from disagreeing about who is in the audience.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Visibility                                                                  */
/* -------------------------------------------------------------------------- */

export type Audience = {
  citySlug: string;
  campusSlug: string | null;
  communityIds: readonly string[];
};

export function audienceOf(profile: Profile, communityIds: readonly string[]): Audience {
  return { citySlug: profile.citySlug, campusSlug: profile.campusSlug, communityIds };
}

/**
 * Can this student see this question?
 *
 * A campus question that has been escalated is visible city-wide as well as to
 * the campus it started on — escalation widens the audience, it does not move
 * it, so the people most likely to know never lose sight of it.
 */
export function visibleTo(question: Question, audience: Audience): boolean {
  if (question.citySlug !== audience.citySlug) return false;

  switch (question.audience) {
    case "campus":
      if (question.campusSlug && question.campusSlug === audience.campusSlug) return true;
      return question.escalatedAt !== null;
    case "community":
      return question.communityId !== null && audience.communityIds.includes(question.communityId);
    case "city":
      return true;
  }
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

/** An answer with its age resolved server-side, so no component formats a date. */
export type AnswerView = Answer & { minutesAgo: number };

export type QuestionView = {
  question: Question;
  answers: readonly AnswerView[];
  askedMinutesAgo: number;
  answerCount: number;
  /** Set once enough answers agree. Drives the "promote to a claim" path. */
  consensusVoices: number;
  audienceLabel: string;
  intentLabel: string;
  /** True when the signed-in student asked it. */
  mine: boolean;
};

export const loadQuestion = cache(
  async (questionId: string, viewerId: string | null): Promise<QuestionView | null> => {
    const question = await findOne("questions", (row) => row.id === questionId);
    if (!question) return null;

    const answers = await findMany("answers", (row) => row.questionId === questionId);
    return toView(question, answers, viewerId, []);
  },
);

/** Every question this student asked, newest first. */
export const loadMyQuestions = cache(async (userId: string): Promise<readonly QuestionView[]> => {
  const questions = await findMany("questions", (row) => row.askerId === userId);
  const answers = await findMany("answers", (row) =>
    questions.some((q) => q.id === row.questionId),
  );

  return questions
    .map((q) => toView(q, answers.filter((a) => a.questionId === q.id), userId, []))
    .sort((a, b) => b.question.createdAt.localeCompare(a.question.createdAt));
});

/**
 * The questions to put in front of this student, best first.
 *
 * Ranked by `answerRelevance` rather than filtered by it: everyone in the
 * audience *may* answer, but a help feed that shows a random open question is
 * a chore, and a chore gets ignored. Unanswered questions on the student's own
 * campus come first because those are the ones only they can close.
 */
export const loadAnswerable = cache(
  async (userId: string, audience: Audience, limit = 8): Promise<readonly QuestionView[]> => {
    /* `!== "closed"`, not `=== "open"`. A question flips to "answered" on its
       first reply, and excluding those would hide exactly the questions where a
       second, better answer is worth having — and where the asker is still
       waiting because the first answer did not actually help. Only a closed
       question is finished. */
    const open = await findMany(
      "questions",
      (row) => row.status !== "closed" && row.askerId !== userId && row.citySlug === audience.citySlug,
    );

    const visible = open.filter((q) => visibleTo(q, audience));
    if (visible.length === 0) return [];

    const answers = await findMany("answers", (row) =>
      visible.some((q) => q.id === row.questionId),
    );

    /* Questions this student has already answered are done, not pending. */
    const answered = new Set(
      answers.filter((a) => a.userId === userId).map((a) => a.questionId),
    );

    /* What this student has shown they know about: the intents of questions
       they have answered before. Cheap, and a much better signal than
       interests they picked in onboarding. */
    const knownIntents = [
      ...new Set(
        visible
          .filter((q) => answered.has(q.id))
          .map((q) => q.intent),
      ),
    ];

    const now = new Date();

    return visible
      .filter((q) => !answered.has(q.id))
      .map((question) => {
        const own = answers.filter((a) => a.questionId === question.id);
        return {
          view: toView(question, own, userId, []),
          score: answerRelevance(
            question,
            { campusSlug: audience.campusSlug, knownIntents, familiarPlaceIds: [] },
            own.length,
            now,
          ),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((row) => row.view);
  },
);

/**
 * Open questions with enough agreement to become a Claim candidate.
 *
 * Read by the extraction job and by Admin. Deliberately a read rather than a
 * trigger on answer insert: promotion is a decision about a whole question,
 * and recomputing it when the last answer lands would mean the *order* answers
 * arrived in could change whether a claim gets created.
 */
export async function loadPromotable(citySlug: string): Promise<
  readonly { question: Question; voices: number; placeId: string | null; amountCents: number | null }[]
> {
  const questions = await findMany(
    "questions",
    (row) => row.citySlug === citySlug && row.status !== "closed",
  );
  if (questions.length === 0) return [];

  const [answers, reputationEvents] = await Promise.all([
    findMany("answers", (row) => questions.some((q) => q.id === row.questionId)),
    /* Every city, not just this one: cross-city carry needs the other rows.
       See the note on `loadTrustIndex` in `server/reputation.ts`. */
    findMany("reputationEvents", () => true),
  ]);

  const trustOf = trustIndex(reputationEvents, citySlug);

  return questions
    .map((question) => {
      const consensus = consensusOf(
        answers.filter((a) => a.questionId === question.id),
        trustOf,
      );
      return consensus
        ? {
            question,
            voices: consensus.voices,
            placeId: consensus.placeId,
            amountCents: consensus.amountCents,
            strength: consensus.strength,
          }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.strength - a.strength)
    .map((row) => ({
      question: row.question,
      voices: row.voices,
      placeId: row.placeId,
      amountCents: row.amountCents,
    }));
}

/** How many open questions this student is in the audience for. Nav badge. */
export const countAnswerable = cache(
  async (userId: string, audience: Audience): Promise<number> => {
    const rows = await loadAnswerable(userId, audience, 50);
    return rows.length;
  },
);

/* -------------------------------------------------------------------------- */
/* Shaping                                                                     */
/* -------------------------------------------------------------------------- */

function toView(
  question: Question,
  answers: readonly Answer[],
  viewerId: string | null,
  reputationEvents: readonly ReputationEvent[],
): QuestionView {
  /* `requestDate` rather than `new Date()`: one clock per request means two
     rows rendered in the same response cannot disagree about what "2h ago"
     means, and the e2e suite can pin it. */
  const now = requestDate().getTime();
  const minutesSince = (at: string) => Math.max(0, (now - Date.parse(at)) / 60_000);

  const ordered = [...answers].sort((a, b) => {
    /* The accepted answer first, then the asker's endorsements, then by
       usefulness. Recency last: on a question about where to print, the right
       answer does not get worse with age. */
    if (question.acceptedAnswerId === a.id) return -1;
    if (question.acceptedAnswerId === b.id) return 1;
    if (a.markedUsefulByAsker !== b.markedUsefulByAsker) return a.markedUsefulByAsker ? -1 : 1;
    if (a.usefulCount !== b.usefulCount) return b.usefulCount - a.usefulCount;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const consensus = consensusOf(
    answers,
    trustIndex(reputationEvents, question.citySlug),
  );

  return {
    question,
    answers: ordered.map((answer) => ({ ...answer, minutesAgo: minutesSince(answer.createdAt) })),
    askedMinutesAgo: minutesSince(question.createdAt),
    answerCount: answers.length,
    consensusVoices: consensus?.voices ?? 0,
    audienceLabel: audienceLabel[question.audience as QuestionAudience],
    intentLabel: intentLabel(question.intent),
    mine: viewerId !== null && question.askerId === viewerId,
  };
}
