"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Circle } from "lucide-react";
import { useState } from "react";

import { MascotStill } from "@/components/mascot/mascot";
import { ButtonLink } from "@/components/ui/button";
import { Meter, SampleTag, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { missionTemplates } from "@/config/missions";
import { defaultCity } from "@/data/cities";
import { missionPreview, moneyIn } from "@/services/ai/demo-planner";
import { duration, ease } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

const OPEN_BY_DEFAULT = "weekend-under-30";

/**
 * ============================================================================
 * SMART MISSIONS
 * ----------------------------------------------------------------------------
 * The difference between a recommendation and a plan. A mission is an ordered,
 * priced set of steps built from rows that exist in the city — a free museum,
 * a €7 lunch, a football group — with a budget that adds up and a bar that
 * fills as you do it.
 *
 * The prices here come from the selected city's anchors through
 * `missionPreview`, so "Weekend under €30" is a real €30 rather than a
 * headline with a rounding error under it.
 * ============================================================================
 */
export function MissionsSection() {
  const reduced = useReducedMotion();
  const [openKey, setOpenKey] = useState(OPEN_BY_DEFAULT);

  const where = moneyIn(defaultCity);
  const preview = missionPreview(openKey, defaultCity.slug);
  const done = preview?.steps.filter((step) => step.done).length ?? 0;
  const progress = preview && preview.steps.length > 0 ? (done / preview.steps.length) * 100 : 0;

  return (
    <Section id="missions" tone="tint">
      <div className="page">
        <SectionHeader
          eyebrow="Smart Missions"
          eyebrowIndex="11"
          title="Don't just get recommendations. Get a plan."
          lead="Ten missions that turn a vague week into an ordered, priced list of things to actually do — each step built from a real place, event or group in your city."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-8">
          {/* ---- the catalogue ------------------------------------------------ */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 no-scrollbar edge-fade-x lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {missionTemplates.map((template) => {
              const active = template.key === openKey;
              return (
                <button
                  key={template.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setOpenKey(template.key);
                    track("demo_tab_changed", { mission: template.key });
                  }}
                  className={cn(
                    "flex w-56 shrink-0 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors lg:w-full",
                    active
                      ? "border-transparent bg-ink-950 text-paper shadow-[var(--shadow-float)]"
                      : "border-ink-200 bg-white text-ink-800 hover:border-ink-300",
                  )}
                >
                  <span aria-hidden className="text-lg leading-none">
                    {template.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-medium">
                      {template.title}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-xs",
                        active ? "text-paper/60" : "text-ink-500",
                      )}
                    >
                      {template.tagline}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* ---- the expanded mission ---------------------------------------- */}
          <Reveal delay={0.05}>
            {preview ? (
              <motion.div
                key={preview.key}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
                className="rounded-2xl bg-white p-5 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-display-xs text-ink-950">
                      <span aria-hidden className="mr-2">
                        {preview.emoji}
                      </span>
                      {preview.title}
                    </h3>
                    <p className="mt-1 text-[0.9375rem] text-ink-500">{preview.tagline}</p>
                  </div>
                  <SampleTag />
                </div>

                <div className="mt-4">
                  <Meter value={progress} accent="signal" label="Mission progress" />
                  <p className="mt-2 text-xs text-ink-400">
                    <span className="tnum">
                      {done} of {preview.steps.length}
                    </span>{" "}
                    steps done in this sample
                  </p>
                </div>

                <ul className="mt-4 flex flex-col">
                  {preview.steps.map((step, index) => (
                    <motion.li
                      key={step.label}
                      initial={reduced ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { delay: index * 0.04, duration: duration.base, ease: ease.out }
                      }
                      className="flex items-center gap-3 border-b border-ink-100 py-2.5 last:border-b-0"
                    >
                      {step.done ? (
                        <Check className="size-4 shrink-0 text-mint-deep" aria-hidden />
                      ) : (
                        <Circle className="size-4 shrink-0 text-ink-300" aria-hidden />
                      )}
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[0.9375rem]",
                          step.done ? "text-ink-500 line-through" : "text-ink-900",
                        )}
                      >
                        {step.label}
                      </span>
                      <span
                        className={cn(
                          "tnum shrink-0 font-mono text-[0.9375rem] font-medium",
                          step.price === 0 ? "text-mint-deep" : "text-ink-950",
                        )}
                      >
                        {step.price === 0 ? "Free" : money(step.price, where)}
                      </span>
                    </motion.li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-paper-2 px-4 py-3">
                  <span className="font-mono text-micro uppercase tracking-[0.12em] text-ink-500">
                    Total
                  </span>
                  <span className="flex items-center gap-3">
                    {preview.budget !== null ? (
                      <span className="tnum rounded-full bg-mint-soft px-2.5 py-1 text-xs font-medium text-mint-deep">
                        budget {money(preview.budget, where)}
                      </span>
                    ) : null}
                    <span className="tnum font-mono text-xl font-semibold text-ink-950">
                      {money(preview.total, where)}
                    </span>
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <ButtonLink href="/get-started?intent=mission" variant="signal" size="sm">
                    Start
                  </ButtonLink>
                  {[
                    { label: "Share", intent: "mission-share" },
                    { label: "Invite friend", intent: "mission-invite" },
                    { label: "Make cheaper", intent: "mission-cheaper" },
                    { label: "Make more social", intent: "mission-social" },
                  ].map((action) => (
                    <ButtonLink
                      key={action.intent}
                      href={`/get-started?intent=${action.intent}`}
                      variant="outline"
                      size="sm"
                    >
                      {action.label}
                    </ButtonLink>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2.5 border-t border-ink-100 pt-4">
                  <MascotStill state="explorer" size="sm" />
                  <p className="text-[0.875rem] text-ink-600">
                    A step the city cannot fill is dropped, never invented.
                  </p>
                </div>
              </motion.div>
            ) : null}
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
