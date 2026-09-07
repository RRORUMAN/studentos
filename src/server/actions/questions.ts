"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { classifyIntent } from "@/domain/insight";
import {
  routeQuestion,
  shouldClose,
  shouldEscalate,
  type ClaimSubjectHint,
} from "@/domain/questions";
import { findMany, findOne, insert, newId, nowIso, update } from "@/server/db";
import { recordOutcome } from "@/server/actions/insight";
import { notify } from "@/server/notify";
import { limits, rateLimit } from "@/server/rate-limit";
import { award } from "@/server/reputation";
import { audienceOf, visibleTo } from "@/server/queries/questions";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * ASK STUDENTS — writes
 * ----------------------------------------------------------------------------
 * Asking, answering, and marking an answer useful.
 *
 * Ask Students is free on every tier and always will be. It is the loop that
 * makes the knowledge base grow (see `domain/questions.ts`), and metering the
 * thing that produces your moat to sell a few subscriptions is the trade that
 * kills community products. What is paid is the *intelligence layered on top* —
 * see `config/entitlements.ts` — never the contribution itself.
 *
 * Every write here is rate-limited on the `post` bucket rather than a bespoke
 * one: a question and a Pulse post are the same kind of act from an abuse
 * point of view, and one shared budget means somebody cannot bypass the post
 * limit by asking twenty questions instead.
 * ============================================================================
 */

export type AskResult =
  | { ok: true; questionId: string }
  | { ok: false; message: string };

export type AnswerResult = { ok: true } | { ok: false; message: string };

const askSchema = z.object({
  title: z.string().trim().min(8, "Say a bit more than that.").max(180),
  detail: z.string().trim().max(600).nullable(),
  originQuery: z.string().trim().max(300).nullable(),
});

/**
 * Turn a question into a routed, answerable row.
 *
 * The `originQuery` is what makes this more than a forum post: when Ask could
 * not answer confidently, the query that failed is carried onto the question,
 * so when a student answers it the product can tell the original asker "you
 * asked this three days ago — here's the answer" and can attach the resolution
 * to the miss that produced it.
 */
export async function askStudents(input: {
  title: string;
  detail?: string | null;
  originQuery?: string | null;
}): Promise<AskResult> {
  const userId = await requireUserId();

  const parsed = askSchema.safeParse({
    title: input.title,
    detail: input.detail ?? null,
    originQuery: input.originQuery ?? null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "That question needs more detail." };
  }

  const gate = rateLimit(`ask-students:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "You have asked a lot today. Try again later." };

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  /* Don't let a student open the same question twice. Two identical open
     questions split the answers and both look unanswered. */
  const duplicate = await findOne(
    "questions",
    (row) =>
      row.askerId === userId &&
      row.status === "open" &&
      row.title.toLowerCase() === parsed.data.title.toLowerCase(),
  );
  if (duplicate) return { ok: true, questionId: duplicate.id };

  const intent = classifyIntent(parsed.data.title);
  const audience = routeQuestion(intent, profile.campusSlug !== null);
  const id = newId();

  await insert("questions", {
    id,
    askerId: userId,
    citySlug: profile.citySlug,
    campusSlug: profile.campusSlug,
    audience,
    communityId: null,
    intent,
    title: parsed.data.title,
    detail: parsed.data.detail,
    originQuery: parsed.data.originQuery,
    expectedSubject: subjectHintFor(parsed.data.title),
    status: "open",
    acceptedAnswerId: null,
    escalatedAt: null,
    createdAt: nowIso(),
    closedAt: null,
  });

  revalidatePath("/ask/questions");
  revalidatePath("/pulse");
  return { ok: true, questionId: id };
}

const answerSchema = z.object({
  questionId: z.string().trim().min(1).max(120),
  body: z.string().trim().min(3, "Add a little more.").max(1200),
  placeId: z.string().trim().max(120).nullable(),
  /** Whole units as typed by the student. Converted to cents below. */
  amount: z.number().min(0).max(100_000).nullable(),
});

/**
 * Answer somebody's question.
 *
 * Notifying the asker is not optional and is not batched. The entire promise of
 * Ask Students is "somebody will tell you"; an answer that lands silently is
 * the product failing at the one thing it undertook to do. It uses the
 * `answers` topic, which `deliveryFor` defaults on — see `domain/types.ts`.
 */
export async function postAnswer(input: {
  questionId: string;
  body: string;
  placeId?: string | null;
  amount?: number | null;
}): Promise<AnswerResult> {
  const userId = await requireUserId();

  const parsed = answerSchema.safeParse({
    questionId: input.questionId,
    body: input.body,
    placeId: input.placeId ?? null,
    amount: input.amount ?? null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "That answer could not be posted." };
  }

  const gate = rateLimit(`answer:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment and try again." };

  const question = await findOne("questions", (row) => row.id === parsed.data.questionId);
  if (!question) return { ok: false, message: "That question is no longer open." };
  if (question.status === "closed") return { ok: false, message: "That question is closed." };
  if (question.askerId === userId) return { ok: false, message: "You asked this one." };

  /* The audience check. Same predicate the feed uses, imported rather than
     re-expressed — see the note at the top of `queries/questions.ts`. */
  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };
  if (!visibleTo(question, audienceOf(profile, []))) {
    return { ok: false, message: "That question was not asked in your city." };
  }

  const already = await findOne(
    "answers",
    (row) => row.questionId === question.id && row.userId === userId,
  );
  if (already) return { ok: false, message: "You have already answered this." };

  await insert("answers", {
    id: newId(),
    questionId: question.id,
    userId,
    body: parsed.data.body,
    placeId: parsed.data.placeId,
    amountCents: parsed.data.amount === null ? null : Math.round(parsed.data.amount * 100),
    usefulCount: 0,
    markedUsefulByAsker: false,
    createdAt: nowIso(),
  });

  if (question.status === "open") {
    await update("questions", (row) => row.id === question.id, { status: "answered" });
  }

  await notify({
    userId: question.askerId,
    topic: "answers",
    title: "A student answered your question",
    body: question.title,
    href: `/ask/questions/${question.id}`,
    key: `answer:${question.id}`,
    /* Four hours, not a day: on a busy question the asker should hear about
       the second answer, just not about all six. */
    withinHours: 4,
  });

  await recordOutcome("community-contribution", "answered a question");

  revalidatePath(`/ask/questions/${question.id}`);
  revalidatePath("/ask/questions");
  return { ok: true };
}

/**
 * Mark an answer useful.
 *
 * The asker's verdict and a bystander's upvote are stored as different things
 * (`markedUsefulByAsker` vs `usefulCount`) because they mean different things:
 * one is "this solved my problem", the other is "this looks right to me". The
 * consensus function in `domain/questions.ts` weights them accordingly, and
 * collapsing them into one counter would throw that away.
 */
export async function markAnswerUseful(answerId: string): Promise<AnswerResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`useful:${userId}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment and try again." };

  const answer = await findOne("answers", (row) => row.id === answerId);
  if (!answer) return { ok: false, message: "That answer is gone." };
  if (answer.userId === userId) return { ok: false, message: "You wrote that one." };

  const question = await findOne("questions", (row) => row.id === answer.questionId);
  if (!question) return { ok: false, message: "That question is gone." };

  const isAsker = question.askerId === userId;

  await update("answers", (row) => row.id === answerId, {
    usefulCount: answer.usefulCount + 1,
    markedUsefulByAsker: answer.markedUsefulByAsker || isAsker,
  });

  /* Only the asker's verdict earns reputation. An upvote from a passer-by is
     a signal for ordering; it is not evidence the answer was right, and
     paying reputation for it would make reputation measure popularity. */
  if (isAsker) {
    await update("questions", (row) => row.id === question.id, {
      acceptedAnswerId: answer.id,
      status: "answered",
    });

    await award({
      userId: answer.userId,
      citySlug: question.citySlug,
      signal: "answer-accepted",
      refKind: "answer",
      refId: answer.id,
    });

    await notify({
      userId: answer.userId,
      topic: "answers",
      title: "Your answer helped",
      body: question.title,
      href: `/ask/questions/${question.id}`,
      key: `accepted:${answer.id}`,
    });
  }

  revalidatePath(`/ask/questions/${question.id}`);
  return { ok: true };
}

/**
 * Escalate and close the questions that have waited too long.
 *
 * Called from the same daily pass that computes the brief rather than on a
 * timer of its own. Two reasons: this product has no worker process, and a
 * question widening is a change a student should see the next time they open
 * the app rather than at 3am.
 */
export async function sweepQuestions(citySlug: string): Promise<{ escalated: number; closed: number }> {
  const open = await findMany(
    "questions",
    (row) => row.citySlug === citySlug && row.status === "open",
  );
  if (open.length === 0) return { escalated: 0, closed: 0 };

  const answers = await findMany("answers", (row) => open.some((q) => q.id === row.questionId));
  const countFor = (id: string) => answers.filter((a) => a.questionId === id).length;

  const now = new Date();
  let escalated = 0;
  let closed = 0;

  for (const question of open) {
    if (shouldEscalate(question, countFor(question.id), now)) {
      await update("questions", (row) => row.id === question.id, {
        audience: "city",
        escalatedAt: nowIso(),
      });
      escalated += 1;
      continue;
    }

    if (shouldClose(question, countFor(question.id), now)) {
      await update("questions", (row) => row.id === question.id, {
        status: "closed",
        closedAt: nowIso(),
      });
      closed += 1;
    }
  }

  return { escalated, closed };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Guess what kind of claim a good answer would produce.
 *
 * Keyword matching, not a model call. A wrong guess here costs nothing — it
 * only decides whether the answer form offers a price field — and paying for
 * an inference on every question asked would be absurd for that.
 */
function subjectHintFor(title: string): ClaimSubjectHint {
  const text = title.toLowerCase();
  if (/(cost|price|cheap|how much|€|\$|£)/.test(text)) return "price";
  if (/(discount|student deal|off with|student price)/.test(text)) return "student-offer";
  if (/(open|close|hours|until what time)/.test(text)) return "hours";
  if (/(free|get in|entry)/.test(text)) return "access";
  if (/(need|require|bring|documents?)/.test(text)) return "requirement";
  return null;
}
