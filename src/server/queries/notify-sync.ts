import "server-only";

import { dayKey } from "@/lib/dates";
import { findMany } from "@/server/db";
import { notify } from "@/server/notify";
import { loadDeals } from "@/server/queries/discovery";
import { loadLanguage } from "@/server/queries/language";
import { loadLifeOps } from "@/server/queries/lifeops";
import { loadMoney } from "@/server/queries/money";
import type { Viewer } from "@/server/viewer";
import { money } from "@/lib/utils";

/**
 * ============================================================================
 * NOTIFICATION PRODUCERS
 * ----------------------------------------------------------------------------
 * The deterministic notifications, computed from rows the product already
 * holds and written after the response is sent.
 *
 * Why on read rather than on a schedule: this deployment has no job runner,
 * and a notification system that only works once someone sets up cron is a
 * notification system that does not work. Computing them when the student
 * opens the app is honest, cheap and idempotent — every producer passes a
 * stable key, so opening Home ten times writes one row.
 *
 * When a scheduler does exist, the same function runs from it unchanged: it
 * takes a viewer and a clock, and neither is request-specific.
 *
 * Seven topics had no producer at all before this file. Six of them do now;
 * `pulse` is deliberately left to the community actions, which know when
 * somebody actually replied to you, and `friends-plans` already has producers
 * in the friends and events actions.
 * ============================================================================
 */

export async function syncNotifications(viewer: Viewer, now: Date): Promise<number> {
  const userId = viewer.user.id;
  const tz = viewer.city.timezone;
  const today = dayKey(now, tz);
  const fmt = (cents: number) => money(cents / 100, viewer.currency);
  const options = { timeZone: tz, now };
  let written = 0;

  const [money$, timeline, language] = await Promise.all([
    loadMoney(userId, tz, now),
    loadLifeOps(viewer, now),
    loadLanguage({ userId, countryCode: viewer.city.countryCode, timezone: tz, now }),
  ]);

  /* ---- language ----------------------------------------------------------
     Off by default, and gated twice more on top of that: there must be a
     phrase to show, the student must not have turned the daily phrase off,
     and they must have used Speak Local at least once. A student who has
     never opened it is not reminded about it -- a reminder to use a feature
     you have ignored is an advert, and this product does not send those. */
  if (language.pack && language.today && language.profile.dailyBite && language.progress && language.progress.seen > 0) {
    written += Number(
      await notify(
        {
          userId,
          topic: "language",
          title: `Today's ${language.pack.name} takes 30 seconds`,
          body: `${language.today.phrase.text} - ${language.today.phrase.meaning}`,
          href: "/speak",
          key: `phrase:${today}`,
          withinHours: 20,
        },
        options,
      ),
    );
  }

  /* ---- budget-warnings --------------------------------------------------
     The one topic that is on by default and had no producer. Two conditions,
     both computed, both actionable: spending ahead of the month's pace, and a
     day where the safe figure has actually run out. */
  if (!money$.unset) {
    if (money$.reading.availableCents <= 0) {
      written += Number(
        await notify(
          {
            userId,
            topic: "budget-warnings",
            title: "Committed costs use what is left this month",
            body: "Rent and repeating charges take the rest. Survival Mode builds a plan around what you actually have.",
            href: "/budget/survival",
            key: `budget-empty:${today}`,
            withinHours: 72,
          },
          options,
        ),
      );
    } else if (money$.reading.overPace) {
      const drifting = money$.reading.categories
        .filter((row) => row.discretionary && row.paceDeltaCents > 0)
        .sort((a, b) => b.paceDeltaCents - a.paceDeltaCents)[0];
      if (drifting && drifting.paceDeltaCents > money$.reading.plannedCents * 0.03) {
        written += Number(
          await notify(
            {
              userId,
              topic: "budget-warnings",
              title: `${drifting.label} is ${fmt(drifting.paceDeltaCents)} ahead of pace`,
              body: `${fmt(money$.reading.safeTodayCents)} a day keeps the month on track. There are cheaper options near you.`,
              href: "/budget",
              key: `budget-pace:${drifting.category}:${today}`,
              withinHours: 72,
            },
            options,
          ),
        );
      }
    }
  }

  /* ---- arrival: what slipped -------------------------------------------- */
  if (timeline.overdue.length > 0) {
    const first = timeline.overdue[0];
    written += Number(
      await notify(
        {
          userId,
          topic: "arrival",
          title:
            timeline.overdue.length === 1
              ? `Still open: ${first.title}`
              : `${timeline.overdue.length} things slipped past their date`,
          body: first.unblocks > 0 ? `This one unblocks ${first.unblocks} others.` : "They are at the top of your timeline.",
          href: "/lifeops",
          key: `slipped:${timeline.overdue.length}:${today}`,
          withinHours: 48,
        },
        options,
      ),
    );
  }

  /* ---- money about to leave the account --------------------------------- */
  const payments = [...timeline.today, ...timeline.week].filter(
    (item) => item.kind === "payment" && item.at !== null && Date.parse(item.at) - now.getTime() <= 3 * 86_400_000,
  );
  if (payments.length > 0) {
    const total = payments.reduce((sum, item) => sum + (item.priceCents ?? 0), 0);
    written += Number(
      await notify(
        {
          userId,
          topic: "budget-warnings",
          title: `${fmt(total)} goes out in the next three days`,
          body: payments.length === 1 ? payments[0].title : `${payments.length} repeating charges.`,
          href: "/lifeops?view=week",
          key: `payments:${payments.length}:${total}:${today}`,
          withinHours: 48,
        },
        options,
      ),
    );
  }

  /* ---- free-events ------------------------------------------------------
     Only free ones, only tonight, only when there are several: a nightly
     "here are some events" is the notification people switch everything off
     over. */
  const events = await findMany("events", (row) => row.citySlug === viewer.profile.citySlug && row.priceCents === 0);
  const tonight = events.filter((event) => {
    const at = Date.parse(event.startsAt);
    return at >= now.getTime() && at <= now.getTime() + 12 * 3_600_000;
  });
  if (tonight.length >= 2) {
    written += Number(
      await notify(
        {
          userId,
          topic: "free-events",
          title: `${tonight.length} free things on tonight`,
          body: tonight.slice(0, 2).map((event) => event.title).join(" · "),
          href: "/events?tab=free",
          key: `free-tonight:${today}`,
          withinHours: 20,
        },
        options,
      ),
    );
  }

  /* ---- deals: new, verified, and in a category the student budgets for --- */
  const [deals, envelopes] = await Promise.all([
    loadDeals(viewer.profile.citySlug),
    findMany("envelopes", (row) => row.userId === userId),
  ]);
  const budgeted = new Set(envelopes.map((row) => row.category));
  const fresh = deals.filter(
    (deal) =>
      deal.confidence === "verified" &&
      budgeted.has(deal.category) &&
      Date.parse(deal.createdAt) >= now.getTime() - 7 * 86_400_000,
  );
  if (fresh.length > 0) {
    written += Number(
      await notify(
        {
          userId,
          topic: "deals",
          title: `New: ${fresh[0].title}`,
          body: `${fresh[0].value} · confirmed working by students, in a category you budget for.`,
          href: "/discover?tab=deals",
          key: `deal:${fresh[0].id}`,
          withinHours: 24 * 14,
        },
        options,
      ),
    );
  }

  /* ---- weekend-ideas ----------------------------------------------------- */
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(now);
  if (weekday === "Thu" && !money$.unset) {
    const weekendThings = events.filter((event) => {
      const at = Date.parse(event.startsAt);
      return at >= now.getTime() && at <= now.getTime() + 4 * 86_400_000;
    }).length;
    if (weekendThings > 0) {
      written += Number(
        await notify(
          {
            userId,
            topic: "weekend-ideas",
            title: `${fmt(Math.max(0, money$.week.targetCents - money$.week.spentCents))} left for the weekend`,
            body: `${weekendThings} free ${weekendThings === 1 ? "thing" : "things"} on. A mission builds the whole weekend inside the number.`,
            href: "/missions",
            key: `weekend:${today}`,
            withinHours: 24 * 6,
          },
          options,
        ),
      );
    }
  }

  /* ---- campus ------------------------------------------------------------ */
  if (viewer.profile.campusSlug) {
    const campusEvents = await findMany(
      "events",
      (row) =>
        row.campusSlug === viewer.profile.campusSlug &&
        Date.parse(row.startsAt) >= now.getTime() &&
        Date.parse(row.startsAt) <= now.getTime() + 3 * 86_400_000,
    );
    if (campusEvents.length > 0) {
      written += Number(
        await notify(
          {
            userId,
            topic: "campus",
            title: campusEvents[0].title,
            body: `On your campus, ${campusEvents.length > 1 ? `one of ${campusEvents.length} in the next few days` : "in the next few days"}.`,
            href: `/events/${campusEvents[0].id}`,
            key: `campus:${campusEvents[0].id}`,
            withinHours: 24 * 7,
          },
          options,
        ),
      );
    }
  }

  return written;
}
