import "server-only";

import type { ChatAttachment, ChatMessageRow, ChatPrefs, ChatReaction, Profile } from "@/domain/types";
import { loopChannels } from "@/server/db/seed-content";
import { findMany, findOne } from "@/server/db";

/**
 * ============================================================================
 * CHAT — queries
 * ----------------------------------------------------------------------------
 * The chat hub: every conversation a student is in, grouped so a city channel,
 * an event chat and a plan group never share one infinite list.
 *
 * Channel naming is the access model:
 *
 *   <slug>           city channel, open to everyone in the city
 *   event-<id>       students who marked Going or Interested
 *   invite-<id>      people who joined the Anyone Down? plan
 *   plan-<id>        the owner and members of a saved plan
 *   dm-<a>-<b>       two students, ids sorted, friends only
 *
 * `canReadChannel` is the one predicate both the hub and the send action use.
 * ============================================================================
 */

export type ChatGroup = "direct" | "groups" | "campus" | "events" | "anyone-down";

export type ChatRow = {
  channel: string;
  group: ChatGroup;
  title: string;
  emoji: string;
  href: string;
  lastLine: string | null;
  lastAt: string | null;
  unread: number;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
};

const CITY = new Set<string>(loopChannels.map((channel) => channel.slug));

export function channelKind(channel: string):
  | { kind: "city"; slug: string }
  | { kind: "event"; id: string }
  | { kind: "invite"; id: string }
  | { kind: "plan"; id: string }
  | { kind: "dm"; a: string; b: string }
  | null {
  if (CITY.has(channel)) return { kind: "city", slug: channel };
  const event = /^event-([0-9a-f-]{36})$/.exec(channel);
  if (event) return { kind: "event", id: event[1] };
  const invite = /^invite-([0-9a-f-]{36})$/.exec(channel);
  if (invite) return { kind: "invite", id: invite[1] };
  const plan = /^plan-([0-9a-f-]{36})$/.exec(channel);
  if (plan) return { kind: "plan", id: plan[1] };
  const dm = /^dm-([0-9a-f-]{36})-([0-9a-f-]{36})$/.exec(channel);
  if (dm) return { kind: "dm", a: dm[1], b: dm[2] };
  return null;
}

export function dmChannel(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `dm-${x}-${y}`;
}

/** Whether `userId` may read (and therefore write to) a channel. */
export async function canReadChannel(userId: string, channel: string): Promise<boolean> {
  const kind = channelKind(channel);
  if (!kind) return false;

  switch (kind.kind) {
    case "city":
      return true;
    case "event": {
      const row = await findOne(
        "eventResponses",
        (entry) => entry.eventId === kind.id && entry.userId === userId,
      );
      return Boolean(row);
    }
    case "invite": {
      const row = await findOne(
        "inviteResponses",
        (entry) => entry.inviteId === kind.id && entry.userId === userId,
      );
      return row?.status === "in";
    }
    case "plan": {
      const plan = await findOne("plans", (entry) => entry.id === kind.id);
      if (!plan) return false;
      if (plan.userId === userId) return true;
      const member = await findOne(
        "planMembers",
        (entry) => entry.planId === kind.id && entry.userId === userId,
      );
      return member?.status === "in";
    }
    case "dm": {
      if (kind.a !== userId && kind.b !== userId) return false;
      const other = kind.a === userId ? kind.b : kind.a;
      const friendship = await findOne(
        "friendships",
        (entry) =>
          entry.status === "accepted" &&
          ((entry.requesterId === userId && entry.addresseeId === other) ||
            (entry.requesterId === other && entry.addresseeId === userId)),
      );
      return Boolean(friendship);
    }
  }
}

/** Every conversation this student is part of, with unread counts. */
export async function loadChatHub(input: {
  userId: string;
  citySlug: string;
  campusSlug: string | null;
}): Promise<ChatRow[]> {
  const [prefs, eventResponses, inviteResponses, plans, planMembers, friendships, profiles] =
    await Promise.all([
      findMany("chatPrefs", (row) => row.userId === input.userId),
      findMany("eventResponses", (row) => row.userId === input.userId),
      findMany("inviteResponses", (row) => row.userId === input.userId && row.status === "in"),
      findMany("plans", (row) => row.userId === input.userId),
      findMany("planMembers", (row) => row.userId === input.userId && row.status === "in"),
      findMany(
        "friendships",
        (row) =>
          row.status === "accepted" &&
          (row.requesterId === input.userId || row.addresseeId === input.userId),
      ),
      findMany("profiles", () => true),
    ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const prefFor = new Map(prefs.map((row) => [row.channel, row]));

  const rows: Omit<ChatRow, "lastLine" | "lastAt" | "unread">[] = [];

  for (const channel of loopChannels) {
    rows.push({
      channel: channel.slug,
      group: channel.slug === "campus" ? "campus" : "groups",
      title: channel.label,
      emoji: channel.emoji,
      href: `/pulse/chat/${channel.slug}`,
      ...flags(prefFor.get(channel.slug)),
    });
  }

  const eventIds = eventResponses.map((row) => row.eventId);
  const events = await findMany("events", (row) => eventIds.includes(row.id));
  for (const event of events) {
    rows.push({
      channel: `event-${event.id}`,
      group: "events",
      title: event.title,
      emoji: "🎟️",
      href: `/pulse/chat/event-${event.id}`,
      ...flags(prefFor.get(`event-${event.id}`)),
    });
  }

  const inviteIds = inviteResponses.map((row) => row.inviteId);
  const invites = await findMany("invites", (row) => inviteIds.includes(row.id));
  for (const invite of invites) {
    rows.push({
      channel: `invite-${invite.id}`,
      group: "anyone-down",
      title: invite.title,
      emoji: "🙋",
      href: `/anyone-down/${invite.id}`,
      ...flags(prefFor.get(`invite-${invite.id}`)),
    });
  }

  const memberPlanIds = planMembers.map((row) => row.planId);
  const memberPlans = await findMany("plans", (row) => memberPlanIds.includes(row.id));
  for (const plan of [...plans, ...memberPlans]) {
    rows.push({
      channel: `plan-${plan.id}`,
      group: "groups",
      title: plan.title,
      emoji: "🗓️",
      href: `/plans/${plan.id}`,
      ...flags(prefFor.get(`plan-${plan.id}`)),
    });
  }

  for (const friendship of friendships) {
    const other = friendship.requesterId === input.userId ? friendship.addresseeId : friendship.requesterId;
    const profile = byUser.get(other);
    if (!profile) continue;
    const channel = dmChannel(input.userId, other);
    rows.push({
      channel,
      group: "direct",
      title: profile.displayName,
      emoji: profile.avatarEmoji,
      href: `/pulse/chat/${channel}`,
      ...flags(prefFor.get(channel)),
    });
  }

  /* Last message and unread count, one pass over the chat table. */
  const channels = new Set(rows.map((row) => row.channel));
  const messages = await findMany("chat", (row) => channels.has(row.channel));

  return rows
    .map((row) => {
      const mine = messages.filter((message) => message.channel === row.channel);
      const last = mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const since = prefFor.get(row.channel)?.lastReadAt ?? null;
      const unread = since ? mine.filter((message) => message.createdAt > since).length : Math.min(mine.length, 99);
      return {
        ...row,
        lastLine: last ? previewLine(last, byUser.get(last.authorId)) : null,
        lastAt: last?.createdAt ?? null,
        unread: row.muted ? 0 : unread,
      };
    })
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (b.lastAt ?? "").localeCompare(a.lastAt ?? ""),
    );
}

function flags(pref: ChatPrefs | undefined) {
  return {
    pinned: pref?.pinned ?? false,
    muted: pref?.muted ?? false,
    archived: pref?.archived ?? false,
  };
}

function previewLine(message: ChatMessageRow, author: Profile | undefined): string {
  const who = author?.displayName ?? "Someone";
  if (message.attachment) return `${who} shared ${attachmentNoun(message.attachment)}`;
  return `${who}: ${message.body.slice(0, 80)}`;
}

function attachmentNoun(attachment: ChatAttachment): string {
  return { event: "an event", place: "a place", plan: "a plan", deal: "a deal", invite: "a plan" }[
    attachment.kind
  ];
}

/* -------------------------------------------------------------------------- */
/* One channel                                                                 */
/* -------------------------------------------------------------------------- */

export type ChatLineView = {
  id: string;
  body: string;
  createdAt: string;
  author: { userId: string; displayName: string; avatarEmoji: string } | null;
  mine: boolean;
  replyTo: { author: string; body: string } | null;
  attachment: ChatAttachment | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
};

export async function loadChannelLines(input: {
  channel: string;
  userId: string;
}): Promise<ChatLineView[]> {
  const [messages, profiles] = await Promise.all([
    findMany("chat", (row) => row.channel === input.channel),
    findMany("profiles", () => true),
  ]);

  const ids = new Set(messages.map((message) => message.id));
  const reactions = await findMany("chatReactions", (row) => ids.has(row.messageId));

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const byId = new Map(messages.map((message) => [message.id, message]));

  return messages
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((message) => {
      const author = byUser.get(message.authorId);
      const parent = message.replyToId ? byId.get(message.replyToId) : undefined;
      return {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        author: author
          ? { userId: author.userId, displayName: author.displayName, avatarEmoji: author.avatarEmoji }
          : null,
        mine: message.authorId === input.userId,
        replyTo: parent
          ? { author: byUser.get(parent.authorId)?.displayName ?? "Someone", body: parent.body.slice(0, 120) }
          : null,
        attachment: message.attachment ?? null,
        reactions: groupReactions(
          reactions.filter((row) => row.messageId === message.id),
          input.userId,
        ),
      };
    });
}

function groupReactions(rows: readonly ChatReaction[], userId: string) {
  const map = new Map<string, { count: number; mine: boolean }>();
  for (const row of rows) {
    const entry = map.get(row.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (row.userId === userId) entry.mine = true;
    map.set(row.emoji, entry);
  }
  return [...map.entries()].map(([emoji, entry]) => ({ emoji, ...entry }));
}

/** Human title for a channel, for the header. */
export async function channelTitle(channel: string, viewerId: string): Promise<{ title: string; emoji: string; back: string } | null> {
  const kind = channelKind(channel);
  if (!kind) return null;
  switch (kind.kind) {
    case "city": {
      const meta = loopChannels.find((entry) => entry.slug === kind.slug);
      return meta ? { title: meta.label, emoji: meta.emoji, back: "/pulse/chat" } : null;
    }
    case "event": {
      const event = await findOne("events", (row) => row.id === kind.id);
      return event ? { title: event.title, emoji: "🎟️", back: `/events/${event.id}` } : null;
    }
    case "invite": {
      const invite = await findOne("invites", (row) => row.id === kind.id);
      return invite ? { title: invite.title, emoji: "🙋", back: `/anyone-down/${invite.id}` } : null;
    }
    case "plan": {
      const plan = await findOne("plans", (row) => row.id === kind.id);
      return plan ? { title: plan.title, emoji: "🗓️", back: `/plans/${plan.id}` } : null;
    }
    case "dm": {
      const other = kind.a === viewerId ? kind.b : kind.a;
      const profile = await findOne("profiles", (row) => row.userId === other);
      return profile ? { title: profile.displayName, emoji: profile.avatarEmoji, back: "/pulse/chat" } : null;
    }
  }
}
