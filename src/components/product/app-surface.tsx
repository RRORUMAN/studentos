import type { ReactNode } from "react";

import { SampleTag } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * APP SURFACE
 * ----------------------------------------------------------------------------
 * The shared chrome every product demo on this site sits inside, so the hero,
 * The Loop, Discover and Budget all read as one application rather than a set of
 * unrelated cards.
 *
 * Dark by default: it separates the product from the page around it without
 * needing a device mockup or a drop shadow the size of a building.
 * ============================================================================
 */

export function AppSurface({
  title,
  meta,
  live,
  action,
  children,
  footer,
  sample = true,
  className,
  bodyClassName,
}: {
  /** Left side of the app bar, e.g. "Madrid · Loop". */
  title: ReactNode;
  meta?: ReactNode;
  /** Shows the live dot. Only for surfaces that would genuinely update. */
  live?: boolean;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  sample?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      data-surface="dark"
      className={cn(
        "group/surface relative overflow-hidden rounded-2xl text-white",
        // A shallow vertical gradient rather than a flat fill: the app bar sits
        // a shade lighter than the body, which is what makes it read as chrome.
        "bg-linear-to-b from-console-2 to-console",
        "shadow-[var(--shadow-console)] ring-1 ring-white/8",
        className,
      )}
    >
      {/* Top edge highlight. One hairline of light along the bezel is what
          separates "a screen" from "a black rectangle". */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/25 to-transparent"
      />
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
        {live ? (
          <span className="relative grid size-2 shrink-0 place-items-center" aria-hidden>
            <span className="absolute size-2 rounded-full bg-pulse animate-ping-soft" />
            <span className="size-2 rounded-full bg-pulse" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          {meta ? <p className="truncate text-xs text-white/45">{meta}</p> : null}
        </div>
        {sample ? <SampleTag onDark /> : null}
        {action}
      </div>

      <div className={cn("px-4 py-4 sm:px-5 sm:py-5", bodyClassName)}>{children}</div>

      {footer ? (
        <div className="border-t border-white/8 px-4 py-3 sm:px-5">{footer}</div>
      ) : null}
    </div>
  );
}

/** A light-ground variant, for demos that need to sit on a dark section. */
export function AppSurfaceLight({
  title,
  meta,
  action,
  children,
  footer,
  sample = true,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  sample?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white text-ink-900 shadow-[var(--shadow-glass)] ring-1 ring-ink-950/6",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-950">{title}</p>
          {meta ? <p className="truncate text-xs text-ink-400">{meta}</p> : null}
        </div>
        {sample ? <SampleTag /> : null}
        {action}
      </div>
      <div className={cn("px-4 py-4 sm:px-5 sm:py-5", bodyClassName)}>{children}</div>
      {footer ? <div className="border-t border-ink-100 px-4 py-3 sm:px-5">{footer}</div> : null}
    </div>
  );
}
