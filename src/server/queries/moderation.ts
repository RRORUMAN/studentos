import "server-only";

import { hideableTargetKinds, urgentReasons } from "@/config/moderation";
import type { ContentReport, ReportReason, ReportTargetKind } from "@/domain/types";
import { findMany } from "@/server/db";

/**
 * ============================================================================
 * THE MODERATION QUEUE
 * ----------------------------------------------------------------------------
 * The reader that `contentReports` did not have.
 *
 * Three places in this codebase wrote a row into that table — the Pulse report
 * action, the exchange report action, the work report action — and nothing
 * anywhere read one. Every one of them returned success to the student. So the
 * report button worked in the sense that it did not throw, and did not work in
 * any sense a person reporting a scam would recognise.
 *
 * GROUPED BY TARGET, not listed by report. Five students reporting one post is
 * one decision, not five, and a queue that makes it five is a queue that gets
 * the same post hidden four times or dismissed once and hidden once. It is
 * also the shape the auto-hide rule counts in.
 * ============================================================================
 */

export type QueuedReport = {
  targetKind: ReportTargetKind;
  targetId: string;
  /** Every open report against this target, newest first. */
  reports: readonly ContentReport[];
  /** Distinct students who reported it. Null reporters are jobs, not people. */
  reporters: number;
  /** The most serious reason given, for ordering and for the badge. */
  reason: ReportReason;
  /** True while the reasons given do not agree, which is worth seeing. */
  mixedReasons: boolean;
  /** The oldest open report, which is how long somebody has been waiting. */
  since: string;
  /** The reported words, where the target is something with words. */
  excerpt: string | null;
  /** Already hidden — by the auto-hide rule or by an admin. */
  hidden: boolean;
  /**
   * Whether taking this down is something the product can do.
   *
   * False for a place, a job or anything else that lives in somebody else's
   * feed. The queue still shows those — they are half the reports written —
   * but it offers reading and closing them rather than a button that would
   * report success and change nothing, which is the failure this whole screen
   * exists to end.
   */
  hideable: boolean;
};

/**
 * Every open report, grouped, worst first.
 *
 * Ordering is by severity and then by age. A queue sorted purely by age puts a
 * week-old spam complaint above a scam reported four minutes ago, and the
 * person reading this queue is reading it to find the second one.
 *
 * Items already hidden sort last: the hiding has happened, the decision left
 * is whether to put it back, and that is not the urgent half of the job.
 */
export async function loadReportQueue(): Promise<readonly QueuedReport[]> {
  const open = await findMany("contentReports", (row) => row.status === "open");
  if (open.length === 0) return [];

  const [posts, comments, profiles] = await Promise.all([
    findMany("posts", () => true),
    findMany("comments", () => true),
    findMany("profiles", () => true),
  ]);

  const postById = new Map(posts.map((row) => [row.id, row]));
  const commentById = new Map(comments.map((row) => [row.id, row]));
  const profileById = new Map(profiles.map((row) => [row.userId, row]));

  const groups = new Map<string, ContentReport[]>();
  for (const report of open) {
    const key = `${report.targetKind}:${report.targetId}`;
    const rows = groups.get(key);
    if (rows) rows.push(report);
    else groups.set(key, [report]);
  }

  const queued: QueuedReport[] = [];
  for (const rows of groups.values()) {
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const first = rows[0];

    const post = first.targetKind === "post" ? postById.get(first.targetId) : undefined;
    const comment = first.targetKind === "comment" ? commentById.get(first.targetId) : undefined;
    const profile = first.targetKind === "user" ? profileById.get(first.targetId) : undefined;

    /**
     * A post, comment or user we no longer have is not a decision anyone can
     * make: the author deleted it, and the report is moot.
     *
     * ONLY THOSE THREE, and the distinction matters. Half the reports in this
     * table are about a place from OpenStreetMap or a job from a provider's
     * feed — the exchange and work report actions write those — and none of
     * them has a row in this database to look up. Dropping every target we
     * could not resolve would have hidden that entire half of the queue while
     * looking exactly like an empty inbox.
     */
    const ours = first.targetKind === "post" || first.targetKind === "comment" || first.targetKind === "user";
    if (ours && !post && !comment && !profile) continue;

    const reasons = new Set(rows.map((row) => row.reason));
    const worst = urgentReasons.find((reason) => reasons.has(reason)) ?? first.reason;

    queued.push({
      targetKind: first.targetKind,
      targetId: first.targetId,
      reports: rows,
      reporters: new Set(rows.map((row) => row.userId).filter(Boolean)).size,
      reason: worst,
      mixedReasons: reasons.size > 1,
      since: rows[rows.length - 1].createdAt,
      excerpt: excerptOf(post, comment, profile),
      hidden: Boolean(post?.hiddenAt ?? comment?.hiddenAt),
      hideable: hideableTargetKinds.includes(first.targetKind),
    });
  }

  const severity = (entry: QueuedReport) => {
    const rank = urgentReasons.indexOf(entry.reason);
    return rank === -1 ? urgentReasons.length : rank;
  };

  return queued.sort(
    (a, b) =>
      Number(a.hidden) - Number(b.hidden) ||
      severity(a) - severity(b) ||
      a.since.localeCompare(b.since),
  );
}

/**
 * What was reported, in the reporter's own view of it.
 *
 * Truncated rather than full: the queue is a triage screen and a wall of
 * two-thousand-character posts is a screen nobody scrolls. The full text is
 * one click away on the item itself.
 */
function excerptOf(
  post: { title: string; body: string | null } | undefined,
  comment: { body: string } | undefined,
  profile: { displayName: string; handle: string; bio: string | null } | undefined,
): string | null {
  const text = post
    ? [post.title, post.body].filter(Boolean).join(" — ")
    : comment
      ? comment.body
      : profile
        ? [`@${profile.handle}`, profile.displayName, profile.bio].filter(Boolean).join(" · ")
        : null;

  if (!text) return null;
  return text.length > 280 ? `${text.slice(0, 279)}…` : text;
}
