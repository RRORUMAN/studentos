"use client";

import { Bookmark, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import type { SavedKind } from "@/domain/types";
import { toggleSaved } from "@/server/actions/saved";
import { cn } from "@/lib/utils";

/**
 * Save / unsave.
 *
 * Hitting the free-tier cap does not fail silently or throw — it swaps the
 * button for a short, specific line about the limit with a way past it. A save
 * button that just stops working is the single most confusing kind of paywall.
 */
export function SaveButton({
  kind,
  targetId,
  saved: initial,
}: {
  kind: SavedKind;
  targetId: string;
  saved: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [limit, setLimit] = useState<{ used: number; limit: number } | null>(null);
  const [pending, startTransition] = useTransition();

  if (limit) {
    return (
      <Link
        href="/upgrade?feature=customCollections"
        className="rounded-full border border-amber-deep/25 bg-amber-soft px-3.5 py-2 text-[0.8125rem] font-medium text-amber-deep"
      >
        {limit.used}/{limit.limit} saved — unlock unlimited
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleSaved(kind, targetId);
          if (result.ok) setSaved(result.saved);
          else if (result.reason === "quota") setLimit({ used: result.used, limit: result.limit });
        })
      }
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.875rem] font-medium transition-colors",
        saved
          ? "border-ink-950 bg-ink-950 text-paper"
          : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
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
