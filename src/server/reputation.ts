import "server-only";

import { cache } from "react";

import {
  reputationFor,
  trustIndex,
  type Reputation,
  type ReputationEvent,
  type ReputationSignal,
} from "@/domain/reputation";
import { findMany, findOne, insert, newId, nowIso } from "@/server/db";

/**
 * ============================================================================
 * REPUTATION LEDGER
 * ----------------------------------------------------------------------------
 * The only door through which a reputation signal is written.
 *
 * One door, because the property that makes reputation worth trusting is that
 * every row is idempotent on `(user, signal, ref)`. A student whose answer is
 * marked useful by four people has been useful once; awarding four times would
 * mean reputation measures popularity, and popularity is exactly what a truth
 * weighting must not measure. The uniqueness check lives here so no caller can
 * forget it.
 *
 * `award` never throws. A reputation write failing must not take down the
 * action that triggered it — a student's answer still posts even if the ledger
 * write loses a race. Reputation is derived data; the answer is the fact.
 * ============================================================================
 */

export async function award(input: {
  userId: string;
  citySlug: string;
  signal: ReputationSignal;
  refKind: ReputationEvent["refKind"];
  refId: string;
}): Promise<void> {
  try {
    const existing = await findOne(
      "reputationEvents",
      (row) =>
        row.userId === input.userId &&
        row.signal === input.signal &&
        row.refKind === input.refKind &&
        row.refId === input.refId,
    );
    if (existing) return;

    await insert("reputationEvents", {
      id: newId(),
      userId: input.userId,
      citySlug: input.citySlug,
      signal: input.signal,
      refKind: input.refKind,
      refId: input.refId,
      createdAt: nowIso(),
    });
  } catch {
    /* Derived data. See the note above. */
  }
}

/** A student's standing in one city, for the passport and the profile card. */
export const loadReputation = cache(
  async (userId: string, citySlug: string): Promise<Reputation> => {
    const events = await findMany("reputationEvents", (row) => row.userId === userId);
    return reputationFor(events, citySlug);
  },
);

/**
 * A trust lookup for one city, for the truth layer.
 *
 * Loads the reputation ledger once and returns a memoised function. Every
 * consumer of `assess()` needs "how much is this verifier worth" for a whole
 * list of verifications, and doing that per row would mean re-reading the
 * table once per claim on a page that renders forty of them.
 *
 * Note what is NOT filtered: the query loads every city's rows, not just this
 * one's. `reputationFor` carries out-of-city standing in at `CROSS_CITY_CARRY`,
 * and filtering to `citySlug` here would leave nothing to carry — a Madrid City
 * Expert would arrive in Berlin weighted as an anonymous account, which is
 * precisely the behaviour the Student Passport exists to avoid. The cost is
 * reading a table the size of "validated contributions across all cities",
 * which is small, and it is the correct trade.
 */
export const loadTrustIndex = cache(
  async (citySlug: string): Promise<(userId: string | null) => number> => {
    const events = await findMany("reputationEvents", () => true);
    return trustIndex(events, citySlug);
  },
);
