"use server";

import { type UpgradeTrigger, upgradeTriggerMeta } from "@/config/entitlements";
import { findMany, insert, newId, nowIso } from "@/server/db";
import { planFor } from "@/server/entitlements";
import { currentUserId } from "@/server/viewer";

/**
 * ============================================================================
 * UPGRADE TRIGGERS
 * ----------------------------------------------------------------------------
 * Records the moment a value-first upsell was shown, so admin can see which
 * moments convert. Fire-and-forget: analytics must never break the screen that
 * produced it.
 *
 * A trigger is recorded at most once per user per week. It is also only
 * recorded for students who do not already have the feature — showing a Pro
 * user a Pro upsell is a bug, not a conversion event.
 * ============================================================================
 */

export async function recordUpgradeTrigger(trigger: UpgradeTrigger): Promise<boolean> {
  try {
    const userId = await currentUserId();
    if (!userId) return false;

    const { planHasFeature } = await import("@/config/entitlements");
    const plan = await planFor(userId);
    if (planHasFeature(plan, upgradeTriggerMeta[trigger].feature)) return false;

    const since = Date.now() - 7 * 86_400_000;
    const recent = await findMany(
      "upgradeTriggers",
      (row) => row.userId === userId && row.trigger === trigger && Date.parse(row.shownAt) >= since,
    );
    if (recent.length > 0) return false;

    await insert("upgradeTriggers", {
      id: newId(),
      userId,
      trigger,
      feature: upgradeTriggerMeta[trigger].feature,
      planAtTime: plan,
      shownAt: nowIso(),
    });
    return true;
  } catch {
    return false;
  }
}
