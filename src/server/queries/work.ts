import "server-only";

import { cache } from "react";

import { commuteTo, findNeighbourhood } from "@/data/neighbourhoods";
import {
  type Application,
  type Employer,
  type EmployerVerification,
  type Opportunity,
  type WorkProfile,
  dedupe,
  emptyWorkProfile,
  hourlyEquivalent,
  isLive,
} from "@/domain/work";
import type { Cents } from "@/domain/types";
import { type Match, matchesForStudents } from "@/server/engines/work-match";
import { findMany, findOne } from "@/server/db";

/**
 * ============================================================================
 * WORK — reads
 * ----------------------------------------------------------------------------
 * All of the I/O and none of the reasoning. Ranking lives in
 * `src/server/engines/work-match.ts`, which never touches the database, so the
 * scoring can be unit tested against fixtures and the reads can be memoised
 * without either one knowing about the other.
 *
 * Memoised with React's `cache`, which is per-request. That is the right scope
 * and not an accident: a longer-lived cache would hold a job open in one
 * student's list after a moderator hid it, and the whole point of the
 * moderation state is that it takes effect on the next page load.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* The student                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The student's work profile, or an empty one.
 *
 * Never null. A student who has not opened Work still needs a profile object
 * to rank against, and `emptyWorkProfile` is written so that its defaults are
 * the conservative ones — not looking, nothing shared, no alerts.
 */
export const loadWorkProfile = cache(async (userId: string): Promise<WorkProfile> => {
  const row = await findOne("workProfiles", (candidate) => candidate.userId === userId);
  return row ?? emptyWorkProfile(userId, new Date());
});

export const loadApplications = cache(async (userId: string): Promise<readonly Application[]> => {
  const rows = await findMany("applications", (row) => row.userId === userId);
  return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
});

/** The application row for one opportunity, so a card knows what to show. */
export async function applicationFor(
  userId: string,
  opportunityId: string,
): Promise<Application | null> {
  return (
    (await findOne(
      "applications",
      (row) => row.userId === userId && row.opportunityId === opportunityId,
    )) ?? null
  );
}

/* -------------------------------------------------------------------------- */
/* The board                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Everything a student in this city may currently see.
 *
 * Three filters, in this order and for three different reasons:
 *
 *   `moderation === "published"` — a withheld posting never leaves the server.
 *   `isLive` — expired and stale rows are not shown at all. A job board that
 *   keeps dead listings to look busy is the failure this product is competing
 *   against, and it is the one students name when they say job boards waste
 *   their time.
 *   `dedupe` — the same posting from two sources collapses to the more
 *   accountable one.
 *
 * Remote work is included regardless of city: a remote project in the same
 * country is a real option for a student anywhere in it, and excluding it on
 * geography would be the product misunderstanding its own filter.
 */
export const loadBoard = cache(async (citySlug: string): Promise<readonly Opportunity[]> => {
  const now = new Date();

  const rows = await findMany(
    "opportunities",
    (row) => row.citySlug === citySlug || row.remoteType === "remote",
  );

  return dedupe(rows.filter((row) => isLive(row, now)));
});

export const loadOpportunity = cache(async (id: string): Promise<Opportunity | null> => {
  return (await findOne("opportunities", (row) => row.id === id)) ?? null;
});

export const loadEmployer = cache(async (id: string | null): Promise<Employer | null> => {
  if (!id) return null;
  return (await findOne("employers", (row) => row.id === id)) ?? null;
});

/**
 * Employer verification, as a map the matcher can read without a join.
 *
 * A blocked employer's rows are not in this map and are not on the board —
 * `loadBoard` never sees them because moderation hides their postings — so an
 * absent id is correctly read as unverified rather than as trusted-by-default.
 */
export const loadVerification = cache(async (): Promise<ReadonlyMap<string, EmployerVerification>> => {
  const employers = await findMany("employers", (row) => row.blockedAt === null);
  return new Map(employers.map((employer) => [employer.id, employer.verification]));
});

/* -------------------------------------------------------------------------- */
/* Distance                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Travel time from the student's campus to a posting, in minutes, or null.
 *
 * Built on the neighbourhood rows rather than on coordinates, which is a
 * deliberate trade. Coordinates would give a straight-line distance that is
 * wrong in every city with a river or a metro; the neighbourhood table already
 * carries a real commute figure per campus, and a posting whose area is not in
 * that table returns **null** rather than an estimate.
 *
 * Null is the honest answer and it scores neutral. A guessed thirty minutes
 * that turns out to be an hour each way is how a student ends up quitting a
 * job in week three.
 */
export function commuteLookup(
  citySlug: string,
  campusSlug: string | null,
): (opportunity: Opportunity) => number | null {
  return (opportunity) => {
    if (opportunity.remoteType === "remote") return 0;
    const area = findNeighbourhood(opportunity.citySlug || citySlug, opportunity.area);
    if (!area) return null;
    return commuteTo(area, campusSlug);
  };
}

/* -------------------------------------------------------------------------- */
/* The wage baseline                                                           */
/* -------------------------------------------------------------------------- */

const MIN_RATES_FOR_BASELINE = 5;

/**
 * The going hourly rate for student work in this city, from this city's own
 * postings.
 *
 * Observed, not configured. A hard-coded figure per city would be a number
 * somebody made up once and nobody would ever revisit; the median of what is
 * actually being advertised here moves on its own and can be defended by
 * pointing at the rows it came from.
 *
 * Null below five stated rates, and null is a real answer: the implausible-pay
 * check simply does not run, because a "far above the going rate" warning
 * derived from two data points is a guess with a warning icon on it.
 */
export async function hourlyBaseline(citySlug: string): Promise<Cents | null> {
  const board = await loadBoard(citySlug);

  const rates = board
    .filter((row) => row.citySlug === citySlug && row.pay && row.pay.period !== "fixed")
    .map((row) => hourlyEquivalent(row.pay!, row.hoursMax ?? row.hoursMin ?? null))
    .filter((rate): rate is number => rate !== null && rate > 0)
    .sort((a, b) => a - b);

  if (rates.length < MIN_RATES_FOR_BASELINE) return null;
  return rates[Math.floor(rates.length / 2)];
}

/* -------------------------------------------------------------------------- */
/* Saved                                                                       */
/* -------------------------------------------------------------------------- */

export const loadSavedOpportunityIds = cache(async (userId: string): Promise<ReadonlySet<string>> => {
  const rows = await findMany(
    "saved",
    (row) => row.userId === userId && row.kind === "opportunity",
  );
  return new Set(rows.map((row) => row.targetId));
});

/* -------------------------------------------------------------------------- */
/* The composed read                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Everything the Work board needs, in one call.
 *
 * Composed here rather than in the page so that the board, the detail screen
 * and the Home card all rank against exactly the same inputs. A student who
 * sees 92% on Home and 87% on the board has caught the product contradicting
 * itself, and there is no explanation for it that they should have to hear.
 */
export type WorkFeed = {
  profile: WorkProfile;
  matches: readonly Match[];
  saved: ReadonlySet<string>;
  applications: ReadonlyMap<string, Application>;
  baseline: Cents | null;
};

export async function loadWorkFeed(viewer: {
  userId: string;
  citySlug: string;
  campusSlug: string | null;
}): Promise<WorkFeed> {
  const now = new Date();

  const [profile, board, verification, applications, saved, baseline] = await Promise.all([
    loadWorkProfile(viewer.userId),
    loadBoard(viewer.citySlug),
    loadVerification(),
    loadApplications(viewer.userId),
    loadSavedOpportunityIds(viewer.userId),
    hourlyBaseline(viewer.citySlug),
  ]);

  const matches = matchesForStudents({
    opportunities: board,
    profile,
    commuteMinutes: commuteLookup(viewer.citySlug, viewer.campusSlug),
    verification,
    hourlyBaseline: baseline,
    now,
  });

  return {
    profile,
    matches,
    saved,
    applications: new Map(applications.map((row) => [row.opportunityId, row])),
    baseline,
  };
}
