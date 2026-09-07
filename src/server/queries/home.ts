import "server-only";

import { arrivalTasks, orderByBlocking, phasesForStage } from "@/config/arrival-plan";
import type { LifeOpsTimeline } from "@/domain/lifeops";
import { listingKind, listingMode } from "@/domain/social";
import { findMany } from "@/server/db";
import { buildDailyBrief, daySentence, type BriefLine } from "@/server/engines/brief";
import { buildForYouFeed, type FeedItem } from "@/server/engines/feed";
import { quickActions, type QuickAction } from "@/server/engines/quick-actions";
import { rightNow, type RightNowItem } from "@/server/engines/right-now";
import { todayForYou, type TodayPick } from "@/server/engines/today";
import {
  filterEventsByWhen,
  loadCityEvents,
  loadDeals,
  loadPlaces,
  loadRecommendContext,
  loadScoredEvents,
} from "@/server/queries/discovery";
import { loadFriendEventIds } from "@/server/queries/events";
import { loadLifeOps } from "@/server/queries/lifeops";
import { loadTrending } from "@/server/queries/loop";
import { loadMissions, type MissionView } from "@/server/queries/missions";
import { loadMoney } from "@/server/queries/money";
import { loadOpenInvites } from "@/server/queries/plans";
import { suggestedPeople } from "@/server/queries/social";
import type { Viewer } from "@/server/viewer";
import { hourIn, weekdayIn } from "@/lib/dates";
import { currencySymbol, money } from "@/lib/utils";

/**
 * ============================================================================
 * HOME — query
 * ----------------------------------------------------------------------------
 * Everything the Home screen renders, loaded once and handed to pure engines.
 * Every loader below is Tier 0; no model is called to build Home, which is what
 * makes it free to serve to every student every morning.
 *
 * The hierarchy the screen renders, and this query serves, in order:
 *
 *   1. money        safe to spend today, safe to spend this week, one sentence
 *   2. today        three to five things, one of each kind, ranked
 *   3. brief        the counts that matter, each a link
 *   4. right now    only when something is on
 *   5. for you      the mixed feed
 *   6. people       opt-in
 * ============================================================================
 */

export type HomeData = {
  now: Date;
  money: Awaited<ReturnType<typeof loadMoney>>;
  sentence: string;
  today: TodayPick[];
  brief: BriefLine[];
  actions: QuickAction[];
  feed: FeedItem[];
  rightNow: RightNowItem[];
  people: Awaited<ReturnType<typeof suggestedPeople>>;
  openInvites: Awaited<ReturnType<typeof loadOpenInvites>>;
  timeline: LifeOpsTimeline;
  mission: MissionView | null;
  arrivalDone: number;
  arrivalTotal: number;
  /** Departing stock for arriving students, or open requests for leaving ones. */
  exchangeLine: { count: number; label: string; href: string } | null;
};

export async function loadHome(viewer: Viewer, now: Date): Promise<HomeData> {
  const userId = viewer.user.id;
  const where = viewer.currency;
  const tz = viewer.city.timezone;
  const fmt = (cents: number) => money(cents / 100, where);
  const social = !viewer.profile.socialGoals.includes("private");
  const stage = viewer.stage.stage;
  const hour = hourIn(now, tz);
  const day = weekdayIn(now, tz);

  const money$ = await loadMoney(userId, now);
  const budgetCents = money$.unset ? null : money$.reading.safeTodayCents;

  const context = await loadRecommendContext({ userId, profile: viewer.profile, budgetCents, now });

  const [events, places, deals, allEvents, invites, trending, friendEventIds, arrivalDone, people, timeline, missions, listings] =
    await Promise.all([
      loadScoredEvents(userId, context, { when: "week" }),
      loadPlaces(context),
      loadDeals(viewer.profile.citySlug),
      loadCityEvents(viewer.profile.citySlug),
      social ? loadOpenInvites({ userId, citySlug: viewer.profile.citySlug, now }) : Promise.resolve([]),
      loadTrending(viewer.profile.citySlug, 6),
      loadFriendEventIds(userId),
      findMany("arrival", (row) => row.userId === userId),
      social
        ? suggestedPeople({ viewerId: userId, citySlug: viewer.profile.citySlug, campusSlug: viewer.profile.campusSlug, interests: viewer.profile.interests, limit: 4 })
        : Promise.resolve([]),
      loadLifeOps(viewer, now),
      loadMissions(userId),
      findMany("listings", (row) => row.citySlug === viewer.profile.citySlug && row.status === "active" && row.sellerId !== userId),
    ]);

  const tonight = filterEventsByWhen(events.map((entry) => entry.item), "tonight", now);

  /* ---- arrival ---------------------------------------------------------- */
  const doneIds = new Set(arrivalDone.map((row) => row.taskId));
  const housing = viewer.move?.housing ?? "unknown";
  const phases = phasesForStage(stage);
  const openTasks = orderByBlocking(
    arrivalTasks.filter(
      (task) => phases.includes(task.phase) && (task.social ? social : true) && (task.housing ? task.housing.includes(housing) : true),
    ),
  );
  const nextTask = openTasks.find((task) => !doneIds.has(task.id)) ?? null;

  /* ---- mission ---------------------------------------------------------- */
  const mission = missions.active[0] ?? null;
  const nextStep = mission?.steps.find((step) => step.doneAt === null && step.skippedAt === null && step.kind !== "transport" && step.kind !== "buffer") ?? null;

  /* ---- exchange --------------------------------------------------------- */
  const arriving = stage === "before-arrival" || stage === "first-24h" || stage === "first-week" || stage === "first-month";
  const departing = listings.filter((row) => row.fromLeaving && listingMode(row) === "offer");
  const requests = listings.filter((row) => listingMode(row) === "request");
  const exchangeLine =
    arriving && departing.length > 0
      ? { count: departing.length, label: `${departing.length} ${departing.length === 1 ? "thing" : "things"} students leaving ${viewer.city.name} are passing on`, href: "/exchange" }
      : stage === "leaving" && requests.length > 0
        ? { count: requests.length, label: `${requests.length} ${requests.length === 1 ? "student is" : "students are"} looking for things you might be leaving behind`, href: "/exchange?mode=request" }
        : requests.filter((row) => listingKind(row) === "help" || listingKind(row) === "ride").length > 0 && social
          ? (() => {
              const count = requests.filter((row) => listingKind(row) === "help" || listingKind(row) === "ride").length;
              return { count, label: `${count} ${count === 1 ? "student needs" : "students need"} a hand or a shared ride`, href: "/exchange?mode=request" };
            })()
          : null;

  /* ---- payments due ----------------------------------------------------- */
  const soonPayments = [...timeline.today, ...timeline.week].filter(
    (item) => item.kind === "payment" && item.at !== null && Date.parse(item.at) - now.getTime() <= 3 * 86_400_000,
  );

  /* ---- brief ------------------------------------------------------------ */
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const spending = new Set(money$.reading.categories.map((entry) => entry.category));
  const newDeals = deals
    .filter((deal) => Date.parse(deal.createdAt) >= weekAgo || spending.has(deal.category))
    .filter((deal) => deal.confidence === "verified" || deal.confidence === "likely")
    .map((deal) => ({ id: deal.id, title: deal.title, value: deal.value }));

  const soonInvites = invites.filter((invite) => Date.parse(invite.startsAt) - now.getTime() <= 48 * 3_600_000).length;

  const brief = buildDailyBrief({
    stage,
    tonight,
    friendEventIds,
    newDeals,
    safeTodayCents: budgetCents,
    hasBudget: !money$.unset,
    nextTask: nextTask ? { id: nextTask.id, label: nextTask.label } : null,
    openInvites: soonInvites,
    trendingPosts: trending.filter((post) => now.getTime() - Date.parse(post.createdAt) < 24 * 3_600_000).length,
    formatMoney: fmt,
    hour,
    lifeops: {
      dueToday: timeline.today.length,
      slipped: timeline.overdue.length,
      firstTitle: timeline.overdue[0]?.title ?? timeline.today[0]?.title ?? null,
    },
    paymentsDue: {
      count: soonPayments.length,
      totalCents: soonPayments.reduce((sum, item) => sum + (item.priceCents ?? 0), 0),
      firstLabel: soonPayments[0]?.title ?? null,
    },
    mission: mission && nextStep ? { title: mission.mission.title, step: nextStep.label, href: nextStep.href ?? `/missions/${mission.mission.id}` } : null,
    exchange: exchangeLine,
  });

  const sentence = daySentence({
    safeTodayCents: budgetCents,
    hasBudget: !money$.unset,
    paceDeltaCents: money$.reading.paceDeltaCents,
    weekTargetCents: money$.week.targetCents,
    weekSpentCents: money$.week.spentCents,
    freeTonight: tonight.filter((event) => event.priceCents === 0).length,
    formatMoney: fmt,
  });

  /* ---- quick actions ---------------------------------------------------- */
  const actions = quickActions({
    stage,
    safeTodayCents: budgetCents,
    hasBudget: !money$.unset,
    overPace: money$.reading.overPace,
    social,
    day,
    hour,
    currencySymbol: currencySymbol(where.currency, where.locale),
    interests: viewer.profile.interests,
    hasCampus: Boolean(viewer.profile.campusSlug),
  });

  /* ---- feed ------------------------------------------------------------- */
  const feed = buildForYouFeed({
    events,
    places,
    deals,
    invites,
    posts: trending.map((post) => ({ ...post, score: 1 })),
    friendEventIds,
    spendingCategories: spending,
    campusSlug: viewer.profile.campusSlug,
    now,
    limit: 10,
  });

  /* ---- right now -------------------------------------------------------- */
  const live = rightNow({ now, events: allEvents, invites, posts: trending, limit: 5 });

  /* ---- today for you ---------------------------------------------------- */
  const today = todayForYou({
    hour,
    safeTodayCents: budgetCents,
    timeline,
    feed,
    rightNow: live,
    mission: mission ? { id: mission.mission.id, title: mission.mission.title, emoji: mission.mission.emoji, nextStep, done: mission.progress.done, total: mission.progress.total } : null,
    formatMoney: fmt,
    limit: 5,
  });

  /* The feed below "today" should not repeat what is already at the top. */
  const shown = new Set(today.map((pick) => pick.id));

  return {
    now,
    money: money$,
    sentence,
    today,
    brief,
    actions,
    feed: feed.filter((item) => !shown.has(item.id)),
    rightNow: live,
    people,
    openInvites: invites,
    timeline,
    mission,
    arrivalDone: openTasks.filter((task) => doneIds.has(task.id)).length,
    arrivalTotal: openTasks.length,
    exchangeLine,
  };
}
