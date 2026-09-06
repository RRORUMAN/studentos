import "server-only";

import { arrivalTasks, orderByBlocking, phasesForStage } from "@/config/arrival-plan";
import { findMany } from "@/server/db";
import { buildDailyBrief, daySentence, type BriefLine } from "@/server/engines/brief";
import { buildForYouFeed, type FeedItem } from "@/server/engines/feed";
import { quickActions, type QuickAction } from "@/server/engines/quick-actions";
import { rightNow, type RightNowItem } from "@/server/engines/right-now";
import {
  filterEventsByWhen,
  loadCityEvents,
  loadDeals,
  loadPlaces,
  loadRecommendContext,
  loadScoredEvents,
} from "@/server/queries/discovery";
import { loadFriendEventIds } from "@/server/queries/events";
import { loadTrending } from "@/server/queries/loop";
import { loadMoney } from "@/server/queries/money";
import { loadOpenInvites } from "@/server/queries/plans";
import { suggestedPeople } from "@/server/queries/social";
import type { Viewer } from "@/server/viewer";
import { currencySymbol, money } from "@/lib/utils";

/**
 * ============================================================================
 * HOME — query
 * ----------------------------------------------------------------------------
 * Everything the Home screen renders, loaded once and handed to pure engines.
 * Every loader below is Tier 0; no model is called to build Home, which is what
 * makes it free to serve to every student every morning.
 * ============================================================================
 */

export type HomeData = {
  now: Date;
  money: Awaited<ReturnType<typeof loadMoney>>;
  sentence: string;
  brief: BriefLine[];
  actions: QuickAction[];
  feed: FeedItem[];
  rightNow: RightNowItem[];
  people: Awaited<ReturnType<typeof suggestedPeople>>;
  openInvites: Awaited<ReturnType<typeof loadOpenInvites>>;
  arrivalDone: number;
  arrivalTotal: number;
};

export async function loadHome(viewer: Viewer, now: Date): Promise<HomeData> {
  const userId = viewer.user.id;
  const where = viewer.currency;
  const fmt = (cents: number) => money(cents / 100, where);
  const social = !viewer.profile.socialGoals.includes("private");

  const money$ = await loadMoney(userId, now);
  const budgetCents = money$.unset ? null : money$.reading.safeTodayCents;

  const context = await loadRecommendContext({
    userId,
    profile: viewer.profile,
    budgetCents,
    now,
  });

  const [events, places, deals, allEvents, invites, trending, friendEventIds, arrivalDone, people] =
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
        ? suggestedPeople({
            viewerId: userId,
            citySlug: viewer.profile.citySlug,
            campusSlug: viewer.profile.campusSlug,
            interests: viewer.profile.interests,
            limit: 4,
          })
        : Promise.resolve([]),
    ]);

  const tonight = filterEventsByWhen(
    events.map((entry) => entry.item),
    "tonight",
    now,
  );

  /* ---- arrival ---------------------------------------------------------- */
  const doneIds = new Set(arrivalDone.map((row) => row.taskId));
  const housing = viewer.move?.housing ?? "unknown";
  const phases = phasesForStage(viewer.stage.stage);
  const openTasks = orderByBlocking(
    arrivalTasks.filter(
      (task) =>
        phases.includes(task.phase) &&
        (task.social ? social : true) &&
        (task.housing ? task.housing.includes(housing) : true),
    ),
  );
  const nextTask = openTasks.find((task) => !doneIds.has(task.id)) ?? null;

  /* ---- brief ------------------------------------------------------------ */
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const spending = new Set(money$.reading.categories.map((entry) => entry.category));
  const newDeals = deals
    .filter((deal) => Date.parse(deal.createdAt) >= weekAgo || spending.has(deal.category))
    .filter((deal) => deal.confidence === "verified" || deal.confidence === "likely")
    .map((deal) => ({ id: deal.id, title: deal.title, value: deal.value }));

  const soonInvites = invites.filter(
    (invite) => Date.parse(invite.startsAt) - now.getTime() <= 48 * 3_600_000,
  ).length;

  const brief = buildDailyBrief({
    stage: viewer.stage.stage,
    tonight,
    friendEventIds,
    newDeals,
    safeTodayCents: budgetCents,
    hasBudget: !money$.unset,
    nextTask: nextTask ? { id: nextTask.id, label: nextTask.label } : null,
    openInvites: soonInvites,
    trendingPosts: trending.filter((post) => now.getTime() - Date.parse(post.createdAt) < 24 * 3_600_000).length,
    formatMoney: fmt,
    hour: now.getHours(),
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
    stage: viewer.stage.stage,
    safeTodayCents: budgetCents,
    hasBudget: !money$.unset,
    overPace: money$.reading.overPace,
    social,
    day: now.getDay(),
    hour: now.getHours(),
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
  const live = rightNow({
    now,
    events: allEvents,
    invites,
    posts: trending,
    limit: 5,
  });

  return {
    now,
    money: money$,
    sentence,
    brief,
    actions,
    feed,
    rightNow: live,
    people,
    openInvites: invites,
    arrivalDone: openTasks.filter((task) => doneIds.has(task.id)).length,
    arrivalTotal: openTasks.length,
  };
}
