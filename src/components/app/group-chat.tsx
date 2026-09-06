"use client";

import { Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { sendChat } from "@/server/actions/loop";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * CHAT
 * ----------------------------------------------------------------------------
 * City channels and Anyone Down? group chats.
 *
 * On transport, honestly: with Supabase configured this subscribes to the
 * `chat:{city}` Realtime channel and messages arrive pushed. Without it — the
 * default local backend — there is no socket to subscribe to, so this refreshes
 * the server component after a send and on a slow interval while the tab is
 * visible.
 *
 * The interval is 12 seconds and it stops entirely when the tab is hidden.
 * That is the difference between a fallback and a battery leak: a chat polling
 * every two seconds in forty background tabs is worse than a chat that updates
 * a little late.
 * ============================================================================
 */

export type ChatLine = {
  id: string;
  body: string;
  createdAt: string;
  author: { displayName: string; avatarEmoji: string } | null;
  mine: boolean;
};

export function ChatView({
  lines,
  channel,
  onSent,
}: {
  lines: readonly ChatLine[];
  channel: string;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Poll only while the tab is visible. */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, 12_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  const send = () => {
    const body = value.trim();
    if (!body) return;

    setError(null);
    setValue("");

    startTransition(async () => {
      const result = await sendChat(channel, body);
      if (!result.ok) {
        setError(result.message);
        /* Put the text back so a rate-limited message is not simply lost. */
        setValue(body);
        return;
      }
      onSent?.();
      router.refresh();
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <ul className="max-h-96 space-y-3 overflow-y-auto p-4 edge-fade-y">
        {lines.length === 0 ? (
          <li className="py-8 text-center text-[0.9375rem] text-ink-400">
            Nothing here yet. Say the first thing.
          </li>
        ) : (
          lines.map((line) => (
            <li
              key={line.id}
              className={cn("flex gap-2.5", line.mine && "flex-row-reverse")}
            >
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-paper-2 text-base"
              >
                {line.author?.avatarEmoji ?? "🙂"}
              </span>

              <div className={cn("min-w-0 max-w-[75%]", line.mine && "text-right")}>
                <p className="text-[0.75rem] text-ink-400">
                  {line.author?.displayName ?? "Someone"} ·{" "}
                  {new Date(line.createdAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p
                  className={cn(
                    "mt-1 inline-block rounded-2xl px-3.5 py-2 text-left text-[0.9375rem] leading-snug",
                    line.mine ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-800",
                  )}
                >
                  {line.body}
                </p>
              </div>
            </li>
          ))
        )}
        <div ref={bottomRef} />
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-ink-200 p-3"
      >
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Message"
          aria-label="Message"
          maxLength={1000}
          className="h-11 flex-1 rounded-full border border-ink-200 bg-white px-4 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:border-ink-400"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={pending || value.trim().length === 0}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full transition-colors",
            value.trim().length === 0
              ? "bg-ink-100 text-ink-400"
              : "bg-ink-950 text-signal hover:bg-ink-800",
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>

      {error ? (
        <p role="alert" className="border-t border-ink-200 px-4 py-2 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The Anyone Down? group chat. Lines are loaded by the server component that
 * renders it — a client component fetching its own history would mean a second
 * round-trip and a visible empty state on every open.
 */
export function GroupChat({
  channel,
  lines,
}: {
  channel: string;
  lines: readonly ChatLine[];
}) {
  return <ChatView lines={lines} channel={channel} />;
}
