"use client";

import { Loader2, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  addTransaction,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
} from "@/server/actions/budget";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * BUDGET UI
 * ----------------------------------------------------------------------------
 * The interactive parts of the money surface: logging a spend, correcting one,
 * removing one and putting it back.
 *
 * Adding a transaction is the single most repeated action in the product and
 * the one that decides whether the budget stays true. So it is built for speed
 * above everything: it is the first control on the screen and it stays reachable
 * while you scroll, the sheet opens on the amount with a numeric keypad,
 * categories are one-tap chips rather than a select, and the sheet stays open
 * and cleared after a save so a student logging three things from a receipt
 * does it in one go.
 *
 * Destructive actions are all undoable. A one-tap delete with no way back is
 * the reason people stop trusting a ledger with their own money in it — so
 * `deleteTransaction` hands the row back and the snackbar can restore it.
 * ============================================================================
 */

type Where = { currency: string; locale: string };
type Category = { key: string; label: string };

/* -------------------------------------------------------------------------- */
/* Sheet                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A bottom sheet on a phone, a centred panel on a desktop.
 *
 * Bottom sheet rather than a centred modal on mobile for one reason: it opens
 * next to the thumb that tapped it, above the keyboard that is about to
 * appear, which is where the fastest possible amount entry has to happen.
 */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-[var(--shadow-lift)]",
          "pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-5",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[1.0625rem] font-semibold text-ink-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-800"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Amount field                                                                */
/* -------------------------------------------------------------------------- */

function AmountField({
  symbol,
  value,
  onChange,
  onEnter,
  inputRef,
  autoFocus = false,
}: {
  symbol: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-paper-2 pl-3.5 focus-within:border-ink-400">
      <span aria-hidden className="tnum font-mono text-2xl text-ink-400">
        {symbol}
      </span>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        inputMode="decimal"
        value={value}
        placeholder="0"
        aria-label="Amount"
        onChange={(event) => onChange(event.target.value.replace(/[^0-9.,]/g, ""))}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) onEnter();
        }}
        className="tnum h-16 w-full bg-transparent pr-3.5 font-mono text-2xl text-ink-900 outline-none"
      />
    </div>
  );
}

function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: readonly Category[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {categories.map((entry) => (
        <button
          key={entry.key}
          type="button"
          onClick={() => onChange(entry.key)}
          aria-pressed={value === entry.key}
          className={cn(
            "h-9 rounded-full border px-3.5 text-[0.8125rem] font-medium transition-colors",
            value === entry.key
              ? "border-ink-950 bg-ink-950 text-paper"
              : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
          )}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add a spend                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The primary action of the whole screen.
 *
 * One button, rendered once, that sticks below the app header as the page
 * scrolls — so on a phone the thing a student came here to do is never below
 * the fold, and never further than one thumb-reach away.
 */
export function AddTransaction({
  categories,
  symbol,
  defaultCategory = "groceries",
  where,
}: {
  categories: readonly Category[];
  symbol: string;
  defaultCategory?: string;
  where: Where;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(defaultCategory);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setSaved(null);
  }, []);

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
      const label = categories.find((entry) => entry.key === category)?.label ?? "Spend";
      setSaved(`${label} · ${money(Number(amount.replace(",", ".")) || 0, where)} logged`);
      setAmount("");
      amountRef.current?.focus();
    });
  };

  return (
    <>
      {/* Pinned directly under the app header (h-14, h-16 from lg) so the
          action never scrolls away on a phone. */}
      <div className="sticky top-14 z-30 -mx-5 bg-paper/85 px-5 py-2 backdrop-blur-sm sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <Button variant="primary" size="lg" block onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Add a spend
        </Button>
      </div>

      {open ? (
        <Sheet title="Add a spend" onClose={close}>
          <AmountField
            symbol={symbol}
            value={amount}
            onChange={setAmount}
            onEnter={submit}
            inputRef={amountRef}
            autoFocus
          />
          <CategoryChips categories={categories} value={category} onChange={setCategory} />

          {error ? (
            <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">
              {error}
            </p>
          ) : null}
          {saved && !error ? (
            <p role="status" className="mt-3 text-[0.8125rem] text-mint-deep">
              {saved}. Add another, or close.
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
        </Sheet>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Undo snackbar                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The undo affordance for a delete.
 *
 * Deliberately its own strip rather than the global toast: a toast in this
 * product carries a message and nothing else, and an undo that cannot be
 * tapped is a notification, not an undo.
 */
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

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

export type HistoryRow = {
  id: string;
  label: string;
  categoryKey: string;
  categoryLabel: string;
  amountCents: number;
  spentAt: string;
  merchant: string | null;
};

export type HistoryGroup = {
  day: string;
  /** "Today", "Yesterday", "Sat 12 Sep" — formatted on the server, in the
      city's timezone and the viewer's locale. */
  label: string;
  totalCents: number;
  rows: HistoryRow[];
};

/**
 * Recent spending, grouped by day with a daily total.
 *
 * A flat list of twenty rows is a receipt; days with totals is the thing a
 * student can actually read a pattern out of ("Saturday was €54"). Each row
 * can be corrected or removed, and a removal can be undone.
 */
export function BudgetHistory({
  groups,
  categories,
  symbol,
  where,
  emptyAction,
}: {
  groups: readonly HistoryGroup[];
  categories: readonly Category[];
  symbol: string;
  where: Where;
  emptyAction?: ReactNode;
}) {
  const [editing, setEditing] = useState<HistoryRow | null>(null);
  const [undo, setUndo] = useState<{ label: string; row: unknown } | null>(null);
  const [, startTransition] = useTransition();

  const fmt = (cents: number) => money(cents / 100, where);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl bg-paper-2 px-5 py-8 text-center">
        <p className="text-[0.9375rem] font-medium text-ink-800">Nothing logged yet.</p>
        <p className="mx-auto mt-1 max-w-xs text-[0.875rem] text-ink-600">
          Add the last thing you bought — a coffee is enough. Two or three entries and the daily
          figure starts telling the truth.
        </p>
        {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
      </div>
    );
  }

  const remove = (row: HistoryRow) => {
    startTransition(async () => {
      const result = await deleteTransaction(row.id);
      if (!result.ok) return;
      setUndo({
        label: `${result.removed.merchant ?? row.categoryLabel} · ${fmt(result.removed.amountCents)} removed`,
        row: {
          id: result.removed.id,
          category: result.removed.category,
          amountCents: result.removed.amountCents,
          merchant: result.removed.merchant,
          note: result.removed.note,
          spentAt: result.removed.spentAt,
        },
      });
    });
  };

  return (
    <>
      <div className="divide-y divide-ink-100">
        {groups.map((group) => (
          <section key={group.day} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{group.label}</h3>
              <span className="tnum font-mono text-[0.8125rem] font-semibold text-ink-700">
                {fmt(group.totalCents)}
              </span>
            </div>

            <ul className="mt-1">
              {group.rows.map((row) => (
                <li key={row.id} className="group flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] text-ink-900">{row.label}</span>
                    <span className="mt-0.5 block text-[0.8125rem] text-ink-500">{row.categoryLabel}</span>
                  </span>

                  <span className="tnum shrink-0 font-mono text-[0.9375rem] font-medium text-ink-900">
                    {fmt(row.amountCents)}
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
                    aria-label={`Delete ${row.label}`}
                    onClick={() => remove(row)}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-pulse-soft hover:text-pulse-deep"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {editing ? (
        <EditTransaction
          row={editing}
          categories={categories}
          symbol={symbol}
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
              await restoreTransaction(row);
            });
          }}
        />
      ) : null}
    </>
  );
}

function EditTransaction({
  row,
  categories,
  symbol,
  onClose,
}: {
  row: HistoryRow;
  categories: readonly Category[];
  symbol: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(row.amountCents / 100));
  const [category, setCategory] = useState(row.categoryKey);
  const [merchant, setMerchant] = useState(row.merchant ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    const form = new FormData();
    form.set("amount", amount);
    form.set("category", category);
    if (merchant.trim()) form.set("merchant", merchant.trim());
    form.set("spentAt", row.spentAt.slice(0, 10));

    startTransition(async () => {
      const result = await updateTransaction(row.id, form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
    });
  };

  return (
    <Sheet title="Edit spend" onClose={onClose}>
      <AmountField symbol={symbol} value={amount} onChange={setAmount} onEnter={save} autoFocus />
      <CategoryChips categories={categories} value={category} onChange={setCategory} />

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-700">What was it?</span>
        <input
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
          placeholder="Optional"
          className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <Button variant="primary" size="md" block className="mt-4" onClick={save} disabled={pending || !amount}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save changes
      </Button>
    </Sheet>
  );
}
