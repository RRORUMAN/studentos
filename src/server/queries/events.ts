import "server-only";

import { cache } from "react";

import type { CityEvent, EventResponse, Invite } from "@/domain/types";
import { findMany } from "@/server/db";
import type { Scored } from "@/server/engines/recommend";
import { loadFriendIds } from "@/server/queries/social";

/**
 * ============================================================================
 * EVENT QUERIES
 * ----------------------------------------------------------------------------
 * Responses (interested / going) and the social context around an event.
 *
 * "Energy" is every social fact the rows support and nothing else: how many
 * are interested, how many from your campus, which friends, and how many
 * people are looking for company via Anyone Down?. It never includes where
 * anyone is.
 * ============================================================================
 */

export const loadEventResponses = cache(async (): Promise<EventResponse[]> => {
  return findMany("eventResponses", () => true);
});

export type EventEnergy = {
  interested: number;
  going: number;
  fromCampus: number;
  friends: { userId: string; displayName: string; avatarEmoji: string; status: "interested" | "going" }[];
  lookingForCompany: number;
  mine: "interested" | "going" | null;
};

/** Social context for a set of events, in one pass. */
export async function loadEventEnergy(input: {
  viewerId: string;
  campusSlug: string | null;
  eventIds: readonly string[];
}): Promise<Map<string, EventEnergy>> {
  const wanted = new Set(input.eventIds);
  const [responses, profiles, friendIds, invites] = await Promise.all([
    findMany("eventResponses", (row) => wanted.has(row.eventId)),
    findMany("profiles", () => true),
    loadFriendIds(input.viewerId),
    findMany(
      "invites",
      (row) => row.anchorKind === "event" && row.anchorId !== null && wanted.has(row.anchorId),
    ),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const out = new Map<string, EventEnergy>();

  for (const id of input.eventIds) {
    const rows = responses.filter((row) => row.eventId === id);
    const mine = rows.find((row) => row.userId === input.viewerId)?.status ?? null;

    out.set(id, {
      interested: rows.filter((row) => row.status === "interested").length,
      going: rows.filter((row) => row.status === "going").length,
      fromCampus: input.campusSlug
        ? rows.filter((row) => byUser.get(row.userId)?.campusSlug === input.campusSlug).length
        : 0,
      friends: rows
        .filter((row) => friendIds.has(row.userId))
        .map((row) => {
          const profile = byUser.get(row.userId);
          return {
            userId: row.userId,
            displayName: profile?.displayName ?? "A friend",
            avatarEmoji: profile?.avatarEmoji ?? "🙂",
            status: row.status,
          };
        }),
      lookingForCompany: invites.filter((invite) => invite.anchorId === id).length,
      mine,
    });
  }

  return out;
}

/** Ids of events at least one friend is interested in or going to. */
export async function loadFriendEventIds(viewerId: string): Promise<Set<string>> {
  const [responses, friendIds] = await Promise.all([loadEventResponses(), loadFriendIds(viewerId)]);
  return new Set(responses.filter((row) => friendIds.has(row.userId)).map((row) => row.eventId));
}

/** Total interest including live responses, for the card's social line. */
export function totalInterest(event: CityEvent, energy: EventEnergy | undefined): number {
  return event.interested + (energy ? energy.interested + energy.going : 0);
}

export type EventTab =
  | "for-you"
  | "tonight"
  | "free"
  | "weekend"
  | "week"
  | "campus"
  | "social"
  | "trending"
  | "new";

export const eventTabs: readonly { value: EventTab; label: string }[] = [
  { value: "for-you", label: "For you" },
  { value: "tonight", label: "Tonight" },
  { value: "free", label: "Free" },
  { value: "weekend", label: "This weekend" },
  { value: "week", label: "This week" },
  { value: "campus", label: "Campus" },
  { value: "social", label: "Social" },
  { value: "trending", label: "Trending" },
  { value: "new", label: "New" },
];

export const eventKindFilters: readonly { value: string; label: string }[] = [
  { value: "music", label: "Music" },
  { value: "nightlife", label: "Nightlife" },
  { value: "sports", label: "Sports" },
  { value: "networking", label: "Networking" },
  { value: "university", label: "University" },
  { value: "food", label: "Food" },
  { value: "culture", label: "Culture" },
  { value: "outdoor", label: "Outdoor" },
  { value: "tech", label: "Technology" },
  { value: "travel", label: "Travel" },
];

const SOCIAL_KINDS = new Set(["social", "networking", "nightlife", "food"]);

/**
 * Re-order scored events for the tabs the scorer does not know about.
 * Filtering by horizon and price happens upstream in `loadScoredEvents`.
 */
export function arrangeEvents(
  events: readonly Scored<CityEvent>[],
  tab: EventTab,
  energy: ReadonlyMap<string, EventEnergy>,
  invites: readonly Invite[],
  now: Date,
): Scored<CityEvent>[] {
  const list = [...events];

  if (tab === "trending") {
    return list.sort(
      (a, b) =>
        totalInterest(b.item, energy.get(b.item.id)) + b.item.confirmations * 2 -
        (totalInterest(a.item, energy.get(a.item.id)) + a.item.confirmations * 2),
    );
  }

  if (tab === "new") {
    const week = now.getTime() - 7 * 86_400_000;
    return list
      .filter((entry) => Date.parse(entry.item.observedAt) >= week)
      .sort((a, b) => b.item.observedAt.localeCompare(a.item.observedAt));
  }

  if (tab === "social") {
    const anchored = new Set(invites.map((invite) => invite.anchorId));
    return list
      .filter(
        (entry) =>
          SOCIAL_KINDS.has(entry.item.kind) ||
          anchored.has(entry.item.id) ||
          (energy.get(entry.item.id)?.going ?? 0) > 0,
      )
      .sort((a, b) => b.match - a.match);
  }

  if (tab === "tonight" || tab === "week" || tab === "weekend") {
    return list.sort((a, b) => a.item.startsAt.localeCompare(b.item.startsAt));
  }

  return list;
}
