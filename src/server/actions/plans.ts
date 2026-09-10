"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveCity } from "@/data/cities";
import { fmtLongDay, fmtTime } from "@/lib/dates";
import { loadPlacesByIds } from "@/server/queries/places";
import type { SavedPlanItem } from "@/domain/types";
import { findOne, insert, newId, nowIso, remove, transaction, update } from "@/server/db";
import { STRATEGY_VERSION } from "@/server/engines/recommend";
import { recordOutcome } from "@/server/actions/insight";
import { limits, rateLimit } from "@/server/rate-limit";
import { loadFriendIds } from "@/server/queries/social";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * PLAN ACTIONS
 * ----------------------------------------------------------------------------
 * Saving, building, sharing and voting on plans.
 *
 * A plan line is always built from a real row — an event or a place — by id.
 * The client never supplies a title or a price for a line; it supplies the id
 * and the server copies the facts. That is what keeps a shared plan from
 * carrying a number nobody can trace.
 *
 * Everything here is free. Group AI planning (Plus) is a separate action that
 * *produces* a plan; managing one costs nothing at any tier.
 * ============================================================================
 */

export type PlanActionResult = { ok: true; id: string } | { ok: false; message: string };

const lineSchema = z.object({
  time: z.string().max(20),
  title: z.string().min(1).max(120),
  detail: z.string().max(240).nullable(),
  priceCents: z.number().int().min(0).max(1_000_000),
  walkMinutes: z.number().int().min(0).max(600).nullable(),
  kind: z.enum(["food", "event", "drink", "transport", "culture", "activity"]),
  source: z.enum(["students", "official", "venue"]),
  refKind: z.enum(["place", "event"]).nullable(),
  refId: z.string().nullable(),
});

function throttled(userId: string): boolean {
  return !rateLimit(`plans:write:${userId}`, limits.post.limit, limits.post.windowSeconds).ok;
}

/**
 * Save an Ask answer as a plan.
 *
 * Lines carrying a `refId` are re-read from the database so a tampered price
 * in the request body cannot survive into the saved row.
 */
export async function savePlanFromAnswer(input: {
  title: string;
  query: string | null;
  budgetCents: number | null;
  lines: unknown;
  forDate?: string | null;
}): Promise<PlanActionResult> {
  const userId = await requireUserId();
  if (throttled(userId)) return { ok: false, message: "That is a lot of plans. Try again in a bit." };

  const parsed = z.array(lineSchema).min(1).max(12).safeParse(input.lines);
  if (!parsed.success) return { ok: false, message: "That plan did not save." };

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const items: SavedPlanItem[] = [];
  for (const line of parsed.data) {
    items.push(await trustedLine(line, profile.citySlug));
  }

  const id = newId();
  await insert("plans", {
    id,
    userId,
    citySlug: profile.citySlug,
    title: String(input.title ?? "Plan").slice(0, 120),
    query: input.query,
    budgetCents: input.budgetCents,
    items,
    strategy: STRATEGY_VERSION,
    forDate: input.forDate ?? null,
    shared: false,
    createdAt: nowIso(),
  });

  await recordOutcome("plan-created", input.title);
  revalidatePath("/plans");
  return { ok: true, id };
}

/** Rebuild a line from its source row, keeping only what the row says. */
async function trustedLine(
  line: z.infer<typeof lineSchema>,
  citySlug: string,
): Promise<SavedPlanItem> {
  if (line.refKind === "event" && line.refId) {
    const event = await findOne("events", (row) => row.id === line.refId);
    if (event) {
      return {
        /* The plan's city, not the server's. An itinerary line is a time you turn
           up somewhere, so it has to be that place's clock. */
        time: fmtTime(event.startsAt, resolveCity(citySlug)?.timezone ?? "UTC"),
        title: event.title,
        detail: event.venue,
        priceCents: event.priceCents,
        walkMinutes: null,
        kind: event.priceCents === 0 ? "culture" : "event",
        source: event.source,
        refKind: "event",
        refId: event.id,
      };
    }
  }
  if (line.refKind === "place" && line.refId) {
    const { places } = await loadPlacesByIds([line.refId], citySlug);
    const place = places.get(line.refId);
    if (place) {
      return {
        time: line.time,
        title: place.name,
        detail: place.category,
        /* A place has no published amount, so a plan line built from one
           carries no money. Zero is correct: it is what this stop commits, and
           the plan's own total is money committed. */
        priceCents: 0,
        /* Only ever a routed duration. Null means the card shows the distance
           instead, which is what `Proximity` is for. */
        walkMinutes: place.proximity.minutes,
        kind: place.layers.includes("nightlife")
          ? "drink"
          : place.layers.includes("cheap-food")
            ? "food"
            : "activity",
        source: "official",
        refKind: "place",
        refId: place.id,
      };
    }
  }
  /* A line with no source row (transport, say) keeps what was sent, capped. */
  return { ...line, refKind: null, refId: null };
}

/* -------------------------------------------------------------------------- */
/* Build by hand                                                               */
/* -------------------------------------------------------------------------- */

export async function createPlan(formData: FormData): Promise<PlanActionResult> {
  const userId = await requireUserId();
  if (throttled(userId)) return { ok: false, message: "That is a lot of plans. Try again in a bit." };

  const parsed = z
    .object({
      title: z.string().trim().min(2, "Give it a name.").max(80),
      forDate: z.string().optional(),
      budget: z.string().optional(),
    })
    .safeParse({
      title: formData.get("title"),
      forDate: formData.get("forDate") || undefined,
      budget: formData.get("budget") || undefined,
    });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the plan." };

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const budgetCents = parsed.data.budget
    ? Math.round(Number(parsed.data.budget.replace(",", ".")) * 100)
    : null;

  const id = newId();
  await insert("plans", {
    id,
    userId,
    citySlug: profile.citySlug,
    title: parsed.data.title,
    query: null,
    budgetCents: Number.isFinite(budgetCents) ? budgetCents : null,
    items: [],
    strategy: "manual",
    forDate: parsed.data.forDate ? new Date(`${parsed.data.forDate}T12:00:00Z`).toISOString() : null,
    shared: false,
    createdAt: nowIso(),
  });

  await recordOutcome("plan-created", parsed.data.title);
  revalidatePath("/plans");
  return { ok: true, id };
}

/* -------------------------------------------------------------------------- */
/* Add to plan                                                                 */
/* -------------------------------------------------------------------------- */

export type AddToPlanResult =
  | {
      ok: true;
      id: string;
      title: string;
      /** True when the call created the plan rather than adding to one. */
      created: boolean;
      /** True when the line was already on the plan and nothing changed. */
      already: boolean;
    }
  | { ok: false; message: string };

const addSchema = z.object({
  refKind: z.enum(["place", "event"]),
  refId: z.string().trim().min(1).max(120),
  planId: z.string().trim().min(1).max(120).nullable().optional(),
  title: z.string().trim().max(80).nullable().optional(),
});

/**
 * "Add to plan" from an event or a place.
 *
 * The chooser on the client names the plan: an existing one by id, or a new
 * one (optionally titled). There is no silent fallback to "the most recent
 * plan" — a line landing on last Saturday's plan without being asked is the
 * kind of surprise that makes a student stop using the button.
 */
export async function addToPlan(input: {
  refKind: "place" | "event";
  refId: string;
  planId?: string | null;
  title?: string | null;
}): Promise<AddToPlanResult> {
  const userId = await requireUserId();

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not something we can add." };
  if (throttled(userId)) return { ok: false, message: "That is a lot of edits. Try again in a bit." };

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const line = await trustedLine(
    {
      time: "",
      title: "",
      detail: null,
      priceCents: 0,
      walkMinutes: null,
      kind: "activity",
      source: "students",
      refKind: parsed.data.refKind,
      refId: parsed.data.refId,
    },
    profile.citySlug,
  );
  if (!line.refId) return { ok: false, message: "That is not something we can add." };

  if (parsed.data.planId) {
    const plan = await findOne(
      "plans",
      (row) => row.id === parsed.data.planId && row.userId === userId,
    );
    if (!plan) return { ok: false, message: "That plan is not yours." };

    if (plan.items.some((item) => item.refId === line.refId)) {
      return { ok: true, id: plan.id, title: plan.title, created: false, already: true };
    }

    await update("plans", (row) => row.id === plan.id, { items: [...plan.items, line] });
    revalidatePath("/plans");
    revalidatePath(`/plans/${plan.id}`);
    revalidatePath(`/p/${plan.id}`);
    return { ok: true, id: plan.id, title: plan.title, created: false, already: false };
  }

  const title = parsed.data.title?.trim() || line.title.slice(0, 80);
  const id = newId();
  await insert("plans", {
    id,
    userId,
    citySlug: profile.citySlug,
    title,
    query: null,
    budgetCents: null,
    items: [line],
    strategy: "manual",
    forDate: null,
    shared: false,
    createdAt: nowIso(),
  });

  await recordOutcome("plan-created", title);
  revalidatePath("/plans");
  return { ok: true, id, title, created: true, already: false };
}

export async function removePlanLine(planId: string, index: number): Promise<PlanActionResult> {
  const userId = await requireUserId();
  const plan = await findOne("plans", (row) => row.id === planId && row.userId === userId);
  if (!plan) return { ok: false, message: "That plan is not yours." };
  if (!Number.isInteger(index) || index < 0 || index >= plan.items.length) {
    return { ok: false, message: "No such line." };
  }
  const items = plan.items.filter((_, i) => i !== index);
  await update("plans", (row) => row.id === planId, { items });
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/p/${planId}`);
  return { ok: true, id: planId };
}

/* -------------------------------------------------------------------------- */
/* Share, invite, respond, vote                                                */
/* -------------------------------------------------------------------------- */

export async function setPlanShared(planId: string, shared: boolean): Promise<PlanActionResult> {
  const userId = await requireUserId();
  const updated = await update(
    "plans",
    (row) => row.id === planId && row.userId === userId,
    { shared: Boolean(shared) },
  );
  if (!updated) return { ok: false, message: "That plan is not yours." };
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/p/${planId}`);
  revalidatePath("/plans");
  return { ok: true, id: planId };
}

export async function inviteToPlan(planId: string, friendId: string): Promise<PlanActionResult> {
  const userId = await requireUserId();
  const plan = await findOne("plans", (row) => row.id === planId && row.userId === userId);
  if (!plan) return { ok: false, message: "That plan is not yours." };

  /* Only friends can be invited by id. Anyone else gets the public link. */
  const friends = await loadFriendIds(userId);
  if (!friends.has(friendId)) return { ok: false, message: "You can invite friends, or share the link." };

  const me = await findOne("profiles", (row) => row.userId === userId);

  /* The plan's city decides what day the plan is on, exactly as it decides the
     time on every line of it. This was the machine's calendar, which for a plan
     dated at a boundary named the wrong weekday in a notification that is then
     stored and read days later. */
  const planDay =
    plan.forDate === null
      ? null
      : fmtLongDay(plan.forDate, resolveCity(me?.citySlug ?? "")?.timezone ?? "UTC");

  await transaction((db) => {
    const index = db.planMembers.findIndex((row) => row.planId === planId && row.userId === friendId);
    const row = { planId, userId: friendId, status: "invited" as const, updatedAt: nowIso() };
    if (index === -1) db.planMembers.push(row);
    else if (db.planMembers[index].status === "out") db.planMembers[index] = row;

    db.notifications.push({
      id: newId(),
      userId: friendId,
      topic: "plans",
      title: `${me?.displayName ?? "A friend"} invited you to ${plan.title}`,
      body: planDay ?? "Have a look and say if you are in.",
      href: `/plans/${planId}`,
      readAt: null,
      createdAt: nowIso(),
    });
  });

  revalidatePath(`/plans/${planId}`);
  return { ok: true, id: planId };
}

export async function respondToPlan(planId: string, status: "in" | "out"): Promise<PlanActionResult> {
  const userId = await requireUserId();
  if (status !== "in" && status !== "out") return { ok: false, message: "Say in or out." };

  const member = await findOne("planMembers", (row) => row.planId === planId && row.userId === userId);
  const plan = await findOne("plans", (row) => row.id === planId);
  if (!plan) return { ok: false, message: "That plan has gone." };
  /* A public plan can be joined from the link; a private one needs an invite. */
  if (!member && !plan.shared) return { ok: false, message: "You need an invite for that plan." };

  await transaction((db) => {
    const index = db.planMembers.findIndex((row) => row.planId === planId && row.userId === userId);
    const row = { planId, userId, status, updatedAt: nowIso() };
    if (index === -1) db.planMembers.push(row);
    else db.planMembers[index] = row;
  });

  if (status === "in") await recordOutcome("joined-activity", plan.title);
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/plans");
  return { ok: true, id: planId };
}

export async function votePlanItem(
  planId: string,
  itemIndex: number,
  value: 1 | -1,
): Promise<PlanActionResult> {
  const userId = await requireUserId();
  if (value !== 1 && value !== -1) return { ok: false, message: "A vote is up or down." };

  const plan = await findOne("plans", (row) => row.id === planId);
  if (!plan) return { ok: false, message: "That plan has gone." };

  const member = await findOne("planMembers", (row) => row.planId === planId && row.userId === userId);
  if (plan.userId !== userId && member?.status !== "in") {
    return { ok: false, message: "Join the plan to vote on it." };
  }
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= plan.items.length) {
    return { ok: false, message: "No such line." };
  }

  await transaction((db) => {
    const index = db.planVotes.findIndex(
      (row) => row.planId === planId && row.userId === userId && row.itemIndex === itemIndex,
    );
    if (index !== -1 && db.planVotes[index].value === value) {
      db.planVotes.splice(index, 1);
      return;
    }
    const row = { planId, userId, itemIndex, value, createdAt: nowIso() };
    if (index === -1) db.planVotes.push(row);
    else db.planVotes[index] = row;
  });

  revalidatePath(`/plans/${planId}`);
  return { ok: true, id: planId };
}

export async function deletePlan(planId: string): Promise<PlanActionResult> {
  const userId = await requireUserId();
  const removed = await remove("plans", (row) => row.id === planId && row.userId === userId);
  if (removed === 0) return { ok: false, message: "That plan is not yours." };
  await remove("planMembers", (row) => row.planId === planId);
  await remove("planVotes", (row) => row.planId === planId);
  /* Bookmarks pointing at a plan that no longer exists are noise on Saved. */
  await remove("saved", (row) => row.kind === "plan" && row.targetId === planId);
  revalidatePath("/plans");
  revalidatePath("/saved");
  return { ok: true, id: planId };
}
