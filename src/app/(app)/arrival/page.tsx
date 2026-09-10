import { ArrowRight, Check, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TaskList, type TaskView } from "@/components/app/task-list";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { PhraseHint } from "@/components/app/phrase-hint";
import { arrivalTasks, orderByBlocking, phaseMeta, phasesForStage, type ArrivalPhase } from "@/config/arrival-plan";
import { factFreshness } from "@/domain/knowledge";
import type { LifeStage } from "@/domain/lifecycle";
import { findMany } from "@/server/db";
import { firstWeekPlan } from "@/server/engines/first-week";
import { loadPlaces, loadRecommendContext, loadScoredEvents } from "@/server/queries/discovery";
import { loadMoney } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtWeekdayDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Arrival Mode",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * ARRIVAL MODE
 * ----------------------------------------------------------------------------
 * The move as a timeline: Before · First day · First week · First month ·
 * Established · Leaving. The current stage is open and the others are folded,
 * so a student three weeks out sees only what is easier from home, and one who
 * landed yesterday sees the supermarket, not a visa form.
 *
 * Under the timeline: the first-week plan, one thing a day, built from this
 * student's own scored rows the moment onboarding finished.
 *
 * Every official task links to a verified `official_facts` row with its source
 * and checked date. Where no verified row exists it says so.
 * ============================================================================
 */

const TIMELINE: { stage: LifeStage; label: string; phase: ArrivalPhase | null }[] = [
  { stage: "before-arrival", label: "Before arrival", phase: "before" },
  { stage: "first-24h", label: "First day", phase: "first-24h" },
  { stage: "first-week", label: "First week", phase: "first-week" },
  { stage: "first-month", label: "First month", phase: "first-month" },
  { stage: "established", label: "Established", phase: null },
  { stage: "leaving", label: "Leaving", phase: null },
];

export default async function ArrivalPage() {
  const viewer = await requireViewer();
  const now = requestDate();
  const stage = viewer.stage.stage;
  const social = !viewer.profile.socialGoals.includes("private");
  const housing = viewer.move?.housing ?? "unknown";

  const money$ = await loadMoney(viewer.user.id, viewer.city.timezone, now);
  const context = await loadRecommendContext({
    userId: viewer.user.id,
    profile: viewer.profile,
    budgetCents: money$.unset ? null : money$.reading.safeTodayCents,
    now,
  });

  const [done, facts, places, freeEvents] = await Promise.all([
    findMany("arrival", (row) => row.userId === viewer.user.id),
    findMany("officialFacts", (row) => row.countryCode === viewer.city.countryCode && (row.citySlug === null || row.citySlug === viewer.profile.citySlug)),
    loadPlaces(context),
    loadScoredEvents(viewer.user.id, context, { when: "week", freeOnly: true }),
  ]);

  const doneIds = new Set(done.map((row) => row.taskId));

  const sourceFor = (taskId: string) => {
    const topicByTask: Record<string, string> = {
      "residency-requirements": "residency",
      "healthcare-cover": "healthcare",
      registration: "registration",
      "transport-card": "transport",
      "emergency-numbers": "emergency",
      "check-enrolment": "university",
    };
    const topic = topicByTask[taskId];
    const fact = topic ? facts.find((row) => row.topic === topic) : undefined;
    return fact ? { name: fact.sourceName, url: fact.sourceUrl, checked: factFreshness(fact).label } : null;
  };

  const buildPhase = (phase: ArrivalPhase): TaskView[] =>
    orderByBlocking(arrivalTasks.filter((task) => task.phase === phase))
      .filter((task) => (task.social ? social : true))
      .filter((task) => (task.housing ? task.housing.includes(housing) : true))
      .map((task) => ({
        id: task.id,
        label: task.label,
        detail: task.detail,
        effort: task.effort,
        href: task.href,
        official: task.official,
        unblocksCount: task.unblocks?.length ?? 0,
        done: doneIds.has(task.id),
        source: task.official ? sourceFor(task.id) : null,
      }));

  const currentIndex = TIMELINE.findIndex((entry) => entry.stage === stage);
  const activePhases = new Set(phasesForStage(stage));

  const startsOn = viewer.profile.arrivingOn ? new Date(viewer.profile.arrivingOn) : new Date(viewer.profile.createdAt);
  const week = firstWeekPlan({ startsOn, places: places.places, freeEvents, doneTaskIds: doneIds, social, cityName: viewer.city.name });

  const allTasks = TIMELINE.flatMap((entry) => (entry.phase ? buildPhase(entry.phase) : []));
  const completed = allTasks.filter((task) => task.done).length;
  /* One phrase hint, for the next open task only. A hint under every row would
     be a second feature competing with the checklist on its own screen. */
  const nextOpen = allTasks.find((task) => !task.done) ?? null;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="flex items-start gap-4">
        <MascotArt state="arrival" accessory="backpack" className="size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">Arrival Mode</p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">
            {stage === "before-arrival" ? `Your move to ${viewer.city.name}` : stage === "leaving" ? `Leaving ${viewer.city.name}` : `Settling into ${viewer.city.name}`}
          </h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            {viewer.stage.daysUntilArrival !== null && viewer.stage.daysUntilArrival > 0
              ? `${viewer.stage.daysUntilArrival} days out. Some of this is much easier from home.`
              : stage === "first-24h" || stage === "first-week"
                ? "First week? Start here. Ordered so the things that unblock other things come first."
                : "Ordered so the things that unblock other things come first."}
          </p>
        </div>
      </header>

      {/* ---- timeline ------------------------------------------------------- */}
      <ol className="mt-6 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar sm:mx-0 sm:px-0" aria-label="Move timeline">
        {TIMELINE.map((entry, index) => {
          const isCurrent = index === currentIndex;
          const isPast = index < currentIndex;
          return (
            <li key={entry.stage} className="shrink-0">
              <a
                href={entry.phase ? `#${entry.phase}` : entry.stage === "leaving" ? "/leaving" : "#first-week-plan"}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-medium",
                  isCurrent ? "bg-ink-950 text-paper" : isPast ? "bg-mint-soft text-mint-deep" : "bg-white text-ink-500 ring-1 ring-ink-950/8",
                )}
              >
                {isPast ? <Check className="size-3.5" /> : null}
                {entry.label}
              </a>
            </li>
          );
        })}
      </ol>

      <p className="tnum mt-3 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
        {completed} of {allTasks.length} done
      </p>

      {/* ---- phases: current open, others folded ---------------------------- */}
      {nextOpen ? <PhraseHint viewer={viewer} context={{ kind: "arrival", taskKey: nextOpen.id }} /> : null}

      <div className="mt-6 space-y-4">
        {TIMELINE.filter((entry) => entry.phase).map((entry) => {
          const phase = entry.phase!;
          const tasks = buildPhase(phase);
          if (tasks.length === 0) return null;
          const open = activePhases.has(phase);
          const doneHere = tasks.filter((task) => task.done).length;

          return (
            <details key={phase} id={phase} open={open} className="group rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.0625rem] font-semibold text-ink-950">{phaseMeta[phase].label}</span>
                  <span className="mt-0.5 block text-[0.875rem] text-ink-500">{phaseMeta[phase].blurb}</span>
                </span>
                <span className="tnum shrink-0 font-mono text-[0.75rem] text-ink-400">{doneHere}/{tasks.length}</span>
                <ArrowRight className="size-4 shrink-0 text-ink-300 transition-transform group-open:rotate-90" />
              </summary>
              <div className="px-5 pb-5">
                <TaskList tasks={tasks} />
              </div>
            </details>
          );
        })}
      </div>

      {/* ---- first week plan ------------------------------------------------ */}
      {stage !== "leaving" && stage !== "established" ? (
        <section id="first-week-plan" className="mt-8">
          <h2 className="text-[1.0625rem] font-semibold text-ink-950">Your first week</h2>
          <p className="mt-0.5 mb-3 text-[0.875rem] text-ink-500">One thing a day, from your own picks. Built the moment you finished setup.</p>
          <ol className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            {week.map((day) => (
              <li key={day.offset} className={cn("flex items-start gap-4 border-b border-ink-100 px-5 py-3.5 last:border-0", day.done && "bg-paper-2/60")}>
                <span className="w-16 shrink-0">
                  <span className="block font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{day.label}</span>
                  <span className="block text-[0.75rem] text-ink-400">{fmtWeekdayDay(day.dateIso, viewer.city.timezone)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={day.href} className={cn("block text-[0.9375rem] font-medium hover:underline", day.done ? "text-ink-400 line-through" : "text-ink-900")}>{day.title}</Link>
                  <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-500">{day.detail}</span>
                </span>
                {day.done ? <Check className="mt-1 size-4 shrink-0 text-mint-deep" /> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {!viewer.entitlements.can.aiArrivalPlan && stage !== "established" ? (
        <div className="mt-6">
          <Upsell
            feature="aiArrivalPlan"
            line={`The checklist above is the same for everyone in ${viewer.city.name}. Plus orders it for your situation — ${housing === "searching" ? "still looking for housing" : housing === "temporary" ? "in temporary housing" : "your housing, nationality and start date"} — with real lead times.`}
          />
        </div>
      ) : null}

      <p className="mt-8 flex items-start gap-2 rounded-xl bg-paper-2 px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-600">
        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
        Anything about visas, residency, healthcare or tax links to the official source with the date it was last checked. Requirements vary by nationality, and we will not guess at yours.
      </p>
    </div>
  );
}
