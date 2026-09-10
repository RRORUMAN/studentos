import {
  arrivalTasks,
  leavingTasks,
  orderByBlocking,
  phasesForStage,
  type ArrivalTaskSpec,
} from "@/config/arrival-plan";
import type { HousingSituation, LifeStage } from "@/domain/lifecycle";
import {
  bucketFor,
  type LifeOpsAction,
  type LifeOpsItem,
  type LifeOpsTask,
  type LifeOpsTimeline,
} from "@/domain/lifeops";
import { missionProgress, type Mission, type MissionStep } from "@/domain/missions";
import {
  type Cents,
  type CityEvent,
  type Invite,
  type Iso,
  planTotal,
  type RecurringExpense,
  type SavedPlan,
  type Transaction,
} from "@/domain/types";

/**
 * ============================================================================
 * LIFEOPS ENGINE
 * ----------------------------------------------------------------------------
 * Merges everything a student has to care about into one dated timeline.
 *
 * Pure. Every input is a row the product already holds; every date is
 * arithmetic on those rows and on `now`. No model decides what is due, and
 * nothing here is persisted — a timeline is recomputed from rows on every
 * render, so an event that moves, a task that gets ticked in Arrival Mode or a
 * recurring charge that gets paid all change the timeline without a sync job.
 *
 * The one piece of judgement in the file is how arrival and leaving tasks get
 * dates. They are written as phases ("first week") rather than deadlines, and
 * a timeline needs a day. So each phase is anchored to the arrival or
 * departure date with an offset that reflects when the thing actually bites:
 * an address must exist before registration, a transport card pays for itself
 * inside a week, a gym membership needs a month's notice. Those offsets are
 * named below and are the product decision this engine encodes.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Inputs                                                                      */
/* -------------------------------------------------------------------------- */

export type LifeOpsInput = {
  now: Date;
  stage: LifeStage;
  social: boolean;
  housing: HousingSituation;
  arrivingOn: Iso | null;
  leavingOn: Iso | null;
  /** When the account was made, the fallback anchor when no arrival date exists. */
  joinedAt: Iso;
  /** Ids of arrival and leaving tasks ticked in Arrival Mode. */
  arrivalDone: ReadonlySet<string>;
  /** Custom tasks and overrides for derived items. */
  tasks: readonly LifeOpsTask[];
  /** Events the student said they are going to or interested in. */
  events: readonly { event: CityEvent; status: "interested" | "going"; friendsGoing: number }[];
  /** Anyone Down? plans the student hosts or is in. */
  invites: readonly (Invite & { going: number; role: "host" | "in" })[];
  /** Saved plans with a date. */
  plans: readonly SavedPlan[];
  recurring: readonly RecurringExpense[];
  /** This month's transactions, to tell whether a recurring charge already landed. */
  transactions: readonly Transaction[];
  missions: readonly { mission: Mission; steps: readonly MissionStep[] }[];
  safeTodayCents: Cents | null;
  formatMoney: (cents: Cents) => string;
};

/* -------------------------------------------------------------------------- */
/* Date anchors for phased tasks                                               */
/* -------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;

/**
 * Days relative to arrival for each arrival phase. Negative is before landing.
 * Tasks inside a phase are spread across its window in blocking order, so the
 * task that unblocks the most lands first.
 */
const ARRIVAL_WINDOWS: Record<ArrivalTaskSpec["phase"], { from: number; to: number }> = {
  before: { from: -21, to: -2 },
  "first-24h": { from: 0, to: 1 },
  "first-week": { from: 2, to: 7 },
  "first-month": { from: 8, to: 30 },
};

/** Days before departure each leaving task bites. */
const LEAVING_OFFSETS: Record<string, number> = {
  "cancel-recurring": -30,
  "sell-furniture": -21,
  "transport-pass": -14,
  deposit: -14,
  "last-things": -10,
  "return-university": -7,
  "airport-plan": -7,
  "share-places": -5,
  "final-bills": -3,
};

function atMidday(base: Date, offsetDays: number): Date {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays, 12, 0, 0, 0);
  return date;
}

function spread(from: number, to: number, index: number, count: number): number {
  if (count <= 1) return from;
  return Math.round(from + ((to - from) * index) / (count - 1));
}

/* -------------------------------------------------------------------------- */
/* Overrides                                                                   */
/* -------------------------------------------------------------------------- */

type Override = Pick<LifeOpsTask, "doneAt" | "snoozedUntil" | "dismissedAt">;

function overridesByRef(tasks: readonly LifeOpsTask[]): Map<string, Override> {
  const map = new Map<string, Override>();
  for (const task of tasks) {
    if (task.source !== "custom" && task.sourceRef) map.set(task.sourceRef, task);
  }
  return map;
}

/**
 * Apply an override to a derived item. Returns null when the item should not
 * appear at all (dismissed, or done more than a day ago), otherwise the item
 * with its date moved to the snooze time when one is in force.
 */
function applyOverride(item: LifeOpsItem, override: Override | undefined, now: Date): LifeOpsItem | null {
  if (!override) return item;
  if (override.dismissedAt) return null;
  if (override.doneAt) {
    /* Done today stays visible as a tick; older done items disappear. */
    const doneAgo = now.getTime() - Date.parse(override.doneAt);
    if (doneAgo > DAY_MS) return null;
    return { ...item, bucket: "today", social: item.social, meta: item.meta };
  }
  if (override.snoozedUntil && Date.parse(override.snoozedUntil) > now.getTime()) {
    return { ...item, at: override.snoozedUntil, bucket: bucketFor(override.snoozedUntil, now), snoozed: true };
  }
  return item;
}

/* -------------------------------------------------------------------------- */
/* Builders                                                                    */
/* -------------------------------------------------------------------------- */

const ACTIONS: Record<LifeOpsItem["source"], readonly LifeOpsAction[]> = {
  custom: ["complete", "snooze", "reschedule", "dismiss", "calendar"],
  arrival: ["complete", "snooze", "dismiss"],
  leaving: ["complete", "snooze", "dismiss"],
  mission: [],
  event: ["calendar", "snooze", "dismiss"],
  invite: ["calendar", "dismiss"],
  plan: ["calendar", "dismiss"],
  recurring: ["complete", "snooze", "dismiss"],
};

function phasedTasks(input: LifeOpsInput): LifeOpsItem[] {
  const out: LifeOpsItem[] = [];
  const { now, stage } = input;

  /* ---- arrival ---------------------------------------------------------- */
  if (stage !== "leaving") {
    const phases = new Set(phasesForStage(stage));
    const anchor = new Date(input.arrivingOn ?? input.joinedAt);
    for (const phase of phases) {
      const tasks = orderByBlocking(
        arrivalTasks.filter(
          (task) =>
            task.phase === phase &&
            (task.social ? input.social : true) &&
            (task.housing ? task.housing.includes(input.housing) : true),
        ),
      );
      const window = ARRIVAL_WINDOWS[phase];
      tasks.forEach((task, index) => {
        const done = input.arrivalDone.has(task.id);
        if (done) return;
        const day = spread(window.from, window.to, index, tasks.length);
        let due = atMidday(anchor, day);
        /* A phase that is already in the past is overdue only for a few days;
           after that it sits in Today rather than shaming the student with a
           three-week-old date. */
        if (due.getTime() < now.getTime() - 3 * DAY_MS) due = atMidday(now, 0);
        out.push({
          key: `arrival:${task.id}`,
          kind: task.official ? "deadline" : "task",
          title: task.label,
          meta: task.detail,
          at: due.toISOString(),
          endsAt: null,
          allDay: true,
          bucket: bucketFor(due.toISOString(), now),
          priceCents: null,
          href: task.href ?? "/arrival",
          actions: ACTIONS.arrival,
          source: "arrival",
          snoozed: false,
          official: Boolean(task.official),
          unblocks: task.unblocks?.length ?? 0,
          social: null,
        });
      });
    }
  }

  /* ---- leaving ---------------------------------------------------------- */
  if (stage === "leaving" && input.leavingOn) {
    const anchor = new Date(input.leavingOn);
    for (const task of leavingTasks) {
      if (task.social && !input.social) continue;
      if (input.arrivalDone.has(task.id)) continue;
      const offset = LEAVING_OFFSETS[task.id] ?? -7;
      let due = atMidday(anchor, offset);
      if (due.getTime() < now.getTime() - 3 * DAY_MS) due = atMidday(now, 0);
      out.push({
        key: `leaving:${task.id}`,
        kind: task.official ? "deadline" : "task",
        title: task.label,
        meta: task.detail,
        at: due.toISOString(),
        endsAt: null,
        allDay: true,
        bucket: bucketFor(due.toISOString(), now),
        priceCents: null,
        href: task.href ?? "/leaving",
        actions: ACTIONS.leaving,
        source: "leaving",
        snoozed: false,
        official: Boolean(task.official),
        unblocks: 0,
        social: null,
      });
    }
  }

  return out;
}

function customTasks(input: LifeOpsInput): LifeOpsItem[] {
  const { now } = input;
  return input.tasks
    .filter((task) => task.source === "custom" && !task.dismissedAt)
    .filter((task) => !task.doneAt || now.getTime() - Date.parse(task.doneAt) <= DAY_MS)
    .map((task) => {
      const at = task.snoozedUntil && Date.parse(task.snoozedUntil) > now.getTime() ? task.snoozedUntil : task.dueAt;
      return {
        key: `custom:${task.id}`,
        kind: task.kind,
        title: task.title,
        meta: task.detail,
        at,
        endsAt: null,
        allDay: task.allDay,
        bucket: task.doneAt ? "today" : bucketFor(at, now),
        priceCents: null,
        href: task.href,
        actions: ACTIONS.custom,
        source: "custom" as const,
        snoozed: Boolean(task.snoozedUntil && Date.parse(task.snoozedUntil) > now.getTime()),
        official: false,
        unblocks: 0,
        social: null,
      } satisfies LifeOpsItem;
    });
}

function eventItems(input: LifeOpsInput): LifeOpsItem[] {
  const { now } = input;
  return input.events
    .filter(({ event }) => {
      const ends = event.endsAt ? Date.parse(event.endsAt) : Date.parse(event.startsAt) + 2 * 3_600_000;
      return ends >= now.getTime() - 3_600_000;
    })
    .map(({ event, status, friendsGoing }) => ({
      key: `event:${event.id}`,
      kind: "event" as const,
      title: event.title,
      meta: `${event.venue}${status === "interested" ? " · interested" : ""}`,
      at: event.startsAt,
      endsAt: event.endsAt,
      allDay: false,
      bucket: bucketFor(event.startsAt, now),
      priceCents: event.priceCents,
      href: `/events/${event.id}`,
      actions: ACTIONS.event,
      source: "event" as const,
      snoozed: false,
      official: false,
      unblocks: 0,
      social: friendsGoing > 0 ? `${friendsGoing} ${friendsGoing === 1 ? "friend" : "friends"} going` : null,
    }));
}

function inviteItems(input: LifeOpsInput): LifeOpsItem[] {
  const { now } = input;
  return input.invites
    .filter((invite) => Date.parse(invite.closesAt) >= now.getTime())
    .map((invite) => ({
      key: `invite:${invite.id}`,
      kind: "invite" as const,
      title: invite.title,
      meta: invite.role === "host" ? "You are hosting" : "You are in",
      at: invite.startsAt,
      endsAt: null,
      allDay: false,
      bucket: bucketFor(invite.startsAt, now),
      priceCents: invite.budgetCents,
      href: `/anyone-down/${invite.id}`,
      actions: ACTIONS.invite,
      source: "invite" as const,
      snoozed: false,
      official: false,
      unblocks: 0,
      social: invite.going > 0 ? `${invite.going} in` : null,
    }));
}

function planItems(input: LifeOpsInput): LifeOpsItem[] {
  const { now } = input;
  return input.plans
    .filter((plan) => plan.forDate && Date.parse(plan.forDate) >= now.getTime() - DAY_MS)
    .map((plan) => {
      /* A compact timeline row. The plan it links to discloses any stop the
         source never priced; see `planTotal`. */
      const total = planTotal(plan.items).cents;
      return {
        key: `plan:${plan.id}`,
        kind: "plan" as const,
        title: plan.title,
        meta: `${plan.items.length} ${plan.items.length === 1 ? "stop" : "stops"}`,
        at: plan.forDate,
        endsAt: null,
        allDay: true,
        bucket: bucketFor(plan.forDate, now),
        priceCents: total,
        href: `/plans/${plan.id}`,
        actions: ACTIONS.plan,
        source: "plan" as const,
        snoozed: false,
        official: false,
        unblocks: 0,
        social: null,
      };
    });
}

/**
 * The next time each active recurring charge lands. Monthly charges are due on
 * their day this month, or next month once that day has passed; weekly ones on
 * their next weekday. A charge already matched by a transaction this month
 * (same category, amount within 15%) is treated as paid.
 */
export function nextRecurringDue(expense: RecurringExpense, now: Date): Date {
  if (expense.cadence === "weekly") {
    const delta = (expense.dayOfPeriod - now.getDay() + 7) % 7;
    return atMidday(now, delta === 0 && now.getHours() >= 12 ? 7 : delta);
  }
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = Math.min(expense.dayOfPeriod, daysInMonth);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0, 0);
  if (thisMonth.getTime() >= now.getTime() - 12 * 3_600_000) return thisMonth;
  const nextDays = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
  return new Date(now.getFullYear(), now.getMonth() + 1, Math.min(expense.dayOfPeriod, nextDays), 12, 0, 0, 0);
}

function alreadyPaidThisMonth(expense: RecurringExpense, transactions: readonly Transaction[], due: Date): boolean {
  const tolerance = expense.amountCents * 0.15;
  const monthStart = new Date(due.getFullYear(), due.getMonth(), 1).getTime();
  return transactions.some(
    (tx) =>
      tx.category === expense.category &&
      Math.abs(tx.amountCents - expense.amountCents) <= tolerance &&
      Date.parse(tx.spentAt) >= monthStart,
  );
}

function recurringItems(input: LifeOpsInput): LifeOpsItem[] {
  const { now } = input;
  return input.recurring
    .filter((expense) => expense.active && expense.cadence !== "termly")
    .map((expense): LifeOpsItem | null => {
      const due = nextRecurringDue(expense, now);
      if (Date.parse(now.toISOString()) + 14 * DAY_MS < due.getTime()) return null;
      if (alreadyPaidThisMonth(expense, input.transactions, due)) return null;
      const monthKey = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}`;
      return {
        key: `recurring:${expense.id}:${monthKey}`,
        kind: "payment" as const,
        title: expense.label,
        meta: `${expense.cadence === "weekly" ? "Weekly" : "Monthly"} · ${input.formatMoney(expense.amountCents)}`,
        at: due.toISOString(),
        endsAt: null,
        allDay: true,
        bucket: bucketFor(due.toISOString(), now),
        priceCents: expense.amountCents,
        href: "/budget",
        actions: ACTIONS.recurring,
        source: "recurring" as const,
        snoozed: false,
        official: false,
        unblocks: 0,
        social: null,
      };
    })
    .filter((item): item is LifeOpsItem => item !== null);
}

function missionItems(input: LifeOpsInput): LifeOpsItem[] {
  const { now } = input;
  const out: LifeOpsItem[] = [];
  for (const { mission, steps } of input.missions) {
    if (mission.status !== "active") continue;
    const progress = missionProgress(steps);
    out.push({
      key: `mission:${mission.id}`,
      kind: "mission",
      title: `${mission.emoji} ${mission.title}`,
      meta: `${progress.done} of ${progress.total} steps done`,
      at: mission.dueAt,
      endsAt: null,
      allDay: true,
      bucket: bucketFor(mission.dueAt, now),
      priceCents: null,
      href: `/missions/${mission.id}`,
      actions: ACTIONS.mission,
      source: "mission",
      snoozed: false,
      official: false,
      unblocks: 0,
      social: null,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* The timeline                                                                */
/* -------------------------------------------------------------------------- */

const BUCKET_ORDER: Record<LifeOpsItem["bucket"], number> = {
  overdue: 0,
  today: 1,
  week: 2,
  upcoming: 3,
  someday: 4,
};

function byTime(a: LifeOpsItem, b: LifeOpsItem): number {
  if (a.bucket !== b.bucket) return BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
  if (a.at && b.at) return Date.parse(a.at) - Date.parse(b.at) || b.unblocks - a.unblocks;
  if (a.at) return -1;
  if (b.at) return 1;
  return b.unblocks - a.unblocks;
}

export function buildTimeline(input: LifeOpsInput): LifeOpsTimeline {
  const { now } = input;
  const overrides = overridesByRef(input.tasks);

  const derived = [
    ...phasedTasks(input),
    ...eventItems(input),
    ...inviteItems(input),
    ...planItems(input),
    ...recurringItems(input),
    ...missionItems(input),
  ]
    .map((item) => applyOverride(item, overrides.get(item.key), now))
    .filter((item): item is LifeOpsItem => item !== null);

  /* Events and plans are anchored to a real clock time; a snoozed custom task
     may be as well. A derived item cannot be "overdue" in the nagging sense — a
     plan that was yesterday simply happened — so time-bound rows that have
     passed drop out rather than showing as overdue. */
  const items = [...derived, ...customTasks(input)].filter((item) => {
    if (item.bucket !== "overdue") return true;
    return item.source === "custom" || item.source === "arrival" || item.source === "leaving" || item.source === "recurring";
  });

  items.sort(byTime);

  const doneToday = input.tasks.filter(
    (task) => task.doneAt && now.getTime() - Date.parse(task.doneAt) <= DAY_MS,
  ).length;

  const todayItems = items.filter((item) => item.bucket === "today");
  const todayCostCents = todayItems.reduce((sum, item) => sum + (item.priceCents ?? 0), 0);

  return {
    overdue: items.filter((item) => item.bucket === "overdue"),
    today: todayItems,
    week: items.filter((item) => item.bucket === "week"),
    upcoming: items.filter((item) => item.bucket === "upcoming"),
    someday: items.filter((item) => item.bucket === "someday"),
    budgetAfterTodayCents:
      input.safeTodayCents === null ? null : input.safeTodayCents - todayCostCents,
    todayCostCents,
    counts: {
      open: items.length,
      doneToday,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Calendar export                                                             */
/* -------------------------------------------------------------------------- */

function icsDate(iso: string, allDay: boolean): string {
  const date = new Date(iso);
  if (allDay) {
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** An RFC 5545 calendar of dated items. Pure; the route handler serves it. */
export function toIcs(items: readonly LifeOpsItem[], input: { productName: string; siteUrl: string }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${icsEscape(input.productName)}//LifeOps//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const item of items) {
    if (!item.at) continue;
    const start = icsDate(item.at, item.allDay);
    const end = item.endsAt ? icsDate(item.endsAt, false) : null;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.key}@${input.productName.toLowerCase()}`);
    lines.push(`DTSTAMP:${icsDate(new Date().toISOString(), false)}`);
    lines.push(item.allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`);
    if (end) lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${icsEscape(item.title)}`);
    if (item.meta) lines.push(`DESCRIPTION:${icsEscape(item.meta)}`);
    if (item.href) lines.push(`URL:${input.siteUrl}${item.href}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** A Google Calendar "add" link for one item, so no file download is needed on a phone. */
export function googleCalendarUrl(item: LifeOpsItem, siteUrl: string): string | null {
  if (!item.at) return null;
  const start = icsDate(item.at, item.allDay);
  const end = item.endsAt
    ? icsDate(item.endsAt, false)
    : item.allDay
      ? icsDate(new Date(Date.parse(item.at) + DAY_MS).toISOString(), true)
      : icsDate(new Date(Date.parse(item.at) + 2 * 3_600_000).toISOString(), false);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates: `${start}/${end}`,
    details: `${item.meta ?? ""}${item.href ? `\n${siteUrl}${item.href}` : ""}`.trim(),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
