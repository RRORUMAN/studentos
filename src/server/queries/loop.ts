import "server-only";

import { cache } from "react";

import type { CommunityPost, Profile } from "@/domain/types";
import { findMany } from "@/server/db";

/**
 * ============================================================================
 * THE LOOP — queries
 * ----------------------------------------------------------------------------
 * Feed assembly for the community surface.
 *
 * Ranking is Tier 0 and deliberately simple: recency, votes and proximity to
 * the reader (same campus beats same city). A young community does not have
 * enough signal for anything cleverer, and an opaque algorithm on a feed of
 * forty posts is a way to hide the fact that there are only forty posts.
 *
 * The scoring below is the standard time-decayed vote score, which has the
 * property that matters here: a good post from this morning outranks a great
 * post from last week, so the feed always looks alive.
 * ============================================================================
 */

export type LoopAuthor = Pick<
  Profile,
  "userId" | "handle" | "displayName" | "avatarEmoji" | "campusSlug" | "termsInCity"
> & { verified: boolean };

export type FeedPost = {
  post: CommunityPost;
  author: LoopAuthor | null;
  /** Set when the author is at the reader's campus. */
  sameCampus: boolean;
  score: number;
  /** Measured once here so cards never read the clock during render. */
  minutesAgo: number;
  /** The most-upvoted reply, for question cards. */
  topComment: { body: string; author: string | null; upvotes: number } | null;
};

/**
 * Hacker-News-style gravity. 1.6 keeps a day-old post competitive and a
 * week-old one effectively gone, which is right for a feed about what is
 * happening in a city this week.
 */
function rank(post: CommunityPost, boost: number, now: number): number {
  const ageHours = Math.max(0, (now - Date.parse(post.createdAt)) / 3_600_000);
  const votes = post.upvotes + post.commentCount * 2;
  return ((votes + 1) * boost) / Math.pow(ageHours + 2, 1.6);
}

export type FeedView = "for-you" | "campus" | "city" | "following" | "trending";

export const feedViews: readonly { value: FeedView; label: string }[] = [
  { value: "for-you", label: "For you" },
  { value: "campus", label: "Campus" },
  { value: "city", label: "City" },
  { value: "following", label: "Following" },
  { value: "trending", label: "Trending" },
];

/**
 * Post categories on the Pulse rail. A category is a *kind* (question, deal)
 * or a *channel* (housing, travel); both are one chip to a student, so the rail
 * treats them the same and the query resolves which is which.
 */
export const pulseCategories: readonly {
  value: string;
  label: string;
  match: { kind?: CommunityPost["kind"]; channel?: string };
}[] = [
  { value: "questions", label: "Questions", match: { kind: "question" } },
  { value: "deals", label: "Deals", match: { kind: "deal" } },
  { value: "events", label: "Events", match: { kind: "event" } },
  { value: "recommendations", label: "Recommendations", match: { kind: "recommendation" } },
  { value: "anyone-down", label: "Anyone down", match: { kind: "anyone-down" } },
  { value: "guides", label: "Guides", match: { channel: "general" } },
  { value: "general", label: "General", match: { channel: "general" } },
  { value: "housing", label: "Housing", match: { channel: "housing" } },
  { value: "travel", label: "Travel", match: { channel: "travel" } },
  { value: "study", label: "Study", match: { channel: "study" } },
  { value: "jobs", label: "Jobs", match: { channel: "jobs" } },
];

export const loadFeed = cache(
  async (input: {
    citySlug: string;
    campusSlug: string | null;
    view: FeedView;
    channel?: string | null;
    category?: string | null;
    userId: string;
  }): Promise<FeedPost[]> => {
    const [posts, profiles, comments, friendships] = await Promise.all([
      findMany(
        "posts",
        (row) => row.citySlug === input.citySlug && row.hiddenAt === null,
      ),
      findMany("profiles", () => true),
      findMany("comments", (row) => row.hiddenAt === null && row.parentId === null),
      findMany(
        "friendships",
        (row) =>
          row.status === "accepted" &&
          (row.requesterId === input.userId || row.addresseeId === input.userId),
      ),
    ]);

    const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
    const friendIds = new Set(
      friendships.map((row) =>
        row.requesterId === input.userId ? row.addresseeId : row.requesterId,
      ),
    );

    const now = Date.now();

    let filtered = posts;
    if (input.channel) filtered = filtered.filter((post) => post.channel === input.channel);
    if (input.category) {
      const category = pulseCategories.find((entry) => entry.value === input.category);
      if (category?.match.kind) filtered = filtered.filter((post) => post.kind === category.match.kind);
      else if (category?.match.channel) {
        filtered = filtered.filter((post) => post.channel === category.match.channel);
      }
    }
    if (input.view === "trending") {
      filtered = filtered.filter((post) => now - Date.parse(post.createdAt) < 72 * 3_600_000);
    }
    if (input.view === "campus" && input.campusSlug) {
      filtered = filtered.filter((post) => post.campusSlug === input.campusSlug);
    }
    if (input.view === "following") {
      filtered = filtered.filter((post) => friendIds.has(post.authorId));
    }

    return filtered
      .map((post) => {
        const profile = byUser.get(post.authorId);
        const sameCampus = Boolean(
          input.campusSlug && profile?.campusSlug === input.campusSlug,
        );

        /* "For you" leans towards your campus and your friends. The other views
           are chronological-ish so they stay predictable. */
        const boost =
          input.view === "for-you"
            ? 1 + (sameCampus ? 0.6 : 0) + (friendIds.has(post.authorId) ? 0.8 : 0)
            : 1;

        const top = comments
          .filter((comment) => comment.postId === post.id)
          .sort((a, b) => b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt))[0];

        return {
          post,
          author: profile
            ? {
                userId: profile.userId,
                handle: profile.handle,
                displayName: profile.displayName,
                avatarEmoji: profile.avatarEmoji,
                campusSlug: profile.campusSlug,
                termsInCity: profile.termsInCity,
                verified: profile.studentVerifiedAt !== null,
              }
            : null,
          sameCampus,
          score:
            input.view === "trending"
              ? post.upvotes + post.commentCount * 2
              : rank(post, boost, now),
          minutesAgo: (now - Date.parse(post.createdAt)) / 60_000,
          topComment: top
            ? {
                body: top.body,
                author: byUser.get(top.authorId)?.displayName ?? null,
                upvotes: top.upvotes,
              }
            : null,
        };
      })
      .sort((a, b) => b.score - a.score);
  },
);

/* -------------------------------------------------------------------------- */
/* Chat                                                                        */
/* -------------------------------------------------------------------------- */

export const loadChannel = cache(async (citySlug: string, channel: string) => {
  const [messages, profiles] = await Promise.all([
    findMany("chat", (row) => row.citySlug === citySlug && row.channel === channel),
    findMany("profiles", () => true),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));

  return messages
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((message) => ({
      message,
      author: byUser.get(message.authorId) ?? null,
    }));
});

/**
 * How much a student has missed in a channel since they last looked.
 *
 * The "since" is passed in rather than tracked server-side: a read cursor per
 * user per channel is a lot of write traffic for a feature whose whole value is
 * approximate, and being told "about 140 messages" is exactly as useful as
 * being told 143.
 */
export async function unreadCount(
  citySlug: string,
  channel: string,
  since: string | null,
): Promise<number> {
  if (!since) return 0;
  const messages = await findMany(
    "chat",
    (row) => row.citySlug === citySlug && row.channel === channel && row.createdAt > since,
  );
  return messages.length;
}

/* -------------------------------------------------------------------------- */
/* Trending                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The three-to-five items worth knowing, for the Home prompt and the top of the
 * feed. Deterministic — no model.
 */
export async function loadTrending(citySlug: string, limit = 4): Promise<CommunityPost[]> {
  const posts = await findMany(
    "posts",
    (row) => row.citySlug === citySlug && row.hiddenAt === null,
  );

  const now = Date.now();
  return posts
    .filter((post) => now - Date.parse(post.createdAt) < 72 * 3_600_000)
    .sort((a, b) => rank(b, 1, now) - rank(a, 1, now))
    .slice(0, limit);
}
