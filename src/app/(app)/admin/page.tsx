import type { Metadata } from "next";

import { AiControls, AiToolList, CityStatusControls, FlagControls, QuotaControls } from "@/components/app/admin-controls";
import { Meter } from "@/components/ui/primitives";
import { Delta, FunnelBars, Sparkline } from "@/components/app/admin-charts";
import { type AiSettingKey, aiSettingMeta } from "@/config/ai";
import { upgradeTriggerMeta, type UpgradeTrigger } from "@/config/entitlements";
import { cityDirectory } from "@/data/cities";
import type { CityStatus } from "@/data/types";
import { providerHealth } from "@/server/work/providers";
import { loadAdminMetrics, loadUnmetNeeds, loadUpgradeTriggerStats } from "@/server/queries/admin";
import { loadInfrastructure } from "@/server/queries/infrastructure";
import { aiConfig, degradedCopy, spendSince } from "@/server/ai/config";
import { toolMeta, type ToolName, toolSchemas } from "@/server/ai/tools";
import { type FlagName, flagMeta, loadSettings } from "@/server/queries/settings";
import { requireAdmin } from "@/server/viewer";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * ADMIN
 * ----------------------------------------------------------------------------
 * The operating dashboard, the Feature Lab, and the controls that change the
 * product without a deploy: city status, AI allowances, feature flags.
 *
 * The north star is weekly useful outcomes per active user. DAU sits below it
 * and deliberately smaller. The AI block answers the margin question directly:
 * `Tier 0 share` is the proportion of work served with no model call.
 * ============================================================================
 */
export default async function AdminPage() {
  await requireAdmin();

  const [metrics, needs, triggers, settings, ai, health, infrastructure] = await Promise.all([
    loadAdminMetrics(),
    loadUnmetNeeds(),
    loadUpgradeTriggerStats(),
    loadSettings(),
    aiConfig(),
    providerHealth(),
    loadInfrastructure(),
  ]);

  const dayStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())).toISOString();
  const spentToday = await spendSince(dayStart);
  const aiValues = Object.fromEntries(
    (Object.keys(aiSettingMeta) as AiSettingKey[]).map((key) => [key, settings.get(key)]),
  ) as Partial<Record<AiSettingKey, string>>;

  const usersByCity = new Map(metrics.cities.map((row) => [row.citySlug, row.users]));
  const cityRows = cityDirectory
    .filter((city) => city.deep || usersByCity.has(city.slug))
    .map((city) => {
      const override = settings.get(`city.${city.slug}.status`);
      return {
        slug: city.slug,
        name: city.name,
        users: usersByCity.get(city.slug) ?? 0,
        codeStatus: city.status,
        override:
          override === "coming-soon" || override === "beta" || override === "live" || override === "high-density"
            ? (override as CityStatus)
            : null,
      };
    });

  const quotaOverrides = Object.fromEntries(
    ["free", "plus", "pro", "max"].map((plan) => [plan, settings.get(`quota.aiAsksPerWeek.${plan}`)]),
  ) as Partial<Record<string, string>>;

  const lastError = settings.get("admin.lastError") ?? null;

  const flagStates = Object.fromEntries(
    (Object.keys(flagMeta) as FlagName[]).map((flag) => {
      const value = settings.get(`flag.${flag}`);
      return [flag, value === "on" || value === "off" ? value : "default"];
    }),
  ) as Record<FlagName, "on" | "off" | "default">;

  const blockers = infrastructure.blockers.length;

  return (
    <div className="page py-6 sm:py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.14em] text-ink-400">Founder console</p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">Admin</h1>
        </div>
        <p className="max-w-[40ch] text-[0.9375rem] text-ink-500">
          What is actually happening, what students could not find, and the dials.
        </p>
      </header>

      {/* ---- the console ----------------------------------------------------
           Dark, because this is the one screen in the product that is for the
           operator rather than the student. It borrows the console surface the
           app already uses for the map and the product shell, so it reads as
           part of StudentOS rather than a dashboard bolted to the side. */}
      <section
        className="overflow-hidden rounded-2xl bg-linear-to-b from-console-2 to-console text-white shadow-[var(--shadow-console)] ring-1 ring-white/8"
        data-surface="dark"
      >
        <div className="grid gap-7 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:gap-12">
          <div>
            <p className="font-mono text-micro uppercase tracking-[0.14em] text-signal">North star</p>
            <p className="tnum mt-2.5 font-mono text-[3.25rem] leading-[0.9] font-semibold tracking-tight">
              {metrics.outcomes.perActiveUser}
            </p>
            <p className="mt-2.5 max-w-[36ch] text-[0.9375rem] leading-relaxed text-white/65">
              Useful outcomes per active user, this week. <span className="tnum">{metrics.outcomes.weekly}</span>{" "}
              across <span className="tnum">{metrics.users.wau}</span> weekly actives. Not DAU &mdash; a student
              who opens the app forty times and gets nothing is a failure a session metric scores as a triumph.
            </p>
            {metrics.outcomes.byKind.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {metrics.outcomes.byKind.slice(0, 6).map((entry) => (
                  <li
                    key={entry.kind}
                    className="rounded-full bg-white/8 px-2.5 py-1 text-[0.8125rem] text-white/75 ring-1 ring-white/10"
                  >
                    {entry.kind.replace(/-/g, " ")}{" "}
                    <span className="tnum font-semibold text-white">{entry.count}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-col justify-end gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono text-micro uppercase tracking-[0.1em] text-white/45">Outcomes &middot; last 28 days</p>
              <p className="tnum font-mono text-[0.9375rem] font-semibold text-white/85">
                {metrics.series.outcomes.reduce((sum, point) => sum + point.value, 0)}
              </p>
            </div>
            <Sparkline points={metrics.series.outcomes} label="Useful outcomes per day" onDark />

            <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-3">
              <p className="font-mono text-micro uppercase tracking-[0.1em] text-white/45">Students active per day</p>
              <p className="tnum font-mono text-[0.9375rem] font-semibold text-white/85">{metrics.users.dau}</p>
            </div>
            <Sparkline points={metrics.series.active} label="Students with at least one outcome that day" onDark />
          </div>
        </div>

        {/* Launch readiness, read from the running process. The first thing this
            page owes a founder is whether the product is safe to show anyone. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/10 bg-black/20 px-5 py-3 sm:px-6">
          <p className="flex items-center gap-2 font-mono text-micro uppercase tracking-[0.1em]">
            <span
              aria-hidden
              className={cn("inline-block size-1.5 rounded-full", blockers === 0 ? "bg-mint" : "bg-pulse")}
            />
            <span className={blockers === 0 ? "text-mint" : "text-pulse"}>
              {blockers === 0 ? "No configuration blockers" : `${blockers} blocking a public launch`}
            </span>
          </p>
          <p className="text-[0.8125rem] text-white/55">
            {blockers === 0
              ? "Configuration only \u2014 this says nothing about whether the cities have real content."
              : infrastructure.blockers.map((service) => service.label).join(" \u00b7 ")}
          </p>
        </div>
      </section>

      {/* ---- growth ---------------------------------------------------------- */}
      <SectionHead
        title="Growth"
        detail="New accounts, against the previous window of the same length. Four weeks of daily numbers with the empty days kept &mdash; a chart drawn only from the days something happened reads as steady through a dead week."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <p className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">New today</p>
          <p className="tnum mt-1.5 font-mono text-[1.75rem] leading-none font-semibold text-ink-950">
            {metrics.growth.today}
          </p>
          <div className="mt-3">
            <Sparkline points={metrics.series.signups} label="Sign-ups per day" />
          </div>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <p className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">Last 7 days</p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <p className="tnum font-mono text-[1.75rem] leading-none font-semibold text-ink-950">
              {metrics.growth.last7}
            </p>
            <Delta value={metrics.growth.delta7} />
          </div>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
            <span className="tnum">{metrics.users.wau}</span> active this week,{" "}
            <span className="tnum">{metrics.users.mau}</span> this month.
          </p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <p className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">Last 28 days</p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <p className="tnum font-mono text-[1.75rem] leading-none font-semibold text-ink-950">
              {metrics.growth.last28}
            </p>
            <Delta value={metrics.growth.delta28} />
          </div>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
            <span className="tnum">{metrics.users.total}</span> accounts in total.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="D1 retention" value={`${metrics.retention.d1}%`} hint="came back and did something" />
        <Stat label="D7 retention" value={`${metrics.retention.d7}%`} />
        <Stat label="D30 retention" value={`${metrics.retention.d30}%`} />
        <Stat label="Paid conversion" value={`${metrics.revenue.conversion}%`} />
      </div>

      {/* ---- funnel ---------------------------------------------------------- */}
      <SectionHead
        title="Where accounts stop"
        detail={'Every step is counted from a real column. The first is \u201caccount created\u201d rather than \u201cvisitor\u201d on purpose: nothing in this product records an anonymous visit, so a visitor row would be a number nobody could source.'}
      />
      <FunnelBars steps={metrics.funnel} />

      {/* ---- revenue ------------------------------------------------------- */}
      <section className="mt-9 border-t border-ink-200 pt-5">
        <h2 className="mb-3 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">Revenue</h2>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="rounded-xl border border-ink-950 bg-white p-5">
            <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">MRR</p>
            <p className="tnum mt-2 font-mono text-[2.25rem] leading-none font-semibold text-ink-950">
              {money(metrics.revenue.mrrCents / 100)}
            </p>
            <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink-500">
              <span className="tnum">{metrics.revenue.paidUsers}</span> paying of{" "}
              <span className="tnum">{metrics.users.total}</span>. Counted from subscription rows in good
              standing, at list price.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="On Plus" value={metrics.plans.plus} hint="€7.99 / month" />
            <Stat label="On Pro" value={metrics.plans.pro} hint="€9.99 / month" />
            <Stat label="On Max" value={metrics.plans.max} hint="€14.99 / month" />
            <Stat label="Free" value={metrics.plans.free} />
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Active subscriptions" value={metrics.subscriptions.active} />
          <Stat
            label="Past due"
            value={metrics.subscriptions.pastDue}
            tone={metrics.subscriptions.pastDue > 0 ? "warn" : undefined}
            hint="keeps access through Stripe's retries"
          />
          <Stat
            label="Cancelling"
            value={metrics.subscriptions.cancelling}
            tone={metrics.subscriptions.cancelling > 0 ? "warn" : undefined}
            hint="access until period end"
          />
          <Stat label="On annual" value={`${metrics.subscriptions.annualShare}%`} />
        </div>

        <p className="mt-3 rounded-lg border border-dashed border-ink-300 bg-paper-2/60 px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-500">
          <strong className="font-semibold text-ink-700">No MRR movement here, on purpose.</strong> New,
          expansion, contraction and churn cannot be read off these rows — a subscription carries its current
          state and nothing about how it got there. Inferring them would produce a churn figure precise enough
          to make a decision on and wrong. They arrive once the webhook has been writing an event log.
        </p>
      </section>

      {/* ---- upgrade triggers ---------------------------------------------- */}
      <section className="mt-9 border-t border-ink-200 pt-5">
        <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">Upgrade triggers</h2>
        <p className="mb-3.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-500">Which moments of intent were shown a value-first upsell, and how many of those students have since paid.</p>
        {triggers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-300 bg-paper-2/60 px-4 py-6 text-center text-[0.9375rem] text-ink-500">No triggers fired yet.</p>
        ) : (
          <table className="w-full overflow-hidden rounded-lg border border-ink-200 bg-white text-left text-[0.875rem]">
            <thead className="bg-paper-2 font-mono text-micro uppercase tracking-[0.08em] text-ink-500">
              <tr>
                <th className="px-4 py-2.5">Moment</th>
                <th className="px-4 py-2.5">Points at</th>
                <th className="px-4 py-2.5 text-right">Shown</th>
                <th className="px-4 py-2.5 text-right">Converted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {triggers.map((row) => (
                <tr key={row.trigger}>
                  <td className="px-4 py-2.5 text-ink-800">
                    <span className="block font-medium">{row.trigger.replace(/-/g, " ")}</span>
                    <span className="block text-[0.75rem] text-ink-500">{upgradeTriggerMeta[row.trigger as UpgradeTrigger]?.when ?? ""}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{row.feature}</td>
                  <td className="tnum px-4 py-2.5 text-right font-mono text-ink-600">{row.shown}</td>
                  <td className="tnum px-4 py-2.5 text-right font-mono text-ink-600">{row.converted} <span className="text-ink-400">({row.rate}%)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---- AI cost ------------------------------------------------------- */}
      <section className="mt-9 border-t border-ink-200 pt-5">
        <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">AI cost</h2>
        <p className="mb-3.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-500">Tier 0 is work served with no model call. If that share falls, the free tier stops paying for itself.</p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* A share of nothing is not zero. With no calls logged there is no
              ratio to report, and rendering 0% next to "below 70%" invents a
              problem out of an empty table — the reader chases a regression
              that has not happened. */}
          {metrics.ai.calls === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-300 bg-paper-2/60 p-5">
              <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Tier 0 share</p>
              <p className="mt-2 text-[1.0625rem] font-semibold text-ink-700">No model calls logged</p>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
                Nothing has called a model yet, so there is no share to report. This fills in once
                <code className="mx-1 rounded bg-ink-100 px-1 py-0.5 font-mono text-[0.8125rem]">ANTHROPIC_API_KEY</code>
                is set and a student asks something the parser cannot place.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "rounded-xl border bg-white p-5",
                metrics.ai.tierZeroShare >= 70 ? "border-mint-deep/30" : "border-amber-deep/35",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Tier 0 share</p>
                <p
                  className={cn(
                    "font-mono text-micro font-semibold uppercase tracking-[0.08em]",
                    metrics.ai.tierZeroShare >= 70 ? "text-mint-deep" : "text-amber-deep",
                  )}
                >
                  {metrics.ai.tierZeroShare >= 70 ? "healthy" : "below 70%"}
                </p>
              </div>
              <p className="tnum mt-2 font-mono text-[2.25rem] leading-none font-semibold text-ink-950">
                {metrics.ai.tierZeroShare}%
              </p>
              <Meter
                value={metrics.ai.tierZeroShare}
                accent={metrics.ai.tierZeroShare >= 70 ? "mint" : "amber"}
                label="Share of AI work served with no model call"
                className="mt-3"
              />
              <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink-500">
                Work served with no model call at all. Below 70%, something that should be arithmetic is
                calling a model.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Cache hit rate" value={`${metrics.ai.cacheHitRate}%`} />
            <Stat label="Calls logged" value={metrics.ai.calls} />
            <Stat label="Total cost" value={microsToMoney(metrics.ai.costMicros)} />
            <Stat label="Cost per user" value={microsToMoney(metrics.ai.costPerUserMicros)} />
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-ink-200 bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">Spend per day &middot; 28 days</p>
            <p className="tnum font-mono text-[0.9375rem] font-semibold text-ink-950">
              {microsToMoney(metrics.series.aiCostMicros.reduce((sum, point) => sum + point.value, 0))}
            </p>
          </div>
          <div className="mt-2">
            <Sparkline points={metrics.series.aiCostMicros} label="AI spend per day" unit="micros" />
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {metrics.ai.byOperation.length > 0 ? (
            <table className="w-full overflow-hidden rounded-lg border border-ink-200 bg-white text-left text-[0.875rem]">
              <thead className="bg-paper-2 font-mono text-micro uppercase tracking-[0.08em] text-ink-500">
                <tr>
                  <th className="px-4 py-2.5">Operation</th>
                  <th className="px-4 py-2.5 text-right">Calls</th>
                  <th className="px-4 py-2.5 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {metrics.ai.byOperation.map((row) => (
                  <tr key={row.operation}>
                    <td className="px-4 py-2.5 text-ink-800">{row.operation}</td>
                    <td className="tnum px-4 py-2.5 text-right font-mono text-ink-600">{row.calls}</td>
                    <td className="tnum px-4 py-2.5 text-right font-mono text-ink-600">{microsToMoney(row.costMicros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <table className="w-full overflow-hidden rounded-lg border border-ink-200 bg-white text-left text-[0.875rem]">
            <thead className="bg-paper-2 font-mono text-micro uppercase tracking-[0.08em] text-ink-500">
              <tr>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5 text-right">Calls</th>
                <th className="px-4 py-2.5 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {metrics.ai.byPlan.map((row) => (
                <tr key={row.plan}>
                  <td className="px-4 py-2.5 text-ink-800 capitalize">{row.plan}</td>
                  <td className="tnum px-4 py-2.5 text-right font-mono text-ink-600">{row.calls}</td>
                  <td className="tnum px-4 py-2.5 text-right font-mono text-ink-600">{microsToMoney(row.costMicros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- controls ------------------------------------------------------ */}
      {lastError ? (
        <p role="alert" className="mt-8 rounded-lg bg-pulse-soft px-4 py-3 text-[0.875rem] text-pulse-deep">
          {lastError}
        </p>
      ) : null}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">Cities</h2>
          <p className="mb-3.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-500">Launch, pause or promote a city. Overrides the status in code until cleared.</p>
          <CityStatusControls cities={cityRows} />
          <p className="mt-2 text-[0.75rem] text-ink-400">{cityDirectory.length} cities in the directory; {cityDirectory.filter((city) => city.deep).length} with full local data.</p>
        </div>
        <div className="space-y-6">
          <div>
            <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">AI allowance</h2>
            <p className="mb-3.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-500">Smart asks a week, per plan. Blank restores the default; &ldquo;unlimited&rdquo; removes the cap.</p>
            <QuotaControls overrides={quotaOverrides} />
          </div>
          <div>
            <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">Feature flags</h2>
            <p className="mb-3.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-500">Server-side. Reading, posting and joining are never behind a flag.</p>
            <FlagControls states={flagStates} />
          </div>
        </div>
      </section>

      {/* ---- AI configuration ---------------------------------------------- */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">AI configuration</h2>
          <p className="mb-3 text-[0.875rem] leading-relaxed text-ink-500">
            Provider, model per tier, ceilings and spend caps. Past a cap every answer falls back to the deterministic
            one, which is always correct — nothing breaks, it just reads plainer.
          </p>
          <AiControls
            values={aiValues}
            live={ai.live}
            degradedReason={ai.degradedReason ? degradedCopy[ai.degradedReason] : null}
            spentTodayMicros={spentToday}
            dailyCapMicros={ai.dailyCostCapMicros}
          />
        </div>
        <div>
          <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">What the AI can read</h2>
          <p className="mb-3 text-[0.875rem] leading-relaxed text-ink-500">
            The complete list. A model never touches the database — it receives the output of these, and nothing else.
          </p>
          <AiToolList tools={(Object.keys(toolSchemas) as ToolName[]).map((name) => toolMeta[name])} />
        </div>
      </section>

      {/* ---- feature lab ---------------------------------------------------- */}
      <section className="mt-9 border-t border-ink-200 pt-5">
        <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">Feature Lab</h2>
        <p className="mb-3 text-[0.875rem] leading-relaxed text-ink-500">What students asked for and did not get, aggregated by intent. Raw queries are never stored — this is demand without surveillance.</p>
        {needs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-300 bg-paper-2/60 px-4 py-8 text-center text-[0.9375rem] text-ink-500">No unmet needs recorded yet. They appear as students search for things we cannot answer.</p>
        ) : (
          <ul className="space-y-2.5">
            {needs.slice(0, 30).map((need) => (
              <li key={need.id} className="flex items-start gap-4 rounded-lg border border-ink-200 bg-white p-4">
                <span className="tnum shrink-0 rounded-md bg-ink-950 px-2.5 py-1 font-mono text-[0.875rem] font-semibold text-signal">{need.hits}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] font-medium text-ink-950">{need.label}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-500">{need.citySlug} · {need.gapLabel} — {need.gapAction}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold", need.gap === "missing-feature" ? "bg-pulse-soft text-pulse-deep" : need.gap === "missing-city" ? "bg-flow-soft text-flow-deep" : "bg-amber-soft text-amber-deep")}>
                  {need.gapLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- infrastructure -------------------------------------------------- */}
      <section className="mt-9 border-t border-ink-200 pt-5">
        <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">Services</h2>
        <p className="mb-3.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-500">
          What is connected in the process serving this page, read from the process rather than
          from a checklist. Each line says what it costs the product while it is like this, because
          &ldquo;not configured&rdquo; and &ldquo;students are losing their accounts&rdquo; are the
          same fact stated two ways and only one of them gets acted on.
        </p>

        {infrastructure.blockers.length > 0 ? (
          <p className="mb-3 rounded-lg border border-pulse-deep/25 bg-pulse-soft/60 p-4 text-[0.875rem] leading-relaxed text-ink-800">
            <span className="font-semibold">
              {infrastructure.blockers.length} thing
              {infrastructure.blockers.length === 1 ? "" : "s"} still block a public launch:
            </span>{" "}
            {infrastructure.blockers.map((service) => service.label).join(", ")}. PRODUCTION_SETUP.md
            has the steps for each.
          </p>
        ) : (
          <p className="mb-3 rounded-lg border border-ink-200 bg-white p-4 text-[0.875rem] leading-relaxed text-ink-800">
            Nothing on this list blocks a public launch. That is a statement about configuration
            only — it says nothing about whether the cities have real content or anyone has walked
            the product on a phone.
          </p>
        )}

        <ul className="space-y-2">
          {infrastructure.services.map((service) => (
            <li
              key={service.key}
              className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-ink-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold text-ink-950">{service.label}</p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-600">{service.state}</p>
                {service.consequence ? (
                  <p className="mt-1 text-[0.8125rem] text-ink-500">{service.consequence}</p>
                ) : null}
              </div>
              <p
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-micro font-semibold uppercase tracking-[0.08em]",
                  service.level === "ready" && "bg-mint-soft text-mint-deep",
                  service.level === "degraded" && "bg-amber-soft text-amber-deep",
                  service.level === "missing" && "bg-pulse-soft text-pulse-deep",
                )}
              >
                <span aria-hidden>
                  {service.level === "ready" ? "\u25cf" : service.level === "degraded" ? "\u25d0" : "\u25cb"}
                </span>
                {service.level === "ready" ? "Ready" : service.level === "degraded" ? "Degraded" : "Missing"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- work providers -------------------------------------------------- */}
      <section className="mt-9 border-t border-ink-200 pt-5">
        <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">Work providers</h2>
        <p className="mb-3.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-500">
          Every source Work knows about, configured or not. A provider that has been failing is the
          most useful thing this page can show, so failed runs are stored with the real error rather
          than logged and forgotten. There is no scraper here by design — a source that has not
          published a feed has not agreed to be republished.
        </p>
        <ul className="space-y-2">
          {health.map(({ provider, status, lastRun }) => (
            <li
              key={provider.slug}
              className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-ink-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-semibold text-ink-950">{provider.label}</p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-500">
                  {status.configured ? status.detail : status.missing}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "font-mono text-micro uppercase tracking-[0.08em]",
                    status.configured ? "text-ink-400" : "text-amber-deep",
                  )}
                >
                  {status.configured ? "Configured" : "Not configured"}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-600">
                  {lastRun
                    ? `${lastRun.ok ? "OK" : "Failed"} · ${lastRun.imported} in, ${lastRun.updated} updated${lastRun.error ? ` · ${lastRun.error}` : ""}`
                    : "Never synced"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- community ------------------------------------------------------ */}
      <section className="mt-9 border-t border-ink-200 pt-5">
        <h2 className="mb-3 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">Community</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Posts" value={metrics.community.posts} />
          <Stat label="Comments" value={metrics.community.comments} />
          <Stat label="Chat messages" value={metrics.community.chat} />
          <Stat label="Plans / joins" value={`${metrics.community.invites} / ${metrics.community.joins}`} />
        </div>
      </section>
    </div>
  );
}

/**
 * A section rule and its heading.
 *
 * The rule is the structure. A page built only from cards has no hierarchy —
 * every block claims the same weight, which is exactly what makes a dashboard
 * feel generated rather than designed.
 */
function SectionHead({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mt-9 mb-3.5 border-t border-ink-200 pt-5">
      <h2 className="text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">{title}</h2>
      {detail ? (
        <p className="mt-1 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-500">{detail}</p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4",
        tone === "good" ? "border-mint-deep/30" : tone === "warn" ? "border-amber-deep/35" : "border-ink-200",
      )}
    >
      <p className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">{label}</p>
      <p className="tnum mt-1.5 font-mono text-[1.5rem] leading-none font-semibold text-ink-950">{value}</p>
      {hint ? <p className="mt-1.5 text-[0.75rem] leading-snug text-ink-400">{hint}</p> : null}
    </div>
  );
}

function microsToMoney(micros: number): string {
  if (micros === 0) return "€0";
  if (micros < 10_000) return "<€0.01";
  return money(micros / 1_000_000);
}
