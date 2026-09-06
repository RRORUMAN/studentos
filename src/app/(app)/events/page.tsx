import type { Metadata } from "next";
import Link from "next/link";

import { RadarCard } from "@/components/app/event-card";
import { MascotArt } from "@/components/mascot/mascot-art";
import { loadRecommendContext, loadScoredEvents } from "@/server/queries/discovery";
import {
  arrangeEvents,
  eventKindFilters,
  eventTabs,
  loadEventEnergy,
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
 * Nine views, a kind filter and two price caps, all in the URL so the back
 * button works and a view can be shared.
 *
 * Every card carries live social context — who is going, from which campus,
 * which friends — because an event is only as good as the people at it.
 * ============================================================================
 */

const PRICE_CAPS = [
  { value: "free", label: "Free" },
  { value: "5", label: "Under 5" },
  { value: "10", label: "Under 10" },
] as const;

export default async function EventsPage(props: PageProps<"/events">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();
  const where = viewer.currency;

  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  /* Legacy links from Home. */
  const raw = one("tab") ?? (one("filter") === "free" ? "free" : one("when") === "tonight" ? "tonight" : undefined);
  const tab: EventTab = eventTabs.some((entry) => entry.value === raw) ? (raw as EventTab) : "for-you";
  const kind = eventKindFilters.some((entry) => entry.value === one("kind")) ? one("kind")! : null;
  const cap = PRICE_CAPS.some((entry) => entry.value === one("max")) ? one("max")! : null;

  const money$ = await loadMoney(viewer.user.id, now);
  const context = await loadRecommendContext({
    userId: viewer.user.id,
    profile: viewer.profile,
    budgetCents: money$.unset ? null : money$.reading.safeTodayCents,
    now,
  });

  const scored = await loadScoredEvents(viewer.user.id, context, {
    when:
      tab === "tonight" ? "tonight" : tab === "weekend" ? "weekend" : tab === "week" ? "week" : "all",
    freeOnly: tab === "free" || cap === "free",
    maxPriceCents: cap && cap !== "free" ? Number(cap) * 100 : null,
    kinds: kind ? [kind] : undefined,
    campusOnly: tab === "campus",
  });

  const [energy, invites] = await Promise.all([
    loadEventEnergy({
      viewerId: viewer.user.id,
      campusSlug: viewer.profile.campusSlug,
      eventIds: scored.map((entry) => entry.item.id),
    }),
    loadOpenInvites({ userId: viewer.user.id, citySlug: viewer.profile.citySlug, now }),
  ]);

  const events = arrangeEvents(scored, tab, energy, invites, now);

  const urlWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current = { tab, kind, max: cap, ...patch };
    for (const [key, value] of Object.entries(current)) {
      if (value && !(key === "tab" && value === "for-you")) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/events?${qs}` : "/events";
  };

  const emptyLine =
    tab === "campus" && !viewer.profile.campusSlug
      ? "Add your university to see campus events."
      : tab === "free"
        ? "Nothing free listed in this filter yet."
        : tab === "tonight"
          ? "Nothing on tonight that we know about."
          : "Nothing good in this filter yet.";

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
          className="hidden shrink-0 text-[0.875rem] font-medium text-ink-600 hover:text-ink-950 sm:block"
        >
          Places and deals →
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
            {entry.label}
          </Link>
        ))}
      </nav>

      {/* ---- filters ------------------------------------------------------ */}
      <div className="-mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        {PRICE_CAPS.map((entry) => (
          <Link
            key={entry.value}
            href={urlWith({ max: cap === entry.value ? null : entry.value })}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
              cap === entry.value
                ? "bg-mint-soft text-mint-deep ring-1 ring-mint-deep/30"
                : "bg-paper-2 text-ink-600 hover:bg-ink-100",
            )}
          >
            {entry.value === "free" ? entry.label : `Under ${money(Number(entry.value), where)}`}
          </Link>
        ))}
        <span aria-hidden className="my-1 w-px shrink-0 bg-ink-200" />
        {eventKindFilters.map((entry) => (
          <Link
            key={entry.value}
            href={urlWith({ kind: kind === entry.value ? null : entry.value })}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
              kind === entry.value
                ? "bg-ink-950 text-paper"
                : "bg-paper-2 text-ink-600 hover:bg-ink-100",
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
                  href={urlWith({ tab: "week", kind: null, max: null })}
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
                  campusName={viewer.campusName}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
