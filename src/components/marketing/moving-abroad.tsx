import { ArrowDown } from "lucide-react";

import { DoodleBubble } from "@/components/brand/doodles";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * MOVING ABROAD — the problem, in the student's own words
 * ----------------------------------------------------------------------------
 * The one section on the page that sells nothing. It exists because the
 * product is hard to value until you remember the feeling of week one, and a
 * visitor who has had that week recognises themselves in these seven lines
 * faster than in any feature list.
 *
 * They are written as questions rather than pain points because that is
 * literally what they are: the things you type into a search bar at 21:00 in a
 * city you moved to on Sunday, and get a listicle back.
 *
 * The mascot appears exactly once, at the turn, where he answers the last
 * question — which is the whole transition into the product.
 * ============================================================================
 */

const QUESTIONS: readonly { text: string; tone: string; rotate: string }[] = [
  { text: "Where do students actually eat?", tone: "bg-white text-ink-800", rotate: "-rotate-[1.2deg]" },
  { text: "Why is everything so expensive here?", tone: "bg-pulse-soft text-pulse-deep", rotate: "rotate-[0.8deg]" },
  { text: "What is even happening tonight?", tone: "bg-white text-ink-800", rotate: "rotate-[1.4deg]" },
  { text: "How do I meet anyone in week two?", tone: "bg-flow-soft text-flow-deep", rotate: "-rotate-[0.9deg]" },
  { text: "Which supermarket is the cheap one?", tone: "bg-white text-ink-800", rotate: "rotate-[0.6deg]" },
  { text: "Can I afford to go out this weekend?", tone: "bg-amber-soft text-amber-deep", rotate: "-rotate-[1.5deg]" },
  { text: "Why did nobody tell me about that?", tone: "bg-white text-ink-800", rotate: "rotate-[1deg]" },
];

export function MovingAbroad() {
  return (
    <Section id="moving" tone="warm" className="overflow-hidden">
      <div className="page">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow index="01" className="justify-center">
              The first month
            </Eyebrow>
            <h2 className="mt-4 text-display-md text-ink-950">
              Moving somewhere new is the fun part.
              <br />
              <span className="text-ink-400">Working everything out is not.</span>
            </h2>
          </div>
        </Reveal>

        {/* ---- the questions ------------------------------------------------
            Laid out as a loose scatter rather than a grid. A tidy three-column
            arrangement of these would read as a feature list, which is exactly
            the wrong register: this is the noise in your head in week one. */}
        <RevealGroup
          step={0.05}
          className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-3 sm:gap-4"
        >
          {QUESTIONS.map((question) => (
            <RevealItem key={question.text}>
              <p
                className={cn(
                  "inline-flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[0.9375rem] font-medium",
                  "shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6",
                  question.tone,
                  question.rotate,
                )}
              >
                <DoodleBubble className="size-4 shrink-0 opacity-40" />
                {question.text}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* ---- the turn ----------------------------------------------------- */}
        <Reveal delay={0.1}>
          <div className="mt-14 flex flex-col items-center">
            <ArrowDown className="size-5 text-ink-300" aria-hidden />

            <div className="mt-8 flex max-w-xl flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
              <MascotArt state="social" className="size-20 shrink-0 sm:size-24" />
              <div>
                <p className="text-display-xs text-ink-950">
                  Every one of these has an answer. Someone in your city already knows it.
                </p>
                <p className="mt-3 leading-relaxed text-ink-600">
                  {brand.name} is where that gets written down — and where the AI reads it before it
                  answers you.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
