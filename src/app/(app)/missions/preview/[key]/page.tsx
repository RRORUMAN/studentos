import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StartMissionButton } from "@/components/app/mission-steps";
import { missionTemplate } from "@/config/missions";
import { missionStepKindMeta } from "@/domain/missions";
import { buildMission, cityRatio } from "@/server/engines/missions";
import { loadMissionCandidates } from "@/server/queries/missions";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mission preview",
  robots: { index: false, follow: false },
};

/**
 * What the mission would contain, built from today's rows, before starting it.
 * Nothing is written; starting it builds the same thing and saves it.
 */
export default async function MissionPreviewPage(props: PageProps<"/missions/preview/[key]">) {
  const viewer = await requireViewer();
  const { key } = await props.params;
  const template = missionTemplate(key);
  if (!template) notFound();

  const now = requestDate();
  const candidates = await loadMissionCandidates(viewer, now);
  const fmt = (cents: number) => money(cents / 100, viewer.currency);
  const built = buildMission({
    template,
    candidates,
    variant: { cheaper: false, social: false },
    now,
    timeZone: viewer.city.timezone,
    ratio: cityRatio(viewer.city.anchors),
    social: !viewer.profile.socialGoals.includes("private"),
    fmt,
  });

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href="/missions" className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        Missions
      </Link>

      <header className="flex items-start gap-4">
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl bg-paper-2 text-3xl">{template.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">Preview · built from today&rsquo;s rows</p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">{template.title}</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">{template.tagline}</p>
        </div>
      </header>

      <ol className="mt-5 divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        {built.steps.map((step) => (
          <li key={step.key} className="flex items-start gap-3 px-4 py-3.5">
            <span className="mt-0.5 shrink-0 text-[0.875rem]" aria-hidden>{missionStepKindMeta[step.kind].emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-medium text-ink-900">
                {step.label}
                {step.optional ? <span className="ml-1.5 font-mono text-micro uppercase tracking-[0.08em] text-ink-400">optional</span> : null}
              </p>
              {step.detail ? <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-500">{step.detail}</p> : null}
            </div>
            <span className={cn("tnum shrink-0 font-mono text-[0.9375rem] font-medium", step.priceCents === 0 ? "text-mint-deep" : "text-ink-900")}>
              {step.priceCents === 0 ? "Free" : fmt(step.priceCents)}
            </span>
          </li>
        ))}
        {built.budgetCents !== null ? (
          <li className="flex items-baseline justify-between bg-paper-2/60 px-4 py-3.5">
            <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-500">Total</span>
            <span className={cn("tnum font-mono text-[1.125rem] font-semibold", built.overBudget ? "text-pulse-deep" : "text-ink-950")}>
              {built.totalCents === 0 ? "Free" : fmt(built.totalCents)}
              <span className="ml-1.5 text-[0.8125rem] font-normal text-ink-500">of {fmt(built.budgetCents)}</span>
            </span>
          </li>
        ) : null}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <StartMissionButton templateKey={template.key} label="Start this mission" />
        <StartMissionButton templateKey={template.key} label="Start it cheaper" variant={{ cheaper: true }} size="sm" />
      </div>
    </div>
  );
}
