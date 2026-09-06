"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, MapPin, MessageSquare, Undo2, Users } from "lucide-react";
import { useState } from "react";

import { AppSurface } from "@/components/product/app-surface";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { brand } from "@/brand/brand.config";
import type { Invite } from "@/data/social";
import { duration, ease, spring } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

type Answer = "none" | "in" | "maybe";

/**
 * ============================================================================
 * ANYONE DOWN?
 * ----------------------------------------------------------------------------
 * The point of the component is the transition: an open invitation with three
 * spaces left becomes a group with a chat, in one tap, without anyone having
 * to be friends first. So the "before" and "after" are the same card.
 * ============================================================================
 */
export function InviteCard({ invite, className }: { invite: Invite; className?: string }) {
  const reduced = useReducedMotion();
  const toast = useToast();
  const [answer, setAnswer] = useState<Answer>("none");

  const confirmed = invite.attendees.filter((person) => person.status === "in");
  const maybes = invite.attendees.filter((person) => person.status === "maybe");
  const inCount = confirmed.length + (answer === "in" ? 1 : 0);
  const spacesLeft = Math.max(0, invite.needs - inCount);
  const formed = answer === "in";

  return (
    <AppSurface
      title={brand.surfaces.anyoneDown}
      meta={`${invite.place} · open to anyone in the city`}
      live={formed}
      className={className}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-display-xs text-white">{invite.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden />
              {invite.when}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {invite.place}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "tnum shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            invite.price === 0 ? "bg-mint/15 text-mint" : "bg-white/8 text-white",
          )}
        >
          {invite.price === 0 ? "Free" : money(invite.price)}
        </span>
      </div>

      {/* ---- roster --------------------------------------------------------- */}
      <div className="mt-5 rounded-lg bg-white/[0.04] p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 font-mono text-micro uppercase tracking-[0.1em] text-white/45">
            <Users className="size-3.5" aria-hidden />
            {formed ? "Group" : "Going"}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={spacesLeft}
              initial={reduced ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
              transition={{ duration: reduced ? 0 : duration.quick }}
              className={cn(
                "tnum text-xs font-medium",
                spacesLeft === 0 ? "text-mint" : "text-signal",
              )}
            >
              {spacesLeft === 0
                ? "Full — the game is on"
                : `Need ${spacesLeft} more ${spacesLeft === 1 ? "person" : "people"}`}
            </motion.span>
          </AnimatePresence>
        </div>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {answer !== "none" ? (
              <motion.li
                key="you"
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                transition={reduced ? { duration: 0 } : spring.bouncy}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1",
                  answer === "in" ? "bg-signal text-ink-950" : "bg-amber/20 text-amber",
                )}
              >
                <Avatar
                  initials="YOU"
                  size="xs"
                  className={answer === "in" ? "bg-ink-950 text-signal" : "bg-amber/30 text-amber"}
                />
                <span className="text-xs font-semibold">
                  You{answer === "maybe" ? " · maybe" : ""}
                </span>
              </motion.li>
            ) : null}
          </AnimatePresence>

          {confirmed.map((person) => (
            <li
              key={person.handle}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/6 py-1 pr-2.5 pl-1"
            >
              <Avatar initials={person.initials} size="xs" />
              <span className="text-xs text-white/70">{person.handle}</span>
            </li>
          ))}

          {maybes.map((person) => (
            <li
              key={person.handle}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/15 py-1 pr-2.5 pl-1"
              title="Answered maybe"
            >
              <Avatar initials={person.initials} size="xs" className="opacity-60" />
              <span className="text-xs text-white/40">{person.handle} · maybe</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- the moment the group exists -------------------------------------- */}
      <AnimatePresence initial={false}>
        {formed ? (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-lg border border-signal/25 bg-signal/[0.07] p-3.5">
              <p className="font-mono text-micro uppercase tracking-[0.1em] text-signal">
                Temporary group created
              </p>
              <div className="mt-2.5 flex gap-2.5">
                <MessageSquare className="mt-0.5 size-4 shrink-0 text-white/40" aria-hidden />
                <p className="text-[0.875rem] leading-relaxed text-white/75">
                  {invite.firstMessage}
                </p>
              </div>
              <p className="mt-2.5 text-xs text-white/40">
                The chat closes after Saturday. Nobody is added to anyone&rsquo;s friends list.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ---- actions ---------------------------------------------------------- */}
      <div className="mt-4 flex flex-wrap gap-2">
        {answer === "none" ? (
          <>
            <Button
              variant="sticker"
              size="md"
              onClick={() => {
                setAnswer("in");
                track("invite_responded", { inviteId: invite.id, response: "in" });
                toast({
                  title: "You're in",
                  description: `${invite.title} · ${invite.when}. Group chat is open.`,
                });
              }}
            >
              I&rsquo;m in
            </Button>
            <Button
              variant="onDarkGhost"
              size="md"
              onClick={() => {
                setAnswer("maybe");
                track("invite_responded", { inviteId: invite.id, response: "maybe" });
                toast({
                  title: "Down as a maybe",
                  description: "We'll nudge you at 14:00 if it is still short.",
                  tone: "info",
                });
              }}
            >
              Maybe
            </Button>
          </>
        ) : (
          <Button variant="onDarkGhost" size="md" onClick={() => setAnswer("none")}>
            <Undo2 className="size-4" aria-hidden />
            Change my answer
          </Button>
        )}
      </div>
    </AppSurface>
  );
}
