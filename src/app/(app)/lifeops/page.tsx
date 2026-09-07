import { CalendarDays, Download, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LifeOpsTimeline, type TimelineGroup, type TimelineRow } from "@/components/app/lifeops-timeline";
import { MascotArt } from "@/components/mascot/mascot-art";
import { type LifeOpsItem, lifeOpsMode, lifeOpsModeMeta } from "@/domain/lifeops";
import { googleCalendarUrl } from "@/server/engines/lifeops";
import { loadLifeOps } from "@/server/queries/lifeops";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { dayKey, fmtDay, fmtTime } from "@/lib/dates";
import { cn, money } from "@/lib/utils";
import { env } from "@/services/env";

export const metadata: Metadata = {
  title: "LifeOps",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * LIFEOPS
 * ----------------------------------------------------------------------------
 * "What do I need to care about today?" — one timeline of arrival admin,
 * deadlines, classes, events, plans, payments and missions, in the city's
 * time, with the money left after the day is accounted for.
 *
 * Three views, one list: Today (with anything that slipped), This week,
 * Upcoming. Everything is computed from rows the product already holds; see
 * the engine for how phased tasks earn a date.
 * ============================================================================
 */

type View = "today" | "week" | "upcoming";

export default async function LifeOpsPage(props: PageProps<"/lifeops">) {
  const viewer = await requireViewer();
  const now = requestDate();
  const params = await props.searchParams;
  const raw = Array.isArray(params.view) ? params.view[0] : params.view;
  const view: View = raw === "week" || raw === "upcoming" ? raw : "today";

  const timeline = await loadLifeOps(viewer, now);
  const mode = lifeOpsMode(viewer.stage.stage);
  const meta = lifeOpsModeMeta[mode];
  const tz = viewer.city.timezone;
  const siteUrl = env.siteUrl ?? brand.url;

  const toRow = (item: LifeOpsItem): TimelineRow => ({
    ...item,
    timeLabel: item.at && !item.allDay ? fmtTime(item.at, tz) : null,
    dayLabel: item.at ? fmtDay(item.at, tz, now) : null,
    priceLabel: item.priceCents === null ? null : item.priceCents === 0 ? "Free" : money(item.priceCents / 100, viewer.currency),
    googleUrl: googleCalendarUrl(item, siteUrl),
  });

  const groupByDay = (items: readonly LifeOpsItem[]): TimelineGroup[] => {
    const groups = new Map<string, TimelineGroup>();
    for (const item of items) {
      const key = item.at ? dayKey(item.at, tz) : "someday";
      const label = item.at ? fmtDay(item.at, tz, now) : "Sometime";
      const group = groups.get(key) ?? { key, label, items: [] };
      group.items.push(toRow(item));
      groups.set(key, group);
    }
    return [...groups.values()];
  };

  const groups: TimelineGroup[] =
    view === "today"
      ? [
          ...(timeline.today.length > 0 ? [{ key: "today", label: "Today", items: timeline.today.map(toRow) }] : []),
          ...(timeline.week.length > 0 ? [{ key: "next", label: "Coming up this week", items: timeline.week.slice(0, 4).map(toRow) }] : []),
        ]
      : view === "week"
        ? groupByDay([...timeline.today, ...timeline.week])
        : [...groupByDay(timeline.upcoming), ...(timeline.someday.length > 0 ? [{ key: "someday", label: "Sometime", items: timeline.someday.map(toRow) }] : [])];

  const counts = {
    today: timeline.overdue.length + timeline.today.length,
    week: timeline.today.length + timeline.week.length,
    upcoming: timeline.upcoming.length + timeline.someday.length,
  };

  const emptyLine =
    view === "today"
      ? timeline.week.length > 0
        ? "Nothing dated today. The week is below — or add something."
        : `Nothing on your timeline yet. ${meta.focus}`
      : view === "week"
        ? "A clear week. Add a deadline, a class or a plan and it lands here."
        : "Nothing further out yet. Deadlines and travel you add will queue up here.";

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="flex items-start gap-4">
        <MascotArt state={mode === "leaving" ? "survival" : mode === "before-arrival" ? "arrival" : "focus"} className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">LifeOps · {meta.label}</p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">
            {timeline.today.length === 0 && timeline.overdue.length === 0
              ? "A clear day."
              : `${timeline.today.length + timeline.overdue.length} ${timeline.today.length + timeline.overdue.length === 1 ? "thing" : "things"} today.`}
          </h1>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-600">{meta.focus}</p>
        </div>
      </header>

      {/* ---- money after today --------------------------------------------- */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Today" value={String(counts.today)} hint={timeline.overdue.length > 0 ? `${timeline.overdue.length} slipped` : "on the list"} />
        <Stat label="This week" value={String(counts.week)} hint="dated items" />
        <Link href="/budget" className="col-span-2 rounded-2xl bg-ink-950 p-4 text-paper transition-shadow hover:shadow-[var(--shadow-raise)] sm:col-span-1">
          <span className="flex items-center gap-1.5 font-mono text-micro uppercase tracking-[0.1em] text-paper/60">
            <Wallet className="size-3" />
            After today
          </span>
          <span className={cn("tnum mt-1 block font-display text-[1.5rem] leading-none font-semibold", timeline.budgetAfterTodayCents !== null && timeline.budgetAfterTodayCents < 0 ? "text-pulse" : "text-signal")}>
            {timeline.budgetAfterTodayCents === null ? "Set a budget" : money(timeline.budgetAfterTodayCents / 100, viewer.currency)}
          </span>
          <span className="mt-1 block text-[0.75rem] text-paper/60">
            {timeline.budgetAfterTodayCents === null
              ? "to see what today leaves you"
              : timeline.todayCostCents > 0
                ? `${money(timeline.todayCostCents / 100, viewer.currency)} planned today`
                : "nothing planned costs money today"}
          </span>
        </Link>
      </div>

      {/* ---- views --------------------------------------------------------- */}
      <nav aria-label="Timeline view" className="mt-6 flex items-center justify-between gap-3">
        <div className="flex rounded-full bg-paper-2 p-1">
          {(
            [
              { key: "today", label: "Today" },
              { key: "week", label: "This week" },
              { key: "upcoming", label: "Upcoming" },
            ] as const
          ).map((entry) => (
            <Link
              key={entry.key}
              href={entry.key === "today" ? "/lifeops" : `/lifeops?view=${entry.key}`}
              aria-current={view === entry.key ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-medium transition-colors",
                view === entry.key ? "bg-white text-ink-950 shadow-[var(--shadow-flat)]" : "text-ink-500 hover:text-ink-900",
              )}
            >
              {entry.label}
              <span className="tnum font-mono text-micro text-ink-400">{counts[entry.key]}</span>
            </Link>
          ))}
        </div>
        <a
          href="/api/lifeops/calendar.ics"
          className="inline-flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-medium text-ink-500 hover:text-ink-950"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Calendar file</span>
          <span className="sr-only sm:hidden">Calendar file</span>
        </a>
      </nav>

      <div className="mt-4">
        <LifeOpsTimeline
          groups={groups}
          overdue={view === "today" ? timeline.overdue.map(toRow) : []}
          emptyLine={emptyLine}
          suggestions={meta.suggestions}
          defaultKind={mode === "established" ? "deadline" : "task"}
        />
      </div>

      <p className="mt-8 flex items-start gap-2 rounded-xl bg-paper-2 px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-600">
        <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
        Built from your Arrival Mode tasks, events you said you are going to, Anyone Down? plans, saved plans, repeating charges and missions. Times are {viewer.city.name} time. Nothing here is shared with anyone.
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <span className="block font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{label}</span>
      <span className="tnum mt-1 block font-display text-[1.5rem] leading-none font-semibold text-ink-950">{value}</span>
      <span className="mt-1 block text-[0.75rem] text-ink-500">{hint}</span>
    </div>
  );
}
