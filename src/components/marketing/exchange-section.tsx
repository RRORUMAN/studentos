"use client";

import { motion, useReducedMotion } from "motion/react";
import { BadgeCheck, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, SampleTag, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { exchangeLanes, exchangeListings, safeMeetupLine, type ExchangeLane } from "@/data/social";
import { duration, ease } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * STUDENT EXCHANGE
 * ----------------------------------------------------------------------------
 * Every June a city's worth of desks, bikes and kitchen sets goes into a skip,
 * and every September the next intake buys them new. The Exchange is that
 * mismatch, fixed — and because it puts strangers in the same room, it is the
 * one section on the page designed around trust rather than delight:
 * verification, a university, a public meeting place, and no home addresses.
 * ============================================================================
 */
export function ExchangeSection() {
  const reduced = useReducedMotion();
  const [lane, setLane] = useState<ExchangeLane | null>(null);

  const visible = exchangeListings.filter((listing) => (lane ? listing.lane === lane : true));

  return (
    <Section id="exchange" tone="warm">
      <div className="page">
        <SectionHeader
          eyebrow="Student Exchange"
          eyebrowIndex="13"
          title="Students leaving have what new students need."
          lead="Buy and sell, borrow, ask for help, split a ride, give things away. Between verified students at universities in your city — not with the whole internet."
        />

        <div className="mt-8 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar edge-fade-x">
          <Chip accent="mint" active={lane === null} onClick={() => setLane(null)}>
            Everything
          </Chip>
          {exchangeLanes.map((option) => (
            <Chip
              key={option.key}
              accent="mint"
              active={lane === option.key}
              count={exchangeListings.filter((listing) => listing.lane === option.key).length}
              onClick={() => {
                const next = lane === option.key ? null : option.key;
                setLane(next);
                track("pulse_filter_changed", { lane: next ?? "all" });
              }}
            >
              {option.label}
            </Chip>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((listing, index) => (
            <motion.article
              key={listing.id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { delay: Math.min(index, 5) * 0.04, duration: duration.base, ease: ease.out }
              }
              className="flex flex-col rounded-2xl bg-white p-4 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.1em]",
                    listing.type === "offer"
                      ? "bg-mint-soft text-mint-deep"
                      : "bg-flow-soft text-flow-deep",
                  )}
                >
                  {listing.type === "offer" ? "Offer" : "Request"}
                </span>
                <span
                  className={cn(
                    "tnum shrink-0 font-mono text-[0.9375rem] font-semibold",
                    listing.price === 0 ? "text-mint-deep" : "text-ink-950",
                  )}
                >
                  {listing.price === null ? "—" : listing.price === 0 ? "Free" : money(listing.price)}
                </span>
              </div>

              <h3 className="mt-2.5 text-[0.9375rem] font-semibold text-ink-950">{listing.title}</h3>
              <p className="mt-1 text-[0.8125rem] leading-snug text-ink-600">{listing.note}</p>

              <div className="mt-3 flex items-center gap-2 border-t border-ink-100 pt-3">
                <Avatar initials={listing.initials} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-xs font-medium text-ink-700">
                    {listing.university}
                    {listing.verified ? (
                      <BadgeCheck className="size-3.5 shrink-0 text-mint-deep" aria-label="Verified student" />
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1 text-[0.6875rem] text-ink-400">
                    <MapPin className="size-3" aria-hidden />
                    {listing.area}
                  </span>
                </span>
              </div>
            </motion.article>
          ))}
        </div>

        <Reveal delay={0.05} className="mt-8">
          <div className="flex flex-col gap-4 rounded-2xl border border-ink-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-3 text-[0.875rem] leading-relaxed text-ink-600">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-mint-deep" aria-hidden />
              {safeMeetupLine}
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <SampleTag />
              <ButtonLink href="/get-started?intent=exchange" variant="primary" size="sm">
                Browse your city
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
