"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { placesForCity } from "@/data/places";
import type { ChatAttachment, ReportReason } from "@/domain/types";
import { loopChannels } from "@/server/db/seed-content";
import { findOne, insert, newId, nowIso, transaction } from "@/server/db";
import { normalisePollOptions } from "@/server/engines/catch-up";
import { limits, rateLimit } from "@/server/rate-limit";
import { recordOutcome } from "@/server/actions/insight";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * PULSE ACTIONS
 * ----------------------------------------------------------------------------
 * Posting (with polls and attachments), voting, commenting, deleting your own
 * words, and reporting.
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

const POST_KINDS = ["question", "deal", "event", "recommendation", "anyone-down", "poll", "post"] as const;

/** What a post may point at. Chat allows more; a post is about the city. */
const POST_ATTACHABLE = ["event", "place", "deal", "listing"] as const;

/* -------------------------------------------------------------------------- */
/* Posting                                                                     */
/* -------------------------------------------------------------------------- */

const postSchema = z.object({
  title: z.string().trim().min(4, "Say a bit more than that.").max(160),
  body: z.string().trim().max(2000).optional(),
  channel: z.string().refine((value) => CHANNELS.has(value), "Unknown channel."),
  kind: z.enum(POST_KINDS),
  pollOptions: z.array(z.string().max(80)).max(6).optional(),
  attachmentKind: z.enum(POST_ATTACHABLE).optional(),
  attachmentId: z.string().min(1).max(80).optional(),
});

/**
 * Does the thing a post points at exist, in this city? A reference to a row
 * that is not there renders as "no longer listed" later; a reference to a row
 * in another city would be a lie on the card, so it is refused at the write.
 */
async function postAttachmentExists(
  citySlug: string,
  kind: (typeof POST_ATTACHABLE)[number],
  id: string,
): Promise<boolean> {
  switch (kind) {
    case "event":
      return Boolean(await findOne("events", (row) => row.id === id && row.citySlug === citySlug));
    case "place":
      return placesForCity(citySlug).some((place) => place.id === id);
    case "deal":
      return Boolean(await findOne("deals", (row) => row.id === id && row.citySlug === citySlug));
    case "listing":
      return Boolean(
        await findOne("listings", (row) => row.id === id && row.citySlug === citySlug && row.status === "active"),
      );
  }
}

/**
 * Create a post.
 *
 * Form fields: `title`, `body`, `channel`, `kind`, repeated `pollOption`
 * (two to four make it a poll), `attachmentKind` + `attachmentId`.
 */
export async function createPost(formData: FormData): Promise<LoopResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`post:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    channel: formData.get("channel"),
    kind: formData.get("kind") || "post",
    pollOptions: formData.getAll("pollOption").map((value) => String(value)),
    attachmentKind: formData.get("attachmentKind") || undefined,
    attachmentId: formData.get("attachmentId") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the post." };
  }

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  /* ---- poll ------------------------------------------------------------- */
  const typedOptions = (parsed.data.pollOptions ?? []).filter((option) => option.trim().length > 0);
  let poll: string[] | null = null;
  if (parsed.data.kind === "poll" || typedOptions.length > 0) {
    const cleaned = normalisePollOptions(typedOptions);
    if (!cleaned.ok) return { ok: false, message: cleaned.message };
    poll = cleaned.options;
  }
  const kind = poll ? "poll" : parsed.data.kind;

  /* ---- attachment ------------------------------------------------------- */
  let attachment: ChatAttachment | null = null;
  if (parsed.data.attachmentKind && parsed.data.attachmentId) {
    const exists = await postAttachmentExists(profile.citySlug, parsed.data.attachmentKind, parsed.data.attachmentId);
    if (!exists) return { ok: false, message: "That is not listed in your city any more." };
    attachment = { kind: parsed.data.attachmentKind, id: parsed.data.attachmentId };
  }

  const id = newId();
  await insert("posts", {
    id,
    citySlug: profile.citySlug,
    campusSlug: profile.campusSlug,
    channel: parsed.data.channel,
    authorId: userId,
    kind,
    title: parsed.data.title,
    body: parsed.data.body ?? null,
    placeId: attachment?.kind === "place" ? attachment.id : null,
    upvotes: 0,
    commentCount: 0,
    hiddenAt: null,
    poll,
    attachment,
    createdAt: nowIso(),
  });

  await recordOutcome("community-contribution", parsed.data.channel);

  revalidatePath("/pulse");
  revalidatePath("/home");
  return { ok: true, id };
}

/** Hide your own post. Rows stay for audit; they are never selected again. */
export async function deletePost(id: string): Promise<LoopResult> {
  const userId = await requireUserId();

  const done = await transaction((db) => {
    const post = db.posts.find((row) => row.id === id && row.hiddenAt === null);
    if (!post || post.authorId !== userId) return false;
    post.hiddenAt = nowIso();
    return true;
  });

  if (!done) return { ok: false, message: "That post is not yours." };

  revalidatePath("/pulse");
  revalidatePath(`/pulse/${id}`);
  revalidatePath("/home");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Polls                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Vote in a post's poll. One row per person; voting again changes the vote
 * rather than adding a second one, so a tally is always a count of people.
 */
export async function votePoll(postId: string, optionIndex: number): Promise<LoopResult> {
  const userId = await requireUserId();

  const parsed = z
    .object({ postId: z.string().min(1).max(80), optionIndex: z.number().int().min(0).max(5) })
    .safeParse({ postId, optionIndex });
  if (!parsed.success) return { ok: false, message: "That option is not on the poll." };

  const post = await findOne("posts", (row) => row.id === postId && row.hiddenAt === null);
  if (!post || !post.poll || post.poll.length === 0) return { ok: false, message: "That poll is no longer open." };
  if (optionIndex >= post.poll.length) return { ok: false, message: "That option is not on the poll." };

  const gate = rateLimit(`poll:${userId}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  await transaction((db) => {
    const index = db.pollVotes.findIndex((row) => row.postId === postId && row.userId === userId);
    const row = { postId, userId, optionIndex, createdAt: nowIso() };
    if (index === -1) db.pollVotes.push(row);
    else db.pollVotes[index] = row;
  });

  revalidatePath("/pulse");
  revalidatePath(`/pulse/${postId}`);
  return { ok: true };
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

/**
 * Add a comment, or a reply to one.
 *
 * Threads are one level deep and no further: a reply to a reply is attached
 * to the root comment instead. Deeper nesting turns a fifteen-reply thread
 * about where to buy a bike into something unreadable on a phone, which is
 * where almost all of this is read.
 */
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

  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await findOne(
      "comments",
      (row) => row.id === parsed.data.parentId && row.postId === post.id && row.hiddenAt === null,
    );
    if (!parent) return { ok: false, message: "That comment has gone." };
    parentId = parent.parentId ?? parent.id;
  }

  const id = newId();
  await transaction((db) => {
    db.comments.push({
      id,
      postId: parsed.data.postId,
      parentId,
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

/**
 * Hide your own comment. Replies under it go with it — a thread of answers
 * to a question nobody can see any more is noise, not history — and the
 * post's count drops by exactly what was hidden.
 */
export async function deleteComment(id: string): Promise<LoopResult> {
  const userId = await requireUserId();

  const postId = await transaction((db) => {
    const comment = db.comments.find((row) => row.id === id && row.hiddenAt === null);
    if (!comment || comment.authorId !== userId) return null;

    const now = nowIso();
    const replies = db.comments.filter((row) => row.parentId === id && row.hiddenAt === null);
    comment.hiddenAt = now;
    for (const reply of replies) reply.hiddenAt = now;

    const post = db.posts.find((row) => row.id === comment.postId);
    if (post) post.commentCount = Math.max(0, post.commentCount - 1 - replies.length);
    return comment.postId;
  });

  if (!postId) return { ok: false, message: "That comment is not yours." };

  revalidatePath(`/pulse/${postId}`);
  revalidatePath("/pulse");
  return { ok: true };
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

const REPORT_REASONS: readonly ReportReason[] = ["scam", "spam", "harassment", "unsafe", "wrong-info", "other"];

/**
 * Report content or a person.
 *
 * Reporting hides nothing on its own — a report is a signal, and letting one
 * report remove a post is a trivially abusable moderation system. It records
 * the report for review in `contentReports`; only an admin action sets
 * `hiddenAt`. One open report per person per target: tapping twice is not
 * two reports.
 */
export async function reportContent(
  targetKind: "post" | "comment" | "user",
  targetId: string,
  reason: string,
  note?: string,
): Promise<LoopResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`report:${userId}`, limits.report.limit, limits.report.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Too many reports at once." };

  const parsed = z
    .object({
      targetKind: z.enum(["post", "comment", "user"]),
      targetId: z.string().min(1).max(80),
      reason: z.string().trim().min(1).max(60),
      note: z.string().trim().max(500).optional(),
    })
    .safeParse({ targetKind, targetId, reason, note: note || undefined });
  if (!parsed.success) return { ok: false, message: "Pick a reason." };

  const exists =
    parsed.data.targetKind === "post"
      ? Boolean(await findOne("posts", (row) => row.id === parsed.data.targetId))
      : parsed.data.targetKind === "comment"
        ? Boolean(await findOne("comments", (row) => row.id === parsed.data.targetId))
        : Boolean(await findOne("profiles", (row) => row.userId === parsed.data.targetId));
  if (!exists) return { ok: false, message: "That is no longer there." };

  const known = REPORT_REASONS.find((entry) => entry === parsed.data.reason);
  const storedReason: ReportReason = known ?? "other";
  const storedNote = known ? (parsed.data.note ?? null) : [parsed.data.reason, parsed.data.note].filter(Boolean).join(" — ");

  const open = await findOne(
    "contentReports",
    (row) =>
      row.userId === userId &&
      row.targetKind === parsed.data.targetKind &&
      row.targetId === parsed.data.targetId &&
      row.status === "open",
  );
  if (open) return { ok: true, id: open.id };

  const id = newId();
  await insert("contentReports", {
    id,
    userId,
    targetKind: parsed.data.targetKind,
    targetId: parsed.data.targetId,
    reason: storedReason,
    note: storedNote || null,
    status: "open",
    createdAt: nowIso(),
    resolvedAt: null,
    resolution: null,
  });

  return { ok: true, id };
}
