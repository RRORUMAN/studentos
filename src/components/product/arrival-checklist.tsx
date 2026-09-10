"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, ExternalLink, Scale } from "lucide-react";
import { useState } from "react";

import { AppSurface } from "@/components/product/app-surface";
import { brand } from "@/brand/brand.config";
import { arrivalTasksFor, legalDisclaimer } from "@/data/arrival";
import { getCity } from "@/data/cities";
import { duration, ease, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * ARRIVAL MODE
 * ----------------------------------------------------------------------------
 * The first two weeks, as a list you can actually finish. Progress is real
 * state so the section rewards the visitor for touching it.
 *
 * Rows flagged `legal` render the official source and the disclaimer. The
 * product helps you find the requirement; it is never the authority on it.
 * ============================================================================
 */
export function ArrivalChecklist({
  citySlug,
  className,
}: {
  citySlug: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const city = getCity(citySlug);
  const tasks = arrivalTasksFor(citySlug);

  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(tasks[0]?.id ?? null);

  const progress = Math.round((done.size / tasks.length) * 100);

  function toggleDone(id: string) {
    setDone((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      track("arrival_task_toggled", { task: id, done: !current.has(id) });
      return next;
    });
  }

  return (
    <AppSurface
      title={`${brand.surfaces.arrival} · ${city?.name ?? "your city"}`}
      meta={
        done.size === tasks.length
          ? "Done. You live here now."
          : `${done.size} of ${tasks.length} done`
      }
      className={className}
      bodyClassName="p-0 sm:p-0"
      footer={
        <div className="flex items-start gap-2.5">
          <Scale className="mt-0.5 size-3.5 shrink-0 text-white/30" aria-hidden />
          <p className="text-xs leading-relaxed text-white/40">{legalDisclaimer}</p>
        </div>
      }
    >
      {/* progress */}
      <div className="border-b border-white/8 px-4 py-3.5 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-micro uppercase tracking-[0.12em] text-white/40">
            First two weeks
          </span>
          <span className="tnum text-xs font-medium text-signal">{progress}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-signal"
            animate={{ width: `${progress}%` }}
            transition={reduced ? { duration: 0 } : spring.soft}
          />
        </div>
      </div>

      <ul className="divide-y divide-white/8">
        {tasks.map((task) => {
          const isDone = done.has(task.id);
          const isOpen = open === task.id;

          return (
            <li key={task.id}>
              <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isDone}
                  onClick={() => toggleDone(task.id)}
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                    isDone
                      ? "border-signal bg-signal text-ink-950"
                      : "border-white/25 text-transparent hover:border-white/50",
                  )}
                >
                  <motion.span
                    initial={false}
                    animate={reduced ? undefined : { scale: isDone ? 1 : 0.4 }}
                    transition={reduced ? { duration: 0 } : spring.bouncy}
                  >
                    <Check className="size-3.5" aria-hidden />
                  </motion.span>
                  <span className="sr-only">Mark {task.label} as done</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : task.id)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[0.9375rem] font-medium transition-colors",
                        isDone ? "text-white/35 line-through" : "text-white",
                      )}
                    >
                      {task.label}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/40">
                      <span>{task.effort}</span>
                      {task.cost ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="tnum">{task.cost}</span>
                        </>
                      ) : null}
                      {/* "Check the official source" is an instruction, and an
                          instruction with no link under it is a dead end. A
                          legal row only points at a source where we hold a
                          checked one for that country; where we do not, the
                          badge says what is actually true about the row
                          instead of telling the student to click nothing. */}
                      {task.legal ? (
                        <span className="rounded-xs bg-amber/15 px-1.5 py-0.5 text-[0.625rem] font-medium tracking-wide text-amber uppercase">
                          {task.source ? "Check the official source" : "Depends on your nationality"}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-1 size-4 shrink-0 text-white/30 transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={reduced ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pl-12 sm:px-5 sm:pl-13">
                      <p className="text-[0.875rem] leading-relaxed text-white/60">
                        {task.detail}
                      </p>
                      {task.source ? (
                        <a
                          href={task.source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-signal underline decoration-signal/30 underline-offset-4 hover:decoration-signal"
                        >
                          {task.source.label}
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </AppSurface>
  );
}
