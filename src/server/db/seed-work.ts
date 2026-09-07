import "server-only";

import type { Opportunity, PayPeriod, ScheduleTag, SkillKey, WorkKind } from "@/domain/work";
import type { Database } from "@/server/db/store";
import { cities } from "@/data/cities";

/**
 * ============================================================================
 * SEEDED WORK
 * ----------------------------------------------------------------------------
 * Enough rows that the matcher can be seen disagreeing with itself on a fresh
 * install, and not one row that pretends to be a job you could take.
 *
 * ---------------------------------------------------------------------------
 * THE LINE THIS FILE DOES NOT CROSS
 *
 * A seeded event is a party nobody throws; a seeded job is a *company that
 * does not exist advertising a wage it will not pay*, and a student can spend
 * a real evening on it. So the two halves here are treated differently:
 *
 *   STUDENT GIGS carry `provider: "students"` and belong to the seeded
 *   authors who already post in Pulse and the Exchange. They are the same
 *   fiction the rest of the demo runs on, they cost nobody anything, and
 *   messaging one works exactly as it will for a real student.
 *
 *   EMPLOYER-SIDE ROWS carry `provider: "sample"` and **no company name that
 *   belongs to anybody**. "A language school near Chamberí" is a description
 *   of a category, not an invented business with an invented reputation. They
 *   have no application URL, and the apply control on a sample row says there
 *   is nobody to apply to rather than pretending to submit.
 *
 * `providerPrior` scores `sample` far below every real source, so the moment
 * one genuine posting exists it outranks all of this without any surface
 * needing to remember to exclude seeded rows.
 * ============================================================================
 */

type Row = {
  slug: string;
  city: string;
  /** A seeded author handle for a student gig; null for an employer-side row. */
  poster: string | null;
  employer: string | null;
  title: string;
  description: string;
  kind: WorkKind;
  area: string | null;
  remote?: "onsite" | "hybrid" | "remote";
  /** Minor units. Omitted entirely where the posting states no pay. */
  pay?: { min: number; max?: number; period: PayPeriod };
  hoursMin?: number;
  hoursMax?: number;
  schedule: readonly ScheduleTag[];
  languages?: readonly { code: string; level: "basic" | "conversational" | "fluent" | "native" }[];
  skills: readonly SkillKey[];
  /** Tri-state, and left undefined wherever a real posting would say nothing. */
  studentFriendly?: boolean;
  internationalFriendly?: boolean;
  /** Days from now for a dated shift. */
  inDays?: number;
  postedDaysAgo: number;
};

const ROWS: readonly Row[] = [
  /* ---- student gigs: the local economy nobody else lists ----------------- */
  {
    slug: "g-sofa",
    city: "madrid",
    poster: "samir",
    employer: null,
    title: "Help me carry a sofa down three floors — €40",
    description:
      "Third floor, no lift, one sofa and two chairs. Should take twenty minutes if there are two of us. Cash on the day.",
    kind: "MOVING_HELP",
    area: "Argüelles",
    pay: { min: 4000, period: "fixed" },
    schedule: ["weekend"],
    skills: ["manual"],
    inDays: 4,
    postedDaysAgo: 1,
  },
  {
    slug: "g-photos",
    city: "madrid",
    poster: "mireia",
    employer: null,
    title: "Photograph my room for a rental listing — €25",
    description:
      "Ten or so photos of a small room and the shared kitchen, good light, nothing fancy. Phone camera is fine if you know what you are doing.",
    kind: "PHOTOGRAPHY",
    area: "Malasaña",
    pay: { min: 2500, period: "fixed" },
    schedule: ["flexible"],
    skills: ["photography"],
    inDays: 6,
    postedDaysAgo: 2,
  },
  {
    slug: "g-tutor-es",
    city: "madrid",
    poster: "aiko",
    employer: null,
    title: "Spanish conversation practice, two hours a week — €18/hour",
    description:
      "I can read Spanish fine and freeze the moment anyone speaks to me. Looking for someone patient to talk to twice a week, in a café near Lavapiés or on a call.",
    kind: "TUTORING",
    area: "Lavapiés",
    remote: "hybrid",
    pay: { min: 1800, period: "hour" },
    hoursMin: 2,
    hoursMax: 2,
    schedule: ["evening", "weekend"],
    languages: [{ code: "es", level: "fluent" }],
    skills: ["tutoring", "languages"],
    postedDaysAgo: 3,
  },
  {
    slug: "g-translate",
    city: "madrid",
    poster: "tobias",
    employer: null,
    title: "Translate a two-page rental contract — €20",
    description:
      "Spanish to English, two pages. I do not need it certified, I need to know what I am signing before Thursday.",
    kind: "LANGUAGE_HELP",
    area: "Moncloa",
    remote: "remote",
    pay: { min: 2000, period: "fixed" },
    schedule: ["flexible"],
    languages: [
      { code: "es", level: "fluent" },
      { code: "en", level: "fluent" },
    ],
    skills: ["languages", "writing"],
    inDays: 3,
    postedDaysAgo: 1,
  },
  {
    slug: "g-tiktok",
    city: "barcelona",
    poster: "elena",
    employer: null,
    title: "Five short videos for my society's account — €100",
    description:
      "Student society, five vertical videos over two weeks. You shoot and edit, we write the scripts. Portfolio matters more than experience.",
    kind: "CONTENT",
    area: "Gràcia",
    remote: "hybrid",
    pay: { min: 10000, period: "fixed" },
    schedule: ["flexible"],
    skills: ["video", "marketing"],
    postedDaysAgo: 4,
  },
  {
    slug: "g-dog",
    city: "berlin",
    poster: "lukas",
    employer: null,
    title: "Walk my dog on weekday afternoons — €15 a walk",
    description:
      "Small, calm, already walks well on a lead. Weekdays around four, three or four times a week, Neukölln.",
    kind: "PET_SITTING",
    area: "Neukölln",
    pay: { min: 1500, period: "fixed" },
    schedule: ["weekday"],
    skills: ["other"],
    postedDaysAgo: 2,
  },
  {
    slug: "g-shopify",
    city: "amsterdam",
    poster: "joran",
    employer: null,
    title: "Set up a Shopify store for a friend's business — €150",
    description:
      "Theme, five products, payments and shipping. No custom code needed. I can pay the day it goes live.",
    kind: "CODING",
    area: null,
    remote: "remote",
    pay: { min: 15000, period: "fixed" },
    schedule: ["flexible"],
    skills: ["coding", "design"],
    postedDaysAgo: 5,
  },
  {
    slug: "g-desk",
    city: "london",
    poster: "priya",
    employer: null,
    title: "Help assembling flat-pack furniture on Sunday",
    description:
      "A wardrobe and a desk, tools provided. I have not agreed a price yet — tell me what you would charge.",
    kind: "MOVING_HELP",
    area: "Mile End",
    schedule: ["weekend"],
    skills: ["manual"],
    inDays: 5,
    postedDaysAgo: 1,
  },

  /* ---- employer-side, described rather than named ------------------------ */
  {
    slug: "s-events",
    city: "madrid",
    poster: null,
    employer: "An events staffing agency in central Madrid",
    title: "Event staff, Saturday shifts",
    description:
      "Setting up, checking wristbands and clearing down at conferences and concerts. Shifts are usually eight hours on a Saturday. No experience needed; you are told what to do on arrival.",
    kind: "EVENT_WORK",
    area: "Centro",
    pay: { min: 1200, max: 1400, period: "hour" },
    hoursMin: 8,
    hoursMax: 16,
    schedule: ["weekend"],
    languages: [{ code: "es", level: "conversational" }],
    skills: ["events", "hospitality"],
    studentFriendly: true,
    internationalFriendly: true,
    postedDaysAgo: 3,
  },
  {
    slug: "s-language",
    city: "madrid",
    poster: null,
    employer: "A language school near Chamberí",
    title: "English conversation assistant, evenings",
    description:
      "Leading small conversation groups for adult learners, two evenings a week during term. Native or near-native English; no Spanish required in the classroom.",
    kind: "PART_TIME",
    area: "Chamberí",
    pay: { min: 1500, period: "hour" },
    hoursMin: 6,
    hoursMax: 8,
    schedule: ["evening"],
    languages: [{ code: "en", level: "native" }],
    skills: ["tutoring", "languages"],
    studentFriendly: true,
    internationalFriendly: true,
    postedDaysAgo: 6,
  },
  {
    slug: "s-cafe",
    city: "madrid",
    poster: null,
    employer: "An independent café in Lavapiés",
    title: "Weekend barista",
    description:
      "Saturday and Sunday mornings behind the counter. Training given. Spanish needed for orders.",
    kind: "HOSPITALITY",
    area: "Lavapiés",
    pay: { min: 1000, period: "hour" },
    hoursMin: 12,
    hoursMax: 12,
    schedule: ["weekend"],
    languages: [{ code: "es", level: "conversational" }],
    skills: ["hospitality"],
    studentFriendly: true,
    postedDaysAgo: 8,
  },
  {
    slug: "s-library",
    city: "madrid",
    poster: null,
    employer: "A university library",
    title: "Student assistant, evening desk",
    description:
      "Reshelving, the loans desk and closing up. Twelve hours a week across three evenings, term time only.",
    kind: "CAMPUS_JOB",
    area: "Moncloa",
    pay: { min: 1100, period: "hour" },
    hoursMin: 12,
    hoursMax: 12,
    schedule: ["evening"],
    skills: ["admin"],
    studentFriendly: true,
    postedDaysAgo: 5,
  },
  {
    slug: "s-social",
    city: "madrid",
    poster: null,
    employer: "A small e-commerce brand",
    title: "Social media assistant, 12 hours a week",
    description:
      "Planning and scheduling posts, replying to comments, and putting together a weekly report. Remote, with one afternoon a month in the office.",
    kind: "MARKETING",
    area: null,
    remote: "remote",
    pay: { min: 45000, period: "month" },
    hoursMin: 12,
    hoursMax: 12,
    schedule: ["flexible"],
    languages: [{ code: "en", level: "fluent" }],
    skills: ["marketing", "writing"],
    studentFriendly: true,
    internationalFriendly: true,
    postedDaysAgo: 4,
  },
  {
    slug: "s-warehouse",
    city: "madrid",
    poster: null,
    employer: "A logistics operator on the outskirts",
    title: "Warehouse picking, night shifts",
    description:
      "Picking and packing orders, 22:00 to 06:00, four nights a week. Steel-toed boots provided.",
    kind: "SHIFT",
    area: "Getafe",
    pay: { min: 1300, period: "hour" },
    hoursMin: 32,
    hoursMax: 32,
    schedule: ["weekday"],
    skills: ["manual"],
    postedDaysAgo: 2,
  },
  {
    slug: "s-intern",
    city: "barcelona",
    poster: null,
    employer: "A design studio",
    title: "Design internship, six months",
    description:
      "Working alongside two designers on brand and web projects. Portfolio required. Applications close at the end of the month.",
    kind: "INTERNSHIP",
    area: "El Born",
    hoursMin: 20,
    hoursMax: 20,
    schedule: ["weekday"],
    skills: ["design"],
    studentFriendly: true,
    postedDaysAgo: 9,
  },
  {
    slug: "s-retail-ldn",
    city: "london",
    poster: null,
    employer: "A bookshop chain",
    title: "Bookseller, weekends and holidays",
    description:
      "Tills, shelving and helping customers find things they half remember. Ten to sixteen hours a week.",
    kind: "RETAIL",
    area: "Bloomsbury",
    pay: { min: 1250, period: "hour" },
    hoursMin: 10,
    hoursMax: 16,
    schedule: ["weekend"],
    languages: [{ code: "en", level: "fluent" }],
    skills: ["retail"],
    studentFriendly: true,
    postedDaysAgo: 4,
  },
  {
    slug: "s-bar-berlin",
    city: "berlin",
    poster: null,
    employer: "A bar in Friedrichshain",
    title: "Bar staff, Thursday to Saturday nights",
    description: "Late shifts, busy weekends. German helpful but the team speaks English.",
    kind: "HOSPITALITY",
    area: "Friedrichshain",
    pay: { min: 1400, period: "hour" },
    hoursMin: 15,
    hoursMax: 24,
    schedule: ["evening", "weekend"],
    languages: [{ code: "de", level: "basic" }],
    skills: ["hospitality"],
    studentFriendly: true,
    internationalFriendly: true,
    postedDaysAgo: 3,
  },
  {
    slug: "s-tutoring-ams",
    city: "amsterdam",
    poster: null,
    employer: "A private tutoring agency",
    title: "Maths tutor, secondary school level",
    description:
      "One-to-one tutoring at the student's home or online, four to eight hours a week. You set your own availability.",
    kind: "TUTORING",
    area: "Oost",
    remote: "hybrid",
    pay: { min: 1800, max: 2400, period: "hour" },
    hoursMin: 4,
    hoursMax: 8,
    schedule: ["evening", "flexible"],
    languages: [{ code: "en", level: "fluent" }],
    skills: ["tutoring"],
    studentFriendly: true,
    internationalFriendly: true,
    postedDaysAgo: 6,
  },
  {
    slug: "s-nopay",
    city: "madrid",
    poster: null,
    employer: "A startup accelerator",
    title: "Community assistant",
    description:
      "Helping run weekly events, welcoming visitors and keeping the space in order. Hours by arrangement.",
    kind: "PART_TIME",
    area: "Centro",
    hoursMin: 8,
    schedule: ["weekday", "evening"],
    skills: ["events", "admin"],
    /* Deliberately states no pay. The board has to be able to show that
       honestly — "Pay not stated" is a real and common answer, and a student
       deciding whether to spend an evening applying deserves to see it before
       they do rather than after. */
    postedDaysAgo: 7,
  },
];

export function seedWork(
  db: Database,
  {
    seedId,
    iso,
    daysAgo,
    daysFromNow,
  }: {
    seedId: (namespace: string, slug: string) => string;
    iso: (date: Date) => string;
    daysAgo: (days: number) => Date;
    daysFromNow: (days: number, hour?: number) => Date;
  },
): void {
  const now = new Date();

  for (const row of ROWS) {
    const city = cities.find((entry) => entry.slug === row.city);
    if (!city) continue;

    const posted = iso(daysAgo(row.postedDaysAgo));

    const opportunity: Opportunity = {
      id: seedId("opportunity", row.slug),
      provider: row.poster ? "students" : "sample",
      providerSlug: row.poster ? "students" : "sample",
      providerJobId: null,
      sourceUrl: null,
      title: row.title,
      description: row.description,
      kind: row.kind,
      employerId: null,
      employerName: row.employer,
      postedByUserId: row.poster ? seedId("user", row.poster) : null,
      citySlug: row.city,
      countryCode: city.countryCode,
      area: row.area,
      campusSlug: null,
      remoteType: row.remote ?? "onsite",
      pay: row.pay
        ? {
            minCents: row.pay.min,
            maxCents: row.pay.max ?? null,
            period: row.pay.period,
            currency: city.currency.code,
          }
        : null,
      hoursMin: row.hoursMin ?? null,
      hoursMax: row.hoursMax ?? null,
      schedule: row.schedule,
      startsAt: row.inDays === undefined ? null : iso(daysFromNow(row.inDays, 10)),
      languages: row.languages ?? [],
      skills: row.skills,
      /* `?? null` and never `?? false`: the row above omitting a field means
         the posting did not say, which is not the same as saying no. */
      studentFriendly: row.studentFriendly ?? null,
      internationalStudentFriendly: row.internationalFriendly ?? null,
      workAuthorizationNotes: null,
      /* Student gigs are answered here, in a direct message. Sample rows have
         nowhere to send anybody, and the apply control says exactly that. */
      applicationMethod: "internal",
      applicationUrl: null,
      postedAt: posted,
      expiresAt: null,
      fetchedAt: posted,
      lastSeenAt: iso(now),
      moderation: "published",
      filledAt: null,
    };

    db.opportunities.push(opportunity);
  }
}

/**
 * Keep dated gigs in the future, the same way seeded events are rolled.
 *
 * Only rows whose id matches their seed hash are touched — a gig a real
 * student posted keeps its real date, because moving somebody's Saturday is a
 * lie rather than a convenience.
 */
export function rollSeededGigsForward(
  db: Database,
  now: number,
  seedId: (namespace: string, slug: string) => string,
): number {
  const WEEK_MS = 7 * 86_400_000;
  const seeded = new Set(ROWS.map((row) => seedId("opportunity", row.slug)));
  let moved = 0;

  for (const opportunity of db.opportunities) {
    if (!opportunity.startsAt) continue;
    if (!seeded.has(opportunity.id)) continue;

    let starts = new Date(opportunity.startsAt).getTime();
    if (starts >= now) continue;
    while (starts < now) starts += WEEK_MS;

    opportunity.startsAt = new Date(starts).toISOString();
    moved += 1;
  }

  return moved;
}
