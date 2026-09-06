"use client";

import { Check, Link2, Loader2, Plus, ThumbsDown, ThumbsUp, Trash2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ShareButton } from "@/components/app/share-button";
import { Button } from "@/components/ui/button";
import {
  createPlan,
  deletePlan,
  inviteToPlan,
  removePlanLine,
  respondToPlan,
  setPlanShared,
  votePlanItem,
} from "@/server/actions/plans";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * PLAN CONTROLS
 * ----------------------------------------------------------------------------
 * The interactive parts of a plan: join, vote, share, invite, remove, delete.
 * All optimistic, all thin wrappers over server actions that re-check who is
 * allowed to do what.
 * ============================================================================
 */

export function PlanRespond({ planId, status }: { planId: string; status: "invited" | "in" | "out" | null }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="flex gap-2">
        {(["in", "out"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={pending}
            aria-pressed={current === option}
            onClick={() =>
              startTransition(async () => {
                const result = await respondToPlan(planId, option);
                if (result.ok) {
                  setCurrent(option);
                  setError(null);
                  router.refresh();
                } else setError(result.message);
              })
            }
            className={cn(
              "h-11 flex-1 rounded-full text-[0.9375rem] font-medium transition-colors",
              current === option ? "bg-ink-950 text-paper" : "bg-white text-ink-700 ring-1 ring-ink-950/10 hover:ring-ink-950/25",
            )}
          >
            {option === "in" ? "I'm in" : "Can't"}
          </button>
        ))}
      </div>
      {error ? <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">{error}</p> : null}
    </div>
  );
}

export function PlanVote({
  planId,
  index,
  score,
  mine,
  canVote,
}: {
  planId: string;
  index: number;
  score: number;
  mine: 1 | -1 | null;
  canVote: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ score, mine });
  const [, startTransition] = useTransition();

  const vote = (value: 1 | -1) => {
    setState((current) => {
      const removing = current.mine === value;
      const next = removing ? null : value;
      const delta = (next ?? 0) - (current.mine ?? 0);
      return { score: current.score + delta, mine: next };
    });
    startTransition(async () => {
      await votePlanItem(planId, index, value);
      router.refresh();
    });
  };

  if (!canVote) {
    return <span className={cn("tnum text-[0.8125rem]", state.score > 0 ? "text-mint-deep" : state.score < 0 ? "text-pulse-deep" : "text-ink-400")}>{state.score > 0 ? `+${state.score}` : state.score}</span>;
  }

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-paper-2 p-0.5">
      <button type="button" aria-label="Vote for this" aria-pressed={state.mine === 1} onClick={() => vote(1)} className={cn("grid size-7 place-items-center rounded-full", state.mine === 1 ? "bg-mint text-ink-950" : "text-ink-500 hover:bg-white")}>
        <ThumbsUp className="size-3.5" />
      </button>
      <span className={cn("tnum min-w-5 text-center text-[0.8125rem] font-medium", state.score > 0 ? "text-mint-deep" : state.score < 0 ? "text-pulse-deep" : "text-ink-500")}>{state.score}</span>
      <button type="button" aria-label="Vote against this" aria-pressed={state.mine === -1} onClick={() => vote(-1)} className={cn("grid size-7 place-items-center rounded-full", state.mine === -1 ? "bg-pulse text-white" : "text-ink-500 hover:bg-white")}>
        <ThumbsDown className="size-3.5" />
      </button>
    </span>
  );
}

export function PlanOwnerControls({
  planId,
  title,
  shared,
  friends,
  invited,
}: {
  planId: string;
  title: string;
  shared: boolean;
  friends: readonly { userId: string; displayName: string; avatarEmoji: string }[];
  invited: ReadonlySet<string>;
}) {
  const router = useRouter();
  const [isShared, setIsShared] = useState(shared);
  const [inviting, setInviting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<Set<string>>(new Set(invited));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={isShared}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setPlanShared(planId, !isShared);
              if (result.ok) {
                setIsShared(!isShared);
                router.refresh();
              }
            })
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.875rem] font-medium transition-colors",
            isShared ? "bg-mint-soft text-mint-deep ring-1 ring-mint-deep/30" : "bg-white text-ink-700 ring-1 ring-ink-950/10 hover:ring-ink-950/25",
          )}
        >
          <Link2 className="size-4" />
          {isShared ? "Public link on" : "Make link public"}
        </button>
        {isShared ? <ShareButton path={`/p/${planId}`} title={title} /> : null}
        <button
          type="button"
          onClick={() => setInviting((current) => !current)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/10 hover:ring-ink-950/25"
        >
          <UserPlus className="size-4" />
          Invite friends
        </button>
        <button
          type="button"
          aria-label="Delete plan"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deletePlan(planId);
              if (result.ok) router.push("/plans");
            })
          }
          className="ml-auto grid size-9 place-items-center rounded-full text-ink-400 hover:bg-pulse-soft hover:text-pulse-deep"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {inviting ? (
        <div className="rounded-xl bg-paper-2 p-3">
          {friends.length === 0 ? (
            <p className="text-[0.8125rem] text-ink-600">
              No friends yet. Turn the public link on and share it, or add people from{" "}
              <a href="/you/friends" className="font-medium underline underline-offset-4">Friends</a>.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {friends.map((friend) => {
                const done = sent.has(friend.userId);
                return (
                  <li key={friend.userId}>
                    <button
                      type="button"
                      disabled={done || pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await inviteToPlan(planId, friend.userId);
                          if (result.ok) {
                            setSent((current) => new Set([...current, friend.userId]));
                            router.refresh();
                          }
                        })
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium",
                        done ? "bg-mint-soft text-mint-deep" : "bg-white text-ink-800 ring-1 ring-ink-950/10 hover:ring-ink-950/25",
                      )}
                    >
                      <span aria-hidden>{friend.avatarEmoji}</span>
                      {friend.displayName}
                      {done ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function RemoveLineButton({ planId, index }: { planId: string; index: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Remove from plan"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await removePlanLine(planId, index);
          router.refresh();
        })
      }
      className="grid size-7 place-items-center rounded-full text-ink-300 hover:bg-pulse-soft hover:text-pulse-deep"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
    </button>
  );
}

export function NewPlanForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New plan
      </Button>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[0.9375rem] font-semibold text-ink-950">New plan</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100">
          <X className="size-4" />
        </button>
      </div>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Saturday in Lavapiés" aria-label="Plan name" className="h-11 w-full rounded-lg bg-paper-2 px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Date" className="h-11 rounded-lg bg-paper-2 px-3 text-[0.9375rem] text-ink-900" />
        <input inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value.replace(/[^0-9.,]/g, ""))} placeholder="Budget per person" aria-label="Budget per person" className="tnum h-11 rounded-lg bg-paper-2 px-3.5 font-mono text-[0.9375rem] text-ink-900 placeholder:font-sans placeholder:text-ink-400" />
      </div>
      {error ? <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">{error}</p> : null}
      <Button
        variant="primary"
        size="md"
        block
        className="mt-3"
        disabled={pending || title.trim().length < 2}
        onClick={() => {
          setError(null);
          const form = new FormData();
          form.set("title", title);
          if (date) form.set("forDate", date);
          if (budget) form.set("budget", budget);
          startTransition(async () => {
            const result = await createPlan(form);
            if (result.ok) router.push(`/plans/${result.id}`);
            else setError(result.message);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Create
      </Button>
    </div>
  );
}
