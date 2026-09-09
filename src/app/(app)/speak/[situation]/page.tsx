import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PhraseCard } from "@/components/app/phrase-card";
import {
  SITUATIONS,
  phrasesFor,
  situationLabel,
  situationLead,
  type SituationKey,
} from "@/domain/language";
import { loadLanguage } from "@/server/queries/language";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";

type Params = { situation: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { situation } = await params;
  const key = SITUATIONS.find((candidate) => candidate === situation);
  return {
    title: key ? situationLabel[key] : "Speak Local",
    robots: { index: false, follow: false },
  };
}

/**
 * ============================================================================
 * ONE SITUATION
 * ----------------------------------------------------------------------------
 * Every phrase for one moment, easiest first.
 *
 * Not paginated and not gated behind a lesson. A student standing outside a
 * pharmacy wants to see all six pharmacy phrases at once, and any interaction
 * between them and the words is one interaction too many.
 * ============================================================================
 */
export default async function SituationPage({ params }: { params: Promise<Params> }) {
  const { situation } = await params;
  const key = SITUATIONS.find((candidate) => candidate === situation) as SituationKey | undefined;
  if (!key) notFound();

  const viewer = await requireViewer();
  const view = await loadLanguage({
    userId: viewer.user.id,
    countryCode: viewer.city.countryCode,
    timezone: viewer.city.timezone,
    now: requestDate(),
  });

  if (!view.pack) notFound();
  const phrases = phrasesFor(view.pack, key);

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
        <h1 className="text-display-xs text-ink-950">{situationLabel[key]}</h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">{situationLead[key]}</p>
      </header>

      {phrases.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-paper p-5 text-[0.9375rem] text-ink-600 ring-1 ring-ink-950/6">
          The {view.pack.name} pack has nothing for this situation yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {phrases.map((phrase) => (
            <li key={phrase.id}>
              <PhraseCard
                phrase={phrase}
                speechTag={view.pack!.speechTag}
                status={view.status.get(phrase.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
