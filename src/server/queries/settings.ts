import "server-only";

import { cache } from "react";

import type { PlanKey } from "@/config/pricing";
import type { CityStatus } from "@/data/types";
import { findMany } from "@/server/db";

/**
 * ============================================================================
 * ADMIN SETTINGS
 * ----------------------------------------------------------------------------
 * A small key/value table an admin can edit without a deploy: city status
 * overrides, per-plan AI allowances, feature flags. Everything has a code
 * default; a row only exists when an admin changed something, so deleting the
 * row restores the default.
 *
 * Keys are namespaced strings. The four namespaces:
 *
 *   city.<slug>.status        CityStatus
 *   quota.aiAsksPerWeek.<plan> integer, or "null" for uncapped
 *   flag.<name>               "on" | "off"
 *   ai.<setting>              provider, models, ceilings and cost caps
 *
 * The AI **API key** is deliberately not one of them, and never will be: a
 * secret settable from a web form is a secret that ends up in a database
 * backup and a screen share. Keys come from the environment only.
 * ============================================================================
 */

export type FlagName = "trips" | "catchUp" | "studentsSay" | "anyoneDown";

export const flagMeta: Record<FlagName, { label: string; detail: string; defaultOn: boolean }> = {
  trips: { label: "Trip mode", detail: "Pro can open another city in Discover.", defaultOn: true },
  catchUp: { label: "Pulse catch-up", detail: "The five-things summary at the top of Pulse.", defaultOn: true },
  studentsSay: { label: "Students say", detail: "Pulse posts under an Ask answer.", defaultOn: true },
  anyoneDown: { label: "Anyone Down?", detail: "Creating new plans. Joining is never switched off.", defaultOn: true },
};

export const loadSettings = cache(async (): Promise<Map<string, string>> => {
  const rows = await findMany("adminSettings", () => true);
  return new Map(rows.map((row) => [row.key, row.value]));
});

export async function cityStatusOverride(slug: string): Promise<CityStatus | null> {
  const value = (await loadSettings()).get(`city.${slug}.status`);
  return value === "coming-soon" || value === "beta" || value === "live" || value === "high-density" ? value : null;
}

/** Weekly ask allowance override for a plan; undefined means use the code default. */
export async function quotaOverride(plan: PlanKey): Promise<number | null | undefined> {
  const value = (await loadSettings()).get(`quota.aiAsksPerWeek.${plan}`);
  if (value === undefined) return undefined;
  if (value === "null") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined;
}

export async function isFlagOn(flag: FlagName): Promise<boolean> {
  const value = (await loadSettings()).get(`flag.${flag}`);
  if (value === "on") return true;
  if (value === "off") return false;
  return flagMeta[flag].defaultOn;
}
