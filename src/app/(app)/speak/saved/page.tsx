import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PhraseCard } from "@/components/app/phrase-card";
import { packs } from "@/data/language";
import { MascotArt } from "@/components/mascot/mascot-art";
import { loadLanguage, loadSavedPhrases } from "@/server/queries/language";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Saved phrases",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * SAVED PHRASES
 * ----------------------------------------------------------------------------
 * What the student kept, newest first, across every language they have ever
 * studied.
 *
 * Across every language deliberately. Progress rows carry their own language
 * code, so somebody who learned Spanish in Madrid and is now in Berlin still
 * has their Spanish here. Switching what you are learning is not the same as
 * throwing away what you learned, and this is the screen where that shows.
 * ============================================================================
 */
export default async function SavedPhrasesPage() {
  const viewer = await requireViewer();
  const [rows, view] = await Promise.all([
    loadSavedPhrases(viewer.user.id),
    loadLanguage({
      userId: viewer.user.id,
      countryCode: viewer.city.countryCode,
      timezone: viewer.city.timezone,
      now: requestDate(),
    }),
  ]);

  /* Resolve each saved row against the pack it came from, dropping anything
     whose phrase has since been removed from a pack -- a stale id renders as
     nothing rather than as a broken card. */
  const saved = rows.flatMap((row) => {
    const pack = packs.find((candidate) => candidate.code === row.language);
    const phrase = pack?.phrases.find((candidate) => candidate.id === row.phraseId);
    return pack && phrase ? [{ pack, phrase }] : [];
  });

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/speak"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Speak Local
      </Link>

      <header className="mt-3">
        <h1 className="text-display-xs text-ink-950">Saved phrases</h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
          The ones you wanted again.
        </p>
      </header>

      {saved.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl bg-paper px-6 py-10 text-center ring-1 ring-ink-950/6">
          <MascotArt state="empty" className="size-16" />
          <p className="text-[0.9375rem] text-ink-600">
            Nothing saved yet. Tap Save on any phrase and it lands here.
          </p>
          <Link
            href="/speak"
            className="rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-white transition-opacity hover:opacity-90"
          >
            Find one
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {saved.map(({ pack, phrase }) => (
            <li key={phrase.id}>
              <PhraseCard
                phrase={phrase}
                speechTag={pack.speechTag}
                status={view.status.get(phrase.id) ?? "saved"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
