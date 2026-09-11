"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeftRight,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  Languages,
  LifeBuoy,
  Luggage,
  Radar,
  Target,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ComponentType, type KeyboardEvent } from "react";

import { BrandMark } from "@/components/brand/logo";
import { AnyoneDownDemo } from "@/components/marketing/demos/anyone-down";
import { ArrivalDemo } from "@/components/marketing/demos/arrival";
import { EventRadarDemo } from "@/components/marketing/demos/event-radar";
import { ExchangeDemo } from "@/components/marketing/demos/exchange";
import { LanguageDemo } from "@/components/marketing/demos/language";
import { LifeOpsDemo } from "@/components/marketing/demos/lifeops";
import { MissionsDemo } from "@/components/marketing/demos/missions";
import { SurvivalDemo } from "@/components/marketing/demos/survival";
import { WorkDemo } from "@/components/marketing/demos/work";
import { accents, type Accent } from "@/components/ui/accent";
import { ButtonLink } from "@/components/ui/button";
import { Atmosphere, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { packs } from "@/data/language";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * THE PLATFORM WINDOW
 * ----------------------------------------------------------------------------
 * Nine product surfaces used to be nine full-height sections, one after the
 * other, each with its own header, its own demo and its own button. The page
 * read as a feature list twenty screens long, and a visitor who wanted Arrival
 * had to scroll past Work, Language and LifeOps to find it.
 *
 * They now live in one window, drawn the way the product is: a sidebar of
 * tools grouped by what a student is trying to do, and a pane that runs the
 * real interactive demo for whichever one is open. The demos are unchanged
 * mechanisms — the same seeded rows, the same arithmetic, the same sample
 * markers — only the frame around them is new.
 *
 * ---------------------------------------------------------------------------
 * THE ANCHORS STILL WORK
 *
 * The nav panel and the footer link to `/#events`, `/#missions`, `/#arrival`
 * and so on. Each tab button carries that id, so the browser scrolls to it,
 * and the effect below selects the matching tab — from the hash on load, on
 * `hashchange`, and on any click on an in-page link (Next's router pushes same
 * page hashes with `pushState`, which never fires `hashchange`).
 * ============================================================================
 */

type Group = "Go out" | "Money" | "Settle in" | "Your week";

type Tool = {
  /** Doubles as the element id the rest of the site links to. */
  key: string;
  group: Group;
  label: string;
  /** One line in the sidebar, under the label. */
  hint: string;
  icon: LucideIcon;
  accent: Accent;
  title: string;
  lead: string;
  points: readonly string[];
  cta: { label: string; href: string };
  /** A tier fact, only where pricing already states it. */
  note?: string;
  Demo: ComponentType;
};

const GROUPS: readonly Group[] = ["Go out", "Money", "Settle in", "Your week"];

const TOOLS: readonly Tool[] = [
  {
    key: "events",
    group: "Go out",
    label: "Events",
    hint: "Tonight, free, under €10",
    icon: Radar,
    accent: "amber",
    title: "What's actually happening tonight?",
    lead: "Filtered the way students decide — tonight, free, cheap, on campus — with the reason it is on your radar written on the card.",
    points: [
      "Price, time, distance and who's going on every card",
      "Going, Save, Share and Anyone Down? built in",
      "When it has ended, it leaves. Nothing counts down at you.",
    ],
    cta: { label: "Find events", href: "/get-started?intent=events" },
    note: "Free, permanently.",
    Demo: EventRadarDemo,
  },
  {
    key: "anyone-down",
    group: "Go out",
    label: brand.surfaces.anyoneDown,
    hint: "Find people to go with",
    icon: UsersRound,
    accent: "pulse",
    title: "Find something. Find people. Go.",
    lead: "Turn any event, place or plan into a question your city can answer. People join, a group opens, and the plan is already in the chat.",
    points: [
      "Post the plan, not yourself — no friend requests",
      "Open to your city and campus, so it works in week one",
      "The group closes after the plan, unless everyone stays",
    ],
    cta: { label: "Find people this week", href: "/get-started?intent=anyone-down" },
    note: "Free on every tier.",
    Demo: AnyoneDownDemo,
  },
  {
    key: "missions",
    group: "Go out",
    label: "Missions",
    hint: "Priced plans, not tips",
    icon: Target,
    accent: "signal",
    title: "Don't get tips. Get a game plan.",
    lead: "Ten missions — a weekend under budget, your first week, making money last — turned into ordered, priced steps from real places in your city.",
    points: [
      "Priced from your city's own anchors",
      "Make it cheaper or more social in one tap",
      "A step the city can't fill is dropped, never invented",
    ],
    cta: { label: "Start a mission", href: "/get-started?intent=mission" },
    note: "Free, permanently.",
    Demo: MissionsDemo,
  },
  {
    key: "survival",
    group: "Money",
    label: "Survival Mode",
    hint: "Make what's left last",
    icon: LifeBuoy,
    accent: "signal",
    title: "Low on money? Get a plan, not a warning.",
    lead: "Say what you have and how long it has to last. It splits it into food, transport and a buffer — and finds what is genuinely free.",
    points: [
      "Rows always add up to exactly what you have",
      "Free things count as free, not as a gap",
      "Honest when the money doesn't stretch",
    ],
    cta: { label: "Build my survival plan", href: "/get-started?intent=survival" },
    note: "Included from Plus.",
    Demo: SurvivalDemo,
  },
  {
    key: "work",
    group: "Money",
    label: "Work",
    hint: "Jobs that fit your timetable",
    icon: Briefcase,
    accent: "mint",
    title: "Spend smarter. Earn smarter.",
    lead: "Part-time jobs, gigs and paid projects that fit your timetable, your languages and your city — ranked, with the reasons attached.",
    points: [
      "A fit score that shows its working",
      "“Pay not stated” when it isn't — a wage is never guessed",
      "Work-hour rules link to your country's own authority",
    ],
    cta: { label: "Find student work", href: "/get-started?intent=work" },
    Demo: WorkDemo,
  },
  {
    key: "arrival",
    group: "Settle in",
    label: brand.surfaces.arrival,
    hint: "First two weeks, in order",
    icon: Luggage,
    accent: "amber",
    title: "Just landed? Start here.",
    lead: "The first two weeks in the order things block each other — so the appointment that takes three weeks to book is the thing you do first.",
    points: [
      "Before arrival, first day, first week, first month",
      "Official items link to the primary source",
      "Waiting for you, in local currency, the day you land",
    ],
    cta: { label: "Plan my arrival", href: "/get-started?intent=arrival" },
    note: "Free, permanently.",
    Demo: ArrivalDemo,
  },
  {
    key: "language",
    group: "Settle in",
    label: "Speak Local",
    hint: "The phrases you'll use",
    icon: Languages,
    accent: "flow",
    title: "Speak enough to live better.",
    lead: "Not a course. The phrases you need at the till, the table and the pharmacy — with the local detail nobody writes down.",
    points: [
      "Real phrases for real situations",
      "The local note a phrasebook doesn't have",
      `${packs.length} languages — each says how complete it is`,
    ],
    cta: { label: "Get started free", href: "/get-started" },
    Demo: LanguageDemo,
  },
  {
    key: "exchange",
    group: "Settle in",
    label: "Exchange",
    hint: "Buy, borrow, share a ride",
    icon: ArrowLeftRight,
    accent: "mint",
    title: "Students leaving have what you need.",
    lead: "Sell, borrow, ask for help, split a ride, give things away — between verified students in your city, not the whole internet.",
    points: [
      "Offers and requests, in five lanes",
      "Verified students and public meeting places",
      "Home addresses are never shown",
    ],
    cta: { label: "Browse your city", href: "/get-started?intent=exchange" },
    Demo: ExchangeDemo,
  },
  {
    key: "lifeops",
    group: "Your week",
    label: "LifeOps",
    hint: "Your week, one timeline",
    icon: CalendarClock,
    accent: "flow",
    title: "Everything you need to remember. On one line.",
    lead: "Classes, deadlines, arrival tasks, plans and payments that repeat — one timeline that changes shape as your year does.",
    points: [
      "Complete, snooze or reschedule in a tap",
      "Add any of it to your calendar",
      "Every planned day shows what it costs",
    ],
    cta: { label: "Put my week in one place", href: "/get-started?intent=lifeops" },
    note: "Free, permanently.",
    Demo: LifeOpsDemo,
  },
];

const DEFAULT_KEY = "events";

function toolFor(key: string): Tool | undefined {
  return TOOLS.find((tool) => tool.key === key);
}

export function PlatformExplorer() {
  const reduced = useReducedMotion();
  const [activeKey, setActiveKey] = useState(DEFAULT_KEY);
  const tool = toolFor(activeKey) ?? TOOLS[0];
  const index = TOOLS.indexOf(tool);

  /* Follow the hash. See the header for why a click listener is needed too. */
  useEffect(() => {
    const pick = (href: string) => {
      const key = href.slice(href.indexOf("#") + 1);
      if (href.includes("#") && toolFor(key)) setActiveKey(key);
    };
    const frame = window.requestAnimationFrame(() => pick(window.location.hash));
    const onHash = () => pick(window.location.hash);
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href*='#']");
      if (anchor) pick(anchor.getAttribute("href") ?? "");
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, []);

  function select(key: string) {
    setActiveKey(key);
    track("demo_tab_changed", { tool: key });
  }

  /* Arrow keys move between tools, as a tablist should. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    let next: Tool | undefined;
    if (step !== 0) next = TOOLS[(index + step + TOOLS.length) % TOOLS.length];
    else if (event.key === "Home") next = TOOLS[0];
    else if (event.key === "End") next = TOOLS[TOOLS.length - 1];
    if (!next) return;
    event.preventDefault();
    select(next.key);
    document.getElementById(next.key)?.focus();
  }

  const accent = accents[tool.accent];
  const Icon = tool.icon;
  const Demo = tool.Demo;

  return (
    <Section id="platform" tone="paper" className="overflow-hidden">
      <Atmosphere
        grain={false}
        blobs={[{ className: "top-[20%] left-[-12rem] size-[30rem] bg-signal/14", drift: "b" }]}
      />

      <div className="page relative">
        <SectionHeader
          align="center"
          eyebrow="The rest of the OS"
          eyebrowIndex="06"
          title={
            <>
              Nine more things it <span className="underline-sketch">quietly handles</span>.
            </>
          }
          lead="They share one budget, one calendar and one city — so the events know what you can afford, and the plan already knows who's going."
        />

        <Reveal className="mt-12">
          <div className="overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-glass)] ring-1 ring-ink-950/8">
            {/* ---- title bar -------------------------------------------------- */}
            <div className="flex items-center gap-3 border-b border-ink-100 bg-paper/70 px-4 py-2.5">
              <span aria-hidden className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-ink-200" />
                <span className="size-2.5 rounded-full bg-ink-200" />
                <span className="size-2.5 rounded-full bg-ink-200" />
              </span>
              <p className="flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate font-mono text-xs text-ink-500">
                <BrandMark className="size-3.5 shrink-0 text-ink-950" />
                <span className="truncate">
                  {brand.name.toLowerCase()} / {tool.group.toLowerCase()} /{" "}
                  <span className="text-ink-950">{tool.label.toLowerCase()}</span>
                </span>
              </p>
              <span className="tnum hidden font-mono text-micro text-ink-400 sm:block">
                {index + 1}/{TOOLS.length}
              </span>
            </div>

            <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
              {/* ---- sidebar ---------------------------------------------------- */}
              <div
                role="tablist"
                aria-label="StudentOS tools"
                aria-orientation="vertical"
                onKeyDown={onKeyDown}
                className="flex gap-1 overflow-x-auto border-b border-ink-100 p-2 no-scrollbar lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:bg-paper/50 lg:p-3"
              >
                {GROUPS.map((group) => (
                  <div key={group} role="presentation" className="contents lg:block lg:pb-2">
                    <p
                      role="presentation"
                      className="hidden px-2.5 pt-2 pb-1.5 font-mono text-micro uppercase tracking-[0.14em] text-ink-400 lg:block"
                    >
                      {group}
                    </p>
                    {TOOLS.filter((entry) => entry.group === group).map((entry) => {
                      const active = entry.key === tool.key;
                      const a = accents[entry.accent];
                      const EntryIcon = entry.icon;
                      return (
                        <button
                          key={entry.key}
                          id={entry.key}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          aria-controls="platform-panel"
                          tabIndex={active ? 0 : -1}
                          onClick={() => select(entry.key)}
                          className={cn(
                            "flex shrink-0 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors lg:w-full",
                            active
                              ? "bg-ink-950 text-paper shadow-[var(--shadow-raise)]"
                              : "text-ink-700 hover:bg-ink-100/70 hover:text-ink-950",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-8 shrink-0 place-items-center rounded-lg",
                              active ? cn(a.fill, a.onFill) : cn(a.soft, a.text),
                            )}
                          >
                            <EntryIcon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 pr-1">
                            <span className="block text-[0.875rem] font-medium whitespace-nowrap">
                              {entry.label}
                            </span>
                            <span
                              className={cn(
                                "hidden truncate text-xs lg:block",
                                active ? "text-paper/55" : "text-ink-500",
                              )}
                            >
                              {entry.hint}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* ---- pane ------------------------------------------------------- */}
              <div
                role="tabpanel"
                id="platform-panel"
                aria-labelledby={tool.key}
                className="min-w-0 p-5 sm:p-7 lg:min-h-[40rem] lg:p-8"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tool.key}
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
                    className="grid gap-8 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] xl:gap-10"
                  >
                    <div>
                      <p
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-semibold uppercase tracking-[0.08em]",
                          accent.soft,
                          accent.text,
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden />
                        {tool.label}
                      </p>
                      <h3 className="mt-4 text-display-sm text-ink-950">{tool.title}</h3>
                      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-600">
                        {tool.lead}
                      </p>
                      <ul className="mt-5 flex flex-col gap-2.5">
                        {tool.points.map((point) => (
                          <li key={point} className="flex gap-2.5 text-[0.875rem] leading-snug text-ink-700">
                            <Check className="mt-0.5 size-4 shrink-0 text-mint-deep" aria-hidden />
                            {point}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <ButtonLink href={tool.cta.href} variant="primary" size="sm">
                          {tool.cta.label}
                          <ArrowRight className="size-4" aria-hidden />
                        </ButtonLink>
                        {tool.note ? (
                          <span className="text-[0.8125rem] text-ink-500">{tool.note}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <Demo />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>

        <p className="mt-5 text-center text-[0.8125rem] text-ink-500">
          Every demo in this window runs on sample data and says so. In the app, the same screens
          run on your city.
        </p>
      </div>
    </Section>
  );
}
