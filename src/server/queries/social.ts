import "server-only";

import { cache } from "react";

import { describeProximity } from "@/domain/places";
import { loadPlacesByIds } from "@/server/queries/places";
import type { Invite, Profile } from "@/domain/types";
import { findMany, findOne } from "@/server/db";
import { fmtWhen } from "@/lib/dates";
import { money } from "@/lib/utils";

/**
 * ============================================================================
 * SOCIAL QUERIES — visibility and relationships
 * ----------------------------------------------------------------------------
 * The access rules for anything one student can see about another.
 *
 * These live here rather than in `actions/` for a specific reason: a module
 * carrying the `"use server"` directive exports every async function as a
 * callable RPC endpoint. A visibility *predicate* exported that way becomes a
 * public oracle anyone can probe — "can user X see invite Y?" answered for
 * free, from a browser console. Rules that decide access must not themselves
 * be reachable from the client.
 *
 * One definition per rule, used by both the list query and the write action.
 * Two copies is how a feed filter and a write endpoint end up disagreeing,
 * which is the shape of most access-control bugs.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Friends, follows, blocks                                                    */
/* -------------------------------------------------------------------------- */

/** Accepted friendships, in both directions, as a set of user ids. */
export const loadFriendIds = cache(async (userId: string): Promise<Set<string>> => {
  const rows = await findMany(
    "friendships",
    (row) =>
      row.status === "accepted" && (row.requesterId === userId || row.addresseeId === userId),
  );

  return new Set(
    rows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId)),
  );
});

/** People this student follows. One-directional; nothing is implied back. */
export const loadFollowingIds = cache(async (userId: string): Promise<Set<string>> => {
  const rows = await findMany("follows", (row) => row.followerId === userId);
  return new Set(rows.map((row) => row.followeeId));
});

/** People following this student. */
export const loadFollowerIds = cache(async (userId: string): Promise<Set<string>> => {
  const rows = await findMany("follows", (row) => row.followeeId === userId);
  return new Set(rows.map((row) => row.followerId));
});

/**
 * Everyone this student is blocked from, in either direction. A block is
 * symmetric everywhere it is read: neither side sees the other's posts, plans
 * or profile.
 */
export const loadBlockedIds = cache(async (userId: string): Promise<Set<string>> => {
  const rows = await findMany(
    "friendships",
    (row) =>
      row.status === "blocked" && (row.requesterId === userId || row.addresseeId === userId),
  );
  return new Set(rows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId)));
});

/** True when the two users have blocked each other in either direction. */
export async function isBlocked(a: string, b: string): Promise<boolean> {
  const row = await findOne(
    "friendships",
    (entry) =>
      entry.status === "blocked" &&
      ((entry.requesterId === a && entry.addresseeId === b) ||
        (entry.requesterId === b && entry.addresseeId === a)),
  );
  return Boolean(row);
}

export type FriendshipState = "none" | "pending-sent" | "pending-received" | "friends" | "blocked";

/** The relationship between the viewer and another student. */
export async function friendshipWith(
  userId: string,
  otherId: string,
): Promise<FriendshipState> {
  const row = await findOne(
    "friendships",
    (entry) =>
      (entry.requesterId === userId && entry.addresseeId === otherId) ||
      (entry.requesterId === otherId && entry.addresseeId === userId),
  );

  if (!row) return "none";
  if (row.status === "blocked") return "blocked";
  if (row.status === "accepted") return "friends";
  return row.requesterId === userId ? "pending-sent" : "pending-received";
}

/* -------------------------------------------------------------------------- */
/* Direct messages                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Whether two students may message each other directly.
 *
 * Friends always can, wherever they are. Otherwise the rule is "same city and
 * not blocked": the product is about the people around you, and a DM from a
 * stranger three countries away is exactly the message nobody asked for. A
 * private profile can only be messaged by its friends.
 *
 * Used by the DM channel access check and by `startDirectMessage`, so the hub,
 * the send action and the button all agree.
 */
export async function canMessage(
  viewerId: string,
  otherId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (viewerId === otherId) return { ok: false, message: "That is you." };
  if (await isBlocked(viewerId, otherId)) return { ok: false, message: "You cannot message this student." };

  const friends = await loadFriendIds(viewerId);
  if (friends.has(otherId)) return { ok: true };

  const [me, other] = await Promise.all([
    findOne("profiles", (row) => row.userId === viewerId),
    findOne("profiles", (row) => row.userId === otherId),
  ]);
  if (!me || !other || other.onboardedAt === null) return { ok: false, message: "No such student." };
  if (other.privacy.profileVisibility === "private" || other.privacy.profileVisibility === "friends") {
    return { ok: false, message: "This student only takes messages from friends." };
  }
  if (me.citySlug !== other.citySlug) {
    return { ok: false, message: "Direct messages are for students in your city, or friends anywhere." };
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Invite visibility                                                           */
/* -------------------------------------------------------------------------- */

export type InviteAudience = "friends" | "campus" | "city";

/**
 * Whether a student may see — and therefore join — an invite.
 *
 * Called by the Anyone Down? list *and* by `respondToInvite`. Filtering the
 * feed only hides a friends-only plan from the page; it does not stop someone
 * posting the join action with an id obtained another way, so the rule has to
 * be enforced where the write happens too.
 */
export async function canSeeInvite(
  userId: string,
  invite: { hostId: string; audience: InviteAudience },
): Promise<boolean> {
  if (invite.hostId === userId) return true;
  if (await isBlocked(userId, invite.hostId)) return false;
  if (invite.audience === "city") return true;

  if (invite.audience === "campus") {
    const [me, host] = await Promise.all([
      findOne("profiles", (row) => row.userId === userId),
      findOne("profiles", (row) => row.userId === invite.hostId),
    ]);
    return Boolean(me?.campusSlug && me.campusSlug === host?.campusSlug);
  }

  return (await loadFriendIds(userId)).has(invite.hostId);
}

/* -------------------------------------------------------------------------- */
/* Invite anchors                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The thing an invite is attached to, rendered from the live row — never a
 * copy. A price change on the event shows on a three-day-old invite too.
 */
export type InviteAnchorCard = {
  kind: "place" | "event" | "plan";
  id: string;
  title: string;
  meta: string;
  /** The public venue label, for the "where" line. Never a home address. */
  venue: string | null;
  href: string;
};

export async function resolveInviteAnchor(
  invite: Pick<Invite, "anchorKind" | "anchorId" | "citySlug">,
  where: { currency?: string; locale?: string; timeZone: string },
  now: Date = new Date(),
): Promise<InviteAnchorCard | null> {
  if (!invite.anchorKind || !invite.anchorId) return null;
  const id = invite.anchorId;

  switch (invite.anchorKind) {
    case "event": {
      const event = await findOne("events", (row) => row.id === id);
      if (!event) return null;
      const when = fmtWhen(event.startsAt, where.timeZone, now);
      return {
        kind: "event",
        id,
        title: event.title,
        meta: `${when} · ${event.priceCents === 0 ? "Free" : money(event.priceCents / 100, where)}`,
        venue: event.venue,
        href: `/events/${id}`,
      };
    }
    case "place": {
      const { places } = await loadPlacesByIds([id], invite.citySlug);
      const place = places.get(id);
      /* A place that no longer resolves returns null, and the invite renders
         without an anchor card rather than with a name we cached. */
      if (!place) return null;
      return {
        kind: "place",
        id,
        title: place.name,
        meta: `${place.category} · ${describeProximity(place.proximity)}`,
        venue: place.name,
        href: `/discover/${id}`,
      };
    }
    case "plan": {
      const plan = await findOne("plans", (row) => row.id === id);
      if (!plan) return null;
      const first = plan.items[0];
      return {
        kind: "plan",
        id,
        title: plan.title,
        meta: `${plan.items.length} ${plan.items.length === 1 ? "stop" : "stops"}${
          plan.budgetCents !== null ? ` · ${money(plan.budgetCents / 100, where)} budget` : ""
        }`,
        venue: first ? `${first.time} ${first.title}` : null,
        href: `/plans/${id}`,
      };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Profile visibility                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The shape of another student, with the private fields structurally absent.
 *
 * `homePoint` is not omitted by convention here — it is not in the type, so no
 * amount of careless spreading can put it on the wire.
 */
export type PublicProfile = {
  userId: string;
  handle: string;
  displayName: string;
  avatarEmoji: string;
  bio: string | null;
  citySlug: string | null;
  campusSlug: string | null;
  interests: readonly string[];
  verified: boolean;
  termsInCity: number;
};

/**
 * Project a profile down to what `viewer` is allowed to see, honouring the
 * owner's privacy settings. Returns null when they should not appear at all.
 */
export async function visibleProfile(
  viewerId: string,
  profile: Profile,
): Promise<PublicProfile | null> {
  if (profile.userId === viewerId) return project(profile, true, true, true);

  if (profile.privacy.profileVisibility === "private") return null;
  if (await isBlocked(viewerId, profile.userId)) return null;

  if (profile.privacy.profileVisibility === "friends") {
    const friends = await loadFriendIds(viewerId);
    if (!friends.has(profile.userId)) return null;
  }

  if (profile.privacy.profileVisibility === "campus") {
    const me = await findOne("profiles", (row) => row.userId === viewerId);
    const sameCampus = Boolean(me?.campusSlug && me.campusSlug === profile.campusSlug);
    const friends = await loadFriendIds(viewerId);
    if (!sameCampus && !friends.has(profile.userId)) return null;
  }

  return project(
    profile,
    profile.privacy.showCity,
    profile.privacy.showCampus,
    profile.privacy.showInterests,
  );
}

function project(
  profile: Profile,
  showCity: boolean,
  showCampus: boolean,
  showInterests: boolean,
): PublicProfile {
  return {
    userId: profile.userId,
    handle: profile.handle,
    displayName: profile.displayName,
    avatarEmoji: profile.avatarEmoji,
    bio: profile.bio,
    citySlug: showCity ? profile.citySlug : null,
    campusSlug: showCampus ? profile.campusSlug : null,
    interests: showInterests ? profile.interests : [],
    verified: profile.studentVerifiedAt !== null,
    termsInCity: profile.termsInCity,
  };
}

/* -------------------------------------------------------------------------- */
/* Discoverable students                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Students who could plausibly be suggested to this one.
 *
 * Matching is on campus, city and shared interests — never on location. There
 * is no coordinate in this function and there is no live-position table for one
 * to come from. `discoverable: false` removes a student entirely.
 */
export async function suggestedPeople(input: {
  viewerId: string;
  citySlug: string;
  campusSlug: string | null;
  interests: readonly string[];
  limit?: number;
}): Promise<{ profile: PublicProfile; shared: string[]; sameCampus: boolean }[]> {
  const [profiles, friends] = await Promise.all([
    findMany(
      "profiles",
      (row) =>
        row.userId !== input.viewerId &&
        row.citySlug === input.citySlug &&
        row.privacy.discoverable &&
        row.onboardedAt !== null,
    ),
    loadFriendIds(input.viewerId),
  ]);

  const wanted = new Set(input.interests);
  const out: { profile: PublicProfile; shared: string[]; sameCampus: boolean }[] = [];

  for (const profile of profiles) {
    if (friends.has(profile.userId)) continue;

    const visible = await visibleProfile(input.viewerId, profile);
    if (!visible) continue;

    const shared = profile.interests.filter((interest) => wanted.has(interest));
    const sameCampus = Boolean(input.campusSlug && profile.campusSlug === input.campusSlug);

    /* A suggestion needs a *reason*. "Someone else in Madrid" is not one, and
       showing it teaches people to ignore the whole surface. */
    if (shared.length === 0 && !sameCampus) continue;

    out.push({ profile: visible, shared, sameCampus });
  }

  return out
    .sort(
      (a, b) =>
        Number(b.sameCampus) - Number(a.sameCampus) || b.shared.length - a.shared.length,
    )
    .slice(0, input.limit ?? 12);
}
