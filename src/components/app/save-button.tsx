"use client";

import { Bookmark, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import type { SavedKind } from "@/domain/types";
import { toggleSaved } from "@/server/actions/saved";
import { cn } from "@/lib/utils";

/**
 * Save / unsave.
 *
 * Two shapes: the labelled pill on a detail screen, and the compact bookmark
 * that sits on every card. Both hit the same action and the same quota.
 *
 * Hitting the free-tier cap does not fail silently or throw — it swaps the
 * control for a short, specific line about the limit with a way past it. A
 * save button that just stops working is the single most confusing kind of
 * paywall.
 */
export function SaveButton({
  kind,
  targetId,
  saved: initial,
  compact = false,
  refreshOnChange = false,
  className,
}: {
  kind: SavedKind;
  targetId: string;
  saved: boolean;
  /** Icon-only bookmark for cards. */
  compact?: boolean;
  /** Re-render the surrounding server component after a change (the Saved screen). */
  refreshOnChange?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [limit, setLimit] = useState<{ used: number; limit: number } | null>(null);
  const [pending, startTransition] = useTransition();

  if (limit) {
    const line = `${limit.used}/${limit.limit} saved — unlock unlimited`;
    return compact ? (
      <Link
        href="/upgrade?feature=customCollections"
        aria-label={line}
        title={line}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full bg-amber-soft text-amber-deep ring-1 ring-amber-deep/25",
          className,
        )}
      >
        <Bookmark className="size-4" />
      </Link>
    ) : (
      <Link
        href="/upgrade?feature=customCollections"
        className={cn(
          "rounded-full border border-amber-deep/25 bg-amber-soft px-3.5 py-2 text-[0.8125rem] font-medium text-amber-deep",
          className,
        )}
      >
        {line}
      </Link>
    );
  }

  const toggle = () =>
    startTransition(async () => {
      const result = await toggleSaved(kind, targetId);
      if (result.ok) {
        setSaved(result.saved);
        if (compact) {
          toast({
            title: result.saved ? "Saved" : "Removed from saved",
            description: result.saved ? "Find it under Saved." : undefined,
          });
        }
        if (refreshOnChange) router.refresh();
      } else if (result.reason === "quota") {
        setLimit({ used: result.used, limit: result.limit });
        toast({
          tone: "warning",
          title: `${result.used} of ${result.limit} free saves used`,
          description: "Unsave something to make room, or Plus removes the cap.",
        });
      } else {
        toast({ tone: "warning", title: result.message });
      }
    });

  if (compact) {
    return (
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? "Saved" : "Save"}
        title={saved ? "Saved — tap to remove" : "Save"}
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full transition-colors",
          saved
            ? "bg-ink-950 text-paper"
            : "bg-white/90 text-ink-600 ring-1 ring-ink-950/10 backdrop-blur-sm hover:text-ink-950",
          className,
        )}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bookmark className={cn("size-4", saved && "fill-current")} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={pending}
      onClick={toggle}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.875rem] font-medium transition-colors",
        saved
          ? "border-ink-950 bg-ink-950 text-paper"
          : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Bookmark className={cn("size-4", saved && "fill-current")} />
      )}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
