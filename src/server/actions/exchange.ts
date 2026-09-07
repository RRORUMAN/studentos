"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  exchangeKindMeta,
  exchangeKinds,
  type ListingCategory,
  type ListingStatus,
  listingCategoryMeta,
} from "@/domain/social";
import { findMany, findOne, insert, newId, nowIso, update } from "@/server/db";
import { dmChannel } from "@/server/queries/chat";
import { isBlocked } from "@/server/queries/social";
import { limits, rateLimit } from "@/server/rate-limit";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * STUDENT EXCHANGE — actions
 * ----------------------------------------------------------------------------
 * Post, update, message, report. The safety rule is enforced by the schema,
 * not by guidance: `meetArea` is a required public-place label and there is
 * **no address field on a listing at all**. A student physically cannot
 * publish where they live.
 *
 * Messaging opens a direct channel between the two students and drops the
 * listing in as an attachment, so the conversation starts with the thing it
 * is about rather than "hi, is this still available".
 * ============================================================================
 */

export type ListingResult = { ok: true; id: string; message?: string } | { ok: false; message: string };

const categories = Object.keys(listingCategoryMeta) as [ListingCategory, ...ListingCategory[]];

const schema = z.object({
  kind: z.enum(exchangeKinds as [string, ...string[]]),
  mode: z.enum(["offer", "request"]),
  title: z.string().trim().min(3, "Say what it is.").max(100),
  detail: z.string().trim().min(1, "Add a line of detail.").max(600),
  category: z.enum(categories),
  price: z.string().trim().default(""),
  condition: z.enum(["new", "good", "used", "worn"]).default("good"),
  /* A public place. There is deliberately no address field to put one in. */
  meetArea: z.string().trim().min(3, "Give a public meeting point — a campus building or a station.").max(80),
  whenAt: z.string().datetime({ offset: true }).optional().nullable(),
  fromLeaving: z.boolean().default(false),
});

function revalidate(id?: string): void {
  revalidatePath("/exchange");
  revalidatePath("/home");
  revalidatePath("/leaving");
  if (id) revalidatePath(`/exchange/${id}`);
}

export async function createListing(formData: FormData): Promise<ListingResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`listing:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const parsed = schema.safeParse({
    kind: formData.get("kind") ?? "sell",
    mode: formData.get("mode") ?? "offer",
    title: formData.get("title"),
    detail: formData.get("detail"),
    category: formData.get("category"),
    price: formData.get("price") ?? "",
    condition: formData.get("condition") ?? "good",
    meetArea: formData.get("meetArea"),
    whenAt: formData.get("whenAt") || null,
    fromLeaving: formData.get("fromLeaving") === "1",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the listing." };

  const data = parsed.data;
  const kind = data.kind as keyof typeof exchangeKindMeta;
  const lane = exchangeKindMeta[kind];
  if (!lane.categories.includes(data.category)) return { ok: false, message: "That category is not in this lane." };

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const raw = data.price.replace(",", ".");
  const priceCents = !lane.priced || kind === "free" ? 0 : Math.max(0, Math.round(Number(raw || "0") * 100));
  if (!Number.isFinite(priceCents)) return { ok: false, message: "That price did not parse." };

  const id = newId();
  await insert("listings", {
    id,
    citySlug: profile.citySlug,
    campusSlug: profile.campusSlug,
    sellerId: userId,
    kind,
    mode: data.mode,
    title: data.title,
    detail: data.detail,
    category: data.category,
    priceCents,
    condition: data.condition,
    meetArea: data.meetArea,
    status: "active",
    fromLeaving: data.fromLeaving,
    whenAt: data.whenAt ?? null,
    createdAt: nowIso(),
    soldAt: null,
  });

  await insert("outcomes", { id: newId(), userId, kind: "community-contribution", detail: `exchange:${kind}:${data.mode}`, createdAt: nowIso() });
  revalidate(id);
  return { ok: true, id };
}

const statuses: [ListingStatus, ...ListingStatus[]] = ["active", "reserved", "sold", "completed", "withdrawn"];

/** Mark your own listing reserved, sold, completed, withdrawn or active again. */
export async function setListingStatus(id: string, status: ListingStatus): Promise<ListingResult> {
  const userId = await requireUserId();
  const check = z.enum(statuses).safeParse(status);
  if (!check.success) return { ok: false, message: "Unknown status." };

  const closed = status === "sold" || status === "completed";
  const updated = await update("listings", (row) => row.id === id && row.sellerId === userId, {
    status,
    soldAt: closed ? nowIso() : null,
  });
  if (!updated) return { ok: false, message: "Not your listing." };
  if (closed) {
    await insert("outcomes", { id: newId(), userId, kind: "used-deal", detail: `exchange-${status}:${id}`, createdAt: nowIso() });
  }
  revalidate(id);
  return { ok: true, id, message: status === "active" ? "Back up." : status === "withdrawn" ? "Taken down." : `Marked ${status}.` };
}

/**
 * Open a direct chat with the poster about this listing. Returns the channel
 * so the client can navigate to it. The first message carries the listing as
 * an attachment; sending it again does not duplicate it.
 */
export async function messageAboutListing(listingId: string): Promise<{ ok: true; channel: string } | { ok: false; message: string }> {
  const userId = await requireUserId();
  const listing = await findOne("listings", (row) => row.id === listingId);
  if (!listing) return { ok: false, message: "That listing is gone." };
  if (listing.sellerId === userId) return { ok: false, message: "That is your own listing." };
  if (await isBlocked(userId, listing.sellerId)) return { ok: false, message: "You cannot message this student." };

  const gate = rateLimit(`chat:${userId}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const channel = dmChannel(userId, listing.sellerId);
  const already = await findMany(
    "chat",
    (row) => row.channel === channel && row.authorId === userId && row.attachment?.kind === "listing" && row.attachment.id === listingId,
  );
  if (already.length === 0) {
    const now = nowIso();
    await insert("chat", {
      id: newId(),
      citySlug: listing.citySlug,
      channel,
      authorId: userId,
      body: listing.mode === "request" ? `About "${listing.title}" — I might be able to help.` : `Is "${listing.title}" still available?`,
      replyToId: null,
      attachment: { kind: "listing", id: listingId },
      createdAt: now,
    });
    const me = await findOne("profiles", (row) => row.userId === userId);
    await insert("notifications", {
      id: newId(),
      userId: listing.sellerId,
      topic: "friends-plans",
      title: `${me?.displayName ?? "A student"} messaged you about "${listing.title}"`,
      body: "Open the chat to reply. Meet somewhere public.",
      href: `/pulse/chat/${channel}`,
      readAt: null,
      createdAt: now,
    });
  }
  revalidatePath("/pulse/chat");
  return { ok: true, channel };
}

const reportSchema = z.object({
  reason: z.enum(["scam", "spam", "harassment", "unsafe", "wrong-info", "other"]),
  note: z.string().trim().max(300).optional().nullable(),
});

export async function reportListing(listingId: string, reason: string, note?: string | null): Promise<ListingResult> {
  const userId = await requireUserId();
  const gate = rateLimit(`report:${userId}`, limits.report.limit, limits.report.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };
  const parsed = reportSchema.safeParse({ reason, note });
  if (!parsed.success) return { ok: false, message: "Pick a reason." };

  const listing = await findOne("listings", (row) => row.id === listingId);
  if (!listing) return { ok: false, message: "That listing is gone." };

  await insert("contentReports", {
    id: newId(),
    userId,
    targetKind: "listing",
    targetId: listingId,
    reason: parsed.data.reason,
    note: parsed.data.note ?? null,
    status: "open",
    createdAt: nowIso(),
    resolvedAt: null,
    resolution: null,
  });
  return { ok: true, id: listingId, message: "Reported. Thank you — it is anonymous." };
}
