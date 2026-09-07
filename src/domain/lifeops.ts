import type { LifeStage } from "@/domain/lifecycle";
import type { Cents, Id, Iso } from "@/domain/types";

/**
 * ============================================================================
 * LIFEOPS
 * ----------------------------------------------------------------------------
 * One timeline for everything a student has to care about: arrival admin,
 * deadlines, classes, events they said they are going to, plans, recurring
 * payments about to land, and the tasks they wrote themselves.
 *
 * Two kinds of thing live here and it is worth keeping them apart:
 *
 *   STORED    `LifeOpsTask` rows. Tasks the student created, plus *override*
 *             rows for derived items (a snoozed event, a dismissed arrival
 *             task). Overrides are keyed by `sourceRef` so the engine can
 *             apply them without the derived item needing its own table.
 *
 *   DERIVED   `LifeOpsItem`s. Computed every time from the rows the product
 *             already holds. Never persisted, so an event moving its start
 *             time moves on the timeline without a sync job.
 *
 * Every date is deterministic arithmetic. No model decides what is due.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Stored                                                                      */
/* -------------------------------------------------------------------------- */

export type LifeOpsTaskKind =
  | "task"
  | "deadline"
  | "class"
  | "reminder"
  | "payment"
  | "travel"
  | "social";

export type LifeOpsSource = "custom" | "arrival" | "leaving" | "mission" | "event" | "invite" | "plan" | "recurring";

/**
 * A row in `lifeops_tasks`.
 *
 * For `source: "custom"` this is the task itself. For every other source it is
 * an override for a derived item: `sourceRef` names the item, and the
 * done/snoozed/dismissed timestamps are what the student did to it.
 */
export type LifeOpsTask = {
  id: Id;
  userId: Id;
  title: string;
  detail: string | null;
  kind: LifeOpsTaskKind;
  /** When it is due. Null means "sometime", which sorts after dated items. */
  dueAt: Iso | null;
  /** Whole-day items render without a time. */
  allDay: boolean;
  /** Where in the product it is done, when there is somewhere. */
  href: string | null;
  source: LifeOpsSource;
  /** `arrival:<taskId>`, `event:<eventId>`, `recurring:<id>:<yyyy-mm>`. Null for custom. */
  sourceRef: string | null;
  /** Weekly items (a class, a training) roll forward a week when completed. */
  repeat?: "weekly" | null;
  doneAt: Iso | null;
  snoozedUntil: Iso | null;
  dismissedAt: Iso | null;
  createdAt: Iso;
  updatedAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Derived                                                                     */
/* -------------------------------------------------------------------------- */

export type LifeOpsBucket = "overdue" | "today" | "week" | "upcoming" | "someday";

export type LifeOpsItemKind =
  | "task"
  | "deadline"
  | "class"
  | "reminder"
  | "event"
  | "invite"
  | "plan"
  | "payment"
  | "mission"
  | "travel"
  | "social";

/** What a student may do to an item. Derived items cannot be edited, only acted on. */
export type LifeOpsAction = "complete" | "snooze" | "reschedule" | "dismiss" | "calendar";

export type LifeOpsItem = {
  /** Stable across renders: `custom:<id>` or `<source>:<ref>`. */
  key: string;
  kind: LifeOpsItemKind;
  title: string;
  /** One line: venue, category, price context. */
  meta: string | null;
  at: Iso | null;
  endsAt: Iso | null;
  allDay: boolean;
  bucket: LifeOpsBucket;
  /** Money it will cost, when known. Null when free or unknown. */
  priceCents: Cents | null;
  href: string | null;
  /** Which actions apply. Derived from `source`. */
  actions: readonly LifeOpsAction[];
  source: LifeOpsSource;
  /** Set when a snoozed item is being shown at its snoozed time. */
  snoozed: boolean;
  /** Content must come from an official source, never generated. */
  official: boolean;
  /** How many things wait on this one. Only arrival tasks carry it. */
  unblocks: number;
  /** A social count worth printing: "3 friends going". */
  social: string | null;
};

export type LifeOpsTimeline = {
  overdue: LifeOpsItem[];
  today: LifeOpsItem[];
  week: LifeOpsItem[];
  upcoming: LifeOpsItem[];
  someday: LifeOpsItem[];
  /** Safe-today minus what today's dated items cost. Null without a budget. */
  budgetAfterTodayCents: Cents | null;
  /** Sum of today's known costs. */
  todayCostCents: Cents;
  counts: { open: number; doneToday: number };
};

/* -------------------------------------------------------------------------- */
/* Modes                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * LifeOps changes character with the stage. The mode picks the headline, which
 * task sources are pulled in, and which suggestions the empty state offers.
 */
export type LifeOpsMode = "before-arrival" | "first-week" | "established" | "leaving";

export function lifeOpsMode(stage: LifeStage): LifeOpsMode {
  switch (stage) {
    case "before-arrival":
      return "before-arrival";
    case "first-24h":
    case "first-week":
    case "first-month":
      return "first-week";
    case "leaving":
      return "leaving";
    default:
      return "established";
  }
}

export const lifeOpsModeMeta: Record<
  LifeOpsMode,
  {
    label: string;
    /** What this mode is for, in the student's own words. */
    focus: string;
    /** Quick-add suggestions for the empty state and the add sheet. */
    suggestions: readonly { title: string; kind: LifeOpsTaskKind; inDays: number }[];
  }
> = {
  "before-arrival": {
    label: "Before you arrive",
    focus: "Documents, accommodation, university setup, transport research, a budget.",
    suggestions: [
      { title: "Scan passport and visa to cloud storage", kind: "task", inDays: 1 },
      { title: "Confirm first-night accommodation", kind: "deadline", inDays: 3 },
      { title: "Email the university international office", kind: "task", inDays: 2 },
      { title: "Book airport transfer", kind: "travel", inDays: 5 },
    ],
  },
  "first-week": {
    label: "First week",
    focus: "Transport card, SIM, supermarket, campus, a first event, a gym, a group.",
    suggestions: [
      { title: "Collect student card", kind: "task", inDays: 2 },
      { title: "Registration appointment", kind: "deadline", inDays: 7 },
      { title: "Find a weekly sport or group", kind: "social", inDays: 4 },
      { title: "First class", kind: "class", inDays: 1 },
    ],
  },
  established: {
    label: "This week",
    focus: "Classes, events, money, plans, subscriptions, people.",
    suggestions: [
      { title: "Assignment due", kind: "deadline", inDays: 7 },
      { title: "Rent due", kind: "payment", inDays: 14 },
      { title: "Book a weekend away", kind: "travel", inDays: 10 },
      { title: "Call home", kind: "reminder", inDays: 2 },
    ],
  },
  leaving: {
    label: "Before you go",
    focus: "Cancel what renews, sell what stays, final bills, deposit, the airport run.",
    suggestions: [
      { title: "Cancel gym membership", kind: "deadline", inDays: 3 },
      { title: "Give notice on the room", kind: "deadline", inDays: 1 },
      { title: "Return library books", kind: "task", inDays: 5 },
      { title: "Airport run with luggage", kind: "travel", inDays: 14 },
    ],
  },
};

export const lifeOpsKindMeta: Record<LifeOpsItemKind, { label: string; accent: "signal" | "pulse" | "flow" | "mint" | "amber" }> = {
  task: { label: "Task", accent: "flow" },
  deadline: { label: "Deadline", accent: "pulse" },
  class: { label: "Class", accent: "flow" },
  reminder: { label: "Reminder", accent: "amber" },
  event: { label: "Event", accent: "pulse" },
  invite: { label: "Plan with people", accent: "signal" },
  plan: { label: "Plan", accent: "signal" },
  payment: { label: "Payment", accent: "amber" },
  mission: { label: "Mission", accent: "mint" },
  travel: { label: "Travel", accent: "flow" },
  social: { label: "Social", accent: "signal" },
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Bucket a date against "now", using local calendar days. */
export function bucketFor(at: Iso | null, now: Date): LifeOpsBucket {
  if (!at) return "someday";
  const when = new Date(at);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 86_400_000);

  if (when < startOfToday) return "overdue";
  if (when < endOfToday) return "today";
  if (when < endOfWeek) return "week";
  return "upcoming";
}

/** Snooze presets, as the sheet offers them. */
export const snoozePresets = [
  { key: "later", label: "Later today", hours: 3 },
  { key: "tomorrow", label: "Tomorrow", hours: 24 },
  { key: "weekend", label: "This weekend", hours: null },
  { key: "next-week", label: "Next week", hours: 24 * 7 },
] as const;

export type SnoozePreset = (typeof snoozePresets)[number]["key"];

export function snoozeUntil(preset: SnoozePreset, now: Date): Date {
  if (preset === "weekend") {
    const day = now.getDay();
    const toSaturday = (6 - day + 7) % 7 || 7;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + toSaturday, 10, 0, 0, 0);
    return date;
  }
  const hours = snoozePresets.find((entry) => entry.key === preset)?.hours ?? 24;
  if (preset === "later") return new Date(now.getTime() + hours * 3_600_000);
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + hours / 24, 9, 0, 0, 0);
  return date;
}
