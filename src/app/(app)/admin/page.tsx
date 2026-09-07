import type { Metadata } from "next";

import { AiControls, AiToolList, CityStatusControls, FlagControls, QuotaControls } from "@/components/app/admin-controls";
import { type AiSettingKey, aiSettingMeta } from "@/config/ai";
import { upgradeTriggerMeta, type UpgradeTrigger } from "@/config/entitlements";
import { cityDirectory } from "@/data/cities";
import type { CityStatus } from "@/data/types";
import { loadAdminMetrics, loadUnmetNeeds, loadUpgradeTriggerStats } from "@/server/queries/admin";
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

  const [metrics, needs, triggers, settings, ai] = await Promise.all([
    loadAdminMetrics(),
    loadUnmetNeeds(),
    loadUpgradeTriggerStats(),
    loadSettings(),
    aiConfig(),
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

  return (
    <div className="page py-6 sm:py-8">
      <header className="mb-7">
        <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Admin</h1>
        <p className="mt-1.5 text-[0.9375rem] text-ink-500">What is actually happening, what students could not find, and the dials.</p>
      </header>

      {/* ---- north star ---------------------------------------------------- */}
      <section className="rounded-xl border border-ink-950 bg-white p-5">
        <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">North star</p>
        <p className="tnum mt-1.5 font-mono text-[2.5rem] leading-none font-semibold text-ink-950">{metrics.outcomes.perActiveUser}</p>
        <p className="mt-2 text-[0.9375rem] text-ink-600">
          Useful outcomes per active user, this week. <span className="tnum">{metrics.outcomes.weekly}</span> total across{" "}
          <span className="tnum">{metrics.users.wau}</span> weekly actives.
        </p>
        {metrics.outcomes.byKind.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {metrics.outcomes.byKind.map((entry) => (
              <li key={entry.kind} className="rounded-full bg-ink-100 px-3 py-1 text-[0.8125rem] text-ink-700">
                {entry.kind.replace(/-/g, " ")} <span className="tnum font-medium">{entry.count}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total users" value={metrics.users.total} />
        <Stat label="DAU" value={metrics.users.dau} />
        <Stat label="WAU" value={metrics.users.wau} />
        <Stat label="MAU" value={metrics.users.mau} />
        <Stat label="D1 retention" value={`${metrics.retention.d1}%`} />
        <Stat label="D7 retention" value={`${metrics.retention.d7}%`} />
        <Stat label="D30 retention" value={`${metrics.retention.d30}%`} />
        <Stat label="Paid conversion" value={`${metrics.revenue.conversion}%`} />
      </div>

      {/* ---- revenue ------------------------------------------------------- */}
      <section className="mt-7">
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">Revenue</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="MRR" value={money(metrics.revenue.mrrCents / 100)} />
          <Stat label="Paying" value={metrics.revenue.paidUsers} />
          <Stat label="Free" value={metrics.plans.free} />
          <Stat label="Plan split" value={`${metrics.plans.plus}/${metrics.plans.pro}/${metrics.plans.max}`} hint="Plus / Pro / Max" />
        </div>
      </section>

      {/* ---- upgrade triggers ---------------------------------------------- */}
      <section className="mt-7">
        <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Upgrade triggers</h2>
        <p className="mb-3 text-[0.875rem] text-ink-500">Which moments of intent were shown a value-first upsell, and how many of those students have since paid.</p>
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
      <section className="mt-7">
        <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">AI cost</h2>
        <p className="mb-3 text-[0.875rem] text-ink-500">Tier 0 is work served with no model call. If that share falls, the free tier stops paying for itself.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Tier 0 share" value={`${metrics.ai.tierZeroShare}%`} tone={metrics.ai.tierZeroShare >= 70 ? "good" : "warn"} />
          <Stat label="Cache hit rate" value={`${metrics.ai.cacheHitRate}%`} />
          <Stat label="Total cost" value={microsToMoney(metrics.ai.costMicros)} />
          <Stat label="Cost per user" value={microsToMoney(metrics.ai.costPerUserMicros)} />
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
          <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Cities</h2>
          <p className="mb-3 text-[0.875rem] text-ink-500">Launch, pause or promote a city. Overrides the status in code until cleared.</p>
          <CityStatusControls cities={cityRows} />
          <p className="mt-2 text-[0.75rem] text-ink-400">{cityDirectory.length} cities in the directory; {cityDirectory.filter((city) => city.deep).length} with full local data.</p>
        </div>
        <div className="space-y-6">
          <div>
            <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">AI allowance</h2>
            <p className="mb-3 text-[0.875rem] text-ink-500">Smart asks a week, per plan. Blank restores the default; &ldquo;unlimited&rdquo; removes the cap.</p>
            <QuotaControls overrides={quotaOverrides} />
          </div>
          <div>
            <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Feature flags</h2>
            <p className="mb-3 text-[0.875rem] text-ink-500">Server-side. Reading, posting and joining are never behind a flag.</p>
            <FlagControls states={flagStates} />
          </div>
        </div>
      </section>

      {/* ---- AI configuration ---------------------------------------------- */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">AI configuration</h2>
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
          <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">What the AI can read</h2>
          <p className="mb-3 text-[0.875rem] leading-relaxed text-ink-500">
            The complete list. A model never touches the database — it receives the output of these, and nothing else.
          </p>
          <AiToolList tools={(Object.keys(toolSchemas) as ToolName[]).map((name) => toolMeta[name])} />
        </div>
      </section>

      {/* ---- feature lab ---------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Feature Lab</h2>
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

      {/* ---- community ------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">Community</h2>
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

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "good" | "warn" }) {
  return (
    <div className={cn("rounded-lg border bg-white p-4", tone === "good" ? "border-mint-deep/25" : tone === "warn" ? "border-amber-deep/30" : "border-ink-200")}>
      <p className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">{label}</p>
      <p className="tnum mt-1 font-mono text-[1.375rem] leading-none font-semibold text-ink-950">{value}</p>
      {hint ? <p className="mt-1 text-[0.75rem] text-ink-400">{hint}</p> : null}
    </div>
  );
}

function microsToMoney(micros: number): string {
  if (micros === 0) return "€0";
  if (micros < 10_000) return "<€0.01";
  return money(micros / 1_000_000);
}
