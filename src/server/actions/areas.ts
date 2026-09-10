"use server";

import { resolveCity } from "@/data/cities";
import { areaNamesForCity } from "@/data/neighbourhoods";

/**
 * ============================================================================
 * AREA NAMES FOR A CITY
 * ----------------------------------------------------------------------------
 * The neighbourhood chips on the onboarding home step, fetched when the
 * student picks a city rather than shipped with the bundle.
 *
 * WHY AN ACTION AND NOT AN IMPORT. `setup-flow.tsx` is a client component, so
 * importing the area registry there would put every area in every city into
 * the JavaScript that has to arrive before a new student can answer the first
 * question — around nine hundred rows today, and the number only goes one way.
 * Onboarding is the one screen in the product where the download cost is paid
 * by someone who has not yet been given a reason to wait. The city is not known
 * until the student picks one, so it is fetched then: one call, on a step
 * transition that is already a state change, for the city they actually chose.
 *
 * NO AUTHENTICATION AND NO ENTITLEMENT CHECK, deliberately. This returns the
 * names of the districts of a city — the same list on the public city pages,
 * derived from Wikidata. It reads nothing about the caller and writes nothing.
 * Gating it would mean a student cannot see the neighbourhoods of Vienna until
 * they have an account, on the step where they are deciding whether to make
 * one.
 * ============================================================================
 */
export async function areaNamesFor(citySlug: string): Promise<readonly string[]> {
  const city = resolveCity(citySlug);
  if (!city) return [];
  return areaNamesForCity(citySlug, city.neighbourhoods);
}
