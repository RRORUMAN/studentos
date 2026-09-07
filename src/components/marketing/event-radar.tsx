"use client";

import { motion, useReducedMotion } from "motion/react";
import { Footprints, Users } from "lucide-react";
import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { ButtonLink } from "@/components/ui/button";
import { SampleTag, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { eventRadar, radarFilters, radarMatches, type RadarEvent, type RadarFilter } from "@/data/brain";
import { duration, ease } from "@/lib/motion";
import { cn, money, walk } from "@/lib/utils";
import { track } from "@/services/analytics";

/** Each event kind owns a colour and a mark. No stock photos, ever: a photo of
 *  a venue we have not shot is a photo of the wrong venue. */
const KIND_FIELD: Record<RadarEvent["kind"], { from: string; to: string; ink: string; label: string }> = {
  music: { from: "from-pulse/85", to: "to-pulse-deep/70", ink: "text-white", label: "Music" },
  culture: { from: "from-flow/80", to: "to-flow-deep/70", ink: "text-white", label: "Culture" },
  sport: { from: "from-mint/85", to: "to-mint-deep/75", ink: "text-white", label: "Sport" },
  social: { from: "from-amber/90", to: "to-amber-deep/70", ink: "text-ink-950", label: "Social" },
  film: { from: "from-signal/90", to: "to-signal-deep/70", ink: "text-ink-950", label: "Film" },
};

/**
 * ============================================================================
 * EVENT RADAR
 * ----------------------------------------------------------------------------
 * The filters are real. Clicking "Free" filters the same seeded set the cards
 * are drawn from, and the count in the header is derived from the result — a
 * filter rail that does nothing is the fastest way to teach a visitor that the
 * rest of the page is also decoration.
 *
 * Every card carries the four things that decide whether a student goes:
 * price, when, how far, and who else is going.
 * ============================================================================
 */
export function EventRadar() {
  const reduced = useReducedMotion();
  const [filter, setFilter] = useState<RadarFilter | null>("tonight");

  const visible = eventRadar.filter((event) => radarMatches(event, filter));

  return (
    <Section id="events" tone="warm">
      <div className="page">
        <SectionHeader
          eyebrow="Event radar"
          eyebrowIndex="06"
          title="Stop finding out about things after they happened."
          lead="Tonight, free, under €10, on campus, trending. The same event, filtered the way students actually decide — and with the reason it is on your radar written on the card."
        />

        {/* ---- filters ------------------------------------------------------ */}
        <div className="mt-8 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar edge-fade-x">
          {radarFilters.map((option) => (
            <Chip
              key={option.key}
              accent="pulse"
              active={filter === option.key}
              count={eventRadar.filter((event) => radarMatches(event, option.key)).length}
              onClick={() => {
                const next = filter === option.key ? null : option.key;
                setFilter(next);
                track("pulse_filter_changed", { filter: next ?? "all" });
              }}
            >
              {option.label}
            </Chip>
          ))}
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-400">
          <SampleTag />
          <span className="tnum">
            {visible.length} of {eventRadar.length} sample events match
          </span>
        </p>

        {/* ---- cards -------------------------------------------------------- */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((event, index) => {
            const field = KIND_FIELD[event.kind];
            return (
              <motion.article
                key={event.id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { delay: Math.min(index, 5) * 0.04, duration: duration.base, ease: ease.out }
                }
                className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5"
              >
                {/* the field: kind-coloured, abstract, cheap to render */}
                <div
                  className={cn(
                    "relative flex h-24 items-end justify-between gap-2 bg-linear-to-br p-3",
                    field.from,
                    field.to,
                  )}
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 120 60"
                    preserveAspectRatio="none"
                    className="absolute inset-0 size-full opacity-30"
                  >
                    <path
                      d="M0 44c18-6 26-22 44-22s26 18 44 12 24-16 32-18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className={field.ink}
                    />
                    <circle cx="96" cy="16" r="10" fill="currentColor" className={field.ink} opacity="0.5" />
                  </svg>
                  <span
                    className={cn(
                      "relative font-mono text-micro font-semibold uppercase tracking-[0.12em]",
                      field.ink,
                    )}
                  >
                    {field.label}
                  </span>
                  <span
                    className={cn(
                      "tnum relative rounded-full bg-white/85 px-2 py-0.5 font-mono text-xs font-semibold text-ink-950",
                    )}
                  >
                    {event.price === 0 ? "Free" : money(event.price)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <p className="font-mono text-xs text-ink-400">{event.when}</p>
                  <h3 className="mt-1 text-[0.9375rem] font-semibold text-ink-950">{event.title}</h3>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-500">{event.place}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-500">
                    <span className="inline-flex items-center gap-1">
                      <Footprints className="size-3.5 text-ink-400" aria-hidden />
                      <span className="tnum">{walk(event.walkMinutes)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5 text-ink-400" aria-hidden />
                      <span className="tnum">{event.interested} interested</span>
                    </span>
                    {event.friends > 0 ? (
                      <span className="tnum font-medium text-pulse-deep">
                        {event.friends} {event.friends === 1 ? "friend" : "friends"} going
                      </span>
                    ) : null}
                  </div>

                  {event.university ? (
                    <p className="mt-2 inline-flex w-fit rounded-full bg-paper-2 px-2 py-0.5 text-[0.6875rem] font-medium text-ink-600">
                      {event.university}
                      {event.campus ? " · campus" : ""}
                    </p>
                  ) : null}

                  <p className="mt-3 border-t border-ink-100 pt-3 text-[0.8125rem] leading-snug text-ink-600">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-ink-400">
                      Why
                    </span>{" "}
                    {event.why}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>

        <Reveal delay={0.05} className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/get-started?intent=events" variant="primary">
              See what&rsquo;s on this week
            </ButtonLink>
            <span className="text-[0.8125rem] text-ink-400">
              Going, Interested, Save, Share and Anyone Down? on every card in the product.
            </span>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
