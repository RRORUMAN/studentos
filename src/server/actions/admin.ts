"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { tierOrder } from "@/config/entitlements";
import { cityDirectory } from "@/data/cities";
import { nowIso, remove, transaction } from "@/server/db";
import { flagMeta } from "@/server/queries/settings";
import { requireAdmin } from "@/server/viewer";

/**
 * ============================================================================
 * ADMIN ACTIONS
 * ----------------------------------------------------------------------------
 * Every one calls `requireAdmin` first, which redirects non-admins away. The
 * admin surface is the only writer of `adminSettings`, and every value is
 * validated against a closed vocabulary before it is stored.
 * ============================================================================
 */



/** Last validation problem, shown once on the admin page and then cleared. */
async function note(message: string | null): Promise<void> {
  await put("admin.lastError", message);
}

async function put(key: string, value: string | null): Promise<void> {
  if (value === null) {
    await remove("adminSettings", (row) => row.key === key);
    return;
  }
  await transaction((db) => {
    const index = db.adminSettings.findIndex((row) => row.key === key);
    const row = { key, value, updatedAt: nowIso() };
    if (index === -1) db.adminSettings.push(row);
    else db.adminSettings[index] = row;
  });
}

export async function setCityStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({
      slug: z.string().min(1),
      status: z.enum(["default", "coming-soon", "beta", "live", "high-density"]),
    })
    .safeParse({ slug: formData.get("slug"), status: formData.get("status") });
  if (!parsed.success) return note("Unknown status.");
  if (!cityDirectory.some((city) => city.slug === parsed.data.slug)) return note("Unknown city.");

  await put(`city.${parsed.data.slug}.status`, parsed.data.status === "default" ? null : parsed.data.status);
  await note(null);
  revalidatePath("/admin");
}

export async function setAiQuota(formData: FormData): Promise<void> {
  await requireAdmin();
  const plan = String(formData.get("plan") ?? "");
  const raw = String(formData.get("value") ?? "").trim();
  if (!tierOrder.includes(plan as (typeof tierOrder)[number])) return note("Unknown plan.");

  if (raw === "") {
    await put(`quota.aiAsksPerWeek.${plan}`, null);
  } else if (raw === "null" || raw.toLowerCase() === "unlimited") {
    await put(`quota.aiAsksPerWeek.${plan}`, "null");
  } else {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100_000) return note("Enter a whole number, or leave blank for the default.");
    await put(`quota.aiAsksPerWeek.${plan}`, String(Math.round(value)));
  }
  await note(null);
  revalidatePath("/admin");
}

export async function setFlag(formData: FormData): Promise<void> {
  await requireAdmin();
  const flag = String(formData.get("flag") ?? "");
  const state = String(formData.get("state") ?? "");
  if (!(flag in flagMeta)) return note("Unknown flag.");
  if (state !== "on" && state !== "off" && state !== "default") return note("Unknown state.");

  await put(`flag.${flag}`, state === "default" ? null : state);
  await note(null);
  revalidatePath("/admin");
}
