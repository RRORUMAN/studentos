"use client";

import { useId, useState } from "react";

import { fmtDayLabel } from "@/lib/dates";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * ADMIN CHARTS
 * ----------------------------------------------------------------------------
 * Four weeks of daily numbers, drawn small.
 *
 * Every series here is a single series, which decides most of the design: no
 * legend, no categorical palette, no colour carrying identity. The title names
 * the measure and the current value is printed beside the plot, so the chart is
 * never the only way to read the number — which is also what makes it legible
 * when it is two centimetres wide on a phone.
 *
 * The series arrive with **no gaps**: `dailySeries` in `queries/admin.ts` emits
 * a row for every day in the window whether or not anything landed in it. A
 * chart built from grouped rows would draw a straight line across a dead week
 * and read as steady, which is the opposite of what happened.
 *
 * Interaction is a crosshair rather than a tooltip that follows the cursor
 * loosely: with 28 points at this width the hit areas are about eight pixels
 * each, so the reading has to snap to a day rather than interpolate between two.
 * ============================================================================
 */

export type Point = { day: string; value: number };

/**
 * How a value reads.
 *
 * A discriminator rather than a formatter function, because these charts render
 * in a client component and a server component cannot hand one a function —
 * React refuses to serialise it, and the failure is a runtime error rather than
 * a type error, so the compiler will not warn you first.
 */
export type Unit = "count" | "micros";

function formatValue(value: number, unit: Unit): string {
  if (unit === "count") return String(value);
  if (value === 0) return money(0);
  if (value < 10_000) return "<" + money(0.01);
  return money(value / 1_000_000);
}

const VIEW_W = 260;
const VIEW_H = 60;
const PAD_Y = 6;
/* Room for the endpoint marker at either edge, so it is not sliced in half. */
const PAD_X = 5;

function pathFor(points: readonly Point[], max: number): { line: string; area: string } {
  if (points.length === 0) return { line: "", area: "" };

  const stepX = points.length === 1 ? 0 : (VIEW_W - PAD_X * 2) / (points.length - 1);
  const usable = VIEW_H - PAD_Y * 2;

  const coords = points.map((point, index) => {
    const x = PAD_X + index * stepX;
    /* A flat all-zero series sits on the baseline rather than halfway up the
       box: nothing happened, and the chart should look like nothing happened. */
    const y = max === 0 ? VIEW_H - PAD_Y : VIEW_H - PAD_Y - (point.value / max) * usable;
    return [x, y] as const;
  });

  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${VIEW_W - PAD_X} ${VIEW_H} L${PAD_X} ${VIEW_H} Z`;
  return { line, area };
}

/**
 * A bucket key ("2026-09-07") as a short label.
 *
 * Read at noon UTC and rendered in UTC, because these buckets are UTC days —
 * the same instant a city-local formatter would show as the previous evening.
 * Admin is the one surface that counts in UTC rather than in a student's city.
 */
function shortDay(day: string): string {
  return fmtDayLabel(`${day}T12:00:00.000Z`, "UTC");
}

/**
 * A 28-day sparkline with a snap-to-day crosshair.
 *
 * `unit` decides how a value reads, so the tooltip never shows a raw
 * micro-euro integer.
 */
export function Sparkline({
  points,
  label,
  unit = "count",
  onDark = false,
  className,
}: {
  points: readonly Point[];
  /** Names the measure. Read by screen readers and shown in the tooltip. */
  label: string;
  unit?: Unit;
  onDark?: boolean;
  className?: string;
}) {
  const format = (value: number) => formatValue(value, unit);
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(...points.map((point) => point.value), 0);
  const { line, area } = pathFor(points, max);

  const stroke = onDark ? "var(--color-signal)" : "var(--color-flow)";
  const last = points.length - 1;
  const shown = active ?? last;
  const point = points[shown];

  const stepX = points.length <= 1 ? 0 : (VIEW_W - PAD_X * 2) / (points.length - 1);
  const usable = VIEW_H - PAD_Y * 2;
  const cx = PAD_X + shown * stepX;
  const cy =
    max === 0 || !point ? VIEW_H - PAD_Y : VIEW_H - PAD_Y - (point.value / max) * usable;
  const markerLeft = (cx / VIEW_W) * 100;
  const markerTop = (cy / VIEW_H) * 100;

  if (points.length === 0) return null;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-14 w-full"
        role="img"
        aria-label={`${label}. Latest ${format(points[last].value)} on ${shortDay(points[last].day)}. Peak ${format(max)}.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={onDark ? 0.34 : 0.18} />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

      </svg>

      {/* The endpoint, emphasised because "where it is now" is what gets read
          first; the crosshair moves it while hovering. Drawn in HTML rather
          than as an SVG circle: this plot stretches to its container, and a
          circle under a non-uniform scale is an ellipse. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2",
          onDark ? "bg-signal ring-console" : "bg-flow ring-white",
        )}
        style={{ left: `${markerLeft}%`, top: `${markerTop}%` }}
      />

      {/* One hit area per day, so a reading snaps to a date instead of
          interpolating to a point between two of them. */}
      <div className="absolute inset-0 flex" onMouseLeave={() => setActive(null)}>
        {points.map((entry, index) => (
          <button
            key={entry.day}
            type="button"
            tabIndex={-1}
            aria-hidden
            className="h-full flex-1 cursor-default focus:outline-none"
            onMouseEnter={() => setActive(index)}
          />
        ))}
      </div>

      {active !== null && point ? (
        <p
          className={cn(
            "pointer-events-none absolute -top-1 left-0 right-0 text-center font-mono text-micro",
            onDark ? "text-white/70" : "text-ink-500",
          )}
        >
          {shortDay(point.day)} · <span className="tnum font-semibold">{format(point.value)}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Where accounts stop.
 *
 * Drawn as plain horizontal bars rather than a tapering funnel shape. A funnel
 * cone encodes the same number twice — width and area — and the area is the one
 * the eye actually reads, which exaggerates every drop. Bars share one baseline
 * and one scale, so a 10% fall looks like a 10% fall.
 *
 * The number between two rows is the conversion from the step above, which is
 * the figure worth acting on; the raw count is the one worth checking.
 */
export function FunnelBars({
  steps,
}: {
  steps: readonly { step: string; detail: string; count: number }[];
}) {
  const top = steps[0]?.count ?? 0;

  return (
    <ol className="space-y-1">
      {steps.map((entry, index) => {
        const previous = index === 0 ? null : steps[index - 1].count;
        const share = top === 0 ? 0 : (entry.count / top) * 100;
        const conversion =
          previous === null || previous === 0 ? null : Math.round((entry.count / previous) * 100);

        return (
          <li key={entry.step} className="group">
            {conversion !== null ? (
              <p className="py-1 pl-3 font-mono text-micro text-ink-400">
                <span className="tnum">{conversion}%</span> carried on
              </p>
            ) : null}

            <div className="relative overflow-hidden rounded-md border border-ink-200 bg-white">
              <div
                className="absolute inset-y-0 left-0 bg-flow-soft"
                style={{ width: `${Math.max(share, entry.count > 0 ? 2 : 0)}%` }}
                aria-hidden
              />
              <div className="relative flex items-baseline justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[0.9375rem] font-medium text-ink-950">{entry.step}</p>
                  <p className="truncate text-[0.8125rem] text-ink-500">{entry.detail}</p>
                </div>
                <p className="tnum shrink-0 font-mono text-[1.0625rem] font-semibold text-ink-950">
                  {entry.count}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Change against the previous window of the same length.
 *
 * A null delta renders as "no prior window" rather than 0% or a dash. The
 * difference between "flat" and "there is nothing to compare against" is the
 * whole content of the first month of a product's life.
 */
export function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value === null) {
    return (
      <span className={cn("font-mono text-micro text-ink-400", className)}>no prior window</span>
    );
  }

  const up = value > 0;
  const flat = value === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-micro font-semibold",
        flat ? "text-ink-400" : up ? "text-mint-deep" : "text-pulse-deep",
        className,
      )}
    >
      <span aria-hidden>{flat ? "→" : up ? "↑" : "↓"}</span>
      <span className="tnum">
        {up ? "+" : ""}
        {value}%
      </span>
      <span className="sr-only">{up ? "up" : flat ? "unchanged" : "down"} against the previous window</span>
    </span>
  );
}
