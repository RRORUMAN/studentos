"use client";

import { Loader2, MessageCircleQuestion, Send, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { askStudents, markAnswerUseful, postAnswer } from "@/server/actions/questions";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * ASK STUDENTS — controls
 * ----------------------------------------------------------------------------
 * The three interactions: ask, answer, and say an answer helped.
 *
 * `AskStudentsButton` is the one that matters. It appears at the bottom of a
 * low-confidence AI answer, and it is deliberately a full-width primary
 * control rather than a quiet link — the moment Ask admits it does not know is
 * the moment the student is most willing to help, and burying the offer wastes
 * the only chance the product gets to turn a miss into knowledge.
 * ============================================================================
 */

export function AskStudentsButton({
  title,
  originQuery,
  className,
}: {
  title: string;
  originQuery?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={className}>
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await askStudents({ title, originQuery: originQuery ?? null });
            if (!result.ok) {
              setError(result.message);
              return;
            }
            toast({
              title: "Asked",
              description: "We'll tell you as soon as a student answers.",
            });
            router.push(`/ask/questions/${result.questionId}`);
          });
        }}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <MessageCircleQuestion className="size-4" aria-hidden />
        )}
        Ask students
      </Button>
      {error ? <p className="mt-2 text-[0.8125rem] text-pulse-deep">{error}</p> : null}
    </div>
  );
}

/** The compose box on the questions hub, for a question typed directly. */
export function AskStudentsForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-2"
      onSubmit={(submit) => {
        submit.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await askStudents({ title });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setTitle("");
          router.push(`/ask/questions/${result.questionId}`);
        });
      }}
    >
      <label className="sr-only" htmlFor="ask-students-title">
        Your question
      </label>
      <textarea
        id="ask-students-title"
        value={title}
        onChange={(change) => setTitle(change.target.value)}
        rows={2}
        maxLength={180}
        placeholder="Where can I print 100 pages cheaply near campus?"
        className="w-full resize-none rounded-lg border border-ink-200 bg-white p-3 text-sm text-ink-900 placeholder:text-ink-400"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] text-ink-500">
          Goes to students on your campus first.
        </p>
        <Button type="submit" disabled={pending || title.trim().length < 8}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          Ask
        </Button>
      </div>
      {error ? <p className="text-[0.8125rem] text-pulse-deep">{error}</p> : null}
    </form>
  );
}

/**
 * The answer box.
 *
 * The optional price field is shown only when the question looks like a price
 * question (`wantsPrice`, from `expectedSubject`). A structured number turns
 * two agreeing answers into a claim candidate — see `consensusOf` — and asking
 * for it on every question would be noise that trains people to skip it.
 */
export function AnswerForm({
  questionId,
  wantsPrice,
  currencySymbol,
}: {
  questionId: string;
  wantsPrice: boolean;
  currencySymbol: string;
}) {
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <p className="rounded-lg border border-mint-deep/25 bg-mint-soft p-3 text-sm text-mint-deep">
        Answer posted. They have been told.
      </p>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(submit) => {
        submit.preventDefault();
        setError(null);
        const value = Number(amount);
        startTransition(async () => {
          const result = await postAnswer({
            questionId,
            body,
            amount: wantsPrice && Number.isFinite(value) && value > 0 ? value : null,
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setSent(true);
        });
      }}
    >
      <label className="sr-only" htmlFor={`answer-${questionId}`}>
        Your answer
      </label>
      <textarea
        id={`answer-${questionId}`}
        value={body}
        onChange={(change) => setBody(change.target.value)}
        rows={3}
        maxLength={1200}
        placeholder="What you actually know — where, how much, what to ask for."
        className="w-full resize-none rounded-lg border border-ink-200 bg-white p-3 text-sm text-ink-900 placeholder:text-ink-400"
      />

      {wantsPrice ? (
        <div className="flex items-center gap-2">
          <label className="text-[0.8125rem] text-ink-600" htmlFor={`answer-amount-${questionId}`}>
            Roughly what it costs
          </label>
          <div className="flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1">
            <span className="text-sm text-ink-500">{currencySymbol}</span>
            <input
              id={`answer-amount-${questionId}`}
              inputMode="decimal"
              value={amount}
              onChange={(change) => setAmount(change.target.value)}
              className="w-16 text-sm outline-none"
              placeholder="8"
            />
          </div>
          <span className="text-[0.8125rem] text-ink-400">Optional</span>
        </div>
      ) : null}

      <Button type="submit" disabled={pending || body.trim().length < 3}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Post answer
      </Button>
      {error ? <p className="text-[0.8125rem] text-pulse-deep">{error}</p> : null}
    </form>
  );
}

/** "This helped" — the asker's verdict, which is what earns the answerer credit. */
export function UsefulButton({
  answerId,
  count,
  isAsker,
}: {
  answerId: string;
  count: number;
  isAsker: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [marked, setMarked] = useState(false);
  const [total, setTotal] = useState(count);

  return (
    <button
      type="button"
      disabled={pending || marked}
      onClick={() =>
        startTransition(async () => {
          const result = await markAnswerUseful(answerId);
          if (result.ok) {
            setMarked(true);
            setTotal((value) => value + 1);
          }
        })
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.8125rem] font-medium",
        marked
          ? "border-mint-deep/30 bg-mint-soft text-mint-deep"
          : "border-ink-200 text-ink-600 hover:border-ink-400 hover:text-ink-950",
        "disabled:opacity-60",
      )}
    >
      <ThumbsUp className="size-3.5" aria-hidden />
      {isAsker ? (marked ? "Marked as helpful" : "This helped") : "Helpful"}
      {total > 0 ? <span className="tnum">{total}</span> : null}
    </button>
  );
}
