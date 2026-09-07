"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { addComment } from "@/server/actions/loop";
import { cn } from "@/lib/utils";

/**
 * Reply box. Clears and refreshes on success so the new comment appears.
 *
 * `parentId` makes it a reply to a comment rather than to the post; the
 * server flattens anything deeper than one level, so a reply to a reply
 * lands under the same root and the thread stays readable on a phone.
 */
export function CommentForm({
  postId,
  parentId,
  placeholder = "Add what you know.",
  submitLabel = "Reply",
  compact = false,
  autoFocus = false,
  onDone,
  onCancel,
}: {
  postId: string;
  parentId?: string;
  placeholder?: string;
  submitLabel?: string;
  compact?: boolean;
  autoFocus?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);

        const data = new FormData();
        data.set("postId", postId);
        data.set("body", body);
        if (parentId) data.set("parentId", parentId);

        startTransition(async () => {
          const result = await addComment(data);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setBody("");
          onDone?.();
          router.refresh();
        });
      }}
    >
      <textarea
        value={body}
        autoFocus={autoFocus}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        aria-label={parentId ? "Your reply" : "Your answer"}
        rows={compact ? 2 : 3}
        maxLength={2000}
        className={cn(
          "w-full rounded-lg bg-paper-2 px-3.5 py-2.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:ring-2 focus:ring-ink-950/20",
          compact && "text-[0.875rem]",
        )}
      />

      {error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending || body.trim().length === 0}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {submitLabel}
        </Button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-[0.8125rem] font-medium text-ink-500 hover:text-ink-950"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
