import { ArrowLeft, CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MissionActions, MissionSteps } from "@/components/app/mission-steps";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Meter } from "@/components/ui/primitives";
import { fillBudget } from "@/domain/missions";
import { findMany } from "@/server/db";
import { loadMission } from "@/server/queries/missions";
import { loadFriendIds } from "@/server/queries/social";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { daysUntil, fmtLongDay } from "@/lib/dates";
import { cn, money } from "@/lib/utils";
import { env } from "@/services/env";

export const metadata: Metadata = {
  title: "Mission",
  robots: { index: false, follow: false },
};

export default async function MissionPage(props: PageProps<"/missions/[id]">) {
  const viewer = await requireViewer();
  const { id } = await props.params;
  const data = await loadMission(id, viewer.user.id);
  if (!data) notFound();

  const now = requestDate();
  const { mission, steps, progress, totalCents, template } = data;
  const fmt = (cents: number) => money(cents / 100, viewer.currency);
  const social = !viewer.profile.socialGoals.includes("private");

  const friendIds = await loadFriendIds(viewer.user.id);
  const friends = friendIds.size > 0 ? await findMany("profiles", (row) => friendIds.has(row.userId)) : [];

  const priceLabels = Object.fromEntries(steps.map((step) => [step.id, step.priceCents === 0 ? "Free" : fmt(step.priceCents)]));
  const daysLeft = daysUntil(mission.dueAt, viewer.city.timezone, now);
  const over = mission.budgetCents !== null && totalCents > mission.budgetCents;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href="/missions" className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        Missions
      </Link>

      <header className="flex items-start gap-4">
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl bg-signal-soft text-3xl">{mission.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            {mission.status === "completed" ? "Completed" : mission.status === "abandoned" ? "Stopped" : daysLeft >= 0 ? `${daysLeft === 0 ? "Ends today" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}` : "Past its date"}
            {mission.variant.cheaper ? " · cheaper build" : ""}
            {mission.variant.social ? " · social build" : ""}
          </p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">{mission.title}</h1>
          {template ? <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">{fillBudget(template.tagline, mission.budgetCents, fmt)}</p> : null}
        </div>
      </header>

      {/* ---- progress and money --------------------------------------------- */}
      <section className="mt-5 rounded-2xl bg-ink-950 p-5 text-paper">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">Progress</p>
            <p className="tnum mt-1.5 font-display text-[2rem] leading-none font-semibold text-signal">
              {progress.done}<span className="text-paper/40">/{progress.total}</span>
            </p>
          </div>
          {mission.budgetCents !== null ? (
            <div>
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">Total</p>
              <p className={cn("tnum mt-1.5 font-display text-[2rem] leading-none font-semibold", over ? "text-pulse" : "text-paper")}>
                {totalCents === 0 ? "Free" : fmt(totalCents)}
              </p>
              <p className="mt-1 text-[0.75rem] text-paper/60">
                {over ? `over the ${fmt(mission.budgetCents)} cap` : mission.budgetCents === 0 ? "nothing to spend" : `of ${fmt(mission.budgetCents)}`}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-paper/55">Ends</p>
              <p className="mt-1.5 text-[1rem] font-semibold text-paper">{fmtLongDay(mission.dueAt, viewer.city.timezone)}</p>
            </div>
          )}
        </div>
        <Meter value={progress.fraction * 100} accent="signal" onDark className="mt-4" label="Mission progress" />
      </section>

      {mission.status === "completed" ? (
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-mint-soft/70 p-4 ring-1 ring-mint-deep/15">
          <MascotArt state="celebrating" className="size-12 shrink-0" />
          <p className="text-[0.9375rem] text-ink-800">Done. Properly. Start another from the missions list.</p>
        </div>
      ) : null}

      {/* ---- steps ---------------------------------------------------------- */}
      <section className="mt-5" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="mb-2 px-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">Steps</h2>
        <MissionSteps steps={steps} priceLabels={priceLabels} readOnly={mission.status !== "active"} />
        <p className="mt-2 flex items-start gap-2 px-1 text-[0.8125rem] text-ink-500">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
          Every named place or event is a real row from {viewer.city.name}. A step with no match stays open for you to pick one — nothing is invented to fill it.
        </p>
      </section>

      {/* ---- actions -------------------------------------------------------- */}
      <section className="mt-6" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="sr-only">Mission actions</h2>
        <MissionActions
          missionId={mission.id}
          shareToken={mission.shareToken}
          siteUrl={env.siteUrl ?? brand.url}
          variant={mission.variant}
          friends={friends.map((friend) => ({ userId: friend.userId, displayName: friend.displayName, avatarEmoji: friend.avatarEmoji }))}
          status={mission.status}
          social={social}
        />
      </section>
    </div>
  );
}
