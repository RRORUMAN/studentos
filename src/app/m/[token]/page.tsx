import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Wordmark } from "@/components/brand/logo";
import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";
import { Meter } from "@/components/ui/primitives";
import { missionStepKindMeta } from "@/domain/missions";
import { getCity } from "@/data/cities";
import { loadSharedMission } from "@/server/queries/missions";
import { getViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shared mission",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * PUBLIC MISSION
 * ----------------------------------------------------------------------------
 * A mission its owner chose to share. Shows the steps, the prices and the
 * progress — never the owner's budget, never where they live, never who
 * else is in their chats. Taking it needs an account.
 * ============================================================================
 */
export default async function SharedMissionPage(props: PageProps<"/m/[token]">) {
  const { token } = await props.params;
  const [data, viewer] = await Promise.all([loadSharedMission(token), getViewer()]);
  if (!data) notFound();

  const { mission, steps, progress, totalCents, template, ownerName, ownerEmoji } = data;
  const city = getCity(mission.citySlug);
  const where = { currency: city?.currency.code ?? "EUR", locale: "en-IE" };
  const fmt = (cents: number) => money(cents / 100, where);

  return (
    <main id="main" className="relative flex flex-1 flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 text-ink-300/40 dotfield [mask-image:radial-gradient(70%_40%_at_50%_0%,black,transparent)]" />
      <div className="relative mx-auto w-full max-w-lg px-5 py-10">
        <Link href="/" className="inline-flex" aria-label={`${brand.name} home`}>
          <Wordmark />
        </Link>

        <header className="mt-8 flex items-start gap-4">
          <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl bg-signal-soft text-3xl">{mission.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
              {city?.name ?? "A mission"} · {progress.done} of {progress.total} done
            </p>
            <h1 className="mt-1 text-display-sm text-ink-950">{mission.title}</h1>
            {template ? <p className="mt-1 text-[0.9375rem] text-ink-600">{template.tagline}</p> : null}
            {ownerName ? <p className="mt-1.5 text-[0.875rem] text-ink-500">Shared by {ownerEmoji} {ownerName}</p> : null}
          </div>
        </header>

        <Meter value={progress.fraction * 100} accent="mint" className="mt-5" label="Progress" />

        <section className="mt-5 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
          <ol className="divide-y divide-ink-100">
            {steps.filter((step) => !step.skippedAt).map((step) => (
              <li key={step.id} className={cn("flex items-start gap-3 px-5 py-3.5", step.doneAt && "bg-paper-2/60")}>
                <span className="mt-0.5 w-5 shrink-0 text-center text-[0.8125rem]" aria-hidden>{step.doneAt ? "✓" : missionStepKindMeta[step.kind].emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[0.9375rem] font-medium", step.doneAt ? "text-ink-400 line-through" : "text-ink-900")}>{step.label}</p>
                  {step.detail ? <p className="mt-0.5 text-[0.8125rem] text-ink-500">{step.detail}</p> : null}
                </div>
                <span className={cn("tnum shrink-0 font-mono text-[0.9375rem] font-medium", step.priceCents === 0 ? "text-mint-deep" : "text-ink-900")}>
                  {step.priceCents === 0 ? "Free" : fmt(step.priceCents)}
                </span>
              </li>
            ))}
          </ol>
          {mission.budgetCents !== null ? (
            <div className="flex items-baseline justify-between border-t border-ink-100 bg-paper-2/60 px-5 py-3.5">
              <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-500">Total</span>
              <span className="tnum font-mono text-[1.25rem] font-semibold text-ink-950">
                {totalCents === 0 ? "Free" : fmt(totalCents)}
                <span className="ml-1.5 text-[0.8125rem] font-normal text-ink-500">of {fmt(mission.budgetCents)}</span>
              </span>
            </div>
          ) : null}
        </section>

        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-ink-950 p-5 text-paper">
          <MascotArt state="explorer" className="size-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-semibold">{viewer ? "Take this mission yourself." : `Made with ${brand.name}.`}</p>
            <p className="mt-0.5 text-[0.8125rem] text-paper/70">
              {viewer ? "It rebuilds from real places and events in your own city." : "Missions are built from real places and prices, around a student budget. Free to join."}
            </p>
          </div>
          <ButtonLink href={viewer ? `/missions/preview/${mission.templateKey}` : `/signup?next=/m/${token}`} variant="signal" size="sm" className="shrink-0">
            {viewer ? "Take it" : "Join free"}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
