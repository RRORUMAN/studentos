"use client";

import { Check, Download, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";

import { OptionRow, SelectChip } from "@/components/onboarding/controls";
import { Button } from "@/components/ui/button";
import { diets, interestGroups, notificationTopics, priceSensitivities, travelLimits } from "@/config/onboarding";
import { interfaceLanguages } from "@/config/regions";
import type { PrivacySettings } from "@/domain/types";
import {
  deleteAccount,
  exportData,
  resetMemory,
  updateNotifications,
  updatePrivacy,
  updateProfile,
} from "@/server/actions/profile";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * SETTINGS FORMS
 * ----------------------------------------------------------------------------
 * Profile, privacy, notifications, and the data controls.
 *
 * Every one saves explicitly with visible confirmation. Settings that autosave
 * silently leave people unsure whether anything happened, and on a privacy
 * screen that uncertainty is the worst possible outcome.
 * ============================================================================
 */

const AVATARS = ["🦊", "🐢", "🌿", "🎧", "📚", "🚲", "🛠️", "🎹", "🧭", "🍜", "⚽", "🎨", "🌙", "🔭"];

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

export function ProfileForm({
  initial,
  neighbourhoods,
}: {
  initial: {
    displayName: string;
    bio: string;
    avatarEmoji: string;
    interests: string[];
    homeArea: string;
    maxTravelMinutes: number;
    priceSensitivity: "cheapest" | "value" | "balanced" | "occasional-splurge";
    diets: string[];
    language: string;
  };
  neighbourhoods: readonly string[];
}) {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  return (
    <div className="space-y-7">
      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">Name</span>
          <input
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">
            Bio <span className="font-normal text-ink-400">(optional)</span>
          </span>
          <textarea
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
            rows={2}
            maxLength={200}
            className="w-full rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink-900"
          />
        </label>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-ink-800">Avatar</legend>
          <div className="flex flex-wrap gap-1.5">
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setForm({ ...form, avatarEmoji: emoji })}
                aria-label={`Avatar ${emoji}`}
                aria-pressed={form.avatarEmoji === emoji}
                className={cn(
                  "grid size-10 place-items-center rounded-full border text-lg transition-colors",
                  form.avatarEmoji === emoji
                    ? "border-ink-950 bg-signal-soft"
                    : "border-ink-200 bg-white hover:border-ink-300",
                )}
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Interests</h2>
        <p className="mb-4 text-[0.875rem] text-ink-500">
          This is what recommendations are scored against.
        </p>

        <div className="space-y-4">
          {interestGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
                {group.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <SelectChip
                    key={item.value}
                    label={item.label}
                    emoji={item.emoji}
                    selected={form.interests.includes(item.value)}
                    onSelect={() =>
                      setForm({ ...form, interests: toggle(form.interests, item.value) })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Where and how far</h2>
        <p className="mb-3 text-[0.875rem] text-ink-500">
          A neighbourhood, not an address. It is used to sort places by how far they are and is never shown to another
          student.
        </p>

        {neighbourhoods.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {neighbourhoods.map((area) => (
              <SelectChip
                key={area}
                label={area}
                selected={form.homeArea === area}
                onSelect={() => setForm({ ...form, homeArea: form.homeArea === area ? "" : area })}
              />
            ))}
          </div>
        ) : null}

        {/* Free text as well as the chips: the city directory carries no
            neighbourhood list for most cities, and an empty step with nothing
            to tap is how a student in Tallinn concluded the product was
            broken. */}
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">
            {neighbourhoods.length > 0 ? "Or type it" : "Your neighbourhood"}
          </span>
          <input
            value={form.homeArea}
            onChange={(event) => setForm({ ...form, homeArea: event.target.value })}
            placeholder="The area you live in"
            maxLength={120}
            className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
          />
        </label>

        <div className="mt-4 space-y-2.5">
          {travelLimits.map((limit) => (
            <OptionRow
              key={limit.value}
              label={limit.label}
              detail={limit.detail}
              selected={String(form.maxTravelMinutes) === limit.value}
              onSelect={() => setForm({ ...form, maxTravelMinutes: Number(limit.value) })}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">How you pick places</h2>
        <div className="space-y-2.5">
          {priceSensitivities.map((choice) => (
            <OptionRow
              key={choice.value}
              {...choice}
              selected={form.priceSensitivity === choice.value}
              onSelect={() => setForm({ ...form, priceSensitivity: choice.value })}
            />
          ))}
        </div>
      </section>

      {/* Chosen at onboarding and, until now, impossible to change: a setting
          picked in the first two minutes and then frozen for the life of the
          account. It is also not what it was called there — see the note in
          `setup-flow.tsx`. There is no translation layer in this product; what
          this sets is `profile.locale`, which formats every price and date. */}
      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Number and date format</h2>
        <p className="mb-3 text-[0.8125rem] text-ink-500">
          How prices, dates and numbers are written for you. The interface itself is in English
          for now.
        </p>
        <select
          value={form.language}
          onChange={(event) => setForm({ ...form, language: event.target.value })}
          className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-[0.9375rem] text-ink-900"
        >
          {interfaceLanguages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.endonym} · {language.label}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">Food</h2>
        <div className="flex flex-wrap gap-2">
          {diets.map((diet) => (
            <SelectChip
              key={diet.value}
              label={diet.label}
              selected={form.diets.includes(diet.value)}
              onSelect={() => setForm({ ...form, diets: toggle(form.diets, diet.value) })}
            />
          ))}
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-[0.875rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <Button
        variant="primary"
        size="lg"
        block
        disabled={pending}
        onClick={() => {
          setError(null);
          setSaved(false);
          startTransition(async () => {
            const result = await updateProfile(form);
            if (!result.ok) setError(result.message);
            else setSaved(true);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {saved ? <Check className="size-4" /> : null}
        {saved ? "Saved" : "Save changes"}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Privacy                                                                     */
/* -------------------------------------------------------------------------- */

export function PrivacyForm({ initial }: { initial: PrivacySettings }) {
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const visibilities = [
    { value: "public" as const, label: "Anyone on StudentOS", detail: "Any student, any city." },
    { value: "campus" as const, label: "My campus", detail: "Students at your university." },
    { value: "friends" as const, label: "Friends only" },
    { value: "private" as const, label: "Nobody", detail: "You are invisible to other students." },
  ];

  const toggles = [
    { key: "showCity" as const, label: "Show my city", detail: "Never your address or neighbourhood." },
    { key: "showCampus" as const, label: "Show my university" },
    { key: "showInterests" as const, label: "Show my interests" },
    {
      key: "discoverable" as const,
      label: "Suggest me for plans",
      detail: "Matched on interests and campus. Never on live location.",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-flow-deep/20 bg-flow-soft/50 p-5">
        <h2 className="text-[0.9375rem] font-semibold text-flow-deep">Always private</h2>
        <ul className="mt-2 space-y-1.5">
          {[
            "Your exact home location — never shown to anyone, at any setting",
            "Your budget, transactions and safe-to-spend",
            "What you ask StudentOS",
            "Your saved places, unless you share a collection",
          ].map((line) => (
            <li key={line} className="flex gap-2 text-[0.875rem] leading-snug text-flow-deep/90">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-flow-deep/50" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">Who can see your profile</h2>
        <div className="space-y-2.5">
          {visibilities.map((option) => (
            <OptionRow
              key={option.value}
              label={option.label}
              detail={option.detail}
              selected={settings.profileVisibility === option.value}
              onSelect={() => setSettings({ ...settings, profileVisibility: option.value })}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">What they see</h2>
        <div className="space-y-2.5">
          {toggles.map((toggle) => (
            <OptionRow
              key={toggle.key}
              label={toggle.label}
              detail={toggle.detail}
              multi
              selected={settings[toggle.key]}
              onSelect={() => setSettings({ ...settings, [toggle.key]: !settings[toggle.key] })}
            />
          ))}
        </div>
      </section>

      <Button
        variant="primary"
        size="lg"
        block
        disabled={pending}
        onClick={() => {
          setSaved(false);
          startTransition(async () => {
            await updatePrivacy(settings);
            setSaved(true);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {saved ? <Check className="size-4" /> : null}
        {saved ? "Saved" : "Save privacy settings"}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export function NotificationForm({
  initial,
  delivery: initialDelivery,
  quiet,
}: {
  initial: Record<string, boolean>;
  delivery: Record<string, string>;
  quiet: { from: number; to: number };
}) {
  const [topics, setTopics] = useState(initial);
  const [delivery, setDelivery] = useState<Record<string, string>>(initialDelivery);
  const [hours, setHours] = useState(quiet);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  /* Grouped the way a student thinks about interruptions, not the way the
     rows are stored. Each topic has one of three deliveries; "off" and an
     unticked topic are the same thing, kept in sync below. */
  const groups: { title: string; topics: { value: string; label: string; detail: string }[] }[] = [
    { title: "Money", topics: notificationTopics.filter((t) => t.value === "budget-warnings") },
    { title: "Events and deals", topics: notificationTopics.filter((t) => t.value === "free-events" || t.value === "deals" || t.value === "weekend-ideas") },
    { title: "Social and plans", topics: notificationTopics.filter((t) => t.value === "friends-plans" || t.value === "plans") },
    { title: "Campus and Pulse", topics: notificationTopics.filter((t) => t.value === "campus" || t.value === "pulse") },
    { title: "Arrival", topics: notificationTopics.filter((t) => t.value === "arrival") },
  ];

  const modeFor = (topic: string) => (!topics[topic] ? "off" : delivery[topic] ?? "instant");
  const setMode = (topic: string, mode: "instant" | "digest" | "off") => {
    setTopics({ ...topics, [topic]: mode !== "off" });
    setDelivery({ ...delivery, [topic]: mode });
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.title} className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
          <h2 className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">{group.title}</h2>
          <ul className="mt-3 divide-y divide-ink-100">
            {group.topics.map((topic) => {
              const mode = modeFor(topic.value);
              return (
                <li key={topic.value} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-medium text-ink-900">{topic.label}</p>
                    <p className="text-[0.8125rem] text-ink-500">{topic.detail}</p>
                  </div>
                  <div role="radiogroup" aria-label={`${topic.label} delivery`} className="inline-flex shrink-0 rounded-full bg-paper-2 p-0.5">
                    {(["instant", "digest", "off"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={mode === option}
                        onClick={() => setMode(topic.value, option)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-[0.8125rem] font-medium capitalize transition-colors",
                          mode === option ? "bg-ink-950 text-paper" : "text-ink-600 hover:text-ink-950",
                        )}
                      >
                        {option === "digest" ? "Daily digest" : option}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <h2 className="text-[1.0625rem] font-semibold text-ink-950">Quiet hours</h2>
        <p className="mt-1 mb-3 text-[0.875rem] text-ink-500">
          Nothing is sent between these, whatever is switched on above. Digests wait until quiet hours end.
        </p>
        <div className="flex items-center gap-3">
          {(["from", "to"] as const).map((key) => (
            <label key={key} className="flex-1">
              <span className="mb-1.5 block text-sm font-medium text-ink-800 capitalize">{key}</span>
              <select
                value={hours[key]}
                onChange={(event) => setHours({ ...hours, [key]: Number(event.target.value) })}
                className="tnum h-11 w-full rounded-lg bg-paper-2 px-3 font-mono text-[0.9375rem] text-ink-900"
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <p className="text-[0.8125rem] text-ink-500">
        There is also a ceiling: at most a handful of instant notifications a day, however many topics are on. Anything past it rolls into the digest.
      </p>

      <Button
        variant="primary"
        size="lg"
        block
        disabled={pending}
        onClick={() => {
          setSaved(false);
          startTransition(async () => {
            await updateNotifications(topics, hours, delivery);
            setSaved(true);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {saved ? <Check className="size-4" /> : null}
        {saved ? "Saved" : "Save notification settings"}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

export function DataControls({ handle }: { handle: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<"export" | "reset" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="text-[1.0625rem] font-semibold text-ink-950">Export everything</h2>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-600">
          Profile, budget, transactions, saved places and posts, as JSON.
        </p>
        <Button
          variant="outline"
          size="md"
          className="mt-3.5"
          disabled={busy !== null}
          onClick={() => {
            setBusy("export");
            startTransition(async () => {
              const json = await exportData();
              /* Built and revoked in the browser — the file never touches a
                 server or a third party. */
              const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
              const link = document.createElement("a");
              link.href = url;
              link.download = `studentos-${handle}.json`;
              link.click();
              URL.revokeObjectURL(url);
              setBusy(null);
            });
          }}
        >
          {busy === "export" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download my data
        </Button>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="text-[1.0625rem] font-semibold text-ink-950">
          Reset what recommendations learned
        </h2>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-600">
          Clears the affinities built from what you saved, joined and dismissed. Your interests and
          budget stay.
        </p>
        <Button
          variant="outline"
          size="md"
          className="mt-3.5"
          disabled={busy !== null}
          onClick={() => {
            setBusy("reset");
            startTransition(async () => {
              await resetMemory();
              setMessage("Recommendations reset.");
              setBusy(null);
            });
          }}
        >
          {busy === "reset" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RotateCcw className="size-4" />
          )}
          Reset
        </Button>
      </section>

      {message ? (
        <p role="status" className="rounded-lg bg-mint-soft px-4 py-2.5 text-[0.875rem] text-mint-deep">
          {message}
        </p>
      ) : null}

      {/* ---- deletion ----------------------------------------------------- */}
      <section className="rounded-xl border border-pulse-deep/25 bg-pulse-soft/40 p-5">
        <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold text-ink-950">
          <TriangleAlert className="size-4.5 text-pulse-deep" />
          Delete your account
        </h2>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-700">
          Your profile, budget, transactions, saved places and plans are deleted permanently.
          Posts and replies stay in the community with your name removed — deleting them would
          take other people&rsquo;s conversations with them.
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">
            Type DELETE to confirm
          </span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="h-11 w-full rounded-md border border-ink-300 bg-white px-3.5 text-[0.9375rem] text-ink-900"
          />
        </label>

        <Button
          variant="outline"
          size="md"
          className="mt-3.5 border-pulse-deep/40 text-pulse-deep hover:bg-pulse-soft"
          disabled={busy !== null || confirmation !== "DELETE"}
          onClick={() => {
            setBusy("delete");
            startTransition(async () => {
              const result = await deleteAccount(confirmation);
              if (result && !result.ok) {
                setMessage(result.message);
                setBusy(null);
              }
            });
          }}
        >
          {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : null}
          Delete my account
        </Button>
      </section>
    </div>
  );
}
