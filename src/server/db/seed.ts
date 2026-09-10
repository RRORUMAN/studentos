import "server-only";

import { createHash } from "node:crypto";

import { campuses, cities } from "@/data/cities";
import { defaultPrivacy } from "@/domain/types";
import { isSampleContent } from "@/services/env";
import { seedDemoAccount } from "@/server/db/seed-demo";
import { rollSeededGigsForward, seedWork } from "@/server/db/seed-work";
import { seedTruth } from "@/server/db/seed-truth";
import type { Database } from "@/server/db/store";
import { emptyDatabase } from "@/server/db/schema";
import {
  loopChannels,
  seedChallenges,
  seedCommunities,
  seedDeals,
  seedEvents,
  seedFacts,
  seedGuides,
  seedGuides as guides,
} from "@/server/db/seed-content";

/**
 * ============================================================================
 * SEEDING
 * ----------------------------------------------------------------------------
 * Turns `seed-content.ts` into rows the first time the store is created.
 *
 * Two design decisions worth stating:
 *
 * IDS ARE DETERMINISTIC. Every seeded row's id is a hash of its slug rather
 * than a random uuid. That means a student's saved places and interested-in
 * events survive a re-seed, and it means the e2e suite can reference a known
 * id without first querying for it. Random ids here would make both of those
 * impossible for no benefit.
 *
 * AUTHOR ACCOUNTS CANNOT BE LOGGED INTO. The seeded community posts need
 * authors, so seeded users exist — but every one has `passwordHash: null` and
 * no auth token will ever be issued for them. `verifyPassword` runs the KDF
 * against a null digest and returns false, so there is no path in. They are
 * bylines, not accounts.
 * ============================================================================
 */

/** Stable id from a namespace and a slug. */
function seedId(namespace: string, slug: string): string {
  const hex = createHash("sha256").update(`${namespace}:${slug}`).digest("hex");
  /* Formatted as a uuid so the column type is identical to a real row's. */
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

const iso = (date: Date) => date.toISOString();
const daysFromNow = (days: number, hour = 12) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};
const daysAgo = (days: number) => daysFromNow(-days, 12);

/**
 * The offset, in hours, between a city's local time and UTC right now.
 *
 * Seeded events carry a *local* hour — a 22:00 open-air screening is at 22:00
 * in Madrid, not 22:00 UTC. Writing the local hour straight into
 * `setUTCHours` shifted every evening event forward by the city's offset, and
 * the 22:00 screening rendered as 00:00 the following day. The bug was
 * invisible while the product formatted times in the browser's zone and
 * appeared the moment it started formatting them in the city's.
 *
 * Derived from `Intl` rather than a table, so it is right across daylight
 * saving without anybody maintaining it.
 */
function utcOffsetHours(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 3_600_000);
}

/** A local hour in a city, as an absolute instant. */
function cityTime(citySlug: string, days: number, localHour: number): Date {
  const city = cities.find((entry) => entry.slug === citySlug);
  const base = daysFromNow(days, 12);
  const offset = city ? utcOffsetHours(city.timezone, base) : 0;
  const date = new Date(base);
  date.setUTCHours(localHour - offset, 0, 0, 0);
  return date;
}

/* -------------------------------------------------------------------------- */
/* Seeded authors                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Bylines for the seeded community content.
 *
 * `termsInCity` is the credibility signal the feed shows — someone in their
 * fourth term saying a place is good means more than someone in their first,
 * and it is a far more honest signal than a follower count.
 */
const AUTHORS = [
  { handle: "mireia", name: "Mireia", emoji: "🦊", city: "madrid", campus: "ucm", terms: 4 },
  { handle: "tobias", name: "Tobias", emoji: "🐢", city: "madrid", campus: "uam", terms: 2 },
  { handle: "aiko", name: "Aiko", emoji: "🌿", city: "madrid", campus: "uc3m", terms: 3 },
  { handle: "samir", name: "Samir", emoji: "🎧", city: "madrid", campus: "ucm", terms: 1 },
  { handle: "elena", name: "Elena", emoji: "📚", city: "barcelona", campus: null, terms: 5 },
  { handle: "joran", name: "Joran", emoji: "🚲", city: "amsterdam", campus: null, terms: 2 },
  { handle: "priya", name: "Priya", emoji: "🛠️", city: "london", campus: null, terms: 3 },
  { handle: "lukas", name: "Lukas", emoji: "🎹", city: "berlin", campus: null, terms: 4 },
] as const;

function seedAuthors(db: Database, now: Date): void {
  for (const author of AUTHORS) {
    const id = seedId("user", author.handle);
    const city = cities.find((entry) => entry.slug === author.city) ?? cities[0];

    db.users.push({
      id,
      email: `${author.handle}@seed.invalid`,
      /* No password digest: these are bylines, not accounts. */
      passwordHash: null,
      emailVerifiedAt: iso(now),
      provider: "password",
      createdAt: iso(daysAgo(120)),
      lastSeenAt: iso(daysAgo(1)),
      isAdmin: false,
    });

    db.profiles.push({
      userId: id,
      handle: author.handle,
      displayName: author.name,
      avatarEmoji: author.emoji,
      bio: null,
      studentStatus: "international",
      citySlug: author.city,
      countryCode: city.countryCode,
      arrivingOn: null,
      leavingOn: null,
      campusSlug: author.campus,
      universityName: null,
      homeArea: null,
      /* Seeded authors never carry a home point. Nothing needs it, and a fake
         one would sit in the most sensitive column in the schema. */
      homePoint: null,
      moneyGoals: [],
      interests: [],
      socialGoals: [],
      diets: [],
      transport: ["walk", "transit"],
      maxTravelMinutes: 30,
      priceSensitivity: "value",
      currency: city.currency.code,
      locale: "en-IE",
      studentVerifiedAt: iso(daysAgo(60)),
      termsInCity: author.terms,
      privacy: defaultPrivacy,
      onboardedAt: iso(daysAgo(120)),
      createdAt: iso(daysAgo(120)),
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Content                                                                     */
/* -------------------------------------------------------------------------- */

function seedEventRows(db: Database, now: Date): void {
  for (const event of seedEvents) {
    /* `hour` on a seed row is the city's local hour, not UTC. */
    const starts = cityTime(event.citySlug, event.inDays, event.hour);
    const ends = new Date(starts.getTime() + event.durationHours * 3_600_000);

    db.events.push({
      id: seedId("event", event.slug),
      citySlug: event.citySlug,
      campusSlug: event.campusSlug,
      title: event.title,
      blurb: event.blurb,
      kind: event.kind,
      priceCents: event.priceCents,
      startsAt: iso(starts),
      endsAt: iso(ends),
      venue: event.venue,
      point: { lat: event.lat, lng: event.lng },
      source: event.source,
      sourceUrl: event.sourceUrl,
      confirmations: event.confirmations,
      interested: event.interested,
      tags: event.tags,
      observedAt: iso(now),
    });
  }
}

function seedDealRows(db: Database, now: Date): void {
  for (const deal of seedDeals) {
    const id = seedId("deal", deal.slug);

    db.deals.push({
      id,
      citySlug: deal.citySlug,
      placeId: null,
      title: deal.title,
      detail: deal.detail,
      value: deal.value,
      category: deal.category,
      requiresStudentId: deal.requiresStudentId,
      expiresAt: deal.expiresInDays === null ? null : iso(daysFromNow(deal.expiresInDays)),
      source: deal.source,
      confirmations: deal.reportsAgoDays.length,
      submittedBy: null,
      /* Only marked verified once the reports actually clear the threshold in
         `dealConfidence`. The badge is computed, never asserted here. */
      verifiedAt: deal.reportsAgoDays.length >= 5 ? iso(now) : null,
      createdAt: iso(daysAgo(90)),
    });

    /* Reports are what make the confidence reading real rather than a label. */
    deal.reportsAgoDays.forEach((ago, index) => {
      db.dealReports.push({
        id: seedId("dealreport", `${deal.slug}-${index}`),
        dealId: id,
        userId: seedId("user", AUTHORS[index % AUTHORS.length].handle),
        outcome: "worked",
        note: null,
        createdAt: iso(daysAgo(ago)),
      });
    });
  }
}

function seedFactRows(db: Database, now: Date): void {
  for (const fact of seedFacts) {
    db.officialFacts.push({
      id: seedId("fact", fact.slug),
      citySlug: fact.citySlug,
      countryCode: fact.countryCode,
      topic: fact.topic,
      title: fact.title,
      summary: fact.summary,
      sourceName: fact.sourceName,
      sourceUrl: fact.sourceUrl,
      /* Set to seed time rather than backdated. A freshness badge that lies
         about when a visa rule was checked is worse than no badge. */
      checkedAt: iso(now),
      authority: fact.authority,
      variesByNationality: fact.variesByNationality,
    });
  }
}

function seedGuideRows(db: Database, now: Date): void {
  for (const guide of guides) {
    db.guides.push({
      id: seedId("guide", guide.slug),
      citySlug: guide.citySlug,
      countryCode: guide.countryCode,
      category: guide.category,
      title: guide.title,
      answer: guide.answer,
      points: guide.points,
      source: guide.source,
      sourceUrl: guide.sourceUrl,
      checkedAt: iso(now),
      confirmations: guide.confirmations,
    });
  }
}

function seedCommunityRows(db: Database, now: Date): void {
  for (const community of seedCommunities) {
    db.communities.push({
      id: seedId("community", community.slug),
      citySlug: community.citySlug,
      campusSlug: community.campusSlug,
      kind: community.kind,
      slug: community.slug,
      name: community.name,
      blurb: community.blurb,
      emoji: community.emoji,
      memberCount: community.memberCount,
      createdAt: iso(daysAgo(200)),
    });
  }
  void now;
}

/* -------------------------------------------------------------------------- */
/* Community posts and chat                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Opening posts, so a new city is not an empty room.
 *
 * Every one is a thing a student would actually post — a price, a question, a
 * missing player — rather than filler. The count is deliberately modest: a feed
 * with two hundred fake posts reads as fake, and eight real-shaped ones read as
 * a new community.
 */
const SEED_POSTS = [
  { slug: "p1", city: "madrid", channel: "cheap-eats", author: "mireia", kind: "recommendation" as const, title: "€6.50 lunch behind the Moncloa metro", body: "Menu is starter, main and a drink. Queue after 14:30 is long, go at 13:30.", up: 34, comments: 6, agoHours: 5 },
  { slug: "p2", city: "madrid", channel: "football", author: "tobias", kind: "anyone-down" as const, title: "Two short for five-a-side tomorrow 18:00", body: "UAM pitch 2. €2 each for the pitch.", up: 12, comments: 9, agoHours: 2 },
  { slug: "p3", city: "madrid", channel: "questions", author: "samir", kind: "question" as const, title: "Cheapest gym near UCM that is not a chain?", body: "The campus one is full at every hour I can go.", up: 8, comments: 11, agoHours: 20 },
  { slug: "p4", city: "madrid", channel: "deals", author: "aiko", kind: "deal" as const, title: "Cinema Wednesday is still €5 with a student card", body: "Worked today at two different chains. Bring photo ID as well.", up: 41, comments: 3, agoHours: 9 },
  { slug: "p5", city: "madrid", channel: "events-tonight", author: "mireia", kind: "event" as const, title: "Prado is free from 18:00 tonight", body: "Get there at 18:00 not 19:00 or you queue for the whole free window.", up: 27, comments: 2, agoHours: 1 },
  { slug: "p6", city: "madrid", channel: "housing", author: "tobias", kind: "question" as const, title: "Is €650 for a room in Lavapiés normal?", body: "Bills not included. Feels high but I have nothing to compare it to.", up: 15, comments: 14, agoHours: 30 },
  { slug: "p7", city: "barcelona", channel: "general", author: "elena", kind: "post" as const, title: "The beach is free and the terraces are not", body: "Two blocks inland the same beer is half the price. Took me a month to work out.", up: 52, comments: 7, agoHours: 12 },
  { slug: "p8", city: "berlin", channel: "questions", author: "lukas", kind: "question" as const, title: "Anmeldung appointment — how far ahead did you book?", body: "Everything in my district is six weeks out.", up: 22, comments: 18, agoHours: 26 },
  { slug: "p9", city: "london", channel: "deals", author: "priya", kind: "deal" as const, title: "18+ Oyster took 12 days to arrive", body: "Apply before you need it. Paying full fare in the meantime is brutal.", up: 30, comments: 5, agoHours: 40 },
  { slug: "p10", city: "amsterdam", channel: "general", author: "joran", kind: "recommendation" as const, title: "Buy a bike from a shop with a receipt", body: "A €40 bike off the street is usually someone else's €400 bike.", up: 63, comments: 8, agoHours: 15 },
];

function seedPosts(db: Database): void {
  for (const post of SEED_POSTS) {
    const authorId = seedId("user", post.author);
    const createdAt = new Date(Date.now() - post.agoHours * 3_600_000);
    const campus = AUTHORS.find((a) => a.handle === post.author)?.campus ?? null;

    db.posts.push({
      id: seedId("post", post.slug),
      citySlug: post.city,
      campusSlug: campus,
      channel: post.channel,
      authorId,
      kind: post.kind,
      title: post.title,
      body: post.body,
      placeId: null,
      upvotes: post.up,
      commentCount: post.comments,
      hiddenAt: null,
      createdAt: iso(createdAt),
    });
  }
}

const SEED_CHAT = [
  { slug: "c1", city: "madrid", channel: "events-tonight", author: "samir", body: "Anyone going to the Conde Duque screening Friday?", agoMinutes: 18 },
  { slug: "c2", city: "madrid", channel: "events-tonight", author: "aiko", body: "Yes. Bring something to sit on, the ground is freezing.", agoMinutes: 14 },
  { slug: "c3", city: "madrid", channel: "cheap-eats", author: "tobias", body: "The €6.50 place near Moncloa has a queue out the door already", agoMinutes: 45 },
  { slug: "c4", city: "madrid", channel: "general", author: "mireia", body: "Metro line 6 is part closed this weekend, plan around it", agoMinutes: 120 },
  { slug: "c5", city: "madrid", channel: "gym", author: "samir", body: "Campus gym is empty before 09:00 if anyone wants a regular slot", agoMinutes: 200 },
  { slug: "c6", city: "berlin", channel: "questions", author: "lukas", body: "Got an Anmeldung slot in Neukölln for next Tuesday if anyone wants the technique", agoMinutes: 60 },
];

function seedChat(db: Database): void {
  for (const message of SEED_CHAT) {
    db.chat.push({
      id: seedId("chat", message.slug),
      citySlug: message.city,
      channel: message.channel,
      authorId: seedId("user", message.author),
      body: message.body,
      replyToId: null,
      createdAt: iso(new Date(Date.now() - message.agoMinutes * 60_000)),
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Marketplace                                                                 */
/* -------------------------------------------------------------------------- */

const SEED_LISTINGS = [
  /* ---- buy and sell ---------------------------------------------------- */
  { slug: "l1", city: "madrid", seller: "mireia", kind: "sell" as const, mode: "offer" as const, title: "IKEA desk, collect from Moncloa", detail: "Two years old, one scratch on the top. Comes apart for transport.", category: "furniture" as const, cents: 2500, condition: "good" as const, meet: "Moncloa metro, main exit", leaving: true },
  { slug: "l2", city: "madrid", seller: "tobias", kind: "sell" as const, mode: "offer" as const, title: "Bike, works fine, needs a new lock", detail: "Commuted on it all year. Selling because I am leaving in June.", category: "bikes" as const, cents: 6000, condition: "used" as const, meet: "UAM Cantoblanco entrance", leaving: true },
  { slug: "l4", city: "madrid", seller: "samir", kind: "sell" as const, mode: "offer" as const, title: "Econometrics textbook, current edition", detail: "Barely opened, which tells you how the module went.", category: "books" as const, cents: 1500, condition: "good" as const, meet: "UCM library entrance", leaving: false },
  { slug: "l5", city: "berlin", seller: "lukas", kind: "sell" as const, mode: "offer" as const, title: "Desk lamp and shelf", detail: "Leaving at the end of the semester, both must go.", category: "furniture" as const, cents: 1200, condition: "good" as const, meet: "Hermannplatz U-Bahn", leaving: true },

  /* ---- requests: the half that makes it a network ----------------------- */
  { slug: "l6", city: "madrid", seller: "aiko", kind: "sell" as const, mode: "request" as const, title: "Looking for a desk under €30", detail: "Anything that fits a small room. I can collect with a friend and a car.", category: "furniture" as const, cents: 3000, condition: "used" as const, meet: "Lavapiés or anywhere on line 3", leaving: false },
  { slug: "l7", city: "madrid", seller: "samir", kind: "sell" as const, mode: "request" as const, title: "Need a second-hand bike, up to €50", detail: "For the campus commute. Happy to fix brakes myself.", category: "bikes" as const, cents: 5000, condition: "used" as const, meet: "UCM main gate", leaving: false },

  /* ---- free stuff -------------------------------------------------------- */
  { slug: "l3", city: "madrid", seller: "aiko", kind: "free" as const, mode: "offer" as const, title: "Kitchen starter box — free", detail: "Pans, plates, cutlery for two. Taking none of it home.", category: "kitchen" as const, cents: 0, condition: "used" as const, meet: "Lavapiés, Plaza de Cabestreros", leaving: true },
  { slug: "l8", city: "barcelona", seller: "elena", kind: "free" as const, mode: "offer" as const, title: "Four kitchen chairs, free to whoever carries them", detail: "Solid wood, one wobbly leg. They are yours if you can move them.", category: "furniture" as const, cents: 0, condition: "worn" as const, meet: "Gràcia, Plaça del Sol", leaving: true },

  /* ---- borrow ------------------------------------------------------------ */
  { slug: "l9", city: "madrid", seller: "tobias", kind: "borrow" as const, mode: "offer" as const, title: "Cordless drill, free to borrow for a day", detail: "Bring it back charged. Good for shelves and flat-pack.", category: "tools" as const, cents: 0, condition: "good" as const, meet: "UAM Cantoblanco entrance", leaving: false },
  { slug: "l10", city: "madrid", seller: "mireia", kind: "borrow" as const, mode: "request" as const, title: "Anyone have a suitcase I can borrow for a weekend?", detail: "Flying with hand luggage only and need a big one for one trip.", category: "household" as const, cents: 0, condition: "good" as const, meet: "Malasaña, any metro", leaving: false },

  /* ---- help -------------------------------------------------------------- */
  { slug: "l11", city: "madrid", seller: "samir", kind: "help" as const, mode: "request" as const, title: "Need one person to help move a sofa on Saturday", detail: "Third floor, no lift, twenty minutes of work. I will buy lunch.", category: "moving" as const, cents: 0, condition: "good" as const, meet: "Argüelles, meet at the metro", leaving: false, inDays: 3 },
  { slug: "l12", city: "madrid", seller: "mireia", kind: "help" as const, mode: "offer" as const, title: "Can help with Spanish paperwork and translation", detail: "Fourth term here. I have done the empadronamiento twice and can read a contract.", category: "translate" as const, cents: 0, condition: "good" as const, meet: "UCM library, or a call", leaving: false },
  { slug: "l13", city: "berlin", seller: "lukas", kind: "help" as const, mode: "request" as const, title: "Someone who has done the Anmeldung recently?", detail: "Twenty minutes of your time to check my forms before the appointment.", category: "advice" as const, cents: 0, condition: "good" as const, meet: "Neukölln, any café", leaving: false },

  /* ---- rides and travel --------------------------------------------------- */
  { slug: "l14", city: "madrid", seller: "aiko", kind: "ride" as const, mode: "offer" as const, title: "Splitting a taxi to Barajas, Friday 06:00", detail: "Two seats. Roughly €30 the whole car from Lavapiés, so €10 each with three.", category: "airport" as const, cents: 1000, condition: "good" as const, meet: "Lavapiés metro, Calle Argumosa exit", leaving: false, inDays: 2 },
  { slug: "l15", city: "madrid", seller: "tobias", kind: "ride" as const, mode: "request" as const, title: "Anyone driving towards Valencia this weekend?", detail: "Happy to split fuel and tolls. Flexible on the day.", category: "road-trip" as const, cents: 2000, condition: "good" as const, meet: "Anywhere on the A-3 side of the city", leaving: false, inDays: 4 },
];

function seedListings(db: Database): void {
  for (const listing of SEED_LISTINGS) {
    db.listings.push({
      id: seedId("listing", listing.slug),
      citySlug: listing.city,
      campusSlug: AUTHORS.find((a) => a.handle === listing.seller)?.campus ?? null,
      sellerId: seedId("user", listing.seller),
      kind: listing.kind,
      mode: listing.mode,
      title: listing.title,
      detail: listing.detail,
      category: listing.category,
      priceCents: listing.cents,
      condition: listing.condition,
      meetArea: listing.meet,
      status: "active",
      /* Flagged when listed from Leaving Mode, so arriving students see the
         departing stock first — which is the whole loop. */
      fromLeaving: listing.leaving,
      whenAt: "inDays" in listing && typeof listing.inDays === "number" ? iso(daysFromNow(listing.inDays, 9)) : null,
      createdAt: iso(daysAgo(3)),
      soldAt: null,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Price observations                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Seeds the price graph from each city's published anchors.
 *
 * Observations are spread across the anchor range rather than clustered on the
 * midpoint, so `summarisePrices` returns a band a student can act on ("€8-13")
 * instead of a single suspiciously precise figure.
 */
function seedPrices(db: Database): void {
  for (const city of cities) {
    const samples: { item: string; range: [number, number] }[] = [
      { item: "lunch", range: city.anchors.lunch },
      { item: "pint", range: city.anchors.pint },
      { item: "weekly-basket", range: city.anchors.weeklyGroceries },
    ];

    for (const sample of samples) {
      const [low, high] = sample.range;
      /* Six observations across the range, deterministic. */
      for (let index = 0; index < 6; index += 1) {
        const value = low + ((high - low) * index) / 5;
        db.priceObservations.push({
          id: seedId("price", `${city.slug}-${sample.item}-${index}`),
          citySlug: city.slug,
          placeId: null,
          item: sample.item,
          amountCents: Math.round(value * 100),
          currency: city.currency.code,
          source: "student-report",
          userId: null,
          observedAt: iso(daysAgo(index * 4 + 1)),
        });
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Challenges                                                                  */
/* -------------------------------------------------------------------------- */

function seedChallengeRows(db: Database, now: Date): void {
  for (const challenge of seedChallenges) {
    db.challenges.push({
      id: seedId("challenge", challenge.slug),
      citySlug: null,
      slug: challenge.slug,
      title: challenge.title,
      blurb: challenge.blurb,
      emoji: challenge.emoji,
      metric: challenge.metric,
      target: challenge.target,
      capCents: challenge.capCents,
      startsAt: iso(now),
      endsAt: iso(daysFromNow(challenge.lastsDays)),
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

export async function seedDatabase(db: Database): Promise<void> {
  const now = new Date();

  seedAuthors(db, now);
  seedEventRows(db, now);
  seedDealRows(db, now);
  seedFactRows(db, now);
  seedGuideRows(db, now);
  seedCommunityRows(db, now);
  seedPosts(db);
  seedChat(db);
  seedListings(db);
  seedPrices(db);
  seedChallengeRows(db, now);
  seedTruth(db, { seedId, iso, daysAgo });
  seedWork(db, { seedId, iso, daysAgo, daysFromNow });

  /* Only when an operator set STUDENTOS_DEMO_PASSWORD. See seed-demo.ts. */
  await seedDemoAccount(db);
}

/**
 * Fill tables that did not exist when this store file was written.
 *
 * Only ever *adds*. A migration that rewrote or removed a student's rows would
 * be a data-loss bug hiding behind a version number, and the version is bumped
 * far too casually for that to be safe.
 */
export async function migrateDatabase(db: Database, from: number): Promise<void> {
  /* v2 introduced Work. A store written before it has an empty board, which
     reads exactly like a city where nobody has posted — so seed it.

     Only in sample mode. The argument for backfilling here is that an empty
     board is indistinguishable from a quiet one, and that argument is a demo
     argument: on a real deployment an empty board IS a quiet one, and filling
     it with invented gigs so it looks busier is the fabrication the content
     mode exists to prevent. A real store crossing this version gets the empty
     table it should have. */
  if (isSampleContent && from < 2 && db.opportunities.length === 0) {
    seedWork(db, { seedId, iso, daysAgo, daysFromNow });
  }
}

/* -------------------------------------------------------------------------- */
/* Undoing a seed                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Every row id this seeder produces, by table.
 *
 * Built by running the seeder into a throwaway empty database and reading the
 * ids back out. That is deliberately not a rule about how a seeded id *looks*:
 * `seedId` happens to be a sha256 formatted as a uuid, and a heuristic over
 * that shape would be a guess about which of a student's rows to delete. This
 * is not a guess. A row is seeded if and only if this seeder, run now, from
 * this content file, produces its id.
 *
 * The demo account is excluded — `seedDemoAccount` only writes when an
 * operator set a password for it, and if they did, it is a real login they
 * are using rather than sample content pretending to be a city.
 */
async function seededIdsByTable(): Promise<Map<string, Set<string>>> {
  const probe = emptyDatabase();

  seedAuthors(probe, new Date());
  seedEventRows(probe, new Date());
  seedDealRows(probe, new Date());
  seedFactRows(probe, new Date());
  seedGuideRows(probe, new Date());
  seedCommunityRows(probe, new Date());
  seedPosts(probe);
  seedChat(probe);
  seedListings(probe);
  seedPrices(probe);
  seedChallengeRows(probe, new Date());
  seedTruth(probe, { seedId, iso, daysAgo });
  seedWork(probe, { seedId, iso, daysAgo, daysFromNow });

  const ids = new Map<string, Set<string>>();
  for (const [table, rows] of Object.entries(probe)) {
    if (!Array.isArray(rows)) continue;
    const set = new Set<string>();
    for (const row of rows) {
      const id = (row as { id?: unknown }).id;
      if (typeof id === "string") set.add(id);
    }
    if (set.size > 0) ids.set(table, set);
  }
  return ids;
}

export type SeedPurge = {
  /** Rows removed, by table. Only tables that lost rows appear. */
  removed: Record<string, number>;
  total: number;
};

/**
 * Remove the rows this seeder wrote, and only those.
 *
 * The counterpart to gating the seeder: gating stops a *new* deployment
 * inventing content, and does nothing for a store that was seeded before
 * somebody flipped the mode. Without this there was no way back at all —
 * the invented events and the "student reports" that no student made simply
 * stayed, with the notice that disclosed them now switched off.
 *
 * WHAT IT WILL NOT TOUCH. A student's own rows are not in the probe, so they
 * are not in the id set, so they cannot be selected. Rows that reference a
 * seeded row — a real student's RSVP to a seeded event, a save, a comment —
 * are left alone here rather than cascaded: deleting a student's row because
 * of what it points at is exactly the "never delete legitimate user data"
 * line, and a dangling reference reads as an event that has passed, which
 * every surface already handles.
 */
export async function purgeSeededRows(db: Database): Promise<SeedPurge> {
  const seeded = await seededIdsByTable();
  const removed: Record<string, number> = {};
  let total = 0;

  for (const [table, ids] of seeded) {
    const rows = (db as unknown as Record<string, unknown>)[table];
    if (!Array.isArray(rows)) continue;

    const kept = rows.filter((row) => !ids.has((row as { id?: string }).id ?? ""));
    const gone = rows.length - kept.length;
    if (gone === 0) continue;

    /* Replace in place: the store holds a reference to the array. */
    rows.length = 0;
    for (const row of kept) rows.push(row);

    removed[table] = gone;
    total += gone;
  }

  return { removed, total };
}

/** How many seeded rows are present, without removing anything. */
export async function countSeededRows(db: Database): Promise<SeedPurge> {
  const seeded = await seededIdsByTable();
  const removed: Record<string, number> = {};
  let total = 0;

  for (const [table, ids] of seeded) {
    const rows = (db as unknown as Record<string, unknown>)[table];
    if (!Array.isArray(rows)) continue;
    const hits = rows.filter((row) => ids.has((row as { id?: string }).id ?? "")).length;
    if (hits === 0) continue;
    removed[table] = hits;
    total += hits;
  }

  return { removed, total };
}

/* -------------------------------------------------------------------------- */
/* Keeping the demo alive                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Roll seeded events forward so a demo install is never a wall of empty states.
 *
 * Only touches rows whose id matches their seed hash — anything a real student
 * created keeps its real date, because moving a user's event would be a lie
 * rather than a convenience. Whole weeks are used so a Saturday event stays on
 * a Saturday.
 */
export function rollSeededEventsForward(db: Database): number {
  const now = Date.now();
  const WEEK_MS = 7 * 86_400_000;
  let moved = 0;

  const seededIds = new Set(seedEvents.map((event) => seedId("event", event.slug)));

  for (const event of db.events) {
    if (!seededIds.has(event.id)) continue;

    let starts = Date.parse(event.startsAt);
    if (starts >= now - 6 * 3_600_000) continue;

    const duration = event.endsAt ? Date.parse(event.endsAt) - starts : 2 * 3_600_000;
    const weeks = Math.ceil((now - starts) / WEEK_MS);
    starts += weeks * WEEK_MS;

    event.startsAt = new Date(starts).toISOString();
    event.endsAt = new Date(starts + duration).toISOString();
    moved += 1;
  }

  /* Dated gigs go stale the same way and for the same reason: a demo whose
     Saturday shift was three weeks ago teaches a visitor that the board is
     dead, which is a worse first impression than an empty one. */
  moved += rollSeededGigsForward(db, now, seedId);

  return moved;
}

/** Exported for the e2e suite, which needs to address seeded rows by slug. */
export { seedId };
export const seedChannelSlugs = loopChannels.map((channel) => channel.slug);
export const seedCampusSlugs = campuses.map((campus) => campus.slug);
/**
 * How many places a fresh install seeds: none, and permanently.
 *
 * Places are not seeded any more. They come from a provider at request time —
 * see `src/server/places`. The constant stays because the setup script and the
 * admin screen both report it, and it now reports the truth: there is no such
 * thing as a seeded place, so there is no sample content to disclose here.
 */
export const seedPlaceCount = 0;
export const seedGuideCount = seedGuides.length;
