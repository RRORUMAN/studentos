import { ArrowRight } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { MascotStill } from "@/components/mascot/mascot";
import { accents, type Accent } from "@/components/ui/accent";
import { ProductPanel, SampleTag, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { collapsedApps, todayBrief, whyQuestions, type BriefLine } from "@/data/brain";
import { safeToday } from "@/data/budget";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * THE PROBLEM
 * ----------------------------------------------------------------------------
 * Before and after, side by side, with the same questions on both sides.
 *
 * Left is month one as it actually goes: eight apps, and the questions that
 * arrive all at once and mostly at night, scattered the way they arrive. Right
 * is the same questions with an answer next to each — and every answer is a
 * line already on this page, taken from the seeded Today brief and the seeded
 * budget, so the "after" cannot promise more than the product shows below it.
 *
 * This replaced two sections ("why it exists" and "one app instead of ten")
 * that made the same argument twice, twelve screens apart.
 * ============================================================================
 */

function briefLine(kind: BriefLine["kind"]): string | null {
  return todayBrief.lines.find((line) => line.kind === kind)?.text ?? null;
}

export function ProblemSection() {
  const answers: { q: string; a: string | null; accent: Accent }[] = [
    { q: "What's free tonight?", a: briefLine("events"), accent: "mint" },
    { q: "Can I afford going out?", a: `${money(safeToday())} safe to spend today`, accent: "flow" },
    { q: "How do I meet people?", a: briefLine("group"), accent: "pulse" },
    { q: "What important thing am I forgetting?", a: briefLine("task"), accent: "signal" },
  ];

  return (
    <Section id="why" tone="warm">
      <div className="page">
        <SectionHeader
          align="center"
          eyebrow="The problem"
          eyebrowIndex="01"
          title="Moving abroad means figuring out everything again."
          lead="Where to eat, what it costs, who to ask, what you forgot to book. Right now that lives in eight apps and a group chat nobody can search."
        />

        <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
          {/* ---- before ------------------------------------------------------ */}
          <Reveal className="h-full">
            <div className="flex h-full flex-col rounded-3xl border border-dashed border-ink-300 bg-paper/70 p-6 sm:p-8">
              <p className="font-mono text-micro tracking-[0.14em] text-ink-500 uppercase">
                Month one, the usual way
              </p>

              <RevealGroup step={0.03} className="mt-5 flex flex-wrap gap-2">
                {collapsedApps.map((app) => {
                  const Icon = app.icon;
                  return (
                    <RevealItem key={app.label}>
                      <span
                        style={{ transform: `rotate(${app.rotate}deg)` }}
                        className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[0.8125rem] font-medium text-ink-500 shadow-[var(--shadow-flat)]"
                      >
                        <Icon className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                        {app.label}
                      </span>
                    </RevealItem>
                  );
                })}
              </RevealGroup>

              <RevealGroup step={0.04} delay={0.1} className="mt-6 flex flex-wrap gap-2.5">
                {whyQuestions.map((question) => (
                  <RevealItem key={question.text}>
                    <p
                      style={{ transform: `rotate(${question.rotate / 2}deg)` }}
                      className={cn(
                        "rounded-2xl rounded-bl-sm border bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-800",
                        accents[question.accent].border,
                      )}
                    >
                      {question.text}
                    </p>
                  </RevealItem>
                ))}
              </RevealGroup>

              <p className="mt-auto pt-8 font-display text-[1.375rem] leading-tight font-semibold tracking-[-0.02em] text-ink-950">
                <span className="tnum">{collapsedApps.length}</span> apps. None of them know what
                the others know.
              </p>
            </div>
          </Reveal>

          {/* ---- the turn ---------------------------------------------------- */}
          <div className="flex items-center justify-center" aria-hidden>
            <span className="grid size-12 place-items-center rounded-full bg-ink-950 text-signal shadow-[var(--shadow-float)]">
              <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
            </span>
          </div>

          {/* ---- after ------------------------------------------------------- */}
          <Reveal delay={0.08} className="h-full">
            <ProductPanel className="flex h-full flex-col rounded-3xl sm:p-8 lg:p-8">
              <div className="flex items-center justify-between gap-3">
                <Wordmark tone="dark" />
                <SampleTag onDark />
              </div>
              <p className="mt-5 font-mono text-micro tracking-[0.14em] text-white/45 uppercase">
                Same questions, one screen
              </p>

              <ul className="mt-2 flex flex-col">
                {answers
                  .filter((entry) => entry.a)
                  .map((entry) => (
                    <li key={entry.q} className="border-b border-white/8 py-3.5 last:border-b-0">
                      <p className="text-[0.8125rem] text-white/45">{entry.q}</p>
                      <p className="mt-1 flex items-center gap-2.5 text-[1.0625rem] font-medium text-white">
                        <span
                          aria-hidden
                          className={cn("size-2 shrink-0 rounded-full", accents[entry.accent].fill)}
                        />
                        {entry.a}
                      </p>
                    </li>
                  ))}
              </ul>

              <div className="mt-auto flex items-center gap-3 border-t border-white/10 pt-5">
                <MascotStill state="explorer" size="sm" className="shrink-0" />
                <p className="text-[0.875rem] leading-snug text-white/65">
                  The budget knows what the events cost. The events know who&rsquo;s going.
                  That&rsquo;s the whole idea.
                </p>
              </div>
            </ProductPanel>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
