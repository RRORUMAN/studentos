"use client";

import { Bookmark, ShoppingCart, Stethoscope, Train, Users, Utensils, Volume2 } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { spanish } from "@/data/language/es";
import { packs } from "@/data/language";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * SPEAK LOCAL
 * ----------------------------------------------------------------------------
 * The one section on this page that has to argue against a competitor the
 * reader has already tried and given up on.
 *
 * So it does not say "learn Spanish". It shows the phrase everybody needs on
 * day two, next to the note that makes it worth reading -- that "menu del dia"
 * is the reason a student can eat out in Spain at all -- because the note is
 * the thing Duolingo does not have and the thing a phrasebook does not have
 * either. The claim is narrow and true: this teaches the words you need to
 * live here, and nothing else.
 *
 * The phrases below are REAL ROWS from `src/data/language/es.ts` rather than
 * marketing copy that resembles the product. Nothing here can drift from what
 * a student actually gets, because it is the same data.
 * ============================================================================
 */

/** The three the section leads with, pulled from the pack by id. */
const FEATURED = ["es.groceries.cuanto-cuesta", "es.eating-out.menu-del-dia", "es.money.descuento-estudiante"];

const SITUATIONS = [
  { icon: ShoppingCart, label: "At the supermarket" },
  { icon: Utensils, label: "Eating out" },
  { icon: Train, label: "Getting around" },
  { icon: Users, label: "Meeting people" },
  { icon: Stethoscope, label: "When something is wrong" },
];

export function LanguageSection() {
  const featured = FEATURED.map((id) => spanish.phrases.find((phrase) => phrase.id === id)).filter(
    (phrase): phrase is NonNullable<typeof phrase> => Boolean(phrase),
  );
  const hero = featured[0];
  const languageCount = packs.length;

  return (
    <Section id="language" tone="warm">
      <div className="page">
        <SectionHeader
          eyebrow="Speak Local"
          eyebrowIndex="09"
          title="Learn the language you will actually use."
          lead="Skip the textbook vocabulary. StudentOS teaches the phrases you need in your new city — at the till, at the table, at the pharmacy — with the local details nobody writes down."
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          {/* ---- today's phrase --------------------------------------------- */}
          <Reveal>
            <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5">
              <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                Today&rsquo;s Spanish
              </p>
              {hero ? (
                <>
                  <p lang="es" className="mt-3 text-[1.75rem] leading-tight font-semibold text-ink-950">
                    {hero.text}
                  </p>
                  <p className="mt-1.5 text-[1rem] text-ink-600">{hero.meaning}</p>
                  {hero.say ? (
                    <p className="mt-2 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-ink-400">
                      {hero.say}
                    </p>
                  ) : null}
                </>
              ) : null}

              <div className="mt-5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-flow-soft px-3 py-1.5 text-[0.8125rem] font-medium text-flow-deep">
                  <Volume2 className="size-3.5" aria-hidden />
                  Listen
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-700">
                  <Bookmark className="size-3.5" aria-hidden />
                  Save
                </span>
                <span className="ml-auto text-[0.75rem] text-ink-400">30 sec</span>
              </div>
            </div>
          </Reveal>

          {/* ---- the difference ---------------------------------------------- */}
          <Reveal delay={0.05}>
            <div className="space-y-3">
              {featured.slice(1).map((phrase) => (
                <article
                  key={phrase.id}
                  className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/5"
                >
                  <p lang="es" className="text-[1.0625rem] font-semibold text-ink-950">
                    {phrase.text}
                  </p>
                  <p className="mt-0.5 text-[0.9375rem] text-ink-600">{phrase.meaning}</p>
                  {phrase.note ? (
                    <p className="mt-2.5 border-t border-ink-100 pt-2.5 text-[0.8125rem] leading-relaxed text-ink-500">
                      {phrase.note}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </Reveal>
        </div>

        {/* ---- situations ---------------------------------------------------- */}
        <Reveal className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {SITUATIONS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2",
                  "text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/6",
                )}
              >
                <Icon className="size-4 text-ink-400" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="mt-7">
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink href="/get-started" variant="signal" size="lg">
              Get started free
            </ButtonLink>
            <p className="max-w-[46ch] text-[0.875rem] leading-relaxed text-ink-500">
              {languageCount} languages, chosen from the country you are moving to and changeable
              at any time. Every pack says how complete it is — Spanish is the deepest, several are
              starter packs of survival phrases, and the interface tells you which you are getting.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
