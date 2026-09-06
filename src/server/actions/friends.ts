"use server";

import { revalidatePath } from "next/cache";

import { findOne, insert, newId, nowIso, remove, transaction, update } from "@/server/db";
import { limits, rateLimit } from "@/server/rate-limit";
import { recordOutcome } from "@/server/actions/insight";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * FRIENDS
 * ----------------------------------------------------------------------------
 * Requests, acceptance, removal and blocking.
 *
 * Nothing "friends-aware" in the product worked before this existed: the
 * recommendation scorer has a friends signal, invites have a friends audience,
 * and the feed has a Following view — all of which were permanently empty
 * because there was no way to become friends.
 *
 * Blocking is deliberately asymmetric and total. A blocked pair cannot see each
 * other's profiles, plans or suggestions, and the block is stored as a
 * friendship row so a single lookup answers both "are we friends?" and "are we
 * blocked?" — two tables would eventually disagree.
 * ============================================================================
 */

export type FriendResult = { ok: true } | { ok: false; message: string };

/* -------------------------------------------------------------------------- */
/* Request                                                                     */
/* -------------------------------------------------------------------------- */

export async function sendFriendRequest(targetId: string): Promise<FriendResult> {
  const userId = await requireUserId();

  if (targetId === userId) {
    return { ok: false, message: "You cannot add yourself." };
  }

  const gate = rateLimit(`friend:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const target = await findOne("profiles", (row) => row.userId === targetId);
  if (!target) return { ok: false, message: "No such student." };

  /* A student who opted out of being discoverable has opted out of unsolicited
     requests too. Honouring one and not the other would make the setting a
     half-promise. */
  if (!target.privacy.discoverable && target.privacy.profileVisibility === "private") {
    return { ok: false, message: "That student is not accepting requests." };
  }

  const existing = await findOne(
    "friendships",
    (row) =>
      (row.requesterId === userId && row.addresseeId === targetId) ||
      (row.requesterId === targetId && row.addresseeId === userId),
  );

  if (existing?.status === "blocked") {
    /* Deliberately the same message as "no such student" would give: telling
       someone they have been blocked invites them to work around it. */
    return { ok: false, message: "That student is not accepting requests." };
  }
  if (existing?.status === "accepted") return { ok: true };

  if (existing?.status === "pending") {
    /* They already asked us — treat this as acceptance rather than creating a
       second, mirrored pending row. */
    if (existing.requesterId === targetId) return acceptFriendRequest(targetId);
    return { ok: true };
  }

  await insert("friendships", {
    id: newId(),
    requesterId: userId,
    addresseeId: targetId,
    status: "pending",
    createdAt: nowIso(),
  });

  await insert("notifications", {
    id: newId(),
    userId: targetId,
    topic: "friends-plans",
    title: "Someone wants to connect",
    body: "A student in your city sent you a friend request.",
    href: "/you/friends",
    readAt: null,
    createdAt: nowIso(),
  });

  revalidatePath("/you/friends");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Accept                                                                      */
/* -------------------------------------------------------------------------- */

export async function acceptFriendRequest(requesterId: string): Promise<FriendResult> {
  const userId = await requireUserId();

  const row = await findOne(
    "friendships",
    (entry) =>
      entry.requesterId === requesterId &&
      entry.addresseeId === userId &&
      entry.status === "pending",
  );

  if (!row) return { ok: false, message: "That request is no longer there." };

  await update("friendships", (entry) => entry.id === row.id, { status: "accepted" });

  await insert("notifications", {
    id: newId(),
    userId: requesterId,
    topic: "friends-plans",
    title: "You are connected",
    body: "Your friend request was accepted.",
    href: "/you/friends",
    readAt: null,
    createdAt: nowIso(),
  });

  await recordOutcome("friend-connected", requesterId);

  revalidatePath("/you/friends");
  revalidatePath("/home");
  return { ok: true };
}

/** Decline without telling the requester, which is the kinder default. */
export async function declineFriendRequest(requesterId: string): Promise<FriendResult> {
  const userId = await requireUserId();

  await remove(
    "friendships",
    (row) =>
      row.requesterId === requesterId && row.addresseeId === userId && row.status === "pending",
  );

  revalidatePath("/you/friends");
  return { ok: true };
}

export async function removeFriend(otherId: string): Promise<FriendResult> {
  const userId = await requireUserId();

  await remove(
    "friendships",
    (row) =>
      row.status === "accepted" &&
      ((row.requesterId === userId && row.addresseeId === otherId) ||
        (row.requesterId === otherId && row.addresseeId === userId)),
  );

  revalidatePath("/you/friends");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Block                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Block someone.
 *
 * Replaces whatever relationship existed, in one transaction, with the blocker
 * recorded as the requester so the direction is unambiguous. Everything else in
 * the product reads `isBlocked`, which is symmetric.
 */
export async function blockStudent(targetId: string): Promise<FriendResult> {
  const userId = await requireUserId();
  if (targetId === userId) return { ok: false, message: "You cannot block yourself." };

  await transaction((db) => {
    const kept = db.friendships.filter(
      (row) =>
        !(
          (row.requesterId === userId && row.addresseeId === targetId) ||
          (row.requesterId === targetId && row.addresseeId === userId)
        ),
    );
    db.friendships.length = 0;
    db.friendships.push(...kept, {
      id: newId(),
      requesterId: userId,
      addresseeId: targetId,
      status: "blocked",
      createdAt: nowIso(),
    });
  });

  revalidatePath("/you/friends");
  revalidatePath("/pulse");
  return { ok: true };
}

export async function unblockStudent(targetId: string): Promise<FriendResult> {
  const userId = await requireUserId();

  await remove(
    "friendships",
    (row) =>
      row.status === "blocked" && row.requesterId === userId && row.addresseeId === targetId,
  );

  revalidatePath("/you/friends");
  return { ok: true };
}
