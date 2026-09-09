import "server-only";

import { cache } from "react";

import { packFor } from "@/data/language";
import {
  dailyPhrase,
  localLanguageFor,
  summarise,
  type DailyPick,
  type LanguageProfile,
  type LanguageProgress,
  type PhrasePack,
  type PhraseProgress,
  type PhraseStatus,
} from "@/domain/language";
import { findMany, findOne } from "@/server/db";
import { dayKey } from "@/lib/dates";

/**
 * ============================================================================
 * SPEAK LOCAL — reads
 * ----------------------------------------------------------------------------
 * I/O only. Every decision about which phrase to show lives in
 * `src/domain/language.ts` and is tested there without a database.
 *
 * The one thing worth explaining is that a student who has never opened the
 * feature still HAS a language: it comes from the country their city is in.
 * There is no row until they change something, and `loadLanguage` returns a
 * profile either way. That is what lets Home carry the daily phrase from the
 * first session without onboarding having to ask a thirteenth question.
 * ============================================================================
 */

export type LanguageView = {
  /** Null when the country has no pack -- the surfaces then say so. */
  pack: PhrasePack | null;
  profile: LanguageProfile;
  /** True when the profile is the default and nothing has been stored yet. */
  implicit: boolean;
  progress: LanguageProgress | null;
  today: DailyPick | null;
  status: Map<string, PhraseStatus>;
};

/**
 * Everything Speak Local needs, in two reads.
 *
 * `cache` so that Home rendering the daily phrase and the nav rendering a
 * badge do not each go to the store. Per request, per user.
 */
export const loadLanguage = cache(async function loadLanguage(input: {
  userId: string;
  countryCode: string;
  timezone: string;
  now: Date;
}): Promise<LanguageView> {
  const { userId, countryCode, timezone, now } = input;

  const stored = await findOne("languageProfiles", (row) => row.userId === userId);
  const fallbackLanguage = localLanguageFor(countryCode);

  const profile: LanguageProfile = stored ?? {
    userId,
    /* No pack for this country: the profile still exists so the settings screen
       has something to render, and `packFor` returns null so every surface
       takes its "nothing here yet" branch. */
    language: fallbackLanguage ?? "en",
    ability: "none",
    dailyBite: true,
    startedAt: now.toISOString(),
  };

  const pack = fallbackLanguage === null && !stored ? null : packFor(profile.language);
  if (!pack) {
    return { pack: null, profile, implicit: !stored, progress: null, today: null, status: new Map() };
  }

  const rows = await findMany("phraseProgress", (row) => row.userId === userId);
  const known = new Set(
    rows.filter((row) => row.language === pack.code && row.status === "known").map((row) => row.phraseId),
  );

  return {
    pack,
    profile,
    implicit: !stored,
    progress: summarise(pack, rows),
    today: dailyPhrase(pack, { dayKey: dayKey(now, timezone), userId, known }),
    status: new Map(
      rows.filter((row) => row.language === pack.code).map((row) => [row.phraseId, row.status]),
    ),
  };
});

/** Saved phrases, newest first. The Saved tab and nothing else. */
export async function loadSavedPhrases(userId: string): Promise<PhraseProgress[]> {
  const rows = await findMany(
    "phraseProgress",
    (row) => row.userId === userId && row.status === "saved",
  );
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
