"use client";

import { CalendarDays, CornerDownRight, Loader2, MapPin, Paperclip, Send, SmilePlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { ChatAttachment } from "@/domain/types";
import { sendMessage, toggleReaction } from "@/server/actions/chat";
import type { ChatLineView } from "@/server/queries/chat";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * CHAT VIEW
 * ----------------------------------------------------------------------------
 * One channel: messages with replies, reactions and attachments, and a
 * composer that can attach an event, a place or a plan by reference.
 *
 * Transport, honestly: with Supabase configured this becomes a Realtime
 * subscription. Without it there is no socket, so this refreshes after a send
 * and every 12 seconds while the tab is visible — a fallback, not a battery
 * leak. The header on the page says which mode is running.
 * ============================================================================
 */

const QUICK_REACTIONS = ["👍", "🔥", "😂", "🙌", "👀", "❤️"];

export type Attachable = {
  kind: ChatAttachment["kind"];
  id: string;
  title: string;
  meta: string;
  href: string;
};

export function ChatView({
  channel,
  lines,
  attachments,
  attachables,
}: {
  channel: string;
  lines: readonly ChatLineView[];
  /** Resolved cards for attachments present in `lines`, by `${kind}:${id}`. */
  attachments: Record<string, Attachable>;
  /** Things this student could attach: their saved and upcoming rows. */
  attachables: readonly Attachable[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [replyTo, setReplyTo] = useState<ChatLineView | null>(null);
  const [attachment, setAttachment] = useState<Attachable | null>(null);
  const [picking, setPicking] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!body && !attachment) return;
    setError(null);
    const snapshot = { body, replyTo, attachment };
    setValue("");
    setReplyTo(null);
    setAttachment(null);

    startTransition(async () => {
      const result = await sendMessage({
        channel,
        body: snapshot.body,
        replyToId: snapshot.replyTo?.id ?? null,
        attachment: snapshot.attachment ? { kind: snapshot.attachment.kind, id: snapshot.attachment.id } : null,
      });
      if (!result.ok) {
        setError(result.message);
        setValue(snapshot.body);
        setReplyTo(snapshot.replyTo);
        setAttachment(snapshot.attachment);
        return;
      }
      router.refresh();
    });
  };

  const react = (messageId: string, emoji: string) => {
    setReactingTo(null);
    startTransition(async () => {
      await toggleReaction(messageId, emoji);
      router.refresh();
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <ul className="max-h-[60vh] min-h-64 space-y-3 overflow-y-auto p-4 edge-fade-y">
        {lines.length === 0 ? (
          <li className="py-10 text-center text-[0.9375rem] text-ink-400">
            Nothing here yet. Say the first thing.
          </li>
        ) : (
          lines.map((line) => {
            const card = line.attachment ? attachments[`${line.attachment.kind}:${line.attachment.id}`] : null;
            return (
              <li key={line.id} className={cn("group flex gap-2.5", line.mine && "flex-row-reverse")}>
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-paper-2 text-base"
                >
                  {line.author?.avatarEmoji ?? "🙂"}
                </span>

                <div className={cn("min-w-0 max-w-[80%]", line.mine && "text-right")}>
                  <p className="text-[0.75rem] text-ink-400">
                    {line.author?.displayName ?? "Someone"} ·{" "}
                    {new Date(line.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>

                  {line.replyTo ? (
                    <p className={cn("mt-1 flex items-center gap-1 text-[0.75rem] text-ink-500", line.mine && "justify-end")}>
                      <CornerDownRight className="size-3" />
                      <span className="truncate">
                        {line.replyTo.author}: {line.replyTo.body}
                      </span>
                    </p>
                  ) : null}

                  {line.body ? (
                    <p
                      className={cn(
                        "mt-1 inline-block rounded-2xl px-3.5 py-2 text-left text-[0.9375rem] leading-snug",
                        line.mine ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-800",
                      )}
                    >
                      {line.body}
                    </p>
                  ) : null}

                  {card ? (
                    <Link
                      href={card.href}
                      className="mt-1.5 flex items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-ink-950/10 hover:shadow-[var(--shadow-raise)]"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-signal-soft">
                        {card.kind === "event" ? <CalendarDays className="size-4 text-signal-deep" /> : <MapPin className="size-4 text-signal-deep" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[0.875rem] font-semibold text-ink-950">{card.title}</span>
                        <span className="block text-[0.75rem] text-ink-500">{card.meta}</span>
                      </span>
                    </Link>
                  ) : line.attachment ? (
                    <p className="mt-1 text-[0.75rem] text-ink-400">Shared something that is no longer listed.</p>
                  ) : null}

                  {/* ---- reactions + row actions -------------------------------- */}
                  <div className={cn("mt-1 flex flex-wrap items-center gap-1", line.mine && "justify-end")}>
                    {line.reactions.map((reaction) => (
                      <button
                        key={reaction.emoji}
                        type="button"
                        onClick={() => react(line.id, reaction.emoji)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.75rem]",
                          reaction.mine ? "bg-signal-soft ring-1 ring-signal-deep/30" : "bg-paper-2",
                        )}
                      >
                        {reaction.emoji}
                        <span className="tnum text-ink-600">{reaction.count}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label="React"
                      onClick={() => setReactingTo(reactingTo === line.id ? null : line.id)}
                      className="grid size-6 place-items-center rounded-full text-ink-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-paper-2 hover:text-ink-700 focus:opacity-100 sm:opacity-0 [@media(hover:none)]:opacity-100"
                    >
                      <SmilePlus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Reply"
                      onClick={() => {
                        setReplyTo(line);
                        inputRef.current?.focus();
                      }}
                      className="grid size-6 place-items-center rounded-full text-ink-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-paper-2 hover:text-ink-700 focus:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <CornerDownRight className="size-3.5" />
                    </button>
                  </div>

                  {reactingTo === line.id ? (
                    <div className={cn("mt-1 inline-flex gap-1 rounded-full bg-white p-1 shadow-[var(--shadow-float)] ring-1 ring-ink-950/8")}>
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => react(line.id, emoji)}
                          className="grid size-8 place-items-center rounded-full text-lg hover:bg-paper-2"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
        <div ref={bottomRef} />
      </ul>

      {/* ---- composer ------------------------------------------------------- */}
      <div className="border-t border-ink-100">
        {replyTo ? (
          <div className="flex items-center gap-2 px-4 pt-2.5 text-[0.8125rem] text-ink-600">
            <CornerDownRight className="size-3.5 text-ink-400" />
            <span className="truncate">
              Replying to {replyTo.author?.displayName ?? "someone"}: {replyTo.body.slice(0, 60)}
            </span>
            <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)} className="ml-auto text-ink-400 hover:text-ink-800">
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {attachment ? (
          <div className="flex items-center gap-2 px-4 pt-2.5 text-[0.8125rem] text-ink-700">
            <Paperclip className="size-3.5 text-ink-400" />
            <span className="truncate font-medium">{attachment.title}</span>
            <button type="button" aria-label="Remove attachment" onClick={() => setAttachment(null)} className="ml-auto text-ink-400 hover:text-ink-800">
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {picking ? (
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="mb-2 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Attach something you saved or are going to</p>
            {attachables.length === 0 ? (
              <p className="text-[0.8125rem] text-ink-500">Save a place or say you are going to an event, and it appears here.</p>
            ) : (
              <ul className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {attachables.map((item) => (
                  <li key={`${item.kind}:${item.id}`} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAttachment(item);
                        setPicking(false);
                      }}
                      className="w-44 rounded-xl bg-paper-2 p-3 text-left hover:bg-ink-100"
                    >
                      <span className="block truncate text-[0.8125rem] font-semibold text-ink-900">{item.title}</span>
                      <span className="block truncate text-[0.75rem] text-ink-500">{item.meta}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="flex items-center gap-2 p-3"
        >
          <button
            type="button"
            aria-label="Attach"
            aria-pressed={picking}
            onClick={() => setPicking((current) => !current)}
            className={cn("grid size-10 shrink-0 place-items-center rounded-full transition-colors", picking ? "bg-ink-950 text-paper" : "text-ink-400 hover:bg-paper-2 hover:text-ink-800")}
          >
            <Paperclip className="size-4" />
          </button>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Message"
            aria-label="Message"
            maxLength={1000}
            className="h-11 flex-1 rounded-full bg-paper-2 px-4 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:ring-2 focus:ring-ink-950/20"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={pending || (value.trim().length === 0 && !attachment)}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full transition-colors",
              value.trim().length === 0 && !attachment ? "bg-ink-100 text-ink-400" : "bg-ink-950 text-signal hover:bg-ink-800",
            )}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>

        {error ? (
          <p role="alert" className="px-4 pb-3 text-[0.8125rem] text-pulse-deep">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
