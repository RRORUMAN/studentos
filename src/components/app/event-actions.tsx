"use client";

import { ArrowRight, CalendarPlus, Check, Loader2, Plus, Star, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { respondToEvent } from "@/server/actions/events";
import { addToPlan } from "@/server/actions/plans";
import type { PlanChoice } from "@/server/queries/plans";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * EVENT ACTIONS
 * ----------------------------------------------------------------------------
 * Interested · Going, the one-tap Interested star for cards, and Add to plan.
 * Save, Share and Anyone Down? live in their own components and are composed
 * next to these on the detail screen.
 *
 * The response buttons are optimistic: a tap that waits a round-trip to fill
 * in reads as broken. The server is the truth on the next render, and the
 * component re-syncs to the prop when that render arrives — the same event can
 * be on screen twice (sticky bar and body) and both must agree.
 * ============================================================================
 */

type Status = "interested" | "going" | null;

export function EventResponseButtons({
  eventId,
  status: initial,
  goingCount,
  interestedCount,
  compact = false,
  chatOnResponse = false,
}: {
  eventId: string;
  status: Status;
  goingCount: number;
  interestedCount: number;
  compact?: boolean;
  /** Mention the chat in the confirmation: it opens on the first response. */
  chatOnResponse?: boolean;
}) {
  const toast = useToast();
  /* Re-sync to the server's answer when it changes under us. */
  const [tracked, setTracked] = useState(initial);
  const [status, setStatus] = useState(initial);
  if (tracked !== initial) {
    setTracked(initial);
    setStatus(initial);
  }
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
        return;
      }
      if (result.status) {
        toast({
          title: result.status === "going" ? "You're going" : "Marked as interested",
          description: chatOnResponse ? "The event chat is open to you now." : undefined,
        });
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
            compact ? "px-3 py-2 text-[0.8125rem]" : "px-4 py-2.5 text-[0.9375rem]",
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
            compact ? "px-3 py-2 text-[0.8125rem]" : "px-4 py-2.5 text-[0.9375rem]",
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
/* One-tap Interested                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The star on a radar card. Toggles Interested; a student who already said
 * Going keeps Going (the star reads as lit) and a second tap clears it.
 */
export function InterestedToggle({
  eventId,
  status: initial,
  className,
}: {
  eventId: string;
  status: Status;
  className?: string;
}) {
  const toast = useToast();
  const [tracked, setTracked] = useState(initial);
  const [status, setStatus] = useState(initial);
  if (tracked !== initial) {
    setTracked(initial);
    setStatus(initial);
  }
  const [pending, startTransition] = useTransition();
  const lit = status !== null;

  return (
    <button
      type="button"
      aria-pressed={lit}
      aria-label={lit ? (status === "going" ? "Going — tap to clear" : "Interested — tap to clear") : "Interested"}
      title={lit ? "Tap to clear" : "Interested"}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const value: Status = lit ? null : "interested";
        setStatus(value);
        startTransition(async () => {
          const result = await respondToEvent(eventId, value);
          if (!result.ok) {
            setStatus(initial);
            toast({ tone: "warning", title: result.message });
          }
        });
      }}
      className={cn(
        "relative z-10 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-medium transition-colors",
        lit
          ? status === "going"
            ? "bg-ink-950 text-signal"
            : "bg-amber-soft text-amber-deep ring-1 ring-amber-deep/25"
          : "bg-paper-2 text-ink-600 hover:bg-ink-100 hover:text-ink-950",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : status === "going" ? (
        <Check className="size-3.5" />
      ) : (
        <Star className={cn("size-3.5", lit && "fill-current")} />
      )}
      {status === "going" ? "Going" : "Interested"}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Add to plan                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The chooser. Existing upcoming plans, or a new one named on the spot. The
 * student stays on the page; the result is a toast plus an inline link to the
 * plan, never a redirect they did not ask for.
 */
export function AddToPlanButton({
  refKind,
  refId,
  plans,
  title,
  size = "md",
  className,
}: {
  refKind: "place" | "event";
  refId: string;
  /** The student's upcoming plans, from `loadPlanChoices`. */
  plans: readonly PlanChoice[];
  /** What is being added, as the default name for a new plan. */
  title?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [done, setDone] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const submit = (choice: { planId: string } | { title: string }) => {
    setError(null);
    startTransition(async () => {
      const result = await addToPlan({
        refKind,
        refId,
        planId: "planId" in choice ? choice.planId : null,
        title: "title" in choice ? choice.title : null,
      });
      if (!result.ok) {
        setError(result.message);
        toast({ tone: "warning", title: result.message });
        return;
      }
      setOpen(false);
      setDone({ id: result.id, title: result.title });
      toast({
        title: result.created
          ? `Started “${result.title}”`
          : result.already
            ? `Already in “${result.title}”`
            : `Added to “${result.title}”`,
        description: "Open it from Plans, or the link next to the button.",
      });
    });
  };

  const pill = cn(
    "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
    size === "sm" ? "px-3 py-1.5 text-[0.8125rem]" : "px-3.5 py-2 text-[0.875rem]",
  );

  if (done) {
    return (
      <Link
        href={`/plans/${done.id}`}
        className={cn(pill, "border-mint-deep/25 bg-mint-soft text-mint-deep", className)}
      >
        <Check className="size-4" />
        In {done.title}
        <ArrowRight className="size-3.5" />
      </Link>
    );
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((current) => !current)}
        className={cn(pill, "border-ink-200 bg-white text-ink-700 hover:border-ink-300 disabled:opacity-70")}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
        Add to plan
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-ink-950/30 sm:hidden"
          />
          <div
            role="dialog"
            aria-label="Add to a plan"
            className={cn(
              "z-50 rounded-2xl border border-ink-200 bg-white p-2 shadow-[var(--shadow-lift)]",
              "fixed inset-x-3 bottom-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
              "sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:bottom-auto sm:mt-1.5 sm:w-72 sm:pb-2",
            )}
          >
            <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
              <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Add to</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-7 place-items-center rounded-full text-ink-400 hover:bg-ink-100"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {plans.length > 0 ? (
              <ul className="max-h-56 overflow-y-auto">
                {plans.map((plan) => (
                  <li key={plan.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => submit({ planId: plan.id })}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-paper-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[0.9375rem] font-medium text-ink-900">{plan.title}</span>
                        <span className="block text-[0.75rem] text-ink-500">
                          {plan.forDate
                            ? new Date(plan.forDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
                            : "No date yet"}
                          {" · "}
                          {plan.stops} {plan.stops === 1 ? "stop" : "stops"}
                        </span>
                      </span>
                      <Plus className="size-4 shrink-0 text-ink-400" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-2 text-[0.8125rem] text-ink-500">No upcoming plans yet. Start one:</p>
            )}

            <div className={cn("mt-1 border-t border-ink-100 pt-2", plans.length === 0 && "border-t-0 pt-0")}>
              {naming ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit({ title: name.trim() || title || "New plan" });
                  }}
                  className="flex gap-1.5 px-1"
                >
                  <input
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={title ? `${title.slice(0, 40)}…` : "Name the plan"}
                    aria-label="New plan name"
                    maxLength={80}
                    className="h-10 min-w-0 flex-1 rounded-lg bg-paper-2 px-3 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex h-10 items-center gap-1 rounded-lg bg-ink-950 px-3 text-[0.875rem] font-medium text-paper"
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Create
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setNaming(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[0.9375rem] font-medium text-ink-900 hover:bg-paper-2"
                >
                  <span className="grid size-6 place-items-center rounded-full bg-signal text-ink-950">
                    <Plus className="size-3.5" />
                  </span>
                  New plan
                </button>
              )}
            </div>

            {error ? (
              <p role="alert" className="px-3 pt-2 text-[0.8125rem] text-pulse-deep">
                {error}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
