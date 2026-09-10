import "server-only";

import { allCoverageCities } from "@/config/regions";
import { parseIcs, type IcsEvent } from "@/domain/ics";
import type { Cents, CityEvent, EventKind } from "@/domain/types";
import type { ProviderRun } from "@/domain/work";
import { findMany, insert, newId, nowIso, remove, update } from "@/server/db";
import { env } from "@/services/env";

/**
 * ============================================================================
 * EVENT PROVIDERS
 * ----------------------------------------------------------------------------
 * The seam between StudentOS and everywhere events come from.
 *
 * Modelled on `src/server/work/providers.ts` and inheriting every rule it set,
 * because the failure modes are identical.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NOT HERE, AND WHY
 *
 * There is no scraper, for the same reason there is none for jobs: a site that
 * has not published a feed has not agreed to be republished. What universities,
 * student unions and municipal culture departments DO publish, almost without
 * exception, is an iCalendar feed — a public URL created specifically so that
 * other software would read it. That is an act of permission, and it is the
 * only kind this file knows how to accept.
 *
 * ---------------------------------------------------------------------------
 * THE RULES A PROVIDER MAY NOT BREAK
 *
 *   PRICE IS NULLABLE, AND NULL IS NOT ZERO. An ICS entry has no price field.
 *   Every row from a calendar therefore arrives unpriced, and the ingest
 *   refuses to write it as free — `priceCents` on `CityEvent` is not nullable,
 *   so an unpriced event is stored with the price it does have and the ingest
 *   marks it. "Free" is a claim and a calendar entry does not make one.
 *
 *   SOCIAL COUNTS START AT ZERO. Always. An ingested event has had nobody
 *   confirm it, and the interface adds real responses to whatever is stored.
 *   The seeded events carried invented confirmations for exactly this reason
 *   and were the worse for it.
 *
 *   THE SOURCE URL IS THE PUBLISHER'S. Never a StudentOS mirror. A student who
 *   wants to know whether an event is really on should reach the people
 *   running it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS HONESTLY MISSING
 *
 * Recurrence. `parseIcs` reads RRULE and does not implement it, so a weekly
 * society meeting is ingested as its next occurrence and no further ones. That
 * is visible rather than hidden: the run reports how many recurring entries it
 * flattened, and the alternative — guessing at a recurrence rule — puts a
 * lecture on the wrong Tuesday for a term.
 * ============================================================================
 */

export type EventProviderConfiguration =
  | { configured: true; detail: string }
  | { configured: false; missing: string };

/**
 * What a provider returns: an event minus the fields only the store assigns,
 * plus the two things the ingest needs to decide what to do with it.
 */
export type NormalisedEvent = Omit<
  CityEvent,
  "id" | "confirmations" | "interested" | "observedAt" | "priceCents"
> & {
  /**
   * Null when the source published no price, which for a calendar is always.
   * The ingest decides what to store and records how many arrived this way.
   */
  priceCents: Cents | null;
  /** Carried through so a run can report what it could not represent. */
  recurring: boolean;
};

export type EventProvider = {
  slug: string;
  label: string;
  /**
   * What this provider needs, answered honestly. The admin screen renders
   * `missing` verbatim, because a variable name is actionable and a greyed-out
   * row is not.
   */
  status(): EventProviderConfiguration;
  /** Fetch and normalise. Throws on transport or shape failure. */
  fetch(now: Date): Promise<readonly NormalisedEvent[]>;
};

/* -------------------------------------------------------------------------- */
/* Classification                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A calendar's own CATEGORIES, or its words, mapped onto our kinds.
 *
 * Order matters: the first match wins, and the more specific words come first.
 * A "career fair" is networking rather than university, because that is what a
 * student is deciding about when they read it.
 */
const KIND_WORDS: readonly (readonly [EventKind, readonly string[]])[] = [
  ["nightlife", ["party", "club night", "bar night", "afterparty"]],
  ["networking", ["career", "networking", "job fair", "recruit", "alumni", "mentor"]],
  ["sports", ["sport", "football", "match", "tournament", "run", "yoga", "climb", "swim"]],
  ["music", ["concert", "gig", "band", "recital", "orchestra", "jam", "dj"]],
  ["tech", ["hackathon", "coding", "developer", "startup", "robotics", "data science"]],
  ["food", ["dinner", "brunch", "tasting", "cook", "market", "bbq", "barbecue"]],
  ["culture", ["exhibition", "museum", "gallery", "theatre", "film", "cinema", "reading"]],
  ["outdoor", ["hike", "walk", "excursion", "picnic", "garden", "trip"]],
  ["social", ["social", "meet", "welcome", "mixer", "quiz", "games", "intercambio"]],
  ["university", ["lecture", "seminar", "workshop", "class", "exam", "open day", "induction"]],
];

export function classifyEvent(entry: IcsEvent): EventKind {
  const haystack = [entry.summary, entry.description ?? "", ...entry.categories]
    .join(" ")
    .toLowerCase();

  for (const [kind, words] of KIND_WORDS) {
    if (words.some((word) => haystack.includes(word))) return kind;
  }

  /* Nothing matched. "university" is the honest default for a feed a
     university publishes, and it is a description rather than a guess about
     content. */
  return "university";
}

/* -------------------------------------------------------------------------- */
/* The ICS adapter                                                             */
/* -------------------------------------------------------------------------- */

const FETCH_TIMEOUT_MS = 20_000;

const USER_AGENT =
  "StudentOS/1.0 (+https://github.com/RRORUMAN/studentos; calendar reader for international students)";

/**
 * One configured calendar.
 *
 * Identifies itself with a contact URL, sends no cookies, gives up after
 * twenty seconds, and reads one document per run. There is no crawl, no
 * link-following and no pagination beyond what the calendar itself returns.
 *
 * The COORDINATE is the city centre, and that is a deliberate limitation
 * stated rather than papered over: an ICS LOCATION is free text ("Aula Magna,
 * Facultad de Filosofía"), not a coordinate, and geocoding it would mean
 * sending a publisher's venue strings to a third party and trusting whatever
 * came back. The venue name is kept exactly as published, so a student reads
 * the real room; the pin sits on the city until somebody who knows better
 * corrects it.
 */
export function icsProvider(entry: {
  slug: string;
  url: string;
  citySlug: string;
  campusSlug?: string | null;
  centre: { lat: number; lng: number };
}): EventProvider {
  return {
    slug: entry.slug,
    label: `Calendar: ${entry.slug}`,
    status: () => ({ configured: true, detail: entry.url }),

    async fetch(now) {
      const response = await globalThis.fetch(entry.url, {
        headers: { accept: "text/calendar, text/plain", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`${entry.url} returned ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text.includes("BEGIN:VCALENDAR")) {
        throw new Error(`${entry.url} did not return an iCalendar document`);
      }

      const horizon = now.getTime() + 180 * 86_400_000;

      return parseIcs(text)
        .filter((event) => {
          const at = Date.parse(event.startsAt);
          /* Past events and anything more than six months out are dropped:
             the first is not actionable and the second is noise that would
             dominate every "what's on" list for a term. */
          return at >= now.getTime() && at <= horizon;
        })
        .map<NormalisedEvent>((event) => ({
          citySlug: entry.citySlug,
          campusSlug: entry.campusSlug ?? null,
          title: event.summary,
          blurb: event.description?.slice(0, 400) ?? "",
          kind: classifyEvent(event),
          /* No price field exists in iCalendar. Null, never zero. */
          priceCents: null,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          venue: event.location ?? "Venue not stated",
          point: entry.centre,
          source: "official",
          /* The publisher's own link where they gave one, the calendar itself
             otherwise. Never a StudentOS URL. */
          sourceUrl: event.url ?? entry.url,
          tags: event.categories,
          sourceId: entry.slug,
          externalId: event.uid,
          recurring: event.recurring,
        }));
    },
  };
}

/**
 * A source that is real in the plan and absent in the deployment.
 *
 * It reports what is missing and refuses to run. Leaving it out of the registry
 * entirely would hide the fact that a university calendar is the obvious next
 * integration, and hide it from the person who could go and arrange it.
 */
function unconfigured(slug: string, label: string, missing: string): EventProvider {
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

export function eventProviders(): readonly EventProvider[] {
  const configured = env.eventFeeds
    .map((feed) => {
      /* A feed names the city it is for. One that names a city we do not have
         is dropped here rather than importing events into nowhere. */
      const city = resolveCentre(feed.citySlug);
      if (!city) return null;
      return icsProvider({
        slug: feed.slug,
        url: feed.url,
        citySlug: feed.citySlug,
        campusSlug: feed.campusSlug,
        centre: city,
      });
    })
    .filter((provider): provider is EventProvider => provider !== null);

  if (configured.length > 0) return configured;

  return [
    unconfigured(
      "calendars",
      "University and city calendars",
      "Not configured — no calendar has been added. Set STUDENTOS_EVENT_FEEDS=slug=citySlug=https://…/events.ics. Nearly every student union and culture department publishes one.",
    ),
  ];
}

/** The city centre a feed's events are pinned to. Null for an unknown city. */
function resolveCentre(citySlug: string): { lat: number; lng: number } | null {
  const city = allCoverageCities.find((row) => row.key === citySlug);
  return city ? { lat: city.lat, lng: city.lng } : null;
}

/* -------------------------------------------------------------------------- */
/* Ingest                                                                      */
/* -------------------------------------------------------------------------- */

export type EventSyncResult = ProviderRun & {
  /** Entries the calendar marked recurring, of which only the next was taken. */
  flattenedRecurring: number;
  /** Entries with no price, which is every entry a calendar produces. */
  unpriced: number;
};

/**
 * Run one provider and record what happened, successfully or not.
 *
 * A failed run is written with the real error text: a calendar that has been
 * returning 404 for a week is the most useful thing the health screen can
 * show, and it only exists if failures are stored rather than logged.
 */
export async function syncEventProvider(
  provider: EventProvider,
  now: Date,
): Promise<EventSyncResult> {
  const run: EventSyncResult = {
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
    flattenedRecurring: 0,
    unpriced: 0,
  };

  const status = provider.status();
  if (!status.configured) {
    run.finishedAt = nowIso();
    run.error = status.missing;
    await insert("providerRuns", toProviderRun(run));
    return run;
  }

  try {
    const rows = await provider.fetch(now);
    const existing = await findMany("events", (row) => row.sourceId === provider.slug);
    const byExternalId = new Map(
      existing.filter((row) => row.externalId).map((row) => [row.externalId as string, row]),
    );

    for (const row of rows) {
      if (row.recurring) run.flattenedRecurring += 1;
      if (row.priceCents === null) run.unpriced += 1;

      /* `recurring` is carried on the normalised row so the run can report it,
         and is not part of a stored event: an event either happens on a date
         or it does not, and a repeat this parser cannot expand is not a
         property of the occurrence being written. */
      const { priceCents } = row;
      const rest = {
        citySlug: row.citySlug,
        campusSlug: row.campusSlug,
        title: row.title,
        blurb: row.blurb,
        kind: row.kind,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        venue: row.venue,
        point: row.point,
        source: row.source,
        sourceUrl: row.sourceUrl,
        tags: row.tags,
        sourceId: row.sourceId,
        externalId: row.externalId,
      };
      const held = row.externalId ? byExternalId.get(row.externalId) : undefined;

      if (held) {
        await update("events", (candidate) => candidate.id === held.id, {
          ...rest,
          /* A calendar cannot state a price, so an update never overwrites one
             a student or an admin has since supplied.

             The exception is a held ZERO on an imported row, which is cleared
             back to null. Every calendar row written before `priceCents`
             became nullable got a zero from the old `?? 0` — that is where
             they came from, all of them — and leaving them would mean the fix
             only ever helped events imported after today while every existing
             one kept showing a "Free" badge nobody published.

             It is not free of cost: an operator who deliberately set one of
             these to zero, meaning "I checked, it is free", loses that and
             gets "price not listed" until they set it again. That is the
             direction to err. A wrong null makes no claim; a wrong zero tells
             a student something is free and takes their afternoon. */
          priceCents: priceCents ?? (held.priceCents === 0 ? null : held.priceCents),
          id: held.id,
          /* Social counts belong to the students who made them and are never
             touched by a sync. */
          confirmations: held.confirmations,
          interested: held.interested,
          observedAt: now.toISOString(),
        });
        run.updated += 1;
        continue;
      }

      await insert("events", {
        ...rest,
        id: newId(),
        /* Unpriced stays unpriced. `CityEvent.priceCents` is nullable now, so
           the row itself carries the difference between "free" and "nobody
           said" — it used to be flattened to zero here and the only record of
           it was `unpriced` on the run, which no student ever sees. */
        priceCents,
        confirmations: 0,
        interested: 0,
        observedAt: now.toISOString(),
      });
      run.imported += 1;
    }

    /* An event this feed used to publish and no longer does, still in the
       future, has been cancelled or moved. It is removed rather than left to
       send somebody to a room that is empty. */
    const seen = new Set(rows.map((row) => row.externalId).filter(Boolean));
    run.expired = await remove(
      "events",
      (row) =>
        row.sourceId === provider.slug &&
        row.externalId !== null &&
        row.externalId !== undefined &&
        !seen.has(row.externalId) &&
        Date.parse(row.startsAt) > now.getTime(),
    );

    run.ok = true;
  } catch (error) {
    run.error = error instanceof Error ? error.message : String(error);
  }

  run.finishedAt = nowIso();
  await insert("providerRuns", toProviderRun(run));
  return run;
}

/**
 * The stored shape, without the two figures only the event sync reports.
 *
 * `unpriced` and `flattenedRecurring` are honesty accounting rather than
 * outcomes — they say what the ingest could not represent — and `ProviderRun`
 * is shared with the job sync, which has neither. They live on the response
 * instead, which is what an operator reads.
 */
function toProviderRun(run: EventSyncResult): ProviderRun {
  return {
    id: run.id,
    providerSlug: run.providerSlug,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    ok: run.ok,
    imported: run.imported,
    updated: run.updated,
    duplicates: run.duplicates,
    expired: run.expired,
    error: run.error,
  };
}

/**
 * The most recent run per provider, for the health screen.
 *
 * A provider with no runs comes back as null rather than being omitted: "never
 * synced" is a state an admin needs to see, and a missing row reads as fine.
 */
export async function eventProviderHealth(): Promise<
  readonly {
    provider: EventProvider;
    status: EventProviderConfiguration;
    lastRun: ProviderRun | null;
  }[]
> {
  const runs = await findMany("providerRuns", () => true);

  return eventProviders().map((provider) => {
    const mine = runs
      .filter((run) => run.providerSlug === provider.slug)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return { provider, status: provider.status(), lastRun: mine[0] ?? null };
  });
}
