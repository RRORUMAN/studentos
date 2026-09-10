import "server-only";

import { cache } from "react";

import { missionTemplate, missionsForStage } from "@/config/missions";
import { type Mission, type MissionStep, type MissionTemplate, missionProgress, missionTotalCents } from "@/domain/missions";
import { findMany, findOne } from "@/server/db";
import type { MissionCandidates } from "@/server/engines/missions";
import { loadPlaces, loadRecommendContext, loadScoredEvents } from "@/server/queries/discovery";
import { loadMoney } from "@/server/queries/money";
import { loadOpenInvites } from "@/server/queries/plans";
import type { Viewer } from "@/server/viewer";

/**
 * ============================================================================
 * MISSIONS — queries
 * ----------------------------------------------------------------------------
 * I/O for missions: the student's own, the catalogue offered for their stage,
 * and the candidate rows the engine fills templates from.
 * ============================================================================
 */

export type MissionView = {
  mission: Mission;
  steps: MissionStep[];
  progress: ReturnType<typeof missionProgress>;
  totalCents: number;
  template: MissionTemplate | undefined;
};

function view(mission: Mission, steps: MissionStep[]): MissionView {
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  return {
    mission,
    steps: ordered,
    progress: missionProgress(ordered),
    totalCents: missionTotalCents(ordered),
    template: missionTemplate(mission.templateKey),
  };
}

export const loadMissions = cache(async (userId: string): Promise<{ active: MissionView[]; done: MissionView[] }> => {
  const missions = await findMany("missions", (row) => row.userId === userId);
  const ids = new Set(missions.map((row) => row.id));
  const steps = ids.size > 0 ? await findMany("missionSteps", (row) => ids.has(row.missionId)) : [];

  const views = missions
    .map((mission) => view(mission, steps.filter((step) => step.missionId === mission.id)))
    .sort((a, b) => b.mission.startedAt.localeCompare(a.mission.startedAt));

  return {
    active: views.filter((entry) => entry.mission.status === "active"),
    done: views.filter((entry) => entry.mission.status !== "active"),
  };
});

export async function loadMission(id: string, viewerId: string | null): Promise<MissionView | null> {
  const mission = await findOne("missions", (row) => row.id === id);
  if (!mission || mission.userId !== viewerId) return null;
  const steps = await findMany("missionSteps", (row) => row.missionId === id);
  return view(mission, steps);
}

/** A shared mission, by its public token. Never the owner's budget or home. */
export async function loadSharedMission(token: string): Promise<(MissionView & { ownerName: string | null; ownerEmoji: string | null }) | null> {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return null;
  const mission = await findOne("missions", (row) => row.shareToken === token);
  if (!mission) return null;
  const [steps, owner] = await Promise.all([
    findMany("missionSteps", (row) => row.missionId === mission.id),
    findOne("profiles", (row) => row.userId === mission.userId),
  ]);
  return { ...view(mission, steps), ownerName: owner?.displayName ?? null, ownerEmoji: owner?.avatarEmoji ?? null };
}

/** Templates offered to this student now, minus ones already active. */
export async function loadMissionCatalogue(viewer: Viewer): Promise<{ template: MissionTemplate; active: MissionView | null }[]> {
  const social = !viewer.profile.socialGoals.includes("private");
  const { active } = await loadMissions(viewer.user.id);
  return missionsForStage(viewer.stage.stage, social).map((template) => ({
    template,
    active: active.find((entry) => entry.mission.templateKey === template.key) ?? null,
  }));
}

/** The rows a template is filled from: scored places, this fortnight's events, open plans. */
export async function loadMissionCandidates(viewer: Viewer, now: Date): Promise<MissionCandidates> {
  const money$ = await loadMoney(viewer.user.id, viewer.city.timezone, now);
  const context = await loadRecommendContext({
    userId: viewer.user.id,
    profile: viewer.profile,
    budgetCents: money$.unset ? null : money$.reading.safeThisWeekCents,
    now,
  });
  const social = !viewer.profile.socialGoals.includes("private");
  const [places, events, invites] = await Promise.all([
    loadPlaces(context),
    loadScoredEvents(viewer.user.id, context, { when: "all" }),
    social ? loadOpenInvites({ userId: viewer.user.id, citySlug: viewer.profile.citySlug, now }) : Promise.resolve([]),
  ]);
  return { places: places.places, events, invites };
}
