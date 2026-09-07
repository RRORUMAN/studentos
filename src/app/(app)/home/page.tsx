import { ArrowRight, CalendarClock, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";

import { AskBar } from "@/components/app/ask-bar";
import { Empty } from "@/components/app/cards";
import { FeedCard } from "@/components/app/feed-card";
import {
  DailyBrief,
  LifeOpsPeek,
  MissionCard,
  MoneySummary,
  QuickActions,
  RightNowStrip,
  SectionHead,
  TodayForYou,
} from "@/components/app/home-blocks";
import { PersonRow } from "@/components/app/people";
import { MascotArt } from "@/components/mascot/mascot-art";
import { askSuggestions, greeting } from "@/server/engines/suggestions";
import { loadHome } from "@/server/queries/home";
import { syncNotifications } from "@/server/queries/notify-sync";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtTime, fmtWhen, hourIn, weekdayIn } from "@/lib/dates";
import { currencySymbol, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * HOME — my day
 * ----------------------------------------------------------------------------
 * One hierarchy, top to bottom, and the further down the quieter:
 *
 *   PRIMARY    what matters today
 *     1. who and where            greeting, city, university
 *     2. what can I afford        safe today · safe this week · one sentence
 *     3. today for you            three to five things, one of each kind
 *
 *   SECONDARY  what should I do
 *     4. the brief                counts that matter, each a link
 *     5. my day                   the timeline, and the money after it
 *     6. right now                only when something is on
 *     7. ask                      the concierge, with real questions
 *
 *   TERTIARY   explore more
 *     8. mission                  the next step
 *     9. for you                  the mixed feed
 *    10. people                   opt-in
 *
 * Everything is Tier 0. No model is called to render this screen.
 * ============================================================================
 */
export default async function HomePage() {
  const viewer = await requireViewer();
  const now = requestDate();
  const where = viewer.currency;
  const tz = viewer.city.timezone;
  const social = !viewer.profile.socialGoals.includes("private");

  const data = await loadHome(viewer, now);
  const stage = viewer.stage.stage;
  const hour = hourIn(now, tz);

  /* Notifications are computed from the same rows and written *after* the
     response is sent, so opening Home never waits on them. Every producer
     passes a stable key, so this is idempotent across reloads. */
  after(async () => {
    await syncNotifications(viewer, now);
  });

  const suggestions = askSuggestions({
    stage,
    safeTodayCents: data.money.unset ? null : data.money.reading.safeTodayCents,
    currencySymbol: currencySymbol(where.currency, where.locale),
    hasBudget: !data.money.unset,
    day: weekdayIn(now, tz),
    hour,
    social,
    cityName: viewer.city.name,
    hasCampus: Boolean(viewer.profile.campusSlug),
  });

  const timeLabels = Object.fromEntries(
    [...data.timeline.overdue, ...data.timeline.today].map((item) => [item.key, item.at ? (item.allDay ? "Today" : fmtTime(item.at, tz)) : null]),
  );

  const mission = data.mission
    ? {
        id: data.mission.mission.id,
        title: data.mission.mission.title,
        emoji: data.mission.mission.emoji,
        done: data.mission.progress.done,
        total: data.mission.progress.total,
        nextStep: data.mission.steps.find((step) => !step.doneAt && !step.skippedAt)?.label ?? null,
        budgetLabel: data.mission.mission.budgetCents === null ? null : `${money(data.mission.totalCents / 100, where)} of ${money(data.mission.mission.budgetCents / 100, where)}`,
      }
    : null;

  const dayLabel = fmtWhen(now.toISOString(), tz, now, true) === "Today"
    ? new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: tz }).format(now)
    : "";

  return (
    <div className="page max-w-3xl py-6 sm:py-8">
      {/* ---- 1. who and where -------------------------------------------- */}
      <header className="mb-5">
        <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
          {viewer.city.name}
          {viewer.campusName ? ` · ${viewer.campusName}` : ""}
          {dayLabel ? ` · ${dayLabel}` : ""}
        </p>
        <h1 className="mt-1.5 text-display-sm text-ink-950">
          {greeting(hour)}, {viewer.profile.displayName}.
        </h1>
      </header>

      {/* ---- stage leads -------------------------------------------------- */}
      {stage === "before-arrival" ? <Countdown days={viewer.stage.daysUntilArrival ?? 0} cityName={viewer.city.name} /> : null}
      {stage === "leaving" ? <LeavingPrompt days={viewer.stage.daysUntilDeparture ?? 0} /> : null}

      {/* ---- 2. money ----------------------------------------------------- */}
      <div className="mt-4">
        <MoneySummary
          reading={data.money.reading}
          weekTargetCents={data.money.week.targetCents}
          weekSpentCents={data.money.week.spentCents}
          sentence={data.sentence}
          where={where}
        />
      </div>

      {/* ---- 3. today for you -------------------------------------------- */}
      <div className="mt-6">
        <TodayForYou picks={data.today} where={where} />
      </div>

      {/* ---- quick actions ----------------------------------------------- */}
      <div className="mt-5">
        <QuickActions actions={data.actions} />
      </div>

      <div className="mt-8 space-y-8">
        {/* ---- 4. brief --------------------------------------------------- */}
        <DailyBrief lines={data.brief} name={viewer.profile.displayName} />

        {/* ---- arrival progress, while it applies ------------------------- */}
        {(stage === "first-24h" || stage === "first-week" || stage === "first-month") && data.arrivalTotal > 0 ? (
          <ArrivalProgress done={data.arrivalDone} total={data.arrivalTotal} cityName={viewer.city.name} />
        ) : null}

        {/* ---- 5. my day -------------------------------------------------- */}
        <LifeOpsPeek
          items={[...data.timeline.overdue, ...data.timeline.today]}
          slipped={data.timeline.overdue.length}
          budgetAfterTodayCents={data.timeline.budgetAfterTodayCents}
          where={where}
          timeLabels={timeLabels}
        />

        {/* ---- 6. right now ---------------------------------------------- */}
        <RightNowStrip items={data.rightNow} />

        {/* ---- 7. ask ------------------------------------------------------ */}
        <AskBar
          suggestions={suggestions}
          safeTodayLabel={data.money.unset ? null : `${money(data.money.reading.safeTodayCents / 100, where)} today`}
        />

        {/* ---- 8. mission -------------------------------------------------- */}
        <MissionCard mission={mission} />

        {/* ---- 9. for you ------------------------------------------------- */}
        <section aria-labelledby="for-you-heading">
          <SectionHead title="For you" hint="Events, places, deals and people — each with the reason it is here." href="/discover" hrefLabel="Discover" />
          {data.feed.length === 0 ? (
            <Empty line="Nothing matches you closely enough yet. Add a few interests and it fills in." action="Edit interests" href="/you/profile" />
          ) : (
            <ul className="space-y-3">
              {data.feed.slice(0, 6).map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <FeedCard item={item} where={where} now={now} timeZone={tz} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- 10. people ------------------------------------------------- */}
        {social ? (
          <section aria-labelledby="people-heading">
            <SectionHead title="People and plans for you" hint="Students near your campus and interests. Opt-in, campus and interests only — never location." href="/anyone-down" hrefLabel="Anyone down?" />

            {data.openInvites.length === 0 && data.people.length === 0 ? (
              <Empty line="Start with your campus. Join a plan, or post one, and this fills in." action="Post a plan" href="/anyone-down" />
            ) : (
              <div className="space-y-3">
                {data.openInvites.slice(0, 2).map((invite) => (
                  <Link
                    key={invite.id}
                    href={`/anyone-down/${invite.id}`}
                    className="flex items-center gap-3.5 rounded-xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]"
                  >
                    <MascotArt state="social" className="size-10 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-semibold text-ink-950">{invite.title}</span>
                      <span className="mt-0.5 block text-[0.8125rem] text-ink-500">
                        {invite.going} in · {Math.max(0, invite.capacity - invite.going)} spots · {fmtWhen(invite.startsAt, tz, now)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-signal px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-950">Join</span>
                  </Link>
                ))}

                {data.people.length > 0 ? (
                  <ul className="space-y-2">
                    {data.people.slice(0, 3).map((entry) => (
                      <PersonRow
                        key={entry.profile.userId}
                        profile={entry.profile}
                        state="none"
                        reason={
                          entry.shared.length > 0
                            ? `Also into ${entry.shared.slice(0, 2).map((tag) => tag.replace(/-/g, " ")).join(" and ")}${entry.sameCampus ? " · your campus" : ""}`
                            : "Your campus"
                        }
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {/* ---- pulse prompt ---------------------------------------------- */}
        <Link href="/pulse" className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-flow-soft">
            <Sparkles className="size-4.5 text-flow-deep" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold text-ink-950">What students in {viewer.city.name} are saying</span>
            <span className="mt-0.5 block text-[0.8125rem] text-ink-500">Prices, deals and questions, from people who live here.</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-ink-400" />
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stage leads                                                                 */
/* -------------------------------------------------------------------------- */

function Countdown({ days, cityName }: { days: number; cityName: string }) {
  return (
    <Link href="/lifeops" className="mt-4 flex items-center gap-4 rounded-2xl bg-flow-soft/70 p-5 ring-1 ring-flow-deep/15 transition-shadow hover:shadow-[var(--shadow-raise)]">
      <MascotArt state="arrival" accessory="backpack" className="size-14 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="font-mono text-micro uppercase tracking-[0.1em] text-flow-deep">Arriving in</span>
        <span className="tnum mt-0.5 block font-display text-[1.75rem] leading-none font-semibold text-flow-deep">
          {days} {days === 1 ? "day" : "days"}
        </span>
        <span className="mt-1.5 block text-[0.875rem] text-ink-700">Some of this is much easier before you land in {cityName}. Your timeline has it in order.</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-flow-deep" />
    </Link>
  );
}

function ArrivalProgress({ done, total, cityName }: { done: number; total: number; cityName: string }) {
  const fraction = total === 0 ? 0 : done / total;
  return (
    <Link href="/arrival" className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-soft">
        <CalendarClock className="size-4.5 text-amber-deep" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[0.9375rem] font-semibold text-ink-950">Settling into {cityName}</span>
          <span className="tnum font-mono text-[0.75rem] text-ink-500">{done}/{total}</span>
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-ink-100">
          <span className="block h-full rounded-full bg-amber" style={{ width: `${fraction * 100}%` }} />
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-ink-400" />
    </Link>
  );
}

function LeavingPrompt({ days }: { days: number }) {
  return (
    <Link href="/leaving" className="mt-4 flex items-center gap-4 rounded-2xl bg-pulse-soft/60 p-5 ring-1 ring-pulse-deep/15 transition-shadow hover:shadow-[var(--shadow-raise)]">
      <MascotArt state="survival" className="size-12 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[1.0625rem] font-semibold text-ink-950">{days} days left here</span>
        <span className="mt-0.5 block text-[0.875rem] text-ink-600">Cancel what renews, pass on what you cannot take, do the things you kept meaning to.</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-pulse-deep" />
    </Link>
  );
}
