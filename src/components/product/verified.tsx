import { BadgeCheck, FileText, Store, Users } from "lucide-react";

import { sourceLabel } from "@/data/places";
import type { Place } from "@/data/types";
import { cn } from "@/lib/utils";
import { STUDENT_VERIFIED_THRESHOLD, isStudentVerified } from "@/services/db/schema";

/**
 * ============================================================================
 * STUDENT VERIFIED
 * ----------------------------------------------------------------------------
 * The badge means one specific thing: at least ten students independently
 * confirmed this, and the count is always shown next to it. It is deliberately
 * not a star rating, not a score, and never decorative — a place with nine
 * confirmations shows the count without the badge.
 * ============================================================================
 */

export function StudentVerified({
  count,
  size = "md",
  onDark = false,
  className,
}: {
  count: number;
  size?: "sm" | "md";
  onDark?: boolean;
  className?: string;
}) {
  const verified = isStudentVerified(count);

  if (!verified) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs",
          onDark ? "text-white/40" : "text-ink-400",
          className,
        )}
        title={`${STUDENT_VERIFIED_THRESHOLD} independent confirmations are needed for the Student Verified badge.`}
      >
        <Users className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
        <span className="tnum">{count > 0 ? `${count} confirmed` : "Not yet confirmed"}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-xs",
        onDark ? "bg-mint/15 text-mint" : "bg-mint-soft text-mint-deep",
        className,
      )}
      title={`Confirmed independently by ${count} students. The badge needs at least ${STUDENT_VERIFIED_THRESHOLD}.`}
    >
      <BadgeCheck className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      Student verified
      <span className="tnum opacity-70">{count}</span>
    </span>
  );
}

const SOURCE_ICON = {
  students: Users,
  official: FileText,
  venue: Store,
  mixed: Users,
} as const;

/**
 * Where a claim came from. Rendered under every recommendation so a factual
 * statement can always be traced back to something other than a model.
 */
export function SourceNote({
  source,
  onDark = false,
  className,
}: {
  source: Place["source"];
  onDark?: boolean;
  className?: string;
}) {
  const Icon = SOURCE_ICON[source];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        onDark ? "text-white/40" : "text-ink-400",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {sourceLabel[source]}
    </span>
  );
}
