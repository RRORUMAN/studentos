import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StartMissionButton } from "@/components/app/mission-steps";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Meter } from "@/components/ui/primitives";
import { fillBudget } from "@/domain/missions";
import { cityRatio } from "@/server/engines/missions";
import { loadMissionCatalogue, loadMissions } from "@/server/queries/missions";
import { requireViewer } from "@/server/viewer";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Smart Missions",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * SMART MISSIONS
 * ----------------------------------------------------------------------------
 * Recommendations turned into something to do: a short, priced, ordered set
 * of steps built from the city's real rows, with progress. Active missions
 * first, then the catalogue for this stage.
 * ============================================================================
 */
export default async function MissionsPage() {
  const viewer = await requireViewer();
  const [{ active, done }, catalogue] = await Promise.all([loadMissions(viewer.user.id), loadMissionCatalogue(viewer)]);
  const ratio = cityRatio(viewer.city.anchors);
  const fmt = (cents: number) => money(cents / 100, viewer.currency);
  const available = catalogue.filter((entry) => entry.active === null);

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="flex items-start gap-4">
        <MascotArt state="explorer" accessory="map-pin" className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">Smart Missions</p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">Don&rsquo;t just get recommendations. Get a plan.</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            Each one is built from real places and events in {viewer.city.name}, priced in {viewer.city.currency.code}, with a budget that adds up.
          </p>
        </div>
      </header>

      {/* ---- active --------------------------------------------------------- */}
      {active.length > 0 ? (
        <section className="mt-6" aria-labelledby="active-heading">
          <h2 id="active-heading" className="mb-2 px-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">In progress</h2>
          <ul className="space-y-3">
            {active.map(({ mission, progress, totalCents, steps }) => (
              <li key={mission.id}>
                <Link
                  href={`/missions/${mission.id}`}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]"
                >
                  <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-signal-soft text-2xl">{mission.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1rem] font-semibold text-ink-950">{mission.title}</span>
                    <span className="mt-0.5 block text-[0.8125rem] text-ink-500">
                      {progress.done} of {progress.total} done · {steps.filter((s) => !s.skippedAt).length} steps
                      {mission.budgetCents !== null ? ` · ${fmt(totalCents)} of ${fmt(mission.budgetCents)}` : ""}
                    </span>
                    <Meter value={progress.fraction * 100} accent="mint" className="mt-2" label={`${mission.title} progress`} />
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- catalogue ------------------------------------------------------ */}
      <section className="mt-6" aria-labelledby="catalogue-heading">
        <h2 id="catalogue-heading" className="mb-2 px-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
          {active.length > 0 ? "Start another" : "Pick one"}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {available.map(({ template }) => {
            const budget = template.budgetCents === null ? null : Math.round((template.budgetCents * ratio) / 50) * 50;
            return (
              <li key={template.key} className="flex flex-col rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper-2 text-xl">{template.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[1rem] font-semibold text-ink-950">
                      {fillBudget(template.title, budget, fmt)}
                    </h3>
                    <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-500">
                      {fillBudget(template.tagline, budget, fmt)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-micro uppercase tracking-[0.08em] text-ink-400">
                  <span>{template.steps.length} steps</span>
                  <span>{template.durationDays === 1 ? "1 day" : `${template.durationDays} days`}</span>
                  {budget !== null ? <span className={cn(budget === 0 && "text-mint-deep")}>{budget === 0 ? "Free" : `Under ${fmt(budget)}`}</span> : null}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <StartMissionButton templateKey={template.key} size="sm" label="Start" />
                  <Link href={`/missions/preview/${template.key}`} className="text-[0.8125rem] font-medium text-ink-500 hover:text-ink-950">
                    What&rsquo;s in it
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- done ----------------------------------------------------------- */}
      {done.length > 0 ? (
        <section className="mt-8" aria-labelledby="done-heading">
          <h2 id="done-heading" className="mb-2 px-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">Finished</h2>
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white ring-1 ring-ink-950/6">
            {done.map(({ mission, progress }) => (
              <li key={mission.id}>
                <Link href={`/missions/${mission.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper-2">
                  <span aria-hidden>{mission.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-ink-800">{mission.title}</span>
                  {mission.status === "completed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-mint-deep"><Check className="size-3" /> Done</span>
                  ) : (
                    <span className="text-[0.75rem] text-ink-400">{progress.done}/{progress.total} · stopped</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
