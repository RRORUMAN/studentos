import "server-only";

import { cache } from "react";

import type { Invite, PlanMember, PlanVote, SavedPlan } from "@/domain/types";
import { findMany } from "@/server/db";
import { canSeeInvite } from "@/server/queries/social";

/**
 * ============================================================================
 * PLANS — queries
 * ----------------------------------------------------------------------------
 * A "plan" on the Plans screen is one of two things a student can have coming
 * up: a saved itinerary (from Ask, the week planner or built by hand) or an
 * Anyone Down? group they joined. Both are read here and shaped the same way
 * so the screen is one list rather than two.
 *
 * Visibility follows the row: a saved plan is visible to its owner and its
 * members, an invite to whoever `canSeeInvite` allows.
 * ============================================================================
 */

export type PlanCard = {
  kind: "plan" | "invite";
  id: string;
  href: string;
  title: string;
  /** ISO. Null for an undated saved plan. */
  when: string | null;
  /** People in: the owner plus every member who said yes. */
  people: number;
  /** Estimated total for the plan, in cents. */
  totalCents: number | null;
  /** Per person, when a budget was set on an invite. */
  perPersonCents: number | null;
  stops: number;
  status: "upcoming" | "invited" | "past";
  /** Owner's or host's display name. */
  by: string | null;
  mine: boolean;
  shared: boolean;
  votes: number;
};

export type MyPlans = {
  upcoming: PlanCard[];
  invited: PlanCard[];
  past: PlanCard[];
};

export const loadMyPlans = cache(async (input: {
  userId: string;
  citySlug: string;
  now: Date;
}): Promise<MyPlans> => {
  /* Membership first, so the plan scan is scoped to rows this student can
     actually see rather than every plan in the store. */
  const myMemberships = await findMany("planMembers", (row) => row.userId === input.userId);
  const memberPlanIds = new Set(myMemberships.map((row) => row.planId));

  const [plans, invites, responses, profiles] = await Promise.all([
    findMany(
      "plans",
      (row) =>
        row.citySlug === input.citySlug &&
        (row.userId === input.userId || memberPlanIds.has(row.id)),
    ),
    findMany("invites", (row) => row.citySlug === input.citySlug),
    findMany("inviteResponses", () => true),
    findMany("profiles", () => true),
  ]);

  const planIds = new Set(plans.map((plan) => plan.id));
  const [allMembers, votes] = await Promise.all([
    findMany("planMembers", (row) => planIds.has(row.planId)),
    findMany("planVotes", (row) => planIds.has(row.planId)),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const memberByPlan = new Map(myMemberships.map((row) => [row.planId, row]));
  const now = input.now.getTime();

  const cards: PlanCard[] = [];

  /* ---- saved plans ------------------------------------------------------ */
  for (const plan of plans) {
    const member = memberByPlan.get(plan.id);
    const mine = plan.userId === input.userId;
    if (!mine && !member) continue;
    if (member?.status === "out") continue;

    const inCount = allMembers.filter((row) => row.planId === plan.id && row.status === "in").length;
    cards.push(planCard(plan, member ?? null, mine, votes, byUser, now, 1 + inCount));
  }

  /* ---- Anyone Down? groups I am in -------------------------------------- */
  const myResponses = responses.filter((row) => row.userId === input.userId && row.status !== "out");
  for (const response of myResponses) {
    const invite = invites.find((row) => row.id === response.inviteId);
    if (!invite) continue;
    if (!(await canSeeInvite(input.userId, invite))) continue;

    const going = responses.filter((row) => row.inviteId === invite.id && row.status === "in").length;
    const past = Date.parse(invite.closesAt) < now;

    cards.push({
      kind: "invite",
      id: invite.id,
      href: `/anyone-down/${invite.id}`,
      title: invite.title,
      when: invite.startsAt,
      people: going,
      totalCents: invite.budgetCents === null ? null : invite.budgetCents * Math.max(1, going),
      perPersonCents: invite.budgetCents,
      stops: 1,
      status: past ? "past" : response.status === "maybe" ? "invited" : "upcoming",
      by: byUser.get(invite.hostId)?.displayName ?? null,
      mine: invite.hostId === input.userId,
      shared: false,
      votes: 0,
    });
  }

  const sortAsc = (a: PlanCard, b: PlanCard) => (a.when ?? "9").localeCompare(b.when ?? "9");
  const sortDesc = (a: PlanCard, b: PlanCard) => (b.when ?? "").localeCompare(a.when ?? "");

  return {
    upcoming: cards.filter((card) => card.status === "upcoming").sort(sortAsc),
    invited: cards.filter((card) => card.status === "invited").sort(sortAsc),
    past: cards.filter((card) => card.status === "past").sort(sortDesc).slice(0, 20),
  };
});

function planCard(
  plan: SavedPlan,
  member: PlanMember | null,
  mine: boolean,
  votes: readonly PlanVote[],
  byUser: Map<string, { displayName: string }>,
  now: number,
  people: number,
): PlanCard {
  const past = plan.forDate ? Date.parse(plan.forDate) + 86_400_000 < now : false;
  return {
    kind: "plan",
    id: plan.id,
    href: `/plans/${plan.id}`,
    title: plan.title,
    when: plan.forDate,
    people,
    totalCents: plan.items.reduce((sum, item) => sum + item.priceCents, 0),
    perPersonCents: null,
    stops: plan.items.length,
    status: past ? "past" : member?.status === "invited" ? "invited" : "upcoming",
    by: byUser.get(plan.userId)?.displayName ?? null,
    mine,
    shared: plan.shared,
    votes: votes.filter((vote) => vote.planId === plan.id).length,
  };
}

/** One plan with its people and votes, or null when the viewer may not see it. */
export async function loadPlan(planId: string, viewerId: string | null) {
  const [plans, members, votes, profiles] = await Promise.all([
    findMany("plans", (row) => row.id === planId),
    findMany("planMembers", (row) => row.planId === planId),
    findMany("planVotes", (row) => row.planId === planId),
    findMany("profiles", () => true),
  ]);

  const plan = plans[0];
  if (!plan) return null;

  const mine = viewerId !== null && plan.userId === viewerId;
  const member = viewerId ? members.find((row) => row.userId === viewerId) ?? null : null;

  /* Public link, owner, or a member. Anyone else sees nothing. */
  if (!plan.shared && !mine && !member) return null;

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));

  return {
    plan,
    mine,
    member,
    owner: byUser.get(plan.userId) ?? null,
    members: members.map((row) => ({
      ...row,
      displayName: byUser.get(row.userId)?.displayName ?? "Someone",
      avatarEmoji: byUser.get(row.userId)?.avatarEmoji ?? "🙂",
    })),
    votes,
    myVotes: viewerId ? votes.filter((vote) => vote.userId === viewerId) : [],
    /** The owner plus everyone who said they are in. */
    people: 1 + members.filter((row) => row.status === "in").length,
  };
}

/** A plan the student can add a line to, as the "Add to plan" chooser lists it. */
export type PlanChoice = {
  id: string;
  title: string;
  /** ISO, or null for an undated plan. */
  forDate: string | null;
  stops: number;
};

/**
 * The student's own upcoming plans, newest first, for the chooser. Plans whose
 * date has passed are left out — adding tonight's event to last Saturday is a
 * mistake the product should not offer.
 */
export async function loadPlanChoices(input: {
  userId: string;
  citySlug: string;
  now: Date;
  limit?: number;
}): Promise<PlanChoice[]> {
  const cutoff = input.now.getTime() - 86_400_000;
  const plans = await findMany(
    "plans",
    (row) =>
      row.userId === input.userId &&
      row.citySlug === input.citySlug &&
      (!row.forDate || Date.parse(row.forDate) >= cutoff),
  );

  return plans
    .sort((a, b) => {
      if (a.forDate && b.forDate) return a.forDate.localeCompare(b.forDate);
      if (a.forDate) return -1;
      if (b.forDate) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, input.limit ?? 8)
    .map((plan) => ({ id: plan.id, title: plan.title, forDate: plan.forDate, stops: plan.items.length }));
}

/** Anyone Down? plans open in the city and visible to the viewer, with counts. */
export async function loadOpenInvites(input: {
  userId: string;
  citySlug: string;
  now: Date;
}): Promise<(Invite & { going: number; hostName: string | null })[]> {
  const [invites, responses, profiles] = await Promise.all([
    findMany(
      "invites",
      (row) => row.citySlug === input.citySlug && Date.parse(row.closesAt) > input.now.getTime(),
    ),
    findMany("inviteResponses", () => true),
    findMany("profiles", () => true),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const allowed = await Promise.all(invites.map((invite) => canSeeInvite(input.userId, invite)));

  return invites
    .filter((_, index) => allowed[index])
    .map((invite) => ({
      ...invite,
      going: responses.filter((row) => row.inviteId === invite.id && row.status === "in").length,
      hostName: byUser.get(invite.hostId)?.displayName ?? null,
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
