"use client";

import { motion, useReducedMotion } from "motion/react";
import { BadgeCheck, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { Avatar, SampleTag } from "@/components/ui/primitives";
import { exchangeLanes, exchangeListings, safeMeetupLine, type ExchangeLane } from "@/data/social";
import { duration, ease } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

const SHOWN = 4;

/**
 * ============================================================================
 * STUDENT EXCHANGE — demo
 * ----------------------------------------------------------------------------
 * Every June a city's worth of desks, bikes and kitchen sets goes into a skip,
 * and every September the next intake buys them new. The Exchange is that
 * mismatch, fixed — and because it puts strangers in the same room, it is the
 * one demo designed around trust rather than delight: verification, a
 * university, a public meeting place, and no home addresses.
 * ============================================================================
 */
export function ExchangeDemo() {
  const reduced = useReducedMotion();
  const [lane, setLane] = useState<ExchangeLane | null>(null);

  const visible = exchangeListings.filter((listing) => (lane ? listing.lane === lane : true));

  return (
    <div className="flex min-w-0 flex-col">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar edge-fade-x">
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {visible.slice(0, SHOWN).map((listing, index) => (
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
                  listing.type === "offer" ? "bg-mint-soft text-mint-deep" : "bg-flow-soft text-flow-deep",
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

            <h4 className="mt-2.5 text-[0.9375rem] font-semibold text-ink-950">{listing.title}</h4>
            <p className="mt-1 text-[0.8125rem] leading-snug text-ink-600">{listing.note}</p>

            <div className="mt-3 flex items-center gap-2 border-t border-ink-100 pt-3">
              <Avatar initials={listing.initials} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-xs font-medium text-ink-700">
                  {listing.university}
                  {listing.verified ? (
                    <BadgeCheck className="size-3.5 shrink-0 text-mint-deep" aria-label="Verified student" />
                  ) : null}
                </span>
                <span className="flex items-center gap-1 text-[0.6875rem] text-ink-500">
                  <MapPin className="size-3" aria-hidden />
                  {listing.area}
                </span>
              </span>
            </div>
          </motion.article>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-mint-soft/60 px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-700">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-mint-deep" aria-hidden />
        <span>
          {safeMeetupLine} <SampleTag className="ml-1 align-middle" />
        </span>
      </p>
    </div>
  );
}
