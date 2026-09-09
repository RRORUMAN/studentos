import { ArrowLeft, MessagesSquare, ShieldCheck } from "lucide-react";
import { termsInCity } from "@/domain/lifecycle";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentForm } from "@/components/app/comment-form";
import { AttachmentChip, PostMenu, PulsePoll, VoteButton } from "@/components/app/pulse-card";
import { CommentThread, type CommentView } from "@/components/app/pulse-comments";
import { SaveButton } from "@/components/app/save-button";
import { ShareButton } from "@/components/app/share-button";
import { AnyoneDownButton } from "@/components/app/anyone-down-button";
import { loopChannels } from "@/server/db/seed-content";
import { findMany } from "@/server/db";
import { loadPost } from "@/server/queries/loop";
import { minutesSince } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { ago } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Post",
  robots: { index: false, follow: false },
};

/**
 * One post and its replies.
 *
 * Replies are threaded one level deep and no further, and each one can be
 * voted on, replied to, reported or deleted by its author. The post itself
 * carries the same actions as its card in the feed, so nothing a student can
 * do in the list disappears when they open the thing.
 */
export default async function PostPage(props: PageProps<"/pulse/[id]">) {
  const viewer = await requireViewer();
  const { id } = await props.params;

  const entry = await loadPost({
    id,
    userId: viewer.user.id,
    citySlug: viewer.profile.citySlug,
    campusSlug: viewer.profile.campusSlug,
  });
  if (!entry) notFound();

  const { post, author } = entry;

  const [comments, profiles, votes] = await Promise.all([
    findMany("comments", (row) => row.postId === id && row.hiddenAt === null),
    findMany("profiles", () => true),
    findMany("votes", (row) => row.userId === viewer.user.id && row.targetKind === "comment"),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const voted = new Set(votes.map((vote) => vote.targetId));

  const toView = (comment: (typeof comments)[number]): CommentView => {
    const commenter = byUser.get(comment.authorId);
    return {
      id: comment.id,
      body: comment.body,
      upvotes: comment.upvotes,
      minutesAgo: minutesSince(comment.createdAt),
      voted: voted.has(comment.id),
      mine: comment.authorId === viewer.user.id,
      author: commenter
        ? {
            userId: commenter.userId,
            displayName: commenter.displayName,
            avatarEmoji: commenter.avatarEmoji,
            termsInCity: termsInCity(commenter.arrivingOn, new Date()),
          }
        : null,
      replies: comments
        .filter((reply) => reply.parentId === comment.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((reply) => ({ ...toView(reply), replies: [] })),
    };
  };

  const roots = comments
    .filter((comment) => comment.parentId === null)
    .sort((a, b) => b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt))
    .map(toView);

  const channelLabel = loopChannels.find((entry) => entry.slug === post.channel)?.label ?? post.channel;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/pulse"
        className="mb-5 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Pulse
      </Link>

      <article>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-ink-500">
              <Link
                href={`/pulse?channel=${post.channel}`}
                className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.75rem] font-medium text-ink-600 hover:bg-ink-200"
              >
                #{post.channel}
              </Link>
              {entry.sameCampus ? (
                <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[0.75rem] font-medium text-signal-deep">
                  Your campus
                </span>
              ) : null}
            </p>
            <h1 className="text-display-xs text-ink-950">{post.title}</h1>
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

        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] text-ink-500">
          {author ? (
            <>
              <span aria-hidden>{author.avatarEmoji}</span>
              <span className="font-medium text-ink-700">{author.displayName}</span>
              {author.verified ? (
                <ShieldCheck className="size-3.5 text-mint-deep" aria-label="Student verified" />
              ) : null}
              {author.campusName ? <span className="text-ink-400">· {author.campusName}</span> : null}
              {author.termsInCity !== null ? (
                <span className="text-ink-400">
                  · {author.termsInCity} {author.termsInCity === 1 ? "term" : "terms"} here
                </span>
              ) : null}
            </>
          ) : null}
          <span className="text-ink-400">· {ago(minutesSince(post.createdAt))}</span>
        </p>

        {post.body ? (
          <p className="mt-3 text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-700">{post.body}</p>
        ) : null}

        {entry.poll ? <PulsePoll postId={post.id} poll={entry.poll} /> : null}
        {entry.attachment ? <AttachmentChip card={entry.attachment} /> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <VoteButton targetId={post.id} count={post.upvotes} voted={entry.voted} />
          <ShareButton path={`/pulse/${post.id}`} title={post.title} size="sm" className="border-0 bg-paper-2 hover:bg-ink-100" />
          <SaveButton kind="post" targetId={post.id} saved={entry.saved} />
        </div>

        <p className="mt-4 text-[0.8125rem] text-ink-500">
          <Link
            href={`/pulse/chat/${post.channel}`}
            className="inline-flex items-center gap-1.5 font-medium text-ink-700 underline underline-offset-4 hover:text-ink-950"
          >
            <MessagesSquare className="size-3.5" />
            Chat in #{channelLabel}
          </Link>
        </p>
      </article>

      {/* ---- turn it into a plan -------------------------------------------
          A post asking "anyone want to go?" is one tap from being a group. */}
      {post.kind === "anyone-down" ? (
        <div className="mt-6">
          <AnyoneDownButton
            title={post.title}
            anchorKind={post.attachment?.kind === "event" || post.attachment?.kind === "place" ? post.attachment.kind : undefined}
            anchorId={post.attachment?.kind === "event" || post.attachment?.kind === "place" ? post.attachment.id : undefined}
            label="Turn this into a plan"
          />
        </div>
      ) : null}

      <hr className="my-7 border-ink-200" />

      <h2 className="mb-4 text-[1.0625rem] font-semibold text-ink-950">
        {post.commentCount} {post.commentCount === 1 ? "reply" : "replies"}
      </h2>

      <CommentForm
        postId={post.id}
        placeholder={post.kind === "question" ? "Answer it if you know." : "Add what you know."}
        submitLabel={post.kind === "question" ? "Answer" : "Reply"}
      />

      <div className="mt-6">
        <CommentThread postId={post.id} comments={roots} />
      </div>
    </div>
  );
}
