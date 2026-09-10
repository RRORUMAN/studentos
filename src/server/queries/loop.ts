import "server-only";

import { cache } from "react";

import { defaultCityContext, getCampus, resolveCity } from "@/data/cities";
import { describeProximity } from "@/domain/places";
import { loadCityPlaces, loadPlacesByIds } from "@/server/queries/places";
import type { ChatAttachment, CommunityPost, Profile } from "@/domain/types";
import { findMany, findOne } from "@/server/db";
import {
  categoryFor,
  feedViews,
  forYouSignals,
  matchesCategory,
  pulseCategories,
  rankFeed,
  rankPost,
  tallyPoll,
  type FeedView,
  type FeedViewer,
  type PollTally,
  type PulseCategory,
} from "@/server/engines/catch-up";
import { loadBlockedIds, loadFollowingIds, loadFriendIds } from "@/server/queries/social";
import { fmtWhen } from "@/lib/dates";
import { money , priceLabel } from "@/lib/utils";

/**
 * ============================================================================
 * STUDENT PULSE — queries
 * ----------------------------------------------------------------------------
 * Feed assembly for the community surface. The decisions — which posts belong
 * in a view, how they are ordered, how a poll is counted — live in the pure
 * engine (`engines/catch-up.ts`) and are unit-tested there. This module only
 * reads rows and decorates the result with what the card needs to render.
 * ============================================================================
 */

export { feedViews, pulseCategories, categoryFor };
export type { FeedView, PulseCategory, PollTally };

/**
 * Where and when a card is being rendered: the city's currency, its locale and
 * its timezone. Times are formatted here, on the server, in the city's zone —
 * a student in Madrid reading on a laptop still set to Tokyo sees Madrid time,
 * and the server and the first client paint agree.
 */
export type Where = { currency?: string; locale?: string; timeZone: string };

export function whereFor(citySlug: string, profile?: Pick<Profile, "currency" | "locale"> | null): Where {
  const city = resolveCity(citySlug) ?? defaultCityContext;
  return {
    currency: profile?.currency ?? city.currency.code,
    locale: profile?.locale ?? city.locale,
    timeZone: city.timezone,
  };
}

export type LoopAuthor = Pick<
  Profile,
  "userId" | "handle" | "displayName" | "avatarEmoji" | "campusSlug" | "termsInCity"
> & { verified: boolean; campusName: string | null };

/** A thing a post or message points at, rendered from its live row. */
export type AttachmentCard = {
  kind: ChatAttachment["kind"];
  id: string;
  title: string;
  meta: string;
  /** Null when the row exists but has no page of its own yet. */
  href: string | null;
};

export type FeedPost = {
  post: CommunityPost;
  author: LoopAuthor | null;
  /** Set when the author is at the reader's campus. */
  sameCampus: boolean;
  friend: boolean;
  following: boolean;
  /** The post's channel matches one of the reader's interests. */
  interest: boolean;
  mine: boolean;
  score: number;
  /** Measured once here so cards never read the clock during render. */
  minutesAgo: number;
  /** The most-upvoted reply, for question cards. */
  topComment: { body: string; author: string | null; upvotes: number } | null;
  poll: PollTally | null;
  attachment: AttachmentCard | null;
  voted: boolean;
  saved: boolean;
};

/* -------------------------------------------------------------------------- */
/* Feed                                                                        */
/* -------------------------------------------------------------------------- */

export const loadFeed = cache(
  async (input: {
    citySlug: string;
    campusSlug: string | null;
    view: FeedView;
    channel?: string | null;
    category?: string | null;
    userId: string;
  }): Promise<FeedPost[]> => {
    const [posts, profiles, comments, me, friendIds, followingIds, blockedIds, votes, saved] =
      await Promise.all([
        findMany("posts", (row) => row.citySlug === input.citySlug && row.hiddenAt === null),
        findMany("profiles", () => true),
        findMany("comments", (row) => row.hiddenAt === null && row.parentId === null),
        findOne("profiles", (row) => row.userId === input.userId),
        loadFriendIds(input.userId),
        loadFollowingIds(input.userId),
        loadBlockedIds(input.userId),
        findMany("votes", (row) => row.userId === input.userId && row.targetKind === "post"),
        findMany("saved", (row) => row.userId === input.userId && row.kind === "post"),
      ]);

    const viewer: FeedViewer = {
      userId: input.userId,
      campusSlug: input.campusSlug,
      friendIds,
      followingIds,
      interests: me?.interests ?? [],
    };

    const now = Date.now();

    let filtered = posts.filter((post) => !blockedIds.has(post.authorId));
    if (input.channel) filtered = filtered.filter((post) => post.channel === input.channel);
    const category = categoryFor(input.category);
    if (category) filtered = filtered.filter((post) => matchesCategory(post, category));

    const ranked = rankFeed(filtered, input.view, viewer, now);

    const pollIds = new Set(ranked.filter(({ post }) => post.poll && post.poll.length > 0).map(({ post }) => post.id));
    const pollVotes = pollIds.size > 0 ? await findMany("pollVotes", (row) => pollIds.has(row.postId)) : [];

    const context: DecorateContext = {
      byUser: new Map(profiles.map((profile) => [profile.userId, profile])),
      comments,
      pollVotes,
      voted: new Set(votes.map((vote) => vote.targetId)),
      saved: new Set(saved.map((row) => row.targetId)),
      viewer,
      where: whereFor(input.citySlug, me),
      citySlug: input.citySlug,
      now,
    };

    const out: FeedPost[] = [];
    for (const { post, score } of ranked) out.push(await decorate(post, score, context));
    return out;
  },
);

/** One post, decorated the same way the feed is, or null when hidden/missing. */
export async function loadPost(input: {
  id: string;
  userId: string;
  citySlug: string;
  campusSlug: string | null;
}): Promise<FeedPost | null> {
  const post = await findOne("posts", (row) => row.id === input.id && row.hiddenAt === null);
  if (!post) return null;

  const [profiles, comments, me, friendIds, followingIds, blockedIds, votes, saved, pollVotes] =
    await Promise.all([
      findMany("profiles", () => true),
      findMany("comments", (row) => row.postId === post.id && row.hiddenAt === null && row.parentId === null),
      findOne("profiles", (row) => row.userId === input.userId),
      loadFriendIds(input.userId),
      loadFollowingIds(input.userId),
      loadBlockedIds(input.userId),
      findMany("votes", (row) => row.userId === input.userId && row.targetKind === "post" && row.targetId === post.id),
      findMany("saved", (row) => row.userId === input.userId && row.kind === "post" && row.targetId === post.id),
      findMany("pollVotes", (row) => row.postId === post.id),
    ]);

  if (blockedIds.has(post.authorId)) return null;

  const viewer: FeedViewer = {
    userId: input.userId,
    campusSlug: input.campusSlug,
    friendIds,
    followingIds,
    interests: me?.interests ?? [],
  };
  const now = Date.now();

  return decorate(post, rankPost(post, 1, now), {
    byUser: new Map(profiles.map((profile) => [profile.userId, profile])),
    comments,
    pollVotes,
    voted: new Set(votes.map((vote) => vote.targetId)),
    saved: new Set(saved.map((row) => row.targetId)),
    viewer,
    where: whereFor(post.citySlug, me),
    citySlug: post.citySlug,
    now,
  });
}

type DecorateContext = {
  byUser: Map<string, Profile>;
  comments: readonly { postId: string; authorId: string; body: string; upvotes: number; createdAt: string }[];
  pollVotes: readonly { postId: string; userId: string; optionIndex: number; createdAt: string }[];
  voted: ReadonlySet<string>;
  saved: ReadonlySet<string>;
  viewer: FeedViewer;
  where: Where;
  citySlug: string;
  now: number;
};

async function decorate(post: CommunityPost, score: number, context: DecorateContext): Promise<FeedPost> {
  const profile = context.byUser.get(post.authorId);
  const signals = forYouSignals(post, context.viewer);

  const top = context.comments
    .filter((comment) => comment.postId === post.id)
    .sort((a, b) => b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt))[0];

  const poll =
    post.poll && post.poll.length > 0
      ? tallyPoll(
          post.poll,
          context.pollVotes.filter((vote) => vote.postId === post.id),
          context.viewer.userId,
        )
      : null;

  return {
    post,
    author: profile ? toAuthor(profile) : null,
    sameCampus: signals.sameCampus,
    friend: signals.friend,
    following: signals.following,
    interest: signals.interest,
    mine: post.authorId === context.viewer.userId,
    score,
    minutesAgo: (context.now - Date.parse(post.createdAt)) / 60_000,
    topComment: top
      ? {
          body: top.body,
          author: context.byUser.get(top.authorId)?.displayName ?? null,
          upvotes: top.upvotes,
        }
      : null,
    poll,
    attachment: post.attachment ? await resolveAttachment(context.citySlug, post.attachment, context.where) : null,
    voted: context.voted.has(post.id),
    saved: context.saved.has(post.id),
  };
}

export function toAuthor(profile: Profile): LoopAuthor {
  return {
    userId: profile.userId,
    handle: profile.handle,
    displayName: profile.displayName,
    avatarEmoji: profile.avatarEmoji,
    campusSlug: profile.campusSlug,
    termsInCity: profile.termsInCity,
    verified: profile.studentVerifiedAt !== null,
    campusName: profile.campusSlug ? (getCampus(profile.campusSlug)?.shortName ?? profile.universityName) : profile.universityName,
  };
}

/* -------------------------------------------------------------------------- */
/* Attachments                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Turn a reference into a card, from the live row. Returns null when the row
 * has gone, so the caller can say "no longer listed" rather than invent one.
 */
export async function resolveAttachment(
  citySlug: string,
  attachment: ChatAttachment,
  where: Where,
  now: Date = new Date(),
): Promise<AttachmentCard | null> {
  const id = attachment.id;
  const eventWhen = (iso: string) => fmtWhen(iso, where.timeZone, now);
  switch (attachment.kind) {
    case "event": {
      const event = await findOne("events", (row) => row.id === id);
      return event
        ? {
            kind: "event",
            id,
            title: event.title,
            meta: `${eventWhen(event.startsAt)} · ${priceLabel(event.priceCents, where)} · ${event.venue}`,
            href: `/events/${id}`,
          }
        : null;
    }
    case "place": {
      const { places } = await loadPlacesByIds([id], citySlug);
      const place = places.get(id);
      return place
        ? {
            kind: "place",
            id,
            title: place.name,
            meta: `${place.category} · ${describeProximity(place.proximity)}`,
            href: `/discover/${id}`,
          }
        : null;
    }
    case "deal": {
      const deal = await findOne("deals", (row) => row.id === id);
      if (!deal) return null;
      const expired = deal.expiresAt !== null && Date.parse(deal.expiresAt) < Date.now();
      return {
        kind: "deal",
        id,
        title: deal.title,
        meta: `${deal.value} · ${deal.category}${expired ? " · expired" : deal.requiresStudentId ? " · student ID" : ""}`,
        href: deal.placeId ? `/discover/${deal.placeId}` : "/discover?tab=deals",
      };
    }
    case "plan": {
      const plan = await findOne("plans", (row) => row.id === id);
      return plan
        ? { kind: "plan", id, title: plan.title, meta: `${plan.items.length} ${plan.items.length === 1 ? "stop" : "stops"}${plan.budgetCents !== null ? ` · ${money(plan.budgetCents / 100, where)}` : ""}`, href: `/plans/${id}` }
        : null;
    }
    case "invite": {
      const invite = await findOne("invites", (row) => row.id === id);
      if (!invite) return null;
      const going = (await findMany("inviteResponses", (row) => row.inviteId === id && row.status === "in")).length;
      const closed = Date.parse(invite.closesAt) < Date.now();
      return {
        kind: "invite",
        id,
        title: invite.title,
        meta: closed ? "Closed" : `${eventWhen(invite.startsAt)} · ${going} in · ${Math.max(0, invite.capacity - going)} spots`,
        href: `/anyone-down/${id}`,
      };
    }
    case "listing": {
      const listing = await findOne("listings", (row) => row.id === id);
      return listing
        ? {
            kind: "listing",
            id,
            title: listing.title,
            meta: `${listing.priceCents === 0 ? "Free" : money(listing.priceCents / 100, where)} · ${listing.meetArea}${listing.status !== "active" ? ` · ${listing.status}` : ""}`,
            href: `/exchange/${id}`,
          }
        : null;
    }
    case "poll": {
      const poll = await findOne("chatPolls", (row) => row.id === id);
      return poll ? { kind: "poll", id, title: poll.question, meta: `${poll.options.length} options`, href: `/pulse/chat/${poll.channel}` } : null;
    }
    case "mission": {
      const mission = await findOne("missions", (row) => row.id === id);
      return mission
        ? { kind: "mission", id, title: `${mission.emoji} ${mission.title}`, meta: mission.status, href: `/missions/${id}` }
        : null;
    }
    case "opportunity": {
      const opportunity = await findOne("opportunities", (row) => row.id === id);
      if (!opportunity || opportunity.moderation !== "published") return null;
      /* Pay is printed only where the posting stated it. "Pay not stated" is
         the honest meta line, and a chip is exactly where a guessed figure
         would be most convincing and least checkable. */
      const pay = opportunity.pay
        ? `${money(opportunity.pay.minCents / 100, where)} ${opportunity.pay.period === "fixed" ? "for the job" : `per ${opportunity.pay.period}`}`
        : "Pay not stated";
      return {
        kind: "opportunity",
        id,
        title: opportunity.title,
        meta: `${pay} · ${opportunity.area ?? opportunity.citySlug}`,
        href: `/work/${id}`,
      };
    }
  }
}

/**
 * What a student can attach to a post: upcoming events, places, live deals
 * and active listings in their city. Capped per kind so the picker stays a
 * picker and not a second Discover page.
 */
export async function loadAttachables(citySlug: string, where: Where): Promise<AttachmentCard[]> {
  const now = Date.now();
  const eventWhen = (iso: string) => fmtWhen(iso, where.timeZone, new Date(now));
  const [events, deals, listings] = await Promise.all([
    findMany("events", (row) => row.citySlug === citySlug && Date.parse(row.startsAt) > now),
    findMany("deals", (row) => row.citySlug === citySlug && (row.expiresAt === null || Date.parse(row.expiresAt) > now)),
    findMany("listings", (row) => row.citySlug === citySlug && row.status === "active"),
  ]);

  /* The attachment picker: what a student can drop into a message. Provider
     rows, ordered by the value band the domain computed, and simply empty when
     no provider answered — an attachment list that fails to load is a missing
     list, not a claim that the city has nowhere in it. */
  const nearbyPlaces = await loadCityPlaces({ citySlug, radiusMetres: 2_500, limit: 40 });
  const bandOrder = { strong: 0, good: 1, mixed: 2, insufficient: 3 } as const;
  const places = (nearbyPlaces.ok ? nearbyPlaces.places : [])
    .slice()
    .sort(
      (a, b) =>
        bandOrder[a.value.band] - bandOrder[b.value.band] ||
        a.proximity.metres - b.proximity.metres,
    )
    .slice(0, 16);

  return [
    ...events
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 16)
      .map<AttachmentCard>((event) => ({
        kind: "event",
        id: event.id,
        title: event.title,
        meta: `${eventWhen(event.startsAt)} · ${priceLabel(event.priceCents, where)}`,
        href: `/events/${event.id}`,
      })),
    ...places.map<AttachmentCard>((place) => ({
      kind: "place",
      id: place.id,
      title: place.name,
      meta: `${place.category} · ${describeProximity(place.proximity)}`,
      href: `/discover/${place.id}`,
    })),
    ...deals.slice(0, 16).map<AttachmentCard>((deal) => ({
      kind: "deal",
      id: deal.id,
      title: deal.title,
      meta: `${deal.value} · ${deal.category}`,
      href: deal.placeId ? `/discover/${deal.placeId}` : "/discover?tab=deals",
    })),
    ...listings
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 16)
      .map<AttachmentCard>((listing) => ({
        kind: "listing",
        id: listing.id,
        title: listing.title,
        meta: `${listing.priceCents === 0 ? "Free" : money(listing.priceCents / 100, where)} · ${listing.meetArea}`,
        href: `/exchange/${listing.id}`,
      })),
  ];
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
    .sort((a, b) => rankPost(b, 1, now) - rankPost(a, 1, now))
    .slice(0, limit);
}
