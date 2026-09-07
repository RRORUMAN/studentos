import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CommunityPost } from "../../src/domain/types.ts";
import {
  catchUp,
  categoryFor,
  engagement,
  feedViews,
  forYouBoost,
  inView,
  matchesCategory,
  pulseCategories,
  rankFeed,
  rankPost,
  scorePost,
  TRENDING_WINDOW_MS,
  type FeedViewer,
} from "../../src/server/engines/catch-up.ts";

/**
 * ============================================================================
 * PULSE FEED RANKING
 * ----------------------------------------------------------------------------
 * The five views are the product's opinion about what a student should see,
 * so each one is pinned down here rather than left to be discovered in a
 * screenshot. The two that were silently broken before — City being identical
 * to For you, and Campus showing the whole city to a student with no campus —
 * have tests of their own.
 * ============================================================================
 */

const NOW = Date.parse("2026-09-07T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

function post(overrides: Partial<CommunityPost> & { id: string }): CommunityPost {
  return {
    citySlug: "madrid",
    campusSlug: null,
    channel: "general",
    authorId: "stranger",
    kind: "post",
    title: `Post ${overrides.id}`,
    body: null,
    placeId: null,
    upvotes: 0,
    commentCount: 0,
    hiddenAt: null,
    createdAt: hoursAgo(2),
    ...overrides,
  };
}

function viewer(overrides: Partial<FeedViewer> = {}): FeedViewer {
  return {
    userId: "me",
    campusSlug: "ucm",
    friendIds: new Set<string>(),
    followingIds: new Set<string>(),
    interests: [],
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */

describe("rankPost", () => {
  it("puts a good post from this morning above a great one from last week", () => {
    const fresh = post({ id: "fresh", upvotes: 8, createdAt: hoursAgo(3) });
    const old = post({ id: "old", upvotes: 90, createdAt: hoursAgo(24 * 7) });
    assert.ok(rankPost(fresh, 1, NOW) > rankPost(old, 1, NOW));
  });

  it("counts a reply for more than an upvote", () => {
    const voted = post({ id: "voted", upvotes: 4 });
    const discussed = post({ id: "discussed", commentCount: 4 });
    assert.ok(rankPost(discussed, 1, NOW) > rankPost(voted, 1, NOW));
  });

  it("never returns a negative or infinite score for a post from the future", () => {
    const future = post({ id: "future", createdAt: new Date(NOW + 3_600_000).toISOString() });
    const score = rankPost(future, 1, NOW);
    assert.ok(Number.isFinite(score) && score > 0);
  });
});

describe("view membership", () => {
  it("City is the whole city, not a personalised feed", () => {
    const rows = [
      post({ id: "a", authorId: "stranger" }),
      post({ id: "b", authorId: "friend", campusSlug: "ucm" }),
    ];
    const me = viewer({ friendIds: new Set(["friend"]) });
    assert.equal(rows.filter((row) => inView(row, "city", me, NOW)).length, 2);
  });

  it("City and For you differ in order, which is what makes them two views", () => {
    /* The bug this replaces: `city` fell through to the same branch as
       `for-you`, so the two tabs returned an identical list. */
    const mine = post({ id: "mine", authorId: "friend", campusSlug: "ucm", upvotes: 3 });
    const theirs = post({ id: "theirs", authorId: "stranger", upvotes: 4 });
    const me = viewer({ friendIds: new Set(["friend"]) });

    const forYou = rankFeed([theirs, mine], "for-you", me, NOW).map((entry) => entry.post.id);
    const city = rankFeed([theirs, mine], "city", me, NOW).map((entry) => entry.post.id);

    assert.deepEqual(forYou, ["mine", "theirs"]);
    assert.deepEqual(city, ["theirs", "mine"]);
  });

  it("Campus is empty for a student with no campus, rather than the whole city", () => {
    const rows = [post({ id: "a", campusSlug: "ucm" }), post({ id: "b", campusSlug: null })];
    const campusless = viewer({ campusSlug: null });
    assert.equal(rows.filter((row) => inView(row, "campus", campusless, NOW)).length, 0);
  });

  it("Campus is only the reader's own campus", () => {
    const rows = [
      post({ id: "mine", campusSlug: "ucm" }),
      post({ id: "other", campusSlug: "uam" }),
      post({ id: "none", campusSlug: null }),
    ];
    const kept = rows.filter((row) => inView(row, "campus", viewer(), NOW)).map((row) => row.id);
    assert.deepEqual(kept, ["mine"]);
  });

  it("Following is follows plus friends", () => {
    const rows = [
      post({ id: "followed", authorId: "author" }),
      post({ id: "friend", authorId: "pal" }),
      post({ id: "stranger", authorId: "nobody" }),
    ];
    const me = viewer({ followingIds: new Set(["author"]), friendIds: new Set(["pal"]) });
    const kept = rows.filter((row) => inView(row, "following", me, NOW)).map((row) => row.id);
    assert.deepEqual(kept, ["followed", "friend"]);
  });

  it("Trending only holds the last three days", () => {
    const recent = post({ id: "recent", createdAt: hoursAgo(70) });
    const stale = post({ id: "stale", createdAt: hoursAgo(80) });
    assert.equal(inView(recent, "trending", viewer(), NOW), true);
    assert.equal(inView(stale, "trending", viewer(), NOW), false);
    assert.equal(TRENDING_WINDOW_MS, 72 * 3_600_000);
  });

  it("Trending ranks by engagement, so an older post that took off still wins", () => {
    const quietAndNew = post({ id: "new", upvotes: 1, createdAt: hoursAgo(1) });
    const loudAndOlder = post({ id: "loud", upvotes: 40, createdAt: hoursAgo(48) });
    const order = rankFeed([quietAndNew, loudAndOlder], "trending", viewer(), NOW).map((entry) => entry.post.id);
    assert.deepEqual(order, ["loud", "new"]);
    assert.equal(engagement(loudAndOlder), 40);
  });

  it("hides a hidden post from every view", () => {
    const hidden = post({ id: "hidden", hiddenAt: hoursAgo(1), campusSlug: "ucm", authorId: "pal" });
    const me = viewer({ friendIds: new Set(["pal"]) });
    for (const view of feedViews) {
      assert.equal(inView(hidden, view.value, me, NOW), false, `${view.value} showed a hidden post`);
    }
  });
});

describe("for-you boost", () => {
  it("is a plain multiplier of 1 when nothing about a post is close to the reader", () => {
    assert.equal(forYouBoost(post({ id: "a" }), viewer()), 1);
  });

  it("lifts campus, friends, follows and interests, friends most", () => {
    const me = viewer({ friendIds: new Set(["pal"]), followingIds: new Set(["author"]), interests: ["football"] });
    const campus = forYouBoost(post({ id: "a", campusSlug: "ucm" }), me);
    const friend = forYouBoost(post({ id: "b", authorId: "pal" }), me);
    const follow = forYouBoost(post({ id: "c", authorId: "author" }), me);
    const interest = forYouBoost(post({ id: "d", channel: "football" }), me);

    for (const boost of [campus, friend, follow, interest]) assert.ok(boost > 1);
    assert.ok(friend > follow, "a friend should outrank a one-way follow");
    assert.ok(follow > interest, "a person should outrank a topic");
  });

  it("compounds, so a friend at your campus beats either alone", () => {
    const me = viewer({ friendIds: new Set(["pal"]) });
    const both = forYouBoost(post({ id: "a", authorId: "pal", campusSlug: "ucm" }), me);
    const one = forYouBoost(post({ id: "b", authorId: "pal" }), me);
    assert.ok(both > one);
  });

  it("only boosts in For you — the other views stay predictable", () => {
    const me = viewer({ friendIds: new Set(["pal"]) });
    const row = post({ id: "a", authorId: "pal", campusSlug: "ucm" });
    assert.equal(scorePost(row, "city", me, NOW), rankPost(row, 1, NOW));
    assert.ok(scorePost(row, "for-you", me, NOW) > scorePost(row, "city", me, NOW));
  });
});

describe("categories", () => {
  it("has no two chips that mean the same thing", () => {
    const labels = pulseCategories.map((entry) => entry.label.toLowerCase());
    assert.equal(new Set(labels).size, labels.length, "duplicate category label");

    /* The old rail had `guides` and `general` both pointing at #general. */
    const generalChips = pulseCategories.filter((entry) => entry.channels?.includes("general"));
    assert.equal(generalChips.length, 1);
  });

  it("puts the events kind and the events room behind one chip", () => {
    const events = categoryFor("events");
    assert.ok(events);
    assert.equal(matchesCategory(post({ id: "a", kind: "event", channel: "general" }), events), true);
    assert.equal(matchesCategory(post({ id: "b", kind: "post", channel: "events-tonight" }), events), true);
    assert.equal(matchesCategory(post({ id: "c", kind: "post", channel: "housing" }), events), false);
  });

  it("maps Exchange to the buy-sell room", () => {
    const exchange = categoryFor("exchange");
    assert.equal(exchange?.chat, "buy-sell");
    assert.equal(matchesCategory(post({ id: "a", channel: "buy-sell" }), exchange!), true);
  });

  it("gives every category a channel to post into", () => {
    for (const category of pulseCategories) {
      assert.ok(category.postChannel.length > 0, `${category.value} has nowhere to post`);
    }
  });

  it("returns null for an unknown chip rather than throwing", () => {
    assert.equal(categoryFor("nonsense"), null);
    assert.equal(categoryFor(null), null);
  });
});

describe("catchUp", () => {
  const since = hoursAgo(24);

  it("counts posts and messages separately and only what came after", () => {
    const result = catchUp({
      posts: [post({ id: "new", createdAt: hoursAgo(2) }), post({ id: "old", createdAt: hoursAgo(48) })],
      chat: [
        { id: "m1", citySlug: "madrid", channel: "general", authorId: "x", body: "hi", replyToId: null, createdAt: hoursAgo(1) },
        { id: "m2", citySlug: "madrid", channel: "general", authorId: "x", body: "old", replyToId: null, createdAt: hoursAgo(40) },
      ],
      since,
      campusSlug: null,
    });

    assert.equal(result.missedPosts, 1);
    assert.equal(result.missedMessages, 1);
    assert.equal(result.missed, 2);
  });

  it("prefers a deal over a plain post with the same votes", () => {
    const result = catchUp({
      posts: [
        post({ id: "plain", kind: "post", upvotes: 5, createdAt: hoursAgo(2) }),
        post({ id: "deal", kind: "deal", upvotes: 5, createdAt: hoursAgo(2) }),
      ],
      chat: [],
      since,
      campusSlug: null,
      limit: 1,
    });

    assert.equal(result.lines[0].id, "deal");
    assert.equal(result.lines[0].because, "A deal students reported");
  });

  it("links every line to its own source", () => {
    const result = catchUp({
      posts: [post({ id: "p1", upvotes: 3, createdAt: hoursAgo(2) })],
      chat: Array.from({ length: 4 }, (_, index) => ({
        id: `m${index}`,
        citySlug: "madrid",
        channel: "housing",
        authorId: "x",
        body: "busy",
        replyToId: null,
        createdAt: hoursAgo(1),
      })),
      since,
      campusSlug: null,
      channelLabels: { housing: "Housing" },
    });

    const postLine = result.lines.find((line) => line.kind === "post");
    const channelLine = result.lines.find((line) => line.kind === "channel");

    assert.equal(postLine?.href, "/pulse/p1");
    assert.equal(channelLine?.href, "/pulse/chat/housing");
    assert.equal(channelLine?.title, "Housing");
    assert.equal(channelLine?.because, "4 new messages");
    for (const line of result.lines) assert.ok(line.href.startsWith("/"), "a line with no source");
  });

  it("ignores a room with one or two messages in it", () => {
    const result = catchUp({
      posts: [],
      chat: [
        { id: "m1", citySlug: "madrid", channel: "gym", authorId: "x", body: "a", replyToId: null, createdAt: hoursAgo(1) },
        { id: "m2", citySlug: "madrid", channel: "gym", authorId: "x", body: "b", replyToId: null, createdAt: hoursAgo(1) },
      ],
      since,
      campusSlug: null,
    });

    assert.equal(result.lines.length, 0);
    assert.equal(result.missedMessages, 2);
  });

  it("never returns more lines than asked for", () => {
    const posts = Array.from({ length: 20 }, (_, index) => post({ id: `p${index}`, upvotes: index, createdAt: hoursAgo(2) }));
    assert.equal(catchUp({ posts, chat: [], since, campusSlug: null, limit: 5 }).lines.length, 5);
  });

  it("says nothing at all when nothing was missed", () => {
    const result = catchUp({ posts: [post({ id: "old", createdAt: hoursAgo(48) })], chat: [], since, campusSlug: null });
    assert.equal(result.missed, 0);
    assert.deepEqual(result.lines, []);
  });
});
