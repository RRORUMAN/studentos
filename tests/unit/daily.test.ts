import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Place } from "../../src/data/types.ts";
import type { CityEvent, CommunityPost } from "../../src/domain/types.ts";
import { canAfford, horizonFor } from "../../src/server/engines/afford.ts";
import { betterOption } from "../../src/server/engines/better-option.ts";
import { buildDailyBrief, daySentence } from "../../src/server/engines/brief.ts";
import type { BudgetReading } from "../../src/server/engines/budget.ts";
import { catchUp } from "../../src/server/engines/catch-up.ts";
import { buildForYouFeed, interleave, type FeedItem } from "../../src/server/engines/feed.ts";
import { quickActions } from "../../src/server/engines/quick-actions.ts";
import type { Scored } from "../../src/server/engines/recommend.ts";
import { rightNow } from "../../src/server/engines/right-now.ts";
import { planWeek } from "../../src/server/engines/week.ts";

/**
 * ============================================================================
 * DAILY ENGINES
 * ----------------------------------------------------------------------------
 * The Tier 0 logic behind Home: the brief, the feed, "can I afford this", the
 * week planner, right now, catch-up and the better-option swap. All pure, all
 * against a fixed clock.
 * ============================================================================
 */

const NOW = new Date("2026-09-10T18:00:00Z"); // a Thursday
const fmt = (cents: number) => `€${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

function reading(overrides: Partial<BudgetReading> = {}): BudgetReading {
  return {
    month: "2026-09",
    plannedCents: 80_000,
    spentCents: 30_000,
    remainingCents: 50_000,
    committedCents: 8_000,
    /* Nothing set aside for a trip in the daily fixtures. */
    reservedCents: 0,
    availableCents: 42_000,
    safeTodayCents: 2_000,
    safeThisWeekCents: 8_000,
    daysLeft: 21,
    categories: [],
    trips: [],
    overPace: false,
    paceDeltaCents: -1_500,
    /* spent (30,000) − paceDelta (−1,500): the even-pace line for the month. */
    pacedCents: 31_500,
    ...overrides,
  };
}

function event(overrides: Partial<CityEvent> = {}): CityEvent {
  return {
    id: overrides.id ?? "e1",
    citySlug: "madrid",
    campusSlug: null,
    title: "Free film night",
    blurb: "",
    kind: "culture",
    priceCents: 0,
    startsAt: new Date(NOW.getTime() + 2 * 3_600_000).toISOString(),
    endsAt: null,
    venue: "Conde Duque",
    point: { lat: 40.4, lng: -3.7 },
    source: "students",
    sourceUrl: null,
    confirmations: 12,
    interested: 30,
    tags: ["cinema", "free"],
    observedAt: NOW.toISOString(),
    ...overrides,
  };
}

/**
 * A place fixture.
 *
 * `metres` and `band` are the two knobs the tests actually turn, so they are
 * arguments rather than something a caller has to build a `Proximity` and a
 * `StudentValue` for by hand.
 */
function place(
  overrides: Partial<Place> & { metres?: number; band?: Place["value"]["band"] } = {},
): Place {
  const { metres = 600, band = "good", ...rest } = overrides;
  return {
    id: "p1",
    citySlug: "madrid",
    name: "Casa Paco",
    category: "Cheap eat",
    categoryKey: "cheap-eat",
    layers: ["cheap-food"],
    priceLevel: 2,
    proximity: { kind: "straight-line", metres, minutes: null },
    value: { band, reasons: [] },
    confirmations: 20,
    saves: 3,
    lat: 40.4168,
    lng: -3.7038,
    address: null,
    brand: null,
    website: null,
    phone: null,
    openingHours: null,
    rating: null,
    ratingCount: null,
    provider: "osm",
    sourceUrl: "https://www.openstreetmap.org/node/1",
    attribution: "© OpenStreetMap contributors",
    confidence: "recent",
    fetchedAt: NOW.toISOString(),
    ...rest,
  };
}

function scored<T>(item: T, match = 80, reasons = ["Within your budget"]): Scored<T> {
  return {
    item,
    match,
    reasons,
    components: {
      budgetFit: 1,
      interestFit: 0.7,
      distanceFit: 0.8,
      studentValue: 0.9,
      communityFit: 0.4,
      quality: 0.8,
      freshness: 1,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Can I afford this?                                                          */
/* -------------------------------------------------------------------------- */

describe("canAfford", () => {
  it("points at Monday on a Thursday and at Sunday on a Monday", () => {
    assert.equal(horizonFor(NOW).label, "Monday");
    assert.equal(horizonFor(NOW).days, 4);
    assert.equal(horizonFor(new Date("2026-09-07T10:00:00Z")).label, "Sunday");
  });

  it("says yes to a spend that leaves most of the horizon money", () => {
    const result = canAfford({ amountCents: 1_500, reading: reading(), now: NOW, formatMoney: fmt });
    assert.equal(result.verdict, "yes");
    assert.ok(result.leftoverCents > 0);
    assert.equal(result.suggestedCents, null);
  });

  it("says not ideal, and how much over, when the spend exceeds what is free", () => {
    const result = canAfford({ amountCents: 12_000, reading: reading(), now: NOW, formatMoney: fmt });
    assert.equal(result.verdict, "not-ideal");
    assert.ok(result.leftoverCents < 0);
    assert.match(result.headline, /more than you have free/);
    assert.ok((result.suggestedCents ?? 0) > 0);
  });

  it("refuses to pretend when there is no budget", () => {
    const result = canAfford({
      amountCents: 500,
      reading: reading({ plannedCents: 0, availableCents: 0 }),
      now: NOW,
      formatMoney: fmt,
    });
    assert.equal(result.verdict, "no-budget");
  });
});

/* -------------------------------------------------------------------------- */
/* Better option                                                               */
/* -------------------------------------------------------------------------- */

describe("betterOption", () => {
  const reported = (cents: number) => ({
    medianCents: cents,
    sampleSize: 4,
    lastObservedAt: NOW.toISOString(),
  });

  it("finds a cheaper place doing the same job about as well", () => {
    const current = place({ id: "a", priceLevel: 3, band: "good" });
    const cheaper = place({ id: "b", priceLevel: 1, band: "good", metres: 900 });
    const result = betterOption({
      current,
      candidates: [current, cheaper],
      maxMetres: 2_000,
    });
    assert.ok(result);
    assert.equal(result.place.id, "b");
  });

  it("states a saving ONLY when students reported a price at both ends", () => {
    const current = place({ id: "a", priceLevel: 3 });
    const cheaper = place({ id: "b", priceLevel: 1, metres: 700 });

    const withoutReports = betterOption({
      current,
      candidates: [current, cheaper],
      maxMetres: 2_000,
    });
    assert.ok(withoutReports);
    assert.equal(
      withoutReports.savingCents,
      null,
      "no student has reported a price, so there is no figure to state",
    );
    assert.equal(withoutReports.savingBasis, null);

    const withReports = betterOption({
      current,
      candidates: [current, cheaper],
      maxMetres: 2_000,
      observed: new Map([
        ["a", reported(1_900)],
        ["b", reported(1_100)],
      ]),
    });
    assert.ok(withReports);
    assert.equal(withReports.savingCents, 800);
    assert.equal(withReports.savingBasis, "student-reports");
  });

  it("does not suggest a much worse place just because it is cheap", () => {
    const current = place({ id: "a", priceLevel: 3, band: "strong" });
    const grim = place({ id: "b", priceLevel: 1, band: "mixed" });
    assert.equal(betterOption({ current, candidates: [grim], maxMetres: 2_000 }), null);
  });

  it("does not suggest a swap that is in the same price band", () => {
    const current = place({ id: "a", priceLevel: 2 });
    const same = place({ id: "b", priceLevel: 2 });
    assert.equal(betterOption({ current, candidates: [same], maxMetres: 2_000 }), null);
  });

  it("does not turn a barely cheaper reported price into a saving", () => {
    const current = place({ id: "a", priceLevel: 2 });
    const almost = place({ id: "b", priceLevel: 2 });
    const result = betterOption({
      current,
      candidates: [almost],
      maxMetres: 2_000,
      observed: new Map([
        ["a", reported(1_000)],
        ["b", reported(900)],
      ]),
    });
    assert.equal(result, null, "a euro off ten is not worth a recommendation");
  });
});

/* -------------------------------------------------------------------------- */
/* Daily brief                                                                 */
/* -------------------------------------------------------------------------- */

describe("buildDailyBrief", () => {
  it("emits only lines with something to say and caps at five", () => {
    const lines = buildDailyBrief({
      stage: "established",
      tonight: [event(), event({ id: "e2", priceCents: 800 })],
      friendEventIds: new Set(["e2"]),
      newDeals: [{ id: "d1", title: "€6 lunch", value: "€6" }],
      safeTodayCents: 1_800,
      hasBudget: true,
      nextTask: null,
      openInvites: 3,
      trendingPosts: 4,
      formatMoney: fmt,
      hour: 18,
    });
    assert.ok(lines.length <= 5);
    assert.equal(lines[0].kind, "tonight");
    assert.match(lines[0].text, /2 events match/);
    assert.match(lines[0].detail ?? "", /1 is free/);
    assert.match(lines[0].detail ?? "", /a friend is interested/);
    assert.ok(lines.every((line) => line.href.startsWith("/")));
  });

  it("says nothing about tonight when there is nothing on", () => {
    const lines = buildDailyBrief({
      stage: "established",
      tonight: [],
      friendEventIds: new Set(),
      newDeals: [],
      safeTodayCents: null,
      hasBudget: false,
      nextTask: null,
      openInvites: 0,
      trendingPosts: 0,
      formatMoney: fmt,
      hour: 18,
    });
    assert.equal(lines.length, 0);
  });

  it("writes the under-target sentence when under pace", () => {
    const sentence = daySentence({
      safeTodayCents: 2_000,
      hasBudget: true,
      paceDeltaCents: -1_400,
      weekTargetCents: 8_000,
      weekSpentCents: 3_000,
      freeTonight: 1,
      formatMoney: fmt,
    });
    assert.equal(sentence, "You're €14 under your target this week.");
  });
});

/* -------------------------------------------------------------------------- */
/* Quick actions                                                               */
/* -------------------------------------------------------------------------- */

describe("quickActions", () => {
  const base = {
    safeTodayCents: 2_500,
    hasBudget: true,
    overPace: false,
    social: true,
    day: 4,
    hour: 12,
    currencySymbol: "€",
    interests: [],
    hasCampus: true,
  };

  it("leads with settling in for a new student", () => {
    const actions = quickActions({ ...base, stage: "first-week" });
    assert.equal(actions[0].key, "settle");
  });

  it("offers a stretch plan when money is tight", () => {
    const actions = quickActions({ ...base, stage: "established", safeTodayCents: 600, overPace: true });
    assert.ok(actions.some((action) => action.key === "stretch"));
  });

  it("never exceeds six and never repeats a key", () => {
    const actions = quickActions({ ...base, stage: "established" });
    assert.ok(actions.length <= 6);
    assert.equal(new Set(actions.map((action) => action.key)).size, actions.length);
  });
});

/* -------------------------------------------------------------------------- */
/* Feed                                                                        */
/* -------------------------------------------------------------------------- */

describe("buildForYouFeed", () => {
  it("drops items that have no reason to be there", () => {
    const feed = buildForYouFeed({
      events: [scored(event(), 80, [])],
      places: [scored(place(), 90, [])],
      deals: [],
      invites: [],
      posts: [],
      friendEventIds: new Set(),
      spendingCategories: new Set(),
      campusSlug: null,
      now: NOW,
    });
    assert.equal(feed.length, 0);
  });

  it("floats an event friends are going to above an otherwise better place", () => {
    const feed = buildForYouFeed({
      events: [scored(event({ id: "e1" }), 70, ["Free"])],
      places: [scored(place({ id: "p1" }), 85, ["8-minute walk"])],
      deals: [],
      invites: [],
      posts: [],
      friendEventIds: new Set(["e1"]),
      spendingCategories: new Set(),
      campusSlug: null,
      now: NOW,
    });
    assert.equal(feed[0].kind, "event");
    assert.equal(feed[0].tag, "friends");
  });

  it("interleaves so no kind takes three in a row", () => {
    const items: FeedItem[] = ["a", "b", "c", "d"].map((id) => ({
      kind: "place",
      id,
      href: "/",
      title: id,
      meta: "",
      priceCents: null,
      match: 80,
      reasons: ["x"],
      social: null,
      score: 80,
      startsAt: null,
      tag: null,
    }));
    items.push({ ...items[0], kind: "event", id: "e", score: 10 });
    const out = interleave(items);
    assert.equal(out[2].kind, "event");
  });
});

/* -------------------------------------------------------------------------- */
/* Week                                                                        */
/* -------------------------------------------------------------------------- */

describe("planWeek", () => {
  const events = [0, 1, 2, 3, 4].map((offset) =>
    scored(
      event({
        id: `e${offset}`,
        priceCents: offset === 0 ? 0 : 900,
        startsAt: new Date(NOW.getTime() + (offset + 1) * 86_400_000).toISOString(),
      }),
      80 - offset,
      ["Matches cinema"],
    ),
  );

  it("never books more than four things or more than the week can spare", () => {
    const plan = planWeek({
      now: NOW,
      events,
      places: [scored(place(), 75, ["Cheap"])],
      weekBudgetCents: 2_000,
      dials: [],
      formatMoney: fmt,
    });
    assert.ok(plan.items.length <= 4);
    assert.ok(plan.totalCents <= Math.floor(2_000 * 0.7));
  });

  it("puts at most one thing on any day", () => {
    const sameDay = events.map((entry, index) =>
      scored({ ...entry.item, id: `s${index}`, startsAt: events[0].item.startsAt }, 80, ["x"]),
    );
    const plan = planWeek({
      now: NOW,
      events: sameDay,
      places: [],
      weekBudgetCents: null,
      dials: [],
      formatMoney: fmt,
    });
    assert.equal(plan.items.filter((item) => item.kind === "event").length, 1);
  });

  it("keeps everything free when the free dial is on", () => {
    const plan = planWeek({
      now: NOW,
      events,
      places: [scored(place({ layers: ["free"] }), 70, ["Free"])],
      weekBudgetCents: null,
      dials: ["free"],
      formatMoney: fmt,
    });
    assert.ok(plan.items.every((item) => item.priceCents === 0));
  });
});

/* -------------------------------------------------------------------------- */
/* Right now                                                                   */
/* -------------------------------------------------------------------------- */

describe("rightNow", () => {
  it("orders happening before soon, and never claims a place is open", () => {
    const under = event({ id: "u", startsAt: new Date(NOW.getTime() - 30 * 60_000).toISOString() });
    const soon = event({ id: "s", startsAt: new Date(NOW.getTime() + 60 * 60_000).toISOString(), priceCents: 500 });
    const later = event({ id: "l", startsAt: new Date(NOW.getTime() + 9 * 3_600_000).toISOString() });
    const items = rightNow({ now: NOW, events: [later, soon, under], invites: [], posts: [] });
    assert.equal(items[0].id, "u");
    assert.equal(items[0].kind, "happening");
    assert.equal(items[1].id, "s");
    assert.ok(!items.some((item) => item.id === "l"));
    assert.ok(items.every((item) => !/open now/i.test(item.meta)));
  });
});

/* -------------------------------------------------------------------------- */
/* Catch up                                                                    */
/* -------------------------------------------------------------------------- */

describe("catchUp", () => {
  const post = (overrides: Partial<CommunityPost>): CommunityPost => ({
    id: overrides.id ?? "p",
    citySlug: "madrid",
    campusSlug: null,
    channel: "general",
    authorId: "a",
    kind: "post",
    title: "t",
    body: null,
    placeId: null,
    upvotes: 0,
    commentCount: 0,
    hiddenAt: null,
    createdAt: NOW.toISOString(),
    ...overrides,
  });

  it("counts what was missed and picks deals and events first", () => {
    const since = new Date(NOW.getTime() - 86_400_000).toISOString();
    const result = catchUp({
      posts: [
        post({ id: "old", createdAt: new Date(NOW.getTime() - 3 * 86_400_000).toISOString(), upvotes: 90 }),
        post({ id: "deal", kind: "deal", upvotes: 2 }),
        post({ id: "chat", upvotes: 5 }),
      ],
      chat: [],
      since,
      campusSlug: null,
    });
    assert.equal(result.missed, 2);
    assert.equal(result.lines[0].postId, "deal");
    assert.ok(result.lines.every((line) => line.href.startsWith("/pulse/")));
  });
});
