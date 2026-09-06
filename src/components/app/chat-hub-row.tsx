"use client";

import { Archive, BellOff, MoreHorizontal, Pin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { setChatPref } from "@/server/actions/chat";
import type { ChatRow } from "@/server/queries/chat";
import { ago, cn } from "@/lib/utils";

/** One conversation in the hub, with pin / mute / archive behind a menu. */
export function ChatHubRow({ row, minutesAgo }: { row: ChatRow; minutesAgo: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const set = (patch: Partial<{ pinned: boolean; muted: boolean; archived: boolean }>) => {
    setOpen(false);
    startTransition(async () => {
      await setChatPref(row.channel, patch);
      router.refresh();
    });
  };

  return (
    <li ref={ref} className="relative">
      <Link
        href={row.href}
        className={cn(
          "flex items-center gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-paper-2",
          row.archived && "opacity-60",
        )}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-paper-2 text-xl">
          {row.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[0.9375rem] font-semibold text-ink-950">{row.title}</span>
            {row.pinned ? <Pin className="size-3 shrink-0 text-ink-400" /> : null}
            {row.muted ? <BellOff className="size-3 shrink-0 text-ink-400" /> : null}
          </span>
          <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-500">
            {row.lastLine ?? "No messages yet"}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 pr-7">
          {minutesAgo !== null ? (
            <span className="font-mono text-micro text-ink-400">{ago(minutesAgo)}</span>
          ) : null}
          {row.unread > 0 ? (
            <span className="tnum rounded-full bg-pulse px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
              {row.unread}
            </span>
          ) : null}
        </span>
      </Link>

      <button
        type="button"
        aria-label={`Options for ${row.title}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-800"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open ? (
        <ul
          role="menu"
          className="absolute top-full right-2 z-30 mt-1 w-44 overflow-hidden rounded-xl bg-white p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-ink-950/8"
        >
          <li role="none">
            <button type="button" role="menuitem" onClick={() => set({ pinned: !row.pinned })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.875rem] text-ink-800 hover:bg-paper-2">
              <Pin className="size-4 text-ink-400" /> {row.pinned ? "Unpin" : "Pin"}
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={() => set({ muted: !row.muted })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.875rem] text-ink-800 hover:bg-paper-2">
              <BellOff className="size-4 text-ink-400" /> {row.muted ? "Unmute" : "Mute"}
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={() => set({ archived: !row.archived })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.875rem] text-ink-800 hover:bg-paper-2">
              <Archive className="size-4 text-ink-400" /> {row.archived ? "Unarchive" : "Archive"}
            </button>
          </li>
        </ul>
      ) : null}
    </li>
  );
}
