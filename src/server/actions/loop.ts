"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { loopChannels } from "@/server/db/seed-content";
import { findOne, insert, newId, nowIso, remove, transaction } from "@/server/db";
import { limits, rateLimit } from "@/server/rate-limit";
import { recordOutcome } from "@/server/actions/insight";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * LOOP ACTIONS
 * ----------------------------------------------------------------------------
 * Posting, voting, commenting, chatting and reporting.
 *
 * None of these are gated by plan. That is the central product bet: charging
 * for access to other students shrinks the network every paid feature is built
 * on, so the community is free at every tier, permanently and unmetered.
 *
 * What they *are* gated by is rate limiting, because an unmetered write
 * endpoint on a community product is a spam endpoint.
 * ============================================================================
 */

export type LoopResult = { ok: true; id?: string } | { ok: false; message: string };

/* Widened to `Set<string>` deliberately: these are membership checks against
   untrusted form input, so the set must accept any string to answer "is this a
   real channel?" — a narrowly typed set would make the check unwriteable. */
const CHANNELS: ReadonlySet<string> = new Set<string>(
  loopChannels.map((channel) => channel.slug),
);

/* -------------------------------------------------------------------------- */
/* Posting                                                                     */
/* -------------------------------------------------------------------------- */

const postSchema = z.object({
  title: z.string().trim().min(4, "Say a bit more than that.").max(160),
  body: z.string().trim().max(2000).optional(),
  channel: z.string().refine((value) => CHANNELS.has(value), "Unknown channel."),
  kind: z.enum(["question", "deal", "event", "recommendation", "anyone-down", "poll", "post"]),
});

export async function createPost(formData: FormData): Promise<LoopResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`post:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    channel: formData.get("channel"),
    kind: formData.get("kind") ?? "post",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the post." };
  }

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const id = newId();
  await insert("posts", {
    id,
    citySlug: profile.citySlug,
    campusSlug: profile.campusSlug,
    channel: parsed.data.channel,
    authorId: userId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    body: parsed.data.body ?? null,
    placeId: null,
    upvotes: 0,
    commentCount: 0,
    hiddenAt: null,
    createdAt: nowIso(),
  });

  await recordOutcome("community-contribution", parsed.data.channel);

  revalidatePath("/pulse");
  return { ok: true, id };
}

/* -------------------------------------------------------------------------- */
/* Voting                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Toggle an upvote.
 *
 * The vote row and the denormalised count are written in one transaction. Split
 * across two writes, an interrupted request leaves a count that does not match
 * the votes, and nothing ever reconciles it.
 */
export async function toggleUpvote(
  targetKind: "post" | "comment",
  targetId: string,
): Promise<LoopResult> {
  const userId = await requireUserId();

  await transaction((db) => {
    const index = db.votes.findIndex(
      (row) => row.userId === userId && row.targetKind === targetKind && row.targetId === targetId,
    );

    const delta = index === -1 ? 1 : -1;

    if (index === -1) {
      db.votes.push({ userId, targetKind, targetId, value: 1, createdAt: nowIso() });
    } else {
      db.votes.splice(index, 1);
    }

    if (targetKind === "post") {
      const post = db.posts.find((row) => row.id === targetId);
      if (post) post.upvotes = Math.max(0, post.upvotes + delta);
    } else {
      const comment = db.comments.find((row) => row.id === targetId);
      if (comment) comment.upvotes = Math.max(0, comment.upvotes + delta);
    }
  });

  revalidatePath("/pulse");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Comments                                                                    */
/* -------------------------------------------------------------------------- */

export async function addComment(formData: FormData): Promise<LoopResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`comment:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const parsed = z
    .object({
      postId: z.string().min(1),
      parentId: z.string().optional(),
      body: z.string().trim().min(1, "Write something.").max(2000),
    })
    .safeParse({
      postId: formData.get("postId"),
      parentId: formData.get("parentId") || undefined,
      body: formData.get("body"),
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Write something." };
  }

  /* Without this, a comment could be attached to a hidden or non-existent
     post — orphaned rows that no moderation view would ever surface. */
  const post = await findOne(
    "posts",
    (row) => row.id === parsed.data.postId && row.hiddenAt === null,
  );
  if (!post) return { ok: false, message: "That post is no longer available." };

  const id = newId();
  await transaction((db) => {
    db.comments.push({
      id,
      postId: parsed.data.postId,
      parentId: parsed.data.parentId ?? null,
      authorId: userId,
      body: parsed.data.body,
      upvotes: 0,
      hiddenAt: null,
      createdAt: nowIso(),
    });

    const post = db.posts.find((row) => row.id === parsed.data.postId);
    if (post) post.commentCount += 1;
  });

  await recordOutcome("community-contribution", "comment");

  revalidatePath(`/pulse/${parsed.data.postId}`);
  revalidatePath("/pulse");
  return { ok: true, id };
}

/* -------------------------------------------------------------------------- */
/* Chat                                                                        */
/* -------------------------------------------------------------------------- */

export async function sendChat(channel: string, body: string): Promise<LoopResult> {
  /* Kept for the existing call sites; the access rule lives in one place. */
  const { sendMessage } = await import("@/server/actions/chat");
  const result = await sendMessage({ channel, body });
  return result.ok ? { ok: true, id: result.id } : result;
}

/* -------------------------------------------------------------------------- */
/* Moderation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Report content.
 *
 * Reporting hides nothing on its own — a report is a signal, and letting one
 * report remove a post is a trivially abusable moderation system. It records
 * the report for review; only an admin action sets `hiddenAt`.
 */
export async function reportContent(
  targetKind: "post" | "comment",
  targetId: string,
  reason: string,
): Promise<LoopResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`report:${userId}`, limits.report.limit, limits.report.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Too many reports at once." };

  await insert("searchMisses", {
    id: newId(),
    userId,
    citySlug: "-",
    intent: `report:${targetKind}:${targetId}:${reason.slice(0, 40)}`,
    surface: "search",
    resultCount: 0,
    createdAt: nowIso(),
  });

  return { ok: true };
}

/** Delete your own post. */
export async function deletePost(id: string): Promise<LoopResult> {
  const userId = await requireUserId();
  const removed = await remove("posts", (row) => row.id === id && row.authorId === userId);
  if (removed === 0) return { ok: false, message: "That post is not yours." };
  revalidatePath("/pulse");
  return { ok: true };
}
