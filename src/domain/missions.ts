import type { LifeStage } from "@/domain/lifecycle";
import type { Cents, Id, Iso } from "@/domain/types";

/**
 * ============================================================================
 * SMART MISSIONS
 * ----------------------------------------------------------------------------
 * A recommendation is a thing to read; a mission is a thing to do. Each one
 * is a short, priced, ordered set of steps built from real rows — a free
 * museum, a €7 lunch, a football group — with a budget that adds up and a
 * progress bar that fills.
 *
 * The shapes below separate the *template* (what "Weekend under €30" means in
 * general) from the *instance* (which museum, which lunch, in this city, for
 * this student, at this price). Templates are config; instances are rows.
 *
 * Nothing in a mission is invented: every step that names a place or an event
 * carries the id of the row it came from, and a template slot the city cannot
 * fill is dropped rather than filled with a plausible-sounding line.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

export type MissionStepKind =
  | "task"
  | "place"
  | "event"
  | "social"
  | "budget"
  | "transport"
  | "buffer";

/** How a slot is filled from the city's rows. */
export type MissionPick = {
  /** Place layers that qualify. */
  layers?: readonly string[];
  /** Event kinds or tags that qualify. */
  eventTags?: readonly string[];
  /** Only free rows. */
  free?: boolean;
  /** Hard price ceiling for the row, in cents. */
  maxCents?: Cents;
  /** Prefer rows students are converging on. */
  social?: boolean;
  /** For events: within this many days. */
  withinDays?: number;
};

export type MissionStepTemplate = {
  key: string;
  label: string;
  kind: MissionStepKind;
  /** Fixed cost, for transport and buffer lines. */
  priceCents?: Cents;
  /** How to fill it. Absent for tasks with fixed copy. */
  pick?: MissionPick;
  /** Where the step is done, when it is not a row. */
  href?: string;
  /** A step the mission still completes without. */
  optional?: boolean;
  /** Content must come from a verified official row. */
  official?: boolean;
};

export type MissionTemplate = {
  key: string;
  /**
   * The name, with `{budget}` where the cap belongs.
   *
   * It used to be the finished string — "Weekend under €30" — while the engine
   * scaled `budgetCents` into the city's own currency for every figure
   * underneath it. So a student in Stockholm read "Weekend under €30" above a
   * plan that added up to kronor, and a student in Prague read it above
   * koruna. The two halves of the same screen disagreed, and the half that was
   * wrong was the one in the largest type.
   *
   * `{budget}` is filled by `fillBudget()` from the scaled cap and the
   * city's currency, so the name and the arithmetic under it can no longer
   * drift apart. A title with no placeholder is left exactly as written.
   */
  title: string;
  /** One line that sells it. */
  tagline: string;
  emoji: string;
  /** Which stages it is offered in. Empty means every stage. */
  stages: readonly LifeStage[];
  /** Cap for the whole mission. Null for missions that are not about money. */
  budgetCents: Cents | null;
  /** How long a student has to finish it, from start. */
  durationDays: number;
  /** Shown for students who opted out of social features. */
  social: boolean;
  steps: readonly MissionStepTemplate[];
};

/* -------------------------------------------------------------------------- */
/* Instances                                                                   */
/* -------------------------------------------------------------------------- */

export type MissionStatus = "active" | "completed" | "abandoned";

export type MissionVariant = {
  /** Built with lower ceilings and free rows preferred. */
  cheaper: boolean;
  /** Built with events and groups people are already going to. */
  social: boolean;
};

export type Mission = {
  id: Id;
  userId: Id;
  templateKey: string;
  citySlug: string;
  title: string;
  emoji: string;
  budgetCents: Cents | null;
  status: MissionStatus;
  variant: MissionVariant;
  /** Public token for the share page. Null until shared. */
  shareToken: string | null;
  startedAt: Iso;
  dueAt: Iso;
  completedAt: Iso | null;
  createdAt: Iso;
};

export type MissionStep = {
  id: Id;
  missionId: Id;
  order: number;
  key: string;
  label: string;
  detail: string | null;
  kind: MissionStepKind;
  priceCents: Cents;
  /** The row this step was built from. Null for tasks and fixed lines. */
  refKind: "place" | "event" | "invite" | "deal" | null;
  refId: Id | null;
  href: string | null;
  optional: boolean;
  official: boolean;
  doneAt: Iso | null;
  skippedAt: Iso | null;
};

/** Progress, computed from the steps. Never stored. */
export function missionProgress(steps: readonly Pick<MissionStep, "doneAt" | "skippedAt" | "optional">[]): {
  done: number;
  total: number;
  fraction: number;
  complete: boolean;
} {
  const counted = steps.filter((step) => !step.skippedAt);
  const total = counted.length;
  const done = counted.filter((step) => step.doneAt !== null).length;
  const required = counted.filter((step) => !step.optional);
  const complete = total > 0 && required.every((step) => step.doneAt !== null);
  return { done, total, fraction: total === 0 ? 0 : done / total, complete };
}

/** What the mission costs, counting only steps that are still in it. */
export function missionTotalCents(steps: readonly Pick<MissionStep, "priceCents" | "skippedAt">[]): Cents {
  return steps.filter((step) => !step.skippedAt).reduce((sum, step) => sum + step.priceCents, 0);
}

/**
 * Fill `{budget}` in a mission name or tagline with the city's own money.
 *
 * `formatMoney` takes CENTS, matching the `fmt` the mission engine and every
 * mission surface already pass around — money is integer cents everywhere in
 * this codebase, and a helper that quietly wanted major units would be a
 * divide-by-100 waiting to happen at whichever call site forgot.
 *
 * A null cap means the mission is not about money — "First 7 days" has no
 * `{budget}` in it and nothing to substitute — so the placeholder is dropped
 * along with the word in front of it rather than printing "under {budget}" or
 * a bare "under". Titles without the placeholder pass through untouched.
 */
export function fillBudget(
  title: string,
  budgetCents: Cents | null,
  formatMoney: (cents: Cents) => string,
): string {
  if (!title.includes("{budget}")) return title;
  if (budgetCents === null) {
    return title.replace(/\s*\b(under|of)?\s*\{budget\}/i, "").replace(/\s{2,}/g, " ").trim();
  }
  return title.replace("{budget}", formatMoney(budgetCents));
}

export const missionStepKindMeta: Record<MissionStepKind, { label: string; emoji: string }> = {
  task: { label: "Do", emoji: "✅" },
  place: { label: "Go", emoji: "📍" },
  event: { label: "Event", emoji: "🎟️" },
  social: { label: "People", emoji: "👋" },
  budget: { label: "Money", emoji: "💶" },
  transport: { label: "Transport", emoji: "🚇" },
  buffer: { label: "Buffer", emoji: "🫙" },
};
