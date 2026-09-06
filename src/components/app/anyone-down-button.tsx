"use client";

import { Loader2, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { activityMeta, type ActivityKind } from "@/domain/social";
import { createInvite, respondToInvite } from "@/server/actions/anyone-down";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * ANYONE DOWN?
 * ----------------------------------------------------------------------------
 * The button that turns anything into a group, and the join controls.
 *
 * The form is three decisions deep — what, when, who can see it — and every
 * one is pre-filled from context. The reason is behavioural: proposing
 * something to strangers is socially risky, and every extra field is another
 * second in which the person decides not to bother.
 * ============================================================================
 */

export function AnyoneDownButton({
  anchorKind,
  anchorId,
  title,
  startsAt,
}: {
  anchorKind?: "place" | "event" | "plan";
  anchorId?: string;
  title?: string;
  startsAt?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: title ?? "",
    detail: "",
    startsAt: startsAt ? toLocalInput(startsAt) : toLocalInput(defaultWhen()),
    audience: "city" as "friends" | "campus" | "city",
    capacity: "6",
    budget: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="sticker" size="lg" block onClick={() => setOpen(true)}>
        <UsersRound className="size-4" />
        Anyone down?
      </Button>
    );
  }

  return (
    <section className="rounded-xl border-2 border-ink-950 bg-white p-5 shadow-[var(--shadow-sticker-sm)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[1.0625rem] font-semibold text-ink-950">Anyone down?</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100"
        >
          <X className="size-4" />
        </button>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">What</span>
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Five-a-side, Thursday"
          className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>

      {/* Quick-fill from the activity taxonomy — a closed list is what makes
          matching people to each other possible at all. */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {(["football", "gym", "coffee", "study", "lunch", "nightlife"] as ActivityKind[]).map(
          (kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setForm({ ...form, title: activityMeta[kind].label })}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-[0.8125rem] font-medium text-ink-600 hover:border-ink-300"
            >
              <span aria-hidden>{activityMeta[kind].emoji}</span>
              {activityMeta[kind].label}
            </button>
          ),
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">When</span>
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
            className="h-11 w-full rounded-md border border-ink-200 bg-white px-3 text-[0.9375rem] text-ink-900"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">How many</span>
          <input
            inputMode="numeric"
            value={form.capacity}
            onChange={(event) =>
              setForm({ ...form, capacity: event.target.value.replace(/\D/g, "") })
            }
            className="tnum h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 font-mono text-[0.9375rem] text-ink-900"
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-ink-800">Who can see it</legend>
        <div className="flex gap-2">
          {(["friends", "campus", "city"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setForm({ ...form, audience: option })}
              aria-pressed={form.audience === option}
              className={cn(
                "h-9 flex-1 rounded-full border text-[0.875rem] font-medium capitalize transition-colors",
                form.audience === option
                  ? "border-ink-950 bg-ink-950 text-paper"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <Button
        variant="primary"
        size="lg"
        block
        className="mt-5"
        disabled={pending || form.title.trim().length < 3}
        onClick={() => {
          setError(null);
          const data = new FormData();
          data.set("title", form.title);
          data.set("detail", form.detail);
          data.set("startsAt", form.startsAt);
          data.set("audience", form.audience);
          data.set("capacity", form.capacity || "6");
          if (form.budget) data.set("budget", form.budget);
          if (anchorKind) data.set("anchorKind", anchorKind);
          if (anchorId) data.set("anchorId", anchorId);

          startTransition(async () => {
            const result = await createInvite(data);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.push(`/anyone-down/${result.id}`);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Post it
      </Button>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Join                                                                        */
/* -------------------------------------------------------------------------- */

export function JoinControls({
  inviteId,
  status,
  full,
}: {
  inviteId: string;
  status: "in" | "maybe" | "out" | null;
  full: boolean;
}) {
  const [current, setCurrent] = useState(status);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex gap-2">
        {(["in", "maybe", "out"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={pending || (option === "in" && full && current !== "in")}
            aria-pressed={current === option}
            onClick={() =>
              startTransition(async () => {
                const result = await respondToInvite(inviteId, option);
                if (result.ok) {
                  setCurrent(option);
                  setMessage(null);
                } else {
                  setMessage(result.message ?? "Could not update that.");
                }
              })
            }
            className={cn(
              "h-11 flex-1 rounded-full border text-[0.9375rem] font-medium transition-colors disabled:opacity-45",
              current === option
                ? "border-ink-950 bg-ink-950 text-paper"
                : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
            )}
          >
            {option === "in" ? "I'm in" : option === "maybe" ? "Maybe" : "Can't"}
          </button>
        ))}
      </div>

      {message ? (
        <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

/** Tonight at 19:00, or tomorrow if it is already past that. */
function defaultWhen(): string {
  const date = new Date();
  if (date.getHours() >= 19) date.setDate(date.getDate() + 1);
  date.setHours(19, 0, 0, 0);
  return date.toISOString();
}

/** `datetime-local` needs local time with no zone suffix. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
