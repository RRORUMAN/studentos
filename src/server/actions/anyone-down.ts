"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { findOne, newId, nowIso, remove, transaction } from "@/server/db";
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
 * capped on free (one live plan at a time), which is the right side of the
 * line: capping participation would shrink the network that makes every paid
 * feature work, while capping hosting only asks the person creating the tenth
 * simultaneous plan to pay.
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
  capacity: z.coerce.number().int().min(2).max(50),
  budget: z.string().optional(),
  anchorKind: z.enum(["place", "event", "plan"]).nullable().optional(),
  anchorId: z.string().nullable().optional(),
});

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
        message: "Free hosts one plan at a time. Close that one, or upgrade to host more.",
      };
    }
    return { ok: false, message: "Could not create that." };
  }

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, message: "That date did not parse." };

  const budgetCents = parsed.data.budget
    ? Math.round(Number(parsed.data.budget.replace(",", ".")) * 100)
    : null;

  const id = newId();

  await transaction((db) => {
    db.invites.push({
      id,
      citySlug: profile.citySlug,
      hostId: userId,
      title: parsed.data.title,
      detail: parsed.data.detail ?? null,
      anchorKind: parsed.data.anchorKind ?? null,
      anchorId: parsed.data.anchorId ?? null,
      startsAt: startsAt.toISOString(),
      audience: parsed.data.audience,
      capacity: parsed.data.capacity,
      budgetCents: Number.isFinite(budgetCents) ? budgetCents : null,
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

    if (mine) mine.status = status;
    else db.inviteResponses.push({ inviteId, userId, status, respondedAt: nowIso() });

    return { ok: true };
  });

  if (result.ok && status === "in") await recordOutcome("joined-activity", invite.title);

  revalidatePath(`/anyone-down/${inviteId}`);
  revalidatePath("/anyone-down");
  return result;
}

/** Host closes their own plan early. */
export async function closeInvite(inviteId: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const removed = await remove(
    "invites",
    (row) => row.id === inviteId && row.hostId === userId,
  );
  if (removed > 0) await remove("inviteResponses", (row) => row.inviteId === inviteId);
  revalidatePath("/anyone-down");
  return { ok: removed > 0 };
}
