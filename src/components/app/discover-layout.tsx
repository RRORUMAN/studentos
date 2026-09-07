"use client";

import { type PointerEvent as ReactPointerEvent, type ReactNode, useRef, useState } from "react";

import { DiscoverMap, type MapPlace } from "@/components/app/discover-map";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * DISCOVER LAYOUT
 * ----------------------------------------------------------------------------
 * Mobile: the map on top and a draggable sheet over it holding the filters and
 * the feed, with two snap points — half (map and list share the screen) and
 * full (the list takes over). Desktop: map on the left, sticky, feed on the
 * right. One DOM tree for both; the breakpoint is CSS, so nothing renders
 * twice and no client hook has to guess the viewport before hydration.
 *
 * The sheet moves by animating `top` rather than a transform so its scroll
 * area is always exactly the visible part and the last card is reachable at
 * either snap. Reduced motion is honoured globally (transitions collapse to
 * zero in globals.css); dragging sets no transition at all.
 *
 * The selected pin lives here, one level above the map, because selecting one
 * also drops the sheet to half so the map can be seen.
 * ============================================================================
 */

type Snap = "half" | "full";

/** Where the sheet's top edge sits at each snap, as a share of the shell. */
const SNAP_TOP: Record<Snap, number> = { half: 0.5, full: 0 };

export function DiscoverLayout({
  places,
  seed,
  where,
  eventCount,
  aside,
  filters,
  children,
}: {
  places: readonly MapPlace[];
  seed: number;
  where: { currency: string; locale: string };
  eventCount: number;
  /** Rendered above the map (the trip picker, a trip note). */
  aside?: ReactNode;
  filters: ReactNode;
  children: ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("half");
  /** Pixel offset while a drag is in progress; null otherwise. */
  const [dragTop, setDragTop] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startTop: number; height: number; moved: boolean } | null>(null);

  const shellHeight = () => shellRef.current?.getBoundingClientRect().height ?? 0;

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const height = shellHeight();
    if (height === 0) return;
    drag.current = {
      startY: event.clientY,
      startTop: (dragTop ?? SNAP_TOP[snap] * height),
      height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state) return;
    const dy = event.clientY - state.startY;
    if (Math.abs(dy) > 4) state.moved = true;
    const next = Math.min(state.height * 0.62, Math.max(0, state.startTop + dy));
    setDragTop(next);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!state) return;
    if (state.moved) {
      const top = dragTop ?? state.startTop;
      setSnap(top < state.height * 0.25 ? "full" : "half");
    }
    setDragTop(null);
  };

  const onHandleClick = () => {
    /* A drag that ended on the handle also fires click; ignore that one. */
    if (drag.current?.moved) return;
    setSnap((current) => (current === "full" ? "half" : "full"));
  };

  const select = (id: string | null) => {
    setSelectedId(id);
    if (id) setSnap("half");
  };

  const sheetTop = dragTop !== null ? `${dragTop}px` : `${SNAP_TOP[snap] * 100}%`;

  return (
    <div
      ref={shellRef}
      className={cn(
        "relative",
        "max-lg:h-[calc(100dvh-13.5rem)] max-lg:min-h-[30rem] max-lg:overflow-hidden max-lg:rounded-2xl",
        "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-6",
      )}
    >
      {/* ---- map ---------------------------------------------------------- */}
      <div className="max-lg:absolute max-lg:inset-x-0 max-lg:top-0 lg:sticky lg:top-24">
        {aside}
        <DiscoverMap
          places={places}
          selectedId={selectedId}
          onSelect={select}
          seed={seed}
          where={where}
          eventCount={eventCount}
        />
      </div>

      {/* ---- sheet / feed --------------------------------------------------- */}
      <section
        aria-label="Results"
        style={{ top: sheetTop }}
        className={cn(
          "max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:flex max-lg:flex-col",
          "max-lg:rounded-t-3xl max-lg:bg-paper max-lg:shadow-[var(--shadow-lift)] max-lg:ring-1 max-lg:ring-ink-950/10",
          dragTop === null && "max-lg:transition-[top] max-lg:duration-300 max-lg:ease-[cubic-bezier(0.22,1,0.36,1)]",
          "lg:static lg:min-w-0",
        )}
      >
        <button
          type="button"
          aria-label={snap === "full" ? "Show the map" : "Expand the list"}
          aria-expanded={snap === "full"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onHandleClick}
          className="flex w-full shrink-0 cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing lg:hidden"
        >
          <span aria-hidden className="h-1.5 w-12 rounded-full bg-ink-300" />
        </button>

        <div className="min-w-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:px-5 max-lg:pb-6">
          {filters}
          <div className="mt-4">{children}</div>
        </div>
      </section>
    </div>
  );
}
