import "server-only";

import { cache } from "react";

import { campusesForCity } from "@/data/cities";
import { findNeighbourhood, neighbourhoodsForCity } from "@/data/neighbourhoods";
import { areaForPoint } from "@/server/engines/neighbourhood";
import type { Place } from "@/data/types";
import {
  buildCityGraph,
  type CityGraph,
  type GraphClaim,
  type GraphNodeKind,
  type GraphSave,
  type GraphStudent,
} from "@/domain/graph";
import { findMany } from "@/server/db";
import { loadPublishedClaims } from "@/server/queries/truth";

/**
 * ============================================================================
 * CITY GRAPH — reads
 * ----------------------------------------------------------------------------
 * Loads the rows and hands them to `buildCityGraph`. All of the I/O and none
 * of the reasoning.
 *
 * Cached with React's per-request `cache`, which is the correct scope and not
 * a compromise. A longer-lived cache would be faster and would also mean a
 * student who saves a place does not see it reflected until it expires, which
 * for a product whose whole claim is "this is what students know right now"
 * is the wrong trade. One build per request, shared by every component in that
 * render, is what this needs.
 *
 * PRIVACY. Two things are enforced here rather than downstream:
 *
 *   Only students who set `privacy.discoverable` enter the graph as
 *   discoverable, so they cannot appear in any aggregate. They are still
 *   indexed as themselves — a student always sees their own saves.
 *
 *   The area a student is placed in is `homeArea`, the coarse label, never
 *   `homePoint`. The precise coordinate is not read in this file and must not
 *   be: the graph exists to answer questions at neighbourhood resolution, and
 *   the moment it holds a coordinate, some future feature will render one.
 * ============================================================================
 */

/**
 * Which neighbourhood a place sits in, from its coordinates.
 *
 * IT USED TO READ THE NAME, and that is worth recording because of how it
 * failed. The twenty-five seeded places were written as "Fruit market,
 * Lavapiés", so the area was genuinely in the string and deriving it beat
 * storing it twice. Then the seeded places were deleted and replaced with a
 * real provider, OpenStreetMap called the shop "Mercadona", and this function
 * began returning null for every place in every city. Nothing threw. The
 * "How this sits in your city" section simply stopped appearing, the city
 * graph lost every place-to-area edge, and the test that covered it skipped
 * itself and reported green.
 *
 * Now it is geography: the place has a real coordinate and so does the area,
 * so the question is answered by arithmetic rather than by punctuation.
 * `areaForPoint` is pure and lives with the other neighbourhood maths.
 *
 * The failure mode is unchanged and still stated: a place outside every area's
 * radius resolves to nothing, and every consumer treats a missing area as "we
 * do not know" rather than guessing the nearest one. A wrong area is worse
 * than no area — it produces a confident commute figure for the wrong journey.
 */
export function areaSlugForPlace(place: Place): string | null {
  if (place.lat === null || place.lng === null) return null;
  const area = areaForPoint(neighbourhoodsForCity(place.citySlug), {
    lat: place.lat,
    lng: place.lng,
  });
  return area?.slug ?? null;
}

/** Saved kinds the graph has nodes for. Plans and posts are not city objects. */
const GRAPH_KINDS = new Set<string>(["place", "event", "deal"]);

/**
 * The graph for one city.
 *
 * Everything it reads is already loaded by some other surface in a typical
 * request, so in practice this is cheap; the reason it is one function rather
 * than five hooks is that a partially built graph is a graph that answers
 * "no friends saved this" when it means "friendships were not loaded".
 */
export const loadCityGraph = cache(async (citySlug: string): Promise<CityGraph> => {
  const [profiles, saved, friendships, claimViews] = await Promise.all([
    findMany("profiles", (row) => row.citySlug === citySlug),
    findMany("saved", (row) => GRAPH_KINDS.has(row.kind)),
    findMany("friendships", (row) => row.status === "accepted"),
    loadPublishedClaims(citySlug),
  ]);

  const areas = neighbourhoodsForCity(citySlug);

  const students: GraphStudent[] = profiles.map((profile) => ({
    userId: profile.userId,
    campusSlug: profile.campusSlug,
    areaSlug: findNeighbourhood(citySlug, profile.homeArea)?.slug ?? null,
    discoverable: profile.privacy.discoverable,
  }));

  const inCity = new Set(students.map((student) => student.userId));

  const saves: GraphSave[] = saved
    .filter((row) => inCity.has(row.userId))
    .map((row) => ({
      userId: row.userId,
      targetKind: row.kind as GraphNodeKind,
      targetId: row.targetId,
    }));

  const claims: GraphClaim[] = claimViews.map((view) => ({
    id: view.claim.id,
    targetKind: view.claim.targetKind as GraphNodeKind | null,
    targetId: view.claim.targetId,
    subject: view.claim.subject,
    statement: view.claim.statement,
    amountCents: view.claim.amountCents,
    verifiers: view.assessment.verificationCount,
  }));

  return buildCityGraph({
    citySlug,
    campuses: campusesForCity(citySlug),
    areas,
    students,
    saves,
    friendships: friendships
      .filter((row) => inCity.has(row.requesterId) && inCity.has(row.addresseeId))
      .map((row) => ({ a: row.requesterId, b: row.addresseeId })),
    claims,
    now: new Date(),
  });
});

/**
 * The viewer as a graph node.
 *
 * Falls back to a non-discoverable stub for a student with no profile row in
 * this city — someone browsing a city they have not moved to. They still get
 * relations about places; they simply are not part of anyone's count.
 */
export function viewerNode(graph: CityGraph, userId: string): GraphStudent {
  return (
    graph.studentsById.get(userId) ?? {
      userId,
      campusSlug: null,
      areaSlug: null,
      discoverable: false,
    }
  );
}
