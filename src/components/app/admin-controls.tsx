import { type AiSettingKey, aiSettingMeta } from "@/config/ai";
import { setAiQuota, setAiSetting, setCityStatus, setFlag } from "@/server/actions/admin";
import { tierOrder } from "@/config/entitlements";
import { quotas } from "@/config/entitlements";
import { cityStatusLabel } from "@/data/cities";
import type { CityStatus } from "@/data/types";
import { type FlagName, flagMeta } from "@/server/queries/settings";
import { cn } from "@/lib/utils";

/**
 * Admin controls. Plain forms posting to server actions, so they work with
 * JavaScript off and every change is one explicit submit.
 */

const STATUSES: CityStatus[] = ["coming-soon", "beta", "live", "high-density"];

export function CityStatusControls({
  cities,
}: {
  cities: readonly { slug: string; name: string; users: number; codeStatus: CityStatus; override: CityStatus | null }[];
}) {
  return (
    <ul className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      {cities.map((city) => (
        <li key={city.slug} className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-4 py-2.5 last:border-0">
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium text-ink-900">{city.name}</span>
            <span className="block text-[0.75rem] text-ink-500">
              {city.users} {city.users === 1 ? "student" : "students"} · code: {cityStatusLabel[city.codeStatus]}
              {city.override ? ` · overridden` : ""}
            </span>
          </span>
          <form action={setCityStatus} className="flex items-center gap-2">
            <input type="hidden" name="slug" value={city.slug} />
            <select name="status" defaultValue={city.override ?? "default"} className="h-9 rounded-lg bg-paper-2 px-2.5 text-[0.8125rem] text-ink-900" aria-label={`Status for ${city.name}`}>
              <option value="default">Default</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>{cityStatusLabel[status]}</option>
              ))}
            </select>
            <button type="submit" className="rounded-full bg-ink-950 px-3 py-1.5 text-[0.8125rem] font-medium text-paper">Save</button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export function QuotaControls({ overrides }: { overrides: Partial<Record<string, string>> }) {
  return (
    <ul className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      {tierOrder.map((plan) => {
        const fallback = quotas[plan].aiAsksPerWeek;
        return (
          <li key={plan} className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-4 py-2.5 last:border-0">
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-ink-900 capitalize">{plan}</span>
              <span className="block text-[0.75rem] text-ink-500">Default {fallback === null ? "unlimited" : `${fallback} a week`}</span>
            </span>
            <form action={setAiQuota} className="flex items-center gap-2">
              <input type="hidden" name="plan" value={plan} />
              <input name="value" defaultValue={overrides[plan] ?? ""} placeholder="default" inputMode="numeric" aria-label={`Weekly asks for ${plan}`} className="tnum h-9 w-28 rounded-lg bg-paper-2 px-2.5 font-mono text-[0.8125rem] text-ink-900 placeholder:font-sans" />
              <button type="submit" className="rounded-full bg-ink-950 px-3 py-1.5 text-[0.8125rem] font-medium text-paper">Save</button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}

export function FlagControls({ states }: { states: Record<FlagName, "on" | "off" | "default"> }) {
  return (
    <ul className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      {(Object.keys(flagMeta) as FlagName[]).map((flag) => {
        const meta = flagMeta[flag];
        const current = states[flag];
        const effective = current === "default" ? meta.defaultOn : current === "on";
        return (
          <li key={flag} className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-4 py-2.5 last:border-0">
            <span className={cn("size-2 shrink-0 rounded-full", effective ? "bg-mint" : "bg-pulse")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-ink-900">{meta.label}</span>
              <span className="block text-[0.75rem] text-ink-500">{meta.detail}</span>
            </span>
            <form action={setFlag} className="flex items-center gap-2">
              <input type="hidden" name="flag" value={flag} />
              <select name="state" defaultValue={current} className="h-9 rounded-lg bg-paper-2 px-2.5 text-[0.8125rem] text-ink-900" aria-label={`${meta.label} state`}>
                <option value="default">Default ({meta.defaultOn ? "on" : "off"})</option>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
              <button type="submit" className="rounded-full bg-ink-950 px-3 py-1.5 text-[0.8125rem] font-medium text-paper">Save</button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* AI configuration                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Provider, models, ceilings and spend caps. The API key is not here and never
 * will be: a secret settable from a web form is a secret in a database backup.
 */
export function AiControls({
  values,
  live,
  degradedReason,
  spentTodayMicros,
  dailyCapMicros,
}: {
  values: Partial<Record<AiSettingKey, string>>;
  live: boolean;
  degradedReason: string | null;
  spentTodayMicros: number;
  dailyCapMicros: number;
}) {
  const capFraction = dailyCapMicros > 0 ? Math.min(1, spentTodayMicros / dailyCapMicros) : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 bg-paper-2/60 px-4 py-3">
        <span className={cn("size-2 shrink-0 rounded-full", live ? "bg-mint" : "bg-amber")} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-medium text-ink-900">
            {live ? "Calling a model" : "Deterministic answers only"}
          </span>
          <span className="block text-[0.75rem] text-ink-500">
            {degradedReason ?? "A key is set and no cap has been reached."}
          </span>
        </span>
        <span className="tnum shrink-0 text-right font-mono text-[0.75rem] text-ink-500">
          {Math.round(capFraction * 100)}% of today&rsquo;s cap
        </span>
      </div>

      <ul>
        {(Object.keys(aiSettingMeta) as AiSettingKey[]).map((key) => {
          const meta = aiSettingMeta[key];
          return (
            <li key={key} className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-4 py-2.5 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium text-ink-900">{meta.label}</span>
                <span className="block text-[0.75rem] text-ink-500">{meta.detail}</span>
              </span>
              <form action={setAiSetting} className="flex items-center gap-2">
                <input type="hidden" name="key" value={key} />
                {meta.kind === "toggle" ? (
                  <select
                    name="value"
                    defaultValue={values[key] ?? ""}
                    aria-label={meta.label}
                    className="h-9 rounded-lg bg-paper-2 px-2.5 text-[0.8125rem] text-ink-900"
                  >
                    <option value="">Default (on)</option>
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                ) : (
                  <input
                    name="value"
                    defaultValue={values[key] ?? ""}
                    placeholder="default"
                    inputMode={meta.kind === "number" ? "decimal" : "text"}
                    aria-label={meta.label}
                    className="tnum h-9 w-44 rounded-lg bg-paper-2 px-2.5 font-mono text-[0.8125rem] text-ink-900 placeholder:font-sans"
                  />
                )}
                <button type="submit" className="rounded-full bg-ink-950 px-3 py-1.5 text-[0.8125rem] font-medium text-paper">
                  Save
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-ink-100 px-4 py-3 text-[0.75rem] leading-relaxed text-ink-500">
        The API key is read from <span className="font-mono">AI_API_KEY</span> only. There is no field for it here on
        purpose. Blank restores the code or environment default. Cost caps are micro-euros: 12000000 is €12.
      </p>
    </div>
  );
}

/** The tools the AI layer can call. Printed so the claim is checkable. */
export function AiToolList({ tools }: { tools: readonly { label: string; detail: string }[] }) {
  return (
    <ul className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      {tools.map((tool) => (
        <li key={tool.label} className="border-b border-ink-100 px-4 py-2.5 last:border-0">
          <span className="block font-mono text-[0.8125rem] text-ink-900">{tool.label}</span>
          <span className="block text-[0.75rem] text-ink-500">{tool.detail}</span>
        </li>
      ))}
    </ul>
  );
}
