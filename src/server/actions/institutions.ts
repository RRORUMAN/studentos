"use server";

import { z } from "zod";

import { institutions } from "@/data/institutions";
import {
  describeInstitution,
  searchInstitutions,
  type InstitutionSubmission,
} from "@/domain/institutions";
import { findMany, insert, newId, nowIso } from "@/server/db";
import { callerKey } from "@/server/caller";
import { limits, rateLimitShared } from "@/server/rate-limit";
import { currentUserId } from "@/server/viewer";

/**
 * ============================================================================
 * INSTITUTION SEARCH AND SUBMISSION
 * ----------------------------------------------------------------------------
 * The two things the "where do you study" step needs from the server.
 *
 * WHY THIS IS A SERVER ACTION rather than a filter over data bundled into the
 * page. The registry is a few hundred rows per country today and will be a few
 * thousand once more countries are imported. Shipping it to the browser makes
 * onboarding -- the one screen where a slow first paint costs a signup --
 * carry the entire higher education sector of a country before it can render a
 * text field. The scan itself costs a fraction of a millisecond, so what the
 * student waits for is one round trip, behind a debounce, after a screen that
 * already rendered.
 *
 * The city's own institutions are passed in by the server component and shown
 * immediately, so the common case -- "my university is one of the fifteen in
 * this city" -- involves no request at all.
 *
 * NOTHING HERE REQUIRES A SESSION. The signed-out onboarding preview on the
 * marketing site asks the same question, and a student deciding whether to sign
 * up is exactly the person who needs to see their own university listed.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What the picker renders. Deliberately not the whole `Institution`: a client
 * component has no use for coordinates or a Wikidata id, and every field sent
 * is a field somebody later renders by accident.
 */
export type InstitutionOption = {
  id: string;
  name: string;
  /** "University · Getafe" -- what kind of place, and where. */
  detail: string;
  /** Set when StudentOS knows the neighbourhood, and so the commute. */
  campusSlug: string | null;
  /** The alias that matched, when it is not visible in the name shown. */
  matchedAs: string | null;
};

const searchSchema = z.object({
  query: z.string().max(120),
  citySlug: z.string().max(80).nullable(),
  countryCode: z.string().length(2).nullable(),
});

export async function findInstitutions(input: {
  query: string;
  citySlug: string | null;
  countryCode: string | null;
}): Promise<InstitutionOption[]> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return [];

  /* Cheap, but reachable without a session, so it gets a ceiling. Keyed by the
     forwarded address where there is one and by a shared bucket where there is
     not -- which is the honest behaviour rather than an unlimited endpoint
     dressed up as a limited one. */
  const gate = await rateLimitShared(
    `institutions:${await callerKey()}`,
    limits.chat.limit,
    limits.chat.windowSeconds,
  );
  if (!gate.ok) return [];

  const { query, citySlug, countryCode } = parsed.data;

  return searchInstitutions(institutions, query, { citySlug, countryCode, limit: 8 }).map((hit) => ({
    id: hit.institution.id,
    name: hit.institution.officialName,
    detail: describeInstitution(hit.institution),
    campusSlug: hit.institution.campusSlug,
    /* Only worth showing when it explains a result that otherwise looks
       unrelated: searching "ICADE" and being given "Universidad Pontificia
       Comillas" is confusing until the row says why. */
    matchedAs:
      hit.matched === "alias" && hit.matchedText && !hit.institution.officialName.includes(hit.matchedText)
        ? hit.matchedText
        : null,
  }));
}

/* -------------------------------------------------------------------------- */
/* Submission                                                                  */
/* -------------------------------------------------------------------------- */

const submitSchema = z.object({
  name: z.string().trim().min(2).max(120),
  citySlug: z.string().min(1).max(80),
  countryCode: z.string().length(2),
});

/**
 * Record a university the registry did not have.
 *
 * This never gates anything. The student has already been allowed to carry on
 * with the name they typed -- that happens in the same submit as the rest of
 * onboarding -- and this row exists so an admin can turn one student's typing
 * into a registry entry or, more often, into an alias on a row that was there
 * all along under a name the search did not know.
 *
 * A duplicate submission of the same name in the same city is dropped rather
 * than queued twice, because the review queue is a list of decisions to make
 * and the same decision does not need making twice.
 */
export async function submitInstitution(input: {
  name: string;
  citySlug: string;
  countryCode: string;
}): Promise<{ ok: boolean }> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const gate = await rateLimitShared(
    `institution-submit:${await callerKey()}`,
    limits.report.limit,
    limits.report.windowSeconds,
  );
  if (!gate.ok) return { ok: false };

  const { name, citySlug, countryCode } = parsed.data;

  const existing = await findMany(
    "institutionSubmissions",
    (row) =>
      row.citySlug === citySlug &&
      row.status === "pending" &&
      row.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (existing.length > 0) return { ok: true };

  const submission: InstitutionSubmission = {
    id: newId(),
    userId: await currentUserId(),
    name,
    citySlug,
    countryCode: countryCode.toUpperCase(),
    status: "pending",
    mergedIntoId: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: nowIso(),
  };
  await insert("institutionSubmissions", submission);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Caller                                                                      */
/* -------------------------------------------------------------------------- */

