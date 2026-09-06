"use client";

import { Check, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { feedbackMeta, feedbackOrder } from "@/config/feedback";
import { recordFeedback } from "@/server/actions/feedback";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * FEEDBACK MENU
 * ----------------------------------------------------------------------------
 * The "···" on a recommendation. Six controls, all of which write to the
 * inspectable memory row: the student is correcting the recommender, not
 * rating a product.
 *
 * Renders as a small popover on desktop and a bottom sheet on mobile, and closes
 * on Escape, outside click or selection. The confirmation replaces the menu
 * in place rather than toasting, so it is obvious what was noted about what.
 * ============================================================================
 */

const ORDER = feedbackOrder;

export function FeedbackMenu({
  targetKind,
  targetId,
  compact = false,
  className,
}: {
  targetKind: "place" | "event";
  targetId: string;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
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

  if (done) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-[0.75rem] font-medium text-ink-600",
          className,
        )}
      >
        <Check className="size-3" />
        {done}
      </span>
    );
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label="Tune this recommendation"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={cn(
          "grid place-items-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-800",
          compact ? "size-7" : "size-8",
        )}
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open ? (
        <>
          {/* Mobile scrim. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-ink-950/30 sm:hidden"
          />
          <ul
            role="menu"
            className={cn(
              "z-50 overflow-hidden rounded-xl border border-ink-200 bg-white p-1.5 shadow-[var(--shadow-lift)]",
              "fixed inset-x-3 bottom-3 pb-[max(0.375rem,env(safe-area-inset-bottom))]",
              "sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-1 sm:w-52 sm:pb-1.5",
            )}
          >
            <li className="px-3 pt-2 pb-1.5 font-mono text-micro uppercase tracking-[0.1em] text-ink-400 sm:hidden">
              Tune this
            </li>
            {ORDER.map((kind) => (
              <li key={kind} role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={pending}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    startTransition(async () => {
                      const result = await recordFeedback({ kind, targetKind, targetId });
                      setOpen(false);
                      setDone(result.ok ? result.message : "Could not save that");
                    });
                  }}
                  className={cn(
                    "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[0.9375rem] text-ink-800 transition-colors hover:bg-paper-2 sm:py-2 sm:text-[0.875rem]",
                    kind === "wrong" && "text-pulse-deep",
                  )}
                >
                  {feedbackMeta[kind]}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
