import { ArrowRight, Bookmark, Languages } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LanguagePicker } from "@/components/app/language-picker";
import { PhraseCard } from "@/components/app/phrase-card";
import { MascotArt } from "@/components/mascot/mascot-art";
import { offeredLanguages } from "@/data/language";
import { coverageLabel, situationLabel, situationLead, situationsIn } from "@/domain/language";
import { loadLanguage } from "@/server/queries/language";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Speak Local",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * SPEAK LOCAL
 * ----------------------------------------------------------------------------
 * Today's phrase, then the ten situations, then what has been kept.
 *
 * The order is the argument. A student who opens this has thirty seconds and
 * one question -- what should I learn now -- so the answer is at the top and
 * everything else is a way of going deeper on purpose. There is no streak, no
 * daily goal and no notification pressing them to come back, because the
 * feature's job is to be useful when they need it rather than to be opened
 * every day.
 * ============================================================================
 */
export default async function SpeakPage() {
  const viewer = await requireViewer();
  const now = requestDate();

  const view = await loadLanguage({
    userId: viewer.user.id,
    countryCode: viewer.city.countryCode,
    timezone: viewer.city.timezone,
    now,
  });

  const languages = offeredLanguages();

  /* No pack for this country. Said plainly, with the way out. */
  if (!view.pack) {
    return (
      <div className="page max-w-2xl py-6 sm:py-8">
        <Header cityName={viewer.city.name} />
        <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-ink-950/6">
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            We do not have a phrase pack for {viewer.city.country} yet. Nothing is hidden behind a
            setting — it genuinely has not been written.
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-700">
            You can still learn another language while you are here.
          </p>
          <div className="mt-4">
            <LanguagePicker current={view.profile.language} ability={view.profile.ability} languages={languages} />
          </div>
        </div>
      </div>
    );
  }

  const { pack, progress, today } = view;
  const situations = situationsIn(pack);

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Header cityName={viewer.city.name} />

      {/* ---- today ---------------------------------------------------------- */}
      <section className="mt-6" aria-labelledby="today-heading">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <h2 id="today-heading" className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            Today&rsquo;s {pack.name}
          </h2>
          <span className="text-[0.75rem] text-ink-400">30 sec</span>
        </div>

        {today ? (
          <PhraseCard phrase={today.phrase} speechTag={pack.speechTag} status={view.status.get(today.phrase.id)} />
        ) : (
          <div className="rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
            <p className="text-[0.9375rem] text-ink-700">
              You have marked every phrase in this pack as known. There is nothing left to show you
              here, which is the honest end of a {pack.phrases.length}-phrase pack rather than a
              reason to start again.
            </p>
          </div>
        )}
      </section>

      {/* ---- progress -------------------------------------------------------- */}
      {progress && progress.known > 0 ? (
        <p className="mt-3 px-1 text-[0.8125rem] text-ink-500">
          <span className="tnum font-semibold text-ink-800">{progress.known}</span> of{" "}
          <span className="tnum">{progress.total}</span> marked as known
          {progress.saved > 0 ? (
            <>
              {" · "}
              <Link href="/speak/saved" className="underline decoration-ink-300 underline-offset-2 hover:text-ink-800">
                {progress.saved} saved
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {/* ---- situations ------------------------------------------------------ */}
      <section className="mt-8" aria-labelledby="situations-heading">
        <h2 id="situations-heading" className="mb-2 px-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
          Situations
        </h2>
        <ul className="space-y-2">
          {situations.map(({ situation, count }) => {
            const done = progress?.bySituation.find((row) => row.situation === situation)?.known ?? 0;
            return (
              <li key={situation}>
                <Link
                  href={`/speak/${situation}`}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1rem] font-semibold text-ink-950">
                      {situationLabel[situation]}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-500">
                      {situationLead[situation]}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-[0.8125rem] font-medium text-ink-600">
                      {done > 0 ? `${done}/${count}` : count}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-300" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- saved ----------------------------------------------------------- */}
      <section className="mt-6">
        <Link
          href="/speak/saved"
          className="flex items-center gap-3 rounded-2xl bg-paper p-4 ring-1 ring-ink-950/6 transition-colors hover:bg-white"
        >
          <Bookmark className="size-4 shrink-0 text-ink-400" aria-hidden />
          <span className="flex-1 text-[0.9375rem] font-medium text-ink-800">Saved phrases</span>
          <span className="tnum text-[0.8125rem] text-ink-500">{progress?.saved ?? 0}</span>
          <ArrowRight className="size-4 shrink-0 text-ink-300" aria-hidden />
        </Link>
      </section>

      {/* ---- which language --------------------------------------------------- */}
      <section className="mt-8 rounded-2xl bg-paper p-5 ring-1 ring-ink-950/6" aria-labelledby="language-heading">
        <h2 id="language-heading" className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-950">
          <Languages className="size-4 text-ink-400" aria-hidden />
          Learning {pack.name}
        </h2>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-500">
          {coverageLabel[pack.coverage]} · {pack.phrases.length} phrases. Chosen from {viewer.city.country};
          change it if you are learning something else.
        </p>
        <div className="mt-4">
          <LanguagePicker current={view.profile.language} ability={view.profile.ability} languages={languages} />
        </div>
      </section>
    </div>
  );
}

function Header({ cityName }: { cityName: string }) {
  return (
    <header className="flex items-start gap-4">
      <MascotArt state="social" accessory="speech-bubble" className="size-14 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">Speak Local</p>
        <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">
          The words you actually need in {cityName}.
        </h1>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
          Not a course. The phrases that get you through a shop, a landlord, a doctor&rsquo;s desk and
          a Friday night — with the bits nobody tells you.
        </p>
      </div>
    </header>
  );
}
