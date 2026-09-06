import { ArrowLeft, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ChatHubRow } from "@/components/app/chat-hub-row";
import { MascotArt } from "@/components/mascot/mascot-art";
import { loadChatHub, type ChatGroup } from "@/server/queries/chat";
import { requestNow } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * CHAT HUB
 * ----------------------------------------------------------------------------
 * Every conversation, grouped: Direct · Groups · Campus · Events · Anyone Down.
 * Pinned first, archived hidden behind a toggle, muted with no unread badge.
 * Search filters the titles and last lines.
 * ============================================================================
 */

const GROUPS: readonly { value: ChatGroup | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "direct", label: "Direct" },
  { value: "groups", label: "Groups" },
  { value: "campus", label: "Campus" },
  { value: "events", label: "Events" },
  { value: "anyone-down", label: "Anyone down" },
];

export default async function ChatHubPage(props: PageProps<"/pulse/chat">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestNow();

  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const group = GROUPS.some((entry) => entry.value === one("group")) ? (one("group") as ChatGroup | "all") : "all";
  const showArchived = one("archived") === "1";
  const query = (one("q") ?? "").trim().toLowerCase();

  const rows = await loadChatHub({
    userId: viewer.user.id,
    citySlug: viewer.profile.citySlug,
    campusSlug: viewer.profile.campusSlug,
  });

  const visible = rows
    .filter((row) => (group === "all" ? true : row.group === group))
    .filter((row) => (showArchived ? row.archived : !row.archived))
    .filter((row) =>
      query
        ? row.title.toLowerCase().includes(query) || (row.lastLine ?? "").toLowerCase().includes(query)
        : true,
    );

  const unreadTotal = rows.filter((row) => !row.archived).reduce((sum, row) => sum + row.unread, 0);

  const urlWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current = { group: group === "all" ? null : group, archived: showArchived ? "1" : null, q: query || null, ...patch };
    for (const [key, value] of Object.entries(current)) if (value) next.set(key, value);
    const qs = next.toString();
    return qs ? `/pulse/chat?${qs}` : "/pulse/chat";
  };

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href="/pulse" className="mb-5 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        Pulse
      </Link>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Chat</h1>
          <p className="mt-1 text-[0.9375rem] text-ink-500">
            {unreadTotal > 0 ? `${unreadTotal} unread` : "You are caught up."} · Updates every few seconds while open.
          </p>
        </div>
      </header>

      <form action="/pulse/chat" className="relative mt-4">
        {group !== "all" ? <input type="hidden" name="group" value={group} /> : null}
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
        <input
          name="q"
          defaultValue={query}
          placeholder="Search chats"
          aria-label="Search chats"
          className="h-11 w-full rounded-full bg-white pl-10 pr-4 text-[0.9375rem] text-ink-900 ring-1 ring-ink-950/8 placeholder:text-ink-400 focus:ring-ink-950/25"
        />
      </form>

      <nav aria-label="Chat groups" className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        {GROUPS.map((entry) => (
          <Link
            key={entry.value}
            href={urlWith({ group: entry.value === "all" ? null : entry.value })}
            aria-current={group === entry.value ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[0.875rem] font-medium transition-colors",
              group === entry.value ? "bg-ink-950 text-paper" : "bg-white text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20",
            )}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <section className="mt-4 rounded-2xl bg-white p-1.5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <MascotArt state="social" className="size-16" />
            <p className="mt-4 text-[0.9375rem] text-ink-700">
              {group === "direct"
                ? "Direct messages open once you are friends with someone."
                : group === "events"
                  ? "Say you are going to an event and its chat appears here."
                  : group === "anyone-down"
                    ? "Join a plan and its group appears here."
                    : showArchived
                      ? "Nothing archived."
                      : "Nothing here yet."}
            </p>
            <Link
              href={group === "direct" ? "/you/friends" : group === "events" ? "/events" : group === "anyone-down" ? "/anyone-down" : "/pulse"}
              className="mt-4 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper"
            >
              {group === "direct" ? "Find people" : group === "events" ? "Event radar" : group === "anyone-down" ? "See open plans" : "Back to Pulse"}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100/70">
            {visible.map((row) => (
              <ChatHubRow
                key={row.channel}
                row={row}
                minutesAgo={row.lastAt ? (now - Date.parse(row.lastAt)) / 60_000 : null}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-3 text-center text-[0.8125rem]">
        <Link href={urlWith({ archived: showArchived ? null : "1" })} className="font-medium text-ink-500 underline underline-offset-4 hover:text-ink-900">
          {showArchived ? "Back to active chats" : "Show archived"}
        </Link>
      </p>
    </div>
  );
}
