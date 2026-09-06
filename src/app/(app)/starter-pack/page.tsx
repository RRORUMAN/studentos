import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MascotArt } from "@/components/mascot/mascot-art";
import { summarisePrices } from "@/domain/knowledge";
import { findMany } from "@/server/db";
import { loadDeals, loadPlaces, loadRecommendContext, loadScoredEvents } from "@/server/queries/discovery";
import { loadMoney } from "@/server/queries/money";
import { requireViewer } from "@/server/viewer";
import { money, walk } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Starter pack",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * STARTER PACK
 * ----------------------------------------------------------------------------
 * The one screen a student can open on day one and act on immediately.
 *
 * Everything here is the *single best* option for this student in each of a
 * handful of categories — not a list to browse. That is the point: on day one
 * the problem is not too few options, it is too many, and being handed one
 * supermarket and one lunch place is worth more than forty of each.
 *
 * Composed entirely from Tier 0 scoring. No model, no cost, instant.
 * ============================================================================
 */
export default async function StarterPackPage() {
  const viewer = await requireViewer();
  const where = viewer.currency;
  const money$ = await loadMoney(viewer.user.id);

  const context = await loadRecommendContext({
    userId: viewer.user.id,
    profile: viewer.profile,
    budgetCents: money$.unset ? null : money$.reading.safeTodayCents,
  });

  const [all, freeEvents, deals, prices] = await Promise.all([
    loadPlaces(context),
    loadScoredEvents(viewer.user.id, context, { when: "week", freeOnly: true }),
    loadDeals(viewer.profile.citySlug),
    findMany("priceObservations", (row) => row.citySlug === viewer.profile.citySlug),
  ]);

  /** Best scoring place carrying a given layer. */
  const best = (layer: string) => all.find((entry) => entry.item.layers.includes(layer as never));

  const picks = [
    { key: "groceries", label: "Your supermarket", scored: best("groceries") },
    { key: "cheap-food", label: "Lunch near campus", scored: best("cheap-food") },
    { key: "study", label: "Somewhere to work", scored: best("study") },
    { key: "fitness", label: "Gym", scored: best("fitness") },
    { key: "free", label: "Free thing to do", scored: best("free") },
    { key: "nightlife", label: "First night out", scored: best("nightlife") },
  ].filter((pick) => pick.scored);

  const lunch = summarisePrices(prices, "lunch");
  const basket = summarisePrices(prices, "weekly-basket");
  const topDeal = deals.find((deal) => deal.confidence === "verified") ?? deals[0];
  const firstFree = freeEvents[0];

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="flex items-start gap-4">
        <MascotArt state="explorer" className="size-16 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">
            Your {viewer.city.name} starter pack
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">
            One of each, picked for where you live and what you told us. Not a list to browse —
            somewhere to start.
          </p>
        </div>
      </header>

      {/* ---- what things cost --------------------------------------------- */}
      {lunch.confident || basket.confident ? (
        <section className="mt-7 rounded-xl border border-ink-200 bg-white p-5">
          <h2 className="text-[1.0625rem] font-semibold text-ink-950">What things cost here</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            {lunch.confident ? (
              <div>
                <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                  Lunch out
                </dt>
                <dd className="tnum mt-1 font-mono text-[1.125rem] font-semibold text-ink-950">
                  {money(lunch.lowCents / 100, where)}–{money(lunch.highCents / 100, where)}
                </dd>
              </div>
            ) : null}
            {basket.confident ? (
              <div>
                <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                  Weekly shop
                </dt>
                <dd className="tnum mt-1 font-mono text-[1.125rem] font-semibold text-ink-950">
                  {money(basket.lowCents / 100, where)}–{money(basket.highCents / 100, where)}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 text-[0.8125rem] text-ink-500">
            From {lunch.sampleSize + basket.sampleSize} student price reports, not an average of
            menu prices.
          </p>
        </section>
      ) : null}

      {/* ---- picks --------------------------------------------------------- */}
      <ul className="mt-4 space-y-3">
        {picks.map((pick) => (
          <li key={pick.key}>
            <Link
              href={`/discover/${pick.scored!.item.id}`}
              className="flex items-start gap-4 rounded-xl border border-ink-200 bg-white p-4 transition-colors hover:border-ink-300"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                  {pick.label}
                </p>
                <p className="mt-1 text-[1.0625rem] font-semibold text-ink-950">
                  {pick.scored!.item.name}
                </p>
                <p className="mt-1 text-[0.8125rem] text-ink-500">
                  {walk(pick.scored!.item.walkMinutes)} walk ·{" "}
                  {pick.scored!.item.price === null
                    ? pick.scored!.item.priceLabel
                    : money(pick.scored!.item.price, where)}
                </p>
                <p className="mt-1.5 text-[0.8125rem] leading-snug text-ink-600">
                  {pick.scored!.item.why}
                </p>
              </div>
              <ArrowRight className="mt-1 size-4 shrink-0 text-ink-400" />
            </Link>
          </li>
        ))}
      </ul>

      {/* ---- deal and event ------------------------------------------------ */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {topDeal ? (
          <section className="rounded-xl border border-amber-deep/20 bg-amber-soft/50 p-4">
            <p className="font-mono text-micro uppercase tracking-[0.1em] text-amber-deep">
              Worth setting up
            </p>
            <p className="mt-1 text-[1rem] font-semibold text-ink-950">{topDeal.title}</p>
            <p className="mt-1 text-[0.8125rem] text-ink-600">{topDeal.detail}</p>
            <p className="tnum mt-2 font-mono text-[0.8125rem] font-semibold text-amber-deep">
              {topDeal.value}
            </p>
          </section>
        ) : null}

        {firstFree ? (
          <Link
            href={`/events/${firstFree.item.id}`}
            className="rounded-xl border border-mint-deep/20 bg-mint-soft/50 p-4 transition-colors hover:border-mint-deep/35"
          >
            <p className="font-mono text-micro uppercase tracking-[0.1em] text-mint-deep">
              Free this week
            </p>
            <p className="mt-1 text-[1rem] font-semibold text-ink-950">{firstFree.item.title}</p>
            <p className="mt-1 text-[0.8125rem] text-ink-600">
              {firstFree.item.venue} ·{" "}
              {new Date(firstFree.item.startsAt).toLocaleDateString("en-GB", {
                weekday: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </Link>
        ) : null}
      </div>

      <Link
        href="/arrival"
        className="mt-6 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-ink-950 underline underline-offset-4"
      >
        See the rest of your move plan
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
