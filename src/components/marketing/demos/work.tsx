import { Clock, MapPin } from "lucide-react";

import { SampleTag } from "@/components/ui/primitives";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * WORK — demo
 * ----------------------------------------------------------------------------
 * The half of the money story nobody else tells.
 *
 * Every budgeting app a reader has already tried ends the same sentence: spend
 * less. This says the other thing — that the product also knows what work is
 * on the board in their city — and it earns that claim by showing the
 * mechanism rather than the promise: a fit score with its reasons attached, a
 * gap, and the shifts that would close it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DEMO IS NOT ALLOWED TO DO
 *
 * It must not read as a listing of jobs that exist. The rows are an
 * illustration of the interface, labelled with the same `SampleTag` the rest of
 * the page uses, and the earnings figure carries the word "estimate" next to it
 * rather than in a footnote. A marketing page that implies a student will make
 * €480 a month is making a promise the product has no way to keep, and it is
 * the exact promise every scam job advert opens with.
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
  /** The catch. Shown when there is one — as it is in the product. */
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

export function WorkDemo() {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* ---- the money story ------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-ink-800 text-paper shadow-[var(--shadow-float)]">
        <div className="bg-ink-950 px-4 py-3.5">
          <p className="font-mono text-micro tracking-[0.1em] text-paper/50 uppercase">
            Monthly gap
          </p>
          <p className="tnum mt-0.5 font-mono text-[1.5rem] font-semibold">
            {money(GAP_CENTS / 100)}
          </p>
        </div>
        <div className="bg-ink-950 px-4 py-3.5">
          <p className="font-mono text-micro tracking-[0.1em] text-paper/50 uppercase">
            Could earn · estimate
          </p>
          <p className="tnum mt-0.5 font-mono text-[1.5rem] font-semibold text-signal">
            {money(POTENTIAL_LOW / 100)}–{money(POTENTIAL_HIGH / 100)}
          </p>
        </div>
      </div>

      {/* ---- the matches ---------------------------------------------------- */}
      <ul className="flex flex-col divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5">
        {MATCHES.map((match) => (
          <li key={match.title} className="flex gap-4 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span className="tnum font-mono text-[1rem] font-semibold text-ink-950">
                  {match.pay}
                </span>
                <h4 className="text-[0.9375rem] leading-snug font-medium text-ink-900">
                  {match.title}
                </h4>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-500">
                <span>{match.employer}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5 shrink-0" aria-hidden />
                  {match.when}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  {match.where}
                </span>
              </p>
              <p className="mt-1.5 text-[0.75rem] text-ink-600">
                {match.reasons.join(" · ")}
                {match.snag ? (
                  <span className="text-ink-500">
                    {" "}
                    — <span className="font-medium text-ink-700">the catch:</span> {match.snag}
                  </span>
                ) : null}
              </p>
            </div>
            <span
              className={cn(
                "tnum h-fit shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.6875rem] font-semibold",
                match.fit >= 90 ? "bg-mint text-ink-950" : "bg-signal-soft text-signal-deep",
              )}
            >
              {match.fit}% fit
            </span>
          </li>
        ))}
      </ul>

      <p className="flex flex-wrap items-center gap-2 text-[0.75rem] leading-relaxed text-ink-500">
        <SampleTag />
        Nobody is promised earnings. Unstated pay says “pay not stated”, never a guess.
      </p>
    </div>
  );
}
