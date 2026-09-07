import "server-only";

import { z } from "zod";

import {
  type Opportunity,
  type PayPeriod,
  type ProviderRun,
  type RemoteType,
  type ScheduleTag,
  type SkillKey,
  type WorkKind,
  dedupeKey,
  skillKeys,
  workKinds,
} from "@/domain/work";
import { findMany, insert, newId, nowIso, update } from "@/server/db";
import { env } from "@/services/env";

/**
 * ============================================================================
 * JOB PROVIDERS
 * ----------------------------------------------------------------------------
 * The seam between StudentOS and everywhere work comes from.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NOT HERE, AND WHY
 *
 * There is no scraper. Not a throttled one, not a polite one, not one behind a
 * flag. A site that has not published a feed or an API has not agreed to be
 * republished, and a crawler that reads its terms as an obstacle is doing
 * something the person running this product would have to defend. Feeds and
 * APIs are how a source says yes, and this file only knows how to read those.
 *
 * The consequence is visible and deliberate: with no feed configured, the
 * external side of the Work board is empty and the admin screen says
 * "Not configured" in plain words. That is the honest state of a product with
 * no signed partner, and it is a much better state than a board full of jobs
 * from a source that would ask us to stop.
 *
 * ---------------------------------------------------------------------------
 * THE CONTRACT
 *
 * A provider turns whatever its source publishes into `Opportunity` rows and
 * nothing else. It may not invent a field: a feed that omits pay produces a
 * row with `pay: null`, and the mapping below has no defaults for money,
 * hours, or whether international students are welcome.
 *
 * `providerJobId` is what makes a re-sync an update rather than a duplicate.
 * A provider that cannot supply a stable id per posting must say so, and its
 * rows fall back to the structural `dedupeKey`.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* The interface                                                               */
/* -------------------------------------------------------------------------- */

export type ProviderConfiguration =
  | { configured: true; detail: string }
  | { configured: false; missing: string };

export type JobProvider = {
  slug: string;
  label: string;
  /**
   * What is required for this provider to run, answered honestly.
   *
   * The admin screen renders `missing` verbatim. "Not configured" with the
   * name of the variable that would configure it is actionable; a greyed-out
   * row is not.
   */
  status(): ProviderConfiguration;
  /**
   * Fetch and normalise. Throws on transport or shape failure — the caller
   * records the real error against the run rather than swallowing it.
   */
  fetch(citySlugs: readonly string[], now: Date): Promise<readonly NormalisedRow[]>;
};

/**
 * What a provider returns: an opportunity minus the fields only the store can
 * assign. `id` and `fetchedAt` are the caller's to set.
 */
export type NormalisedRow = Omit<Opportunity, "id" | "fetchedAt">;

/* -------------------------------------------------------------------------- */
/* Feed adapter                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The document shape a partner feed must publish.
 *
 * Strict on purpose. A feed that sends a pay field we cannot parse should fail
 * loudly at import, where an admin sees it, rather than quietly produce a row
 * with no pay that a student reads as "this job doesn't say".
 */
const payPeriods: readonly PayPeriod[] = ["hour", "day", "week", "month", "year", "fixed"];
const remoteTypes: readonly RemoteType[] = ["onsite", "hybrid", "remote"];
const scheduleValues: readonly ScheduleTag[] = ["weekday", "evening", "weekend", "flexible"];

const feedRow = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  url: z.string().url(),
  kind: z.enum(workKinds as [WorkKind, ...WorkKind[]]).default("OTHER"),
  employer: z.string().min(1).nullable().default(null),
  city: z.string().min(1),
  country: z.string().length(2),
  area: z.string().nullable().default(null),
  remote: z.enum(remoteTypes as [RemoteType, ...RemoteType[]]).default("onsite"),
  pay: z
    .object({
      /* Minor units, so a feed can never hand us a float and a rounding bug. */
      minCents: z.number().int().nonnegative(),
      maxCents: z.number().int().nonnegative().nullable().default(null),
      period: z.enum(payPeriods as [PayPeriod, ...PayPeriod[]]),
      currency: z.string().length(3),
    })
    .nullable()
    .default(null),
  hoursMin: z.number().int().nonnegative().nullable().default(null),
  hoursMax: z.number().int().nonnegative().nullable().default(null),
  schedule: z.array(z.enum(scheduleValues as [ScheduleTag, ...ScheduleTag[]])).default([]),
  languages: z
    .array(
      z.object({
        code: z.string().min(2).max(5),
        level: z.enum(["basic", "conversational", "fluent", "native"]),
      }),
    )
    .default([]),
  skills: z.array(z.enum(skillKeys as [SkillKey, ...SkillKey[]])).default([]),
  /* Tri-state on the wire too: a feed that omits these means "did not say". */
  studentFriendly: z.boolean().nullable().default(null),
  internationalStudentFriendly: z.boolean().nullable().default(null),
  workAuthorizationNotes: z.string().nullable().default(null),
  postedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).nullable().default(null),
  startsAt: z.string().datetime({ offset: true }).nullable().default(null),
});

const feedDocument = z.object({ jobs: z.array(feedRow) });

/** Documented for anyone publishing a feed to StudentOS. */
export const feedSchemaVersion = "1";

const FETCH_TIMEOUT_MS = 15_000;

/**
 * One configured partner feed.
 *
 * Identifies itself in the User-Agent with a contact URL, sends no cookies,
 * and gives up after fifteen seconds rather than holding a sync open. It reads
 * one document per run; there is no crawl, no link-following and no pagination
 * beyond what the feed itself returns.
 */
export function feedProvider(entry: { slug: string; url: string }): JobProvider {
  return {
    slug: entry.slug,
    label: `Feed: ${entry.slug}`,
    status: () => ({ configured: true, detail: entry.url }),
    async fetch(citySlugs, now) {
      const response = await globalThis.fetch(entry.url, {
        headers: {
          accept: "application/json",
          "user-agent": `StudentOS/1.0 (+https://studentos.app; job feed reader ${feedSchemaVersion})`,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`${entry.url} returned ${response.status} ${response.statusText}`);
      }

      const parsed = feedDocument.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error(`${entry.url}: ${parsed.error.issues[0]?.message ?? "unexpected shape"}`);
      }

      const wanted = new Set(citySlugs);
      const seen = now.toISOString();

      return parsed.data.jobs
        .filter((row) => wanted.has(row.city))
        .map<NormalisedRow>((row) => ({
          provider: "feed",
          providerSlug: entry.slug,
          providerJobId: row.id,
          /* The canonical URL is preserved exactly. A student who wants to see
             where this came from gets the source, not a StudentOS mirror. */
          sourceUrl: row.url,
          title: row.title,
          description: row.description,
          kind: row.kind,
          employerId: null,
          employerName: row.employer,
          postedByUserId: null,
          citySlug: row.city,
          countryCode: row.country.toUpperCase(),
          area: row.area,
          campusSlug: null,
          remoteType: row.remote,
          pay: row.pay,
          hoursMin: row.hoursMin,
          hoursMax: row.hoursMax,
          schedule: row.schedule,
          startsAt: row.startsAt,
          languages: row.languages,
          skills: row.skills,
          studentFriendly: row.studentFriendly,
          internationalStudentFriendly: row.internationalStudentFriendly,
          workAuthorizationNotes: row.workAuthorizationNotes,
          applicationMethod: "external-url",
          applicationUrl: row.url,
          postedAt: row.postedAt,
          expiresAt: row.expiresAt,
          lastSeenAt: seen,
          moderation: "published",
          filledAt: null,
        }));
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Placeholders for sources that exist but are not connected                   */
/* -------------------------------------------------------------------------- */

/**
 * A provider that is real in the plan and absent in the deployment.
 *
 * It reports what is missing and refuses to run. The alternative — leaving the
 * source out of the registry entirely — hides the fact that a university feed
 * is the obvious next integration, and hides it from the person who could go
 * and arrange it.
 */
function unconfigured(slug: string, label: string, missing: string): JobProvider {
  return {
    slug,
    label,
    status: () => ({ configured: false, missing }),
    async fetch() {
      throw new Error(`${slug} is not configured: ${missing}`);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Registry                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every source the product knows about, configured or not.
 *
 * `students` and `employer` postings are written directly by server actions
 * and have no fetch step, so they are not providers — nothing syncs them and
 * nothing can expire them but their own author.
 */
export function providers(): readonly JobProvider[] {
  return [
    ...env.workFeeds.map(feedProvider),
    unconfigured(
      "campus",
      "University careers feeds",
      "No university has published a careers feed to StudentOS yet. Add one as STUDENTOS_WORK_FEEDS=slug=https://…",
    ),
  ];
}

export function providerBySlug(slug: string): JobProvider | undefined {
  return providers().find((provider) => provider.slug === slug);
}

/* -------------------------------------------------------------------------- */
/* Sync                                                                        */
/* -------------------------------------------------------------------------- */

export type SyncResult = ProviderRun;

/**
 * Run one provider and record what happened, successfully or not.
 *
 * A failed run is written with the real error text. A provider that has been
 * returning 403 for a week is the single most useful thing the admin health
 * screen can show, and it only exists if failures are stored rather than
 * logged and forgotten.
 */
export async function syncProvider(
  provider: JobProvider,
  citySlugs: readonly string[],
  now: Date,
): Promise<SyncResult> {
  const run: ProviderRun = {
    id: newId(),
    providerSlug: provider.slug,
    startedAt: now.toISOString(),
    finishedAt: null,
    ok: false,
    imported: 0,
    updated: 0,
    duplicates: 0,
    expired: 0,
    error: null,
  };

  const status = provider.status();
  if (!status.configured) {
    run.finishedAt = nowIso();
    run.error = status.missing;
    await insert("providerRuns", run);
    return run;
  }

  try {
    const rows = await provider.fetch(citySlugs, now);
    const existing = await findMany("opportunities", (row) => row.providerSlug === provider.slug);

    const byProviderId = new Map(
      existing.filter((row) => row.providerJobId).map((row) => [row.providerJobId as string, row]),
    );
    /* Second index for feeds with no stable id: two postings that normalise to
       the same employer, title and city are one job seen twice. */
    const byShape = new Map(existing.map((row) => [dedupeKey(row), row]));

    for (const row of rows) {
      const held =
        (row.providerJobId && byProviderId.get(row.providerJobId)) || byShape.get(dedupeKey(row));

      if (held) {
        await update(
          "opportunities",
          (candidate) => candidate.id === held.id,
          { ...row, id: held.id, fetchedAt: now.toISOString() },
        );
        run.updated += 1;
        if (!row.providerJobId) run.duplicates += 1;
        continue;
      }

      await insert("opportunities", { ...row, id: newId(), fetchedAt: now.toISOString() });
      run.imported += 1;
    }

    run.ok = true;
  } catch (error) {
    run.error = error instanceof Error ? error.message : String(error);
  }

  run.finishedAt = nowIso();
  await insert("providerRuns", run);
  return run;
}

/**
 * The most recent run per provider, for the health screen.
 *
 * A provider with no runs at all comes back as null rather than being omitted:
 * "never synced" is a state an admin needs to see, and a missing row reads as
 * "fine".
 */
export async function providerHealth(): Promise<
  readonly { provider: JobProvider; status: ProviderConfiguration; lastRun: ProviderRun | null }[]
> {
  const runs = await findMany("providerRuns", () => true);

  return providers().map((provider) => {
    const mine = runs
      .filter((run) => run.providerSlug === provider.slug)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return { provider, status: provider.status(), lastRun: mine[0] ?? null };
  });
}
