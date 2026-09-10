"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { missionTemplate } from "@/config/missions";
import { fillBudget, type Mission, type MissionVariant, missionProgress } from "@/domain/missions";
import { findMany, findOne, insert, newId, nowIso, transaction, update } from "@/server/db";
import { buildMission, cityRatio } from "@/server/engines/missions";
import { loadMissionCandidates } from "@/server/queries/missions";
import { dmChannel } from "@/server/queries/chat";
import { isBlocked } from "@/server/queries/social";
import { requestDate } from "@/server/now";
import { limits, rateLimit } from "@/server/rate-limit";
import { getViewer, requireUserId } from "@/server/viewer";
import { money } from "@/lib/utils";

/**
 * ============================================================================
 * MISSION ACTIONS
 * ----------------------------------------------------------------------------
 * Start, tick, skip, rebuild, share, invite, abandon. Every step a mission
 * holds was built by the pure engine from rows the city actually has; these
 * actions only move state.
 * ============================================================================
 */

export type MissionResult = { ok: true; id: string; message?: string } | { ok: false; message: string };

function revalidate(id?: string): void {
  revalidatePath("/missions");
  revalidatePath("/home");
  revalidatePath("/lifeops");
  if (id) revalidatePath(`/missions/${id}`);
}

const variantSchema = z.object({ cheaper: z.boolean().default(false), social: z.boolean().default(false) });

/* -------------------------------------------------------------------------- */
/* Start                                                                       */
/* -------------------------------------------------------------------------- */

export async function startMission(templateKey: string, variantInput?: Partial<MissionVariant>): Promise<MissionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Sign in to start a mission." };

  const gate = rateLimit(`mission:${viewer.user.id}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const template = missionTemplate(templateKey);
  if (!template) return { ok: false, message: "Unknown mission." };
  const variant = variantSchema.parse(variantInput ?? {});

  const existing = await findOne(
    "missions",
    (row) => row.userId === viewer.user.id && row.templateKey === templateKey && row.status === "active",
  );
  if (existing) return { ok: true, id: existing.id, message: "Already running." };

  const now = requestDate();
  const candidates = await loadMissionCandidates(viewer, now);
  const built = buildMission({
    template,
    candidates,
    variant,
    now,
    timeZone: viewer.city.timezone,
    ratio: cityRatio(viewer.city.anchors),
    social: !viewer.profile.socialGoals.includes("private"),
    fmt: (cents) => money(cents / 100, viewer.currency),
  });

  const id = newId();
  const iso = now.toISOString();
  const mission: Mission = {
    id,
    userId: viewer.user.id,
    templateKey,
    citySlug: viewer.profile.citySlug,
    /* Resolved against the SCALED cap, not the template's euro one, so the
       stored name agrees with the figures stored alongside it — and keeps
       agreeing if the student later moves to a city priced differently, since
       both were frozen together at the moment the mission was started. */
    title: fillBudget(template.title, built.budgetCents, (cents) => money(cents / 100, viewer.currency)),
    emoji: template.emoji,
    budgetCents: built.budgetCents,
    status: "active",
    variant,
    shareToken: null,
    startedAt: iso,
    dueAt: new Date(now.getTime() + template.durationDays * 86_400_000).toISOString(),
    completedAt: null,
    createdAt: iso,
  };

  await transaction((db) => {
    db.missions.push(mission);
    for (const step of built.steps) db.missionSteps.push({ ...step, id: newId(), missionId: id });
  });

  revalidate(id);
  return { ok: true, id };
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

async function ownMission(id: string, userId: string): Promise<Mission | null> {
  const mission = await findOne("missions", (row) => row.id === id && row.userId === userId);
  return mission ?? null;
}

async function settleCompletion(missionId: string, userId: string): Promise<boolean> {
  const steps = await findMany("missionSteps", (row) => row.missionId === missionId);
  const progress = missionProgress(steps);
  if (!progress.complete) return false;
  const now = nowIso();
  await update("missions", (row) => row.id === missionId, { status: "completed", completedAt: now });
  await insert("outcomes", { id: newId(), userId, kind: "plan-created", detail: `mission-complete:${missionId}`, createdAt: now });
  return true;
}

export async function toggleMissionStep(stepId: string): Promise<MissionResult & { done?: boolean; completed?: boolean }> {
  const userId = await requireUserId();
  const step = await findOne("missionSteps", (row) => row.id === stepId);
  if (!step) return { ok: false, message: "That step is gone." };
  const mission = await ownMission(step.missionId, userId);
  if (!mission) return { ok: false, message: "Not your mission." };

  const done = step.doneAt === null;
  await update("missionSteps", (row) => row.id === stepId, { doneAt: done ? nowIso() : null, skippedAt: null });
  const completed = done ? await settleCompletion(mission.id, userId) : false;
  if (!done && mission.status === "completed") {
    await update("missions", (row) => row.id === mission.id, { status: "active", completedAt: null });
  }
  revalidate(mission.id);
  return { ok: true, id: mission.id, done, completed };
}

export async function skipMissionStep(stepId: string): Promise<MissionResult> {
  const userId = await requireUserId();
  const step = await findOne("missionSteps", (row) => row.id === stepId);
  if (!step) return { ok: false, message: "That step is gone." };
  const mission = await ownMission(step.missionId, userId);
  if (!mission) return { ok: false, message: "Not your mission." };
  if (!step.optional) return { ok: false, message: "That one is part of the mission. Tick it or rebuild." };

  await update("missionSteps", (row) => row.id === stepId, { skippedAt: step.skippedAt ? null : nowIso() });
  await settleCompletion(mission.id, userId);
  revalidate(mission.id);
  return { ok: true, id: mission.id };
}

/* -------------------------------------------------------------------------- */
/* Rebuild: cheaper, more social                                               */
/* -------------------------------------------------------------------------- */

/**
 * Re-run the engine with a different variant. Steps already ticked are kept
 * as they are; every open step is rebuilt, so "Make cheaper" cannot undo a
 * lunch the student already had.
 */
export async function rebuildMission(id: string, variantInput: Partial<MissionVariant>): Promise<MissionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Sign in first." };
  const mission = await ownMission(id, viewer.user.id);
  if (!mission) return { ok: false, message: "Not your mission." };
  const template = missionTemplate(mission.templateKey);
  if (!template) return { ok: false, message: "Unknown mission." };

  const variant = { ...mission.variant, ...variantSchema.partial().parse(variantInput) };
  const now = requestDate();
  const candidates = await loadMissionCandidates(viewer, now);
  const built = buildMission({
    template,
    candidates,
    variant,
    now,
    timeZone: viewer.city.timezone,
    ratio: cityRatio(viewer.city.anchors),
    social: !viewer.profile.socialGoals.includes("private"),
    fmt: (cents) => money(cents / 100, viewer.currency),
  });

  await transaction((db) => {
    const done = db.missionSteps.filter((row) => row.missionId === id && row.doneAt !== null);
    const doneKeys = new Set(done.map((row) => row.key));
    db.missionSteps = db.missionSteps.filter((row) => row.missionId !== id || row.doneAt !== null);
    for (const step of built.steps) {
      if (doneKeys.has(step.key)) continue;
      db.missionSteps.push({ ...step, id: newId(), missionId: id });
    }
    const index = db.missions.findIndex((row) => row.id === id);
    if (index !== -1) db.missions[index] = { ...db.missions[index], variant, budgetCents: built.budgetCents };
  });

  revalidate(id);
  return {
    ok: true,
    id,
    message: variant.cheaper && variant.social ? "Rebuilt: cheaper and more social." : variant.cheaper ? "Rebuilt with the cheaper picks." : variant.social ? "Rebuilt around things people are going to." : "Rebuilt.",
  };
}

export async function abandonMission(id: string): Promise<MissionResult> {
  const userId = await requireUserId();
  const mission = await ownMission(id, userId);
  if (!mission) return { ok: false, message: "Not your mission." };
  await update("missions", (row) => row.id === id, { status: "abandoned" });
  revalidate(id);
  return { ok: true, id, message: "Mission stopped. Start it again any time." };
}

/* -------------------------------------------------------------------------- */
/* Share and invite                                                            */
/* -------------------------------------------------------------------------- */

export async function shareMission(id: string): Promise<MissionResult & { token?: string }> {
  const userId = await requireUserId();
  const mission = await ownMission(id, userId);
  if (!mission) return { ok: false, message: "Not your mission." };
  const token = mission.shareToken ?? randomBytes(12).toString("base64url");
  if (!mission.shareToken) await update("missions", (row) => row.id === id, { shareToken: token });
  revalidate(id);
  return { ok: true, id, token };
}

export async function unshareMission(id: string): Promise<MissionResult> {
  const userId = await requireUserId();
  const mission = await ownMission(id, userId);
  if (!mission) return { ok: false, message: "Not your mission." };
  await update("missions", (row) => row.id === id, { shareToken: null });
  revalidate(id);
  return { ok: true, id, message: "Link switched off." };
}

/** Send the mission to a friend as a chat message with the mission attached. */
export async function inviteFriendToMission(id: string, friendId: string): Promise<MissionResult> {
  const userId = await requireUserId();
  const mission = await ownMission(id, userId);
  if (!mission) return { ok: false, message: "Not your mission." };
  if (friendId === userId) return { ok: false, message: "That is you." };

  const friendship = await findOne(
    "friendships",
    (row) => row.status === "accepted" && ((row.requesterId === userId && row.addresseeId === friendId) || (row.requesterId === friendId && row.addresseeId === userId)),
  );
  if (!friendship || (await isBlocked(userId, friendId))) return { ok: false, message: "You can only invite friends." };

  const profile = await findOne("profiles", (row) => row.userId === userId);
  const channel = dmChannel(userId, friendId);
  const now = nowIso();
  await insert("chat", {
    id: newId(),
    citySlug: profile?.citySlug ?? mission.citySlug,
    channel,
    authorId: userId,
    body: `Want to do "${mission.title}" with me?`,
    replyToId: null,
    attachment: { kind: "mission", id: mission.id },
    createdAt: now,
  });
  await insert("notifications", {
    id: newId(),
    userId: friendId,
    topic: "friends-plans",
    title: `${profile?.displayName ?? "A friend"} invited you to ${mission.title}`,
    body: "Open the chat to say if you are in.",
    href: `/pulse/chat/${channel}`,
    readAt: null,
    createdAt: now,
  });
  revalidatePath("/pulse/chat");
  return { ok: true, id, message: "Sent in your chat." };
}

/** Copy a shared mission into your own account. Needs an account, never a budget. */
export async function copySharedMission(token: string): Promise<MissionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Sign in to take this mission." };
  const shared = await findOne("missions", (row) => row.shareToken === token);
  if (!shared) return { ok: false, message: "That link has been switched off." };
  return startMission(shared.templateKey, shared.variant);
}
