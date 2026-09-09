import "server-only";

import { cache } from "react";

import { campusesForCity } from "@/data/cities";
import { findNeighbourhood, neighbourhoodsForCity } from "@/data/neighbourhoods";
import { loadCityPlaces } from "@/server/queries/places";
import type { Place } from "@/data/types";
import {
  buildCityGraph,
  key,
  type CityGraph,
  type GraphClaim,
  type GraphNodeKind,
  type GraphSave,
  type GraphStudent,
  type NodeKey,
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
 * Which neighbourhood a seeded place sits in.
 *
 * Derived from the name, because that is genuinely where the information is:
 * the seeded rows are written as "Fruit market, Lavapiés". Deriving beats
 * adding an `area` column and filling it with the same string twice.
 *
 * The failure mode is stated rather than papered over. A place whose suffix is
 * an area with no row of its own — "Mensa, Mitte", "University canteen,
 * Strand" — resolves to nothing, and every consumer treats a missing area as
 * "we do not know" rather than guessing the nearest one. A wrong area is worse
 * than no area: it produces a confident commute figure for the wrong journey.
 */
export function areaSlugForPlace(place: Place): string | null {
  const suffix = place.name.split(",").pop()?.trim();
  if (!suffix || suffix === place.name.trim()) return null;
  return findNeighbourhood(place.citySlug, suffix)?.slug ?? null;
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

  /* Which neighbourhood each place sits in, so the graph can relate a place to
     an area. Provider-backed now, so a provider outage means the graph simply
     has no place-to-area edges this request rather than a stale set of them. */
  const areaOf = new Map<NodeKey, string>();
  const nearby = await loadCityPlaces({ citySlug, radiusMetres: 5_000, limit: 300 });
  if (nearby.ok) {
    for (const place of nearby.places) {
      const slug = areaSlugForPlace(place);
      if (slug) areaOf.set(key("place", place.id), slug);
    }
  }

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
    areaOf,
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
