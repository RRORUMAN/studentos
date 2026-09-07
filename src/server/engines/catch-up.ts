import type { ChatMessageRow, CommunityPost } from "@/domain/types";

/**
 * ============================================================================
 * PULSE ENGINE — feed ranking, categories, poll tallies, catch-up
 * ----------------------------------------------------------------------------
 * Every deterministic decision the community surface makes, in one pure
 * module with no I/O, so each one has a unit test and a bad feed can be traced
 * to a number rather than to a prompt.
 *
 * It lives in `catch-up.ts` for an ownership reason rather than a design one:
 * the community work owns this engine file and no other, and the ranking
 * needs to be importable from Node tests, which `queries/loop.ts` (marked
 * `server-only`) is not. Rename to `pulse.ts` when the ownership boundary
 * allows it; nothing imports this module by a name that would break.
 *
 * Ranking is Tier 0 and deliberately simple: recency, votes and proximity to
 * the reader. A young community does not have enough signal for anything
 * cleverer, and an opaque algorithm on a feed of forty posts is a way to hide
 * the fact that there are only forty posts.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Views                                                                       */
/* -------------------------------------------------------------------------- */

export type FeedView = "for-you" | "campus" | "city" | "following" | "trending";

export const feedViews: readonly { value: FeedView; label: string; hint: string }[] = [
  { value: "for-you", label: "For you", hint: "Your campus, your people and your interests first." },
  { value: "campus", label: "Campus", hint: "Only posts from your university." },
  { value: "city", label: "City", hint: "Everything in the city, useful and recent first." },
  { value: "following", label: "Following", hint: "People you follow and your friends." },
  { value: "trending", label: "Trending", hint: "What took off in the last three days." },
];

export const TRENDING_WINDOW_MS = 72 * 3_600_000;

/**
 * Who is reading, reduced to the four signals the ranking uses. Built once by
 * the query and passed in, so the engine never touches a table.
 */
export type FeedViewer = {
  userId: string;
  campusSlug: string | null;
  friendIds: ReadonlySet<string>;
  followingIds: ReadonlySet<string>;
  interests: readonly string[];
};

/**
 * Which profile interests a channel speaks to. "For you" uses this to lift a
 * #football post for someone who said they play football — a channel-to-tag
 * map rather than a model, so the lift is explainable on the card.
 */
export const channelInterests: Record<string, readonly string[]> = {
  "cheap-eats": ["food", "cheap-food", "cooking"],
  "events-tonight": ["nightlife", "music", "concerts", "festivals", "clubbing"],
  nightlife: ["nightlife", "clubbing"],
  football: ["football", "fitness"],
  gym: ["gym", "fitness", "running"],
  travel: ["travel"],
  study: ["study-groups"],
  language: ["language-exchange"],
  jobs: ["networking", "business", "startups"],
  campus: ["study-groups", "networking"],
  deals: ["cheap-food"],
};

/**
 * Hacker-News-style gravity. 1.6 keeps a day-old post competitive and a
 * week-old one effectively gone, which is right for a feed about what is
 * happening in a city this week.
 */
export function rankPost(post: CommunityPost, boost: number, now: number): number {
  const ageHours = Math.max(0, (now - Date.parse(post.createdAt)) / 3_600_000);
  const votes = post.upvotes + post.commentCount * 2;
  return ((votes + 1) * boost) / Math.pow(ageHours + 2, 1.6);
}

/** Raw engagement, for Trending: what people actually reacted to. */
export function engagement(post: CommunityPost): number {
  return post.upvotes + post.commentCount * 2;
}

/**
 * The reasons a post is lifted in "For you", as facts the card can print.
 * Campus and friends are the strongest signals; follows and interests are
 * softer because they are cheaper to give.
 */
export function forYouSignals(
  post: CommunityPost,
  viewer: FeedViewer,
): { sameCampus: boolean; friend: boolean; following: boolean; interest: boolean } {
  const interests = new Set(viewer.interests);
  return {
    sameCampus: Boolean(viewer.campusSlug && post.campusSlug === viewer.campusSlug),
    friend: viewer.friendIds.has(post.authorId),
    following: viewer.followingIds.has(post.authorId),
    interest: (channelInterests[post.channel] ?? []).some((tag) => interests.has(tag)),
  };
}

export function forYouBoost(post: CommunityPost, viewer: FeedViewer): number {
  const s = forYouSignals(post, viewer);
  return 1 + (s.sameCampus ? 0.6 : 0) + (s.friend ? 0.8 : 0) + (s.following ? 0.7 : 0) + (s.interest ? 0.4 : 0);
}

/** Whether a post belongs in a view at all. Boosting is separate. */
export function inView(post: CommunityPost, view: FeedView, viewer: FeedViewer, now: number): boolean {
  if (post.hiddenAt !== null) return false;
  switch (view) {
    case "for-you":
    case "city":
      return true;
    case "campus":
      return Boolean(viewer.campusSlug) && post.campusSlug === viewer.campusSlug;
    case "following":
      return viewer.friendIds.has(post.authorId) || viewer.followingIds.has(post.authorId);
    case "trending":
      return now - Date.parse(post.createdAt) < TRENDING_WINDOW_MS;
  }
}

export function scorePost(post: CommunityPost, view: FeedView, viewer: FeedViewer, now: number): number {
  if (view === "trending") {
    /* Engagement first; the tiny recency term only breaks ties so two posts
       with the same votes show newest first. */
    return engagement(post) + 1 / (1 + Math.max(0, now - Date.parse(post.createdAt)) / 3_600_000);
  }
  return rankPost(post, view === "for-you" ? forYouBoost(post, viewer) : 1, now);
}

/** Filter and order posts for a view. Pure; the query decorates the result. */
export function rankFeed(
  posts: readonly CommunityPost[],
  view: FeedView,
  viewer: FeedViewer,
  now: number,
): { post: CommunityPost; score: number }[] {
  return posts
    .filter((post) => inView(post, view, viewer, now))
    .map((post) => ({ post, score: scorePost(post, view, viewer, now) }))
    .sort((a, b) => b.score - a.score || b.post.createdAt.localeCompare(a.post.createdAt));
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One category model for the whole surface. A category is a set of post
 * *kinds* and/or *channels*; both are one chip to a student. "Events" is the
 * event kind plus the #events-tonight room, "Deals" the deal kind plus #deals,
 * and "Exchange" is the #buy-sell room — so a chip never has a twin.
 */
export type PulseCategory = {
  value: string;
  label: string;
  kinds?: readonly CommunityPost["kind"][];
  channels?: readonly string[];
  /** The chat room that matches the chip, for the cross-link. */
  chat: string | null;
  /** The channel a new post in this category lands in. */
  postChannel: string;
  /** The kind a new post in this category gets, unless the composer changes it. */
  postKind: CommunityPost["kind"];
};

export const pulseCategories: readonly PulseCategory[] = [
  { value: "questions", label: "Questions", kinds: ["question"], chat: "questions", postChannel: "questions", postKind: "question" },
  { value: "events", label: "Events", kinds: ["event"], channels: ["events-tonight"], chat: "events-tonight", postChannel: "events-tonight", postKind: "event" },
  { value: "deals", label: "Deals", kinds: ["deal"], channels: ["deals"], chat: "deals", postChannel: "deals", postKind: "deal" },
  { value: "recommendations", label: "Recommendations", kinds: ["recommendation"], chat: null, postChannel: "general", postKind: "recommendation" },
  { value: "anyone-down", label: "Anyone down", kinds: ["anyone-down"], chat: null, postChannel: "general", postKind: "anyone-down" },
  { value: "housing", label: "Housing", channels: ["housing"], chat: "housing", postChannel: "housing", postKind: "post" },
  { value: "travel", label: "Travel", channels: ["travel"], chat: "travel", postChannel: "travel", postKind: "post" },
  { value: "study", label: "Study", channels: ["study"], chat: "study", postChannel: "study", postKind: "post" },
  { value: "jobs", label: "Jobs", channels: ["jobs"], chat: "jobs", postChannel: "jobs", postKind: "post" },
  { value: "exchange", label: "Exchange", channels: ["buy-sell"], chat: "buy-sell", postChannel: "buy-sell", postKind: "post" },
  { value: "general", label: "General", channels: ["general"], chat: "general", postChannel: "general", postKind: "post" },
];

export function matchesCategory(post: CommunityPost, category: PulseCategory): boolean {
  if (category.kinds?.includes(post.kind)) return true;
  if (category.channels?.includes(post.channel)) return true;
  return false;
}

export function categoryFor(value: string | null | undefined): PulseCategory | null {
  if (!value) return null;
  return pulseCategories.find((entry) => entry.value === value) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Polls                                                                       */
/* -------------------------------------------------------------------------- */

export type PollTally = {
  total: number;
  /** The viewer's option, or null when they have not voted. */
  myVote: number | null;
  options: { index: number; label: string; count: number; share: number }[];
};

/**
 * Count a poll.
 *
 * One vote per person: if the rows ever carry two for one user, the latest
 * wins, so a change of vote is always counted once. Votes pointing at an
 * option that does not exist are ignored rather than crashing the card.
 */
export function tallyPoll(
  options: readonly string[],
  votes: readonly { userId: string; optionIndex: number; createdAt?: string }[],
  viewerId: string | null,
): PollTally {
  const latest = new Map<string, { optionIndex: number; createdAt: string }>();
  for (const vote of votes) {
    if (!Number.isInteger(vote.optionIndex) || vote.optionIndex < 0 || vote.optionIndex >= options.length) continue;
    const at = vote.createdAt ?? "";
    const current = latest.get(vote.userId);
    if (!current || at >= current.createdAt) latest.set(vote.userId, { optionIndex: vote.optionIndex, createdAt: at });
  }

  const counts = options.map(() => 0);
  for (const vote of latest.values()) counts[vote.optionIndex] += 1;
  const total = counts.reduce((sum, count) => sum + count, 0);

  return {
    total,
    myVote: viewerId ? (latest.get(viewerId)?.optionIndex ?? null) : null,
    options: options.map((label, index) => ({
      index,
      label,
      count: counts[index],
      share: total === 0 ? 0 : Math.round((counts[index] / total) * 100),
    })),
  };
}

/** Validate the options a student typed. Returns the cleaned list or an error. */
export function normalisePollOptions(
  raw: readonly string[],
): { ok: true; options: string[] } | { ok: false; message: string } {
  const options = raw.map((option) => option.trim()).filter((option) => option.length > 0);
  if (options.length < 2) return { ok: false, message: "A poll needs at least two options." };
  if (options.length > 4) return { ok: false, message: "Four options at most." };
  if (options.some((option) => option.length > 60)) return { ok: false, message: "Keep each option under 60 characters." };
  const distinct = new Set(options.map((option) => option.toLowerCase()));
  if (distinct.size !== options.length) return { ok: false, message: "Two options say the same thing." };
  return { ok: true, options };
}

/* -------------------------------------------------------------------------- */
/* Catch me up                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * "You missed 164 posts and 40 messages. Here are five worth knowing."
 *
 * Chosen by a plain score — votes, replies, recency, and whether the post is a
 * deal, an event or an unanswered question, which are the kinds a student most
 * regrets missing. Busy chat rooms get a line too. Each line links to the post
 * or the room it came from, so nothing here is a claim the product is making;
 * it is a pointer to something students said, presented as such.
 *
 * The paid tier gets the same lines with a model writing one sentence over
 * them. The selection never changes with plan.
 */
export type CatchUpLine = {
  kind: "post" | "channel";
  /** Post id, or the channel slug. */
  id: string;
  /** Equals `id`; kept so older callers keyed on it keep working. */
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
  /** Slug -> label for chat rooms; unknown rooms render as #slug. */
  channelLabels?: Record<string, string>;
  limit?: number;
}): CatchUp {
  const limit = input.limit ?? 5;
  const recentPosts = input.posts.filter((post) => post.createdAt > input.since && post.hiddenAt === null);
  const recentChat = input.chat.filter((message) => message.createdAt > input.since);

  const scoredPosts = recentPosts
    .map((post) => {
      let score = post.upvotes + post.commentCount * 2;
      let because = `${post.upvotes} ${post.upvotes === 1 ? "upvote" : "upvotes"}`;

      if (post.kind === "deal") {
        score += 12;
        because = "A deal students reported";
      } else if (post.kind === "event") {
        score += 10;
        because = "Something on soon";
      } else if (post.kind === "anyone-down") {
        score += 8;
        because = "Someone is looking for people";
      } else if (post.kind === "poll") {
        score += 4;
        because = "A poll you can still vote in";
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
    .sort((a, b) => b.score - a.score);

  /* Rooms with real traffic. Three messages is the floor: one message is not
     a conversation, and listing it teaches people to ignore the card. */
  const perChannel = new Map<string, number>();
  for (const message of recentChat) perChannel.set(message.channel, (perChannel.get(message.channel) ?? 0) + 1);
  const busyChannels = [...perChannel.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  const postLines: CatchUpLine[] = scoredPosts
    .slice(0, Math.max(0, limit - busyChannels.length))
    .map(({ post, because }) => ({
      kind: "post",
      id: post.id,
      postId: post.id,
      title: post.title,
      channel: post.channel,
      because,
      href: `/pulse/${post.id}`,
    }));

  const channelLines: CatchUpLine[] = busyChannels.map(([channel, count]) => ({
    kind: "channel",
    id: channel,
    postId: channel,
    title: input.channelLabels?.[channel] ?? `#${channel}`,
    channel,
    because: `${count} new messages`,
    href: `/pulse/chat/${channel}`,
  }));

  return {
    missed: recentPosts.length + recentChat.length,
    missedPosts: recentPosts.length,
    missedMessages: recentChat.length,
    lines: [...postLines, ...channelLines].slice(0, limit),
  };
}
