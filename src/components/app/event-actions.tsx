"use client";

import { CalendarPlus, Check, Loader2, Star, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { respondToEvent } from "@/server/actions/events";
import { addToPlan } from "@/server/actions/plans";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * EVENT ACTIONS
 * ----------------------------------------------------------------------------
 * Interested · Going, and Add to plan. Save, Share and Anyone Down? live in
 * their own components and are composed next to these on the detail screen.
 *
 * Both response buttons are optimistic: a tap that waits a round-trip to fill
 * in reads as broken. The server is the truth on the next render.
 * ============================================================================
 */

export function EventResponseButtons({
  eventId,
  status: initial,
  goingCount,
  interestedCount,
  compact = false,
}: {
  eventId: string;
  status: "interested" | "going" | null;
  goingCount: number;
  interestedCount: number;
  compact?: boolean;
}) {
  const [status, setStatus] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (next: "interested" | "going") => {
    const value = status === next ? null : next;
    setStatus(value);
    setError(null);
    startTransition(async () => {
      const result = await respondToEvent(eventId, value);
      if (!result.ok) {
        setStatus(initial);
        setError(result.message);
      }
    });
  };

  const delta = (kind: "interested" | "going") =>
    (status === kind ? 1 : 0) - (initial === kind ? 1 : 0);

  return (
    <div>
      <div className={cn("flex gap-2", compact ? "" : "flex-wrap")}>
        <button
          type="button"
          aria-pressed={status === "interested"}
          disabled={pending}
          onClick={() => set("interested")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
            compact ? "px-3 py-1.5 text-[0.8125rem]" : "px-4 py-2.5 text-[0.9375rem]",
            status === "interested"
              ? "border-amber-deep/30 bg-amber-soft text-amber-deep"
              : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
          )}
        >
          <Star className={cn("size-4", status === "interested" && "fill-current")} />
          Interested
          <span className="tnum text-[0.75rem] opacity-70">{interestedCount + delta("interested")}</span>
        </button>

        <button
          type="button"
          aria-pressed={status === "going"}
          disabled={pending}
          onClick={() => set("going")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
            compact ? "px-3 py-1.5 text-[0.8125rem]" : "px-4 py-2.5 text-[0.9375rem]",
            status === "going"
              ? "border-ink-950 bg-ink-950 text-signal"
              : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : status === "going" ? <Check className="size-4" /> : <Users className="size-4" />}
          Going
          <span className="tnum text-[0.75rem] opacity-70">{goingCount + delta("going")}</span>
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add to plan                                                                 */
/* -------------------------------------------------------------------------- */

export function AddToPlanButton({
  refKind,
  refId,
  size = "md",
}: {
  refKind: "place" | "event";
  refId: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending || state === "done"}
      onClick={() =>
        startTransition(async () => {
          const result = await addToPlan({ refKind, refId });
          if (result.ok) {
            setState("done");
            window.setTimeout(() => router.push(`/plans/${result.id}`), 600);
          } else {
            setState("error");
          }
        })
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white font-medium text-ink-700 transition-colors hover:border-ink-300 disabled:opacity-70",
        size === "sm" ? "px-3 py-1.5 text-[0.8125rem]" : "px-3.5 py-2 text-[0.875rem]",
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "done" ? (
        <Check className="size-4 text-mint-deep" />
      ) : (
        <CalendarPlus className="size-4" />
      )}
      {state === "done" ? "Added" : state === "error" ? "Try again" : "Add to plan"}
    </button>
  );
}
