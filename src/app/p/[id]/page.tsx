import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlanItinerary } from "@/components/app/plan-itinerary";
import { Wordmark } from "@/components/brand/logo";
import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";
import { getCity, resolveCity } from "@/data/cities";
import { loadPlan } from "@/server/queries/plans";
import { getViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { fmtLongDay } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Shared plan",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * PUBLIC PLAN
 * ----------------------------------------------------------------------------
 * A plan its owner chose to share. Readable signed out; joining needs an
 * account. Shows the lines, the total and how many are in — never who they
 * are, never the owner's budget, never anything about where anyone lives.
 *
 * The lines render through the same `PlanItinerary` the signed-in screen uses,
 * with the internal links off, so a shared plan and the owner's plan can never
 * quietly disagree about a price.
 * ============================================================================
 */
export default async function PublicPlanPage(props: PageProps<"/p/[id]">) {
  const { id } = await props.params;
  const viewer = await getViewer();
  const data = await loadPlan(id, viewer?.user.id ?? null);
  if (!data || (!data.plan.shared && !data.mine && !data.member)) notFound();

  const { plan, owner, people } = data;
  const city = getCity(plan.citySlug);
  const context = resolveCity(plan.citySlug);
  const where = { currency: city?.currency.code ?? "EUR", locale: "en-IE" };
  const timeZone = context?.timezone ?? "UTC";

  return (
    <main id="main" className="relative flex flex-1 flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 text-ink-300/40 dotfield [mask-image:radial-gradient(70%_40%_at_50%_0%,black,transparent)]" />
      <div className="relative mx-auto w-full max-w-lg px-5 py-10">
        <Link href="/" className="inline-flex" aria-label={`${brand.name} home`}>
          <Wordmark />
        </Link>

        <header className="mt-8">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            {city?.name ?? context?.name ?? "A plan"}
            {plan.forDate ? ` · ${fmtLongDay(plan.forDate, timeZone)}` : ""}
          </p>
          <h1 className="mt-2 text-display-sm text-ink-950">{plan.title}</h1>
          <p className="mt-1 text-[0.9375rem] text-ink-500">
            {owner ? `Shared by ${owner.avatarEmoji} ${owner.displayName}` : "Shared plan"}
            {people > 1 ? ` · ${people} people in` : ""}
          </p>
        </header>

        <div className="mt-6">
          <PlanItinerary items={plan.items} where={where} links={false} />
        </div>

        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-ink-950 p-5 text-paper">
          <MascotArt state="social" className="size-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-semibold">{viewer ? "Say if you are in." : `Made with ${brand.name}.`}</p>
            <p className="mt-0.5 text-[0.8125rem] text-paper/70">
              {viewer ? "Join the plan, vote on the stops, and get the chat." : "Real places, real prices, built around a student budget. Free to join."}
            </p>
          </div>
          <ButtonLink href={viewer ? `/plans/${plan.id}` : `/signup?next=/plans/${plan.id}`} variant="signal" size="sm" className="shrink-0">
            {viewer ? "Open" : "Join free"}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
