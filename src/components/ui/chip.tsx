"use client";

import type { ComponentProps, ReactNode } from "react";

import { accents, type Accent } from "@/components/ui/accent";
import { cn } from "@/lib/utils";

/**
 * A filter chip. Always a real toggle button with `aria-pressed`, never a
 * styled div — the Discover and Pulse rails are fully keyboard operable.
 */
export function Chip({
  active = false,
  accent = "flow",
  onDark = false,
  icon,
  count,
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  active?: boolean;
  accent?: Accent;
  onDark?: boolean;
  icon?: ReactNode;
  count?: number;
}) {
  const a = accents[accent];
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "active:scale-[0.97]",
        onDark
          ? active
            ? cn("border-transparent", a.fill, a.onFill)
            : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white"
          : active
            ? cn("border-transparent", a.fill, a.onFill)
            : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-950",
        className,
      )}
      {...props}
    >
      {icon ? <span className="grid size-4 place-items-center">{icon}</span> : null}
      {children}
      {typeof count === "number" ? (
        <span
          className={cn(
            "tnum ml-0.5 text-xs",
            active ? "opacity-70" : onDark ? "text-white/40" : "text-ink-400",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
