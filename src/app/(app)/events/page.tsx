import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RadarCard } from "@/components/app/event-card";
import { MascotArt } from "@/components/mascot/mascot-art";
import {
  loadRecommendContext,
  loadSavedKeys,
  loadScoredEvents,
  savedKey,
} from "@/server/queries/discovery";
import {
  arrangeEvents,
  eventKindFilters,
  eventTabs,
  loadEventEnergy,
  UNDER_TEN_CENTS,
  type EventTab,
} from "@/server/queries/events";
import { loadMoney } from "@/server/queries/money";
import { loadOpenInvites } from "@/server/queries/plans";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Event radar",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * EVENT RADAR
 * ----------------------------------------------------------------------------
 * Ten views and a kind filter, all in the URL so the back button works and a
 * view can be shared.
 *
 * Price is expressed *only* as a view — Free and Under 10 are tabs. There used
 * to be both a Free tab and a Free price cap, which meant two controls for one
 * idea and a state where the cap said "free" while the tab said "campus". One
 * model, one control.
 *
 * Every card carries live social context — who is going, from which campus,
 * which friends — because an event is only as good as the people at it.
 * ============================================================================
 */
export default async function EventsPage(props: PageProps<"/events">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();
  const where = viewer.currency;
  const timeZone = viewer.city.timezone;

  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  /* Legacy links from Home, the brief and the arrival plan. */
  const legacyMax = one("max");
  const raw =
    one("tab") ??
    (one("filter") === "free" || legacyMax === "free" ? "free" : undefined) ??
    (legacyMax === "10" || one("filter") === "under-10" ? "under-10" : undefined) ??
    (one("when") === "tonight" ? "tonight" : undefined);

  const tab: EventTab = eventTabs.some((entry) => entry.value === raw) ? (raw as EventTab) : "for-you";
  const kind = eventKindFilters.some((entry) => entry.value === one("kind")) ? one("kind")! : null;

  const money$ = await loadMoney(viewer.user.id, now);
  const context = await loadRecommendContext({
    userId: viewer.user.id,
    profile: viewer.profile,
    budgetCents: money$.unset ? null : money$.reading.safeTodayCents,
    now,
  });

  const scored = await loadScoredEvents(viewer.user.id, context, {
    when: tab === "tonight" ? "tonight" : tab === "weekend" ? "weekend" : tab === "week" ? "week" : "all",
    freeOnly: tab === "free",
    maxPriceCents: tab === "under-10" ? UNDER_TEN_CENTS : null,
    kinds: kind ? [kind] : undefined,
    campusOnly: tab === "campus",
  });

  const [energy, invites, savedKeys] = await Promise.all([
    loadEventEnergy({
      viewerId: viewer.user.id,
      campusSlug: viewer.profile.campusSlug,
      eventIds: scored.map((entry) => entry.item.id),
      now,
    }),
    loadOpenInvites({ userId: viewer.user.id, citySlug: viewer.profile.citySlug, now }),
    loadSavedKeys(viewer.user.id),
  ]);

  const events = arrangeEvents(scored, tab, energy, invites, now);

  const urlWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current = { tab, kind, ...patch };
    for (const [key, value] of Object.entries(current)) {
      if (value && !(key === "tab" && value === "for-you")) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/events?${qs}` : "/events";
  };

  const tabLabel = (entry: (typeof eventTabs)[number]) =>
    entry.value === "under-10" ? `Under ${money(10, where)}` : entry.label;

  const emptyLine =
    tab === "campus" && !viewer.profile.campusSlug
      ? "Add your university to see campus events."
      : tab === "free"
        ? "Nothing free listed in this view yet."
        : tab === "under-10"
          ? `Nothing under ${money(10, where)} in this view yet.`
          : tab === "tonight"
            ? "Nothing on tonight that we know about."
            : tab === "social"
              ? "Nothing with people attached yet — no friends interested and no groups forming."
              : tab === "new"
                ? "Nothing new added in the last week."
                : "Nothing good in this view yet.";

  return (
    <div className="page py-6 sm:py-8">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            {viewer.city.name}
            {money$.unset ? "" : ` · ${money(money$.reading.safeTodayCents / 100, where)} safe today`}
          </p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">Event radar</h1>
        </div>
        <Link
          href="/discover"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20"
        >
          <Compass className="size-4" />
          Places and deals
        </Link>
      </header>

      {/* ---- views -------------------------------------------------------- */}
      <nav
        aria-label="Event views"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]"
      >
        {eventTabs.map((entry) => (
          <Link
            key={entry.value}
            href={urlWith({ tab: entry.value })}
            aria-current={tab === entry.value ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[0.875rem] font-medium transition-colors",
              tab === entry.value
                ? "bg-ink-950 text-paper"
                : "bg-white text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20",
            )}
          >
            {tabLabel(entry)}
          </Link>
        ))}
      </nav>

      {/* ---- kind --------------------------------------------------------- */}
      <div className="-mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        {eventKindFilters.map((entry) => (
          <Link
            key={entry.value}
            href={urlWith({ kind: kind === entry.value ? null : entry.value })}
            aria-pressed={kind === entry.value}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
              kind === entry.value ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
            )}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      {/* ---- list --------------------------------------------------------- */}
      <div className="mt-6">
        <p className="mb-3 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
          {events.length} {events.length === 1 ? "event" : "events"}
          {tab === "trending" ? " · most interest per day" : tab === "new" ? " · added this week" : ""}
        </p>

        {events.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl bg-white px-5 py-10 text-center ring-1 ring-ink-950/6">
            <MascotArt state="empty" className="size-16" />
            <p className="mt-4 text-[0.9375rem] text-ink-700">{emptyLine}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href={tab === "campus" && !viewer.profile.campusSlug ? "/you/profile" : "/events"}
                className="rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper"
              >
                {tab === "campus" && !viewer.profile.campusSlug ? "Add your university" : "Show everything"}
              </Link>
              {tab !== "week" ? (
                <Link
                  href={urlWith({ tab: "week", kind: null })}
                  className="rounded-full border border-ink-200 bg-white px-4 py-2 text-[0.875rem] font-medium text-ink-700"
                >
                  Widen to this week
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((entry) => (
              <li key={entry.item.id}>
                <RadarCard
                  scored={entry}
                  energy={energy.get(entry.item.id)}
                  where={where}
                  now={now}
                  timeZone={timeZone}
                  campusName={viewer.campusName}
                  saved={savedKeys.has(savedKey("event", entry.item.id))}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
