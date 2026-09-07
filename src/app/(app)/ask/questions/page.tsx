import { MessageCircleQuestion, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AskStudentsForm } from "@/components/app/ask-students";
import { LocalTruthList } from "@/components/app/local-truth";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { loadAnswerable, loadMyQuestions, audienceOf } from "@/server/queries/questions";
import { loadVerificationQueue } from "@/server/queries/truth";
import { requireViewer } from "@/server/viewer";
import { ago } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ask students",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * ASK STUDENTS
 * ----------------------------------------------------------------------------
 * The two halves of the loop on one screen: questions this student can answer,
 * and questions they asked.
 *
 * Answering comes first, above asking. The scarce resource in a community
 * product is not questions — those arrive on their own — it is people willing
 * to answer, and a screen that opens with a compose box teaches students this
 * is a place to take from. Opening with "three students are waiting on
 * something you'd know" teaches the opposite.
 *
 * The verification queue sits alongside for the same reason: it is the lowest-
 * effort contribution in the product (one tap, no typing) and it is what keeps
 * everything else true.
 * ============================================================================
 */

export default async function QuestionsPage() {
  const viewer = await requireViewer();

  const audience = audienceOf(viewer.profile, []);
  const [answerable, mine, queue] = await Promise.all([
    loadAnswerable(viewer.user.id, audience, 8),
    loadMyQuestions(viewer.user.id),
    loadVerificationQueue(viewer.profile.citySlug, viewer.profile.campusSlug, 4),
  ]);

  const open = mine.filter((view) => view.question.status === "open");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-h2 font-semibold text-ink-950">Ask students</h1>
        <p className="text-sm text-ink-500">
          When {viewer.city.name} students know something this app doesn&apos;t, this is where it
          gets said.
        </p>
      </header>

      {/* ---- answer ------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-950">
            {answerable.length > 0 ? "Students are waiting on these" : "Nothing needs answering"}
          </h2>
          {answerable.length > 0 ? (
            <Badge accent="flow" tone="soft">
              {answerable.length}
            </Badge>
          ) : null}
        </div>

        {answerable.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-white p-4">
            <MascotArt state="neutral" className="size-10 shrink-0" />
            <p className="text-sm text-ink-500">
              No open questions on your campus right now. That is a good sign — it means the
              last few got answered.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {answerable.map(({ question, answerCount, intentLabel, askedMinutesAgo }) => (
              <li key={question.id}>
                <Link
                  href={`/ask/questions/${question.id}`}
                  className="block rounded-lg border border-ink-200 bg-white p-4 transition-colors hover:border-ink-400"
                >
                  <p className="text-sm font-medium text-ink-950">{question.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-500">
                    <span>{intentLabel}</span>
                    <span aria-hidden>·</span>
                    <span>{ago(askedMinutesAgo)}</span>
                    <span aria-hidden>·</span>
                    <span className={answerCount === 0 ? "font-medium text-flow-deep" : undefined}>
                      {answerCount === 0
                        ? "Nobody has answered"
                        : `${answerCount} ${answerCount === 1 ? "answer" : "answers"}`}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- verify ------------------------------------------------------- */}
      {queue.length > 0 ? (
        <LocalTruthList
          views={queue}
          where={viewer.currency}
          title="Quick checks — one tap each"
        />
      ) : null}

      {/* ---- ask ---------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-950">Ask your own</h2>
        <AskStudentsForm />
      </section>

      {/* ---- mine --------------------------------------------------------- */}
      {mine.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-950">
            You asked{open.length > 0 ? ` · ${open.length} still open` : ""}
          </h2>
          <ul className="space-y-2">
            {mine.map(({ question, answerCount, askedMinutesAgo }) => (
              <li key={question.id}>
                <Link
                  href={`/ask/questions/${question.id}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-ink-200 bg-white p-4 transition-colors hover:border-ink-400"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink-950">{question.title}</p>
                    <p className="mt-1 text-[0.8125rem] text-ink-500">{ago(askedMinutesAgo)}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-medium text-ink-600">
                    {answerCount > 0 ? (
                      <>
                        <Users className="size-3.5" aria-hidden />
                        {answerCount}
                      </>
                    ) : (
                      <>
                        <MessageCircleQuestion className="size-3.5" aria-hidden />
                        Waiting
                      </>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
