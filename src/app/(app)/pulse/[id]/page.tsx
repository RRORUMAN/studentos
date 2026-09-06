import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentForm } from "@/components/app/comment-form";
import { VoteButton } from "@/components/app/loop-ui";
import { findMany, findOne } from "@/server/db";
import { minutesSince } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { ago } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Post",
  robots: { index: false, follow: false },
};

/**
 * One post and its comments.
 *
 * Comments are threaded one level deep and no further. Deeper nesting turns a
 * fifteen-reply thread about where to buy a bike into something unreadable on a
 * phone, which is where almost all of this is read.
 */
export default async function PostPage(props: PageProps<"/pulse/[id]">) {
  const viewer = await requireViewer();
  const { id } = await props.params;

  const post = await findOne("posts", (row) => row.id === id && row.hiddenAt === null);
  if (!post) notFound();

  const [comments, profiles, votes] = await Promise.all([
    findMany("comments", (row) => row.postId === id && row.hiddenAt === null),
    findMany("profiles", () => true),
    findMany("votes", (row) => row.userId === viewer.user.id),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const voted = new Set(votes.map((vote) => vote.targetId));
  const author = byUser.get(post.authorId);

  const roots = comments
    .filter((comment) => comment.parentId === null)
    .sort((a, b) => b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt));

  const repliesTo = (parentId: string) =>
    comments
      .filter((comment) => comment.parentId === parentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/pulse"
        className="mb-5 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        The Loop
      </Link>

      <article>
        <p className="mb-2 flex flex-wrap items-center gap-2 text-[0.8125rem] text-ink-500">
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.75rem] font-medium text-ink-600">
            #{post.channel}
          </span>
          {author ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden>{author.avatarEmoji}</span>
              <span className="font-medium text-ink-700">{author.displayName}</span>
              {author.studentVerifiedAt ? (
                <ShieldCheck className="size-3.5 text-mint-deep" aria-label="Student verified" />
              ) : null}
              <span className="text-ink-400">
                · {author.termsInCity} {author.termsInCity === 1 ? "term" : "terms"} here
              </span>
            </span>
          ) : null}
          <span className="text-ink-400">
            · {ago(minutesSince(post.createdAt))}
          </span>
        </p>

        <h1 className="text-display-xs text-ink-950">{post.title}</h1>

        {post.body ? (
          <p className="mt-3 text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-700">
            {post.body}
          </p>
        ) : null}

        <div className="mt-4">
          <VoteButton targetId={post.id} count={post.upvotes} voted={voted.has(post.id)} />
        </div>
      </article>

      <hr className="my-7 border-ink-200" />

      <h2 className="mb-4 text-[1.0625rem] font-semibold text-ink-950">
        {post.commentCount} {post.commentCount === 1 ? "reply" : "replies"}
      </h2>

      <CommentForm postId={post.id} />

      <ul className="mt-6 space-y-5">
        {roots.map((comment) => {
          const commenter = byUser.get(comment.authorId);
          const replies = repliesTo(comment.id);

          return (
            <li key={comment.id}>
              <div className="rounded-lg border border-ink-200 bg-white p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-[0.8125rem] text-ink-500">
                  <span aria-hidden>{commenter?.avatarEmoji ?? "🙂"}</span>
                  <span className="font-medium text-ink-700">
                    {commenter?.displayName ?? "Someone"}
                  </span>
                  <span className="text-ink-400">
                    · {ago(minutesSince(comment.createdAt))}
                  </span>
                </p>
                <p className="text-[0.9375rem] leading-relaxed text-ink-800">{comment.body}</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <VoteButton
                    targetId={comment.id}
                    targetKind="comment"
                    count={comment.upvotes}
                    voted={voted.has(comment.id)}
                  />
                </div>
              </div>

              {replies.length > 0 ? (
                <ul className="mt-2.5 space-y-2.5 border-l-2 border-ink-200 pl-4">
                  {replies.map((reply) => {
                    const replier = byUser.get(reply.authorId);
                    return (
                      <li key={reply.id} className="rounded-lg bg-paper-2/70 p-3.5">
                        <p className="mb-1 text-[0.8125rem] text-ink-500">
                          <span aria-hidden>{replier?.avatarEmoji ?? "🙂"}</span>{" "}
                          <span className="font-medium text-ink-700">
                            {replier?.displayName ?? "Someone"}
                          </span>
                        </p>
                        <p className="text-[0.875rem] leading-relaxed text-ink-800">{reply.body}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
