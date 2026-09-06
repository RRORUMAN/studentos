import type { ChatMessageRow, CommunityPost } from "@/domain/types";

/**
 * ============================================================================
 * CATCH ME UP
 * ----------------------------------------------------------------------------
 * "You missed 164 posts and messages. Here are five worth knowing."
 *
 * Built without a model: the five are chosen by a plain score — votes, replies,
 * recency, and whether the post is a deal, an event or an unanswered question,
 * which are the kinds a student most regrets missing. Each line links to the
 * post it came from, so nothing here is a claim the product is making; it is a
 * pointer to a claim a student made, presented as such.
 *
 * The paid tier gets the same five with a model writing one sentence over
 * them. The selection never changes with plan.
 * ============================================================================
 */

export type CatchUpLine = {
  postId: string;
  title: string;
  channel: string;
  /** Why it made the cut. */
  because: string;
  href: string;
};

export type CatchUp = {
  /** Posts plus chat messages since `since`. */
  missed: number;
  missedPosts: number;
  missedMessages: number;
  lines: CatchUpLine[];
};

export function catchUp(input: {
  posts: readonly CommunityPost[];
  chat: readonly ChatMessageRow[];
  /** ISO. Content after this is "missed". */
  since: string;
  campusSlug: string | null;
  limit?: number;
}): CatchUp {
  const recentPosts = input.posts.filter((post) => post.createdAt > input.since && post.hiddenAt === null);
  const recentChat = input.chat.filter((message) => message.createdAt > input.since);

  const scored = recentPosts
    .map((post) => {
      let score = post.upvotes + post.commentCount * 2;
      let because = `${post.upvotes} upvotes`;

      if (post.kind === "deal") {
        score += 12;
        because = "A deal students reported";
      } else if (post.kind === "event") {
        score += 10;
        because = "Something on soon";
      } else if (post.kind === "anyone-down") {
        score += 8;
        because = "Someone is looking for people";
      } else if (post.kind === "question" && post.commentCount === 0) {
        score += 5;
        because = "Unanswered question";
      } else if (post.kind === "question") {
        because = `${post.commentCount} answers`;
      } else if (post.commentCount >= 5) {
        because = `${post.commentCount} people discussing it`;
      }

      if (input.campusSlug && post.campusSlug === input.campusSlug) {
        score += 6;
        because = `${because} · your campus`;
      }

      return { post, score, because };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 5);

  return {
    missed: recentPosts.length + recentChat.length,
    missedPosts: recentPosts.length,
    missedMessages: recentChat.length,
    lines: scored.map(({ post, because }) => ({
      postId: post.id,
      title: post.title,
      channel: post.channel,
      because,
      href: `/pulse/${post.id}`,
    })),
  };
}
