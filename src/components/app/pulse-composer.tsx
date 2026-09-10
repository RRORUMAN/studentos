"use client";

import { BarChart3, Loader2, Paperclip, Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { AttachmentChip } from "@/components/app/pulse-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createPost } from "@/server/actions/loop";
import type { AttachmentCard } from "@/server/queries/loop";
import { cn } from "@/lib/utils";
import { useDialog } from "@/components/ui/use-dialog";

/**
 * ============================================================================
 * COMPOSER
 * ----------------------------------------------------------------------------
 * Posting, from either shape of screen.
 *
 * On desktop it is a panel in the rail. On mobile it is a floating "Post"
 * button over the feed that opens a bottom sheet — the feed is what a student
 * came for, and the old layout put the composer *below the entire feed*, where
 * on a phone it was reachable only after scrolling past forty posts. Nobody
 * ever posted from there.
 *
 * A post can carry a poll (two to four options) or point at one real row — an
 * event, a place, a deal, a listing. There is no image upload: the product has
 * no file storage, and a picture button that silently does nothing is worse
 * than no button.
 * ============================================================================
 */

const KINDS: readonly { value: string; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "question", label: "Question" },
  { value: "deal", label: "Deal" },
  { value: "recommendation", label: "Recommendation" },
  { value: "event", label: "Event" },
  { value: "anyone-down", label: "Anyone down?" },
];

export type ComposerChannel = { slug: string; label: string; emoji: string };

type ComposerProps = {
  channels: readonly ComposerChannel[];
  attachables: readonly AttachmentCard[];
  defaultChannel?: string;
  defaultKind?: string;
  /** Rendered inline (the desktop rail) or inside the mobile sheet. */
  onPosted?: () => void;
  autoFocus?: boolean;
};

function ComposerForm({
  channels,
  attachables,
  defaultChannel = "general",
  defaultKind = "post",
  onPosted,
  autoFocus = false,
}: ComposerProps) {
  const router = useRouter();
  const toast = useToast();
  const [channel, setChannel] = useState(defaultChannel);
  const [kind, setKind] = useState(defaultKind);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState<string[] | null>(null);
  const [attachment, setAttachment] = useState<AttachmentCard | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pollReady = !options || (options.filter((option) => option.trim().length > 0).length >= 2);
  const canPost = title.trim().length >= 4 && pollReady && !pending;

  const submit = () => {
    setError(null);
    const form = new FormData();
    form.set("title", title);
    form.set("body", body);
    form.set("channel", channel);
    form.set("kind", options ? "poll" : kind);
    for (const option of options ?? []) if (option.trim()) form.append("pollOption", option.trim());
    if (attachment) {
      form.set("attachmentKind", attachment.kind);
      form.set("attachmentId", attachment.id);
    }

    startTransition(async () => {
      const result = await createPost(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTitle("");
      setBody("");
      setOptions(null);
      setAttachment(null);
      toast({ title: "Posted", description: `It is live in #${channel}.` });
      onPosted?.();
      router.refresh();
    });
  };

  return (
    <div>
      <input
        value={title}
        autoFocus={autoFocus}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={kind === "question" ? "What do you want to know?" : "What is it?"}
        aria-label="Title"
        maxLength={160}
        className="h-11 w-full rounded-lg bg-paper-2 px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:ring-2 focus:ring-ink-950/20"
      />

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="The useful detail — a price, an address, what to ask for."
        aria-label="Details"
        rows={3}
        maxLength={2000}
        className="mt-2 w-full rounded-lg bg-paper-2 px-3.5 py-2.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:ring-2 focus:ring-ink-950/20"
      />

      {/* ---- poll --------------------------------------------------------- */}
      {options ? (
        <fieldset className="mt-3 rounded-xl bg-paper-2 p-3">
          <legend className="sr-only">Poll options</legend>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Poll</span>
            <button
              type="button"
              onClick={() => setOptions(null)}
              className="text-[0.75rem] font-medium text-ink-500 underline underline-offset-4 hover:text-ink-900"
            >
              Remove
            </button>
          </div>
          <ul className="space-y-1.5">
            {options.map((option, index) => (
              <li key={index} className="flex items-center gap-2">
                <input
                  value={option}
                  onChange={(event) =>
                    setOptions((current) => (current ?? []).map((entry, i) => (i === index ? event.target.value : entry)))
                  }
                  placeholder={`Option ${index + 1}`}
                  aria-label={`Poll option ${index + 1}`}
                  maxLength={60}
                  className="h-10 flex-1 rounded-lg bg-white px-3 text-[0.875rem] text-ink-900 ring-1 ring-ink-950/8 placeholder:text-ink-400 focus:ring-ink-950/25"
                />
                {options.length > 2 ? (
                  <button
                    type="button"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() => setOptions((current) => (current ?? []).filter((_, i) => i !== index))}
                    className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-800"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {options.length < 4 ? (
            <button
              type="button"
              onClick={() => setOptions((current) => [...(current ?? []), ""])}
              className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-600 hover:text-ink-950"
            >
              <Plus className="size-3.5" />
              Add option
            </button>
          ) : null}
        </fieldset>
      ) : null}

      {/* ---- attachment --------------------------------------------------- */}
      {attachment ? (
        <div className="relative">
          <AttachmentChip card={{ ...attachment, href: null }} className="ring-ink-950/8" />
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={() => setAttachment(null)}
            className="absolute top-1/2 right-2 z-20 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-800"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {picking ? (
        <div className="mt-3 rounded-xl bg-paper-2 p-3">
          <p className="mb-2 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            Point at something real in your city
          </p>
          {attachables.length === 0 ? (
            <p className="text-[0.8125rem] text-ink-500">
              Nothing listed in your city to attach yet — events, places, deals and listings appear here.
            </p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {attachables.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachment(item);
                      setPicking(false);
                    }}
                    className="w-full rounded-lg bg-white p-2.5 text-left ring-1 ring-ink-950/6 hover:ring-ink-950/20"
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

      {/* ---- kind, channel, tools ----------------------------------------- */}
      {!options ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              aria-pressed={kind === option.value}
              className={cn(
                "h-8 rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
                kind === option.value ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Channel</span>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="h-10 w-full rounded-lg bg-paper-2 px-3 text-[0.9375rem] text-ink-900"
          >
            {channels.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.emoji} {entry.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          aria-label="Add a poll"
          aria-pressed={Boolean(options)}
          onClick={() => setOptions((current) => (current ? null : ["", ""]))}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
            options ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900",
          )}
        >
          <BarChart3 className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Attach something"
          aria-pressed={picking}
          onClick={() => setPicking((current) => !current)}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
            picking ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900",
          )}
        >
          <Paperclip className="size-4" />
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      {/* "Post it" rather than "Post": one of the kind chips above is also
          called Post, and two controls with the same accessible name in one
          form is ambiguous for a screen reader as well as for a test. */}
      <Button variant="primary" size="md" block className="mt-4" disabled={!canPost} onClick={submit}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Post it
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop rail                                                                */
/* -------------------------------------------------------------------------- */

export function Composer(props: ComposerProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="primary" size="md" block onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Post something
      </Button>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[0.9375rem] font-semibold text-ink-950">New post</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100"
        >
          <X className="size-4" />
        </button>
      </div>
      <ComposerForm {...props} onPosted={() => setOpen(false)} />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile sheet                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The floating action on a phone, and the sheet it opens.
 *
 * It sits above the bottom nav and inside the safe area, so it never lands
 * under a home indicator. While the sheet is open the page behind it does not
 * scroll — a sheet you can scroll the feed behind feels broken on iOS.
 */
export function ComposerSheet(props: ComposerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* `aria-modal` claims nothing behind this is reachable; the trap is what
     makes that true. See components/ui/use-dialog.ts. */
  const dialogRef = useDialog(true);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-4 z-40 inline-flex items-center gap-2 rounded-full bg-ink-950 px-5 py-3.5 text-[0.9375rem] font-medium text-paper shadow-[var(--shadow-lift)] lg:hidden",
          "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]",
        )}
      >
        <Pencil className="size-4" />
        Post something
      </button>

      {/* z-60: the bottom navigation is z-50 and renders after `main`, so a
          sheet at z-50 was painted over and its submit button could not be
          tapped. */}
      {open ? (
        <div
          ref={dialogRef as React.RefObject<HTMLDivElement>}
          className="fixed inset-0 z-60 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="New post"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
          />
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 max-h-[88svh] overflow-y-auto rounded-t-3xl bg-white p-4",
              "pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)]",
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[1.0625rem] font-semibold text-ink-950">New post</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-ink-100"
              >
                <X className="size-4" />
              </button>
            </div>
            <ComposerForm {...props} autoFocus onPosted={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
