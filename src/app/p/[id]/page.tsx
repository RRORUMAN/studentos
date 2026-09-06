import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Wordmark } from "@/components/brand/logo";
import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";
import { getCity } from "@/data/cities";
import { loadPlan } from "@/server/queries/plans";
import { getViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shared plan",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * PUBLIC PLAN
 * ----------------------------------------------------------------------------
 * A plan its owner chose to share. Readable signed out; joining needs an
 * account. Shows the lines and the total — never who is on it, never the
 * owner's budget, never anything about where anyone lives.
 * ============================================================================
 */
export default async function PublicPlanPage(props: PageProps<"/p/[id]">) {
  const { id } = await props.params;
  const viewer = await getViewer();
  const data = await loadPlan(id, viewer?.user.id ?? null);
  if (!data || (!data.plan.shared && !data.mine && !data.member)) notFound();

  const { plan, owner } = data;
  const city = getCity(plan.citySlug);
  const where = { currency: city?.currency.code ?? "EUR", locale: "en-IE" };
  const total = plan.items.reduce((sum, item) => sum + item.priceCents, 0);

  return (
    <main id="main" className="relative flex flex-1 flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 text-ink-300/40 dotfield [mask-image:radial-gradient(70%_40%_at_50%_0%,black,transparent)]" />
      <div className="relative mx-auto w-full max-w-lg px-5 py-10">
        <Link href="/" className="inline-flex" aria-label={`${brand.name} home`}>
          <Wordmark />
        </Link>

        <header className="mt-8">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            {city?.name ?? "A plan"}
            {plan.forDate ? ` · ${new Date(plan.forDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}` : ""}
          </p>
          <h1 className="mt-2 text-display-sm text-ink-950">{plan.title}</h1>
          {owner ? <p className="mt-1 text-[0.9375rem] text-ink-500">Shared by {owner.avatarEmoji} {owner.displayName}</p> : null}
        </header>

        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
          <ol className="divide-y divide-ink-100">
            {plan.items.map((item, index) => (
              <li key={`${item.title}-${index}`} className="flex items-start gap-3 px-5 py-3.5">
                <span className="tnum w-6 shrink-0 pt-0.5 font-mono text-[0.75rem] text-ink-400">{item.time || index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] font-medium text-ink-900">{item.title}</p>
                  {item.detail ? <p className="mt-0.5 text-[0.8125rem] text-ink-500">{item.detail}</p> : null}
                </div>
                <span className={cn("tnum shrink-0 font-mono text-[0.9375rem] font-medium", item.priceCents === 0 ? "text-mint-deep" : "text-ink-900")}>
                  {item.priceCents === 0 ? "Free" : money(item.priceCents / 100, where)}
                </span>
              </li>
            ))}
          </ol>
          <div className="flex items-baseline justify-between border-t border-ink-100 bg-paper-2/60 px-5 py-3.5">
            <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-500">Total</span>
            <span className="tnum font-mono text-[1.25rem] font-semibold text-ink-950">{total === 0 ? "Free" : money(total / 100, where)}</span>
          </div>
        </section>

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
