import "server-only";

import { cityDirectory } from "@/data/cities";
import { CITY_ALIASES } from "@/domain/cities";
import { fold } from "@/domain/institutions";
import type { RemoteType, WorkKind } from "@/domain/work";
import type { NormalisedRow } from "@/server/work/providers";

/**
 * ============================================================================
 * ARBEITNOW — a real job board, read the way a job board asks to be read
 * ----------------------------------------------------------------------------
 * The first external source of real postings in this product.
 *
 * WHY THIS ONE. `providers.ts` already refuses to scrape, and that refusal left
 * the external half of the Work board empty because every obvious source wants
 * a signed partnership. Arbeitnow publishes a documented, keyless job-board API
 * at a stable URL, which is a source saying yes in the only way this codebase
 * accepts. One GET, no crawl, no link-following, no pagination beyond the one
 * document it returns.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES NOT TELL US, WHICH IS MOST OF WHAT A STUDENT NEEDS
 *
 * The payload has ten fields and none of them is pay, hours, schedule, visa
 * eligibility or whether students are welcome. So this adapter writes:
 *
 *     pay: null          hoursMin/Max: null      schedule: []
 *     studentFriendly: null                      languages: []
 *     internationalStudentFriendly: null         skills: []
 *     workAuthorizationNotes: null
 *
 * Every one of those nulls is load-bearing. `Opportunity` says of pay "Null
 * when the source did not state pay. Never inferred", and of the student flags
 * "Null means the source did not say. Never defaulted to true". A board that
 * guessed "probably fine for students" from a job title would be the most
 * expensive kind of wrong: a student spends an afternoon applying for
 * something their visa forbids.
 *
 * The ranking engine already handles this properly — `scoreStudentFit` treats
 * an unknown as neutral rather than as a pass — so an unpriced posting sorts
 * below one a student has confirmed, without being hidden.
 *
 * ---------------------------------------------------------------------------
 * LOCATION IS A FREE-TEXT STRING, and that is the interesting problem.
 *
 * `location` is whatever the employer typed: "Berlin", "München", "Remote",
 * "Hamburg, Germany". A posting is kept ONLY when that string folds to a city
 * StudentOS actually serves. Everything else is dropped rather than filed
 * under a guess, because a job shown in the wrong city is worse than a job not
 * shown at all — it is a bus fare and a wasted morning.
 *
 * Remote postings are the deliberate exception: they are kept for every city,
 * because "remote" is a real answer to "where", and flagged `remoteType:
 * "remote"` so a student filtering for on-site work never sees them.
 * ============================================================================
 */

const ENDPOINT = "https://www.arbeitnow.com/api/job-board-api";
const FETCH_TIMEOUT_MS = 15_000;

/* -------------------------------------------------------------------------- */
/* The payload                                                                 */
/* -------------------------------------------------------------------------- */

type ArbeitnowJob = {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
};

/** Shape-check without a schema library: this is the only field set we read. */
function isJob(value: unknown): value is ArbeitnowJob {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.slug === "string" &&
    typeof row.title === "string" &&
    typeof row.url === "string" &&
    typeof row.company_name === "string" &&
    typeof row.location === "string"
  );
}

/* -------------------------------------------------------------------------- */
/* Mapping                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Which StudentOS city a free-text location names, or null.
 *
 * Matched on the folded city name and on the folded first comma-separated
 * part, so "Hamburg, Germany" resolves and "Greater Hamburg Area" does not.
 * Deliberately exact rather than fuzzy: "Cambridge" is two different cities on
 * two continents, and a near-match is how a student ends up applying in the
 * wrong one.
 */
export function cityFor(location: string, served: readonly string[]): string | null {
  const candidates = [location, location.split(",")[0] ?? ""].map(fold).filter(Boolean);
  if (candidates.length === 0) return null;

  for (const city of cityDirectory) {
    if (!served.includes(city.slug)) continue;

    /* The product's own name, the slug, and the names the city is actually
       called locally. That last one is not optional: this feed is German-heavy
       and German employers write "München", which folds to "munchen" and would
       otherwise miss the city called "Munich" entirely. `CITY_ALIASES` already
       existed for the city search box; reusing it beats a second table that
       somebody has to remember to update. */
    const names = [
      city.name,
      city.slug.replace(/-/g, " "),
      ...(CITY_ALIASES[city.slug] ?? []),
    ].map(fold);

    if (candidates.some((candidate) => names.includes(candidate))) return city.slug;
  }
  return null;
}

/**
 * The board's own `job_types`, mapped to a `WorkKind` only where the mapping is
 * exact. Anything else is `OTHER` rather than a guess dressed as a category —
 * a student filtering for an internship should get internships, not everything
 * a keyword matcher thought looked like one.
 */
const KIND_BY_TYPE: Record<string, WorkKind> = {
  internship: "INTERNSHIP",
  praktikum: "INTERNSHIP",
  part_time: "PART_TIME",
  parttime: "PART_TIME",
  teilzeit: "PART_TIME",
  full_time: "FULL_TIME",
  fulltime: "FULL_TIME",
  vollzeit: "FULL_TIME",
  freelance: "FREELANCE",
  contract: "FREELANCE",
  werkstudent: "PART_TIME",
};

function kindFor(job: ArbeitnowJob): WorkKind {
  for (const raw of job.job_types) {
    const mapped = KIND_BY_TYPE[fold(raw).replace(/\s+/g, "_")];
    if (mapped) return mapped;
  }
  return "OTHER";
}

/**
 * The description, as text.
 *
 * The feed sends HTML with its entities escaped twice over. Rendering that raw
 * would put `&lt;div&gt;` on a student's screen, and rendering it as HTML would
 * inject a third party's markup into our page. So entities are decoded, tags
 * are dropped, and what is left is the words.
 */
export function plainText(html: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };

  let text = html;
  /* Twice: the payload is escaped, then escaped again. */
  for (let pass = 0; pass < 2; pass += 1) {
    text = text.replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (match) => entities[match] ?? match);
  }

  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2_000);
}

function remoteFor(job: ArbeitnowJob): RemoteType {
  if (job.remote) return "remote";
  return fold(job.location) === "remote" ? "remote" : "onsite";
}

/* -------------------------------------------------------------------------- */
/* The provider                                                                */
/* -------------------------------------------------------------------------- */

export function arbeitnowProvider() {
  return {
    slug: "arbeitnow",
    label: "Arbeitnow job board",
    status: () => ({ configured: true as const, detail: ENDPOINT }),

    async fetch(citySlugs: readonly string[], now: Date): Promise<readonly NormalisedRow[]> {
      const response = await globalThis.fetch(ENDPOINT, {
        headers: {
          accept: "application/json",
          "user-agent": "StudentOS/1.0 (+https://studentos.app; job board reader)",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`${ENDPOINT} returned ${response.status} ${response.statusText}`);
      }

      const body: unknown = await response.json();
      const rows = (body as { data?: unknown }).data;
      if (!Array.isArray(rows)) {
        throw new Error(`${ENDPOINT}: expected a "data" array`);
      }

      const seen = now.toISOString();
      const out: NormalisedRow[] = [];

      for (const raw of rows) {
        if (!isJob(raw)) continue;

        const remoteType = remoteFor(raw);
        const city = cityFor(raw.location, citySlugs);

        /* A posting we cannot place, and cannot call remote, is dropped. It is
           a real job somewhere we do not serve. */
        if (!city && remoteType !== "remote") continue;

        /* A remote posting belongs to every city the student might be in, and
           is written once per city so the board's city scoping still holds. */
        const targets = city ? [city] : citySlugs;

        for (const citySlug of targets) {
          const country = cityDirectory.find((entry) => entry.slug === citySlug)?.countryCode ?? "";

          out.push({
            provider: "feed",
            providerSlug: "arbeitnow",
            /* Unique per city so a remote posting written into five cities is
               five rows that each re-sync cleanly rather than fighting. */
            providerJobId: city ? raw.slug : `${raw.slug}@${citySlug}`,
            sourceUrl: raw.url,

            title: raw.title,
            description: plainText(raw.description),
            kind: kindFor(raw),
            employerId: null,
            employerName: raw.company_name,
            postedByUserId: null,

            citySlug,
            countryCode: country.toUpperCase(),
            area: null,
            campusSlug: null,
            remoteType,

            /* --- everything the source does not say -------------------------
               Not defaults. The absence of an answer, recorded as an absence,
               so the fit engine scores it neutral and no card claims a wage,
               an hour or a visa position that nobody published. */
            pay: null,
            hoursMin: null,
            hoursMax: null,
            schedule: [],
            startsAt: null,
            languages: [],
            skills: [],
            studentFriendly: null,
            internationalStudentFriendly: null,
            workAuthorizationNotes: null,

            applicationMethod: "external-url",
            applicationUrl: raw.url,
            postedAt: new Date(raw.created_at * 1_000).toISOString(),
            expiresAt: null,
            lastSeenAt: seen,
            moderation: "published",
            filledAt: null,
          });
        }
      }

      return out;
    },
  };
}
