import { Clock, Flame, Gift, MapPin, UsersRound, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { accents } from "@/components/ui/accent";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, SampleTag, Section } from "@/components/ui/primitives";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import { rightNowItems, type RightNowItem } from "@/data/brain";
import { cn } from "@/lib/utils";

const ICON: Record<RightNowItem["kind"], LucideIcon> = {
  starting: Clock,
  free: Gift,
  food: UtensilsCrossed,
  people: UsersRound,
  trending: Flame,
  study: MapPin,
};

/**
 * ============================================================================
 * RIGHT NOW
 * ----------------------------------------------------------------------------
 * Urgency without the dark pattern. Every line here is a real thing with a
 * time attached — "starting in 30 minutes" is a fact about a listing, not
 * "3 people are looking at this deal". No countdown, no invented scarcity, and
 * the sample marker sits on top of the grid rather than hiding under it.
 * ============================================================================
 */
export function RightNow() {
  return (
    <Section id="right-now" tone="paper">
      <div className="page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow index="13">Right now</Eyebrow>
            <h2 className="mt-4 max-w-2xl text-display-md text-ink-950">
              What&rsquo;s happening right now?
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
              The screen for the twenty minutes between finishing something and deciding what to do
              next. {rightNowItems.length} things, each already under way or about to be.
            </p>
          </div>
          <SampleTag />
        </div>

        <RevealGroup step={0.04} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rightNowItems.map((item) => {
            const Icon = ICON[item.kind];
            const accent = accents[item.accent];
            return (
              <RevealItem key={item.title}>
                <div className="flex h-full items-start gap-3 rounded-xl bg-white p-4 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      accent.soft,
                      accent.text,
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block font-mono text-[0.625rem] uppercase tracking-[0.1em]",
                        accent.text,
                      )}
                    >
                      {item.label}
                    </span>
                    <span className="mt-1 block text-[0.9375rem] font-semibold text-ink-950">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] text-ink-500">{item.meta}</span>
                  </span>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink href="/get-started?intent=right-now" variant="primary">
            See your city right now
          </ButtonLink>
          <span className="text-[0.8125rem] text-ink-400">
            Nothing here counts down at you. If it has ended, it leaves.
          </span>
        </div>
      </div>
    </Section>
  );
}
