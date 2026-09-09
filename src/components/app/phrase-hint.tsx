import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PhraseCard } from "@/components/app/phrase-card";
import { contextPhrases, situationForContext, type PhraseContext } from "@/domain/language";
import { loadLanguage } from "@/server/queries/language";
import type { Viewer } from "@/server/viewer";
import { requestDate } from "@/server/now";

/**
 * ============================================================================
 * PHRASE HINT
 * ----------------------------------------------------------------------------
 * One or two phrases, next to the thing they are for.
 *
 * This is the difference between a language feature and a language tab. A
 * student looking at a restaurant at seven in the evening is about to need one
 * specific sentence; putting it on the screen they are already on costs them
 * nothing and saves the moment of sitting at a table unable to ask for the
 * bill. A student looking at a museum needs "is there a student discount",
 * which is not a language lesson, it is money.
 *
 * It renders NOTHING rather than something generic when there is no obvious
 * phrase for the context. `situationForContext` returns null for a gym, a
 * co-working space, a park, and this returns null with it. A hint that appears
 * everywhere is decoration, and decoration on a detail page is the thing that
 * turns a good idea into clutter.
 *
 * Also nothing when the student has said they are fluent: somebody who speaks
 * the language does not need to be told how to ask for the bill in it.
 * ============================================================================
 */
export async function PhraseHint({
  viewer,
  context,
  limit = 2,
}: {
  viewer: Viewer;
  context: PhraseContext;
  limit?: number;
}) {
  if (!situationForContext(context)) return null;

  const view = await loadLanguage({
    userId: viewer.user.id,
    countryCode: viewer.city.countryCode,
    timezone: viewer.city.timezone,
    now: requestDate(),
  });

  if (!view.pack) return null;
  if (view.profile.ability === "fluent") return null;

  const phrases = contextPhrases(view.pack, context, limit);
  if (phrases.length === 0) return null;

  const situation = situationForContext(context);

  return (
    <section className="mt-3" aria-labelledby="phrase-hint-heading">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2
          id="phrase-hint-heading"
          className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400"
        >
          Useful {view.pack.name}
        </h2>
        <Link
          href={situation ? `/speak/${situation}` : "/speak"}
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink-500 transition-colors hover:text-ink-800"
        >
          More
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <ul className="space-y-2">
        {phrases.map((phrase) => (
          <li key={phrase.id}>
            <PhraseCard
              phrase={phrase}
              speechTag={view.pack!.speechTag}
              status={view.status.get(phrase.id)}
              compact
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
