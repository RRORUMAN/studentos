"use client";

import { Loader2, Repeat2, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { activityMeta, type ActivityKind } from "@/domain/social";
import { closeInvite, createInvite, respondToInvite } from "@/server/actions/anyone-down";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * ANYONE DOWN?
 * ----------------------------------------------------------------------------
 * The button that turns anything into a group, and the controls for the plan
 * it creates.
 *
 * The form asks five things — what, when, how many, roughly what it costs, and
 * who can see it — and every one is pre-filled from context. Two of them used
 * to be collected by the form and thrown away: `detail` and `budget` were sent
 * as empty strings because no input existed for them, so every plan in the
 * product had a null budget. They are real fields now.
 *
 * Budget is per person and optional. It is the single most useful thing on an
 * invite for this audience — "five-a-side, €2 each" is a decision someone can
 * make in one second — and leaving it blank says "free or unknown" rather than
 * pretending to a number.
 * ============================================================================
 */

const QUICK: readonly ActivityKind[] = ["football", "gym", "coffee", "study", "lunch", "nightlife"];

const AUDIENCE_HINT = {
  friends: "Only your friends see it.",
  campus: "Anyone at your university sees it.",
  city: "Every student in your city sees it.",
} as const;

export function AnyoneDownButton({
  anchorKind,
  anchorId,
  title,
  startsAt,
  budgetCents,
  capacity,
  label = "Anyone down?",
  defaultOpen = false,
}: {
  /** "post" is accepted so a Pulse post can seed a plan; the server stores
      only anchors its schema knows (place, event, plan). */
  anchorKind?: "place" | "event" | "plan" | "post";
  anchorId?: string;
  title?: string;
  startsAt?: string;
  /** Pre-fill from the thing this was launched off, when it has a price. */
  budgetCents?: number | null;
  capacity?: number;
  label?: string;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState({
    title: title ?? "",
    detail: "",
    startsAt: startsAt ? toLocalInput(startsAt) : toLocalInput(defaultWhen()),
    audience: "city" as "friends" | "campus" | "city",
    capacity: String(capacity ?? 6),
    budget: budgetCents ? (budgetCents / 100).toFixed(2).replace(/\.00$/, "") : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="sticker" size="lg" block onClick={() => setOpen(true)}>
        <UsersRound className="size-4" />
        {label}
      </Button>
    );
  }

  const submit = () => {
    setError(null);
    const data = new FormData();
    data.set("title", form.title);
    if (form.detail.trim()) data.set("detail", form.detail.trim());
    data.set("startsAt", form.startsAt);
    data.set("audience", form.audience);
    data.set("capacity", form.capacity || "6");
    if (form.budget.trim()) data.set("budget", form.budget.trim());
    if (anchorKind) data.set("anchorKind", anchorKind);
    if (anchorId) data.set("anchorId", anchorId);

    startTransition(async () => {
      const result = await createInvite(data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast({ title: "Posted", description: "You are in by default. Share it and see who else is." });
      router.push(`/anyone-down/${result.id}`);
    });
  };

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
          maxLength={120}
          className="h-11 w-full rounded-lg bg-paper-2 px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:ring-2 focus:ring-ink-950/20"
        />
      </label>

      {/* Quick-fill from the activity taxonomy — a closed list is what makes
          matching people to each other possible at all. */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {QUICK.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setForm({ ...form, title: activityMeta[kind].label })}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-paper-2 px-3 text-[0.8125rem] font-medium text-ink-600 hover:bg-ink-100"
          >
            <span aria-hidden>{activityMeta[kind].emoji}</span>
            {activityMeta[kind].label}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">
          Anything else <span className="font-normal text-ink-400">optional</span>
        </span>
        <textarea
          value={form.detail}
          onChange={(event) => setForm({ ...form, detail: event.target.value })}
          placeholder="Where to meet, what to bring, how long it usually takes."
          rows={2}
          maxLength={500}
          className="w-full rounded-lg bg-paper-2 px-3.5 py-2.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400 focus:ring-2 focus:ring-ink-950/20"
        />
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-3">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">When</span>
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
            className="h-11 w-full rounded-lg bg-paper-2 px-3 text-[0.9375rem] text-ink-900"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">How many</span>
          <input
            inputMode="numeric"
            value={form.capacity}
            onChange={(event) => setForm({ ...form, capacity: event.target.value.replace(/\D/g, "").slice(0, 2) })}
            aria-label="Group size"
            className="tnum h-11 w-full rounded-lg bg-paper-2 px-3.5 font-mono text-[0.9375rem] text-ink-900"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">Each</span>
          <input
            inputMode="decimal"
            value={form.budget}
            onChange={(event) => setForm({ ...form, budget: event.target.value.replace(/[^\d.,]/g, "").slice(0, 8) })}
            placeholder="0"
            aria-label="Budget per person"
            className="tnum h-11 w-full rounded-lg bg-paper-2 px-3.5 font-mono text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
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
                "h-9 flex-1 rounded-full text-[0.875rem] font-medium capitalize transition-colors",
                form.audience === option
                  ? "bg-ink-950 text-paper"
                  : "bg-paper-2 text-ink-600 hover:bg-ink-100",
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[0.75rem] text-ink-500">{AUDIENCE_HINT[form.audience]}</p>
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
        onClick={submit}
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
  const router = useRouter();
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
                  /* Joining opens the group chat and the people list, so the
                     page has to come back from the server. */
                  router.refresh();
                } else {
                  setMessage(result.message ?? "Could not update that.");
                }
              })
            }
            className={cn(
              "h-11 flex-1 rounded-full text-[0.9375rem] font-medium transition-colors disabled:opacity-45",
              current === option
                ? "bg-ink-950 text-paper"
                : "bg-white text-ink-700 ring-1 ring-ink-950/10 hover:ring-ink-950/25",
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
/* Host controls                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The host closes their own plan. Closing keeps the chat and the people —
 * deleting the row would take the conversation with it — and frees the
 * hosted-plans allowance, which counts live plans only.
 */
export function CloseInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[0.8125rem] font-medium text-ink-500 underline underline-offset-4 hover:text-ink-900"
      >
        Close this plan
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-[0.8125rem] text-ink-600">Close it for everyone?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await closeInvite(inviteId);
            if (!result.ok) {
              toast({ title: "Could not close it", description: result.message, tone: "warning" });
              return;
            }
            toast({ title: "Plan closed", description: "The chat stays for the people who were in it." });
            router.refresh();
          })
        }
        className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-3.5 py-1.5 text-[0.8125rem] font-medium text-paper"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Close it
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[0.8125rem] font-medium text-ink-500 hover:text-ink-900"
      >
        Keep it open
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Afterwards                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * "Do it again" — re-post the same plan, same anchor, next week by default.
 * The single highest-signal moment in the whole product is the evening after
 * something went well, and until now it ended in a dead group.
 */
export function DoItAgain({
  title,
  anchorKind,
  anchorId,
}: {
  title: string;
  anchorKind?: "place" | "event" | "plan" | null;
  anchorId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <AnyoneDownButton
        title={title}
        anchorKind={anchorKind ?? undefined}
        anchorId={anchorId ?? undefined}
        startsAt={nextWeek()}
        defaultOpen
      />
    );
  }

  return (
    <Button variant="sticker" size="md" block onClick={() => setOpen(true)}>
      <Repeat2 className="size-4" />
      Do it again
    </Button>
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

function nextWeek(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
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
