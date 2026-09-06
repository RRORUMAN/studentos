"use client";

import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { addRecurring, addTransaction, deleteTransaction, removeRecurring } from "@/server/actions/budget";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * BUDGET UI
 * ----------------------------------------------------------------------------
 * The interactive parts of the money surface: logging a spend, editing an
 * envelope, removing a transaction.
 *
 * Adding a transaction is the single most repeated action in the product and
 * the one that decides whether the budget stays true. So it is built for speed
 * above everything: amount first, a numeric keypad on mobile, categories as
 * one-tap chips rather than a select, and the form stays open and cleared after
 * a save so a student logging three things from a receipt does it in one go.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Add transaction                                                             */
/* -------------------------------------------------------------------------- */

export function AddTransaction({
  categories,
  symbol,
  defaultCategory = "groceries",
}: {
  categories: readonly { key: string; label: string }[];
  symbol: string;
  defaultCategory?: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(defaultCategory);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    setError(null);
    const form = new FormData();
    form.set("amount", amount);
    form.set("category", category);

    startTransition(async () => {
      const result = await addTransaction(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      /* Clear and refocus rather than close: entering several at once is the
         common case, and re-opening the sheet each time is friction that
         eventually stops people logging at all. */
      setAmount("");
      amountRef.current?.focus();
    });
  };

  if (!open) {
    return (
      <Button variant="primary" size="lg" block onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add a spend
      </Button>
    );
  }

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-4 shadow-[var(--shadow-raise)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[0.9375rem] font-semibold text-ink-950">Add a spend</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-800"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-md border border-ink-200 bg-paper-2 pl-3.5 focus-within:border-ink-400">
        <span aria-hidden className="tnum font-mono text-2xl text-ink-400">
          {symbol}
        </span>
        <input
          ref={amountRef}
          autoFocus
          inputMode="decimal"
          value={amount}
          placeholder="0"
          aria-label="Amount"
          onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ""))}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          className="tnum h-16 w-full bg-transparent pr-3.5 font-mono text-2xl text-ink-900 outline-none"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {categories.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setCategory(entry.key)}
            aria-pressed={category === entry.key}
            className={cn(
              "h-8 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors",
              category === entry.key
                ? "border-ink-950 bg-ink-950 text-paper"
                : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <Button
        variant="primary"
        size="md"
        block
        className="mt-4"
        onClick={submit}
        disabled={pending || amount.length === 0}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save
      </Button>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Transaction row                                                             */
/* -------------------------------------------------------------------------- */

export function TransactionRow({
  id,
  label,
  category,
  amountCents,
  spentAt,
  where,
}: {
  id: string;
  label: string;
  category: string;
  amountCents: number;
  spentAt: string;
  where: { currency: string; locale: string };
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b border-ink-100 py-3 last:border-0",
        pending && "opacity-40",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] text-ink-900">{label}</p>
        <p className="mt-0.5 text-[0.8125rem] text-ink-500">
          {category} ·{" "}
          {new Date(spentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
      </div>

      <span className="tnum shrink-0 font-mono text-[0.9375rem] font-medium text-ink-900">
        {money(amountCents / 100, where)}
      </span>

      <button
        type="button"
        aria-label={`Delete ${label}`}
        disabled={pending}
        onClick={() => startTransition(async () => void (await deleteTransaction(id)))}
        className="grid size-8 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-pulse-soft hover:text-pulse-deep"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Category meter                                                              */
/* -------------------------------------------------------------------------- */

/**
 * One envelope, as a bar.
 *
 * The pace marker is the part that earns its place: a bar that is 60% full
 * means nothing on its own, and means a great deal next to a tick showing you
 * are 40% through the month. It is the difference between reporting and
 * telling someone something.
 */
export function CategoryMeter({
  label,
  spentCents,
  plannedCents,
  pacedCents,
  where,
}: {
  label: string;
  spentCents: number;
  plannedCents: number;
  pacedCents: number;
  where: { currency: string; locale: string };
}) {
  const fraction = plannedCents === 0 ? 0 : spentCents / plannedCents;
  const paceFraction = plannedCents === 0 ? 0 : pacedCents / plannedCents;
  const over = spentCents > plannedCents;
  const ahead = spentCents > pacedCents;

  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.9375rem] text-ink-800">{label}</span>
        <span className="tnum shrink-0 font-mono text-[0.875rem] text-ink-600">
          {money(spentCents / 100, where)}
          <span className="text-ink-400"> / {money(plannedCents / 100, where)}</span>
        </span>
      </div>

      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            over ? "bg-pulse" : ahead ? "bg-amber" : "bg-mint",
          )}
          style={{ width: `${Math.min(100, fraction * 100)}%` }}
        />
        {/* Where an even spend would have you today. */}
        {paceFraction > 0 && paceFraction < 1 ? (
          <span
            aria-hidden
            title="Where you would be at an even pace"
            className="absolute top-0 h-full w-px bg-ink-950/40"
            style={{ left: `${paceFraction * 100}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recurring                                                                   */
/* -------------------------------------------------------------------------- */


/**
 * Add a repeating cost. Rent, phone, gym: the things "safe to spend" has to
 * subtract before it can be trusted. Amount first, then a label and a day.
 */
export function RecurringForm({
  categories,
  symbol,
}: {
  categories: readonly { key: string; label: string }[];
  symbol: string;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]?.key ?? "subscriptions");
  const [cadence, setCadence] = useState<"monthly" | "weekly">("monthly");
  const [day, setDay] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-[0.8125rem] font-medium text-ink-700 hover:bg-ink-100"
      >
        <Plus className="size-3.5" />
        Add a repeating cost
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-paper-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[0.9375rem] font-semibold text-ink-950">Repeating cost</h4>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100">
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Rent, phone, gym"
          aria-label="What is it"
          className="h-11 rounded-lg bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
        <div className="flex items-center gap-1 rounded-lg bg-white pl-3">
          <span aria-hidden className="font-mono text-ink-400">{symbol}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder="0"
            aria-label="Amount"
            className="tnum h-11 w-full bg-transparent pr-3 font-mono text-[0.9375rem] text-ink-900 outline-none"
          />
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {categories.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setCategory(entry.key)}
            aria-pressed={category === entry.key}
            className={cn(
              "h-8 rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
              category === entry.key ? "bg-ink-950 text-paper" : "bg-white text-ink-600 hover:bg-ink-100",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["monthly", "weekly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCadence(option)}
            aria-pressed={cadence === option}
            className={cn(
              "h-8 rounded-full px-3 text-[0.8125rem] font-medium capitalize transition-colors",
              cadence === option ? "bg-ink-950 text-paper" : "bg-white text-ink-600 hover:bg-ink-100",
            )}
          >
            {option}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[0.8125rem] text-ink-600">
          {cadence === "monthly" ? "Day of month" : "Weekday (0 = Sun)"}
          <input
            inputMode="numeric"
            value={day}
            onChange={(event) => setDay(event.target.value.replace(/\D/g, "").slice(0, 2))}
            aria-label={cadence === "monthly" ? "Day of month" : "Day of week"}
            className="tnum h-8 w-14 rounded-lg bg-white px-2 text-center font-mono text-[0.875rem] text-ink-900"
          />
        </label>
      </div>

      {error ? <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">{error}</p> : null}

      <Button
        variant="primary"
        size="md"
        block
        className="mt-3"
        disabled={pending || !label.trim() || !amount}
        onClick={() => {
          setError(null);
          const form = new FormData();
          form.set("label", label);
          form.set("amount", amount);
          form.set("category", category);
          form.set("cadence", cadence);
          form.set("dayOfPeriod", day || "1");
          startTransition(async () => {
            const result = await addRecurring(form);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setLabel("");
            setAmount("");
            setOpen(false);
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}

export function RecurringRow({
  id,
  label,
  amountCents,
  cadence,
  where,
}: {
  id: string;
  label: string;
  amountCents: number;
  cadence: string;
  where: { currency: string; locale: string };
}) {
  const [pending, startTransition] = useTransition();
  return (
    <li className={cn("flex items-center gap-3 py-2.5", pending && "opacity-40")}>
      <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-ink-900">{label}</span>
      <span className="text-[0.75rem] text-ink-400">{cadence}</span>
      <span className="tnum shrink-0 font-mono text-[0.9375rem] font-medium text-ink-900">{money(amountCents / 100, where)}</span>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        disabled={pending}
        onClick={() => startTransition(async () => void (await removeRecurring(id)))}
        className="grid size-8 shrink-0 place-items-center rounded-full text-ink-300 hover:bg-pulse-soft hover:text-pulse-deep"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
