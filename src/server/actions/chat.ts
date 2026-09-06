"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ChatAttachment } from "@/domain/types";
import { findOne, insert, newId, nowIso, transaction } from "@/server/db";
import { limits, rateLimit } from "@/server/rate-limit";
import { canReadChannel, channelKind } from "@/server/queries/chat";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * CHAT ACTIONS
 * ----------------------------------------------------------------------------
 * Sending (with replies and attachments), reactions, and per-channel prefs.
 *
 * Every write checks `canReadChannel` first — the same predicate the hub uses
 * to decide what to list. Validating the channel *name* is not enough: ids are
 * visible to anyone who can see the thing they belong to, and an event id in
 * a URL must not be a ticket into that event's chat.
 * ============================================================================
 */

export type ChatActionResult = { ok: true; id?: string } | { ok: false; message: string };

const attachmentSchema = z.object({
  kind: z.enum(["event", "place", "plan", "deal", "invite"]),
  id: z.string().min(1).max(80),
});

export async function sendMessage(input: {
  channel: string;
  body: string;
  replyToId?: string | null;
  attachment?: ChatAttachment | null;
}): Promise<ChatActionResult> {
  const userId = await requireUserId();

  if (!channelKind(input.channel)) return { ok: false, message: "Unknown channel." };
  if (!(await canReadChannel(userId, input.channel))) {
    return { ok: false, message: "That chat is for people who joined." };
  }

  const body = input.body.trim();
  const attachment = input.attachment ? attachmentSchema.safeParse(input.attachment) : null;
  if (attachment && !attachment.success) return { ok: false, message: "That attachment is not valid." };
  if (body.length === 0 && !attachment) return { ok: false, message: "Write something." };
  if (body.length > 1000) return { ok: false, message: "That is too long for chat." };

  const gate = rateLimit(`chat:${userId}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  /* A reply must point into the same channel. */
  let replyToId: string | null = null;
  if (input.replyToId) {
    const parent = await findOne("chat", (row) => row.id === input.replyToId);
    replyToId = parent && parent.channel === input.channel ? parent.id : null;
  }

  const id = newId();
  await insert("chat", {
    id,
    citySlug: profile.citySlug,
    channel: input.channel,
    authorId: userId,
    body,
    replyToId,
    attachment: attachment?.success ? attachment.data : null,
    createdAt: nowIso(),
  });

  await markChannelRead(input.channel);

  revalidatePath(`/pulse/chat/${input.channel}`);
  revalidatePath("/pulse/chat");
  return { ok: true, id };
}

export async function toggleReaction(messageId: string, emoji: string): Promise<ChatActionResult> {
  const userId = await requireUserId();
  if (!/^\p{Extended_Pictographic}$/u.test(emoji)) return { ok: false, message: "One emoji." };

  const message = await findOne("chat", (row) => row.id === messageId);
  if (!message) return { ok: false, message: "That message has gone." };
  if (!(await canReadChannel(userId, message.channel))) {
    return { ok: false, message: "That chat is for people who joined." };
  }

  await transaction((db) => {
    const index = db.chatReactions.findIndex(
      (row) => row.messageId === messageId && row.userId === userId && row.emoji === emoji,
    );
    if (index === -1) db.chatReactions.push({ messageId, userId, emoji, createdAt: nowIso() });
    else db.chatReactions.splice(index, 1);
  });

  revalidatePath(`/pulse/chat/${message.channel}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Preferences                                                                 */
/* -------------------------------------------------------------------------- */

export async function setChatPref(
  channel: string,
  patch: Partial<{ pinned: boolean; muted: boolean; archived: boolean }>,
): Promise<ChatActionResult> {
  const userId = await requireUserId();
  if (!channelKind(channel)) return { ok: false, message: "Unknown channel." };

  await transaction((db) => {
    const index = db.chatPrefs.findIndex((row) => row.userId === userId && row.channel === channel);
    const current = index === -1
      ? { userId, channel, pinned: false, muted: false, archived: false, lastReadAt: null, updatedAt: nowIso() }
      : db.chatPrefs[index];
    const next = { ...current, ...patch, updatedAt: nowIso() };
    if (index === -1) db.chatPrefs.push(next);
    else db.chatPrefs[index] = next;
  });

  revalidatePath("/pulse/chat");
  return { ok: true };
}

export async function markChannelRead(channel: string): Promise<ChatActionResult> {
  const userId = await requireUserId();
  if (!channelKind(channel)) return { ok: false, message: "Unknown channel." };

  await transaction((db) => {
    const index = db.chatPrefs.findIndex((row) => row.userId === userId && row.channel === channel);
    const now = nowIso();
    if (index === -1) {
      db.chatPrefs.push({
        userId,
        channel,
        pinned: false,
        muted: false,
        archived: false,
        lastReadAt: now,
        updatedAt: now,
      });
    } else {
      db.chatPrefs[index] = { ...db.chatPrefs[index], lastReadAt: now, updatedAt: now };
    }
  });

  return { ok: true };
}
