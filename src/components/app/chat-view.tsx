"use client";

import { BarChart3, Check, CornerDownRight, Loader2, Paperclip, Send, SmilePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { AttachmentChip } from "@/components/app/pulse-card";
import type { ChatAttachment } from "@/domain/types";
import { createChatPoll, sendMessage, toggleReaction, voteChatPoll } from "@/server/actions/chat";
import type { ChatLineView, ChatParticipant } from "@/server/queries/chat";
import type { AttachmentCard } from "@/server/queries/loop";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * CHAT VIEW
 * ----------------------------------------------------------------------------
 * One channel: messages with replies, reactions, @mentions, polls and
 * attachments that render from live rows.
 *
 * Transport, stated honestly: there is no realtime backend. Nothing here is
 * pushed and nothing is labelled "live". The view re-reads the server
 * component on an adaptive interval — about four seconds while you are
 * actually in the conversation (tab focused, recent activity), backing off to
 * thirty when the room is quiet, and stopping entirely when the tab is hidden.
 * That is the difference between a fallback and a battery leak: a chat polling
 * every two seconds in forty background tabs is worse than a chat that updates
 * a little late.
 * ============================================================================
 */

const QUICK_REACTIONS = ["👍", "🔥", "😂", "🙌", "👀", "❤️"];

const ACTIVE_MS = 4_000;
const IDLE_MS = 30_000;
/** A room is "active" while something was said in the last few minutes. */
const ACTIVE_WINDOW_MS = 5 * 60_000;

/** Kept for older call sites that imported the picker's shape from here. */
export type Attachable = AttachmentCard;

export function ChatView({
  channel,
  lines,
  attachables,
  participants,
  canPoll = true,
  emptyLine = "Nothing here yet. Say the first thing.",
}: {
  channel: string;
  lines: readonly ChatLineView[];
  /** Things this student could attach: live rows in their city. */
  attachables: readonly AttachmentCard[];
  /** Who can be @-mentioned here. */
  participants: readonly ChatParticipant[];
  canPoll?: boolean;
  emptyLine?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [replyTo, setReplyTo] = useState<ChatLineView | null>(null);
  const [attachment, setAttachment] = useState<AttachmentCard | null>(null);
  const [picking, setPicking] = useState(false);
  const [poll, setPoll] = useState<{ question: string; options: string[] } | null>(null);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [mention, setMention] = useState<{ query: string; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lastAt = lines.length > 0 ? Date.parse(lines[lines.length - 1].createdAt) : 0;

  /* ---- adaptive refresh -------------------------------------------------
     Fast while the tab is focused and the room is warm; slow when it is not;
     nothing at all while hidden. */
  useEffect(() => {
    let timer: number | undefined;

    const schedule = () => {
      window.clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      const warm = document.hasFocus() && Date.now() - lastAt < ACTIVE_WINDOW_MS;
      timer = window.setTimeout(() => {
        router.refresh();
        schedule();
      }, warm ? ACTIVE_MS : IDLE_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") router.refresh();
      schedule();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", schedule);
    window.addEventListener("blur", schedule);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("blur", schedule);
    };
  }, [router, lastAt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  /* ---- mentions --------------------------------------------------------- */
  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return participants
      .filter((person) => person.handle.toLowerCase().startsWith(q) || person.displayName.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [mention, participants]);

  const onChange = (next: string, caret: number) => {
    setValue(next);
    const upto = next.slice(0, caret);
    const match = /(?:^|\s)@([a-z0-9_.-]{0,20})$/i.exec(upto);
    setMention(match ? { query: match[1], at: caret - match[1].length - 1 } : null);
  };

  const applyMention = (person: ChatParticipant) => {
    if (!mention) return;
    const before = value.slice(0, mention.at);
    const after = value.slice(mention.at + mention.query.length + 1);
    const next = `${before}@${person.handle} ${after.replace(/^\s+/, "")}`;
    setValue(next);
    setMention(null);
    inputRef.current?.focus();
  };

  const send = useCallback(() => {
    const body = value.trim();
    if (!body && !attachment) return;
    setError(null);
    const snapshot = { body, replyTo, attachment };
    setValue("");
    setReplyTo(null);
    setAttachment(null);
    setMention(null);

    startTransition(async () => {
      const result = await sendMessage({
        channel,
        body: snapshot.body,
        replyToId: snapshot.replyTo?.id ?? null,
        attachment: snapshot.attachment
          ? ({ kind: snapshot.attachment.kind, id: snapshot.attachment.id } as ChatAttachment)
          : null,
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
  }, [attachment, channel, replyTo, router, value]);

  const react = (messageId: string, emoji: string) => {
    setReactingTo(null);
    startTransition(async () => {
      await toggleReaction(messageId, emoji);
      router.refresh();
    });
  };

  const submitPoll = () => {
    if (!poll) return;
    setError(null);
    startTransition(async () => {
      const result = await createChatPoll({ channel, question: poll.question, options: poll.options });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPoll(null);
      router.refresh();
    });
  };

  let lastDay: string | null = null;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <ul aria-label="Conversation" className="max-h-[60vh] min-h-64 space-y-3 overflow-y-auto p-4 edge-fade-y">
        {lines.length === 0 ? (
          <li className="py-10 text-center text-[0.9375rem] text-ink-400">{emptyLine}</li>
        ) : (
          lines.map((line) => {
            const showDay = line.day !== lastDay;
            lastDay = line.day;

            return (
              <li key={line.id} className="space-y-3">
                {showDay ? (
                  <p className="flex items-center gap-3 py-1">
                    <span aria-hidden className="h-px flex-1 bg-ink-100" />
                    <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{line.day}</span>
                    <span aria-hidden className="h-px flex-1 bg-ink-100" />
                  </p>
                ) : null}

                <div className={cn("group flex gap-2.5", line.mine && "flex-row-reverse")}>
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-paper-2 text-base">
                    {line.author?.avatarEmoji ?? "🙂"}
                  </span>

                  <div className={cn("min-w-0 max-w-[80%]", line.mine && "text-right")}>
                    <p className="text-[0.75rem] text-ink-400">
                      {line.author?.displayName ?? "Someone"} · {line.time}
                    </p>

                    {line.replyTo ? (
                      <p className={cn("mt-1 flex items-center gap-1 text-[0.75rem] text-ink-500", line.mine && "justify-end")}>
                        <CornerDownRight className="size-3" />
                        <span className="truncate">
                          {line.replyTo.author}: {line.replyTo.body}
                        </span>
                      </p>
                    ) : null}

                    {line.kind === "poll" && line.poll ? (
                      <ChatPollCard poll={line.poll} />
                    ) : line.body ? (
                      <p
                        className={cn(
                          "mt-1 inline-block rounded-2xl px-3.5 py-2 text-left text-[0.9375rem] leading-snug",
                          line.mine ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-800",
                        )}
                      >
                        <MessageBody body={line.body} participants={participants} mine={line.mine} />
                      </p>
                    ) : null}

                    {line.attachment ? (
                      <ChatAttachmentSlot attachment={line.attachment} attachables={attachables} />
                    ) : null}

                    {line.kind === "message" ? (
                      <>
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
                            className="grid size-6 place-items-center rounded-full text-ink-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-paper-2 hover:text-ink-700 focus:opacity-100 [@media(hover:none)]:opacity-100"
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
                          <div className="mt-1 inline-flex gap-1 rounded-full bg-white p-1 shadow-[var(--shadow-float)] ring-1 ring-ink-950/8">
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
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })
        )}
        <div ref={bottomRef} />
      </ul>

      {/* ---- composer ------------------------------------------------------
          Sticky at the bottom of the viewport on a phone, inside the safe
          area so the send button never sits under a home indicator. */}
      <div className="sticky bottom-0 border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)]">
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

        {poll ? (
          <PollComposer
            poll={poll}
            pending={pending}
            onChange={setPoll}
            onCancel={() => setPoll(null)}
            onSubmit={submitPoll}
          />
        ) : null}

        {picking ? (
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="mb-2 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
              Share something real from your city
            </p>
            {attachables.length === 0 ? (
              <p className="text-[0.8125rem] text-ink-500">Nothing listed to share yet.</p>
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

        {mention && mentionMatches.length > 0 ? (
          <ul className="border-b border-ink-100 px-2 py-1.5">
            {mentionMatches.map((person) => (
              <li key={person.userId}>
                <button
                  type="button"
                  onClick={() => applyMention(person)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-paper-2"
                >
                  <span aria-hidden>{person.avatarEmoji}</span>
                  <span className="text-[0.875rem] font-medium text-ink-900">{person.displayName}</span>
                  <span className="text-[0.8125rem] text-ink-400">@{person.handle}</span>
                </button>
              </li>
            ))}
          </ul>
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
            onClick={() => {
              setPicking((current) => !current);
              setPoll(null);
            }}
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
              picking ? "bg-ink-950 text-paper" : "text-ink-400 hover:bg-paper-2 hover:text-ink-800",
            )}
          >
            <Paperclip className="size-4" />
          </button>

          {canPoll ? (
            <button
              type="button"
              aria-label="Start a poll"
              aria-pressed={Boolean(poll)}
              onClick={() => {
                setPoll((current) => (current ? null : { question: "", options: ["", ""] }));
                setPicking(false);
              }}
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
                poll ? "bg-ink-950 text-paper" : "text-ink-400 hover:bg-paper-2 hover:text-ink-800",
              )}
            >
              <BarChart3 className="size-4" />
            </button>
          ) : null}

          <input
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value, event.target.selectionStart ?? event.target.value.length)}
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

/* -------------------------------------------------------------------------- */
/* Message body — mentions                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Highlight `@handle` where the handle belongs to someone in the channel. An
 * unmatched @something stays plain text: styling it would imply a person who
 * is not there.
 */
function MessageBody({
  body,
  participants,
  mine,
}: {
  body: string;
  participants: readonly ChatParticipant[];
  mine: boolean;
}) {
  const handles = useMemo(() => new Set(participants.map((person) => person.handle.toLowerCase())), [participants]);
  const parts = body.split(/(@[a-zA-Z0-9_.-]+)/g);

  return (
    <>
      {parts.map((part, index) => {
        const isMention = part.startsWith("@") && handles.has(part.slice(1).toLowerCase());
        if (!isMention) return <span key={index}>{part}</span>;
        return (
          <span
            key={index}
            className={cn("rounded px-1 font-medium", mine ? "bg-paper/20 text-signal" : "bg-signal-soft text-signal-deep")}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Attachment in a message                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The card for a message attachment. `attachables` is the set of live rows the
 * page resolved; anything not in it is a row that has gone, and the message
 * says so rather than rendering a stale copy.
 */
function ChatAttachmentSlot({
  attachment,
  attachables,
}: {
  attachment: ChatAttachment;
  attachables: readonly AttachmentCard[];
}) {
  const card = attachables.find((item) => item.kind === attachment.kind && item.id === attachment.id);
  if (!card) return <p className="mt-1 text-[0.75rem] text-ink-400">Shared something that is no longer listed.</p>;
  return <AttachmentChip card={card} className="mt-1.5" />;
}

/* -------------------------------------------------------------------------- */
/* Polls                                                                       */
/* -------------------------------------------------------------------------- */

function ChatPollCard({ poll }: { poll: NonNullable<ChatLineView["poll"]> }) {
  const router = useRouter();
  const [state, setState] = useState(poll);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const vote = (index: number) => {
    if (state.closed || state.myVote === index) return;
    setError(null);
    setState((current) => {
      const total = current.myVote === null ? current.total + 1 : current.total;
      const options = current.options.map((option) => {
        const count = option.count + (option.index === index ? 1 : option.index === current.myVote ? -1 : 0);
        return { ...option, count, share: total === 0 ? 0 : Math.round((count / total) * 100) };
      });
      return { ...current, total, myVote: index, options };
    });

    startTransition(async () => {
      const result = await voteChatPoll(poll.id, index);
      if (!result.ok) {
        setState(poll);
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="mt-1 rounded-2xl bg-paper-2 p-3 text-left">
      <p className="text-[0.9375rem] font-semibold text-ink-950">{state.question}</p>
      <ul className="mt-2 space-y-1.5">
        {state.options.map((option) => {
          const mine = state.myVote === option.index;
          return (
            <li key={option.index}>
              <button
                type="button"
                disabled={pending || state.closed}
                aria-pressed={mine}
                onClick={() => vote(option.index)}
                className={cn(
                  "relative flex w-full items-center gap-2 overflow-hidden rounded-lg bg-white px-2.5 py-1.5 text-left ring-1 transition-colors",
                  mine ? "ring-ink-950/25" : "ring-ink-950/8 hover:ring-ink-950/20",
                  state.closed && "opacity-70",
                )}
              >
                <span
                  aria-hidden
                  className={cn("absolute inset-y-0 left-0 transition-[width] duration-500", mine ? "bg-signal-soft" : "bg-paper-2")}
                  style={{ width: `${state.total === 0 ? 0 : option.share}%` }}
                />
                <span className="relative min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink-900">{option.label}</span>
                {mine ? <Check className="relative size-3 shrink-0 text-ink-900" /> : null}
                <span className="tnum relative shrink-0 text-[0.75rem] text-ink-500">{option.share}%</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[0.75rem] text-ink-400">
        {state.total === 0 ? "No votes yet" : `${state.total} ${state.total === 1 ? "vote" : "votes"}`}
        {state.closed ? " · closed" : ""}
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-[0.75rem] text-pulse-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PollComposer({
  poll,
  pending,
  onChange,
  onCancel,
  onSubmit,
}: {
  poll: { question: string; options: string[] };
  pending: boolean;
  onChange: (poll: { question: string; options: string[] }) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const ready = poll.question.trim().length >= 3 && poll.options.filter((option) => option.trim()).length >= 2;

  return (
    <div className="border-b border-ink-100 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">New poll</span>
        <button type="button" aria-label="Cancel poll" onClick={onCancel} className="text-ink-400 hover:text-ink-800">
          <X className="size-3.5" />
        </button>
      </div>

      <input
        value={poll.question}
        onChange={(event) => onChange({ ...poll, question: event.target.value })}
        placeholder="Ask the room"
        aria-label="Poll question"
        maxLength={160}
        className="h-10 w-full rounded-lg bg-paper-2 px-3 text-[0.875rem] text-ink-900 placeholder:text-ink-400"
      />

      <ul className="mt-2 space-y-1.5">
        {poll.options.map((option, index) => (
          <li key={index} className="flex items-center gap-2">
            <input
              value={option}
              onChange={(event) =>
                onChange({ ...poll, options: poll.options.map((entry, i) => (i === index ? event.target.value : entry)) })
              }
              placeholder={`Option ${index + 1}`}
              aria-label={`Poll option ${index + 1}`}
              maxLength={60}
              className="h-9 flex-1 rounded-lg bg-paper-2 px-3 text-[0.8125rem] text-ink-900 placeholder:text-ink-400"
            />
            {poll.options.length > 2 ? (
              <button
                type="button"
                aria-label={`Remove option ${index + 1}`}
                onClick={() => onChange({ ...poll, options: poll.options.filter((_, i) => i !== index) })}
                className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center gap-3">
        {poll.options.length < 4 ? (
          <button
            type="button"
            onClick={() => onChange({ ...poll, options: [...poll.options, ""] })}
            className="text-[0.8125rem] font-medium text-ink-600 hover:text-ink-950"
          >
            Add option
          </button>
        ) : null}
        <button
          type="button"
          disabled={!ready || pending}
          onClick={onSubmit}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-3.5 py-1.5 text-[0.8125rem] font-medium text-paper disabled:opacity-45"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Post poll
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Read receipt                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Marks a channel read when it is opened.
 *
 * The page cannot do this in its own body — a server component that writes on
 * render would write again on every refresh the poller triggers, and a render
 * with a side effect is not idempotent. This fires once per mount instead.
 */
export function MarkRead({ channel }: { channel: string }) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { markChannelRead } = await import("@/server/actions/chat");
      if (!cancelled) await markChannelRead(channel);
    })();
    return () => {
      cancelled = true;
    };
  }, [channel]);

  return null;
}
