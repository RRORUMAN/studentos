import { Bookmark, ShoppingCart, Stethoscope, Train, Users, Utensils, Volume2 } from "lucide-react";

import { spanish } from "@/data/language/es";

/**
 * ============================================================================
 * SPEAK LOCAL — demo
 * ----------------------------------------------------------------------------
 * It does not say "learn Spanish". It shows the phrase everybody needs on day
 * two, next to the note that makes it worth reading — that "menú del día" is
 * the reason a student can eat out in Spain at all — because the note is the
 * thing a course does not have and a phrasebook does not have either.
 *
 * The phrases are REAL ROWS from `src/data/language/es.ts` rather than
 * marketing copy that resembles the product. Nothing here can drift from what
 * a student actually gets, because it is the same data.
 *
 * "Listen" and "Save" are drawn as labels rather than buttons: on this page
 * there is nothing for them to do, and a button that does nothing is a lie.
 * ============================================================================
 */

/** The three the demo leads with, pulled from the pack by id. */
const FEATURED = ["es.groceries.cuanto-cuesta", "es.eating-out.menu-del-dia", "es.money.descuento-estudiante"];

const SITUATIONS = [
  { icon: ShoppingCart, label: "Supermarket" },
  { icon: Utensils, label: "Eating out" },
  { icon: Train, label: "Getting around" },
  { icon: Users, label: "Meeting people" },
  { icon: Stethoscope, label: "When something is wrong" },
];

export function LanguageDemo() {
  const featured = FEATURED.map((id) => spanish.phrases.find((phrase) => phrase.id === id)).filter(
    (phrase): phrase is NonNullable<typeof phrase> => Boolean(phrase),
  );
  const hero = featured[0];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {hero ? (
        <div className="rounded-2xl bg-ink-950 p-5 text-paper shadow-[var(--shadow-float)] sm:p-6">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-signal">
            Today&rsquo;s Spanish
          </p>
          <p lang="es" className="mt-3 font-display text-[2rem] leading-tight font-semibold tracking-[-0.02em]">
            {hero.text}
          </p>
          <p className="mt-1 text-[1rem] text-paper/70">{hero.meaning}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {hero.say ? (
              <span className="font-mono text-[0.75rem] uppercase tracking-[0.08em] text-paper/45">
                {hero.say}
              </span>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-[0.75rem] text-paper/70">
              <Volume2 className="size-3.5" aria-hidden />
              Listen
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-[0.75rem] text-paper/70">
              <Bookmark className="size-3.5" aria-hidden />
              Save
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {featured.slice(1).map((phrase) => (
          <article key={phrase.id} className="rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/5">
            <p lang="es" className="text-[1.0625rem] font-semibold text-ink-950">
              {phrase.text}
            </p>
            <p className="mt-0.5 text-[0.875rem] text-ink-600">{phrase.meaning}</p>
            {phrase.note ? (
              <p className="mt-2.5 border-t border-ink-100 pt-2.5 text-[0.8125rem] leading-relaxed text-ink-500">
                {phrase.note}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {SITUATIONS.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[0.8125rem] font-medium text-ink-700 ring-1 ring-ink-950/6"
          >
            <Icon className="size-3.5 text-ink-400" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
