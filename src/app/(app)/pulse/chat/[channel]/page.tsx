import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { type Attachable, ChatView } from "@/components/app/chat-view";
import { placesForCity } from "@/data/places";
import { markChannelRead } from "@/server/actions/chat";
import { loopChannels } from "@/server/db/seed-content";
import { canReadChannel, channelKind, channelTitle, loadChannelLines } from "@/server/queries/chat";
import { findMany } from "@/server/db";
import { requireViewer } from "@/server/viewer";
import { isBackendConfigured } from "@/services/env";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

/**
 * One channel of any kind. Access is decided by `canReadChannel`; a channel
 * the student may not read renders as not found rather than as a locked room,
 * because confirming a private group exists is itself a leak.
 */
export default async function ChatPage(props: PageProps<"/pulse/chat/[channel]">) {
  const viewer = await requireViewer();
  const { channel } = await props.params;

  if (!channelKind(channel)) notFound();
  if (!(await canReadChannel(viewer.user.id, channel))) notFound();

  const title = await channelTitle(channel, viewer.user.id);
  if (!title) notFound();

  const lines = await loadChannelLines({ channel, userId: viewer.user.id });
  await markChannelRead(channel);

  /* ---- resolve attachment cards and what can be attached ----------------- */
  const where = viewer.currency;
  const places = placesForCity(viewer.profile.citySlug);
  const [events, saved, responses, plans] = await Promise.all([
    findMany("events", (row) => row.citySlug === viewer.profile.citySlug),
    findMany("saved", (row) => row.userId === viewer.user.id),
    findMany("eventResponses", (row) => row.userId === viewer.user.id),
    findMany("plans", (row) => row.userId === viewer.user.id),
  ]);

  const toCard = (kind: Attachable["kind"], id: string): Attachable | null => {
    if (kind === "event") {
      const event = events.find((row) => row.id === id);
      return event
        ? {
            kind,
            id,
            title: event.title,
            meta: `${new Date(event.startsAt).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })} · ${event.priceCents === 0 ? "Free" : money(event.priceCents / 100, where)}`,
            href: `/events/${id}`,
          }
        : null;
    }
    if (kind === "place") {
      const place = places.find((row) => row.id === id);
      return place
        ? { kind, id, title: place.name, meta: `${place.priceLabel} · ${place.walkMinutes} min walk`, href: `/discover/${id}` }
        : null;
    }
    if (kind === "plan") {
      const plan = plans.find((row) => row.id === id);
      return plan ? { kind, id, title: plan.title, meta: `${plan.items.length} stops`, href: `/plans/${id}` } : null;
    }
    return null;
  };

  const attachments: Record<string, Attachable> = {};
  for (const line of lines) {
    if (!line.attachment) continue;
    const card = toCard(line.attachment.kind, line.attachment.id);
    if (card) attachments[`${line.attachment.kind}:${line.attachment.id}`] = card;
  }

  const attachables: Attachable[] = [
    ...responses.map((row) => toCard("event", row.eventId)),
    ...saved.filter((row) => row.kind === "place").map((row) => toCard("place", row.targetId)),
    ...saved.filter((row) => row.kind === "event").map((row) => toCard("event", row.targetId)),
    ...plans.map((row) => toCard("plan", row.id)),
  ]
    .filter((card): card is Attachable => card !== null)
    .filter((card, index, list) => list.findIndex((other) => other.kind === card.kind && other.id === card.id) === index)
    .slice(0, 12);

  const kind = channelKind(channel)!;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href={title.back} className="mb-5 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        {kind.kind === "city" ? "All chats" : "Back"}
      </Link>

      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-paper-2 text-xl" aria-hidden>
          {title.emoji}
        </span>
        <div className="min-w-0">
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
            {" · "}
            {isBackendConfigured ? "live" : "refreshes every 12s"}
          </p>
        </div>
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

      <ChatView channel={channel} lines={lines} attachments={attachments} attachables={attachables} />
    </div>
  );
}
