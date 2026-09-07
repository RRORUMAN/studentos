"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type ApplicationStatus,
  type LookingFor,
  type Opportunity,
  type RemotePreference,
  type ScheduleTag,
  type SkillKey,
  type WorkGroup,
  type WorkKind,
  applicationStatuses,
  emptyWorkProfile,
  riskFlags,
  riskLevel,
  scheduleTags,
  skillKeys,
  workKinds,
} from "@/domain/work";
import { findMany, findOne, insert, newId, nowIso, update, upsert } from "@/server/db";
import { dmChannel } from "@/server/queries/chat";
import { hourlyBaseline } from "@/server/queries/work";
import { isBlocked } from "@/server/queries/social";
import { limits, rateLimit } from "@/server/rate-limit";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * WORK — actions
 * ----------------------------------------------------------------------------
 * Everything a student can change: their work profile, a gig they are posting,
 * and where an application has got to.
 *
 * Two rules are enforced here rather than in the UI, because a rule the client
 * enforces is not a rule:
 *
 *   NO ADDRESSES. The gig schema has a `meetArea` — a public place — and no
 *   field an address could go in. A student posting "come to my flat to help
 *   me move" physically cannot publish where they live. This mirrors the
 *   Exchange, and for the same reason.
 *
 *   NOTHING IS MARKED APPLIED BY THE PRODUCT. `markApplied` is called by an
 *   explicit tap and nothing else. Opening an external link does not set it.
 *   A tracker that guesses is worse than no tracker: a student relying on it
 *   to know what they have already done will apply twice, or not at all.
 * ============================================================================
 */

export type WorkResult = { ok: true; id?: string; message?: string } | { ok: false; message: string };

function revalidate(id?: string): void {
  revalidatePath("/work");
  revalidatePath("/work/applications");
  revalidatePath("/home");
  if (id) revalidatePath(`/work/${id}`);
}

/* -------------------------------------------------------------------------- */
/* The work profile                                                            */
/* -------------------------------------------------------------------------- */

const money = z
  .string()
  .trim()
  .transform((raw) => raw.replace(",", "."))
  .transform((raw) => (raw === "" ? null : Math.round(Number(raw) * 100)))
  .refine((cents) => cents === null || (Number.isFinite(cents) && cents >= 0), "That is not an amount.");

const profileSchema = z.object({
  lookingFor: z.enum(["yes", "maybe", "no"]),
  groups: z.array(z.enum(["job", "gig", "project", "internship"])).max(4).default([]),
  skills: z.array(z.enum(skillKeys as [SkillKey, ...SkillKey[]])).max(skillKeys.length).default([]),
  languages: z
    .array(
      z.object({
        code: z.string().trim().min(2).max(5),
        level: z.enum(["basic", "conversational", "fluent", "native"]),
      }),
    )
    .max(6)
    .default([]),
  availability: z.array(z.enum(scheduleTags as [ScheduleTag, ...ScheduleTag[]])).max(4).default([]),
  /* Capped at a full-time week. The cap is not a legal opinion — see
     `src/data/work-rights.ts` — it is a bound on a number a student types. */
  hoursPerWeek: z.coerce.number().int().min(0).max(40).default(0),
  maxCommuteMinutes: z.coerce.number().int().min(5).max(120).default(40),
  minHourly: money,
  remotePreference: z.enum(["onsite", "either", "remote"]),
  monthlyTarget: money,
  currentIncome: money,
  headline: z.string().trim().max(120).optional().nullable(),
  cvUrl: z.string().trim().url().max(300).optional().nullable().or(z.literal("")),
  portfolioUrl: z.string().trim().url().max(300).optional().nullable().or(z.literal("")),
  linkedinUrl: z.string().trim().url().max(300).optional().nullable().or(z.literal("")),
  visibleToEmployers: z.boolean().default(false),
  gigAlerts: z.boolean().default(false),
});

function list(formData: FormData, name: string): string[] {
  return formData.getAll(name).map(String).filter(Boolean);
}

export async function saveWorkProfile(formData: FormData): Promise<WorkResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`workprofile:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  /* Languages arrive as parallel `language` / `level` fields so the form can
     add a row without JSON in a hidden input. */
  const codes = list(formData, "language");
  const levels = list(formData, "level");

  const parsed = profileSchema.safeParse({
    lookingFor: formData.get("lookingFor") ?? "no",
    groups: list(formData, "group"),
    skills: list(formData, "skill"),
    languages: codes.map((code, index) => ({ code, level: levels[index] ?? "conversational" })),
    availability: list(formData, "availability"),
    hoursPerWeek: formData.get("hoursPerWeek") ?? 0,
    maxCommuteMinutes: formData.get("maxCommuteMinutes") ?? 40,
    minHourly: String(formData.get("minHourly") ?? ""),
    remotePreference: formData.get("remotePreference") ?? "either",
    monthlyTarget: String(formData.get("monthlyTarget") ?? ""),
    currentIncome: String(formData.get("currentIncome") ?? ""),
    headline: formData.get("headline") ?? null,
    cvUrl: formData.get("cvUrl") ?? "",
    portfolioUrl: formData.get("portfolioUrl") ?? "",
    linkedinUrl: formData.get("linkedinUrl") ?? "",
    visibleToEmployers: formData.get("visibleToEmployers") === "1",
    gigAlerts: formData.get("gigAlerts") === "1",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const data = parsed.data;
  const existing = await findOne("workProfiles", (row) => row.userId === userId);
  const base = existing ?? emptyWorkProfile(userId, new Date());

  await upsert(
    "workProfiles",
    (row) => row.userId === userId,
    {
      ...base,
      lookingFor: data.lookingFor as LookingFor,
      groups: data.groups as WorkGroup[],
      skills: data.skills,
      languages: data.languages,
      availability: data.availability,
      hoursPerWeek: data.hoursPerWeek,
      maxCommuteMinutes: data.maxCommuteMinutes,
      minHourlyCents: data.minHourly,
      remotePreference: data.remotePreference as RemotePreference,
      monthlyTargetCents: data.monthlyTarget,
      currentIncomeCents: data.currentIncome,
      headline: data.headline || null,
      cvUrl: data.cvUrl || null,
      portfolioUrl: data.portfolioUrl || null,
      linkedinUrl: data.linkedinUrl || null,
      visibleToEmployers: data.visibleToEmployers,
      gigAlerts: data.gigAlerts,
      updatedAt: nowIso(),
    },
  );

  revalidatePath("/work/profile");
  revalidate();
  return { ok: true, message: "Saved." };
}

/* -------------------------------------------------------------------------- */
/* Posting a gig                                                               */
/* -------------------------------------------------------------------------- */

const gigSchema = z.object({
  title: z.string().trim().min(6, "Say what you need doing.").max(100),
  description: z.string().trim().min(20, "Give enough detail that someone can price it.").max(1200),
  kind: z.enum(workKinds as [WorkKind, ...WorkKind[]]),
  /* A public area. There is deliberately no address field to put one in. */
  meetArea: z.string().trim().min(3, "Give an area or a public meeting point.").max(80),
  remote: z.enum(["onsite", "hybrid", "remote"]).default("onsite"),
  pay: money,
  payPeriod: z.enum(["hour", "fixed"]).default("fixed"),
  hours: z.coerce.number().int().min(0).max(40).default(0),
  schedule: z.array(z.enum(scheduleTags as [ScheduleTag, ...ScheduleTag[]])).default([]),
  skills: z.array(z.enum(skillKeys as [SkillKey, ...SkillKey[]])).max(6).default([]),
  startsAt: z.string().datetime({ offset: true }).optional().nullable(),
});

/**
 * Post a paid request to other students.
 *
 * Screened before it is stored, not after. `riskLevel` reads the text for the
 * patterns that mean somebody is about to be defrauded; a `block` verdict
 * stores the row as `pending` and it is never shown to anybody until a
 * moderator clears it. The poster is told plainly, rather than seeing a
 * success message and an invisible post.
 */
export async function postGig(formData: FormData): Promise<WorkResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`gig:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const parsed = gigSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    kind: formData.get("kind") ?? "ONE_OFF_GIG",
    meetArea: formData.get("meetArea"),
    remote: formData.get("remote") ?? "onsite",
    pay: String(formData.get("pay") ?? ""),
    payPeriod: formData.get("payPeriod") ?? "fixed",
    hours: formData.get("hours") ?? 0,
    schedule: list(formData, "schedule"),
    skills: list(formData, "skill"),
    startsAt: formData.get("startsAt") || null,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const data = parsed.data;
  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const now = nowIso();
  const id = newId();

  const draft: Opportunity = {
    id,
    provider: "students",
    providerSlug: "students",
    providerJobId: null,
    sourceUrl: null,
    title: data.title,
    description: data.description,
    kind: data.kind,
    employerId: null,
    employerName: null,
    postedByUserId: userId,
    citySlug: profile.citySlug,
    countryCode: profile.countryCode,
    area: data.meetArea,
    campusSlug: profile.campusSlug,
    remoteType: data.remote,
    pay:
      data.pay === null
        ? null
        : {
            minCents: data.pay,
            maxCents: null,
            period: data.payPeriod,
            currency: profile.currency,
          },
    hoursMin: data.hours > 0 ? data.hours : null,
    hoursMax: data.hours > 0 ? data.hours : null,
    schedule: data.schedule,
    startsAt: data.startsAt ?? null,
    languages: [],
    skills: data.skills,
    /* A student posting a gig for other students is saying so by posting here.
       That is the one case where the flag is genuinely known. */
    studentFriendly: true,
    internationalStudentFriendly: null,
    workAuthorizationNotes: null,
    applicationMethod: "internal",
    applicationUrl: null,
    postedAt: now,
    expiresAt: null,
    fetchedAt: now,
    lastSeenAt: now,
    moderation: "published",
    filledAt: null,
  };

  const flags = riskFlags(draft, await hourlyBaseline(profile.citySlug));
  const level = riskLevel(flags);
  if (level === "block") draft.moderation = "pending";

  await insert("opportunities", draft);
  await insert("outcomes", {
    id: newId(),
    userId,
    kind: "community-contribution",
    detail: `gig:${data.kind}`,
    createdAt: now,
  });

  revalidate(id);

  if (draft.moderation === "pending") {
    return {
      ok: true,
      id,
      message:
        "Posted, but held for a moderator: the wording matches patterns we withhold — money up front, or moving funds through someone's account. If that is not what you meant, edit it and it will go live.",
    };
  }

  return { ok: true, id, message: "Posted." };
}

/** Take your own gig down, or mark it done. Only the poster may. */
export async function closeGig(id: string, filled: boolean): Promise<WorkResult> {
  const userId = await requireUserId();
  const changed = await update(
    "opportunities",
    (row) => row.id === id && row.postedByUserId === userId,
    filled ? { filledAt: nowIso() } : { moderation: "hidden" },
  );
  if (!changed) return { ok: false, message: "Not your posting." };
  revalidate(id);
  return { ok: true, id, message: filled ? "Marked as filled." : "Taken down." };
}

/* -------------------------------------------------------------------------- */
/* Applications                                                                */
/* -------------------------------------------------------------------------- */

const statusSchema = z.enum(applicationStatuses as [ApplicationStatus, ...ApplicationStatus[]]);

/**
 * Move an application along the ladder.
 *
 * `appliedAt` is stamped the first time the status reaches `applied` and never
 * moved afterwards, so a student who is rejected and later reopens the row
 * still sees the date they actually applied.
 */
export async function setApplicationStatus(
  opportunityId: string,
  status: ApplicationStatus,
): Promise<WorkResult> {
  const userId = await requireUserId();

  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, message: "Unknown status." };

  const opportunity = await findOne("opportunities", (row) => row.id === opportunityId);
  if (!opportunity) return { ok: false, message: "That posting is gone." };

  const now = nowIso();
  const existing = await findOne(
    "applications",
    (row) => row.userId === userId && row.opportunityId === opportunityId,
  );

  const appliedAt =
    existing?.appliedAt ??
    (parsed.data === "applied" || parsed.data === "interview" || parsed.data === "offer"
      ? now
      : null);

  if (existing) {
    await update("applications", (row) => row.id === existing.id, {
      status: parsed.data,
      appliedAt,
      updatedAt: now,
    });
  } else {
    await insert("applications", {
      id: newId(),
      userId,
      opportunityId,
      status: parsed.data,
      note: null,
      remindAt: null,
      appliedAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidate(opportunityId);
  return { ok: true, id: opportunityId, message: `Moved to ${parsed.data}.` };
}

const noteSchema = z.object({
  note: z.string().trim().max(500).nullable(),
  remindAt: z.string().datetime({ offset: true }).nullable(),
});

export async function setApplicationNote(
  opportunityId: string,
  note: string | null,
  remindAt: string | null,
): Promise<WorkResult> {
  const userId = await requireUserId();

  const parsed = noteSchema.safeParse({ note: note || null, remindAt: remindAt || null });
  if (!parsed.success) return { ok: false, message: "Check the note." };

  const existing = await findOne(
    "applications",
    (row) => row.userId === userId && row.opportunityId === opportunityId,
  );
  if (!existing) return { ok: false, message: "Track it first." };

  await update("applications", (row) => row.id === existing.id, {
    note: parsed.data.note,
    remindAt: parsed.data.remindAt,
    updatedAt: nowIso(),
  });

  revalidate(opportunityId);
  return { ok: true, id: opportunityId, message: "Saved." };
}

/* -------------------------------------------------------------------------- */
/* Messaging and reporting                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Open a direct chat with the student who posted a gig.
 *
 * Only for `provider: "students"`. There is no messaging channel to an
 * employer or a feed, and offering one that quietly went nowhere would be a
 * dead button in the place a student would least forgive it.
 */
export async function messageAboutGig(
  opportunityId: string,
): Promise<{ ok: true; channel: string } | { ok: false; message: string }> {
  const userId = await requireUserId();

  const opportunity = await findOne("opportunities", (row) => row.id === opportunityId);
  if (!opportunity) return { ok: false, message: "That posting is gone." };
  if (!opportunity.postedByUserId) {
    return { ok: false, message: "This one was not posted by a student, so there is nobody here to message." };
  }
  if (opportunity.postedByUserId === userId) return { ok: false, message: "That is your own posting." };
  if (await isBlocked(userId, opportunity.postedByUserId)) {
    return { ok: false, message: "You cannot message this student." };
  }

  const gate = rateLimit(`chat:${userId}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const channel = dmChannel(userId, opportunity.postedByUserId);
  const already = await findMany(
    "chat",
    (row) =>
      row.channel === channel &&
      row.authorId === userId &&
      row.attachment?.kind === "opportunity" &&
      row.attachment.id === opportunityId,
  );

  if (already.length === 0) {
    const now = nowIso();
    await insert("chat", {
      id: newId(),
      citySlug: opportunity.citySlug,
      channel,
      authorId: userId,
      body: `About "${opportunity.title}" — I can do this. When suits you?`,
      replyToId: null,
      attachment: { kind: "opportunity", id: opportunityId },
      createdAt: now,
    });

    const me = await findOne("profiles", (row) => row.userId === userId);
    await insert("notifications", {
      id: newId(),
      userId: opportunity.postedByUserId,
      topic: "friends-plans",
      title: `${me?.displayName ?? "A student"} replied to "${opportunity.title}"`,
      body: "Open the chat to reply. Agree the price before anyone starts.",
      href: `/pulse/chat/${channel}`,
      readAt: null,
      createdAt: now,
    });
  }

  /* Applying to a student gig is the message. Tracking it separately would
     make the student say the same thing twice. */
  await setApplicationStatus(opportunityId, "applied");

  revalidatePath("/pulse/chat");
  return { ok: true, channel };
}

const reportSchema = z.object({
  reason: z.enum(["scam", "spam", "harassment", "unsafe", "wrong-info", "expired", "other"]),
  note: z.string().trim().max(300).optional().nullable(),
});

export async function reportOpportunity(
  opportunityId: string,
  reason: string,
  note?: string | null,
): Promise<WorkResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`report:${userId}`, limits.report.limit, limits.report.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const parsed = reportSchema.safeParse({ reason, note });
  if (!parsed.success) return { ok: false, message: "Pick a reason." };

  const opportunity = await findOne("opportunities", (row) => row.id === opportunityId);
  if (!opportunity) return { ok: false, message: "That posting is gone." };

  await insert("contentReports", {
    id: newId(),
    userId,
    targetKind: "opportunity",
    targetId: opportunityId,
    reason: parsed.data.reason,
    note: parsed.data.note ?? null,
    status: "open",
    createdAt: nowIso(),
    resolvedAt: null,
    resolution: null,
  });

  /* A scam report withholds the posting immediately, before any human has
     looked at it. The cost of being wrong is a legitimate job offline for a
     day; the cost of being slow is a student's bank details. */
  if (parsed.data.reason === "scam") {
    await update("opportunities", (row) => row.id === opportunityId, { moderation: "pending" });
  }

  revalidate(opportunityId);
  return { ok: true, id: opportunityId, message: "Reported. Thank you — it is anonymous." };
}
