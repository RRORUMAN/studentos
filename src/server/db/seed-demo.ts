import "server-only";

import { createHash } from "node:crypto";

import { missionTemplate } from "@/config/missions";
import { getCampus, getCity } from "@/data/cities";
import { placesForCity } from "@/data/places";
import { defaultPrivacy, type Profile } from "@/domain/types";
import { suggestEnvelopes } from "@/server/engines/budget";
import { hashPassword } from "@/server/auth/crypto";
import type { Database } from "@/server/db/store";
import { env } from "@/services/env";

/**
 * ============================================================================
 * DEMO ACCOUNT
 * ----------------------------------------------------------------------------
 * A fully populated student, for QA and for showing the product without
 * clicking through onboarding first.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO DEFAULT PASSWORD
 *
 * This account is created **only** when `STUDENTOS_DEMO_PASSWORD` is set in the
 * environment. There is deliberately no fallback, no "demo1234", and no
 * `NODE_ENV` check that would quietly create it on a host somebody forgot to
 * configure.
 *
 * A seeded account with a known password is a real account with a published
 * credential. On a public preview that is an open door into a signed-in
 * product — it can post to the community, message students and hold a
 * subscription row. Requiring the operator to choose the password means the
 * door only exists where somebody deliberately opened it.
 *
 * Everything below is written with deterministic ids derived from the email,
 * so re-seeding produces the same account rather than a second one.
 * ============================================================================
 */

const DEMO_EMAIL = "demo@studentos.local";

function demoId(namespace: string, key: string): string {
  const hex = createHash("sha256").update(`demo:${namespace}:${key}`).digest("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), `5${hex.slice(13, 16)}`, `a${hex.slice(17, 20)}`, hex.slice(20, 32)].join("-");
}

const iso = (date: Date) => date.toISOString();
const daysFromNow = (days: number, hour = 12) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};
const daysAgo = (days: number, hour = 12) => daysFromNow(-days, hour);

/** True when an operator has deliberately configured the demo account. */
export const demoAccountEnabled = Boolean(env.demoPassword);

export const demoAccount = { email: DEMO_EMAIL, enabled: demoAccountEnabled } as const;

/**
 * Build the demo student. Returns the number of rows written, or 0 when the
 * password is not configured.
 */
export async function seedDemoAccount(db: Database): Promise<number> {
  const password = env.demoPassword;
  if (!password) return 0;
  if (db.users.some((row) => row.email === DEMO_EMAIL)) return 0;

  const now = new Date();
  const city = getCity("madrid");
  if (!city) return 0;
  const campus = getCampus("ucm");
  const userId = demoId("user", DEMO_EMAIL);
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let rows = 0;

  /* ---- account ----------------------------------------------------------- */
  db.users.push({
    id: userId,
    email: DEMO_EMAIL,
    passwordHash: await hashPassword(password),
    emailVerifiedAt: iso(daysAgo(40)),
    provider: "password",
    createdAt: iso(daysAgo(40)),
    lastSeenAt: iso(now),
    isAdmin: false,
  });
  rows += 1;

  const profile: Profile = {
    userId,
    handle: "demo",
    displayName: "Demo",
    avatarEmoji: "🧭",
    bio: "Exchange student, second term. Mostly here for the cheap lunch.",
    studentStatus: "exchange",
    citySlug: city.slug,
    countryCode: city.countryCode,
    /* Arrived five weeks ago and leaving in four months: "established", which
       is the stage most of the product is designed around. */
    arrivingOn: iso(daysAgo(35)),
    leavingOn: iso(daysFromNow(120)),
    campusSlug: campus?.slug ?? null,
    universityName: campus?.name ?? null,
    homeArea: "Malasaña",
    /* A real coordinate for the neighbourhood centre, so walking times are
       computed rather than defaulted. It is never shown to anyone. */
    homePoint: { lat: 40.4256, lng: -3.7038 },
    moneyGoals: ["stop-overspending", "cheaper-alternatives"],
    interests: ["cheap-eats", "football", "museums", "language-exchange", "live-music"],
    socialGoals: ["meet-friends", "sports", "language-exchange"],
    diets: ["vegetarian"],
    transport: ["walk", "transit"],
    maxTravelMinutes: 30,
    priceSensitivity: "value",
    currency: city.currency.code,
    locale: "en-GB",
    language: "en",
    studentVerifiedAt: iso(daysAgo(38)),
    termsInCity: 2,
    privacy: defaultPrivacy,
    onboardedAt: iso(daysAgo(40)),
    createdAt: iso(daysAgo(40)),
  };
  db.profiles.push(profile);
  db.moves.push({
    userId,
    fromCountryCode: "DE",
    toCountryCode: city.countryCode,
    citySlug: city.slug,
    campusSlug: campus?.slug ?? null,
    arrivingOn: profile.arrivingOn,
    leavingOn: profile.leavingOn,
    housing: "sorted",
    stayMonths: 6,
    createdAt: iso(daysAgo(40)),
    updatedAt: iso(daysAgo(40)),
  });
  db.subscriptions.push({
    userId,
    plan: "free",
    status: "none",
    period: "monthly",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    updatedAt: iso(daysAgo(40)),
  });
  rows += 3;

  /* ---- budget ------------------------------------------------------------ */
  const monthlyTotalCents = 82_000;
  db.budgetSetups.push({ userId, mode: "simple", monthlyTotalCents, excludeHousing: false, updatedAt: iso(daysAgo(40)) });
  for (const envelope of suggestEnvelopes(monthlyTotalCents)) {
    db.envelopes.push({ id: demoId("envelope", envelope.category), userId, month, category: envelope.category, plannedCents: envelope.plannedCents, custom: false });
    rows += 1;
  }

  /* Transactions across the month, weighted so "eating out" is genuinely
     drifting ahead of pace. That is what makes the savings engine and the
     budget coaching produce a real finding rather than an empty state. */
  const spends: { day: number; category: string; cents: number; merchant: string }[] = [
    { day: 1, category: "housing", cents: 42_000, merchant: "Rent" },
    { day: 2, category: "transport", cents: 2_000, merchant: "Abono Joven" },
    { day: 2, category: "groceries", cents: 3_420, merchant: "Mercadona" },
    { day: 4, category: "eating-out", cents: 1_350, merchant: "Menú del día" },
    { day: 5, category: "eating-out", cents: 1_180, merchant: "Ramen counter" },
    { day: 6, category: "nightlife", cents: 1_800, merchant: "La Latina" },
    { day: 8, category: "groceries", cents: 2_910, merchant: "Mercadona" },
    { day: 9, category: "eating-out", cents: 1_450, merchant: "Lunch near campus" },
    { day: 11, category: "entertainment", cents: 500, merchant: "Cinema Wednesday" },
    { day: 12, category: "eating-out", cents: 1_620, merchant: "Dinner, Malasaña" },
    { day: 14, category: "groceries", cents: 3_140, merchant: "Mercadona" },
    { day: 15, category: "eating-out", cents: 1_290, merchant: "Menú del día" },
    { day: 16, category: "fitness", cents: 2_500, merchant: "Campus gym" },
    { day: 18, category: "eating-out", cents: 1_710, merchant: "Tapas, Lavapiés" },
    { day: 19, category: "subscriptions", cents: 1_099, merchant: "Phone" },
  ];
  for (const spend of spends) {
    const spentAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), spend.day, 13, 0, 0));
    if (spentAt.getTime() > now.getTime()) continue;
    db.transactions.push({
      id: demoId("tx", `${spend.day}-${spend.category}-${spend.cents}`),
      userId,
      category: spend.category,
      amountCents: spend.cents,
      merchant: spend.merchant,
      note: null,
      spentAt: iso(spentAt),
      source: "manual",
      receiptId: null,
      createdAt: iso(spentAt),
    });
    rows += 1;
  }

  db.recurring.push(
    { id: demoId("recurring", "rent"), userId, label: "Rent", category: "housing", amountCents: 42_000, cadence: "monthly", dayOfPeriod: 1, active: true, createdAt: iso(daysAgo(40)) },
    { id: demoId("recurring", "phone"), userId, label: "Phone", category: "subscriptions", amountCents: 1_099, cadence: "monthly", dayOfPeriod: 19, active: true, createdAt: iso(daysAgo(40)) },
    { id: demoId("recurring", "gym"), userId, label: "Campus gym", category: "fitness", amountCents: 2_500, cadence: "monthly", dayOfPeriod: 16, active: true, createdAt: iso(daysAgo(30)) },
  );
  rows += 3;

  /* ---- notifications preferences ---------------------------------------- */
  db.notificationPrefs.push({
    userId,
    topics: {
      "budget-warnings": true,
      "free-events": true,
      deals: true,
      "friends-plans": true,
      plans: true,
      campus: true,
      pulse: false,
      arrival: true,
      "weekend-ideas": true,
    },
    quietFrom: 23,
    quietTo: 8,
    updatedAt: iso(daysAgo(40)),
  });
  db.memories.push({
    userId,
    categoryAffinity: { "cheap-food": 0.62, groceries: 0.31, study: 0.18, nightlife: -0.12 },
    dislikedPlaceIds: [],
    likedPlaceIds: ["mad-menu"],
    observedPriceBandCents: 1_200,
    observedTravelMinutes: 22,
    updatedAt: iso(daysAgo(4)),
  });
  rows += 2;

  /* ---- community: friends, follows, membership -------------------------- */
  const seedUser = (handle: string) => createHash("sha256").update(`user:${handle}`).digest("hex");
  const authorId = (handle: string) => {
    const hex = seedUser(handle);
    return [hex.slice(0, 8), hex.slice(8, 12), `5${hex.slice(13, 16)}`, `a${hex.slice(17, 20)}`, hex.slice(20, 32)].join("-");
  };
  const mireia = authorId("mireia");
  const tobias = authorId("tobias");
  const aiko = authorId("aiko");
  const samir = authorId("samir");

  db.friendships.push(
    { id: demoId("friend", "mireia"), requesterId: userId, addresseeId: mireia, status: "accepted", createdAt: iso(daysAgo(25)) },
    { id: demoId("friend", "tobias"), requesterId: tobias, addresseeId: userId, status: "accepted", createdAt: iso(daysAgo(18)) },
    { id: demoId("friend", "samir"), requesterId: samir, addresseeId: userId, status: "pending", createdAt: iso(daysAgo(1)) },
  );
  db.follows.push(
    { followerId: userId, followeeId: aiko, createdAt: iso(daysAgo(12)) },
    { followerId: userId, followeeId: mireia, createdAt: iso(daysAgo(25)) },
  );
  for (const community of db.communities.filter((row) => row.citySlug === "madrid" && (row.campusSlug === null || row.campusSlug === "ucm"))) {
    db.communityMembers.push({ communityId: community.id, userId, role: "member", joinedAt: iso(daysAgo(35)) });
    community.memberCount += 1;
    rows += 1;
  }
  rows += 5;

  /* ---- saved, events, plans --------------------------------------------- */
  const places = placesForCity("madrid");
  for (const place of places.slice(0, 3)) {
    db.saved.push({ id: demoId("saved", place.id), userId, kind: "place", targetId: place.id, collectionId: null, note: null, createdAt: iso(daysAgo(9)) });
    rows += 1;
  }
  const upcoming = db.events
    .filter((event) => event.citySlug === "madrid" && Date.parse(event.startsAt) > now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const [index, event] of upcoming.slice(0, 2).entries()) {
    db.eventResponses.push({ eventId: event.id, userId, status: index === 0 ? "going" : "interested", respondedAt: iso(daysAgo(2)) });
    /* A friend going to the same thing, so the "friends interested" signal is
       real rather than a formatting demonstration. */
    if (index === 0) db.eventResponses.push({ eventId: event.id, userId: mireia, status: "going", respondedAt: iso(daysAgo(1)) });
    db.saved.push({ id: demoId("saved", event.id), userId, kind: "event", targetId: event.id, collectionId: null, note: null, createdAt: iso(daysAgo(2)) });
    rows += 2;
  }

  const planId = demoId("plan", "saturday");
  db.plans.push({
    id: planId,
    userId,
    citySlug: "madrid",
    title: "Saturday, €22",
    query: "What can I do on Saturday for €25?",
    budgetCents: 2_500,
    items: [
      { time: "13:00", title: "Menú del día, Moncloa", detail: "Three courses and a drink.", priceCents: 1_100, walkMinutes: 4, kind: "food", source: "students", refKind: "place", refId: "mad-menu" },
      { time: "16:00", title: "Museo del Prado — free evening", detail: "Free entry for the last two hours.", priceCents: 0, walkMinutes: null, kind: "culture", source: "official", refKind: null, refId: null },
      { time: "20:00", title: "Lavapiés language exchange", detail: "Free to attend, drinks at bar prices.", priceCents: 0, walkMinutes: null, kind: "activity", source: "students", refKind: null, refId: null },
      { time: "22:30", title: "Transport", detail: "One journey each way.", priceCents: 300, walkMinutes: null, kind: "transport", source: "official", refKind: null, refId: null },
    ],
    strategy: "demo-seed",
    forDate: iso(daysFromNow(2, 13)),
    shared: true,
    createdAt: iso(daysAgo(3)),
  });
  db.planMembers.push({ planId, userId: mireia, status: "in", updatedAt: iso(daysAgo(2)) });
  rows += 2;

  /* ---- Anyone Down? ------------------------------------------------------ */
  const inviteId = demoId("invite", "football");
  db.invites.push({
    id: inviteId,
    citySlug: "madrid",
    hostId: tobias,
    title: "Five-a-side, one player short",
    detail: "Regular Tuesday game. Pitch is split between everyone who turns up.",
    anchorKind: null,
    anchorId: null,
    startsAt: iso(daysFromNow(1, 18)),
    audience: "city",
    capacity: 10,
    budgetCents: 200,
    closesAt: iso(daysFromNow(1, 20)),
    createdAt: iso(daysAgo(1)),
  });
  db.inviteResponses.push(
    { inviteId, userId: tobias, status: "in", respondedAt: iso(daysAgo(1)) },
    { inviteId, userId: samir, status: "in", respondedAt: iso(daysAgo(1)) },
  );
  rows += 3;

  /* ---- arrival progress and LifeOps -------------------------------------- */
  for (const taskId of ["save-home", "find-supermarket", "transport-card", "sim-card", "student-card", "route-to-campus"]) {
    db.arrival.push({ userId, taskId, doneAt: iso(daysAgo(20)) });
    rows += 1;
  }

  const lifeops: { key: string; title: string; detail: string | null; kind: "class" | "deadline" | "task" | "reminder"; inDays: number; hour: number; allDay: boolean; repeat?: "weekly" }[] = [
    { key: "class-mon", title: "Econometrics lecture", detail: "Room 204", kind: "class", inDays: 0, hour: 10, allDay: false, repeat: "weekly" },
    { key: "essay", title: "Comparative politics essay due", detail: "2,500 words, submit on the portal", kind: "deadline", inDays: 4, hour: 17, allDay: false },
    { key: "library", title: "Return library books", detail: "Two overdue since last week", kind: "task", inDays: -2, hour: 12, allDay: true },
    { key: "call", title: "Call home", detail: null, kind: "reminder", inDays: 1, hour: 19, allDay: false, repeat: "weekly" },
    { key: "flights", title: "Book flights for the winter break", detail: "They go up sharply after October", kind: "task", inDays: 11, hour: 12, allDay: true },
  ];
  for (const task of lifeops) {
    db.lifeopsTasks.push({
      id: demoId("lifeops", task.key),
      userId,
      title: task.title,
      detail: task.detail,
      kind: task.kind,
      dueAt: iso(daysFromNow(task.inDays, task.hour)),
      allDay: task.allDay,
      href: null,
      source: "custom",
      sourceRef: null,
      repeat: task.repeat ?? null,
      doneAt: null,
      snoozedUntil: null,
      dismissedAt: null,
      createdAt: iso(daysAgo(10)),
      updatedAt: iso(daysAgo(10)),
    });
    rows += 1;
  }

  /* ---- a mission in progress --------------------------------------------- */
  const template = missionTemplate("weekend-under-30");
  if (template) {
    const missionId = demoId("mission", template.key);
    db.missions.push({
      id: missionId,
      userId,
      templateKey: template.key,
      citySlug: "madrid",
      title: template.title,
      emoji: template.emoji,
      budgetCents: template.budgetCents,
      status: "active",
      variant: { cheaper: false, social: false },
      shareToken: null,
      startedAt: iso(daysAgo(1)),
      dueAt: iso(daysFromNow(template.durationDays - 1)),
      completedAt: null,
      createdAt: iso(daysAgo(1)),
    });
    const steps = [
      { key: "museum", label: "A free museum or gallery: Museo del Prado — free evening", detail: "Free entry for the last two hours.", kind: "event" as const, cents: 0, done: true },
      { key: "lunch", label: "Student lunch: Menú del día, Moncloa", detail: "Three courses with a drink.", kind: "place" as const, cents: 1_100, done: false },
      { key: "sport", label: "Something outdoors or a game: Retiro Sunday run", detail: "Informal 5k, no sign-up.", kind: "event" as const, cents: 0, done: false, optional: true },
      { key: "night", label: "One night thing: Lavapiés language exchange", detail: "Free to attend.", kind: "event" as const, cents: 0, done: false },
      { key: "transport", label: "Transport", detail: null, kind: "transport" as const, cents: 500, done: false },
      { key: "buffer", label: "Buffer", detail: null, kind: "buffer" as const, cents: 800, done: false },
    ];
    steps.forEach((step, order) => {
      db.missionSteps.push({
        id: demoId("step", `${template.key}-${step.key}`),
        missionId,
        order,
        key: step.key,
        label: step.label,
        detail: step.detail,
        kind: step.kind,
        priceCents: step.cents,
        refKind: null,
        refId: null,
        href: null,
        optional: Boolean("optional" in step && step.optional),
        official: false,
        doneAt: step.done ? iso(daysAgo(1)) : null,
        skippedAt: null,
      });
      rows += 1;
    });
    rows += 1;
  }

  /* ---- exchange, Pulse, chat --------------------------------------------- */
  db.listings.push({
    id: demoId("listing", "monitor"),
    citySlug: "madrid",
    campusSlug: "ucm",
    sellerId: userId,
    kind: "sell",
    mode: "offer",
    title: "24-inch monitor, barely used",
    detail: "Bought it for a term of online classes I ended up attending in person.",
    category: "electronics",
    priceCents: 4_500,
    condition: "good",
    meetArea: "UCM library entrance",
    status: "active",
    fromLeaving: false,
    whenAt: null,
    createdAt: iso(daysAgo(6)),
    soldAt: null,
  });
  db.posts.push({
    id: demoId("post", "laundry"),
    citySlug: "madrid",
    campusSlug: "ucm",
    channel: "questions",
    authorId: userId,
    kind: "question",
    title: "Cheapest laundrette near Malasaña?",
    body: "The one on my street charges €7 a load, which cannot be right.",
    placeId: null,
    upvotes: 6,
    commentCount: 1,
    hiddenAt: null,
    poll: null,
    attachment: null,
    createdAt: iso(daysAgo(2)),
  });
  db.comments.push({
    id: demoId("comment", "laundry"),
    postId: demoId("post", "laundry"),
    parentId: null,
    authorId: mireia,
    body: "There is one on Calle de la Palma, €4.20 a load and the dryers actually work.",
    upvotes: 4,
    hiddenAt: null,
    createdAt: iso(daysAgo(2)),
  });
  db.chat.push({
    id: demoId("chat", "cheap-eats"),
    citySlug: "madrid",
    channel: "cheap-eats",
    authorId: userId,
    body: "The €6.50 place near Moncloa is doing a vegetarian menu now",
    replyToId: null,
    attachment: null,
    createdAt: iso(daysAgo(1, 14)),
  });
  rows += 4;

  /* ---- notifications ------------------------------------------------------ */
  db.notifications.push({
    id: demoId("notification", "welcome"),
    userId,
    topic: "campus",
    title: "UCM international welcome is on this week",
    body: "Campus tour and the registration help desk. [demo-welcome]",
    href: "/events",
    readAt: null,
    createdAt: iso(daysAgo(1)),
  });
  rows += 1;

  return rows;
}
