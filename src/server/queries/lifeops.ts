import "server-only";

import { cache } from "react";

import type { LifeOpsTimeline } from "@/domain/lifeops";
import { findMany } from "@/server/db";
import { buildTimeline } from "@/server/engines/lifeops";
import { monthKey } from "@/server/engines/budget";
import { loadMoney } from "@/server/queries/money";
import { loadFriendIds } from "@/server/queries/social";
import type { Viewer } from "@/server/viewer";
import { money } from "@/lib/utils";

/**
 * ============================================================================
 * LIFEOPS — query
 * ----------------------------------------------------------------------------
 * Loads every row the timeline is built from and hands them to the pure
 * engine. I/O only; no dates are decided here.
 *
 * Wrapped in `cache` because Home, the LifeOps screen, the Daily Brief and the
 * calendar route can all ask for the same timeline in one request.
 * ============================================================================
 */
export const loadLifeOps = cache(async (viewer: Viewer, now: Date): Promise<LifeOpsTimeline> => {
  const userId = viewer.user.id;
  const social = !viewer.profile.socialGoals.includes("private");
  const timeZone = viewer.city.timezone;
  const month = monthKey(now, timeZone);

  const [tasks, arrivalDone, responses, inviteResponses, hosted, ownPlans, memberships, recurring, transactions, missions, friendIds, money$] =
    await Promise.all([
      findMany("lifeopsTasks", (row) => row.userId === userId),
      findMany("arrival", (row) => row.userId === userId),
      findMany("eventResponses", (row) => row.userId === userId),
      findMany("inviteResponses", (row) => row.userId === userId && row.status === "in"),
      findMany("invites", (row) => row.hostId === userId),
      findMany("plans", (row) => row.userId === userId && row.forDate !== null),
      findMany("planMembers", (row) => row.userId === userId && row.status === "in"),
      findMany("recurring", (row) => row.userId === userId && row.active),
      findMany("transactions", (row) => row.userId === userId && monthKey(new Date(row.spentAt), timeZone) === month),
      findMany("missions", (row) => row.userId === userId && row.status === "active"),
      loadFriendIds(userId),
      loadMoney(userId, timeZone, now),
    ]);

  /* ---- events the student responded to, with friends going --------------- */
  const eventIds = new Set(responses.map((row) => row.eventId));
  const [events, friendResponses] = await Promise.all([
    eventIds.size > 0 ? findMany("events", (row) => eventIds.has(row.id)) : Promise.resolve([]),
    eventIds.size > 0 && friendIds.size > 0
      ? findMany("eventResponses", (row) => eventIds.has(row.eventId) && friendIds.has(row.userId) && row.status === "going")
      : Promise.resolve([]),
  ]);
  const friendsGoing = new Map<string, number>();
  for (const row of friendResponses) friendsGoing.set(row.eventId, (friendsGoing.get(row.eventId) ?? 0) + 1);

  const eventInputs = responses
    .map((response) => {
      const event = events.find((row) => row.id === response.eventId);
      return event ? { event, status: response.status, friendsGoing: friendsGoing.get(event.id) ?? 0 } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  /* ---- Anyone Down? plans hosted or joined ------------------------------- */
  const joinedIds = new Set(inviteResponses.map((row) => row.inviteId));
  const joined = joinedIds.size > 0 ? await findMany("invites", (row) => joinedIds.has(row.id) && row.hostId !== userId) : [];
  const allInviteIds = new Set([...hosted, ...joined].map((row) => row.id));
  const going = allInviteIds.size > 0 ? await findMany("inviteResponses", (row) => allInviteIds.has(row.inviteId) && row.status === "in") : [];
  const goingCount = new Map<string, number>();
  for (const row of going) goingCount.set(row.inviteId, (goingCount.get(row.inviteId) ?? 0) + 1);

  const inviteInputs = [
    ...hosted.map((invite) => ({ ...invite, going: goingCount.get(invite.id) ?? 0, role: "host" as const })),
    ...joined.map((invite) => ({ ...invite, going: goingCount.get(invite.id) ?? 0, role: "in" as const })),
  ];

  /* ---- plans with a date --------------------------------------------------- */
  const memberPlanIds = new Set(memberships.map((row) => row.planId));
  const memberPlans = memberPlanIds.size > 0 ? await findMany("plans", (row) => memberPlanIds.has(row.id) && row.forDate !== null) : [];
  const plans = [...ownPlans, ...memberPlans.filter((plan) => plan.userId !== userId)];

  /* ---- missions ----------------------------------------------------------- */
  const missionIds = new Set(missions.map((row) => row.id));
  const steps = missionIds.size > 0 ? await findMany("missionSteps", (row) => missionIds.has(row.missionId)) : [];
  const missionInputs = missions.map((mission) => ({
    mission,
    steps: steps.filter((step) => step.missionId === mission.id).sort((a, b) => a.order - b.order),
  }));

  return buildTimeline({
    now,
    stage: viewer.stage.stage,
    social,
    housing: viewer.move?.housing ?? "unknown",
    arrivingOn: viewer.move?.arrivingOn ?? viewer.profile.arrivingOn,
    leavingOn: viewer.move?.leavingOn ?? viewer.profile.leavingOn,
    joinedAt: viewer.profile.createdAt,
    arrivalDone: new Set(arrivalDone.map((row) => row.taskId)),
    tasks,
    events: eventInputs,
    invites: inviteInputs,
    plans,
    recurring,
    transactions,
    missions: missionInputs,
    safeTodayCents: money$.unset ? null : money$.reading.safeTodayCents,
    formatMoney: (cents) => money(cents / 100, viewer.currency),
  });
});
