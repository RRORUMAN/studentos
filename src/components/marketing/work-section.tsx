"use client";

import { ArrowRight, Clock, MapPin } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { SampleTag, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * WORK
 * ----------------------------------------------------------------------------
 * The half of the money story nobody else on this page tells.
 *
 * Every budgeting app the reader has already tried ends the same sentence:
 * spend less. This section says the other thing — that the product also knows
 * what work is on the board in their city — and it earns that claim by showing
 * the mechanism rather than the promise: a fit score with its reasons attached,
 * a gap, and the specific shifts that would close it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SECTION IS NOT ALLOWED TO DO
 *
 * It must not read as a listing of jobs that exist. The three cards below are
 * an illustration of the interface and are labelled with the same `SampleTag`
 * the rest of the page uses, and the earnings figure carries the word estimate
 * next to it rather than in a footnote. A marketing page that implies a
 * student will make €480 a month is making a promise the product has no way to
 * keep, and it is the exact promise every scam job advert opens with.
 * ============================================================================
 */

type DemoMatch = {
  title: string;
  employer: string;
  pay: string;
  when: string;
  where: string;
  fit: number;
  reasons: readonly string[];
  /** The catch. Present on the best match too — as it is in the product. */
  snag: string | null;
};

const MATCHES: readonly DemoMatch[] = [
  {
    title: "Event staff, Saturday shifts",
    employer: "Events agency",
    pay: "€16/hour",
    when: "Saturdays, 8 hours",
    where: "2.4 km from campus",
    fit: 94,
    reasons: ["Weekends", "English is enough", "No experience needed"],
    snag: null,
  },
  {
    title: "English conversation tutor",
    employer: "Language school",
    pay: "€20/hour",
    when: "Two evenings a week",
    where: "Remote",
    fit: 91,
    reasons: ["Evenings", "Native English", "Remote"],
    snag: "Term time only",
  },
  {
    title: "Social media assistant",
    employer: "Small brand",
    pay: "€450/month",
    when: "12 hours a week",
    where: "Remote",
    fit: 89,
    reasons: ["Flexible hours", "Matches your marketing"],
    snag: "Works out at €8.66 an hour",
  },
];

const GAP_CENTS = 28000;
const POTENTIAL_LOW = 32000;
const POTENTIAL_HIGH = 48000;

export function WorkSection() {
  return (
    <Section id="work" tone="paper">
      <div className="page">
        <SectionHeader
          eyebrow="StudentOS Work"
          eyebrowIndex="08"
          title="Need to earn while you study?"
          lead="Part-time jobs, one-off gigs, internships and paid projects that fit your timetable, your languages and your city. Tell StudentOS what you can do and when you are free — it does the filtering."
        />

        {/* ---- the money story ---------------------------------------------- */}
        <Reveal className="mt-8">
          <div className="grid gap-4 rounded-2xl bg-ink-950 p-5 text-paper sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
            <div>
              <p className="text-[1.0625rem] leading-snug font-semibold sm:text-[1.25rem]">
                StudentOS does not just help you spend less. It helps you earn more.
              </p>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-paper/65">
                Your budget knows what the month costs. Work knows what is going in your city
                tonight. Put the two together and “I am €280 short” stops being a feeling and starts
                being a list of four shifts.
              </p>
            </div>
            <dl className="flex gap-6 sm:flex-col sm:gap-3 sm:border-l sm:border-paper/15 sm:pl-6">
              <div>
                <dt className="font-mono text-micro tracking-[0.1em] text-paper/50 uppercase">
                  Budget gap
                </dt>
                <dd className="tnum font-mono text-[1.375rem] font-semibold">
                  {money(GAP_CENTS / 100)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-micro tracking-[0.1em] text-paper/50 uppercase">
                  Estimated potential
                </dt>
                <dd className="tnum font-mono text-[1.375rem] font-semibold text-signal">
                  {money(POTENTIAL_LOW / 100)}–{money(POTENTIAL_HIGH / 100)}
                </dd>
              </div>
            </dl>
          </div>
        </Reveal>

        {/* ---- the matches --------------------------------------------------- */}
        <p className="mt-8 font-mono text-micro tracking-[0.1em] text-ink-400 uppercase">
          Your matches
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MATCHES.map((match) => (
            <article
              key={match.title}
              className="flex flex-col rounded-2xl bg-white p-4 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="tnum font-mono text-[1.0625rem] font-semibold text-ink-950">
                  {match.pay}
                </span>
                <span
                  className={cn(
                    "tnum shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.6875rem] font-semibold",
                    match.fit >= 90 ? "bg-mint text-ink-950" : "bg-signal-soft text-signal-deep",
                  )}
                >
                  {match.fit}% fit
                </span>
              </div>

              <h3 className="mt-2 text-[0.9375rem] leading-snug font-semibold text-ink-950">
                {match.title}
              </h3>
              <p className="mt-0.5 text-[0.8125rem] text-ink-500">{match.employer}</p>

              <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5 shrink-0" aria-hidden />
                  {match.when}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  {match.where}
                </span>
              </p>

              <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
                {match.reasons.map((reason) => (
                  <li
                    key={reason}
                    className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.6875rem] font-medium text-ink-600"
                  >
                    {reason}
                  </li>
                ))}
              </ul>

              {match.snag ? (
                <p className="mt-2 text-[0.75rem] text-ink-500">
                  <span className="font-medium text-ink-700">The catch: </span>
                  {match.snag}
                </p>
              ) : null}
            </article>
          ))}
        </div>

        <Reveal delay={0.05} className="mt-8">
          <div className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.875rem] leading-relaxed text-ink-600">
              Every figure here is an estimate and StudentOS says so on the screen too. Nobody is
              promised earnings, postings that do not state their pay say “pay not stated” rather
              than guessing, and how many hours you may work is a question only your country&rsquo;s
              immigration authority can answer — so the product links you to theirs.
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <SampleTag />
              <ButtonLink href="/get-started?intent=work" variant="primary" size="sm">
                Find student work
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
