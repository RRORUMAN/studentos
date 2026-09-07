"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import {
  type LanguageLevel,
  type ScheduleTag,
  type SkillKey,
  type WorkGroup,
  type WorkProfile,
  languageLevelLabel,
  scheduleLabel,
  scheduleTags,
  skillKeys,
  skillLabel,
} from "@/domain/work";
import { workRightsDisclaimer } from "@/data/work-rights";
import { saveWorkProfile } from "@/server/actions/work";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * THE WORK PROFILE
 * ----------------------------------------------------------------------------
 * Everything the matcher reads, in one form, and nothing it does not.
 *
 * Two things this form is careful about:
 *
 *   IT IS SKIPPABLE, AND SKIPPING IS A REAL ANSWER. "Not right now" at the top
 *   collapses the rest. A student who does not want to work should not be made
 *   to scroll past a wage floor to leave, and the ranking engine treats every
 *   blank as neutral rather than as zero.
 *
 *   NOTHING HERE IS SHARED BY DEFAULT. `visibleToEmployers` starts off and the
 *   copy beside it names exactly which fields an employer would see — the
 *   quick card — rather than saying "your profile", which could mean anything.
 *
 * The hours field carries the work-rights disclaimer directly, because that is
 * the field where a student is most likely to type a number they are not
 * allowed to work, and the moment to say we cannot check it is there.
 * ============================================================================
 */

const GROUPS: readonly { value: WorkGroup; label: string }[] = [
  { value: "job", label: "Part-time jobs" },
  { value: "gig", label: "One-off gigs" },
  { value: "project", label: "Freelance projects" },
  { value: "internship", label: "Internships" },
];

const LANGUAGES: readonly { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "nl", label: "Dutch" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ca", label: "Catalan" },
];

const LEVELS: readonly LanguageLevel[] = ["basic", "conversational", "fluent", "native"];

export function WorkProfileForm({
  profile,
  currencySymbol,
}: {
  profile: WorkProfile;
  currencySymbol: string;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();

  const [looking, setLooking] = useState(profile.lookingFor);
  const [groups, setGroups] = useState<Set<WorkGroup>>(new Set(profile.groups));
  const [skills, setSkills] = useState<Set<SkillKey>>(new Set(profile.skills));
  const [availability, setAvailability] = useState<Set<ScheduleTag>>(new Set(profile.availability));
  const [languages, setLanguages] = useState<Map<string, LanguageLevel>>(
    new Map(profile.languages.map((entry) => [entry.code, entry.level])),
  );
  const [shared, setShared] = useState(profile.visibleToEmployers);
  const [alerts, setAlerts] = useState(profile.gigAlerts);

  const toggle = <T,>(set: Set<T>, value: T, apply: (next: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  const cents = (value: number | null) => (value === null ? "" : String(value / 100));

  return (
    <form
      action={(formData) =>
        start(async () => {
          const result = await saveWorkProfile(formData);
          toast(
            result.ok
              ? { title: result.message ?? "Saved" }
              : { tone: "warning", title: result.message },
          );
        })
      }
      className="mt-6 space-y-6"
    >
      {/* --- looking? ------------------------------------------------------ */}
      <Field label="Are you looking for work?">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { value: "yes", label: "Yes" },
              { value: "maybe", label: "Maybe, show me what is there" },
              { value: "no", label: "Not right now" },
            ] as const
          ).map((option) => (
            <Pill
              key={option.value}
              active={looking === option.value}
              onClick={() => setLooking(option.value)}
            >
              {option.label}
            </Pill>
          ))}
        </div>
        <input type="hidden" name="lookingFor" value={looking} />
      </Field>

      {looking === "no" ? (
        <p className="rounded-2xl bg-paper-2 px-4 py-3 text-[0.875rem] leading-relaxed text-ink-600">
          Fine. Work stays on the You screen if you change your mind, and nothing about you is shown
          to anybody offering work.
        </p>
      ) : (
        <>
          {/* --- what ------------------------------------------------------ */}
          <Field label="What kind?">
            <div className="flex flex-wrap gap-1.5">
              {GROUPS.map((group) => (
                <Pill
                  key={group.value}
                  active={groups.has(group.value)}
                  onClick={() => toggle(groups, group.value, setGroups)}
                >
                  {group.label}
                </Pill>
              ))}
            </div>
            {[...groups].map((group) => (
              <input key={group} type="hidden" name="group" value={group} />
            ))}
          </Field>

          <Field
            label="What can you do?"
            hint="Not a CV. This decides which postings surface, and an empty list is treated as “no preference”, not “no skills”."
          >
            <div className="flex flex-wrap gap-1.5">
              {skillKeys.map((skill) => (
                <Pill
                  key={skill}
                  active={skills.has(skill)}
                  onClick={() => toggle(skills, skill, setSkills)}
                >
                  {skillLabel[skill]}
                </Pill>
              ))}
            </div>
            {[...skills].map((skill) => (
              <input key={skill} type="hidden" name="skill" value={skill} />
            ))}
          </Field>

          {/* --- languages -------------------------------------------------- */}
          <Field
            label="Languages"
            hint="The single biggest filter on student work abroad, and the one most job boards ignore."
          >
            <ul className="space-y-2">
              {LANGUAGES.map((language) => {
                const level = languages.get(language.code) ?? null;
                return (
                  <li key={language.code} className="flex flex-wrap items-center gap-2">
                    <Pill
                      active={level !== null}
                      onClick={() => {
                        const next = new Map(languages);
                        if (level === null) next.set(language.code, "conversational");
                        else next.delete(language.code);
                        setLanguages(next);
                      }}
                    >
                      {language.label}
                    </Pill>
                    {level !== null ? (
                      <div className="flex flex-wrap gap-1">
                        {LEVELS.map((candidate) => (
                          <button
                            key={candidate}
                            type="button"
                            onClick={() => {
                              const next = new Map(languages);
                              next.set(language.code, candidate);
                              setLanguages(next);
                            }}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors",
                              level === candidate
                                ? "bg-signal text-ink-950"
                                : "bg-paper-2 text-ink-500 hover:text-ink-950",
                            )}
                          >
                            {languageLevelLabel[candidate]}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {[...languages.entries()].map(([code, level]) => (
              <span key={code}>
                <input type="hidden" name="language" value={code} />
                <input type="hidden" name="level" value={level} />
              </span>
            ))}
          </Field>

          {/* --- when ------------------------------------------------------- */}
          <Field label="When are you free?">
            <div className="flex flex-wrap gap-1.5">
              {scheduleTags.map((tag) => (
                <Pill
                  key={tag}
                  active={availability.has(tag)}
                  onClick={() => toggle(availability, tag, setAvailability)}
                >
                  {scheduleLabel[tag]}
                </Pill>
              ))}
            </div>
            {[...availability].map((tag) => (
              <input key={tag} type="hidden" name="availability" value={tag} />
            ))}
          </Field>

          <Field label="Hours a week you want" hint={workRightsDisclaimer}>
            <Number name="hoursPerWeek" defaultValue={profile.hoursPerWeek} min={0} max={40} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Furthest you would travel">
              <Number
                name="maxCommuteMinutes"
                defaultValue={profile.maxCommuteMinutes}
                min={5}
                max={120}
                suffix="minutes"
              />
            </Field>
            <Field label="Least you would work for">
              <Number
                name="minHourly"
                defaultValue={cents(profile.minHourlyCents)}
                step="0.5"
                prefix={currencySymbol}
                suffix="an hour"
              />
            </Field>
          </div>

          <Field label="Remote work">
            <select
              name="remotePreference"
              defaultValue={profile.remotePreference}
              className="w-full rounded-xl bg-white px-3 py-2.5 text-[0.9375rem] text-ink-950 ring-1 ring-ink-950/10"
            >
              <option value="either">Either is fine</option>
              <option value="remote">I would rather work remotely</option>
              <option value="onsite">I would rather be somewhere in person</option>
            </select>
          </Field>

          {/* --- the money loop ---------------------------------------------- */}
          <fieldset id="earn" className="rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
            <legend className="px-1 text-[0.9375rem] font-semibold text-ink-950">
              What you need to earn
            </legend>
            <p className="text-[0.875rem] leading-relaxed text-ink-600">
              These two numbers are what connect Work to your budget. StudentOS uses them to say how
              far short you are and which of the jobs on the board would close it — as an estimate,
              never as a promise.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="I want to earn">
                <Number
                  name="monthlyTarget"
                  defaultValue={cents(profile.monthlyTargetCents)}
                  prefix={currencySymbol}
                  suffix="a month"
                />
              </Field>
              <Field label="Already coming in">
                <Number
                  name="currentIncome"
                  defaultValue={cents(profile.currentIncomeCents)}
                  prefix={currencySymbol}
                  suffix="a month"
                />
              </Field>
            </div>
          </fieldset>

          {/* --- optional ---------------------------------------------------- */}
          <Field label="One line about you" hint="Shown on your quick work card. Optional.">
            <input
              name="headline"
              defaultValue={profile.headline ?? ""}
              maxLength={120}
              placeholder="Third-year marketing student, evenings free, sales experience"
              className="w-full rounded-xl bg-white px-3 py-2.5 text-[0.9375rem] text-ink-950 ring-1 ring-ink-950/10 placeholder:text-ink-300"
            />
          </Field>

          <details className="rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
            <summary className="cursor-pointer text-[0.9375rem] font-semibold text-ink-950">
              CV, portfolio and LinkedIn
            </summary>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-600">
              Links only, and only ever shown to someone you have replied to. StudentOS does not
              host your CV and does not send it anywhere on your behalf.
            </p>
            <div className="mt-3 space-y-3">
              <Text name="cvUrl" label="CV" defaultValue={profile.cvUrl ?? ""} />
              <Text name="portfolioUrl" label="Portfolio" defaultValue={profile.portfolioUrl ?? ""} />
              <Text name="linkedinUrl" label="LinkedIn" defaultValue={profile.linkedinUrl ?? ""} />
            </div>
          </details>

          {/* --- privacy ------------------------------------------------------ */}
          <fieldset className="rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
            <legend className="px-1 text-[0.9375rem] font-semibold text-ink-950">Who can see this</legend>

            <Check
              name="visibleToEmployers"
              checked={shared}
              onChange={setShared}
              label="Let people offering work find me"
              hint="They would see your name, city, campus, that one line, your languages, when you are free and your skills. Not your budget, not where you live, not your CV, not your phone."
            />
            <Check
              name="gigAlerts"
              checked={alerts}
              onChange={setAlerts}
              label="Tell me when a student posts a gig matching my skills"
              hint="Only gigs in your city that match a skill you listed. Never a message to the whole city."
            />
          </fieldset>
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-ink-950 px-5 py-2.5 text-[0.9375rem] font-semibold text-paper transition-colors hover:bg-ink-800 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                                */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[0.9375rem] font-medium text-ink-950">{label}</p>
      {hint ? <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-500">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-[0.875rem] font-medium transition-colors",
        active ? "bg-ink-950 text-paper" : "bg-white text-ink-600 ring-1 ring-ink-950/8 hover:text-ink-950",
      )}
    >
      {children}
    </button>
  );
}

function Number({
  name,
  defaultValue,
  min,
  max,
  step,
  prefix,
  suffix,
}: {
  name: string;
  defaultValue: string | number;
  min?: number;
  max?: number;
  step?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {prefix ? <span className="text-[0.9375rem] text-ink-500">{prefix}</span> : null}
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        className="tnum w-28 rounded-xl bg-white px-3 py-2 font-mono text-[0.9375rem] text-ink-950 ring-1 ring-ink-950/10"
      />
      {suffix ? <span className="text-[0.875rem] text-ink-500">{suffix}</span> : null}
    </span>
  );
}

function Text({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="text-[0.8125rem] text-ink-500">{label}</span>
      <input
        type="url"
        name={name}
        defaultValue={defaultValue}
        placeholder="https://"
        className="mt-1 w-full rounded-xl bg-paper-2 px-3 py-2 text-[0.9375rem] text-ink-950 ring-1 ring-ink-950/8 placeholder:text-ink-300"
      />
    </label>
  );
}

function Check({
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="mt-3 flex gap-3">
      <input
        type="checkbox"
        name={name}
        value="1"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 shrink-0 accent-[var(--color-ink-950)]"
      />
      <span className="min-w-0">
        <span className="block text-[0.9375rem] text-ink-950">{label}</span>
        <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-ink-500">{hint}</span>
      </span>
    </label>
  );
}
