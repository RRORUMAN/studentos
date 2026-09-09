"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { packFor } from "@/data/language";
import { localLanguageFor, type LanguageCode, type PhraseProgress, type PhraseStatus } from "@/domain/language";
import { findOne, nowIso, upsert } from "@/server/db";
import { limits, rateLimit } from "@/server/rate-limit";
import { requireViewer } from "@/server/viewer";

/**
 * ============================================================================
 * SPEAK LOCAL — writes
 * ----------------------------------------------------------------------------
 * Four actions, and the shape of them is the argument.
 *
 * There is NO action for "the student looked at a phrase". Writing a row every
 * time Home renders would turn one screen into a write on every load, and buy
 * a number nobody acts on. A row appears when a student does something
 * deliberate -- saves it, or says they know it -- and until then the absence of
 * a row is the honest record.
 *
 * `markKnown` is reversible and says so in the interface. A student who taps it
 * by accident, or who finds out at a counter that they did not know it after
 * all, must be able to put it back. A one-way "learned" flag is a scoring
 * system pretending to be a checkbox.
 * ============================================================================
 */

const statusSchema = z.object({
  phraseId: z.string().min(1).max(120),
  status: z.enum(["saved", "known", "seen"]),
});

/**
 * Save a phrase, mark it known, or clear either.
 *
 * The phrase id is validated against the pack rather than trusted, so a
 * crafted request cannot fill a student's progress with rows for phrases that
 * do not exist.
 */
export async function setPhraseStatus(input: {
  phraseId: string;
  status: PhraseStatus;
}): Promise<{ ok: boolean }> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const viewer = await requireViewer();
  const gate = rateLimit(`phrase:${viewer.user.id}`, limits.chat.limit, limits.chat.windowSeconds);
  if (!gate.ok) return { ok: false };

  const profile = await findOne("languageProfiles", (row) => row.userId === viewer.user.id);
  const language = profile?.language ?? localLanguageFor(viewer.city.countryCode) ?? "en";
  const pack = packFor(language);
  const phrase = pack?.phrases.find((row) => row.id === parsed.data.phraseId);
  if (!pack || !phrase) return { ok: false };

  const existing = await findOne(
    "phraseProgress",
    (row) => row.userId === viewer.user.id && row.phraseId === phrase.id,
  );

  const next: PhraseProgress = {
    userId: viewer.user.id,
    language: pack.code,
    phraseId: phrase.id,
    status: parsed.data.status,
    seenCount: (existing?.seenCount ?? 0) + 1,
    updatedAt: nowIso(),
  };

  await upsert(
    "phraseProgress",
    (row) => row.userId === viewer.user.id && row.phraseId === phrase.id,
    next,
  );

  revalidatePath("/speak");
  revalidatePath("/home");
  return { ok: true };
}

const languageSchema = z.object({
  language: z.enum(["es", "fr", "de", "it", "pt", "nl", "pl", "cs", "hu", "fi", "sv", "et", "en"]),
  ability: z.enum(["none", "few-words", "basic", "conversational", "fluent"]).optional(),
});

/**
 * Change which language is being learned.
 *
 * Progress rows carry their own language, so switching does not delete
 * anything: a student who learns Spanish in Madrid and then spends a term in
 * Berlin still has their Spanish when they come back.
 */
export async function setLearningLanguage(input: {
  language: LanguageCode;
  ability?: "none" | "few-words" | "basic" | "conversational" | "fluent";
}): Promise<{ ok: boolean }> {
  const parsed = languageSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const viewer = await requireViewer();
  const existing = await findOne("languageProfiles", (row) => row.userId === viewer.user.id);

  await upsert("languageProfiles", (row) => row.userId === viewer.user.id, {
    userId: viewer.user.id,
    language: parsed.data.language,
    ability: parsed.data.ability ?? existing?.ability ?? "none",
    dailyBite: existing?.dailyBite ?? true,
    startedAt: existing?.startedAt ?? nowIso(),
  });

  revalidatePath("/speak");
  revalidatePath("/home");
  return { ok: true };
}

/** Turn the phrase on Home on or off. One tap, no settings screen needed. */
export async function setDailyBite(on: boolean): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  const existing = await findOne("languageProfiles", (row) => row.userId === viewer.user.id);

  await upsert("languageProfiles", (row) => row.userId === viewer.user.id, {
    userId: viewer.user.id,
    language: existing?.language ?? localLanguageFor(viewer.city.countryCode) ?? "en",
    ability: existing?.ability ?? "none",
    dailyBite: Boolean(on),
    startedAt: existing?.startedAt ?? nowIso(),
  });

  revalidatePath("/home");
  revalidatePath("/speak");
  return { ok: true };
}
