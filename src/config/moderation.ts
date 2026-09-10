import type { ReportReason, ReportTargetKind } from "@/domain/types";

/**
 * ============================================================================
 * MODERATION
 * ----------------------------------------------------------------------------
 * The numbers and labels the report flow, the auto-hide rule and the admin
 * queue all need. Here rather than in the action, because
 * `src/server/actions/loop.ts` is a `"use server"` module and one of those may
 * export only async functions — a constant exported from it is a runtime error
 * on every page that imports the component next to it.
 * ============================================================================
 */

/**
 * How many DISTINCT students must report one thing before it is hidden
 * pending review.
 *
 * Three is a judgement, and here is the reasoning. At one, a single account is
 * a censor. At two, two friends are. At three the coordination cost is real,
 * and three independent students calling the same post a scam is itself the
 * strongest signal available — stronger than anything a classifier would
 * produce on the same text.
 *
 * The counterweight is that hiding is reversible and reviewed: a hidden item
 * appears at the top of the admin queue and one tap puts it back. Leaving a
 * scam up while nobody is watching the queue is not reversible for whoever
 * acted on it.
 */
export const AUTO_HIDE_REPORTS = 3;

/**
 * Every reason, labelled.
 *
 * A complete `Record`, not a partial one, and deliberately so: the union spans
 * both halves of what "report" means here — a student saying a person is
 * harassing them, and a student saying a listed price is out of date. The
 * queue shows both, so a reason with no label would render as a raw slug on
 * the one screen where somebody is deciding whether to take something down.
 */
export const reportReasonLabel: Record<ReportReason, string> = {
  scam: "Scam or fraud",
  spam: "Spam",
  harassment: "Harassment",
  unsafe: "Unsafe",
  "wrong-info": "Wrong information",
  "wrong-price": "Wrong price",
  "wrong-hours": "Wrong hours",
  closed: "Closed down",
  expired: "Expired",
  "source-changed": "Source changed",
  other: "Something else",
};

/**
 * Everything that can be reported, as a value rather than only a type.
 *
 * The admin action validates its form input against this, and a `z.enum` needs
 * a runtime array. Keeping it here rather than restating the union in the
 * action means a new target kind cannot be added to the type and silently fail
 * validation on the only screen that acts on it.
 */
export const reportTargetKinds = [
  "place",
  "event",
  "deal",
  "official-fact",
  "guide",
  "source",
  "listing",
  "post",
  "comment",
  "user",
  "opportunity",
  "employer",
] as const satisfies readonly ReportTargetKind[];

/**
 * The kinds this product stores rows for and can therefore actually hide.
 *
 * Everything else is a claim about something we do not own — a place from
 * OpenStreetMap, a job from a provider's feed. A report against one of those
 * is a signal worth reading and acting on upstream, and the queue says so
 * instead of offering a Take it down button that would do nothing.
 */
/**
 * What an admin can actually act on from the queue.
 *
 * It was `["post", "comment"]`, and the two omissions were the two where money
 * changes hands. A reported scam LISTING could be taken down by nobody but its
 * own author — `setListingStatus` requires `sellerId === userId` — so an admin
 * holding three scam reports was shown copy explaining this target could not
 * be hidden, and offered "Close it" as the only option.
 *
 * An OPPORTUNITY had the opposite failure. `reportOpportunity` withholds a gig
 * on the first scam report and every read filters on `published`, so one
 * report removes it — and nothing anywhere wrote it back. A single malicious
 * report permanently destroyed a legitimate student's gig with no way to undo
 * it. Both directions now resolve; see `resolveReports`.
 *
 * A place, an event or a deal stays off this list on purpose: those come from
 * a provider, and a report against one is a signal we pass on rather than a
 * row we can hide.
 */
export const hideableTargetKinds: readonly ReportTargetKind[] = [
  "post",
  "comment",
  "listing",
  "opportunity",
];

/**
 * Reasons that mean somebody could get hurt or robbed, listed first in the
 * queue however old they are.
 *
 * A queue sorted purely by age puts a week-old spam complaint above a
 * scam reported four minutes ago, which is the wrong order for the only
 * person who ever reads it.
 */
export const urgentReasons: readonly ReportReason[] = ["scam", "unsafe", "harassment"];
