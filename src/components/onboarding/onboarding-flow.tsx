"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MoneyInput } from "@/components/onboarding/controls";
import { seedDraftFromPreview, type PreviewStep } from "@/components/onboarding/draft";
import { UniversityPicker, type UniversityChoice } from "@/components/onboarding/university-picker";
import { AppSurface } from "@/components/product/app-surface";
import { PlanView } from "@/components/product/plan-view";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { brand } from "@/brand/brand.config";
import { allInterests } from "@/config/onboarding";
import { plans as pricingPlans, type PlanKey } from "@/config/pricing";
import { arrivalTasksFor } from "@/data/arrival";
import { cityDirectory, cityStatusLabel, cityStatusNote, resolveCity } from "@/data/cities";
import { loopSummaries } from "@/data/loop";
import { heroPlans, planTotal } from "@/data/plans";
import { searchCities } from "@/domain/cities";
import { duration, ease, spring } from "@/lib/motion";
import { cn, money, type MoneyLocale } from "@/lib/utils";
import { track } from "@/services/analytics";

/* -------------------------------------------------------------------------- */
/* Model                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The preview's interests are setup's own values — a curated dozen of them —
 * so the answers can be handed over as they are. They used to be a separate
 * vocabulary ("free-culture", "markets") that meant nothing to setup, which is
 * half of why the two flows could never share anything.
 */
const PREVIEW_INTERESTS = [
  "cheap-food",
  "coffee",
  "nightlife",
  "music",
  "football",
  "gym",
  "museums",
  "culture",
  "language-exchange",
  "study-groups",
  "travel",
  "festivals",
]
  .map((value) => allInterests.find((item) => item.value === value))
  .filter((item): item is NonNullable<typeof item> => Boolean(item));

const STEPS = ["City", "University", "Budget", "Interests"] as const;

/**
 * ============================================================================
 * THE PREVIEW (`/get-started`)
 * ----------------------------------------------------------------------------
 * Four questions, no account, then a look at what that buys.
 *
 * Three things changed, each because the old version said something untrue:
 *
 *  - It only offered the five full cities, and told everyone else to "pick
 *    the closest for now". It now searches all of them, with the same
 *    `searchCities` setup uses.
 *
 *  - Its "Tonight in {city}" plan was chosen by price alone from a list that
 *    only contains Madrid, so a student who picked Berlin was shown a Madrid
 *    ramen bar under a Berlin heading. The plan now appears only for the city
 *    it belongs to, and every other city gets an honest description of what
 *    works there on day one.
 *
 *  - It ended in a waitlist ("accounts open once the first groups are in
 *    place") sitting above a "Create your account" button, long after accounts
 *    opened. It now ends in the account, and the answers go with it: they are
 *    written to the onboarding draft so setup opens pre-filled.
 *
 * The budget is typed in the city's currency rather than dragged along a
 * slider fixed at €200–€1,200, which meant nothing in yen or lei.
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
  const [direction, setDirection] = useState<1 | -1>(1);
  const [citySlug, setCitySlug] = useState<string | null>(null);
  /* A student whose university is not in the register still has one, so this
     holds the whole choice rather than a slug: see `UniversityChoice`. */
  const [university, setUniversity] = useState<UniversityChoice | null>(null);
  const [budget, setBudget] = useState("");
  const [interests, setInterests] = useState<string[]>(["cheap-food", "museums"]);
  const [done, setDone] = useState(false);

  const city = citySlug ? resolveCity(citySlug) : null;
  const where: MoneyLocale = city ? { currency: city.currency.code, locale: city.locale } : {};
  const monthly = Number(budget) > 0 ? Number(budget) : 0;

  const canAdvance =
    (step === 0 && Boolean(citySlug)) || step === 1 || step === 2 || (step === 3 && interests.length > 0);

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  function next() {
    if (step < STEPS.length - 1) {
      track("onboarding_step_completed", { step: STEPS[step], citySlug: citySlug ?? null });
      goTo(step + 1);
      return;
    }
    track("onboarding_completed", {
      citySlug: citySlug ?? null,
      campusSlug: university?.campusSlug ?? null,
      universityName: university?.name || null,
      budget: monthly,
      interests: interests.join(","),
    });

    /* Hand the answers to setup. Written on completion, not in an effect: this
       is the moment the student said "yes, these". */
    if (citySlug) {
      const fromPreview: PreviewStep[] = ["city", "interests"];
      if (university) fromPreview.push("university");
      if (monthly > 0) fromPreview.push("budget");
      seedDraftFromPreview({
        citySlug,
        institutionId: university?.institutionId ?? null,
        campusSlug: university?.campusSlug ?? null,
        universityName: university?.name ?? "",
        monthlyTotal: monthly > 0 ? String(monthly) : "",
        excludeHousing: true,
        interests,
        fromPreview,
      });
    }
    setDone(true);
  }

  if (done && city) {
    return (
      <Result
        citySlug={city.slug}
        universityName={university?.name ?? null}
        monthly={monthly}
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
      <div className="grid grid-cols-4 gap-2">
        {STEPS.map((label, index) => (
          <div key={label} className="min-w-0">
            <div className="h-1 overflow-hidden rounded-full bg-ink-200">
              <motion.div
                className="h-full rounded-full bg-ink-950"
                initial={false}
                animate={{ width: index <= step ? "100%" : "0%" }}
                transition={reduced ? { duration: 0 } : { duration: 0.4, ease: ease.out }}
              />
            </div>
            <span
              className={cn(
                "mt-2 block truncate font-mono text-micro tracking-[0.1em] uppercase",
                index === step ? "text-ink-950" : "text-ink-400",
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 min-h-[24rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduced ? false : { opacity: 0, x: 18 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -18 * direction }}
            transition={{ duration: reduced ? 0 : duration.quick, ease: ease.out }}
          >
            {step === 0 ? (
              <StepCity
                value={citySlug}
                onPick={(slug) => {
                  setCitySlug(slug);
                  setUniversity(null);
                  /* Advance only if still on the city step. This used to call
                     `goTo(1)` from a stale closure: a student who picked a city
                     and tapped Continue twice inside 220ms reached the budget
                     step and was then pulled back to the university. */
                  window.setTimeout(() => {
                    setDirection(1);
                    setStep((current) => (current === 0 ? 1 : current));
                  }, 220);
                }}
              />
            ) : null}

            {step === 1 && city ? (
              <>
                <StepHeading
                  title={`Which university in ${city.name}?`}
                  lead="Search for yours. If it isn't there, type it — only the campus feed needs us to know the place."
                />
                <UniversityPicker
                  cityName={city.name}
                  citySlug={city.slug}
                  countryCode={city.countryCode}
                  choice={university}
                  onPick={setUniversity}
                  onClear={() => setUniversity(null)}
                />
              </>
            ) : null}

            {step === 2 ? (
              <StepBudget
                value={budget}
                onChange={setBudget}
                symbol={city?.currency.symbol ?? "€"}
                where={where}
              />
            ) : null}

            {step === 3 ? (
              <StepInterests
                value={interests}
                onToggle={(key) =>
                  setInterests((current) =>
                    current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
                  )
                }
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-ink-200 pt-5">
        <Button variant="ghost" size="md" onClick={() => goTo(Math.max(0, step - 1))} disabled={step === 0}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {(step === 1 && !university) || (step === 2 && monthly === 0) ? (
            <span className="text-[0.8125rem] text-ink-500">You can skip this</span>
          ) : null}
          <Button variant="signal" size="md" onClick={next} disabled={!canAdvance} className="group">
            {step === STEPS.length - 1 ? `Show me my ${brand.name}` : "Continue"}
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
      <h1 className="text-display-sm text-ink-950">{title}</h1>
      <p className="mt-2 text-base leading-relaxed text-ink-600">{lead}</p>
    </div>
  );
}

function StepCity({ value, onPick }: { value: string | null; onPick: (slug: string) => void }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchCities(cityDirectory, query, 8), [query]);
  const full = cityDirectory.filter((city) => city.deep);
  const needle = query.trim();

  return (
    <div>
      <StepHeading
        title="Where are you studying?"
        lead="Everything follows from this: prices and currency, transport, what free means locally, and which students you land among."
      />

      <label className="block">
        <span className="sr-only">Search {cityDirectory.length} cities</span>
        <input
          autoFocus
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${cityDirectory.length} cities`}
          className="h-14 w-full rounded-2xl border border-ink-200 bg-white px-5 text-[1.0625rem] text-ink-950 shadow-[var(--shadow-flat)] placeholder:text-ink-400 hover:border-ink-300"
        />
      </label>

      {needle ? (
        matches.length > 0 ? (
          <ul className="mt-2 overflow-hidden rounded-2xl border border-ink-200 bg-white">
            {matches.map(({ city }) => (
              <li key={city.slug} className="border-b border-ink-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => onPick(city.slug)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-paper-2",
                    value === city.slug && "bg-signal-soft",
                  )}
                >
                  <span className="text-[0.9375rem] text-ink-900">
                    {city.name} <span className="text-ink-500">· {city.country}</span>
                  </span>
                  <span className="shrink-0 text-[0.75rem] text-ink-500">
                    {cityStatusLabel[city.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[0.875rem] text-ink-500">
            Not on the list yet. Cities are added with real geography behind each one, so the list
            only grows when it can be right.
          </p>
        )
      ) : (
        <>
          <p className="mt-6 font-mono text-micro tracking-[0.12em] text-ink-500 uppercase">
            Full cities
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {full.map((city) => (
              <button
                key={city.slug}
                type="button"
                aria-pressed={value === city.slug}
                onClick={() => onPick(city.slug)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  value === city.slug
                    ? "border-ink-950 bg-white shadow-[var(--shadow-raise)]"
                    : "border-ink-200 bg-paper hover:border-ink-300 hover:bg-white",
                )}
              >
                <span className="min-w-0">
                  <span className="block font-display text-lg font-semibold tracking-[-0.02em] text-ink-950">
                    {city.name}
                  </span>
                  <span className="block text-xs text-ink-500">{city.country}</span>
                </span>
                <span className="shrink-0 rounded-full bg-mint-soft px-2 py-0.5 font-mono text-[0.625rem] font-semibold tracking-[0.08em] text-mint-deep uppercase">
                  {cityStatusLabel[city.status]}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[0.8125rem] text-ink-500">
            Full cities have local prices, campuses and an arrival checklist. Every other city works
            from provider and official data on day one.
          </p>
        </>
      )}
    </div>
  );
}

function StepBudget({
  value,
  onChange,
  symbol,
  where,
}: {
  value: string;
  onChange: (value: string) => void;
  symbol: string;
  where: MoneyLocale;
}) {
  const monthly = Number(value) > 0 ? Number(value) : 0;
  const daily = Math.floor((monthly / 30) * 10) / 10;
  const weekly = Math.round((monthly / 30) * 7);

  return (
    <div>
      <StepHeading
        title="What do you have to live on each month?"
        lead="After rent. A rough number is fine — it's what turns suggestions into ones you can actually afford."
      />

      <MoneyInput
        large
        label="Monthly, after rent"
        symbol={symbol}
        value={value}
        onChange={onChange}
        placeholder="600"
      />

      {monthly > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-ink-200">
          <div className="bg-white px-4 py-3">
            <dt className="font-mono text-micro tracking-[0.1em] text-ink-500 uppercase">About a day</dt>
            <dd className="tnum mt-1 font-mono text-xl font-semibold text-flow-deep">{money(daily, where)}</dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="font-mono text-micro tracking-[0.1em] text-ink-500 uppercase">About a week</dt>
            <dd className="tnum mt-1 font-mono text-xl font-semibold text-flow-deep">{money(weekly, where)}</dd>
          </div>
        </dl>
      ) : null}

      <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-500">
        It stays with your setup. Never sold, never shared with venues, never attached to an error
        report.
      </p>
    </div>
  );
}

function StepInterests({ value, onToggle }: { value: string[]; onToggle: (key: string) => void }) {
  return (
    <div>
      <StepHeading
        title="What do you want more of?"
        lead="Pick at least one. It decides what your feed leads with — and you can add more in setup."
      />
      <div className="flex flex-wrap gap-2">
        {PREVIEW_INTERESTS.map((interest) => (
          <Chip
            key={interest.value}
            accent="signal"
            active={value.includes(interest.value)}
            onClick={() => onToggle(interest.value)}
            className="px-4 py-2.5 text-[0.9375rem]"
          >
            {interest.emoji ? <span aria-hidden>{interest.emoji}</span> : null}
            {interest.label}
          </Chip>
        ))}
      </div>
      {value.length === 0 ? (
        <p className="mt-4 text-[0.8125rem] text-pulse-deep">Pick at least one to continue.</p>
      ) : (
        <p className="mt-4 text-[0.8125rem] text-ink-500">{value.length} selected.</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Result                                                                      */
/* -------------------------------------------------------------------------- */

function Result({
  citySlug,
  universityName,
  monthly,
  interests,
  preselectedPlan,
  billing,
  onRestart,
}: {
  citySlug: string;
  universityName: string | null;
  monthly: number;
  interests: string[];
  preselectedPlan?: PlanKey;
  billing?: string;
  onRestart: () => void;
}) {
  const reduced = useReducedMotion();
  const city = resolveCity(citySlug)!;
  const where: MoneyLocale = { currency: city.currency.code, locale: city.locale };
  const summary = loopSummaries[citySlug];
  const tasks = arrivalTasksFor(citySlug).slice(0, 4);
  const chosenPlan = pricingPlans.find((plan) => plan.key === preselectedPlan);
  const daily = monthly > 0 ? Math.floor((monthly / 30) * 10) / 10 : null;
  const chosenInterests = allInterests.filter((item) => interests.includes(item.value));

  /** A seeded plan for THIS city that fits a normal day, or none at all. */
  const plan = useMemo(() => {
    const local = heroPlans.filter((candidate) => candidate.citySlug === citySlug);
    if (local.length === 0) return null;
    if (daily === null) return local.find((candidate) => planTotal(candidate) === 0) ?? local[0];
    return (
      local
        .filter((candidate) => planTotal(candidate) <= daily)
        .sort((a, b) => planTotal(b) - planTotal(a))[0] ??
      local.find((candidate) => planTotal(candidate) === 0) ??
      null
    );
  }, [citySlug, daily]);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : spring.soft}
      className="mx-auto w-full max-w-4xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-micro tracking-[0.14em] text-ink-500 uppercase">Your preview</p>
          <h1 className="mt-2 text-display-md text-ink-950">
            {brand.name} for {city.name}
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onRestart}>
          <RotateCcw className="size-4" aria-hidden />
          Change my answers
        </Button>
      </div>

      {/* what the preview established, as a line of facts */}
      <ul className="mt-5 flex flex-wrap gap-1.5">
        {[
          `${city.name} · ${city.currency.code}`,
          universityName,
          daily !== null ? `${money(monthly, where)} a month · about ${money(daily, where)} a day` : null,
          ...chosenInterests.map((item) => `${item.emoji ?? ""} ${item.label}`.trim()),
        ]
          .filter((bit): bit is string => Boolean(bit))
          .map((bit) => (
            <li
              key={bit}
              className="rounded-full bg-white px-3 py-1 text-[0.8125rem] font-medium text-ink-700 ring-1 ring-ink-950/8"
            >
              {bit}
            </li>
          ))}
      </ul>

      {chosenPlan ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-ink-200 bg-paper-2 px-4 py-3">
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
        {plan ? (
          <AppSurface
            title={`Tonight in ${city.name}`}
            meta={daily !== null ? `Fits inside ${money(daily, where)} a day` : "A free evening"}
          >
            <PlanView plan={plan} animate={false} where={where} />
          </AppSurface>
        ) : (
          <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5 sm:p-6">
            <p className="font-mono text-micro tracking-[0.12em] text-ink-500 uppercase">
              {city.name} on day one · {cityStatusLabel[city.status]}
            </p>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-700">
              {cityStatusNote[city.status]}
            </p>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
              No sample evening here on purpose: the only seeded plans are for Madrid, and showing
              one under a {city.name} heading would be a plan for the wrong city.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {summary ? (
            <div className="rounded-2xl border border-ink-200 bg-paper-2 p-5">
              <p className="font-mono text-micro tracking-[0.12em] text-ink-500 uppercase">
                What {city.name} students are talking about
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

          <div className="rounded-2xl border border-ink-200 bg-paper-2 p-5">
            <p className="font-mono text-micro tracking-[0.12em] text-ink-500 uppercase">
              First four things to do
            </p>
            <ol className="mt-3 flex flex-col gap-2">
              {tasks.map((task, index) => (
                <li key={task.id} className="flex items-baseline gap-3">
                  <span className="tnum font-mono text-xs text-ink-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[0.875rem] text-ink-800">{task.label}</span>
                </li>
              ))}
            </ol>
            {city.deep ? (
              <Link
                href={`/city/${citySlug}/starter-pack`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-950 underline underline-offset-4"
              >
                See the whole list
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* ---- keep it: the account, with the answers carried over ------------ */}
      <div
        data-surface="dark"
        className="mt-8 flex flex-col gap-5 rounded-2xl bg-linear-to-b from-console-2 to-console p-6 text-white shadow-[var(--shadow-console)] sm:flex-row sm:items-center sm:justify-between sm:p-7"
      >
        <div className="max-w-md">
          <h2 className="text-display-xs text-white">Keep this. Your answers come with you.</h2>
          <p className="mt-2 flex items-start gap-2 text-[0.875rem] leading-relaxed text-white/65">
            <Check className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
            Setup opens with your city, campus, budget and interests already filled in.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <ButtonLink href="/signup" variant="signal" size="lg">
            Create your account
          </ButtonLink>
          <span className="text-[0.8125rem] text-white/45">Free. No card.</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {city.deep ? (
          <ButtonLink href={`/city/${citySlug}`} variant="outline" size="md">
            Look around {city.name}
          </ButtonLink>
        ) : null}
        <ButtonLink href="/pricing" variant="outline" size="md">
          Compare plans
        </ButtonLink>
      </div>

      <p className="mt-6 text-[0.8125rem] leading-relaxed text-ink-500">
        {plan ? "The evening above is sample data, labelled as such. " : ""}
        Live places, events and prices open on your Today screen once you&rsquo;re in.
      </p>
    </motion.div>
  );
}
