import "server-only";

import { defaultCityContext, resolveCity } from "@/data/cities";
import type { ChatAttachment, ChatMessageRow, ChatPrefs, ChatReaction, Profile } from "@/domain/types";
import { loopChannels } from "@/server/db/seed-content";
import { findMany, findOne } from "@/server/db";
import { tallyPoll, type PollTally } from "@/server/engines/catch-up";
import { canMessage, loadBlockedIds, loadFriendIds } from "@/server/queries/social";
import { fmtDay, fmtTime } from "@/lib/dates";

/**
 * ============================================================================
 * CHAT — queries
 * ----------------------------------------------------------------------------
 * The chat hub: every conversation a student is in, grouped so a city channel,
 * an event chat and a plan group never share one infinite list.
 *
 * Channel naming is the access model:
 *
 *   <slug>           city channel, one per city — rows carry `citySlug`, and
 *                    every read here is scoped to the reader's city
 *   event-<id>       students who marked Going or Interested
 *   invite-<id>      people who joined the Anyone Down? plan
 *   plan-<id>        the owner and members of a saved plan
 *   dm-<a>-<b>       two students, ids sorted; friends anywhere, or any two
 *                    non-blocked students in the same city
 *
 * `canReadChannel` is the one predicate the hub, the page and the send action
 * all use.
 * ============================================================================
 */

export type ChatGroup = "direct" | "groups" | "campus" | "events" | "anyone-down";

export type ChatRow = {
  channel: string;
  group: ChatGroup;
  title: string;
  emoji: string;
  /** Always the chat itself, so opening a row marks it read. */
  href: string;
  /** The thing the chat is about — the event, the plan — as a secondary link. */
  about: { href: string; label: string } | null;
  lastLine: string | null;
  lastAt: string | null;
  unread: number;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  /** Set by search when a message body matched rather than the title. */
  matchLine: string | null;
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
  if (dm && dm[1] !== dm[2]) return { kind: "dm", a: dm[1], b: dm[2] };
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
    case "city": {
      /* Open to every student *in a city*; the rows themselves are scoped to
         the reader's city by every query below. */
      const profile = await findOne("profiles", (row) => row.userId === userId);
      return Boolean(profile);
    }
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
      return (await canMessage(userId, other)).ok;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Hub                                                                         */
/* -------------------------------------------------------------------------- */

/** Every conversation this student is part of, with unread counts. */
export async function loadChatHub(input: {
  userId: string;
  citySlug: string;
  campusSlug: string | null;
}): Promise<ChatRow[]> {
  const [prefs, eventResponses, inviteResponses, plans, planMembers, friendIds, blockedIds, profiles, dmMessages] =
    await Promise.all([
      findMany("chatPrefs", (row) => row.userId === input.userId),
      findMany("eventResponses", (row) => row.userId === input.userId),
      findMany("inviteResponses", (row) => row.userId === input.userId && row.status === "in"),
      findMany("plans", (row) => row.userId === input.userId),
      findMany("planMembers", (row) => row.userId === input.userId && row.status === "in"),
      loadFriendIds(input.userId),
      loadBlockedIds(input.userId),
      findMany("profiles", () => true),
      findMany("chat", (row) => row.channel.startsWith("dm-") && row.channel.includes(input.userId)),
    ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const prefFor = new Map(prefs.map((row) => [row.channel, row]));

  const rows: Omit<ChatRow, "lastLine" | "lastAt" | "unread" | "matchLine">[] = [];

  for (const channel of loopChannels) {
    rows.push({
      channel: channel.slug,
      group: channel.slug === "campus" ? "campus" : "groups",
      title: channel.label,
      emoji: channel.emoji,
      href: `/pulse/chat/${channel.slug}`,
      about: { href: `/pulse?channel=${channel.slug}`, label: "Posts" },
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
      about: { href: `/events/${event.id}`, label: "Event" },
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
      href: `/pulse/chat/invite-${invite.id}`,
      about: { href: `/anyone-down/${invite.id}`, label: "Plan" },
      ...flags(prefFor.get(`invite-${invite.id}`)),
    });
  }

  const memberPlanIds = planMembers.map((row) => row.planId);
  const memberPlans = await findMany("plans", (row) => memberPlanIds.includes(row.id));
  const seenPlans = new Set<string>();
  for (const plan of [...plans, ...memberPlans]) {
    if (seenPlans.has(plan.id)) continue;
    seenPlans.add(plan.id);
    rows.push({
      channel: `plan-${plan.id}`,
      group: "groups",
      title: plan.title,
      emoji: "🗓️",
      href: `/pulse/chat/plan-${plan.id}`,
      about: { href: `/plans/${plan.id}`, label: "Plan" },
      ...flags(prefFor.get(`plan-${plan.id}`)),
    });
  }

  /* Direct: friends, plus anyone a conversation was started with. A DM that
     exists only as a prefs row (started, nothing sent yet) still shows for the
     person who opened it; the other side sees it once a message lands. */
  const partners = new Set<string>(friendIds);
  for (const pref of prefs) {
    const kind = channelKind(pref.channel);
    if (kind?.kind === "dm") partners.add(kind.a === input.userId ? kind.b : kind.a);
  }
  for (const message of dmMessages) {
    const kind = channelKind(message.channel);
    if (kind?.kind === "dm" && (kind.a === input.userId || kind.b === input.userId)) {
      partners.add(kind.a === input.userId ? kind.b : kind.a);
    }
  }
  partners.delete(input.userId);

  for (const other of partners) {
    if (blockedIds.has(other)) continue;
    const profile = byUser.get(other);
    if (!profile) continue;
    const channel = dmChannel(input.userId, other);
    rows.push({
      channel,
      group: "direct",
      title: profile.displayName,
      emoji: profile.avatarEmoji,
      href: `/pulse/chat/${channel}`,
      about: null,
      ...flags(prefFor.get(channel)),
    });
  }

  /* Last message and unread count, one pass over the chat table. City rooms
     are read for this city only — the same slug exists in every city. */
  const channels = new Set(rows.map((row) => row.channel));
  const messages = await findMany(
    "chat",
    (row) => channels.has(row.channel) && (!CITY.has(row.channel) || row.citySlug === input.citySlug),
  );

  return rows
    .map((row) => {
      const mine = messages.filter((message) => message.channel === row.channel);
      const last = mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return {
        ...row,
        lastLine: last ? previewLine(last, byUser.get(last.authorId)) : null,
        lastAt: last?.createdAt ?? null,
        unread: row.muted ? 0 : unreadIn(row.channel, mine, prefFor.get(row.channel), input.userId),
        matchLine: null,
      };
    })
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (b.lastAt ?? "").localeCompare(a.lastAt ?? "") ||
        a.title.localeCompare(b.title),
    );
}

/**
 * Unread, honestly.
 *
 * Your own messages are never unread. A city room you have never opened is
 * treated as read as of first sight — the hub records that moment — so a new
 * student does not land on fifteen red badges for conversations that happened
 * before they arrived. A group or DM you have never opened *does* count what
 * others said, because someone wrote to you.
 */
function unreadIn(
  channel: string,
  messages: readonly ChatMessageRow[],
  pref: ChatPrefs | undefined,
  userId: string,
): number {
  const others = messages.filter((message) => message.authorId !== userId);
  const since = pref?.lastReadAt ?? null;
  if (since) return Math.min(99, others.filter((message) => message.createdAt > since).length);
  if (CITY.has(channel)) return 0;
  return Math.min(99, others.length);
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
  const nouns: Record<ChatAttachment["kind"], string> = {
    event: "an event",
    place: "a place",
    plan: "a plan",
    deal: "a deal",
    invite: "a plan",
    listing: "a listing",
    poll: "a poll",
    mission: "a mission",
  };
  return nouns[attachment.kind];
}

/**
 * Search across the conversations a student can read: titles, last lines and
 * message bodies. Archived rows are searched too — a search is the one time a
 * student wants the archived thing back. Rows are the hub rows (already
 * access-filtered), so no message outside them is ever read.
 */
export async function searchChat(input: {
  userId: string;
  citySlug: string;
  query: string;
  rows: readonly ChatRow[];
}): Promise<ChatRow[]> {
  const q = input.query.trim().toLowerCase();
  if (!q) return [...input.rows];

  const channels = new Set(input.rows.map((row) => row.channel));
  const [hits, profiles] = await Promise.all([
    findMany(
      "chat",
      (row) =>
        channels.has(row.channel) &&
        (!CITY.has(row.channel) || row.citySlug === input.citySlug) &&
        row.body.toLowerCase().includes(q),
    ),
    findMany("profiles", () => true),
  ]);
  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));

  return input.rows
    .map((row) => {
      const titleHit = row.title.toLowerCase().includes(q) || (row.lastLine ?? "").toLowerCase().includes(q);
      const hit = hits
        .filter((message) => message.channel === row.channel)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!titleHit && !hit) return null;
      return {
        ...row,
        matchLine: hit ? `${byUser.get(hit.authorId)?.displayName ?? "Someone"}: ${snippet(hit.body, q)}` : null,
      };
    })
    .filter((row): row is ChatRow => row !== null);
}

function snippet(body: string, q: string): string {
  const at = body.toLowerCase().indexOf(q);
  const start = Math.max(0, at - 30);
  const end = Math.min(body.length, at + q.length + 50);
  return `${start > 0 ? "…" : ""}${body.slice(start, end)}${end < body.length ? "…" : ""}`;
}

/* -------------------------------------------------------------------------- */
/* One channel                                                                 */
/* -------------------------------------------------------------------------- */

export type ChatPollView = PollTally & {
  id: string;
  question: string;
  closesAt: string | null;
  closed: boolean;
};

export type ChatLineView = {
  id: string;
  /** A poll is a line in the timeline, rendered as a card. */
  kind: "message" | "poll";
  body: string;
  createdAt: string;
  /** "19:04", in the city's timezone, formatted on the server. */
  time: string;
  /** "Today" / "Sat 12 Sep". The view draws a separator when it changes. */
  day: string;
  author: { userId: string; handle: string; displayName: string; avatarEmoji: string } | null;
  mine: boolean;
  replyTo: { author: string; body: string } | null;
  attachment: ChatAttachment | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  poll: ChatPollView | null;
};

/**
 * The scope of a channel read: the reader's city for city rooms, nothing for
 * the rest (their membership is the scope).
 */
async function cityScope(channel: string, userId: string, citySlug?: string | null): Promise<string | null> {
  if (!CITY.has(channel)) return null;
  if (citySlug) return citySlug;
  const profile = await findOne("profiles", (row) => row.userId === userId);
  return profile?.citySlug ?? null;
}

export async function loadChannelLines(input: {
  channel: string;
  userId: string;
  citySlug?: string | null;
}): Promise<ChatLineView[]> {
  const city = await cityScope(input.channel, input.userId, input.citySlug);

  const [messages, profiles, polls, blockedIds] = await Promise.all([
    findMany("chat", (row) => row.channel === input.channel && (city === null || row.citySlug === city)),
    findMany("profiles", () => true),
    findMany("chatPolls", (row) => row.channel === input.channel),
    loadBlockedIds(input.userId),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));

  /* Polls carry no city; a poll in a city room belongs to the city its author
     was in when they posted it. */
  const scopedPolls = polls.filter((poll) => city === null || byUser.get(poll.authorId)?.citySlug === city);

  const ids = new Set(messages.map((message) => message.id));
  const pollIds = new Set(scopedPolls.map((poll) => poll.id));
  const [reactions, pollVotes] = await Promise.all([
    findMany("chatReactions", (row) => ids.has(row.messageId)),
    pollIds.size > 0 ? findMany("chatPollVotes", (row) => pollIds.has(row.pollId)) : Promise.resolve([]),
  ]);

  const byId = new Map(messages.map((message) => [message.id, message]));
  const now = Date.now();
  const today = new Date(now);
  /* City rooms are read in their own city's zone; a group or DM in the
     reader's. Either way the string is built here, so the server and the
     first client paint cannot disagree about what time it is. */
  const timeZone = (resolveCity(city ?? input.citySlug ?? "") ?? defaultCityContext).timezone;

  const author = (userId: string) => {
    const profile = byUser.get(userId);
    return profile
      ? { userId: profile.userId, handle: profile.handle, displayName: profile.displayName, avatarEmoji: profile.avatarEmoji }
      : null;
  };

  const messageLines: ChatLineView[] = messages
    .filter((message) => !blockedIds.has(message.authorId))
    .map((message) => {
      const parent = message.replyToId ? byId.get(message.replyToId) : undefined;
      return {
        id: message.id,
        kind: "message",
        body: message.body,
        createdAt: message.createdAt,
        time: fmtTime(message.createdAt, timeZone),
        day: fmtDay(message.createdAt, timeZone, today),
        author: author(message.authorId),
        mine: message.authorId === input.userId,
        replyTo: parent
          ? { author: byUser.get(parent.authorId)?.displayName ?? "Someone", body: parent.body.slice(0, 120) }
          : null,
        attachment: message.attachment ?? null,
        reactions: groupReactions(
          reactions.filter((row) => row.messageId === message.id),
          input.userId,
        ),
        poll: null,
      };
    });

  const pollLines: ChatLineView[] = scopedPolls
    .filter((poll) => !blockedIds.has(poll.authorId))
    .map((poll) => {
      const tally = tallyPoll(
        poll.options,
        pollVotes.filter((vote) => vote.pollId === poll.id),
        input.userId,
      );
      return {
        id: poll.id,
        kind: "poll",
        body: poll.question,
        createdAt: poll.createdAt,
        time: fmtTime(poll.createdAt, timeZone),
        day: fmtDay(poll.createdAt, timeZone, today),
        author: author(poll.authorId),
        mine: poll.authorId === input.userId,
        replyTo: null,
        attachment: null,
        reactions: [],
        poll: {
          ...tally,
          id: poll.id,
          question: poll.question,
          closesAt: poll.closesAt,
          closed: poll.closesAt !== null && Date.parse(poll.closesAt) < now,
        },
      };
    });

  return [...messageLines, ...pollLines].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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

/* -------------------------------------------------------------------------- */
/* Participants                                                                */
/* -------------------------------------------------------------------------- */

export type ChatParticipant = {
  userId: string;
  handle: string;
  displayName: string;
  avatarEmoji: string;
};

/**
 * Who can be @-mentioned in a channel: the people who are in it. For a city
 * room that is the discoverable students in the city (capped), for a group
 * its members, for a DM the two of you. Blocked students never appear.
 */
export async function loadChannelParticipants(input: {
  channel: string;
  userId: string;
  citySlug: string;
}): Promise<ChatParticipant[]> {
  const kind = channelKind(input.channel);
  if (!kind) return [];

  const blockedIds = await loadBlockedIds(input.userId);
  const project = (profiles: readonly Profile[]) =>
    profiles
      .filter((profile) => !blockedIds.has(profile.userId))
      .map((profile) => ({
        userId: profile.userId,
        handle: profile.handle,
        displayName: profile.displayName,
        avatarEmoji: profile.avatarEmoji,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

  switch (kind.kind) {
    case "city": {
      const profiles = await findMany(
        "profiles",
        (row) =>
          row.citySlug === input.citySlug &&
          row.onboardedAt !== null &&
          (row.privacy.discoverable || row.userId === input.userId),
      );
      return project(profiles).slice(0, 80);
    }
    case "event": {
      const responses = await findMany("eventResponses", (row) => row.eventId === kind.id);
      const ids = new Set(responses.map((row) => row.userId));
      return project(await findMany("profiles", (row) => ids.has(row.userId)));
    }
    case "invite": {
      const responses = await findMany("inviteResponses", (row) => row.inviteId === kind.id && row.status === "in");
      const ids = new Set(responses.map((row) => row.userId));
      return project(await findMany("profiles", (row) => ids.has(row.userId)));
    }
    case "plan": {
      const [plan, members] = await Promise.all([
        findOne("plans", (row) => row.id === kind.id),
        findMany("planMembers", (row) => row.planId === kind.id && row.status === "in"),
      ]);
      const ids = new Set(members.map((row) => row.userId));
      if (plan) ids.add(plan.userId);
      return project(await findMany("profiles", (row) => ids.has(row.userId)));
    }
    case "dm": {
      const ids = new Set([kind.a, kind.b]);
      return project(await findMany("profiles", (row) => ids.has(row.userId)));
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Titles                                                                      */
/* -------------------------------------------------------------------------- */

/** Human title for a channel, for the header, plus where it links back to. */
export async function channelTitle(
  channel: string,
  viewerId: string,
): Promise<{
  title: string;
  emoji: string;
  back: string;
  /** The thing the chat is about, as a link. */
  about: { href: string; label: string } | null;
  /** The post channel that pairs with a city room. */
  posts: string | null;
} | null> {
  const kind = channelKind(channel);
  if (!kind) return null;
  switch (kind.kind) {
    case "city": {
      const meta = loopChannels.find((entry) => entry.slug === kind.slug);
      return meta
        ? { title: meta.label, emoji: meta.emoji, back: "/pulse/chat", about: null, posts: `/pulse?channel=${kind.slug}` }
        : null;
    }
    case "event": {
      const event = await findOne("events", (row) => row.id === kind.id);
      return event
        ? { title: event.title, emoji: "🎟️", back: "/pulse/chat", about: { href: `/events/${event.id}`, label: "Event" }, posts: null }
        : null;
    }
    case "invite": {
      const invite = await findOne("invites", (row) => row.id === kind.id);
      return invite
        ? { title: invite.title, emoji: "🙋", back: "/pulse/chat", about: { href: `/anyone-down/${invite.id}`, label: "Plan" }, posts: null }
        : null;
    }
    case "plan": {
      const plan = await findOne("plans", (row) => row.id === kind.id);
      return plan
        ? { title: plan.title, emoji: "🗓️", back: "/pulse/chat", about: { href: `/plans/${plan.id}`, label: "Plan" }, posts: null }
        : null;
    }
    case "dm": {
      const other = kind.a === viewerId ? kind.b : kind.a;
      const profile = await findOne("profiles", (row) => row.userId === other);
      return profile
        ? { title: profile.displayName, emoji: profile.avatarEmoji, back: "/pulse/chat", about: null, posts: null }
        : null;
    }
  }
}
