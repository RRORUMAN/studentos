"use client";

import { ArrowLeft, ArrowRight, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { MoneyInput, OptionRow, Progress, SelectChip } from "@/components/onboarding/controls";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Button } from "@/components/ui/button";
import { brand } from "@/brand/brand.config";
import {
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
} from "@/config/onboarding";
import { cityDirectory, cityStatusLabel, resolveCity } from "@/data/cities";
import { searchCities } from "@/domain/cities";
import { UniversityPicker } from "@/components/onboarding/university-picker";
import { interfaceLanguages } from "@/config/regions";
import { areaNamesFor } from "@/server/actions/areas";
import { completeOnboarding, type OnboardingInput } from "@/server/actions/onboarding";
import { cn } from "@/lib/utils";

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
 * either exists properly or does not exist at all.
 *
 * The counterpart to that decision is the draft in `sessionStorage`: a refresh
 * mid-flow restores the answers, so nothing is lost even though nothing has
 * been sent yet.
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
};

const DRAFT_KEY = `${brand.slug}:onboarding-draft`;

/** One frozen empty array, so "no areas yet" is a stable reference. */
const NO_AREAS: readonly string[] = Object.freeze([]);

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function SetupFlow() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [answers, setAnswers] = useState<Answers>(() => {
    if (typeof window === "undefined") return INITIAL;
    try {
      const saved = window.sessionStorage.getItem(DRAFT_KEY);
      return saved ? { ...INITIAL, ...(JSON.parse(saved) as Partial<Answers>) } : INITIAL;
    } catch {
      /* A corrupt or blocked storage entry must never stop sign-up. */
      return INITIAL;
    }
  });

  const [index, setIndex] = useState(0);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((patch: Partial<Answers>) => {
    setAnswers((current) => {
      const next = { ...current, ...patch };
      try {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {
        /* Private mode. The flow still works, it just will not survive a
           refresh — which is a far better outcome than throwing here. */
      }
      return next;
    });
  }, []);

  const step = onboardingSteps[index];
  const city = useMemo(
    () => (answers.citySlug ? resolveCity(answers.citySlug) : null),
    [answers.citySlug],
  );
  const symbol = city?.currency.symbol ?? "€";

  /* Which steps can advance. Only three questions are genuinely required. */
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

      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* Nothing to clean up if storage was never available. */
      }

      /* Let the build animation land before moving. It is not a fake loader —
         the write above has already happened; this is the reveal. */
      setTimeout(() => router.push("/home"), 2200);
    });
  }, [answers, router]);

  const next = useCallback(() => {
    if (index === onboardingSteps.length - 1) submit();
    else setIndex((current) => current + 1);
  }, [index, submit]);

  if (building) return <BuildingScreen cityName={city?.name ?? "your city"} />;

  return (
    <div className="mx-auto w-full max-w-lg">
      <Progress
        value={(index + 1) / onboardingSteps.length}
        label={`Setup progress: ${index + 1} of ${onboardingSteps.length}`}
      />

      <div className="mt-8">
        <h1 className="text-display-xs text-ink-950 sm:text-display-sm">{step.title}</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">{step.subtitle}</p>
      </div>

      <div className="mt-7 space-y-3">
        {step.id === "status" ? (
          studentStatuses.map((choice) => (
            <OptionRow
              key={choice.value}
              {...choice}
              selected={answers.status === choice.value}
              onSelect={() =>
                update({
                  status: choice.value,
                  movingSoon: choice.value === "moving-soon",
                })
              }
            />
          ))
        ) : null}

        {step.id === "city" ? (
          <CityStep answers={answers} update={update} />
        ) : null}

        {step.id === "university" ? (
          <UniversityStep answers={answers} update={update} />
        ) : null}

        {step.id === "home" ? <HomeStep answers={answers} update={update} /> : null}

        {step.id === "budget" ? (
          <BudgetStep answers={answers} update={update} symbol={symbol} />
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

        {step.id === "interests" ? (
          <InterestsStep answers={answers} update={update} />
        ) : null}

        {step.id === "social"
          ? socialGoals.map((choice) => (
              <OptionRow
                key={choice.value}
                {...choice}
                multi
                selected={answers.socialGoals.includes(choice.value)}
                onSelect={() => {
                  /* "Mostly private" is exclusive: ticking it clears the rest,
                     and ticking anything else clears it. Anything less makes
                     for a contradictory privacy setting. */
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
                    update({ diets: answers.diets.includes("no-preference") ? [] : ["no-preference"] });
                    return;
                  }
                  const without = answers.diets.filter((diet) => diet !== "no-preference");
                  update({ diets: toggle(without, choice.value) });
                }}
              />
            ))
          : null}

        {step.id === "transport" ? (
          <TransportStep answers={answers} update={update} />
        ) : null}

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

      {error ? (
        <p role="alert" className="mt-5 rounded-md bg-pulse-soft px-3 py-2.5 text-sm text-pulse-deep">
          {error}
        </p>
      ) : null}

      {/* ---- navigation ----------------------------------------------------
          Sticky on mobile, because the interests step is taller than a phone
          and a Continue button below the fold is a Continue button nobody
          finds. */}
      <div className="sticky bottom-0 mt-8 flex items-center gap-3 bg-paper/85 py-4 backdrop-blur-sm">
        {index > 0 ? (
          <Button
            variant="ghost"
            size="md"
            onClick={() => setIndex((current) => current - 1)}
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </Button>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          block
          onClick={next}
          disabled={!canContinue || pending}
        >
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
        <p className="pb-4 text-center text-[0.8125rem] text-ink-400">
          Pick at least {MIN_INTERESTS} so recommendations are actually yours.
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

type StepProps = { answers: Answers; update: (patch: Partial<Answers>) => void };

function CityStep({ answers, update }: StepProps) {
  const [query, setQuery] = useState("");
  const deep = cityDirectory.filter((city) => city.deep);
  const rest = cityDirectory.filter((city) => !city.deep);
  /* Accent-insensitive and ranked. A plain `includes` on a lowercased name
     found none of Málaga, Kraków, São Paulo, Bogotá or Zürich, which meant a
     student in Málaga typing "malaga" was told their city was not on the list
     — the product lying about its own coverage. */
  const matches = useMemo(() => searchCities(rest, query, 30), [rest, query]);
  const needle = query.trim();
  const chosen = answers.citySlug ? resolveCity(answers.citySlug) : null;

  return (
    <>
      {deep.map((city) => (
        <OptionRow
          key={city.slug}
          label={city.name}
          detail={`${city.country} · ${cityStatusLabel[city.status]}`}
          selected={answers.citySlug === city.slug}
          onSelect={() => update({ citySlug: city.slug, institutionId: null, campusSlug: null, universityName: "" })}
        />
      ))}

      <div className="pt-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">Somewhere else?</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${rest.length} more cities`}
            className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
          />
        </label>
        {chosen && !chosen.deep ? (
          <p className="mt-2 rounded-lg bg-signal-soft px-3 py-2 text-[0.875rem] text-ink-800">
            {chosen.name}, {chosen.country} · {cityStatusLabel[chosen.status]}. Budget, planner and
            Arrival Mode work from day one; local places and events fill in as students add them.
          </p>
        ) : null}
        {matches.length > 0 ? (
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-ink-200 bg-white">
            {matches.map(({ city }) => (
              <li key={city.slug}>
                <button
                  type="button"
                  onClick={() => {
                    update({ citySlug: city.slug, institutionId: null, campusSlug: null, universityName: "" });
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-paper-2",
                    answers.citySlug === city.slug && "bg-signal-soft",
                  )}
                >
                  <span className="text-[0.9375rem] text-ink-900">
                    {city.name} <span className="text-ink-500">· {city.country}</span>
                  </span>
                  <span className="text-[0.75rem] text-ink-400">{cityStatusLabel[city.status]}</span>
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

      <label className="block pt-2">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">Interface language</span>
        <select
          value={answers.language}
          onChange={(event) => update({ language: event.target.value })}
          className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-[0.9375rem] text-ink-900"
        >
          {interfaceLanguages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.endonym} · {language.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[0.8125rem] text-ink-500">
          Prices and dates always use the city&rsquo;s format. This only changes the interface.
        </span>
      </label>

      <p className="pt-1 text-[0.8125rem] leading-relaxed text-ink-500">
        Five cities have full local data. Everywhere else, the budget, planner and Arrival Mode
        work from official data and the community opens with the first post.
      </p>

      {answers.citySlug ? (
        <div className="space-y-4 rounded-lg border border-ink-200 bg-white p-4">
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
                  className="h-12 w-full rounded-md border border-ink-200 bg-white px-3 text-[0.9375rem] text-ink-900"
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
                  className="h-12 w-full rounded-md border border-ink-200 bg-white px-3 text-[0.9375rem] text-ink-900"
                />
              </label>
            </div>
          ) : null}

          <div>
            <span className="mb-2 block text-sm font-medium text-ink-800">
              Where are you staying?
            </span>
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
   * The city's districts, fetched rather than bundled.
   *
   * `city.neighbourhoods` — a hand-written list that exists for five cities —
   * used to be the only source here, which is why this step had nothing to tap
   * for the other seventy-five. The area registry covers all eighty now, but it
   * is around nine hundred rows and this is the screen where download cost is
   * paid by someone with no reason yet to wait, so it comes over the wire for
   * the one city the student picked. See `src/server/actions/areas.ts`.
   *
   * A failed or slow fetch costs nothing: the chips are an accelerator and the
   * free-text box below is the actual answer, always present and never gated on
   * this having arrived.
   */
  const citySlug = answers.citySlug;

  /**
   * The result is stored WITH the city it belongs to, and read back only when
   * the two still agree.
   *
   * That is what makes this correct when a student taps back and picks a
   * different city: the previous city's chips are gone on the render that
   * changes `citySlug`, not on whenever its request happens to settle. It also
   * means the effect never has to clear anything, which matters because
   * `setState` called synchronously in an effect body is a cascading render
   * and React's own lint rule refuses it.
   */
  const [fetched, setFetched] = useState<{ citySlug: string; names: readonly string[] } | null>(
    null,
  );

  useEffect(() => {
    if (!citySlug) return;
    /* A response that arrives after the student has moved on is dropped rather
       than rendered — belt to the braces of the check below. */
    let live = true;
    areaNamesFor(citySlug)
      .then((names) => {
        if (live) setFetched({ citySlug, names });
      })
      .catch(() => {
        /* The chips are an accelerator; the free-text box below is the answer.
           A failed lookup costs nothing and must not stall onboarding. */
        if (live) setFetched({ citySlug, names: [] });
      });
    return () => {
      live = false;
    };
  }, [citySlug]);

  const neighbourhoods = fetched && fetched.citySlug === citySlug ? fetched.names : NO_AREAS;

  return (
    <>
      {/* WHAT THIS ACTUALLY COLLECTS, said accurately. This box used to read
          "Your exact address is never shown to another student... It only turns
          distances into walking minutes", which promised two things that were
          not true: the step never asks for an address, and `homePoint` is
          never written by any screen in the product, so nothing here becomes a
          walking minute. Describing the area name as an address also made the
          ask sound far more invasive than it is. */}
      <div className="flex items-start gap-3 rounded-lg border border-flow-deep/20 bg-flow-soft/60 p-4">
        <Lock className="mt-0.5 size-4 shrink-0 text-flow-deep" />
        <p className="text-[0.875rem] leading-relaxed text-flow-deep">
          Just the area, never a street or a number. It is used to sort what is near you and to
          work out commute times, and it is never attached to a post or used to match you with
          anyone.
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

      {/* FREE TEXT, ALWAYS, and this is the whole point of the change. The
          city directory carries a neighbourhood list for five cities out of
          eighty, so this screen used to be a heading telling a student in
          Krakow to pick from an empty list, with nothing to tap and no way to
          answer. The settings version of this control already had the input
          and the comment naming the failure — "an empty step with nothing to
          tap is how a student in Tallinn concluded the product was broken" —
          and it was never ported to the screen where it matters most, which is
          the first five minutes of the product. */}
      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">
          {neighbourhoods.length > 0 ? "Or type it" : "Which area are you in?"}
        </span>
        <input
          value={answers.homeArea}
          onChange={(event) => update({ homeArea: event.target.value })}
          placeholder="The area you live in"
          maxLength={120}
          className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>
    </>
  );
}

function BudgetStep({ answers, update, symbol }: StepProps & { symbol: string }) {
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
    </>
  );
}

function InterestsStep({ answers, update }: StepProps) {
  return (
    <div className="space-y-5">
      {interestGroups.map((group) => (
        <div key={group.title}>
          <h2 className="mb-2.5 font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
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
          onSelect={() =>
            update({ notificationTopics: toggle(answers.notificationTopics, topic.value) })
          }
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
 * The reveal. The write has already completed by the time this renders, so the
 * staggered lines are showing real work rather than padding a spinner — each
 * one names a thing that now exists on the account.
 */
function BuildingScreen({ cityName }: { cityName: string }) {
  const lines = [
    `Your ${cityName}`,
    "Your budget",
    "Your interests",
    "Your campus",
    "Your recommendations",
  ];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center py-16 text-center">
      <MascotArt state="thinking" idle className="size-28" />

      <h1 className="mt-8 text-display-sm text-ink-950">Putting it together.</h1>

      <ul className="mt-8 w-full max-w-xs space-y-2.5">
        {lines.map((line, index) => (
          <li
            key={line}
            className="flex items-center gap-3 rounded-md border border-ink-200 bg-white px-4 py-3 text-left text-[0.9375rem] text-ink-800"
            style={{
              animation: `rise 0.5s var(--ease-out-soft) both`,
              animationDelay: `${index * 0.32}s`,
            }}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-signal" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
