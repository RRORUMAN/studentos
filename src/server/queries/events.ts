import "server-only";

import { cache } from "react";

import type { EventResponse } from "@/domain/types";
import { findMany } from "@/server/db";
import type { EventEnergy } from "@/server/engines/recommend";
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
 *
 * The tab logic itself (`arrangeEvents`, `eventTabs`) lives in the pure
 * recommend engine so it can be unit-tested without a server runtime; it is
 * re-exported here so existing imports keep working.
 * ============================================================================
 */

export {
  arrangeEvents,
  eventKindFilters,
  eventTabs,
  interestVelocity,
  isSocialEvent,
  totalInterest,
  UNDER_TEN_CENTS,
} from "@/server/engines/recommend";
export type { EventEnergy, EventTab } from "@/server/engines/recommend";

export const loadEventResponses = cache(async (): Promise<EventResponse[]> => {
  return findMany("eventResponses", () => true);
});

/** How far back a response counts as "recent" for the trending signal. */
const RECENT_MS = 3 * 86_400_000;

/** Social context for a set of events, in one pass. */
export async function loadEventEnergy(input: {
  viewerId: string;
  campusSlug: string | null;
  eventIds: readonly string[];
  /** The request clock. Defaults to wall time for callers that have none. */
  now?: Date;
}): Promise<Map<string, EventEnergy>> {
  const wanted = new Set(input.eventIds);
  const since = (input.now ?? new Date()).getTime() - RECENT_MS;

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
      recent: rows.filter((row) => Date.parse(row.respondedAt) >= since).length,
    });
  }

  return out;
}

/** Ids of events at least one friend is interested in or going to. */
export async function loadFriendEventIds(viewerId: string): Promise<Set<string>> {
  const [responses, friendIds] = await Promise.all([loadEventResponses(), loadFriendIds(viewerId)]);
  return new Set(responses.filter((row) => friendIds.has(row.userId)).map((row) => row.eventId));
}
