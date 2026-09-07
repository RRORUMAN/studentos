"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { placesForCity } from "@/data/places";
import type { ChatAttachment } from "@/domain/types";
import { findOne, insert, newId, nowIso, transaction } from "@/server/db";
import { normalisePollOptions } from "@/server/engines/catch-up";
import { limits, rateLimit } from "@/server/rate-limit";
import { canReadChannel, channelKind, dmChannel } from "@/server/queries/chat";
import { canMessage } from "@/server/queries/social";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * CHAT ACTIONS
 * ----------------------------------------------------------------------------
 * Sending (with replies and attachments), reactions, polls, direct messages
 * and per-channel prefs.
 *
 * Every write checks `canReadChannel` first — the same predicate the hub uses
 * to decide what to list. Validating the channel *name* is not enough: ids are
 * visible to anyone who can see the thing they belong to, and an event id in
 * a URL must not be a ticket into that event's chat.
 * ============================================================================
 */

export type ChatActionResult = { ok: true; id?: string } | { ok: false; message: string };

const attachmentSchema = z.object({
  kind: z.enum(["event", "place", "plan", "deal", "invite", "listing", "poll", "mission"]),
  id: z.string().min(1).max(80),
});

/**
 * A message may only point at a row that exists. The card renders from the
 * live row later, so this is the one moment a dangling reference can be
 * refused rather than rendered as "no longer listed" forever.
 */
async function attachmentExists(attachment: ChatAttachment, citySlug: string, userId: string): Promise<boolean> {
  const id = attachment.id;
  switch (attachment.kind) {
    case "event":
      return Boolean(await findOne("events", (row) => row.id === id));
    case "place":
      return placesForCity(citySlug).some((place) => place.id === id);
    case "plan":
      return Boolean(await findOne("plans", (row) => row.id === id));
    case "deal":
      return Boolean(await findOne("deals", (row) => row.id === id));
    case "invite":
      return Boolean(await findOne("invites", (row) => row.id === id));
    case "listing":
      return Boolean(await findOne("listings", (row) => row.id === id));
    case "poll":
      return Boolean(await findOne("chatPolls", (row) => row.id === id));
    case "mission":
      return Boolean(await findOne("missions", (row) => row.id === id && row.userId === userId));
    case "opportunity":
      return Boolean(
        await findOne(
          "opportunities",
          (row) => row.id === id && row.moderation === "published",
        ),
      );
  }
}

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

  if (attachment?.success && !(await attachmentExists(attachment.data, profile.citySlug, userId))) {
    return { ok: false, message: "That is no longer listed." };
  }

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
/* Direct messages                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Open (or find) the DM with another student and return its channel.
 *
 * Who may message whom is decided by `canMessage`, the same rule the channel
 * access check uses. Opening writes a prefs row for the opener so the
 * conversation shows in their hub before anything is said; the other side
 * sees it once a message lands.
 */
export async function startDirectMessage(
  otherUserId: string,
): Promise<{ ok: true; channel: string } | { ok: false; message: string }> {
  const userId = await requireUserId();

  const parsed = z.string().min(1).max(80).safeParse(otherUserId);
  if (!parsed.success) return { ok: false, message: "No such student." };

  const allowed = await canMessage(userId, parsed.data);
  if (!allowed.ok) return allowed;

  const channel = dmChannel(userId, parsed.data);
  await transaction((db) => {
    const exists = db.chatPrefs.some((row) => row.userId === userId && row.channel === channel);
    if (exists) return;
    const now = nowIso();
    db.chatPrefs.push({ userId, channel, pinned: false, muted: false, archived: false, lastReadAt: now, updatedAt: now });
  });

  revalidatePath("/pulse/chat");
  return { ok: true, channel };
}

/* -------------------------------------------------------------------------- */
/* Polls                                                                       */
/* -------------------------------------------------------------------------- */

const pollSchema = z.object({
  channel: z.string().min(1).max(120),
  question: z.string().trim().min(3, "Ask something.").max(160),
  options: z.array(z.string().max(80)).min(2).max(6),
  closesInHours: z.number().int().min(1).max(168).nullable().optional(),
});

/** Post a poll into a channel. Options are fixed at creation. */
export async function createChatPoll(input: {
  channel: string;
  question: string;
  options: readonly string[];
  closesInHours?: number | null;
}): Promise<ChatActionResult> {
  const userId = await requireUserId();

  const parsed = pollSchema.safeParse({ ...input, options: [...input.options] });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the poll." };

  if (!channelKind(parsed.data.channel)) return { ok: false, message: "Unknown channel." };
  if (!(await canReadChannel(userId, parsed.data.channel))) {
    return { ok: false, message: "That chat is for people who joined." };
  }

  const options = normalisePollOptions(parsed.data.options);
  if (!options.ok) return { ok: false, message: options.message };

  const gate = rateLimit(`chat:${userId}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const id = newId();
  const now = Date.now();
  await insert("chatPolls", {
    id,
    channel: parsed.data.channel,
    authorId: userId,
    question: parsed.data.question,
    options: options.options,
    closesAt: parsed.data.closesInHours ? new Date(now + parsed.data.closesInHours * 3_600_000).toISOString() : null,
    createdAt: new Date(now).toISOString(),
  });

  await markChannelRead(parsed.data.channel);

  revalidatePath(`/pulse/chat/${parsed.data.channel}`);
  revalidatePath("/pulse/chat");
  return { ok: true, id };
}

/** Vote in a chat poll. Voting again changes the vote. */
export async function voteChatPoll(pollId: string, optionIndex: number): Promise<ChatActionResult> {
  const userId = await requireUserId();

  const parsed = z
    .object({ pollId: z.string().min(1).max(80), optionIndex: z.number().int().min(0).max(5) })
    .safeParse({ pollId, optionIndex });
  if (!parsed.success) return { ok: false, message: "That option is not on the poll." };

  const poll = await findOne("chatPolls", (row) => row.id === pollId);
  if (!poll) return { ok: false, message: "That poll has gone." };
  if (optionIndex >= poll.options.length) return { ok: false, message: "That option is not on the poll." };
  if (poll.closesAt && Date.parse(poll.closesAt) < Date.now()) return { ok: false, message: "That poll has closed." };
  if (!(await canReadChannel(userId, poll.channel))) {
    return { ok: false, message: "That chat is for people who joined." };
  }

  const gate = rateLimit(`poll:${userId}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  await transaction((db) => {
    const index = db.chatPollVotes.findIndex((row) => row.pollId === pollId && row.userId === userId);
    const row = { pollId, userId, optionIndex, createdAt: nowIso() };
    if (index === -1) db.chatPollVotes.push(row);
    else db.chatPollVotes[index] = row;
  });

  revalidatePath(`/pulse/chat/${poll.channel}`);
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

/**
 * Record "seen as of now" for channels that have no prefs row yet. The hub
 * calls this for city rooms on first sight, so history from before a student
 * arrived is never counted as unread — only what lands after.
 */
export async function markChannelsSeen(channels: readonly string[]): Promise<ChatActionResult> {
  const userId = await requireUserId();
  const valid = [...new Set(channels)].filter((channel) => channelKind(channel) !== null).slice(0, 100);
  if (valid.length === 0) return { ok: true };

  await transaction((db) => {
    const now = nowIso();
    for (const channel of valid) {
      if (db.chatPrefs.some((row) => row.userId === userId && row.channel === channel)) continue;
      db.chatPrefs.push({ userId, channel, pinned: false, muted: false, archived: false, lastReadAt: now, updatedAt: now });
    }
  });

  return { ok: true };
}

/** Mark a set of channels read now. The hub's "Mark all read". */
export async function markChannelsRead(channels: readonly string[]): Promise<ChatActionResult> {
  const userId = await requireUserId();
  const valid = [...new Set(channels)].filter((channel) => channelKind(channel) !== null).slice(0, 200);

  const allowed: string[] = [];
  for (const channel of valid) if (await canReadChannel(userId, channel)) allowed.push(channel);

  await transaction((db) => {
    const now = nowIso();
    for (const channel of allowed) {
      const index = db.chatPrefs.findIndex((row) => row.userId === userId && row.channel === channel);
      if (index === -1) {
        db.chatPrefs.push({ userId, channel, pinned: false, muted: false, archived: false, lastReadAt: now, updatedAt: now });
      } else {
        db.chatPrefs[index] = { ...db.chatPrefs[index], lastReadAt: now, updatedAt: now };
      }
    }
  });

  revalidatePath("/pulse/chat");
  return { ok: true };
}
