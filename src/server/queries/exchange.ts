import "server-only";

import { cache } from "react";

import { getCampus } from "@/data/cities";
import {
  type ExchangeKind,
  type Listing,
  type ListingCategory,
  type ListingMode,
  listingKind,
  listingMode,
} from "@/domain/social";
import { findMany, findOne } from "@/server/db";
import { isBlocked } from "@/server/queries/social";

/**
 * ============================================================================
 * STUDENT EXCHANGE — queries
 * ----------------------------------------------------------------------------
 * Listings across the five lanes, with the trust signals a stranger needs
 * before meeting another stranger: verified badge, university, terms in the
 * city, and how many exchanges the person has completed. Never an address.
 * ============================================================================
 */

export type SellerView = {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  handle: string;
  verified: boolean;
  campusName: string | null;
  termsInCity: number;
  /** Listings marked sold or completed. The reputation number. */
  completed: number;
  /** Days since the account was made. A brand-new account is worth knowing about. */
  accountDays: number;
};

export type ListingView = {
  listing: Listing;
  kind: ExchangeKind;
  mode: ListingMode;
  seller: SellerView;
  saved: boolean;
  mine: boolean;
};

const DAY_MS = 86_400_000;

export const loadSeller = cache(async (userId: string, now = new Date()): Promise<SellerView | null> => {
  const [profile, completed] = await Promise.all([
    findOne("profiles", (row) => row.userId === userId),
    findMany("listings", (row) => row.sellerId === userId && (row.status === "sold" || row.status === "completed")),
  ]);
  if (!profile) return null;
  const campus = profile.campusSlug ? getCampus(profile.campusSlug) : undefined;
  return {
    userId,
    displayName: profile.displayName,
    avatarEmoji: profile.avatarEmoji,
    handle: profile.handle,
    verified: profile.studentVerifiedAt !== null,
    campusName: campus?.shortName ?? profile.universityName ?? null,
    termsInCity: profile.termsInCity,
    completed: completed.length,
    accountDays: Math.max(0, Math.floor((now.getTime() - Date.parse(profile.createdAt)) / DAY_MS)),
  };
});

export type ListingFilter = {
  kind?: ExchangeKind | null;
  category?: ListingCategory | null;
  mode?: ListingMode | null;
  query?: string | null;
};

export async function loadListings(input: {
  citySlug: string;
  viewerId: string;
  arriving: boolean;
  filter?: ListingFilter;
  now?: Date;
}): Promise<ListingView[]> {
  const now = input.now ?? new Date();
  const filter = input.filter ?? {};
  const needle = filter.query?.trim().toLowerCase() ?? "";

  const [rows, saved] = await Promise.all([
    findMany("listings", (row) => row.citySlug === input.citySlug && row.status === "active"),
    findMany("saved", (row) => row.userId === input.viewerId && row.kind === "listing"),
  ]);
  const savedIds = new Set(saved.map((row) => row.targetId));

  const visible = rows.filter((row) => {
    if (filter.kind && listingKind(row) !== filter.kind) return false;
    if (filter.category && row.category !== filter.category) return false;
    if (filter.mode && listingMode(row) !== filter.mode) return false;
    if (needle && !`${row.title} ${row.detail} ${row.category}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  /* Sellers, once each. Blocked people's rows are hidden in both directions. */
  const sellerIds = [...new Set(visible.map((row) => row.sellerId))];
  const sellers = new Map<string, SellerView>();
  await Promise.all(
    sellerIds.map(async (id) => {
      if (id !== input.viewerId && (await isBlocked(input.viewerId, id))) return;
      const seller = await loadSeller(id, now);
      if (seller) sellers.set(id, seller);
    }),
  );

  return visible
    .filter((row) => sellers.has(row.sellerId))
    .sort(
      (a, b) =>
        /* Departing stock first for arriving students; newest first otherwise. */
        (input.arriving ? Number(b.fromLeaving) - Number(a.fromLeaving) : 0) || b.createdAt.localeCompare(a.createdAt),
    )
    .map((row) => ({
      listing: row,
      kind: listingKind(row),
      mode: listingMode(row),
      seller: sellers.get(row.sellerId)!,
      saved: savedIds.has(row.id),
      mine: row.sellerId === input.viewerId,
    }));
}

export async function loadListing(id: string, viewerId: string, now = new Date()): Promise<(ListingView & { more: Listing[] }) | null> {
  const row = await findOne("listings", (candidate) => candidate.id === id);
  if (!row) return null;
  if (row.status === "withdrawn" && row.sellerId !== viewerId) return null;
  if (row.sellerId !== viewerId && (await isBlocked(viewerId, row.sellerId))) return null;

  const [seller, saved, more] = await Promise.all([
    loadSeller(row.sellerId, now),
    findOne("saved", (candidate) => candidate.userId === viewerId && candidate.kind === "listing" && candidate.targetId === id),
    findMany("listings", (candidate) => candidate.sellerId === row.sellerId && candidate.id !== id && candidate.status === "active"),
  ]);
  if (!seller) return null;

  return {
    listing: row,
    kind: listingKind(row),
    mode: listingMode(row),
    seller,
    saved: saved !== null,
    mine: row.sellerId === viewerId,
    more: more.slice(0, 4),
  };
}

export async function loadMyListings(userId: string): Promise<Listing[]> {
  const rows = await findMany("listings", (row) => row.sellerId === userId && row.status !== "withdrawn");
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Counts per lane for the tab rail, so an empty lane says so before it is opened. */
export async function laneCounts(citySlug: string): Promise<Record<ExchangeKind, number>> {
  const rows = await findMany("listings", (row) => row.citySlug === citySlug && row.status === "active");
  const counts: Record<ExchangeKind, number> = { sell: 0, borrow: 0, help: 0, ride: 0, free: 0 };
  for (const row of rows) counts[listingKind(row)] += 1;
  return counts;
}
