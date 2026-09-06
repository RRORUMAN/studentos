"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Inbox, Lock, Radio } from "lucide-react";
import { useMemo, useState } from "react";

import { AppSurface } from "@/components/product/app-surface";
import { LoopPostCard } from "@/components/product/loop-post-card";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Avatar } from "@/components/ui/primitives";
import { brand } from "@/brand/brand.config";
import { campusesForCity, getCity } from "@/data/cities";
import { chatForCity } from "@/data/chat";
import { loopForCity, loopSummaries } from "@/data/loop";
import { duration, ease } from "@/lib/motion";
import { ago, cn } from "@/lib/utils";
import { track } from "@/services/analytics";

type Tab = "trending" | "new" | "chat";

const TABS: readonly { key: Tab; label: string }[] = [
  { key: "trending", label: "Trending today" },
  { key: "new", label: "New" },
  { key: "chat", label: "City chat" },
];

/**
 * ============================================================================
 * STUDENT PULSE
 * ----------------------------------------------------------------------------
 * The whole differentiator in one component: a city feed, campus filters, an
 * AI summary that cites how many posts it read, and a live chat room.
 *
 * Filtering, tabs and voting are all real. The empty state matters as much as
 * the full one — filter down to a campus with nothing in it and you get a
 * useful screen, not a blank box.
 * ============================================================================
 */
export function LoopFeed({
  citySlug,
  limit,
  className,
}: {
  citySlug: string;
  limit?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<Tab>("trending");
  const [campus, setCampus] = useState<string | null>(null);

  const city = getCity(citySlug);
  const campuses = campusesForCity(citySlug);
  const summary = loopSummaries[citySlug];
  const chat = chatForCity(citySlug);

  const posts = useMemo(() => {
    const all = loopForCity(citySlug);
    const ordered =
      tab === "new" ? [...all].sort((a, b) => a.postedMinutesAgo - b.postedMinutesAgo) : all;
    const filtered = campus
      ? ordered.filter((post) => post.author.campusSlug === campus)
      : ordered;
    return limit ? filtered.slice(0, limit) : filtered;
  }, [citySlug, tab, campus, limit]);

  const activeCampus = campuses.find((item) => item.slug === campus);

  return (
    <AppSurface
      title={`${city?.name ?? "Your city"} ${brand.surfaces.loop}`}
      meta={`${campuses.length} campuses · ${loopForCity(citySlug).length} posts in this sample`}
      live
      className={className}
      bodyClassName="p-0 sm:p-0"
    >
      {/* ---- tabs -------------------------------------------------------- */}
      <div
        role="tablist"
        aria-label="Pulse views"
        className="flex gap-1 border-b border-white/8 px-3 sm:px-4"
      >
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => {
                setTab(item.key);
                track("pulse_filter_changed", { tab: item.key, citySlug });
              }}
              className={cn(
                "relative px-3 py-3 text-sm font-medium transition-colors",
                active ? "text-white" : "text-white/45 hover:text-white/75",
              )}
            >
              {item.label}
              {active ? (
                <motion.span
                  layoutId={`pulse-tab-${citySlug}`}
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-signal"
                  transition={reduced ? { duration: 0 } : { duration: 0.24, ease: ease.out }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "chat" ? (
        <ChatRoom citySlug={citySlug} messages={chat} />
      ) : (
        <>
          {/* ---- AI summary ---------------------------------------------- */}
          {summary ? (
            <div className="border-b border-white/8 bg-signal/[0.06] px-4 py-4 sm:px-5">
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-signal">
                What {city?.name ?? "students"} students are talking about
              </p>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-white/75">{summary.body}</p>
              <p className="mt-2.5 text-xs text-white/35">
                Written from {summary.sourceCount} posts in the last 24 hours. It summarises the
                community, it does not add facts of its own.
              </p>
            </div>
          ) : null}

          {/* ---- campus filter ------------------------------------------- */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-white/8 px-4 py-3 no-scrollbar edge-fade-x sm:px-5">
            <Chip
              onDark
              accent="signal"
              active={campus === null}
              onClick={() => setCampus(null)}
            >
              All campuses
            </Chip>
            {campuses.map((item) => (
              <Chip
                key={item.slug}
                onDark
                accent="signal"
                active={campus === item.slug}
                onClick={() => {
                  setCampus(campus === item.slug ? null : item.slug);
                  track("pulse_filter_changed", { campus: item.slug, citySlug });
                }}
              >
                {item.shortName}
              </Chip>
            ))}
          </div>

          {/* ---- feed ---------------------------------------------------- */}
          <div className="flex flex-col gap-2.5 px-4 py-4 sm:px-5">
            <AnimatePresence mode="popLayout" initial={false}>
              {posts.length > 0 ? (
                posts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    layout={!reduced}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { duration: duration.base, ease: ease.out, delay: index * 0.03 }
                    }
                  >
                    <LoopPostCard post={post} />
                  </motion.div>
                ))
              ) : (
                <motion.div
                  key="empty"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/12 px-6 py-10 text-center"
                >
                  <Inbox className="size-6 text-white/25" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-white">
                      Nothing from {activeCampus?.shortName ?? "this campus"} yet
                    </p>
                    <p className="mt-1 text-[0.8125rem] text-white/45">
                      A campus feed starts the day someone posts to it. That is usually the person
                      reading this.
                    </p>
                  </div>
                  <ButtonLink href="/get-started" variant="signal" size="sm">
                    Start this campus feed
                  </ButtonLink>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </AppSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* City chat                                                                   */
/* -------------------------------------------------------------------------- */

function ChatRoom({
  citySlug,
  messages,
}: {
  citySlug: string;
  messages: readonly {
    id: string;
    handle: string;
    initials: string;
    campus: string;
    minutesAgo: number;
    text: string;
  }[];
}) {
  const reduced = useReducedMotion();
  const city = getCity(citySlug);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5 sm:px-5">
        <Radio className="size-3.5 text-pulse" aria-hidden />
        <p className="text-xs text-white/50">
          {city?.name} city chat · open to every student in the city
        </p>
      </div>

      {messages.length === 0 ? (
        <div className="px-4 py-10 text-center sm:px-5">
          <p className="text-sm font-medium text-white">This room has not opened yet</p>
          <p className="mx-auto mt-1 max-w-xs text-[0.8125rem] text-white/45">
            City chat opens once there are enough students in {city?.name} to make it worth reading.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          {messages.map((message, index) => (
            <motion.li
              key={message.id}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={reduced ? { duration: 0 } : { delay: index * 0.05, duration: 0.3 }}
              className="flex gap-2.5"
            >
              <Avatar initials={message.initials} size="xs" className="mt-0.5" />
              <div className="min-w-0">
                <p className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-white/80">{message.handle}</span>
                  <span className="text-white/30">{message.campus}</span>
                  <span className="tnum text-white/25">{ago(message.minutesAgo)}</span>
                </p>
                <p className="mt-0.5 text-[0.875rem] leading-relaxed text-white/70">
                  {message.text}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3 border-t border-white/8 px-4 py-3 sm:px-5">
        <Lock className="size-3.5 shrink-0 text-white/30" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[0.8125rem] text-white/40">
          Only students in this city can post here.
        </p>
        <ButtonLink
          href="/get-started"
          size="sm"
          variant="onDark"
          onClick={() => track("cta_clicked", { location: "pulse-chat" })}
        >
          Join to post
        </ButtonLink>
      </div>
    </div>
  );
}
