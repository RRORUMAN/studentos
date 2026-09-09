"use client";

import { useState, useTransition } from "react";

import { abilityLabel, coverageLabel, type LanguageAbility, type LanguageCode, type PackCoverage } from "@/domain/language";
import { setLearningLanguage } from "@/server/actions/language";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * LANGUAGE PICKER
 * ----------------------------------------------------------------------------
 * Which language, and how much of it the student already has.
 *
 * Both are shown together because they are one decision. Somebody fluent in
 * Spanish who moves to Madrid should be able to say so in the same place they
 * would have picked Spanish, and get the tier-3 phrases rather than "hello".
 *
 * Every option carries its coverage and its phrase count. That is the whole
 * honesty requirement in one line of secondary text: nobody picks Estonian
 * expecting a course and finds eighteen phrases.
 * ============================================================================
 */

export type LanguageOption = {
  code: LanguageCode;
  name: string;
  endonym: string;
  count: number;
  coverage: PackCoverage;
};

const ABILITIES: readonly LanguageAbility[] = ["none", "few-words", "basic", "conversational", "fluent"];

export function LanguagePicker({
  current,
  ability,
  languages,
}: {
  current: LanguageCode;
  ability: LanguageAbility;
  languages: readonly LanguageOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<LanguageCode>(current);
  const [level, setLevel] = useState<LanguageAbility>(ability);

  const save = (next: { language?: LanguageCode; ability?: LanguageAbility }) => {
    const language = next.language ?? chosen;
    const nextAbility = next.ability ?? level;
    setChosen(language);
    setLevel(nextAbility);
    startTransition(async () => {
      await setLearningLanguage({ language, ability: nextAbility });
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="learning-language"
          className="mb-1.5 block font-mono text-micro uppercase tracking-[0.12em] text-ink-400"
        >
          Learning
        </label>
        <select
          id="learning-language"
          value={chosen}
          disabled={pending}
          onChange={(event) => save({ language: event.target.value as LanguageCode })}
          className="h-11 w-full rounded-md border border-ink-200 bg-white px-3 text-[0.9375rem] text-ink-900 focus-visible:border-ink-950 focus-visible:outline-none"
        >
          {languages.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name} ({option.endonym}) — {coverageLabel[option.coverage].toLowerCase()},{" "}
              {option.count} phrases
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="mb-1.5 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
          How much do you have already?
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {ABILITIES.map((option) => (
            <button
              key={option}
              type="button"
              disabled={pending}
              aria-pressed={level === option}
              onClick={() => save({ ability: option })}
              className={cn(
                "rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950",
                level === option ? "bg-ink-950 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50",
              )}
            >
              {abilityLabel[option]}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
