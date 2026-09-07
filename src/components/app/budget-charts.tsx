import type { Trajectory, WeekBar } from "@/server/engines/budget";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * BUDGET CHARTS
 * ----------------------------------------------------------------------------
 * Four small pictures, all hand-drawn SVG, all server-rendered, no library.
 *
 * Three rules they share, and they are the difference between a chart that
 * reports and a chart that tells you something:
 *
 *   Every bar carries its pace marker. A bar 60% full means nothing on its
 *   own and means a great deal next to a tick showing you are 40% through the
 *   month. The marker is a drawn element with a visible label, never a
 *   `title` tooltip — a tooltip does not exist on a phone, which is where
 *   this is read.
 *
 *   Over-budget looks different, not just longer. Past 100% the bar switches
 *   to the alert colour and the overshoot is drawn hatched beyond the track,
 *   so "over" is legible without reading the number.
 *
 *   Colour is never the only signal. Every state also changes a shape or
 *   carries a word, because a red bar and a green bar are the same bar to a
 *   colour-blind student.
 * ============================================================================
 */

type Where = { currency: string; locale: string };

const fmt = (cents: number, where: Where) => money(cents / 100, where);

/* -------------------------------------------------------------------------- */
/* Month bar                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The hero bar: spent against the month's plan, with the even-pace marker and
 * an explicit over-budget state.
 *
 * `onDark` because this one lives on the dark product surface and the rest do
 * not; the geometry is identical either way.
 */
export function MonthBar({
  spentCents,
  plannedCents,
  pacedCents,
  where,
  onDark = false,
  className,
}: {
  spentCents: number;
  plannedCents: number;
  pacedCents: number;
  where: Where;
  onDark?: boolean;
  className?: string;
}) {
  if (plannedCents <= 0) return null;

  const over = spentCents > plannedCents;
  const ahead = spentCents > pacedCents;
  const scale = Math.max(plannedCents, spentCents);
  const spentPct = (spentCents / scale) * 100;
  const planPct = (plannedCents / scale) * 100;
  const pacePct = Math.min(100, (pacedCents / scale) * 100);

  const tone = over ? "bg-pulse" : ahead ? "bg-amber" : "bg-mint";
  const label = over
    ? `${fmt(spentCents - plannedCents, where)} over budget`
    : ahead
      ? `${fmt(spentCents - pacedCents, where)} ahead of an even pace`
      : `${fmt(pacedCents - spentCents, where)} under an even pace`;

  return (
    <div className={className}>
      <div
        className={cn("relative h-3 w-full overflow-hidden rounded-full", onDark ? "bg-paper/12" : "bg-ink-100")}
        role="meter"
        aria-valuenow={Math.round((spentCents / plannedCents) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Spent ${fmt(spentCents, where)} of ${fmt(plannedCents, where)}. ${label}.`}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${spentPct}%` }} />

        {/* Where the plan runs out, once spending has gone past it. */}
        {over ? (
          <span
            aria-hidden
            className={cn("absolute top-0 h-full w-0.5", onDark ? "bg-paper/70" : "bg-ink-950/60")}
            style={{ left: `${planPct}%` }}
          />
        ) : null}

        {/* Even-pace marker. A notch through the whole bar, not a hairline. */}
        {pacePct > 0 && pacePct < 100 ? (
          <span
            aria-hidden
            className={cn(
              "absolute top-0 h-full w-[3px] rounded-full",
              onDark ? "bg-paper" : "bg-ink-950",
            )}
            style={{ left: `calc(${pacePct}% - 1.5px)` }}
          />
        ) : null}
      </div>

      {/* The legend is the point of the marker, so it is text and not a hover. */}
      <p
        className={cn(
          "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]",
          onDark ? "text-paper/70" : "text-ink-600",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("inline-block h-3 w-[3px] rounded-full", onDark ? "bg-paper" : "bg-ink-950")}
          />
          Even pace today
        </span>
        <span aria-hidden className={onDark ? "text-paper/30" : "text-ink-300"}>
          ·
        </span>
        <span className={cn("font-medium", over ? (onDark ? "text-pulse" : "text-pulse-deep") : undefined)}>
          {label}
        </span>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Category meter                                                              */
/* -------------------------------------------------------------------------- */

/** One envelope as a bar, with its own pace tick. */
export function CategoryBar({
  spentCents,
  plannedCents,
  pacedCents,
  className,
}: {
  spentCents: number;
  plannedCents: number;
  pacedCents: number;
  className?: string;
}) {
  const scale = Math.max(plannedCents, spentCents, 1);
  const spentPct = (spentCents / scale) * 100;
  const pacePct = Math.min(100, (pacedCents / scale) * 100);
  const over = spentCents > plannedCents;
  const ahead = spentCents > pacedCents;

  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-ink-100", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          over ? "bg-pulse" : ahead ? "bg-amber" : "bg-mint",
        )}
        style={{ width: `${spentPct}%` }}
      />
      {pacePct > 0 && pacePct < 100 ? (
        <span
          aria-hidden
          className="absolute top-0 h-full w-[3px] rounded-full bg-ink-950/70"
          style={{ left: `calc(${pacePct}% - 1.5px)` }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Weekly bars                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The last few weeks, with this week's target drawn across them.
 *
 * The target line is *this* week's figure on every bar, and the caption says
 * so: earlier weeks had their own targets that were never recorded, and
 * drawing a guessed line as a fact is exactly what this product does not do.
 */
export function WeekBars({
  weeks,
  where,
  showTarget = true,
  className,
}: {
  weeks: readonly WeekBar[];
  where: Where;
  /** Off for a free student: the bars are theirs, the target is Plus. */
  showTarget?: boolean;
  className?: string;
}) {
  if (weeks.length === 0) return null;

  const target = weeks[weeks.length - 1]?.targetCents ?? 0;
  const peak = Math.max(...weeks.map((week) => week.spentCents), showTarget ? target : 0, 1);
  const height = 96;
  const targetY = showTarget && target > 0 ? height - (target / peak) * height : null;

  return (
    <figure className={className}>
      <div className="relative" style={{ height }}>
        <div className="flex h-full items-end gap-2">
          {weeks.map((week) => {
            const barHeight = Math.max(2, (week.spentCents / peak) * height);
            const over = showTarget && target > 0 && week.spentCents > target;
            return (
              <div
                key={week.weekStart}
                className={cn(
                  "min-w-0 flex-1 rounded-t-md transition-[height] duration-500",
                  over ? "bg-pulse" : week.current ? "bg-mint" : "bg-ink-200",
                )}
                style={{ height: barHeight }}
              />
            );
          })}
        </div>

        {/* The target, drawn across the bars and named in the caption, so the
            line means something without a hover. */}
        {targetY !== null ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-950/45"
            style={{ top: targetY }}
          />
        ) : null}
      </div>

      <div className="mt-2 flex gap-2">
        {weeks.map((week) => (
          <span
            key={week.weekStart}
            className={cn(
              "tnum min-w-0 flex-1 truncate text-center font-mono text-[0.6875rem]",
              week.current ? "font-semibold text-ink-800" : "text-ink-400",
            )}
          >
            {week.current ? "This week" : week.weekStart.slice(8, 10) + "/" + week.weekStart.slice(5, 7)}
          </span>
        ))}
      </div>

      <figcaption className="mt-2 text-[0.8125rem] text-ink-600">
        {showTarget && target > 0
          ? `Dashed line is this week's target, ${fmt(target, where)}. Earlier weeks are shown against the same line.`
          : `${fmt(weeks[weeks.length - 1].spentCents, where)} spent this week.`}
      </figcaption>
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Month by month                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Spend per month, oldest first, with this month marked as incomplete.
 *
 * The current month is drawn in outline rather than solid because it is not
 * finished: a half-height bar for a month that is ten days old looks like a
 * good month, and reading it that way is how a student gets a shock on the
 * 28th. The label says "so far" for the same reason.
 */
export function MonthTrend({
  months,
  where,
  className,
}: {
  months: readonly { month: string; spentCents: number }[];
  where: Where;
  className?: string;
}) {
  if (months.length < 2) return null;

  const peak = Math.max(...months.map((entry) => entry.spentCents), 1);
  const height = 72;
  const last = months.length - 1;

  return (
    <figure className={className}>
      <div className="flex items-end gap-2" style={{ height }}>
        {months.map((entry, index) => (
          <div
            key={entry.month}
            className={cn(
              "min-w-0 flex-1 rounded-t-md",
              index === last ? "border-2 border-dashed border-flow bg-flow-soft" : "bg-flow/70",
            )}
            style={{ height: Math.max(2, (entry.spentCents / peak) * height) }}
          />
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        {months.map((entry, index) => (
          <span
            key={entry.month}
            className={cn(
              "tnum min-w-0 flex-1 truncate text-center font-mono text-[0.6875rem]",
              index === last ? "font-semibold text-ink-800" : "text-ink-400",
            )}
          >
            {entry.month.slice(5)}
          </span>
        ))}
      </div>

      <figcaption className="mt-2 text-[0.8125rem] text-ink-600">
        {fmt(months[last].spentCents, where)} this month so far, against{" "}
        {fmt(months[last - 1].spentCents, where)} last month. The dashed bar is not a finished month.
      </figcaption>
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Trajectory sparkline                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Where the month is heading: cumulative spend so far as a solid line, the
 * straight-line projection dashed, and the budget as a horizontal rule.
 *
 * The picture and the forecast number come from the same arithmetic
 * (`spendTrajectory`), so they cannot drift apart.
 */
export function TrajectorySparkline({
  trajectory,
  where,
  className,
}: {
  trajectory: Trajectory;
  where: Where;
  className?: string;
}) {
  const width = 320;
  const height = 88;
  const pad = 4;

  const peak = Math.max(
    trajectory.plannedCents,
    trajectory.projected[trajectory.projected.length - 1] ?? 0,
    1,
  );

  const x = (day: number) => pad + ((day - 1) / Math.max(1, trajectory.daysInMonth - 1)) * (width - pad * 2);
  const y = (cents: number) => height - pad - (cents / peak) * (height - pad * 2);

  const path = (series: readonly number[], fromDay: number) =>
    series
      .map((cents, index) => `${index === 0 ? "M" : "L"} ${x(fromDay + index).toFixed(1)} ${y(cents).toFixed(1)}`)
      .join(" ");

  const actualPath = path(trajectory.actual, 1);
  const futurePath = path(trajectory.projected.slice(trajectory.today - 1), trajectory.today);
  const planY = y(trajectory.plannedCents);
  const endCents = trajectory.projected[trajectory.projected.length - 1] ?? 0;
  const over = endCents > trajectory.plannedCents;

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Spending so far and the projection to month end, against a budget of ${fmt(trajectory.plannedCents, where)}.`}
      >
        {/* The budget, as the line the projection is judged against. */}
        <line x1={pad} x2={width - pad} y1={planY} y2={planY} className="stroke-ink-300" strokeWidth={1} strokeDasharray="2 3" />

        <path d={actualPath} fill="none" className="stroke-ink-950" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path
          d={futurePath}
          fill="none"
          className={over ? "stroke-pulse" : "stroke-mint"}
          strokeWidth={2}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />

        {/* Today, and where it lands. */}
        <circle cx={x(trajectory.today)} cy={y(trajectory.actual[trajectory.actual.length - 1] ?? 0)} r={3} className="fill-ink-950" />
        <circle cx={x(trajectory.daysInMonth)} cy={y(endCents)} r={3} className={over ? "fill-pulse" : "fill-mint"} />
      </svg>

      <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-ink-950" />
          Spent so far
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("inline-block h-0.5 w-4 rounded", over ? "bg-pulse" : "bg-mint")} />
          At this pace
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded border-t border-dashed border-ink-400" />
          Budget
        </span>
      </figcaption>
    </figure>
  );
}
