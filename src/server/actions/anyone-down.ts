"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { placeExists } from "@/server/queries/places";
import type { Invite } from "@/domain/types";
import { findOne, newId, nowIso, transaction, update } from "@/server/db";
import { QuotaError, assertQuota } from "@/server/entitlements";
import { recordOutcome } from "@/server/actions/insight";
import { canSeeInvite } from "@/server/queries/social";
import { isFlagOn } from "@/server/queries/settings";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * ANYONE DOWN?
 * ----------------------------------------------------------------------------
 * Turning a place, an event or an idea into a group.
 *
 * **Joining is never gated and never quota-limited, at any tier.** Hosting is
 * capped on free (a couple of live plans at a time), which is the right side
 * of the line: capping participation would shrink the network that makes
 * every paid feature work, while capping hosting only asks the person
 * creating the tenth simultaneous plan to pay.
 *
 * Groups close after the thing happens. That is deliberate — a temporary group
 * that dissolves is far easier to join than a permanent one, because nobody is
 * committing to a relationship by turning up to five-a-side.
 * ============================================================================
 */

export type InviteResult = { ok: true; id: string } | { ok: false; message: string };

const createSchema = z.object({
  title: z.string().trim().min(3, "Say what it is.").max(120),
  detail: z.string().trim().max(500).optional(),
  startsAt: z.string().min(1, "When?"),
  audience: z.enum(["friends", "campus", "city"]),
  capacity: z.coerce.number().int().min(2, "At least two people.").max(50, "Fifty at most."),
  /** Per person, in the student's currency, as typed: "8", "8.50", "8,50". */
  budget: z.string().trim().max(12).optional(),
  /* "post" is accepted from the button so a post can seed a plan, but the
     Invite row can only carry place / event / plan anchors today — see the
     note in `createInvite`. */
  anchorKind: z.enum(["place", "event", "plan", "post"]).nullable().optional(),
  anchorId: z.string().max(80).nullable().optional(),
});

/** Only an anchor that exists in the host's city is stored. */
async function resolveAnchor(
  citySlug: string,
  kind: "place" | "event" | "plan" | "post" | null | undefined,
  id: string | null | undefined,
): Promise<Pick<Invite, "anchorKind" | "anchorId">> {
  const none = { anchorKind: null, anchorId: null };
  if (!kind || !id) return none;
  switch (kind) {
    case "event":
      return (await findOne("events", (row) => row.id === id && row.citySlug === citySlug)) ? { anchorKind: "event", anchorId: id } : none;
    case "place":
      return (await placeExists(id)) ? { anchorKind: "place", anchorId: id } : none;
    case "plan":
      return (await findOne("plans", (row) => row.id === id)) ? { anchorKind: "plan", anchorId: id } : none;
    case "post":
      /* `Invite.anchorKind` does not include "post" yet (domain schema). The
         plan is still created, with the post's title as its title; the
         anchor is dropped rather than stored under a kind the schema and the
         SQL CHECK constraint would reject. */
      return none;
  }
}

function parseBudgetCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export async function createInvite(formData: FormData): Promise<InviteResult> {
  const userId = await requireUserId();
  if (!(await isFlagOn("anyoneDown"))) {
    return { ok: false, message: "New plans are paused in this city for the moment. Joining still works." };
  }

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    detail: formData.get("detail") || undefined,
    startsAt: formData.get("startsAt"),
    audience: formData.get("audience") ?? "city",
    capacity: formData.get("capacity") ?? 6,
    budget: formData.get("budget") || undefined,
    anchorKind: (formData.get("anchorKind") as string) || null,
    anchorId: (formData.get("anchorId") as string) || null,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  try {
    await assertQuota(userId, "hostedPlans");
  } catch (error) {
    if (error instanceof QuotaError) {
      return {
        ok: false,
        message: "Free hosts two plans at a time. Close one, or upgrade to host more.",
      };
    }
    return { ok: false, message: "Could not create that." };
  }

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, message: "That date did not parse." };
  if (startsAt.getTime() < Date.now() - 60 * 60_000) return { ok: false, message: "That time has already passed." };

  const budgetCents = parseBudgetCents(parsed.data.budget);
  if (parsed.data.budget && budgetCents === null) return { ok: false, message: "Budget should be a number, like 8 or 8.50." };

  const anchor = await resolveAnchor(profile.citySlug, parsed.data.anchorKind, parsed.data.anchorId);

  const id = newId();

  await transaction((db) => {
    db.invites.push({
      id,
      citySlug: profile.citySlug,
      hostId: userId,
      title: parsed.data.title,
      detail: parsed.data.detail ?? null,
      ...anchor,
      startsAt: startsAt.toISOString(),
      audience: parsed.data.audience,
      capacity: parsed.data.capacity,
      budgetCents,
      /* Closes six hours after it starts. A group for Tuesday football is
         useless on Wednesday, and leaving it open just accumulates clutter. */
      closesAt: new Date(startsAt.getTime() + 6 * 3_600_000).toISOString(),
      createdAt: nowIso(),
    });

    /* The host is in by definition. Making them tap "I'm in" on their own plan
       is the sort of small nonsense that makes software feel unconsidered. */
    db.inviteResponses.push({ inviteId: id, userId, status: "in", respondedAt: nowIso() });
  });

  await recordOutcome("plan-created", parsed.data.title);

  revalidatePath("/anyone-down");
  revalidatePath("/pulse/chat");
  revalidatePath("/home");
  return { ok: true, id };
}

/* -------------------------------------------------------------------------- */
/* Responding                                                                  */
/* -------------------------------------------------------------------------- */

export async function respondToInvite(
  inviteId: string,
  status: "in" | "maybe" | "out",
): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();

  const invite = await findOne("invites", (row) => row.id === inviteId);
  if (!invite) return { ok: false, message: "That plan has gone." };

  if (Date.parse(invite.closesAt) < Date.now()) {
    return { ok: false, message: "That plan has closed." };
  }

  /* Audience is enforced here, not only in the list query. Filtering the feed
     hides a friends-only plan from the page; it does not stop someone posting
     this action with an id they obtained another way. The visibility rule has
     to live where the write happens. */
  if (!(await canSeeInvite(userId, invite))) {
    return { ok: false, message: "That plan has gone." };
  }

  const result = await transaction((db) => {
    const going = db.inviteResponses.filter(
      (row) => row.inviteId === inviteId && row.status === "in",
    );
    const mine = db.inviteResponses.find(
      (row) => row.inviteId === inviteId && row.userId === userId,
    );

    /* Capacity is checked inside the transaction, so two people tapping "I'm
       in" on the last spot at the same moment cannot both get it. */
    if (status === "in" && mine?.status !== "in" && going.length >= invite.capacity) {
      return { ok: false, message: "That one is full." };
    }

    if (mine) {
      mine.status = status;
      mine.respondedAt = nowIso();
    } else {
      db.inviteResponses.push({ inviteId, userId, status, respondedAt: nowIso() });
    }

    return { ok: true };
  });

  if (result.ok && status === "in") await recordOutcome("joined-activity", invite.title);

  revalidatePath(`/anyone-down/${inviteId}`);
  revalidatePath("/anyone-down");
  revalidatePath("/pulse/chat");
  return result;
}

/**
 * Host closes their own plan early.
 *
 * Closing sets `closesAt` to now rather than deleting: the people who joined
 * keep the chat and the memory of who was there, "do it again" can copy it,
 * and the hosted-plans quota frees up because it counts live rows only.
 */
export async function closeInvite(inviteId: string): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();

  const invite = await findOne("invites", (row) => row.id === inviteId);
  if (!invite || invite.hostId !== userId) return { ok: false, message: "That plan is not yours." };
  if (Date.parse(invite.closesAt) < Date.now()) return { ok: true };

  await update("invites", (row) => row.id === inviteId, { closesAt: nowIso() });

  revalidatePath(`/anyone-down/${inviteId}`);
  revalidatePath("/anyone-down");
  revalidatePath("/pulse/chat");
  revalidatePath("/home");
  return { ok: true };
}
