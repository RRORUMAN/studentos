"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Banknote,
  Compass,
  Loader2,
  MessagesSquare,
  Route,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/logo";
import { AppSurface } from "@/components/product/app-surface";
import { BudgetPanel } from "@/components/product/budget-panel";
import { CityMap } from "@/components/product/city-map";
import { PlanView } from "@/components/product/plan-view";
import { LoopFeed } from "@/components/product/loop-feed";
import { Atmosphere, Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { cities, defaultCity, getCity } from "@/data/cities";
import type { City } from "@/data/types";
import { duration, ease } from "@/lib/motion";
import {
  demoIntents,
  intentMeta,
  moneyIn,
  planFor,
  type DemoIntent,
} from "@/services/ai/demo-planner";
import { cn, currencySymbol, money } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * LIVE DEMO
 * ----------------------------------------------------------------------------
 * Not a video, not a screenshot, not a carousel of screenshots. The visitor
 * drives three real controls — city, question, budget — and the product
 * recomputes in front of them, in that city's own currency.
 *
 * The budget slider is the point. Dragging it does not scale a number: it
 * changes the *plan*. A round of drinks drops out, the sit-down dinner becomes
 * the student portion, and in Berlin and Amsterdam the transport row goes to
 * zero because a student there already holds the ride. That is the whole
 * product argument, made in one gesture, before anyone has signed up.
 *
 * See services/ai/demo-planner.ts: the composer is pure arithmetic over each
 * city's published price anchors, so the demo costs nothing to serve and can
 * never quietly disagree with the numbers printed elsewhere on the site.
 * ============================================================================
 */

type Tab = "plan" | "loop" | "map" | "budget";

const TABS: readonly { key: Tab; label: string; icon: typeof Route }[] = [
  { key: "plan", label: "The plan", icon: Route },
  { key: "loop", label: brand.surfaces.loop, icon: MessagesSquare },
  { key: "map", label: brand.surfaces.discover, icon: Compass },
  { key: "budget", label: brand.surfaces.budget, icon: Banknote },
];

/** Long enough to read as work, short enough never to feel like waiting. */
const RECOMPUTE_MS = 260;

/**
 * Slider geometry for one (city, question) pair.
 *
 * `snap` matters more than it looks: `<input type="range">` quantises whatever
 * you hand it to `min + n*step`, but React state keeps the raw number. Seed the
 * slider with an unsnapped default and the thumb sits at £6 while the label
 * reads £5.60 — the demo's single most visible surface, quietly wrong. So every
 * budget written to state goes through here first.
 */
function budgetGrid(city: City, intent: DemoIntent) {
  const [min, max] = intentMeta(intent).range(city);
  const step = Math.max(1, Math.round((max - min) / 40));
  const snap = (value: number) =>
    Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step));
  return { min, max, step, snap };
}

/** The opening budget for a city and question, already on the step grid. */
function defaultBudgetFor(city: City, intent: DemoIntent) {
  return budgetGrid(city, intent).snap(intentMeta(intent).defaultBudget(city));
}

export function LiveDemo() {
  const reduced = useReducedMotion();

  const [citySlug, setCitySlug] = useState(defaultCity.slug);
  const [intent, setIntent] = useState<DemoIntent>("tonight");
  const [budget, setBudget] = useState(() => defaultBudgetFor(defaultCity, "tonight"));
  const [tab, setTab] = useState<Tab>("plan");
  const [computing, setComputing] = useState(false);

  const city = getCity(citySlug) ?? defaultCity;
  const { min, max, step } = budgetGrid(city, intent);
  const plan = planFor(citySlug, intent, budget);
  const where = moneyIn(city);

  /* A single shared timer: dragging the slider must not queue up one timeout
     per pixel of travel. */
  const recomputeTimer = useRef<number | null>(null);
  const pulse = useCallback(() => {
    if (reduced) return;
    setComputing(true);
    if (recomputeTimer.current) window.clearTimeout(recomputeTimer.current);
    recomputeTimer.current = window.setTimeout(() => setComputing(false), RECOMPUTE_MS);
  }, [reduced]);

  useEffect(
    () => () => {
      if (recomputeTimer.current) window.clearTimeout(recomputeTimer.current);
    },
    [],
  );

  /* City and question both re-anchor the budget: €20 is a normal night in
     Madrid and an impossible one in London, so carrying the old number across
     would make the product look wrong rather than local. */
  const changeCity = (slug: string) => {
    const next = getCity(slug) ?? defaultCity;
    setCitySlug(slug);
    setBudget(defaultBudgetFor(next, intent));
    pulse();
    track("demo_city_changed", { city: slug });
  };

  const changeIntent = (key: DemoIntent) => {
    setIntent(key);
    setBudget(defaultBudgetFor(city, key));
    setTab("plan");
    pulse();
    track("demo_intent_changed", { intent: key });
  };

  return (
    <Section id="demo" tone="paper" className="overflow-hidden">
      <Atmosphere
        blobs={[
          { className: "-top-40 right-[-16rem] size-[40rem] bg-signal/18", drift: "b" },
          { className: "bottom-[-20rem] -left-40 size-[36rem] bg-flow/10", drift: "a" },
        ]}
      />

      <div className="page relative">
        <Reveal>
          <div className="max-w-3xl">
            <Eyebrow index="02">Live demo</Eyebrow>
            <h2 className="mt-4 text-display-md text-ink-950">
              Move the budget. Watch the evening change.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-600">
              This is the real planner, running here, with nothing hidden behind a signup. Pick a
              city, pick a question, then drag the number you can actually spend — the plan
              rebuilds around it in that city&rsquo;s own currency.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[21rem_minmax(0,1fr)] lg:gap-8">
          {/* ---- controls -------------------------------------------------- */}
          <Reveal delay={0.05}>
            <div className="flex flex-col gap-7 rounded-2xl p-6 glass">
              <Control step="01" label="Where you are">
                <div className="flex flex-wrap gap-1.5">
                  {cities.map((option) => (
                    <button
                      key={option.slug}
                      type="button"
                      aria-pressed={option.slug === citySlug}
                      onClick={() => changeCity(option.slug)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium",
                        "transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97]",
                        option.slug === citySlug
                          ? "border-transparent bg-ink-950 text-paper"
                          : "border-ink-200 bg-white/70 text-ink-600 hover:border-ink-300 hover:text-ink-950",
                      )}
                    >
                      {option.name}
                      <span
                        className={cn(
                          "ml-1.5 font-mono text-micro",
                          option.slug === citySlug ? "text-signal" : "text-ink-400",
                        )}
                      >
                        {option.currency.symbol}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-xs leading-snug text-ink-400">
                  These five ship with seeded student data. The planner itself runs in{" "}
                  <a href="#worldwide" className="underline decoration-ink-300 underline-offset-2 hover:text-ink-700">
                    any city worldwide
                  </a>
                  .
                </p>
              </Control>

              <Control step="02" label="What you are asking">
                <div className="flex flex-wrap gap-1.5">
                  {demoIntents.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={option.key === intent}
                      onClick={() => changeIntent(option.key)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium",
                        "transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97]",
                        option.key === intent
                          ? "border-transparent bg-signal text-ink-950"
                          : "border-ink-200 bg-white/70 text-ink-600 hover:border-ink-300 hover:text-ink-950",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Control>

              <Control step="03" label="What you can spend">
                <div className="flex items-baseline gap-2">
                  <span className="tnum font-display text-display-sm text-ink-950">
                    {money(budget, where)}
                  </span>
                  <span className="text-sm text-ink-400">
                    {intent === "food" ? "for the week" : intent === "weekend" ? "for the weekend" : "tonight"}
                  </span>
                </div>

                <label htmlFor="demo-budget" className="sr-only">
                  Budget in {city.currency.code}
                </label>
                <input
                  id="demo-budget"
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={budget}
                  onChange={(event) => {
                    setBudget(Number(event.target.value));
                    pulse();
                  }}
                  onPointerUp={() => track("demo_budget_changed", { intent, budget })}
                  className={cn(
                    "mt-4 h-1.5 w-full cursor-grab appearance-none rounded-full bg-ink-200 active:cursor-grabbing",
                    "[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
                    "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink-950 [&::-webkit-slider-thumb]:bg-signal",
                    "[&::-webkit-slider-thumb]:shadow-[var(--shadow-raise)] [&::-webkit-slider-thumb]:transition-transform",
                    "[&::-webkit-slider-thumb]:hover:scale-110",
                    "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2",
                    "[&::-moz-range-thumb]:border-ink-950 [&::-moz-range-thumb]:bg-signal",
                  )}
                />
                <div className="mt-2 flex justify-between font-mono text-micro text-ink-400">
                  <span className="tnum">{money(min, where)}</span>
                  <span className="tnum">{money(max, where)}</span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-ink-500">
                  Priced in {city.currency.code} ({currencySymbol(city.currency.code)}), the
                  currency a student in {city.name} actually pays in.
                </p>
              </Control>

              {/* The reasoning, restated as the controls move. */}
              <div className="rounded-lg border border-ink-200/70 bg-white/60 p-4">
                <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                  Why this plan
                </p>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-700">
                  <Rationale
                    cityName={city.name}
                    fare={city.anchors.singleFare}
                    card={city.transport.card}
                    rows={plan.items.length}
                    studentRows={plan.studentRows}
                  />
                </p>
              </div>
            </div>
          </Reveal>

          {/* ---- console --------------------------------------------------- */}
          <Reveal delay={0.1} className="min-w-0">
            <div className="flex min-w-0 flex-col gap-4">
              {/* Tab rail. Real buttons with `aria-pressed`, keyboard operable. */}
              <div
                role="tablist"
                aria-label="Product surface"
                className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar edge-fade-x"
              >
                {TABS.map(({ key, label, icon: Icon }) => {
                  const active = key === tab;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      id={`demo-tab-${key}`}
                      aria-selected={active}
                      aria-controls="demo-panel"
                      onClick={() => {
                        setTab(key);
                        track("demo_tab_changed", { tab: key });
                      }}
                      className={cn(
                        "relative inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                        "transition-colors duration-150",
                        active ? "text-paper" : "text-ink-600 hover:text-ink-950",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="demo-tab"
                          className="absolute inset-0 rounded-full bg-ink-950"
                          transition={reduced ? { duration: 0 } : { duration: 0.24, ease: ease.out }}
                        />
                      ) : null}
                      <Icon className="relative size-4" aria-hidden />
                      <span className="relative">{label}</span>
                    </button>
                  );
                })}
              </div>

              <div
                id="demo-panel"
                role="tabpanel"
                aria-labelledby={`demo-tab-${tab}`}
                className="min-w-0"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
                  >
                    {tab === "plan" ? (
                      <AppSurface
                        title={
                          <span className="flex items-center gap-2">
                            <BrandMark className="size-3.5 text-signal" />
                            {city.name} · {brand.surfaces.brain}
                          </span>
                        }
                        meta={plan.query}
                        live
                        action={
                          computing ? (
                            <Loader2 className="size-3.5 shrink-0 animate-spin text-signal" aria-hidden />
                          ) : null
                        }
                      >
                        <div aria-live="polite" aria-busy={computing}>
                          <PlanView
                            key={`${citySlug}-${intent}`}
                            plan={plan}
                            where={where}
                            animate={!reduced}
                          />
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 pt-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
                            <Sparkles className="size-3.5 text-signal" aria-hidden />
                            Recomputed from {city.name} price anchors
                          </span>
                          <span className="tnum text-xs text-white/30">
                            {plan.studentRows} of {plan.items.length} rows from student reports
                          </span>
                        </div>
                      </AppSurface>
                    ) : tab === "loop" ? (
                      <LoopFeed citySlug={citySlug} limit={4} />
                    ) : tab === "map" ? (
                      <CityMap citySlug={citySlug} />
                    ) : (
                      <BudgetPanel />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

function Control({
  step,
  label,
  children,
}: {
  step: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 flex items-center gap-2.5 font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
        <span className="tnum rounded-xs bg-ink-100 px-1.5 py-0.5 text-ink-600">{step}</span>
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * The explanation under the controls. It restates what the planner just did in
 * the student's own terms — including the case that makes the product look
 * honest rather than clever: a city where the transport row is genuinely zero.
 */
function Rationale({
  cityName,
  fare,
  card,
  rows,
  studentRows,
}: {
  cityName: string;
  fare: number;
  card: string;
  rows: number;
  studentRows: number;
}) {
  if (fare === 0) {
    return (
      <>
        {rows} stops, {studentRows} of them priced from what {cityName} students reported. Transport
        is €0 because the {card} already covers it — the planner will not add a fare you have
        already paid.
      </>
    );
  }
  return (
    <>
      {rows} stops, {studentRows} of them priced from what {cityName} students reported. Fares come
      from the {card} at the published single rate, and opening hours from the official listing.
    </>
  );
}
