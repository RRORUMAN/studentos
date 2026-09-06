"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  type NotificationDelivery,
  type NotificationTopic,
  notificationTopics,
  type PrivacySettings,
} from "@/domain/types";
import { emptyMemory } from "@/domain/social";
import { destroySession } from "@/server/auth/session";
import { findMany, findOne, nowIso, remove, transaction, update } from "@/server/db";
import { requireUserId } from "@/server/viewer";
import { formatLocaleFor } from "@/lib/locale";

/**
 * ============================================================================
 * PROFILE, PRIVACY AND DATA
 * ----------------------------------------------------------------------------
 * Everything a student can change about themselves, plus export and deletion.
 *
 * Export and delete are not optional extras. A product holding a student's
 * location, spending and social graph owes them a way to take it and a way to
 * end it, and both have to actually work rather than open a support ticket.
 * `deleteAccount` below really removes the rows.
 * ============================================================================
 */

export type ProfileResult = { ok: true } | { ok: false; message: string };

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Pick a name.").max(40),
  bio: z.string().trim().max(200).optional(),
  avatarEmoji: z.string().trim().min(1).max(8),
  interests: z.array(z.string()).max(40),
  homeArea: z.string().trim().max(120).optional(),
  maxTravelMinutes: z.coerce.number().int().min(5).max(180),
  priceSensitivity: z.enum(["cheapest", "value", "balanced", "occasional-splurge"]),
  diets: z.array(z.string()).max(20),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ProfileResult> {
  const userId = await requireUserId();

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  await update("profiles", (row) => row.userId === userId, {
    displayName: parsed.data.displayName,
    bio: parsed.data.bio ?? null,
    avatarEmoji: parsed.data.avatarEmoji,
    interests: parsed.data.interests,
    homeArea: parsed.data.homeArea ?? null,
    maxTravelMinutes: parsed.data.maxTravelMinutes,
    priceSensitivity: parsed.data.priceSensitivity,
    diets: parsed.data.diets,
  });

  revalidatePath("/you");
  revalidatePath("/home");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* City                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Move home city.
 *
 * A relocation is free at every tier — students move, and charging to tell
 * the product so would be absurd. What is paid is holding *more than one* city
 * at once (Max), and planning a city you are visiting (Pro trip planner); both
 * are read from the entitlement map, not decided here.
 *
 * The move resets the coarse home area, because a Malasaña address means
 * nothing in Berlin, and never touches saved rows: they keep their city and
 * simply stop being shown until the student is back.
 */
export async function setHomeCity(citySlug: string): Promise<ProfileResult> {
  const userId = await requireUserId();

  const { getCity } = await import("@/data/cities");
  const city = getCity(citySlug);
  if (!city) return { ok: false, message: "That city is not on the list yet." };

  await transaction((db) => {
    const profile = db.profiles.find((row) => row.userId === userId);
    if (!profile) return;
    if (profile.citySlug === city.slug) return;
    profile.citySlug = city.slug;
    profile.countryCode = city.countryCode;
    profile.currency = city.currency.code;
    profile.locale = formatLocaleFor(profile.language, city);
    profile.campusSlug = null;
    profile.universityName = null;
    profile.homeArea = null;
    profile.homePoint = null;
    profile.termsInCity = 1;

    const move = db.moves.find((row) => row.userId === userId);
    if (move) {
      move.citySlug = city.slug;
      move.toCountryCode = city.countryCode;
      move.campusSlug = null;
      move.updatedAt = nowIso();
    }
  });

  revalidatePath("/home");
  revalidatePath("/you/city");
  revalidatePath("/discover");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Privacy                                                                     */
/* -------------------------------------------------------------------------- */

export async function updatePrivacy(settings: PrivacySettings): Promise<ProfileResult> {
  const userId = await requireUserId();

  const parsed = z
    .object({
      profileVisibility: z.enum(["public", "campus", "friends", "private"]),
      showCity: z.boolean(),
      showCampus: z.boolean(),
      showInterests: z.boolean(),
      discoverable: z.boolean(),
    })
    .safeParse(settings);

  if (!parsed.success) return { ok: false, message: "Could not save those settings." };

  await update("profiles", (row) => row.userId === userId, { privacy: parsed.data });

  revalidatePath("/you/privacy");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export async function updateNotifications(
  topics: Record<string, boolean>,
  quiet: { from: number; to: number },
  delivery: Record<string, string> = {},
): Promise<ProfileResult> {
  const userId = await requireUserId();

  const next = Object.fromEntries(
    notificationTopics.map((topic) => [topic, Boolean(topics[topic])]),
  ) as Record<NotificationTopic, boolean>;

  const modes = Object.fromEntries(
    notificationTopics
      .filter(
        (topic) =>
          delivery[topic] === "instant" || delivery[topic] === "digest" || delivery[topic] === "off",
      )
      .map((topic) => [topic, delivery[topic] as NotificationDelivery]),
  ) as Partial<Record<NotificationTopic, NotificationDelivery>>;

  await transaction((db) => {
    const index = db.notificationPrefs.findIndex((row) => row.userId === userId);
    const row = {
      userId,
      topics: next,
      delivery: modes,
      quietFrom: Math.min(23, Math.max(0, quiet.from)),
      quietTo: Math.min(23, Math.max(0, quiet.to)),
      updatedAt: nowIso(),
    };
    if (index === -1) db.notificationPrefs.push(row);
    else db.notificationPrefs[index] = row;
  });

  revalidatePath("/you/notifications");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Memory                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Reset what the recommender has learned.
 *
 * A student must be able to see this and undo it. A recommender you cannot
 * inspect or correct is one people stop trusting the first time it is wrong
 * about them — and they cannot tell you why, so it never improves.
 */
export async function resetMemory(): Promise<ProfileResult> {
  const userId = await requireUserId();

  await transaction((db) => {
    const index = db.memories.findIndex((row) => row.userId === userId);
    const fresh = emptyMemory(userId, nowIso());
    if (index === -1) db.memories.push(fresh);
    else db.memories[index] = fresh;
  });

  revalidatePath("/you/data");
  revalidatePath("/home");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Export                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Everything held about this student, as JSON.
 *
 * Includes the private fields — home point, transactions, budget — because it
 * is going to the person they belong to. This is the one place `homePoint`
 * legitimately leaves the server.
 */
export async function exportData(): Promise<string> {
  const userId = await requireUserId();

  const [profile, move, subscription, envelopes, transactions, saved, posts, outcomes] =
    await Promise.all([
      findOne("profiles", (row) => row.userId === userId),
      findOne("moves", (row) => row.userId === userId),
      findOne("subscriptions", (row) => row.userId === userId),
      findMany("envelopes", (row) => row.userId === userId),
      findMany("transactions", (row) => row.userId === userId),
      findMany("saved", (row) => row.userId === userId),
      findMany("posts", (row) => row.authorId === userId),
      findMany("outcomes", (row) => row.userId === userId),
    ]);

  return JSON.stringify(
    {
      exportedAt: nowIso(),
      profile,
      move,
      subscription,
      budget: { envelopes, transactions },
      saved,
      posts,
      outcomes,
    },
    null,
    2,
  );
}

/* -------------------------------------------------------------------------- */
/* Deletion                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Delete the account, for real.
 *
 * Personal rows go. Community *content* is anonymised rather than deleted:
 * removing a post that fifteen people replied to destroys their contributions
 * too, so authorship is severed instead. That is the standard compromise and
 * it is the honest one, so the UI says exactly that before confirming.
 */
export async function deleteAccount(confirmation: string): Promise<ProfileResult> {
  const userId = await requireUserId();

  if (confirmation !== "DELETE") {
    return { ok: false, message: "Type DELETE to confirm." };
  }

  await transaction((db) => {
    /* Sever authorship, keep the thread readable. */
    for (const post of db.posts) if (post.authorId === userId) post.authorId = "deleted";
    for (const comment of db.comments) if (comment.authorId === userId) comment.authorId = "deleted";
    for (const message of db.chat) if (message.authorId === userId) message.authorId = "deleted";
  });

  /* Everything personal, gone. */
  await Promise.all([
    remove("profiles", (row) => row.userId === userId),
    remove("moves", (row) => row.userId === userId),
    remove("subscriptions", (row) => row.userId === userId),
    remove("envelopes", (row) => row.userId === userId),
    remove("transactions", (row) => row.userId === userId),
    remove("recurring", (row) => row.userId === userId),
    remove("budgetSetups", (row) => row.userId === userId),
    remove("saved", (row) => row.userId === userId),
    remove("collections", (row) => row.userId === userId),
    remove("memories", (row) => row.userId === userId),
    remove("notificationPrefs", (row) => row.userId === userId),
    remove("notifications", (row) => row.userId === userId),
    remove("arrival", (row) => row.userId === userId),
    remove("inviteResponses", (row) => row.userId === userId),
    remove("invites", (row) => row.hostId === userId),
    remove("listings", (row) => row.sellerId === userId),
    remove("votes", (row) => row.userId === userId),
    remove("sessions", (row) => row.userId === userId),
    remove("authTokens", (row) => row.userId === userId),
    remove("outcomes", (row) => row.userId === userId),
    remove("aiUsage", (row) => row.userId === userId),
    remove("users", (row) => row.id === userId),
  ]);

  await destroySession();
  redirect("/");
}
