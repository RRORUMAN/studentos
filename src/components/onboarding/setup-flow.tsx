"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { MoneyInput, OptionRow, SelectChip } from "@/components/onboarding/controls";
import { clearDraft, readDraft, writeDraft, type PreviewStep } from "@/components/onboarding/draft";
import { UniversityPicker } from "@/components/onboarding/university-picker";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Button } from "@/components/ui/button";
import { brand } from "@/brand/brand.config";
import type { MascotState } from "@/brand/mascot.config";
import {
  allInterests,
  budgetCategories,
  diets,
  housingSituations,
  interestGroups,
  MIN_INTERESTS,
  moneyGoals,
  notificationTopics,
  onboardingSteps,
  priceSensitivities,
  socialGoals,
  studentStatuses,
  transportModes,
  travelLimits,
  type OnboardingStepId,
} from "@/config/onboarding";
import { interfaceLanguages } from "@/config/regions";
import { cityDirectory, cityStatusLabel, resolveCity } from "@/data/cities";
import type { CityContext } from "@/data/types";
import { searchCities } from "@/domain/cities";
import { duration, ease } from "@/lib/motion";
import { cn, money, type MoneyLocale } from "@/lib/utils";
import { areaNamesFor } from "@/server/actions/areas";
import { completeOnboarding, type OnboardingInput } from "@/server/actions/onboarding";

/**
 * ============================================================================
 * SETUP FLOW
 * ----------------------------------------------------------------------------
 * The twelve-step conversation that turns an empty account into a personalised
 * one.
 *
 * Everything is held in one client-side state object and written in a single
 * server round-trip at the end. That is the right trade here: a per-step save
 * would mean twelve writes, twelve failure modes, and a half-onboarded row if
 * someone closes the tab at step seven. One atomic write means the account
 * either exists properly or does not exist at all. The draft in
 * `sessionStorage` (see `draft.ts`) is the counterpart: a refresh mid-flow
 * restores the answers, and the public preview at `/get-started` pre-fills
 * the four it already asked, so nobody answers the same question twice.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE REDESIGN ADDED, AND WHY
 *
 * Chapters. Twelve steps behind one thin bar read as a long form. The same
 * twelve grouped as You, Money, Your life and Alerts read as four short
 * things, and the bar says which one you are in.
 *
 * "So far". A panel that fills in as the student answers — their city and its
 * currency, their campus, their budget as a daily figure, their interests.
 * Setup is the product learning somebody, and this is the one place that
 * learning can be seen happening. Every line in it is an answer the student
 * gave or a default they can see and change; nothing is inferred.
 *
 * Enter to continue, when focus is not in a field. Most of this flow is
 * tapping, but on a laptop the keyboard is faster than the mouse.
 *
 * The names tests drive by are unchanged: Continue, Skip, "Enter StudentOS",
 * "Roughly per month", "Arriving", "moving there soon", "Search N cities".
 * ============================================================================
 */

type Answers = {
  status: OnboardingInput["status"] | null;
  citySlug: string | null;
  movingSoon: boolean;
  arrivingOn: string;
  leavingOn: string;
  housing: OnboardingInput["housing"];
  stayMonths: string;
  institutionId: string | null;
  campusSlug: string | null;
  universityName: string;
  homeArea: string;
  budgetMode: "simple" | "detailed";
  monthlyTotal: string;
  excludeHousing: boolean;
  categoryAmounts: Record<string, string>;
  moneyGoals: string[];
  interests: string[];
  socialGoals: string[];
  diets: string[];
  transport: string[];
  maxTravelMinutes: string;
  priceSensitivity: OnboardingInput["priceSensitivity"];
  notificationTopics: string[];
  language: string;
  /** Which steps arrived pre-filled from `/get-started`. Never sent to the server. */
  fromPreview: PreviewStep[];
};

const INITIAL: Answers = {
  status: null,
  citySlug: null,
  movingSoon: false,
  arrivingOn: "",
  leavingOn: "",
  housing: "unknown",
  stayMonths: "",
  institutionId: null,
  campusSlug: null,
  universityName: "",
  homeArea: "",
  budgetMode: "simple",
  monthlyTotal: "",
  excludeHousing: false,
  categoryAmounts: {},
  moneyGoals: [],
  interests: [],
  socialGoals: [],
  diets: [],
  transport: [],
  maxTravelMinutes: "30",
  priceSensitivity: "value",
  notificationTopics: notificationTopics.filter((t) => t.defaultOn).map((t) => t.value),
  language: "en",
  fromPreview: [],
};

const KNOWN_INTERESTS = new Set(allInterests.map((item) => item.value));

/** Restore a draft, dropping anything this version of setup does not know. */
function restore(): Answers {
  const saved = readDraft();
  if (!saved) return INITIAL;
  const merged = { ...INITIAL, ...(saved as Partial<Answers>) };
  return {
    ...merged,
    interests: Array.isArray(merged.interests)
      ? merged.interests.filter((value) => KNOWN_INTERESTS.has(value))
      : [],
    fromPreview: Array.isArray(merged.fromPreview) ? merged.fromPreview : [],
    citySlug: merged.citySlug && resolveCity(merged.citySlug) ? merged.citySlug : null,
  };
}

/** No frozen-array churn: "no areas yet" is one stable reference. */
const NO_AREAS: readonly string[] = Object.freeze([]);

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

/* -------------------------------------------------------------------------- */
/* Chapters                                                                    */
/* -------------------------------------------------------------------------- */

const CHAPTERS: readonly {
  label: string;
  steps: readonly OnboardingStepId[];
  mascot: MascotState;
  line: string;
}[] = [
  { label: "You", steps: ["status", "city", "university", "home"], mascot: "explorer", line: "Let's get you placed." },
  { label: "Money", steps: ["budget", "money-goals"], mascot: "budget", line: "Rough numbers are fine." },
  {
    label: "Your life",
    steps: ["interests", "social", "food", "transport", "price"],
    mascot: "happy",
    line: "This is the good part.",
  },
  { label: "Alerts", steps: ["notifications"], mascot: "focus", line: "Last one." },
];

function chapterOf(id: OnboardingStepId) {
  return CHAPTERS.findIndex((chapter) => chapter.steps.includes(id));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-01" → "1 Oct 2026". Written out, because no locale API may pick the format. */
function dayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** The monthly figure the student has given, whichever mode they used. */
function monthlyFrom(answers: Answers): number {
  if (answers.budgetMode === "simple") {
    const value = Number(answers.monthlyTotal);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  return Object.entries(answers.categoryAmounts)
    .filter(([key]) => key !== "housing")
    .reduce((total, [, value]) => total + (Number(value) || 0), 0);
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function SetupFlow() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [pending, startTransition] = useTransition();

  /* Client-only (see `setup-flow-client.tsx`), so reading storage here is safe
     and matches what the first render shows. */
  const [answers, setAnswers] = useState<Answers>(restore);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [furthest, setFurthest] = useState(0);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((patch: Partial<Answers>) => {
    setAnswers((current) => {
      const next = { ...current, ...patch };
      writeDraft(next);
      return next;
    });
  }, []);

  const step = onboardingSteps[index];
  const chapter = chapterOf(step.id);
  const city = useMemo(
    () => (answers.citySlug ? resolveCity(answers.citySlug) : null),
    [answers.citySlug],
  );
  const where: MoneyLocale = city ? { currency: city.currency.code, locale: city.locale } : {};
  const symbol = city?.currency.symbol ?? "€";

  /* Only three questions are genuinely required. */
  const canContinue = useMemo(() => {
    switch (step.id) {
      case "status":
        return answers.status !== null;
      case "city":
        return answers.citySlug !== null && (!answers.movingSoon || answers.arrivingOn !== "");
      case "interests":
        return answers.interests.length >= MIN_INTERESTS;
      default:
        return true;
    }
  }, [step.id, answers]);

  const submit = useCallback(() => {
    setError(null);
    setBuilding(true);

    startTransition(async () => {
      const payload: OnboardingInput = {
        status: answers.status ?? "other",
        citySlug: answers.citySlug ?? cityDirectory[0].slug,
        arrivingOn: answers.arrivingOn ? new Date(answers.arrivingOn).toISOString() : null,
        leavingOn: answers.leavingOn ? new Date(answers.leavingOn).toISOString() : null,
        housing: answers.housing,
        stayMonths: answers.stayMonths ? Number(answers.stayMonths) : null,
        institutionId: answers.institutionId,
        campusSlug: answers.campusSlug,
        universityName: answers.universityName || null,
        homeArea: answers.homeArea || null,
        homePoint: null,
        budgetMode: answers.budgetMode,
        monthlyTotal: answers.monthlyTotal ? Number(answers.monthlyTotal) : null,
        excludeHousing: answers.excludeHousing,
        categoryAmounts: Object.fromEntries(
          Object.entries(answers.categoryAmounts)
            .map(([key, value]) => [key, Number(value)] as const)
            .filter(([, value]) => Number.isFinite(value) && value > 0),
        ),
        moneyGoals: answers.moneyGoals,
        interests: answers.interests,
        socialGoals: answers.socialGoals,
        diets: answers.diets,
        transport: answers.transport,
        maxTravelMinutes: Number(answers.maxTravelMinutes) || 30,
        priceSensitivity: answers.priceSensitivity,
        notificationTopics: answers.notificationTopics,
        language: answers.language,
      };

      const result = await completeOnboarding(payload);

      if (!result.ok) {
        setBuilding(false);
        setError(result.message);
        return;
      }

      clearDraft();

      /* Let the build screen land before moving. It is not a fake loader —
         the write above has already happened; this is the reveal. */
      setTimeout(() => router.push("/home"), 2200);
    });
  }, [answers, router]);

  const go = useCallback((to: number) => {
    setDirection(to > index ? 1 : -1);
    setIndex(to);
    setFurthest((current) => Math.max(current, to));
  }, [index]);

  const next = useCallback(() => {
    if (index === onboardingSteps.length - 1) submit();
    else go(index + 1);
  }, [index, submit, go]);

  /* Enter continues — but never out of a field, a select or a button, where
     Enter already means something. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing || !canContinue || pending) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a")) return;
      event.preventDefault();
      next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canContinue, pending, next]);

  if (building) {
    return <BuildingScreen answers={answers} city={city} where={where} />;
  }

  const prefilled = (answers.fromPreview as string[]).includes(step.id);
  const mascot = CHAPTERS[chapter];

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14">
      <div className="min-w-0 lg:max-w-xl">
        <ChapterProgress index={index} />

        <SoFarStrip answers={answers} city={city} where={where} />

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step.id}
            initial={reduced ? false : { opacity: 0, x: 18 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -18 * direction }}
            transition={{ duration: reduced ? 0 : duration.quick, ease: ease.out }}
          >
            <div className="mt-8 flex items-center gap-2.5">
              <MascotArt state={mascot.mascot} className="size-9" />
              <p className="rounded-full rounded-bl-sm bg-white px-3 py-1 text-[0.8125rem] font-medium text-ink-700 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
                {mascot.line}
              </p>
              {prefilled ? (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-signal-soft px-2.5 py-1 text-[0.75rem] font-medium text-signal-deep">
                  <Check className="size-3.5" aria-hidden />
                  From your preview
                </span>
              ) : null}
            </div>

            <div className="mt-5">
              <h1 className="text-display-sm text-ink-950">{step.title}</h1>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">{step.subtitle}</p>
            </div>

            <div className="mt-7 space-y-3">
              {step.id === "status"
                ? studentStatuses.map((choice) => (
                    <OptionRow
                      key={choice.value}
                      {...choice}
                      selected={answers.status === choice.value}
                      onSelect={() =>
                        update({ status: choice.value, movingSoon: choice.value === "moving-soon" })
                      }
                    />
                  ))
                : null}

              {step.id === "city" ? <CityStep answers={answers} update={update} /> : null}

              {step.id === "university" ? <UniversityStep answers={answers} update={update} /> : null}

              {step.id === "home" ? <HomeStep answers={answers} update={update} /> : null}

              {step.id === "budget" ? (
                <BudgetStep answers={answers} update={update} symbol={symbol} where={where} />
              ) : null}

              {step.id === "money-goals"
                ? moneyGoals.map((choice) => (
                    <OptionRow
                      key={choice.value}
                      {...choice}
                      multi
                      selected={answers.moneyGoals.includes(choice.value)}
                      onSelect={() => update({ moneyGoals: toggle(answers.moneyGoals, choice.value) })}
                    />
                  ))
                : null}

              {step.id === "interests" ? <InterestsStep answers={answers} update={update} /> : null}

              {step.id === "social"
                ? socialGoals.map((choice) => (
                    <OptionRow
                      key={choice.value}
                      {...choice}
                      multi
                      selected={answers.socialGoals.includes(choice.value)}
                      onSelect={() => {
                        /* "Mostly private" is exclusive: ticking it clears the
                           rest, and ticking anything else clears it. Anything
                           less makes a contradictory privacy setting. */
                        if (choice.value === "private") {
                          update({
                            socialGoals: answers.socialGoals.includes("private") ? [] : ["private"],
                          });
                          return;
                        }
                        const without = answers.socialGoals.filter((goal) => goal !== "private");
                        update({ socialGoals: toggle(without, choice.value) });
                      }}
                    />
                  ))
                : null}

              {step.id === "food"
                ? diets.map((choice) => (
                    <OptionRow
                      key={choice.value}
                      {...choice}
                      multi
                      selected={answers.diets.includes(choice.value)}
                      onSelect={() => {
                        if (choice.value === "no-preference") {
                          update({
                            diets: answers.diets.includes("no-preference") ? [] : ["no-preference"],
                          });
                          return;
                        }
                        const without = answers.diets.filter((diet) => diet !== "no-preference");
                        update({ diets: toggle(without, choice.value) });
                      }}
                    />
                  ))
                : null}

              {step.id === "transport" ? <TransportStep answers={answers} update={update} /> : null}

              {step.id === "price"
                ? priceSensitivities.map((choice) => (
                    <OptionRow
                      key={choice.value}
                      {...choice}
                      selected={answers.priceSensitivity === choice.value}
                      onSelect={() => update({ priceSensitivity: choice.value })}
                    />
                  ))
                : null}

              {step.id === "notifications" ? (
                <NotificationsStep answers={answers} update={update} />
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        {error ? (
          <p role="alert" className="mt-5 rounded-lg bg-pulse-soft px-3 py-2.5 text-sm text-pulse-deep">
            {error}
          </p>
        ) : null}

        {/* ---- navigation ------------------------------------------------------
            Sticky on mobile, because the interests step is taller than a phone
            and a Continue button below the fold is one nobody finds. */}
        <div className="sticky bottom-0 mt-8 flex items-center gap-3 bg-paper/85 py-4 backdrop-blur-sm">
          {index > 0 ? (
            <Button variant="ghost" size="md" onClick={() => go(index - 1)} aria-label="Back">
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}

          <Button variant="primary" size="lg" block onClick={next} disabled={!canContinue || pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {index === onboardingSteps.length - 1 ? `Enter ${brand.name}` : "Continue"}
            {index < onboardingSteps.length - 1 ? <ArrowRight className="size-4" /> : null}
          </Button>

          {step.optional ? (
            <Button variant="ghost" size="md" onClick={next} className="shrink-0">
              Skip
            </Button>
          ) : null}
        </div>

        {step.id === "interests" && answers.interests.length < MIN_INTERESTS ? (
          <p className="pb-4 text-center text-[0.8125rem] text-ink-500">
            Pick at least {MIN_INTERESTS} so recommendations are actually yours.
          </p>
        ) : (
          <p className="hidden pb-4 text-center text-xs text-ink-400 sm:block">
            Press Enter to continue
          </p>
        )}
      </div>

      <SoFarPanel answers={answers} city={city} where={where} furthest={furthest} onJump={go} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Four chapters instead of one bar. Each fills as its own steps are done, and
 * the label under the current one is the only dark text. The overall figure is
 * still exposed as a progressbar for assistive tech — the count is honest, it
 * is just not the thing a sighted student needs to read.
 */
function ChapterProgress({ index }: { index: number }) {
  const current = chapterOf(onboardingSteps[index].id);
  const percent = Math.round(((index + 1) / onboardingSteps.length) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Setup progress: step ${index + 1} of ${onboardingSteps.length}`}
      className="grid grid-cols-4 gap-2"
    >
      {CHAPTERS.map((chapter, chapterIndex) => {
        const stepIndexes = chapter.steps.map((id) => onboardingSteps.findIndex((s) => s.id === id));
        const first = Math.min(...stepIndexes);
        const done = Math.max(0, Math.min(chapter.steps.length, index - first + 1));
        const fill = chapterIndex < current ? 100 : chapterIndex > current ? 0 : (done / chapter.steps.length) * 100;
        return (
          <div key={chapter.label} className="min-w-0">
            <div className="h-1 overflow-hidden rounded-full bg-ink-200">
              <div
                className="h-full rounded-full bg-ink-950 transition-[width] duration-500 ease-[var(--ease-out-soft)]"
                style={{ width: `${fill}%` }}
              />
            </div>
            <p
              className={cn(
                "mt-2 truncate font-mono text-micro tracking-[0.1em] uppercase",
                chapterIndex === current ? "text-ink-950" : "text-ink-400",
              )}
            >
              {chapter.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* So far                                                                      */
/* -------------------------------------------------------------------------- */

type Row = {
  key: string;
  label: string;
  value: string | null;
  sub?: string;
  step: OnboardingStepId;
  preview?: boolean;
};

/**
 * What setup has learned, as rows. Every value is an answer the student gave,
 * or a default they have already been shown on its own step (price and alerts
 * only appear once reached, so an untouched default never passes as a choice).
 */
function soFarRows(answers: Answers, city: CityContext | null, where: MoneyLocale, furthest: number): Row[] {
  const fromPreview = answers.fromPreview as string[];
  const reached = (id: OnboardingStepId) => onboardingSteps.findIndex((s) => s.id === id) <= furthest;
  const monthly = monthlyFrom(answers);
  const chosenInterests = allInterests.filter((item) => answers.interests.includes(item.value));
  const status = studentStatuses.find((choice) => choice.value === answers.status);

  return [
    { key: "status", label: "You", value: status?.label ?? null, step: "status" },
    {
      key: "city",
      label: "City",
      value: city ? city.name : null,
      sub: city ? `${city.country} · prices in ${city.currency.code}` : undefined,
      step: "city",
      preview: fromPreview.includes("city"),
    },
    ...(answers.movingSoon && answers.arrivingOn
      ? [{ key: "arriving", label: "Arriving", value: dayLabel(answers.arrivingOn), step: "city" as const }]
      : []),
    {
      key: "university",
      label: "Campus",
      value: answers.universityName || null,
      step: "university",
      preview: fromPreview.includes("university"),
    },
    { key: "home", label: "Area", value: answers.homeArea || null, step: "home" },
    {
      key: "budget",
      label: "Budget",
      value: monthly > 0 ? `${money(monthly, where)} a month` : null,
      sub: monthly > 0 ? `about ${money(Math.floor((monthly / 30) * 10) / 10, where)} a day` : undefined,
      step: "budget",
      preview: fromPreview.includes("budget"),
    },
    {
      key: "interests",
      label: "Into",
      value:
        chosenInterests.length > 0
          ? `${chosenInterests
              .slice(0, 6)
              .map((item) => item.emoji ?? "")
              .join(" ")}${chosenInterests.length > 6 ? ` +${chosenInterests.length - 6}` : ""}`
          : null,
      sub: chosenInterests.length > 0 ? `${chosenInterests.length} interests` : undefined,
      step: "interests",
      preview: fromPreview.includes("interests"),
    },
    {
      key: "social",
      label: "Social",
      value: answers.socialGoals.includes("private")
        ? "Mostly private"
        : answers.socialGoals.length > 0
          ? `${answers.socialGoals.length} ${answers.socialGoals.length === 1 ? "goal" : "goals"}`
          : null,
      step: "social",
    },
    {
      key: "food",
      label: "Food",
      value:
        answers.diets.length > 0
          ? diets
              .filter((diet) => answers.diets.includes(diet.value))
              .map((diet) => diet.label)
              .join(", ")
          : null,
      step: "food",
    },
    {
      key: "transport",
      label: "Getting around",
      value:
        answers.transport.length > 0
          ? transportModes
              .filter((mode) => answers.transport.includes(mode.value))
              .map((mode) => mode.emoji ?? mode.label)
              .join(" ")
          : null,
      sub:
        answers.transport.length > 0
          ? answers.maxTravelMinutes === "90"
            ? "anywhere good"
            : `up to ${answers.maxTravelMinutes} min`
          : undefined,
      step: "transport",
    },
    {
      key: "price",
      label: "Picking places",
      value: reached("price")
        ? (priceSensitivities.find((choice) => choice.value === answers.priceSensitivity)?.label ?? null)
        : null,
      step: "price",
    },
    {
      key: "alerts",
      label: "Alerts",
      value: reached("notifications") ? `${answers.notificationTopics.length} on` : null,
      step: "notifications",
    },
  ];
}

function SoFarPanel({
  answers,
  city,
  where,
  furthest,
  onJump,
}: {
  answers: Answers;
  city: CityContext | null;
  where: MoneyLocale;
  furthest: number;
  onJump: (index: number) => void;
}) {
  const rows = soFarRows(answers, city, where, furthest);
  const filled = rows.filter((row) => row.value).length;

  return (
    <aside aria-label="What StudentOS knows so far" className="hidden lg:block">
      <div className="sticky top-8 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-float)] ring-1 ring-ink-950/6">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-paper/70 px-4 py-3">
          <p className="font-mono text-micro tracking-[0.12em] text-ink-500 uppercase">
            Your {brand.name} so far
          </p>
          <span className="tnum font-mono text-micro text-ink-400">
            {filled}/{rows.length}
          </span>
        </div>

        <ul className="divide-y divide-ink-100">
          {rows.map((row) => {
            const stepIndex = onboardingSteps.findIndex((s) => s.id === row.step);
            const canJump = row.value !== null && stepIndex <= furthest;
            const body = (
              <>
                <span className="w-24 shrink-0 text-[0.75rem] text-ink-500">{row.label}</span>
                <span className="min-w-0 flex-1 text-right">
                  {row.value ? (
                    <>
                      <span className="block truncate text-[0.875rem] font-medium text-ink-950">
                        {row.value}
                      </span>
                      {row.sub ? (
                        <span className="block truncate text-[0.75rem] text-ink-500">{row.sub}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[0.8125rem] text-ink-300">Not yet</span>
                  )}
                </span>
                {row.preview ? (
                  <span
                    title="From your preview"
                    className="size-1.5 shrink-0 rounded-full bg-signal-deep"
                    aria-label="From your preview"
                  />
                ) : null}
              </>
            );

            return (
              <li key={row.key}>
                {canJump ? (
                  <button
                    type="button"
                    onClick={() => onJump(stepIndex)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper-2"
                    aria-label={`Change ${row.label.toLowerCase()}: ${row.value}`}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="border-t border-ink-100 px-4 py-3 text-[0.75rem] leading-relaxed text-ink-500">
          Only what you tell it. Tap a line to change it.
        </p>
      </div>
    </aside>
  );
}

/** The same learning, as one line under the progress bar, for phones. */
function SoFarStrip({
  answers,
  city,
  where,
}: {
  answers: Answers;
  city: CityContext | null;
  where: MoneyLocale;
}) {
  const monthly = monthlyFrom(answers);
  const bits = [
    city ? `${city.name} · ${city.currency.code}` : null,
    answers.universityName || null,
    monthly > 0 ? `${money(monthly, where)}/mo` : null,
    answers.interests.length > 0 ? `${answers.interests.length} interests` : null,
  ].filter((bit): bit is string => Boolean(bit));

  if (bits.length === 0) return null;

  return (
    <ul aria-label="What StudentOS knows so far" className="mt-5 flex flex-wrap gap-1.5 lg:hidden">
      {bits.map((bit) => (
        <li
          key={bit}
          className="max-w-full truncate rounded-full bg-white px-2.5 py-1 text-[0.75rem] font-medium text-ink-700 ring-1 ring-ink-950/8"
        >
          {bit}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

type StepProps = { answers: Answers; update: (patch: Partial<Answers>) => void };

function CityStep({ answers, update }: StepProps) {
  const [query, setQuery] = useState("");
  const deep = cityDirectory.filter((city) => city.deep);
  /* Accent-insensitive and ranked. A plain `includes` on a lowercased name
     found none of Málaga, Kraków, São Paulo, Bogotá or Zürich.

     SEARCHES THE WHOLE DIRECTORY, NOT `rest`. The five deep cities are drawn
     as buttons above, and the search used to exclude them, so typing "madrid"
     produced "Not on the list yet" about the flagship city sitting a few
     centimetres higher. `tests/e2e/onboarding-city.spec.ts` drives the box. */
  const matches = useMemo(() => searchCities(cityDirectory, query, 30), [query]);
  const needle = query.trim();
  const chosen = answers.citySlug ? resolveCity(answers.citySlug) : null;

  const pick = (slug: string) =>
    update({ citySlug: slug, institutionId: null, campusSlug: null, universityName: "" });

  return (
    <>
      {deep.map((city) => (
        <OptionRow
          key={city.slug}
          label={city.name}
          detail={`${city.country} · ${cityStatusLabel[city.status]}`}
          selected={answers.citySlug === city.slug}
          onSelect={() => pick(city.slug)}
        />
      ))}

      <div className="pt-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">Somewhere else?</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${cityDirectory.length} cities`}
            className="h-12 w-full rounded-xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 hover:border-ink-300"
          />
        </label>
        {chosen && !chosen.deep ? (
          <p className="mt-2 rounded-xl bg-signal-soft px-3.5 py-2.5 text-[0.875rem] text-ink-800">
            <span className="font-medium">
              {chosen.name}, {chosen.country}
            </span>{" "}
            · {cityStatusLabel[chosen.status]}. Budget, planner and Arrival Mode work from day one;
            local places and events fill in as students add them.
          </p>
        ) : null}
        {matches.length > 0 ? (
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-ink-200 bg-white">
            {matches.map(({ city }) => (
              <li key={city.slug}>
                <button
                  type="button"
                  onClick={() => {
                    pick(city.slug);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-paper-2",
                    answers.citySlug === city.slug && "bg-signal-soft",
                  )}
                >
                  <span className="text-[0.9375rem] text-ink-900">
                    {city.name} <span className="text-ink-500">· {city.country}</span>
                  </span>
                  <span className="text-[0.75rem] text-ink-500">{cityStatusLabel[city.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : needle ? (
          <p className="mt-2 text-[0.8125rem] text-ink-500">
            Not on the list yet. Pick the nearest city; we note what students ask for.
          </p>
        ) : null}
      </div>

      {/* WHAT THIS CONTROL DOES. There is no translation layer in this codebase:
          the interface is English whatever is picked. The choice feeds
          `formatLocaleFor` → `profile.locale`, which formats every price and
          date. It is named for that effect, not for a translation it does not
          perform. */}
      <label className="block pt-2">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">Number and date format</span>
        <select
          value={answers.language}
          onChange={(event) => update({ language: event.target.value })}
          className="h-12 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900"
        >
          {interfaceLanguages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.endonym} · {language.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[0.8125rem] text-ink-500">
          How prices, dates and numbers are written for you. The interface itself is in English for
          now.
        </span>
      </label>

      {answers.citySlug ? (
        <div className="space-y-4 rounded-2xl border border-ink-200 bg-white p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={answers.movingSoon}
              onChange={(event) => update({ movingSoon: event.target.checked })}
              className="size-4 rounded-xs border-ink-300"
            />
            <span className="text-[0.9375rem] text-ink-800">I am moving there soon</span>
          </label>

          {answers.movingSoon ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-800">Arriving</span>
                <input
                  type="date"
                  value={answers.arrivingOn}
                  onChange={(event) => update({ arrivingOn: event.target.value })}
                  className="h-12 w-full rounded-xl border border-ink-200 bg-white px-3 text-[0.9375rem] text-ink-900"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-800">
                  Leaving <span className="font-normal text-ink-400">(optional)</span>
                </span>
                <input
                  type="date"
                  value={answers.leavingOn}
                  onChange={(event) => update({ leavingOn: event.target.value })}
                  className="h-12 w-full rounded-xl border border-ink-200 bg-white px-3 text-[0.9375rem] text-ink-900"
                />
              </label>
            </div>
          ) : null}

          <div>
            <span className="mb-2 block text-sm font-medium text-ink-800">Where are you staying?</span>
            <div className="flex flex-wrap gap-2">
              {housingSituations.map((choice) => (
                <SelectChip
                  key={choice.value}
                  label={choice.label}
                  selected={answers.housing === choice.value}
                  onSelect={() => update({ housing: choice.value })}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function UniversityStep({ answers, update }: StepProps) {
  const city = answers.citySlug ? resolveCity(answers.citySlug) : null;

  return (
    <UniversityPicker
      cityName={city?.name ?? "your city"}
      citySlug={answers.citySlug}
      countryCode={city?.countryCode ?? null}
      choice={
        answers.universityName
          ? {
              institutionId: answers.institutionId,
              campusSlug: answers.campusSlug,
              name: answers.universityName,
            }
          : null
      }
      onPick={(choice) =>
        update({
          institutionId: choice.institutionId,
          campusSlug: choice.campusSlug,
          universityName: choice.name,
        })
      }
      onClear={() => update({ institutionId: null, campusSlug: null, universityName: "" })}
    />
  );
}

function HomeStep({ answers, update }: StepProps) {
  /**
   * The city's districts, fetched rather than bundled — the area registry is a
   * thousand-odd rows and this is the screen where download cost is paid by
   * someone with no reason yet to wait. See `src/server/actions/areas.ts`.
   *
   * The result is stored WITH the city it belongs to and read back only when
   * the two still agree, so tapping back and picking another city never shows
   * the previous city's chips, and the effect never has to clear state.
   */
  const citySlug = answers.citySlug;
  const [fetched, setFetched] = useState<{ citySlug: string; names: readonly string[] } | null>(null);

  useEffect(() => {
    if (!citySlug) return;
    let live = true;
    areaNamesFor(citySlug)
      .then((names) => {
        if (live) setFetched({ citySlug, names });
      })
      .catch(() => {
        /* The chips are an accelerator; the free-text box is the answer. */
        if (live) setFetched({ citySlug, names: [] });
      });
    return () => {
      live = false;
    };
  }, [citySlug]);

  const neighbourhoods = fetched && fetched.citySlug === citySlug ? fetched.names : NO_AREAS;

  return (
    <>
      {/* WHAT THIS COLLECTS, said accurately: an area name, never an address.
          `homePoint` is not written by any screen, so nothing here becomes a
          walking minute, and the copy does not claim it does. */}
      <div className="flex items-start gap-3 rounded-2xl border border-flow-deep/20 bg-flow-soft/60 p-4">
        <Lock className="mt-0.5 size-4 shrink-0 text-flow-deep" />
        <p className="text-[0.875rem] leading-relaxed text-flow-deep">
          Just the area, never a street or a number. It sorts what is near you and works out commute
          times, and it is never attached to a post or used to match you with anyone.
        </p>
      </div>

      {neighbourhoods.length > 0 ? (
        <>
          <span className="block pt-2 text-sm font-medium text-ink-800">
            Pick the neighbourhood you are closest to
          </span>
          <div className="flex flex-wrap gap-2">
            {neighbourhoods.map((area) => (
              <SelectChip
                key={area}
                label={area}
                selected={answers.homeArea === area}
                onSelect={() => update({ homeArea: answers.homeArea === area ? "" : area })}
              />
            ))}
          </div>
        </>
      ) : null}

      {/* FREE TEXT, ALWAYS. Most cities have no area list yet, and an empty
          step with nothing to tap is how a student concludes it is broken. */}
      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">
          {neighbourhoods.length > 0 ? "Or type it" : "Which area are you in?"}
        </span>
        <input
          value={answers.homeArea}
          onChange={(event) => update({ homeArea: event.target.value })}
          placeholder="The area you live in"
          maxLength={120}
          className="h-12 w-full rounded-xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400"
        />
      </label>
    </>
  );
}

function BudgetStep({
  answers,
  update,
  symbol,
  where,
}: StepProps & { symbol: string; where: MoneyLocale }) {
  const monthly = monthlyFrom(answers);
  const daily = Math.floor((monthly / 30) * 10) / 10;
  const weekly = Math.round((monthly / 30) * 7);

  return (
    <>
      <div className="flex gap-2">
        {(["simple", "detailed"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => update({ budgetMode: mode })}
            aria-pressed={answers.budgetMode === mode}
            className={cn(
              "h-10 flex-1 rounded-full border text-[0.875rem] font-medium transition-colors",
              answers.budgetMode === mode
                ? "border-ink-950 bg-ink-950 text-paper"
                : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
            )}
          >
            {mode === "simple" ? "One number" : "Category by category"}
          </button>
        ))}
      </div>

      {answers.budgetMode === "simple" ? (
        <div className="space-y-4 pt-2">
          <MoneyInput
            large
            label="Roughly per month"
            symbol={symbol}
            value={answers.monthlyTotal}
            onChange={(value) => update({ monthlyTotal: value })}
            placeholder="800"
            hint="We split this into categories you can edit later."
          />
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={answers.excludeHousing}
              onChange={(event) => update({ excludeHousing: event.target.checked })}
              className="size-4 rounded-xs border-ink-300"
            />
            <span className="text-[0.9375rem] text-ink-800">
              Rent is handled separately — do not include it
            </span>
          </label>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {budgetCategories.map((category) => (
            <MoneyInput
              key={category.key}
              label={category.label}
              symbol={symbol}
              value={answers.categoryAmounts[category.key] ?? ""}
              onChange={(value) =>
                update({ categoryAmounts: { ...answers.categoryAmounts, [category.key]: value } })
              }
              hint={category.hint}
            />
          ))}
        </div>
      )}

      {/* The number turned into the two a student actually lives by. Plain
          division, labelled as rough, in the city's currency. */}
      {monthly > 0 ? (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-ink-200">
          <div className="bg-white px-4 py-3">
            <dt className="font-mono text-micro tracking-[0.1em] text-ink-500 uppercase">About a day</dt>
            <dd className="tnum mt-1 font-mono text-xl font-semibold text-flow-deep">
              {money(daily, where)}
            </dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="font-mono text-micro tracking-[0.1em] text-ink-500 uppercase">About a week</dt>
            <dd className="tnum mt-1 font-mono text-xl font-semibold text-flow-deep">
              {money(weekly, where)}
            </dd>
          </div>
        </dl>
      ) : null}
    </>
  );
}

function InterestsStep({ answers, update }: StepProps) {
  return (
    <div className="space-y-5">
      {interestGroups.map((group) => (
        <div key={group.title}>
          <h2 className="mb-2.5 font-mono text-micro tracking-[0.14em] text-ink-500 uppercase">
            {group.title}
          </h2>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <SelectChip
                key={item.value}
                label={item.label}
                emoji={item.emoji}
                selected={answers.interests.includes(item.value)}
                onSelect={() => update({ interests: toggle(answers.interests, item.value) })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TransportStep({ answers, update }: StepProps) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {transportModes.map((mode) => (
          <SelectChip
            key={mode.value}
            label={mode.label}
            emoji={mode.emoji}
            selected={answers.transport.includes(mode.value)}
            onSelect={() => update({ transport: toggle(answers.transport, mode.value) })}
          />
        ))}
      </div>

      <span className="block pt-4 text-sm font-medium text-ink-800">
        How far will you go for something good?
      </span>
      <div className="space-y-3">
        {travelLimits.map((limit) => (
          <OptionRow
            key={limit.value}
            {...limit}
            selected={answers.maxTravelMinutes === limit.value}
            onSelect={() => update({ maxTravelMinutes: limit.value })}
          />
        ))}
      </div>
    </>
  );
}

function NotificationsStep({ answers, update }: StepProps) {
  return (
    <>
      {notificationTopics.map((topic) => (
        <OptionRow
          key={topic.value}
          label={topic.label}
          detail={topic.detail}
          multi
          selected={answers.notificationTopics.includes(topic.value)}
          onSelect={() => update({ notificationTopics: toggle(answers.notificationTopics, topic.value) })}
        />
      ))}
      <p className="pt-1 text-[0.8125rem] leading-relaxed text-ink-500">
        Everything except budget warnings starts off. We would rather you turn things on than dig
        through settings turning them off.
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Build screen                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The reveal. The write has already completed by the time this renders, so
 * each line names something that now exists on the account — with its actual
 * value, which is the difference between a reveal and a loading spinner with
 * captions.
 */
function BuildingScreen({
  answers,
  city,
  where,
}: {
  answers: Answers;
  city: CityContext | null;
  where: MoneyLocale;
}) {
  const monthly = monthlyFrom(answers);
  const lines = [
    city ? `${city.name}, priced in ${city.currency.code}` : "Your city",
    monthly > 0
      ? `${money(monthly, where)} a month · about ${money(Math.floor((monthly / 30) * 10) / 10, where)} a day`
      : "A budget you can set any time",
    answers.universityName || "Campus: add it whenever",
    `${answers.interests.length} interests, ranked into everything`,
    "Your Today screen",
  ];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center py-12 text-center">
      <MascotArt state="thinking" idle className="size-28" />

      <h1 className="mt-8 text-display-sm text-ink-950">Building your {brand.name}.</h1>

      <ul className="mt-8 w-full max-w-sm space-y-2">
        {lines.map((line, lineIndex) => (
          <li
            key={line}
            className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-left text-[0.9375rem] text-ink-800"
            style={{ animation: "rise 0.5s var(--ease-out-soft) both", animationDelay: `${lineIndex * 0.32}s` }}
          >
            <Check className="size-4 shrink-0 text-mint-deep" aria-hidden />
            <span className="min-w-0 truncate">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
