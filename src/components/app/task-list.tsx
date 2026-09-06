"use client";

import { ArrowUpRight, Check, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { toggleArrivalTask } from "@/server/actions/arrival";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * TASK LIST
 * ----------------------------------------------------------------------------
 * The checkable rows in Arrival and Leaving Mode.
 *
 * The "unblocks" note on a task is the part that makes this a plan rather than
 * a list: knowing that registering your address is what lets you open a bank
 * account is the difference between doing things in a sensible order and
 * discovering the dependency at the counter.
 *
 * Tasks marked `official` carry a source link and never a summary we wrote —
 * getting a residency requirement wrong for an international student is the
 * worst thing this product could do, so it points at the government page
 * instead of paraphrasing it.
 * ============================================================================
 */

export type TaskView = {
  id: string;
  label: string;
  detail: string;
  effort: string;
  href?: string;
  official?: boolean;
  unblocksCount: number;
  done: boolean;
  /** Attached from `official_facts` when the task is an official one. */
  source?: { name: string; url: string; checked: string } | null;
};

export function TaskList({ tasks }: { tasks: readonly TaskView[] }) {
  return (
    <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </ul>
  );
}

function TaskRow({ task }: { task: TaskView }) {
  const [done, setDone] = useState(task.done);
  const [pending, startTransition] = useTransition();

  return (
    <li className={cn("flex items-start gap-3.5 px-4 py-3.5", done && "bg-paper-2/50")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${task.label}" not done` : `Mark "${task.label}" done`}
        disabled={pending}
        onClick={() => {
          const next = !done;
          setDone(next);
          startTransition(async () => void (await toggleArrivalTask(task.id)));
        }}
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
          done ? "border-ink-950 bg-ink-950" : "border-ink-300 bg-white hover:border-ink-500",
        )}
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin text-ink-400" />
        ) : done ? (
          <Check className="size-3 text-signal" strokeWidth={3} />
        ) : null}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[0.9375rem] font-medium",
            done ? "text-ink-400 line-through" : "text-ink-900",
          )}
        >
          {task.label}
        </p>
        <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-500">{task.detail}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">
            {task.effort}
          </span>

          {task.unblocksCount > 0 ? (
            <span className="rounded-full bg-flow-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-flow-deep">
              Unblocks {task.unblocksCount}
            </span>
          ) : null}

          {task.href ? (
            <Link
              href={task.href}
              className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink-700 underline underline-offset-4 hover:text-ink-950"
            >
              Do it here
              <ArrowUpRight className="size-3" />
            </Link>
          ) : null}

          {task.source ? (
            <a
              href={task.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-mint-deep"
            >
              {task.source.name}
              <ExternalLink className="size-2.5" />
            </a>
          ) : task.official ? (
            <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-amber-deep">
              Check the official source
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
