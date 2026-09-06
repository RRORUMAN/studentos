"use client";

import { ArrowBigUp, Loader2, MessageSquare, Plus, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { ShareButton } from "@/components/app/share-button";
import { Button } from "@/components/ui/button";
import { loopChannels } from "@/server/db/seed-content";
import { createPost, toggleUpvote } from "@/server/actions/loop";
import { ago, cn } from "@/lib/utils";

/**
 * ============================================================================
 * PULSE UI
 * ----------------------------------------------------------------------------
 * The interactive parts of the community surface.
 *
 * The credibility signal on every post is "terms in city", not a follower
 * count or karma. Someone in their fourth term saying a place is good is worth
 * more than someone in their first, and it is a fact about them rather than a
 * score the product invented.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Vote                                                                        */
/* -------------------------------------------------------------------------- */

export function VoteButton({
  targetId,
  targetKind = "post",
  count,
  voted,
  label = "Helpful",
}: {
  targetId: string;
  targetKind?: "post" | "comment";
  count: number;
  voted: boolean;
  label?: string;
}) {
  const [optimistic, setOptimistic] = useState({ count, voted });
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={optimistic.voted}
      aria-label={optimistic.voted ? `Remove ${label.toLowerCase()}` : label}
      onClick={() => {
        setOptimistic((current) => ({
          count: current.count + (current.voted ? -1 : 1),
          voted: !current.voted,
        }));
        startTransition(async () => void (await toggleUpvote(targetKind, targetId)));
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
        optimistic.voted
          ? "bg-signal text-ink-950"
          : "bg-paper-2 text-ink-600 hover:bg-ink-100 hover:text-ink-900",
      )}
    >
      <ArrowBigUp className="size-3.5" strokeWidth={2.2} />
      {label}
      <span className="tnum opacity-70">{optimistic.count}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Post card                                                                   */
/* -------------------------------------------------------------------------- */

const KIND_META: Record<string, { label: string; className: string }> = {
  question: { label: "Question", className: "bg-flow-soft text-flow-deep" },
  deal: { label: "Deal", className: "bg-amber-soft text-amber-deep" },
  event: { label: "Event", className: "bg-mint-soft text-mint-deep" },
  recommendation: { label: "Recommendation", className: "bg-signal-soft text-signal-deep" },
  "anyone-down": { label: "Anyone down?", className: "bg-pulse-soft text-pulse-deep" },
  poll: { label: "Poll", className: "bg-ink-100 text-ink-600" },
  post: { label: "", className: "" },
};

export function PostCard({
  id,
  title,
  body,
  kind,
  channel,
  upvotes,
  commentCount,
  minutesAgo,
  author,
  voted,
  sameCampus,
  topComment,
}: {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  channel: string;
  upvotes: number;
  commentCount: number;
  minutesAgo: number;
  author: {
    displayName: string;
    avatarEmoji: string;
    termsInCity: number;
    verified: boolean;
  } | null;
  voted: boolean;
  sameCampus: boolean;
  topComment?: { body: string; author: string | null; upvotes: number } | null;
}) {
  const meta = KIND_META[kind] ?? KIND_META.post;
  const isQuestion = kind === "question";

  return (
    <article className="relative rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[0.8125rem] text-ink-500">
        {author ? (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="grid size-6 place-items-center rounded-full bg-paper-2 text-sm">
              {author.avatarEmoji}
            </span>
            <span className="font-medium text-ink-800">{author.displayName}</span>
            {author.verified ? (
              <ShieldCheck className="size-3.5 text-mint-deep" aria-label="Student verified" />
            ) : null}
            <span className="text-ink-400">
              · {author.termsInCity} {author.termsInCity === 1 ? "term" : "terms"} here
            </span>
          </span>
        ) : null}
        <span className="text-ink-400">· {ago(minutesAgo)}</span>
        {sameCampus ? (
          <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[0.75rem] font-medium text-signal-deep">
            Your campus
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {meta.label ? (
          <span className={cn("rounded-full px-2 py-0.5 text-[0.75rem] font-semibold", meta.className)}>
            {meta.label}
          </span>
        ) : null}
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.75rem] font-medium text-ink-600">
          #{channel}
        </span>
      </div>

      <h3 className="mt-2 text-[1.0625rem] leading-snug font-semibold text-ink-950">
        <Link href={`/pulse/${id}`} className="after:absolute after:inset-0 after:rounded-2xl">
          {title}
        </Link>
      </h3>

      {body ? (
        <p className="mt-1.5 line-clamp-3 text-[0.9375rem] leading-relaxed text-ink-600">{body}</p>
      ) : null}

      {/* ---- top answer, for questions --------------------------------- */}
      {isQuestion && topComment ? (
        <blockquote className="mt-3 rounded-xl bg-paper-2 p-3">
          <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            Top answer{topComment.author ? ` · ${topComment.author}` : ""}
          </p>
          <p className="mt-1 line-clamp-2 text-[0.875rem] leading-snug text-ink-800">
            &ldquo;{topComment.body}&rdquo;
          </p>
        </blockquote>
      ) : isQuestion && commentCount === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-flow-deep">Nobody has answered yet. Know this one?</p>
      ) : null}

      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
        <VoteButton targetId={id} count={upvotes} voted={voted} />
        <Link
          href={`/pulse/${id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
        >
          <MessageSquare className="size-3.5" />
          {isQuestion ? "Answer" : "Comment"}
          <span className="tnum opacity-70">{commentCount}</span>
        </Link>
        <ShareButton path={`/pulse/${id}`} title={title} size="sm" className="border-0 bg-paper-2 hover:bg-ink-100" />
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Composer                                                                    */
/* -------------------------------------------------------------------------- */

export function Composer({
  defaultChannel = "general",
  defaultKind = "post",
  defaultTitle = "",
  buttonLabel = "Post something",
}: {
  defaultChannel?: string;
  defaultKind?: string;
  defaultTitle?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(defaultTitle.length > 0);
  const [channel, setChannel] = useState(defaultChannel);
  const [kind, setKind] = useState(defaultKind);
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="primary" size="md" block onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {buttonLabel}
      </Button>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[0.9375rem] font-semibold text-ink-950">
          {kind === "question" ? "Ask your city" : "New post"}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100"
        >
          <X className="size-4" />
        </button>
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={kind === "question" ? "What do you want to know?" : "What is it?"}
        aria-label="Title"
        className="h-11 w-full rounded-lg bg-paper-2 px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:ring-2 focus:ring-ink-950/20"
      />

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="The useful detail — a price, an address, what to ask for."
        aria-label="Details"
        rows={3}
        className="mt-2 w-full rounded-lg bg-paper-2 px-3.5 py-2.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:ring-2 focus:ring-ink-950/20"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["post", "question", "deal", "recommendation", "event", "anyone-down"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            aria-pressed={kind === option}
            className={cn(
              "h-8 rounded-full px-3 text-[0.8125rem] font-medium capitalize transition-colors",
              kind === option ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
            )}
          >
            {option === "anyone-down" ? "Anyone down?" : option}
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-600">Channel</span>
        <select
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          className="h-10 w-full rounded-lg bg-paper-2 px-3 text-[0.9375rem] text-ink-900"
        >
          {loopChannels.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.emoji} {entry.label}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <Button
        variant="primary"
        size="md"
        block
        className="mt-4"
        disabled={pending || title.trim().length < 4}
        onClick={() => {
          setError(null);
          const form = new FormData();
          form.set("title", title);
          form.set("body", body);
          form.set("channel", channel);
          form.set("kind", kind);

          startTransition(async () => {
            const result = await createPost(form);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setTitle("");
            setBody("");
            setOpen(false);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Post
      </Button>
    </section>
  );
}
