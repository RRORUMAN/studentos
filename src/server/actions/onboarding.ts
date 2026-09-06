"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { defaultCityContext, getCampus, resolveCity } from "@/data/cities";
import { emptyMemory } from "@/domain/social";
import {
  defaultPrivacy,
  type NotificationTopic,
  notificationTopics,
  type Profile,
} from "@/domain/types";
import { monthKey, suggestEnvelopes } from "@/server/engines/budget";
import { findOne, insert, newId, nowIso, transaction, upsert } from "@/server/db";
import { looksAcademic } from "@/server/auth/service";
import { requireUserId } from "@/server/viewer";
import { formatLocaleFor } from "@/lib/locale";

/**
 * ============================================================================
 * ONBOARDING ACTION
 * ----------------------------------------------------------------------------
 * Turns the twelve answers into the rows the product runs on, in one
 * transaction.
 *
 * The rule that shapes this: onboarding must produce a *working* account, not a
 * half-populated one. So every optional answer has a defensible default, and
 * the action creates the subscription row, the budget envelopes, the notifi-
 * cation preferences and the memory row even when the student skipped
 * everything skippable. A missing row later reads as a bug and gets defended
 * against in twenty call sites; creating them once here is cheaper and the
 * product is never in a state it does not understand.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Schema                                                                      */
/* -------------------------------------------------------------------------- */

const schema = z.object({
  status: z.enum([
    "studying-abroad",
    "international",
    "exchange",
    "home-country",
    "moving-soon",
    "other",
  ]),

  citySlug: z.string().min(1),
  arrivingOn: z.string().nullable().optional(),
  leavingOn: z.string().nullable().optional(),
  housing: z
    .enum(["sorted", "temporary", "searching", "university-halls", "with-family", "unknown"])
    .default("unknown"),
  stayMonths: z.number().int().min(1).max(72).nullable().optional(),

  campusSlug: z.string().nullable().optional(),
  universityName: z.string().max(120).nullable().optional(),

  homeArea: z.string().max(120).nullable().optional(),
  /* Precise coordinates are accepted but never echoed back to any client. */
  homePoint: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),

  budgetMode: z.enum(["simple", "detailed"]).default("simple"),
  /** Major units as typed by the student; converted to cents here. */
  monthlyTotal: z.number().min(0).max(50_000).nullable().optional(),
  excludeHousing: z.boolean().default(false),
  categoryAmounts: z.record(z.string(), z.number().min(0).max(50_000)).default({}),

  moneyGoals: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  socialGoals: z.array(z.string()).default([]),
  diets: z.array(z.string()).default([]),
  transport: z.array(z.string()).default([]),
  maxTravelMinutes: z.number().int().min(5).max(180).default(30),
  priceSensitivity: z
    .enum(["cheapest", "value", "balanced", "occasional-splurge"])
    .default("value"),

  notificationTopics: z.array(z.string()).default(["budget-warnings"]),
  language: z.string().min(2).max(5).default("en"),
});

export type OnboardingInput = z.input<typeof schema>;

export type OnboardingResult = { ok: false; message: string } | { ok: true };

/* -------------------------------------------------------------------------- */
/* Handle                                                                      */
/* -------------------------------------------------------------------------- */

/** A readable, unique-ish handle from the email local part. */
function handleFrom(email: string, suffix: string): string {
  const base = (email.split("@")[0] ?? "student")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 14);
  return `${base || "student"}${suffix}`;
}

const AVATARS = ["🦊", "🐢", "🌿", "🎧", "📚", "🚲", "🛠️", "🎹", "🧭", "🍜", "⚽", "🎨"];

/* -------------------------------------------------------------------------- */
/* Action                                                                      */
/* -------------------------------------------------------------------------- */

export async function completeOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  const userId = await requireUserId();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Some answers did not save. Go back a step and try again." };
  }
  const answers = parsed.data;

  const user = await findOne("users", (row) => row.id === userId);
  if (!user) return { ok: false, message: "Session expired. Sign in again." };

  const city = resolveCity(answers.citySlug) ?? defaultCityContext;
  const campus = answers.campusSlug ? getCampus(answers.campusSlug) : undefined;
  const now = nowIso();

  /* ---- budget -----------------------------------------------------------
     Two modes converge on the same shape: a set of monthly envelopes. Simple
     mode derives them from one total; detailed mode uses what was typed. */
  const monthlyTotalCents = Math.round((answers.monthlyTotal ?? 0) * 100);

  const detailedEntries = Object.entries(answers.categoryAmounts).filter(([, value]) => value > 0);

  const envelopeRows =
    answers.budgetMode === "detailed" && detailedEntries.length > 0
      ? detailedEntries.map(([category, amount]) => ({
          category,
          plannedCents: Math.round(amount * 100),
        }))
      : monthlyTotalCents > 0
        ? suggestEnvelopes(monthlyTotalCents, { excludeHousing: answers.excludeHousing })
        : [];

  const effectiveTotalCents =
    answers.budgetMode === "detailed" && detailedEntries.length > 0
      ? envelopeRows.reduce((sum, row) => sum + row.plannedCents, 0)
      : monthlyTotalCents;

  const month = monthKey(new Date());

  /* ---- one transaction --------------------------------------------------
     Everything below is written together. A half-onboarded account — profile
     but no subscription, say — would render a broken Home and be very hard to
     diagnose from the outside. */
  await transaction((db) => {
    const profile: Profile = {
      userId,
      handle: handleFrom(user.email, newId().slice(0, 4)),
      displayName: (user.email.split("@")[0] ?? "Student").replace(/[^a-zA-Z]/g, "") || "Student",
      avatarEmoji: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      bio: null,

      studentStatus: answers.status,

      citySlug: city.slug,
      countryCode: city.countryCode,
      arrivingOn: answers.arrivingOn ?? null,
      leavingOn: answers.leavingOn ?? null,

      campusSlug: campus?.slug ?? null,
      universityName: answers.universityName ?? campus?.name ?? null,

      homeArea: answers.homeArea ?? null,
      homePoint: answers.homePoint ?? null,

      moneyGoals: answers.moneyGoals as Profile["moneyGoals"],
      interests: answers.interests,
      socialGoals: answers.socialGoals as Profile["socialGoals"],
      diets: answers.diets,
      transport: (answers.transport.length > 0
        ? answers.transport
        : ["walk"]) as Profile["transport"],
      maxTravelMinutes: answers.maxTravelMinutes,
      priceSensitivity: answers.priceSensitivity,

      currency: city.currency.code,
      locale: formatLocaleFor(answers.language, city),
      language: answers.language,

      /* A university email address is evidence enough for the badge. Anything
         else goes through manual verification rather than being refused. */
      studentVerifiedAt: looksAcademic(user.email) ? now : null,
      termsInCity: 1,

      privacy: {
        ...defaultPrivacy,
        /* Respect "mostly private" immediately rather than asking again in
           settings. Someone who said they want this used privately should not
           be discoverable for one session first. */
        discoverable: !answers.socialGoals.includes("private"),
        profileVisibility: answers.socialGoals.includes("private") ? "private" : "campus",
      },

      onboardedAt: now,
      createdAt: now,
    };

    const existing = db.profiles.findIndex((row) => row.userId === userId);
    if (existing === -1) db.profiles.push(profile);
    else db.profiles[existing] = profile;

    /* Move record: the lifecycle engine reads this first. */
    const move = {
      userId,
      fromCountryCode: null,
      toCountryCode: city.countryCode,
      citySlug: city.slug,
      campusSlug: campus?.slug ?? null,
      arrivingOn: answers.arrivingOn ?? null,
      leavingOn: answers.leavingOn ?? null,
      housing: answers.housing,
      stayMonths: answers.stayMonths ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const moveIndex = db.moves.findIndex((row) => row.userId === userId);
    if (moveIndex === -1) db.moves.push(move);
    else db.moves[moveIndex] = move;

    /* Free subscription. Explicit rather than implied by an absent row, so
       `planFor` never has to guess and the admin plan counts are real. */
    if (!db.subscriptions.some((row) => row.userId === userId)) {
      db.subscriptions.push({
        userId,
        plan: "free",
        status: "none",
        period: "monthly",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      });
    }

    /* Budget. */
    if (!db.budgetSetups.some((row) => row.userId === userId)) {
      db.budgetSetups.push({
        userId,
        mode: answers.budgetMode,
        monthlyTotalCents: effectiveTotalCents,
        excludeHousing: answers.excludeHousing,
        updatedAt: now,
      });
    }

    for (const row of envelopeRows) {
      const already = db.envelopes.some(
        (envelope) =>
          envelope.userId === userId && envelope.month === month && envelope.category === row.category,
      );
      if (already) continue;
      db.envelopes.push({
        id: newId(),
        userId,
        month,
        category: row.category,
        plannedCents: row.plannedCents,
        custom: false,
      });
    }

    /* Notifications: exactly what was ticked, nothing else. */
    const topics = Object.fromEntries(
      notificationTopics.map((topic) => [topic, answers.notificationTopics.includes(topic)]),
    ) as Record<NotificationTopic, boolean>;

    const prefsIndex = db.notificationPrefs.findIndex((row) => row.userId === userId);
    const prefs = { userId, topics, quietFrom: 23, quietTo: 8, updatedAt: now };
    if (prefsIndex === -1) db.notificationPrefs.push(prefs);
    else db.notificationPrefs[prefsIndex] = prefs;

    /* Memory starts empty and is nudged by behaviour from here. */
    if (!db.memories.some((row) => row.userId === userId)) {
      db.memories.push(emptyMemory(userId, now));
    }

    /* Auto-join the campus and city newcomer communities. Joining is the whole
       point of asking which campus they are at, and making them find it
       afterwards loses most of them. */
    const autoJoin = db.communities.filter(
      (community) =>
        (campus && community.campusSlug === campus.slug) ||
        (community.citySlug === city.slug && community.kind === "neighbourhood"),
    );
    for (const community of autoJoin) {
      if (db.communityMembers.some((m) => m.communityId === community.id && m.userId === userId)) {
        continue;
      }
      db.communityMembers.push({
        communityId: community.id,
        userId,
        role: "member",
        joinedAt: now,
      });
      community.memberCount += 1;
    }
  });

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Finish                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Separate from `completeOnboarding` so the client can show the "building your
 * city" animation against a completed save rather than racing it.
 */
export async function finishOnboarding(): Promise<void> {
  const userId = await requireUserId();

  await upsert("outcomes", () => false, {
    id: newId(),
    userId,
    kind: "budget-action",
    detail: "onboarding-complete",
    createdAt: nowIso(),
  });

  redirect("/home");
}

/** Records that a student skipped a step, so the flow can be improved. */
export async function recordSkip(step: string): Promise<void> {
  const userId = await requireUserId();
  await insert("searchMisses", {
    id: newId(),
    userId,
    citySlug: "-",
    intent: `onboarding-skip:${step}`,
    surface: "search",
    resultCount: 0,
    createdAt: nowIso(),
  });
}
