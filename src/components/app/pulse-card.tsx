"use client";

import {
  ArrowBigUp,
  Briefcase,
  CalendarDays,
  Check,
  Flag,
  Loader2,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Package,
  Ban,
  Tag,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { SaveButton } from "@/components/app/save-button";
import { ShareButton } from "@/components/app/share-button";
import { useToast } from "@/components/ui/toast";
import { blockStudent, followStudent, unfollowStudent } from "@/server/actions/friends";
import { AUTO_HIDE_REPORTS } from "@/config/moderation";
import { deletePost, reportContent, toggleUpvote, votePoll } from "@/server/actions/loop";
import type { AttachmentCard, FeedPost } from "@/server/queries/loop";
import { ago, cn } from "@/lib/utils";

/**
 * ============================================================================
 * PULSE CARD
 * ----------------------------------------------------------------------------
 * One post in the feed.
 *
 * The hierarchy is deliberate and is read top-down: **what it is** (the title),
 * then **why you should believe it** (the signal chips and the author's terms
 * in this city), then **the substance** (body, poll, the thing it points at,
 * the best answer so far), then what you can do about it. The old card led
 * with the author, which made every post look like a status update rather
 * than a piece of information about the city.
 *
 * The credibility signal is "terms in city", not a follower count or karma.
 * Someone in their fourth term saying a place is good is worth more than
 * someone in their first, and it is a fact about them rather than a score the
 * product invented.
 * ============================================================================
 */

const KIND_META: Record<string, { label: string; className: string }> = {
  question: { label: "Question", className: "bg-flow-soft text-flow-deep" },
  deal: { label: "Deal", className: "bg-amber-soft text-amber-deep" },
  event: { label: "Event", className: "bg-mint-soft text-mint-deep" },
  recommendation: { label: "Recommendation", className: "bg-signal-soft text-signal-deep" },
  "anyone-down": { label: "Anyone down?", className: "bg-pulse-soft text-pulse-deep" },
  poll: { label: "Poll", className: "bg-ink-100 text-ink-600" },
  post: { label: "", className: "" },
};

const REPORT_REASONS: readonly { value: string; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "scam", label: "Scam or fake" },
  { value: "harassment", label: "Harassment" },
  { value: "unsafe", label: "Unsafe" },
  { value: "wrong-info", label: "Wrong information" },
];

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
/* Poll                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A poll on a post. One vote each, changeable: tapping another option moves
 * your vote rather than adding one, which is what makes the share a share of
 * people rather than of taps. Results are visible before voting — hiding them
 * to force a vote is a dark pattern, and the counts are not a secret.
 */
export function PulsePoll({
  postId,
  poll,
}: {
  postId: string;
  poll: NonNullable<FeedPost["poll"]>;
}) {
  const router = useRouter();
  const [state, setState] = useState(poll);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const vote = (index: number) => {
    if (state.myVote === index) return;
    setError(null);

    /* Optimistic: move one vote, or add one if this is the first. */
    setState((current) => {
      const options = current.options.map((option) => ({
        ...option,
        count: option.count + (option.index === index ? 1 : option.index === current.myVote ? -1 : 0),
      }));
      const total = current.myVote === null ? current.total + 1 : current.total;
      return {
        total,
        myVote: index,
        options: options.map((option) => ({
          ...option,
          share: total === 0 ? 0 : Math.round((option.count / total) * 100),
        })),
      };
    });

    startTransition(async () => {
      const result = await votePoll(postId, index);
      if (!result.ok) {
        setState(poll);
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="relative z-10 mt-3">
      <ul className="space-y-1.5">
        {state.options.map((option) => {
          const mine = state.myVote === option.index;
          return (
            <li key={option.index}>
              <button
                type="button"
                disabled={pending}
                aria-pressed={mine}
                onClick={() => vote(option.index)}
                className={cn(
                  "relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left transition-colors",
                  mine ? "ring-1 ring-ink-950/25" : "ring-1 ring-ink-950/8 hover:ring-ink-950/20",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    mine ? "bg-signal-soft" : "bg-paper-2",
                  )}
                  style={{ width: `${state.total === 0 ? 0 : option.share}%` }}
                />
                <span className="relative min-w-0 flex-1 truncate text-[0.875rem] font-medium text-ink-900">
                  {option.label}
                </span>
                {mine ? <Check className="relative size-3.5 shrink-0 text-ink-900" /> : null}
                <span className="tnum relative shrink-0 text-[0.8125rem] text-ink-500">{option.share}%</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[0.75rem] text-ink-400">
        {state.total === 0
          ? "No votes yet."
          : `${state.total} ${state.total === 1 ? "vote" : "votes"}${state.myVote !== null ? " · tap another to change yours" : ""}`}
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-[0.75rem] text-pulse-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Attachment                                                                  */
/* -------------------------------------------------------------------------- */

const ATTACHMENT_ICON = {
  event: CalendarDays,
  place: MapPin,
  deal: Tag,
  plan: CalendarDays,
  invite: CalendarDays,
  listing: Package,
  poll: MessageSquare,
  mission: Check,
  opportunity: Briefcase,
} as const;

/** The thing a post or message points at, rendered from its live row. */
export function AttachmentChip({ card, className }: { card: AttachmentCard; className?: string }) {
  const Icon = ATTACHMENT_ICON[card.kind] ?? MapPin;

  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-signal-soft">
        <Icon className="size-4 text-signal-deep" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.875rem] font-semibold text-ink-950">{card.title}</span>
        <span className="block truncate text-[0.75rem] text-ink-500">{card.meta}</span>
      </span>
    </>
  );

  const shell = cn("relative z-10 mt-3 flex items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-ink-950/10", className);

  return card.href ? (
    <Link href={card.href} className={cn(shell, "hover:shadow-[var(--shadow-raise)]")}>
      {inner}
    </Link>
  ) : (
    <div className={shell}>{inner}</div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overflow menu                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Share, save, follow, report, block, delete.
 *
 * Report and block are always one tap from any post — a community product
 * where getting away from someone takes six taps is one people leave.
 */
export function PostMenu({
  targetKind,
  targetId,
  authorId,
  authorName,
  mine,
  following,
  onDeleted,
}: {
  targetKind: "post" | "comment";
  targetId: string;
  authorId: string | null;
  authorName: string;
  mine: boolean;
  following?: boolean;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(Boolean(following));
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setReporting(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setReporting(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setReporting(false);
  };

  const report = (reason: string) => {
    close();
    startTransition(async () => {
      const result = await reportContent(targetKind, targetId, reason);
      toast(
        result.ok
          ? {
              title: "Reported",
              /* This used to say "A moderator will look at it", which was not
                 true: the report was written to a table nothing read. There is
                 a queue now, and there is also a rule that does not wait for
                 it, so the message says both — and says plainly that one
                 report on its own changes nothing, because a student who
                 expects a post to vanish and watches it stay will report it
                 four more times. */
              description: `A moderator sees it. One report hides nothing on its own; ${AUTO_HIDE_REPORTS} different people reporting the same thing takes it down straight away.`,
            }
          : { title: "Could not report that", description: result.message, tone: "warning" },
      );
    });
  };

  const remove = () => {
    close();
    startTransition(async () => {
      const result = targetKind === "post" ? await deletePost(targetId) : await deleteOwnComment(targetId);
      if (!result.ok) {
        toast({ title: "Could not delete that", description: result.message, tone: "warning" });
        return;
      }
      toast({ title: targetKind === "post" ? "Post deleted" : "Comment deleted" });
      onDeleted?.();
      router.refresh();
    });
  };

  const follow = () => {
    if (!authorId) return;
    close();
    const next = !isFollowing;
    setIsFollowing(next);
    startTransition(async () => {
      const result = next ? await followStudent(authorId) : await unfollowStudent(authorId);
      if (!result.ok) {
        setIsFollowing(!next);
        toast({ title: "That did not work", description: result.message, tone: "warning" });
        return;
      }
      toast({ title: next ? `Following ${authorName}` : `Unfollowed ${authorName}` });
      router.refresh();
    });
  };

  const block = () => {
    if (!authorId) return;
    close();
    startTransition(async () => {
      const result = await blockStudent(authorId);
      toast(
        result.ok
          ? { title: `Blocked ${authorName}`, description: "You will not see each other again. Undo it in Friends." }
          : { title: "Could not block", description: result.message, tone: "warning" },
      );
      router.refresh();
    });
  };

  return (
    <div ref={ref} className="relative z-20">
      <button
        type="button"
        aria-label={`More for this ${targetKind}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-800"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
      </button>

      {open ? (
        <ul
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 w-52 overflow-hidden rounded-xl bg-white p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-ink-950/8"
        >
          {reporting ? (
            <>
              <li role="none" className="px-3 py-1.5 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                What is wrong?
              </li>
              {REPORT_REASONS.map((reason) => (
                <li role="none" key={reason.value}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => report(reason.value)}
                    className="w-full rounded-lg px-3 py-2 text-left text-[0.875rem] text-ink-800 hover:bg-paper-2"
                  >
                    {reason.label}
                  </button>
                </li>
              ))}
            </>
          ) : (
            <>
              {!mine && authorId ? (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={follow}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.875rem] text-ink-800 hover:bg-paper-2"
                  >
                    {isFollowing ? <UserMinus className="size-4 text-ink-400" /> : <UserPlus className="size-4 text-ink-400" />}
                    {isFollowing ? `Unfollow ${authorName}` : `Follow ${authorName}`}
                  </button>
                </li>
              ) : null}

              {mine ? (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={remove}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.875rem] text-pulse-deep hover:bg-pulse-soft"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </button>
                </li>
              ) : (
                <>
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setReporting(true)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.875rem] text-ink-800 hover:bg-paper-2"
                    >
                      <Flag className="size-4 text-ink-400" />
                      Report
                    </button>
                  </li>
                  {authorId ? (
                    <li role="none">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={block}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.875rem] text-pulse-deep hover:bg-pulse-soft"
                      >
                        <Ban className="size-4" />
                        Block {authorName}
                      </button>
                    </li>
                  ) : null}
                </>
              )}
            </>
          )}
        </ul>
      ) : null}
    </div>
  );
}

/* Imported lazily so the menu can serve both posts and comments without the
   card pulling in a second action module it does not use. */
async function deleteOwnComment(id: string) {
  const { deleteComment } = await import("@/server/actions/loop");
  return deleteComment(id);
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function PulseCard({ entry }: { entry: FeedPost }) {
  const { post, author } = entry;
  const meta = KIND_META[post.kind] ?? KIND_META.post;
  const isQuestion = post.kind === "question";

  return (
    <article className="relative rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      {/* ---- what it is ------------------------------------------------- */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {meta.label ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[0.75rem] font-semibold", meta.className)}>
                {meta.label}
              </span>
            ) : null}
            <Link
              href={`/pulse?channel=${post.channel}`}
              className="relative z-10 rounded-full bg-ink-100 px-2 py-0.5 text-[0.75rem] font-medium text-ink-600 hover:bg-ink-200"
            >
              #{post.channel}
            </Link>
            {entry.sameCampus ? (
              <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[0.75rem] font-medium text-signal-deep">
                Your campus
              </span>
            ) : null}
            {entry.friend ? (
              <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[0.75rem] font-medium text-mint-deep">Friend</span>
            ) : entry.following ? (
              <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.75rem] font-medium text-ink-600">Following</span>
            ) : null}
          </div>

          <h3 className="mt-2 text-[1.0625rem] leading-snug font-semibold text-ink-950">
            <Link href={`/pulse/${post.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
              {post.title}
            </Link>
          </h3>
        </div>

        <PostMenu
          targetKind="post"
          targetId={post.id}
          authorId={author?.userId ?? null}
          authorName={author?.displayName ?? "this student"}
          mine={entry.mine}
          following={entry.following}
        />
      </div>

      {/* ---- who says so -------------------------------------------------- */}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] text-ink-500">
        {author ? (
          <>
            <span aria-hidden>{author.avatarEmoji}</span>
            <span className="font-medium text-ink-700">{author.displayName}</span>
            {author.verified ? <VerifiedMark /> : null}
            {author.campusName ? <span className="text-ink-400">· {author.campusName}</span> : null}
            {author.termsInCity !== null ? (
              <span className="text-ink-400">
                · {author.termsInCity} {author.termsInCity === 1 ? "term" : "terms"} here
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-ink-400">Someone</span>
        )}
        <span className="text-ink-400">· {ago(entry.minutesAgo)}</span>
      </p>

      {/* ---- the substance ------------------------------------------------ */}
      {post.body ? (
        <p className="mt-2 line-clamp-3 text-[0.9375rem] leading-relaxed text-ink-600">{post.body}</p>
      ) : null}

      {entry.poll ? <PulsePoll postId={post.id} poll={entry.poll} /> : null}
      {entry.attachment ? <AttachmentChip card={entry.attachment} /> : null}

      {isQuestion && entry.topComment ? (
        <blockquote className="mt-3 rounded-xl bg-paper-2 p-3">
          <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            Top answer{entry.topComment.author ? ` · ${entry.topComment.author}` : ""}
          </p>
          <p className="mt-1 line-clamp-2 text-[0.875rem] leading-snug text-ink-800">
            &ldquo;{entry.topComment.body}&rdquo;
          </p>
        </blockquote>
      ) : isQuestion && post.commentCount === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-flow-deep">Nobody has answered yet. Know this one?</p>
      ) : null}

      {/* ---- what you can do ---------------------------------------------- */}
      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
        <VoteButton targetId={post.id} count={post.upvotes} voted={entry.voted} />
        <Link
          href={`/pulse/${post.id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
        >
          <MessageSquare className="size-3.5" />
          {isQuestion ? "Answer" : "Comment"}
          <span className="tnum opacity-70">{post.commentCount}</span>
        </Link>
        <ShareButton path={`/pulse/${post.id}`} title={post.title} size="sm" className="border-0 bg-paper-2 hover:bg-ink-100" />
        <SaveButton kind="post" targetId={post.id} saved={entry.saved} />
      </div>
    </article>
  );
}

function VerifiedMark() {
  return (
    <span title="Student verified" aria-label="Student verified" className="text-mint-deep">
      <Check className="inline size-3.5" strokeWidth={3} />
    </span>
  );
}
