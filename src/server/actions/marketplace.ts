"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { findOne, insert, newId, nowIso, update } from "@/server/db";
import { limits, rateLimit } from "@/server/rate-limit";
import { requireUserId } from "@/server/viewer";

/**
 * ============================================================================
 * MARKETPLACE ACTIONS
 * ----------------------------------------------------------------------------
 * Listing and updating second-hand items.
 *
 * The safety rule is enforced by the schema, not by guidance: `meetArea` is a
 * required public-place label and there is **no address field on a listing at
 * all**. A seller physically cannot publish where they live, which is a much
 * stronger guarantee than a warning nobody reads.
 * ============================================================================
 */

export type ListingResult = { ok: true; id: string } | { ok: false; message: string };

const schema = z.object({
  title: z.string().trim().min(3, "Say what it is.").max(100),
  detail: z.string().trim().min(1, "Describe the condition.").max(600),
  category: z.enum([
    "furniture",
    "books",
    "electronics",
    "kitchen",
    "bikes",
    "clothing",
    "supplies",
    "free",
  ]),
  price: z.string().trim(),
  condition: z.enum(["new", "good", "used", "worn"]),
  /* A public place. There is deliberately no address field to put one in. */
  meetArea: z
    .string()
    .trim()
    .min(3, "Give a public meeting point — a campus building or a station.")
    .max(80),
});

export async function createListing(formData: FormData): Promise<ListingResult> {
  const userId = await requireUserId();

  const gate = rateLimit(`listing:${userId}`, limits.post.limit, limits.post.windowSeconds);
  if (!gate.ok) return { ok: false, message: "Slow down a moment." };

  const parsed = schema.safeParse({
    title: formData.get("title"),
    detail: formData.get("detail"),
    category: formData.get("category"),
    price: formData.get("price") ?? "0",
    condition: formData.get("condition") ?? "good",
    meetArea: formData.get("meetArea"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the listing." };
  }

  const profile = await findOne("profiles", (row) => row.userId === userId);
  if (!profile) return { ok: false, message: "Finish setting up your account first." };

  const raw = parsed.data.price.replace(",", ".");
  const priceCents =
    parsed.data.category === "free" ? 0 : Math.max(0, Math.round(Number(raw || "0") * 100));

  if (!Number.isFinite(priceCents)) return { ok: false, message: "That price did not parse." };

  const id = newId();
  await insert("listings", {
    id,
    citySlug: profile.citySlug,
    campusSlug: profile.campusSlug,
    sellerId: userId,
    title: parsed.data.title,
    detail: parsed.data.detail,
    category: parsed.data.category,
    priceCents,
    condition: parsed.data.condition,
    meetArea: parsed.data.meetArea,
    status: "active",
    /* Flagged when listed from Leaving Mode, so arriving students see the
       departing stock first — which is the whole loop. */
    fromLeaving: formData.get("fromLeaving") === "1",
    createdAt: nowIso(),
    soldAt: null,
  });

  revalidatePath("/marketplace");
  return { ok: true, id };
}

/** Mark your own listing sold or withdrawn. */
export async function setListingStatus(
  id: string,
  status: "active" | "reserved" | "sold" | "withdrawn",
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();

  const updated = await update(
    "listings",
    (row) => row.id === id && row.sellerId === userId,
    { status, soldAt: status === "sold" ? nowIso() : null },
  );

  revalidatePath("/marketplace");
  return { ok: updated !== null };
}
