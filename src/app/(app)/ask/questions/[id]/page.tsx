import { ArrowLeft, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnswerForm, UsefulButton } from "@/components/app/ask-students";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { audienceOf, loadQuestion, visibleTo } from "@/server/queries/questions";
import { requireViewer } from "@/server/viewer";
import { ago, currencySymbol, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Question",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * ONE QUESTION
 * ----------------------------------------------------------------------------
 * The answers, the box to add one, and — when the asker has marked one as
 * helpful — a visible accepted answer.
 *
 * The consensus line at the bottom is shown only to the asker, and only once
 * two students agree. It is the product telling somebody their question made
 * the app better for the next person, which is the only reward this loop pays
 * and, in a community product, the one that works.
 * ============================================================================
 */

export default async function QuestionPage(props: PageProps<"/ask/questions/[id]">) {
  const viewer = await requireViewer();
  const { id } = await props.params;

  const view = await loadQuestion(id, viewer.user.id);
  if (!view) notFound();

  const { question, answers, mine, intentLabel, consensusVoices, askedMinutesAgo } = view;

  /* The same predicate the feed and the write action use. A question asked in
     another city is a 404 here, not a redirect: there is nothing to show and
     nothing this student can do about it. */
  if (!mine && !visibleTo(question, audienceOf(viewer.profile, []))) notFound();

  const symbol = currencySymbol(viewer.currency.currency, viewer.currency.locale);
  const alreadyAnswered = answers.some((answer) => answer.userId === viewer.user.id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <Link
        href="/ask/questions"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Ask students
      </Link>

      <header className="space-y-2">
        <h1 className="text-h3 font-semibold text-ink-950">{question.title}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-500">
          <span>{view.audienceLabel}</span>
          <span aria-hidden>·</span>
          <span>{intentLabel}</span>
          <span aria-hidden>·</span>
          <span>{ago(askedMinutesAgo)}</span>
          {question.escalatedAt ? (
            <>
              <span aria-hidden>·</span>
              <span>Widened to the whole city</span>
            </>
          ) : null}
        </p>
        {question.detail ? <p className="text-sm text-ink-700">{question.detail}</p> : null}
      </header>

      {/* ---- answers ------------------------------------------------------ */}
      {answers.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-white p-4">
          <MascotArt state="thinking" className="size-10 shrink-0" />
          <p className="text-sm text-ink-500">
            {mine
              ? "Nobody has answered yet. We'll notify you the moment somebody does."
              : "Nobody has answered yet — you could be the first."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {answers.map((answer) => {
            const accepted = question.acceptedAnswerId === answer.id;
            return (
              <li
                key={answer.id}
                className={
                  accepted
                    ? "rounded-lg border border-mint-deep/30 bg-mint-soft/40 p-4"
                    : "rounded-lg border border-ink-200 bg-white p-4"
                }
              >
                {accepted ? (
                  <Badge accent="mint" tone="soft" className="mb-2">
                    <Check className="size-3" aria-hidden />
                    Accepted
                  </Badge>
                ) : null}

                <p className="text-sm text-ink-900">{answer.body}</p>

                {answer.amountCents !== null ? (
                  <p className="mt-1.5 text-sm font-medium text-ink-950">
                    {money(answer.amountCents / 100, viewer.currency)}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[0.8125rem] text-ink-400">{ago(answer.minutesAgo)}</span>
                  {answer.userId === viewer.user.id ? null : (
                    <UsefulButton
                      answerId={answer.id}
                      count={answer.usefulCount}
                      isAsker={mine}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---- answer ------------------------------------------------------- */}
      {mine ? null : alreadyAnswered ? (
        <p className="text-sm text-ink-500">You have answered this one.</p>
      ) : (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-950">Your answer</h2>
          <AnswerForm
            questionId={question.id}
            wantsPrice={question.expectedSubject === "price" || question.expectedSubject === "student-offer"}
            currencySymbol={symbol}
          />
        </section>
      )}

      {/* ---- the loop closing --------------------------------------------- */}
      {mine && consensusVoices >= 2 ? (
        <p className="rounded-lg border border-flow-deep/20 bg-flow-soft p-3.5 text-sm text-flow-deep">
          {consensusVoices} students agree on this. It is now part of what {viewer.city.name}{" "}
          students know — the next person who asks gets it straight away.
        </p>
      ) : null}
    </div>
  );
}
