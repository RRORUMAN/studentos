"use client";

import { CornerDownRight } from "lucide-react";
import { useState } from "react";

import { CommentForm } from "@/components/app/comment-form";
import { PostMenu, VoteButton } from "@/components/app/pulse-card";
import { ago, cn } from "@/lib/utils";

/**
 * ============================================================================
 * REPLIES
 * ----------------------------------------------------------------------------
 * Threaded one level deep and no further. Deeper nesting turns a fifteen-reply
 * thread about where to buy a bike into something unreadable on a phone, which
 * is where almost all of this is read — so a reply to a reply is attached to
 * the same root, and the person it answers is named in the form instead.
 *
 * Every reply is a full citizen: it can be voted on, replied to, reported and,
 * if it is yours, deleted. Before this they were read-only text, which made
 * the best answer on a question indistinguishable from the worst.
 * ============================================================================
 */

export type CommentView = {
  id: string;
  body: string;
  upvotes: number;
  minutesAgo: number;
  voted: boolean;
  mine: boolean;
  author: { userId: string; displayName: string; avatarEmoji: string; termsInCity: number | null } | null;
  replies: CommentView[];
};

export function CommentThread({ postId, comments }: { postId: string; comments: readonly CommentView[] }) {
  if (comments.length === 0) {
    return (
      <p className="rounded-2xl bg-white px-5 py-8 text-center text-[0.9375rem] text-ink-500 ring-1 ring-ink-950/6">
        No replies yet. If you know this one, you are the answer.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {comments.map((comment) => (
        <li key={comment.id}>
          <CommentRow postId={postId} comment={comment} />
          {comment.replies.length > 0 ? (
            <ul className="mt-2 space-y-2 border-l-2 border-ink-100 pl-4">
              {comment.replies.map((reply) => (
                <li key={reply.id}>
                  <CommentRow postId={postId} comment={reply} parentId={comment.id} nested />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CommentRow({
  postId,
  comment,
  parentId,
  nested = false,
}: {
  postId: string;
  comment: CommentView;
  /** Set on a nested reply: replying to it threads under the same root. */
  parentId?: string;
  nested?: boolean;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <div className={cn("rounded-xl bg-white p-3.5 ring-1 ring-ink-950/6", nested && "bg-paper-2/70 ring-0")}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-ink-500">
          <span aria-hidden>{comment.author?.avatarEmoji ?? "🙂"}</span>
          <span className="font-medium text-ink-700">{comment.author?.displayName ?? "Someone"}</span>
          {comment.author && comment.author.termsInCity !== null ? (
            <span className="text-ink-400">
              · {comment.author.termsInCity} {comment.author.termsInCity === 1 ? "term" : "terms"} here
            </span>
          ) : null}
          <span className="text-ink-400">· {ago(comment.minutesAgo)}</span>
        </p>

        <PostMenu
          targetKind="comment"
          targetId={comment.id}
          authorId={comment.author?.userId ?? null}
          authorName={comment.author?.displayName ?? "this student"}
          mine={comment.mine}
        />
      </div>

      <p className="mt-1 text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-800">{comment.body}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <VoteButton targetId={comment.id} targetKind="comment" count={comment.upvotes} voted={comment.voted} />
        <button
          type="button"
          onClick={() => setReplying((current) => !current)}
          aria-expanded={replying}
          className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
        >
          <CornerDownRight className="size-3.5" />
          Reply
        </button>
      </div>

      {replying ? (
        <div className="mt-3">
          <CommentForm
            postId={postId}
            parentId={parentId ?? comment.id}
            placeholder={`Reply to ${comment.author?.displayName ?? "them"}`}
            compact
            autoFocus
            onDone={() => setReplying(false)}
            onCancel={() => setReplying(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
