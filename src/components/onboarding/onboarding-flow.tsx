"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, GraduationCap, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AppSurface } from "@/components/product/app-surface";
import { PlanView } from "@/components/product/plan-view";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StudentVerified } from "@/components/product/verified";
import { brand } from "@/brand/brand.config";
import { plans as pricingPlans, type PlanKey } from "@/config/pricing";
import { arrivalTasksFor } from "@/data/arrival";
import { campusesForCity, cities, cityStatusLabel, getCity } from "@/data/cities";
import { heroPlans, planTotal } from "@/data/plans";
import { placesForCity } from "@/data/places";
import { loopSummaries } from "@/data/loop";
import type { PlaceLayer } from "@/data/types";
import { duration, ease, spring } from "@/lib/motion";
import { cn, money, walk } from "@/lib/utils";
import { track } from "@/services/analytics";

/* -------------------------------------------------------------------------- */
/* Model                                                                       */
/* -------------------------------------------------------------------------- */

const INTERESTS: readonly { key: string; label: string; layers: readonly PlaceLayer[] }[] = [
  { key: "cheap-eats", label: "Cheap eats", layers: ["cheap-food"] },
  { key: "free-culture", label: "Free culture", layers: ["free"] },
  { key: "nightlife", label: "Nightlife", layers: ["nightlife"] },
  { key: "sport", label: "Sport", layers: ["fitness"] },
  { key: "study", label: "Study spots", layers: ["study"] },
  { key: "markets", label: "Markets and groceries", layers: ["groceries"] },
  { key: "events", label: "Events", layers: ["events"] },
  { key: "deals", label: "Deals", layers: ["deals"] },
];

const STEPS = ["City", "University", "Budget", "Interests"] as const;

const BUDGET_MIN = 200;
const BUDGET_MAX = 1200;
const BUDGET_DEFAULT = 680;

/**
 * ============================================================================
 * ONBOARDING
 * ----------------------------------------------------------------------------
 * Four questions, then a real answer. The result page is assembled from the
 * same seeded rows the marketing sections use, filtered by what the visitor
 * actually said — so "Get started free" leads somewhere that does something,
 * rather than to a form that collects an email and shows a thank-you.
 * ============================================================================
 */
export function OnboardingFlow({
  preselectedPlan,
  billing,
}: {
  preselectedPlan?: PlanKey;
  billing?: string;
}) {
  const reduced = useReducedMotion();

  const [step, setStep] = useState(0);
  const [citySlug, setCitySlug] = useState<string | null>(null);
  const [campusSlug, setCampusSlug] = useState<string | null>(null);
  const [budget, setBudget] = useState(BUDGET_DEFAULT);
  const [interests, setInterests] = useState<string[]>(["cheap-eats", "free-culture"]);
  const [done, setDone] = useState(false);

  const city = citySlug ? getCity(citySlug) : undefined;
  const campuses = citySlug ? campusesForCity(citySlug) : [];

  const canAdvance =
    (step === 0 && Boolean(citySlug)) ||
    step === 1 ||
    step === 2 ||
    (step === 3 && interests.length > 0);

  function next() {
    if (step < STEPS.length - 1) {
      track("onboarding_step_completed", { step: STEPS[step], citySlug: citySlug ?? null });
      setStep(step + 1);
      return;
    }
    track("onboarding_completed", {
      citySlug: citySlug ?? null,
      campusSlug: campusSlug ?? null,
      budget,
      interests: interests.join(","),
    });
    setDone(true);
  }

  if (done && city) {
    return (
      <Result
        citySlug={city.slug}
        campusSlug={campusSlug}
        budget={budget}
        interests={interests}
        preselectedPlan={preselectedPlan}
        billing={billing}
        onRestart={() => {
          setDone(false);
          setStep(0);
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, index) => (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <div className="h-1 overflow-hidden rounded-full bg-ink-200">
              <motion.div
                className="h-full rounded-full bg-signal"
                initial={false}
                animate={{ width: index <= step ? "100%" : "0%" }}
                transition={reduced ? { duration: 0 } : { duration: 0.4, ease: ease.out }}
              />
            </div>
            <span
              className={cn(
                "font-mono text-micro uppercase tracking-[0.08em]",
                index === step ? "text-ink-900" : "text-ink-400",
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 min-h-[22rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduced ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -16 }}
            transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
          >
            {step === 0 ? (
              <StepCity value={citySlug} onChange={setCitySlug} onPick={() => setStep(1)} />
            ) : null}

            {step === 1 ? (
              <StepCampus
                cityName={city?.name ?? ""}
                campuses={campuses}
                value={campusSlug}
                onChange={setCampusSlug}
              />
            ) : null}

            {step === 2 ? <StepBudget value={budget} onChange={setBudget} /> : null}

            {step === 3 ? (
              <StepInterests
                value={interests}
                onToggle={(key) =>
                  setInterests((current) =>
                    current.includes(key)
                      ? current.filter((item) => item !== key)
                      : [...current, key],
                  )
                }
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-ink-200 pt-5">
        <Button
          variant="ghost"
          size="md"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {step === 1 && !campusSlug ? (
            <span className="text-[0.8125rem] text-ink-400">You can skip this</span>
          ) : null}
          <Button variant="signal" size="md" onClick={next} disabled={!canAdvance} className="group">
            {step === STEPS.length - 1 ? `Build my ${brand.name}` : "Continue"}
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

function StepHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-display-sm text-ink-950">{title}</h2>
      <p className="mt-2 text-base leading-relaxed text-ink-600">{lead}</p>
    </div>
  );
}

function StepCity({
  value,
  onChange,
  onPick,
}: {
  value: string | null;
  onChange: (slug: string) => void;
  onPick: () => void;
}) {
  return (
    <div>
      <StepHeading
        title="Where are you studying?"
        lead="Everything else follows from this: prices, transport, what free means locally, and which community you land in."
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {cities.map((city) => {
          const selected = value === city.slug;
          return (
            <button
              key={city.slug}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onChange(city.slug);
                window.setTimeout(onPick, 220);
              }}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border p-4 text-left transition-all duration-150",
                selected
                  ? "border-ink-950 bg-white shadow-[var(--shadow-raise)]"
                  : "border-ink-200 bg-paper hover:border-ink-300 hover:bg-white",
              )}
            >
              <span className="min-w-0">
                <span className="block font-display text-lg font-semibold tracking-[-0.02em] text-ink-950">
                  {city.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-400">{city.country}</span>
                <span className="mt-2 block text-[0.8125rem] leading-snug text-ink-600">
                  {city.hook}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold tracking-[0.06em] uppercase",
                  city.status === "live"
                    ? "bg-signal text-ink-950"
                    : "bg-ink-100 text-ink-500",
                )}
              >
                {cityStatusLabel[city.status]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-[0.8125rem] text-ink-400">
        Somewhere else? Pick the closest for now — the setup carries over when your city opens.
      </p>
    </div>
  );
}

function StepCampus({
  cityName,
  campuses,
  value,
  onChange,
}: {
  cityName: string;
  campuses: readonly { slug: string; shortName: string; name: string; area: string }[];
  value: string | null;
  onChange: (slug: string | null) => void;
}) {
  return (
    <div>
      <StepHeading
        title={`Which university in ${cityName}?`}
        lead="This unlocks your campus feed, which is the one most students end up reading every day."
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {campuses.map((campus) => {
          const selected = value === campus.slug;
          return (
            <button
              key={campus.slug}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : campus.slug)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 text-left transition-all duration-150",
                selected
                  ? "border-ink-950 bg-white shadow-[var(--shadow-raise)]"
                  : "border-ink-200 bg-paper hover:border-ink-300 hover:bg-white",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-md",
                  selected ? "bg-signal text-ink-950" : "bg-flow-soft text-flow-deep",
                )}
              >
                {selected ? (
                  <Check className="size-4.5" aria-hidden />
                ) : (
                  <GraduationCap className="size-4.5" aria-hidden />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-semibold text-ink-950">
                  {campus.shortName}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-400">{campus.area}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepBudget({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const daily = Math.floor((value / 30) * 10) / 10;
  const weekly = Math.round((value / 30) * 7);

  return (
    <div>
      <StepHeading
        title="What do you have to live on each month?"
        lead="Not including rent. A rough number is fine — this is what turns suggestions into ones you can actually afford."
      />

      <div className="rounded-xl border border-ink-200 bg-paper-2 p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <label htmlFor="budget" className="text-sm font-medium text-ink-700">
            Monthly, after rent
          </label>
          <span className="tnum font-mono text-3xl font-semibold text-ink-950">{money(value)}</span>
        </div>

        <input
          id="budget"
          type="range"
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          step={20}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-flow"
        />
        <div className="mt-2 flex justify-between font-mono text-micro text-ink-400">
          <span>{money(BUDGET_MIN)}</span>
          <span>{money(BUDGET_MAX)}+</span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-paper p-3.5">
            <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
              Roughly per day
            </dt>
            <dd className="tnum mt-1 font-mono text-xl font-semibold text-flow-deep">
              {money(daily)}
            </dd>
          </div>
          <div className="rounded-lg bg-paper p-3.5">
            <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
              Roughly per week
            </dt>
            <dd className="tnum mt-1 font-mono text-xl font-semibold text-flow-deep">
              {money(weekly)}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-400">
        This stays in your account. It is never sold, never shared with venues, and never attached
        to an error report.
      </p>
    </div>
  );
}

function StepInterests({
  value,
  onToggle,
}: {
  value: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div>
      <StepHeading
        title="What do you want more of?"
        lead="Pick at least one. This decides which map layers open first and what your feed leads with."
      />
      <div className="flex flex-wrap gap-2">
        {INTERESTS.map((interest) => (
          <Chip
            key={interest.key}
            accent="signal"
            active={value.includes(interest.key)}
            onClick={() => onToggle(interest.key)}
            className="px-4 py-2.5 text-[0.9375rem]"
          >
            {interest.label}
          </Chip>
        ))}
      </div>
      {value.length === 0 ? (
        <p className="mt-4 text-[0.8125rem] text-pulse-deep">Pick at least one to continue.</p>
      ) : (
        <p className="mt-4 text-[0.8125rem] text-ink-400">
          {value.length} selected. You can change all of this later.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Result                                                                      */
/* -------------------------------------------------------------------------- */

function Result({
  citySlug,
  campusSlug,
  budget,
  interests,
  preselectedPlan,
  billing,
  onRestart,
}: {
  citySlug: string;
  campusSlug: string | null;
  budget: number;
  interests: string[];
  preselectedPlan?: PlanKey;
  billing?: string;
  onRestart: () => void;
}) {
  const reduced = useReducedMotion();
  const city = getCity(citySlug);
  const campus = campusesForCity(citySlug).find((item) => item.slug === campusSlug);
  const summary = loopSummaries[citySlug];
  const tasks = arrivalTasksFor(citySlug).slice(0, 4);
  const chosenPlan = pricingPlans.find((plan) => plan.key === preselectedPlan);

  const daily = Math.floor((budget / 30) * 10) / 10;

  /** The most substantial seeded plan that still fits a normal day's spend. */
  const plan = useMemo(() => {
    const affordable = heroPlans
      .filter((candidate) => planTotal(candidate) <= daily)
      .sort((a, b) => planTotal(b) - planTotal(a));
    return affordable[0] ?? heroPlans.find((candidate) => candidate.id === "free-tonight")!;
  }, [daily]);

  const layers = new Set(
    interests.flatMap((key) => INTERESTS.find((item) => item.key === key)?.layers ?? []),
  );
  const matches = placesForCity(citySlug)
    .filter((place) => place.layers.some((layer) => layers.has(layer)))
    .sort((a, b) => b.studentValue - a.studentValue)
    .slice(0, 3);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : spring.soft}
      className="mx-auto w-full max-w-4xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
            Ready to go
          </p>
          <h2 className="mt-2 text-display-md text-ink-950">
            Your {brand.name} for {city?.name}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onRestart}>
          <RotateCcw className="size-4" aria-hidden />
          Change my answers
        </Button>
      </div>

      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-600">
        {campus ? `${campus.shortName} · ` : ""}
        {money(budget)} a month after rent, which is about{" "}
        <span className="tnum font-medium text-ink-950">{money(daily)} a day</span>. Here is what
        that actually buys you in {city?.name}.
      </p>

      {chosenPlan ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-paper-2 px-4 py-3">
          <span className="rounded-full bg-signal px-2.5 py-1 text-micro font-semibold tracking-[0.06em] text-ink-950 uppercase">
            {chosenPlan.name} selected
          </span>
          <p className="text-sm text-ink-600">
            Start on Free and switch to {chosenPlan.name} whenever you want
            {billing === "annual" ? ", billed annually" : ""}. Nothing is charged today.
          </p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* a plan that fits */}
        <AppSurface
          title={`Tonight in ${city?.name}`}
          meta={`Fits inside ${money(daily)} a day`}
        >
          <PlanView plan={plan} animate={false} />
        </AppSurface>

        <div className="flex flex-col gap-4">
          {/* matches */}
          <div className="rounded-xl border border-ink-200 bg-paper-2 p-5">
            <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
              Because you picked{" "}
              {interests
                .map((key) => INTERESTS.find((item) => item.key === key)?.label.toLowerCase())
                .filter(Boolean)
                .join(", ")}
            </p>
            {matches.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-3">
                {matches.map((place) => (
                  <li key={place.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] font-medium text-ink-950">{place.name}</p>
                      <p className="mt-0.5 text-[0.8125rem] text-ink-500">
                        <span className="tnum">{walk(place.walkMinutes)}</span> ·{" "}
                        {place.priceLabel}
                      </p>
                      <div className="mt-1.5">
                        <StudentVerified count={place.verifiedBy} size="sm" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-ink-500">
                Nothing seeded for that combination in {city?.name} yet. In the product this is
                where your first recommendations would come from your own campus feed.
              </p>
            )}
          </div>

          {/* pulse */}
          {summary ? (
            <div className="rounded-xl border border-ink-200 bg-paper-2 p-5">
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                What {city?.name} students are talking about
              </p>
              <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-700">{summary.body}</p>
              <Link
                href={`/city/${citySlug}/loop`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-950 underline underline-offset-4"
              >
                Read the full feed
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          ) : null}

          {/* arrival */}
          <div className="rounded-xl border border-ink-200 bg-paper-2 p-5">
            <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
              First four things to do
            </p>
            <ol className="mt-3 flex flex-col gap-2">
              {tasks.map((task, index) => (
                <li key={task.id} className="flex items-baseline gap-3">
                  <span className="tnum font-mono text-xs text-ink-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[0.875rem] text-ink-800">{task.label}</span>
                </li>
              ))}
            </ol>
            <Link
              href={`/city/${citySlug}/starter-pack`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-950 underline underline-offset-4"
            >
              See the whole list
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {/* keep it */}
      <div className="mt-8 rounded-xl border border-ink-200 bg-paper-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-md">
            <h3 className="text-display-xs text-ink-950">Keep this setup</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              {city?.name} accounts open{" "}
              {city?.status === "live" ? "first" : "once the first groups are in place"}.
              Leave an address and you get one email when it does.
            </p>
          </div>
          <div className="w-full max-w-md">
            <WaitlistForm citySlug={citySlug} cityName={city?.name} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {/* The preview ends where it should: an account, which is what makes
            any of this persist. Looking around the city page stays available
            as the secondary path for anyone not ready to sign up. */}
        <ButtonLink href="/signup" variant="signal" size="md">
          Create your account
        </ButtonLink>
        <ButtonLink href={`/city/${citySlug}`} variant="outline" size="md">
          Look around {city?.name}
        </ButtonLink>
        <ButtonLink href="/pricing" variant="outline" size="md">
          Compare plans
        </ButtonLink>
      </div>

      <p className="mt-6 text-[0.8125rem] leading-relaxed text-ink-400">
        Everything above is assembled from the same sample rows used across this site, filtered by
        what you just told us. Live answers, live prices and a live feed arrive when {city?.name}{" "}
        opens.
      </p>
    </motion.div>
  );
}
