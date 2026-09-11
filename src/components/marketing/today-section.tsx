import { CalendarClock, PartyPopper, Tag, UserRound, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PhoneFrame } from "@/components/marketing/phone-frame";
import { MascotStill } from "@/components/mascot/mascot";
import { accents } from "@/components/ui/accent";
import { ButtonLink } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { rightNowItems, todayBrief, type BriefLine } from "@/data/brain";
import { safeThisWeek, safeToday } from "@/data/budget";
import { getCity } from "@/data/cities";
import { cn, money } from "@/lib/utils";

const LINE_ICON: Record<BriefLine["kind"], LucideIcon> = {
  events: PartyPopper,
  friend: UserRound,
  deal: Tag,
  task: CalendarClock,
  group: UsersRound,
};

/**
 * ============================================================================
 * TODAY IN STUDENTOS
 * ----------------------------------------------------------------------------
 * The retention argument. Everything else on this page is a thing you can do;
 * this is the thing you open. One greeting, two numbers, five lines — the
 * whole of Home is "what matters today", and the phone frame is the fastest
 * way to say that without a feature list.
 * ============================================================================
 */
export function TodaySection() {
  const city = getCity(todayBrief.citySlug);
  const safe = safeToday();
  const week = safeThisWeek();

  return (
    <Section id="today" tone="paper">
      <div className="page">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
          <div>
            <SectionHeader
              eyebrow="Today"
              eyebrowIndex="02"
              title={<>Open {brand.name}. Know what matters.</>}
              lead="No feed to scroll first. One screen: what your money allows, what's on, what needs doing, and who's already going."
            />

            <ul className="mt-8 flex max-w-lg flex-col gap-4">
              <Point
                title="Two numbers, not a spreadsheet"
                detail="What you can safely spend today, and what is left for the week — both worked out after the charges you already know are coming."
              />
              <Point
                title="One insight, not a dashboard"
                detail="One line about your own spending, on the days it would change what you do."
              />
              <Point
                title="Today for you"
                detail="Events, deals and plans filtered by your budget, your campus and what you actually said yes to before."
              />
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/get-started" variant="primary">
                Get started free
              </ButtonLink>
              <span className="text-[0.8125rem] text-ink-400">Free to join. No card required.</span>
            </div>
          </div>

          <Reveal delay={0.06}>
            <PhoneFrame>
              {/* greeting */}
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                {todayBrief.greeting} · {city?.name ?? "your city"}
              </p>
              <h3 className="mt-1 text-display-xs text-ink-950">My day</h3>

              {/* the two numbers */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="Safe to spend today" value={money(safe)} accent="mint" />
                <Stat label="Safe to spend this week" value={money(week)} accent="flow" />
              </div>

              {/* insight */}
              <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-signal-soft px-3 py-2.5">
                <MascotStill state="budget" size="xs" className="mt-px shrink-0" />
                <p className="text-[0.8125rem] leading-snug text-ink-800">{todayBrief.insight}</p>
              </div>

              {/* daily brief */}
              <p className="mt-4 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                Daily brief
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {todayBrief.lines.map((line) => {
                  const Icon = LINE_ICON[line.kind];
                  const accent = accents[line.accent];
                  return (
                    <li
                      key={line.text}
                      className="flex items-center gap-2.5 rounded-md bg-white px-2.5 py-2 shadow-[var(--shadow-flat)]"
                    >
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-xs",
                          accent.soft,
                          accent.text,
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <span className="text-[0.8125rem] leading-snug text-ink-800">{line.text}</span>
                    </li>
                  );
                })}
              </ul>

              <p className="tnum mt-3 text-[0.6875rem] text-ink-400">
                Right now · {rightNowItems.length} things happening near you
              </p>
            </PhoneFrame>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

function Point({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="border-l-2 border-ink-200 pl-4">
      <p className="text-[0.9375rem] font-semibold text-ink-950">{title}</p>
      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-600">{detail}</p>
    </li>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "mint" | "flow";
}) {
  return (
    <div className="rounded-lg bg-white px-3 py-2.5 shadow-[var(--shadow-flat)]">
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-ink-400">{label}</p>
      <p className={cn("tnum mt-0.5 font-mono text-xl font-semibold", accents[accent].text)}>
        {value}
      </p>
    </div>
  );
}
