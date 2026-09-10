"use client";

import { Loader2, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  addRecurring,
  adoptDetectedSubscription,
  removeRecurring,
  restoreRecurring,
  updateRecurring,
} from "@/server/actions/budget";
import { cn, money } from "@/lib/utils";
import { useDialog } from "@/components/ui/use-dialog";

/**
 * ============================================================================
 * SUBSCRIPTIONS & REPEATING
 * ----------------------------------------------------------------------------
 * Rent, phone, gym, the streaming thing nobody remembers signing up for.
 *
 * This panel exists because these charges were previously invisible: they were
 * subtracted from safe-to-spend — correctly — but the student could not see
 * what was coming or when, which makes the most consequential number on the
 * screen feel arbitrary. Every row now says what it is, when it next lands and
 * what it costs a month, and every row can be edited or cancelled.
 *
 * The detected rows below are candidates, never facts: they come from the
 * student's own transactions and are offered with an explicit "add" rather
 * than written silently. A budget that quietly invents commitments is worse
 * than one that misses them.
 * ============================================================================
 */

type Where = { currency: string; locale: string };
type Category = { key: string; label: string };

export type SubscriptionView = {
  id: string;
  label: string;
  categoryKey: string;
  categoryLabel: string;
  amountCents: number;
  cadence: "weekly" | "monthly" | "termly";
  dayOfPeriod: number;
  /** Formatted on the server in the city's timezone: "Fri 12 Sep". */
  nextDueLabel: string | null;
  daysUntil: number | null;
  monthlyCents: number;
  paidThisMonth: boolean;
};

export type DetectedView = {
  key: string;
  label: string;
  categoryKey: string;
  categoryLabel: string;
  amountCents: number;
  dayOfMonth: number;
  monthCount: number;
};

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

/* -------------------------------------------------------------------------- */
/* Panel                                                                       */
/* -------------------------------------------------------------------------- */

export function SubscriptionsPanel({
  rows,
  detected,
  categories,
  symbol,
  where,
  monthlyTotalCents,
  stillToComeCents,
  canDetect,
}: {
  rows: readonly SubscriptionView[];
  /** Empty for a student without the entitlement; the count is shown instead. */
  detected: readonly DetectedView[];
  categories: readonly Category[];
  symbol: string;
  where: Where;
  monthlyTotalCents: number;
  stillToComeCents: number;
  canDetect: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SubscriptionView | null>(null);
  const [undo, setUndo] = useState<{ label: string; row: unknown } | null>(null);
  const [, startTransition] = useTransition();

  const fmt = (cents: number) => money(cents / 100, where);

  const cancel = (row: SubscriptionView) => {
    startTransition(async () => {
      const result = await removeRecurring(row.id);
      if (!result.ok) return;
      setUndo({
        label: `${result.removed.label} cancelled`,
        row: {
          id: result.removed.id,
          label: result.removed.label,
          category: result.removed.category,
          amountCents: result.removed.amountCents,
          cadence: result.removed.cadence,
          dayOfPeriod: result.removed.dayOfPeriod,
        },
      });
    });
  };

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[1.0625rem] font-semibold text-ink-950">Subscriptions &amp; repeating</h2>
        <span className="tnum shrink-0 font-mono text-[0.8125rem] text-ink-500">
          {fmt(monthlyTotalCents)}/month
        </span>
      </div>
      <p className="mt-0.5 text-[0.8125rem] text-ink-500">
        {stillToComeCents > 0
          ? `${fmt(stillToComeCents)} of it has not come out yet this month, and is already held back from safe-to-spend.`
          : "Everything due this month has already gone out."}
      </p>

      {rows.length > 0 ? (
        <ul className="mt-3 divide-y divide-ink-100">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] text-ink-900">{row.label}</span>
                <span className="mt-0.5 block text-[0.8125rem] text-ink-500">
                  {row.paidThisMonth
                    ? `${row.categoryLabel} · paid this month`
                    : row.nextDueLabel
                      ? `${row.categoryLabel} · next ${row.nextDueLabel}${
                          row.daysUntil === 0 ? " (today)" : row.daysUntil === 1 ? " (tomorrow)" : ""
                        }`
                      : `${row.categoryLabel} · each term`}
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span className="tnum block font-mono text-[0.9375rem] font-medium text-ink-900">
                  {fmt(row.amountCents)}
                </span>
                {row.cadence !== "monthly" ? (
                  <span className="tnum block font-mono text-[0.6875rem] text-ink-400">
                    {fmt(row.monthlyCents)}/mo
                  </span>
                ) : null}
              </span>

              <button
                type="button"
                aria-label={`Edit ${row.label}`}
                onClick={() => setEditing(row)}
                className="grid size-8 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-ink-100 hover:text-ink-800"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Cancel ${row.label}`}
                onClick={() => cancel(row)}
                className="grid size-8 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-pulse-soft hover:text-pulse-deep"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl bg-paper-2 px-4 py-5 text-center text-[0.875rem] text-ink-600">
          Nothing repeating yet. Add rent, your phone and any subscription — safe-to-spend subtracts
          them before it calls a single cent safe.
        </p>
      )}

      {canDetect && detected.length > 0 ? (
        <div className="mt-4 rounded-xl bg-flow-soft/50 p-4">
          <h3 className="text-[0.9375rem] font-semibold text-ink-950">
            {detected.length === 1 ? "One charge looks like a subscription" : `${detected.length} charges look like subscriptions`}
          </h3>
          <p className="mt-0.5 text-[0.8125rem] text-ink-600">
            Same category, near-identical amount, in consecutive months. Add one and it starts
            counting against safe-to-spend.
          </p>
          <ul className="mt-3 space-y-2">
            {detected.map((row) => (
              <DetectedRow key={row.key} row={row} where={where} />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-[0.8125rem] font-medium text-ink-700 hover:bg-ink-100"
        >
          <Plus className="size-3.5" />
          Add a repeating cost
        </button>
      </div>

      {adding ? (
        <RecurringSheet
          title="Repeating cost"
          categories={categories}
          symbol={symbol}
          onClose={() => setAdding(false)}
        />
      ) : null}

      {editing ? (
        <RecurringSheet
          title="Edit repeating cost"
          categories={categories}
          symbol={symbol}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {undo ? (
        <UndoBar
          label={undo.label}
          onDismiss={() => setUndo(null)}
          onUndo={() => {
            const row = undo.row;
            setUndo(null);
            startTransition(async () => {
              await restoreRecurring(row);
            });
          }}
        />
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Detected                                                                    */
/* -------------------------------------------------------------------------- */

function DetectedRow({ row, where }: { row: DetectedView; where: Where }) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-medium text-ink-900">{row.label}</span>
        <span className="block text-[0.8125rem] text-ink-500">
          {money(row.amountCents / 100, where)} · around the {ordinal(row.dayOfMonth)} · seen in{" "}
          {row.monthCount} months
        </span>
        {error ? (
          <span role="alert" className="block text-[0.8125rem] text-pulse-deep">
            {error}
          </span>
        ) : null}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={pending || added}
        onClick={() => {
          setError(null);
          const form = new FormData();
          form.set("label", row.label);
          form.set("category", row.categoryKey);
          form.set("amount", String(row.amountCents / 100));
          form.set("dayOfPeriod", String(row.dayOfMonth));
          startTransition(async () => {
            const result = await adoptDetectedSubscription(form);
            if (!result.ok) setError(result.message);
            else setAdded(true);
          });
        }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {added ? "Added" : "Add as repeating"}
      </Button>
    </li>
  );
}

function ordinal(day: number): string {
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${suffix}`;
}

/* -------------------------------------------------------------------------- */
/* Add / edit sheet                                                            */
/* -------------------------------------------------------------------------- */

function RecurringSheet({
  title,
  categories,
  symbol,
  existing,
  onClose,
}: {
  title: string;
  categories: readonly Category[];
  symbol: string;
  existing?: SubscriptionView;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amountCents / 100) : "");
  const [category, setCategory] = useState(existing?.categoryKey ?? categories[0]?.key ?? "subscriptions");
  const [cadence, setCadence] = useState<"monthly" | "weekly">(
    existing?.cadence === "weekly" ? "weekly" : "monthly",
  );
  const [day, setDay] = useState(String(existing?.dayOfPeriod ?? 1));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    setError(null);
    const form = new FormData();
    form.set("label", label);
    form.set("amount", amount);
    form.set("category", category);
    form.set("cadence", cadence);
    form.set("dayOfPeriod", day || "1");

    startTransition(async () => {
      const result = existing ? await updateRecurring(existing.id, form) : await addRecurring(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
    });
  };

  /* `aria-modal` claims nothing behind this is reachable; the trap is what
     makes that true. See components/ui/use-dialog.ts. */
  const dialogRef = useDialog(true);

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink-950/40" />
      <section
        ref={dialogRef as React.RefObject<HTMLElement>}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)] sm:rounded-2xl sm:pb-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[1.0625rem] font-semibold text-ink-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-ink-100"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <input
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Rent, phone, gym"
            aria-label="What is it"
            className="h-11 rounded-lg border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
          />
          <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white pl-3">
            <span aria-hidden className="font-mono text-ink-400">
              {symbol}
            </span>
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
                category === entry.key ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
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
              onClick={() => {
                setCadence(option);
                setDay(option === "weekly" ? "1" : "1");
              }}
              aria-pressed={cadence === option}
              className={cn(
                "h-9 rounded-full px-3.5 text-[0.8125rem] font-medium capitalize transition-colors",
                cadence === option ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        {/* A weekday is a named day, not an integer. Asking a student to know
            that Sunday is 0 is asking them to think like the database. */}
        <div className="mt-3">
          {cadence === "weekly" ? (
            <fieldset>
              <legend className="mb-1.5 text-[0.8125rem] font-medium text-ink-700">Which day?</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((weekday) => (
                  <button
                    key={weekday.value}
                    type="button"
                    onClick={() => setDay(String(weekday.value))}
                    aria-pressed={day === String(weekday.value)}
                    className={cn(
                      "h-9 min-w-11 rounded-full px-2.5 text-[0.8125rem] font-medium transition-colors",
                      day === String(weekday.value)
                        ? "bg-ink-950 text-paper"
                        : "bg-paper-2 text-ink-600 hover:bg-ink-100",
                    )}
                  >
                    {weekday.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <label className="flex items-center gap-3 text-[0.8125rem] font-medium text-ink-700">
              Day of the month
              <input
                inputMode="numeric"
                value={day}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, "").slice(0, 2);
                  setDay(next === "" ? "" : String(Math.min(31, Math.max(1, Number(next)))));
                }}
                aria-label="Day of month"
                className="tnum h-10 w-16 rounded-lg border border-ink-200 bg-white px-2 text-center font-mono text-[0.875rem] text-ink-900"
              />
            </label>
          )}
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
          disabled={pending || !label.trim() || !amount}
          onClick={save}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save
        </Button>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Undo                                                                        */
/* -------------------------------------------------------------------------- */

function UndoBar({ label, onUndo, onDismiss }: { label: string; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-100 mx-auto flex w-[min(28rem,calc(100%-2rem))] items-center gap-3 rounded-lg bg-ink-950 p-3.5 text-paper shadow-[var(--shadow-lift)] lg:bottom-6"
      data-surface="dark"
    >
      <span className="min-w-0 flex-1 text-[0.875rem]">{label}</span>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-signal px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-950"
      >
        <Undo2 className="size-3.5" />
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid size-7 shrink-0 place-items-center rounded-full text-paper/50 hover:text-paper"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
