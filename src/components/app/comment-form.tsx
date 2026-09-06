"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { addComment } from "@/server/actions/loop";

/** Reply box. Clears and refreshes on success so the new comment appears. */
export function CommentForm({ postId, parentId }: { postId: string; parentId?: string }) {
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
          router.refresh();
        });
      }}
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add what you know."
        aria-label="Your reply"
        rows={3}
        className="w-full rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:border-ink-400"
      />

      {error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="sm"
        className="mt-2"
        disabled={pending || body.trim().length === 0}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Reply
      </Button>
    </form>
  );
}
