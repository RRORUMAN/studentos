"use server";

import { classifyIntent, type NeedGap } from "@/domain/insight";
import { findOne, insert, newId, nowIso, transaction } from "@/server/db";
import { currentUserId } from "@/server/viewer";

/**
 * ============================================================================
 * UNMET-NEED CAPTURE
 * ----------------------------------------------------------------------------
 * Every question the product could not answer becomes a row here.
 *
 * The privacy design is the point, and it is not incidental: the raw text a
 * student typed is **classified and discarded**. What persists is an intent
 * from a closed vocabulary — "laundry", "haircut", "airport-transport" — plus a
 * city and a count of distinct students.
 *
 * That gives the Feature Lab everything it is actually for ("412 students in
 * Madrid needed laundry information and we have none") while making it
 * impossible for anyone, including us, to reconstruct what an individual
 * searched for. A searchable archive of student queries is a liability with no
 * product upside, so the product simply never builds one.
 *
 * Failures here are swallowed. Analytics must never be able to break a search.
 * ============================================================================
 */

export async function recordSearchMiss(input: {
  query: string;
  surface: "ask" | "search" | "explore" | "events";
  resultCount: number;
  /** Set when the caller knows why it failed. Otherwise inferred. */
  gap?: NeedGap;
}): Promise<void> {
  try {
    const userId = await currentUserId();
    const profile = userId ? await findOne("profiles", (row) => row.userId === userId) : null;
    const citySlug = profile?.citySlug ?? "unknown";

    /* Classified here, then the raw string goes out of scope and is never
       written anywhere. */
    const intent = classifyIntent(input.query);

    await insert("searchMisses", {
      id: newId(),
      userId: userId ?? null,
      citySlug,
      intent,
      surface: input.surface,
      resultCount: input.resultCount,
      createdAt: nowIso(),
    });

    /* An unmatched query is the signal that the vocabulary itself needs
       extending, so it is worth a distinct gap reason. */
    const gap: NeedGap =
      input.gap ?? (intent === "other" ? "missing-feature" : "missing-data");

    await transaction((db) => {
      const existing = db.unmetNeeds.find(
        (row) => row.citySlug === citySlug && row.intent === intent && row.gap === gap,
      );

      if (existing) {
        /* Distinct students, not distinct queries: one person searching the
           same thing five times is one unmet need, and counting it five times
           would make the Feature Lab lie about demand. */
        const alreadyCounted =
          userId !== null &&
          db.searchMisses.some(
            (row) =>
              row.userId === userId &&
              row.intent === intent &&
              row.citySlug === citySlug &&
              row.id !== undefined,
          );

        if (!alreadyCounted) existing.hits += 1;
        existing.lastSeenAt = nowIso();
        return;
      }

      db.unmetNeeds.push({
        id: newId(),
        citySlug,
        campusSlug: profile?.campusSlug ?? null,
        intent,
        gap,
        hits: 1,
        tag: null,
        firstSeenAt: nowIso(),
        lastSeenAt: nowIso(),
      });
    });
  } catch {
    /* Never surface. A failed analytics write must not break a search. */
  }
}

/* -------------------------------------------------------------------------- */
/* Useful outcomes                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The north-star ledger.
 *
 * One row per genuinely useful thing that happened — a place found, money
 * saved, a plan made, a person met. This is what the product is steered by,
 * rather than sessions or page views, because a student who opens the app
 * forty times and gets nothing out of it is a failure that a page-view metric
 * would score as a triumph.
 */
export async function recordOutcome(
  kind:
    | "found-place"
    | "saved-money"
    | "event-saved"
    | "plan-created"
    | "joined-activity"
    | "used-deal"
    | "budget-action"
    | "friend-connected"
    | "community-contribution",
  detail?: string,
): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;

    await insert("outcomes", {
      id: newId(),
      userId,
      kind,
      detail: detail ?? null,
      createdAt: nowIso(),
    });
  } catch {
    /* Same rule: never break the interaction that produced the outcome. */
  }
}
