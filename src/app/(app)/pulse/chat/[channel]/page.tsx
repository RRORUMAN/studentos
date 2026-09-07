import { ArrowLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChatView, MarkRead } from "@/components/app/chat-view";
import { loopChannels } from "@/server/db/seed-content";
import {
  canReadChannel,
  channelKind,
  channelTitle,
  loadChannelLines,
  loadChannelParticipants,
} from "@/server/queries/chat";
import { loadAttachables, resolveAttachment, whereFor, type AttachmentCard } from "@/server/queries/loop";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

/**
 * One channel of any kind. Access is decided by `canReadChannel`; a channel
 * the student may not read renders as not found rather than as a locked room,
 * because confirming a private group exists is itself a leak.
 *
 * City rooms are scoped to the reader's city — the slug `#housing` exists in
 * every city, and before this every one of them was the same room.
 */
export default async function ChatPage(props: PageProps<"/pulse/chat/[channel]">) {
  const viewer = await requireViewer();
  const { channel } = await props.params;

  const kind = channelKind(channel);
  if (!kind) notFound();
  if (!(await canReadChannel(viewer.user.id, channel))) notFound();

  const title = await channelTitle(channel, viewer.user.id);
  if (!title) notFound();

  const where = whereFor(viewer.profile.citySlug, viewer.profile);
  const now = requestDate();

  const [lines, participants, attachables] = await Promise.all([
    loadChannelLines({ channel, userId: viewer.user.id, citySlug: viewer.profile.citySlug }),
    loadChannelParticipants({ channel, userId: viewer.user.id, citySlug: viewer.profile.citySlug }),
    loadAttachables(viewer.profile.citySlug, where),
  ]);

  /* Attachments already in the timeline are resolved from their live rows —
     including rows that are not in the picker (a plan, an invite, a mission),
     and rows that have since gone, which render as "no longer listed". */
  const cards = new Map<string, AttachmentCard>(attachables.map((card) => [`${card.kind}:${card.id}`, card]));
  for (const line of lines) {
    if (!line.attachment) continue;
    const key = `${line.attachment.kind}:${line.attachment.id}`;
    if (cards.has(key)) continue;
    const card = await resolveAttachment(viewer.profile.citySlug, line.attachment, where, now);
    if (card) cards.set(key, card);
  }

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href={title.back} className="mb-5 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        All chats
      </Link>

      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-paper-2 text-xl" aria-hidden>
          {title.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-display-xs text-ink-950">{title.title}</h1>
          <p className="text-[0.8125rem] text-ink-500">
            {kind.kind === "city"
              ? `${viewer.city.name} · open to every student here`
              : kind.kind === "event"
                ? "People who are going or interested"
                : kind.kind === "invite"
                  ? "People who joined this plan"
                  : kind.kind === "plan"
                    ? "People on this plan"
                    : "Just the two of you"}
          </p>
        </div>

        {title.about ? (
          <Link
            href={title.about.href}
            className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[0.8125rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20"
          >
            {title.about.label}
          </Link>
        ) : null}

        {title.posts ? (
          <Link
            href={title.posts}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.8125rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20"
          >
            <FileText className="size-3.5" />
            Posts in #{title.title}
          </Link>
        ) : null}
      </header>

      {kind.kind === "city" ? (
        <nav aria-label="Channels" className="-mx-5 mt-4 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
          {loopChannels.map((entry) => (
            <Link
              key={entry.slug}
              href={`/pulse/chat/${entry.slug}`}
              aria-current={entry.slug === channel ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
                entry.slug === channel ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
              )}
            >
              <span aria-hidden>{entry.emoji}</span>
              {entry.label}
            </Link>
          ))}
        </nav>
      ) : (
        <div className="mt-4" />
      )}

      <MarkRead channel={channel} />

      <ChatView
        channel={channel}
        lines={lines}
        attachables={[...cards.values()]}
        participants={participants}
        emptyLine={
          kind.kind === "dm" ? "No messages yet. Say hello." : "Nothing here yet. Say the first thing."
        }
      />
    </div>
  );
}
