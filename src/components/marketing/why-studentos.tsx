import { ArrowDown } from "lucide-react";

import { MascotStill } from "@/components/mascot/mascot";
import { accents } from "@/components/ui/accent";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { whyQuestions } from "@/data/brain";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * WHY STUDENTOS EXISTS
 * ----------------------------------------------------------------------------
 * The only section on the page with no product in it. It is the questions
 * themselves, scattered the way they actually arrive — all at once, in no
 * order, mostly at night — and then one line that collects them.
 *
 * Each question is a rotated card rather than a bullet, because a list of
 * seven bullets reads as a feature table and these are not features. They are
 * the things nobody tells you.
 * ============================================================================
 */
export function WhyStudentOS() {
  return (
    <Section id="why" tone="warm">
      <div className="page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow index="01" className="justify-center">
            Why it exists
          </Eyebrow>
          <h2 className="mt-4 text-display-md text-ink-950">
            Moving abroad is exciting. Figuring everything out isn&rsquo;t.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-600 sm:text-lg">
            Nobody hands you the list. You work it out from group chats, three-year-old forum
            posts and whatever the person next to you happens to know.
          </p>
        </Reveal>

        {/* ---- the cluster --------------------------------------------------- */}
        <RevealGroup
          step={0.05}
          className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-3 sm:gap-4"
        >
          {whyQuestions.map((question) => {
            const accent = accents[question.accent];
            return (
              <RevealItem key={question.text}>
                <p
                  style={{ transform: `rotate(${question.rotate}deg)` }}
                  className={cn(
                    "rounded-xl border bg-white px-4 py-2.5 text-[0.9375rem] font-medium text-ink-800",
                    "shadow-[var(--shadow-raise)] sm:text-base",
                    accent.border,
                  )}
                >
                  <span aria-hidden className={cn("mr-2", accent.text)}>
                    ?
                  </span>
                  {question.text}
                </p>
              </RevealItem>
            );
          })}
        </RevealGroup>

        {/* ---- the collector ------------------------------------------------- */}
        <Reveal delay={0.1} className="mt-12 flex flex-col items-center text-center">
          <ArrowDown className="size-5 text-ink-300" aria-hidden />
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
            <MascotStill state="explorer" size="lg" />
            <p className="max-w-md text-display-xs text-ink-950 sm:text-left">
              {brand.name} brings everything together.
            </p>
          </div>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-600">
            One place that knows your city, your money, your university and your week — and
            answers in one screen instead of ten tabs.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
