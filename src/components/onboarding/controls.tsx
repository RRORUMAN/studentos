"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * ONBOARDING CONTROLS
 * ----------------------------------------------------------------------------
 * The three input shapes the whole flow is built from: a full-width option row,
 * a compact chip, and a progress bar.
 *
 * All three are real buttons with real pressed state. That matters more here
 * than anywhere else in the product: onboarding is the first thing a student
 * touches, it is almost entirely tapping, and a div pretending to be a button
 * is both inaccessible and feels subtly wrong under a thumb.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Option row                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The primary choice control. Full width, generous target, selection shown by
 * a filled tick rather than a colour change alone — colour alone fails for a
 * colour-blind student, and this is the screen where getting it wrong means
 * they cannot complete sign-up.
 */
export function OptionRow({
  label,
  detail,
  emoji,
  selected,
  multi = false,
  onSelect,
}: {
  label: string;
  detail?: string;
  emoji?: string;
  selected: boolean;
  multi?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex w-full items-center gap-3.5 rounded-lg border p-3.5 text-left",
        "transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out-soft)]",
        "active:translate-y-px",
        selected
          ? "border-ink-950 bg-signal-soft"
          : "border-ink-200 bg-white hover:border-ink-300 hover:bg-paper-2",
      )}
    >
      {emoji ? (
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-md bg-paper-2 text-lg">
          {emoji}
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium text-ink-900">{label}</span>
        {detail ? <span className="mt-0.5 block text-[0.8125rem] text-ink-500">{detail}</span> : null}
      </span>

      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center border transition-colors",
          multi ? "rounded-xs" : "rounded-full",
          selected ? "border-ink-950 bg-ink-950" : "border-ink-300 bg-white",
        )}
      >
        {selected ? <Check className="size-3.5 text-signal" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Chip                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The compact variant, for the interest grid where thirty options have to be
 * scannable. Still a 40px-tall target, because this grid is used on a phone
 * with a thumb.
 */
export function SelectChip({
  label,
  emoji,
  selected,
  onSelect,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[0.875rem] font-medium",
        "transition-[border-color,background-color,transform] duration-150",
        "active:translate-y-px",
        selected
          ? "border-ink-950 bg-ink-950 text-paper"
          : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-paper-2",
      )}
    >
      {emoji ? <span aria-hidden>{emoji}</span> : null}
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A bar, not "Step 4 of 12".
 *
 * The count is deliberately not printed. Twelve is an honest number and also a
 * discouraging one; a bar that is visibly two-thirds along reads as nearly done
 * and is exactly as truthful.
 */
export function Progress({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1 w-full overflow-hidden rounded-full bg-ink-200"
    >
      <div
        className="h-full rounded-full bg-ink-950 transition-[width] duration-500 ease-[var(--ease-out-soft)]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Money input                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A currency-prefixed number field.
 *
 * `inputMode="decimal"` gets the numeric keypad on a phone without the spinner
 * arrows and scroll-to-change behaviour of `type="number"` — the latter has
 * eaten many a budget when someone scrolled the page with the field focused.
 */
export function MoneyInput({
  label,
  symbol,
  value,
  onChange,
  placeholder = "0",
  hint,
  large = false,
}: {
  label: string;
  symbol: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  large?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>
      <span
        className={cn(
          "flex items-center gap-1 rounded-md border border-ink-200 bg-white pl-3.5",
          "focus-within:border-ink-400",
          large ? "h-16" : "h-12",
        )}
      >
        <span
          aria-hidden
          className={cn("tnum font-mono text-ink-400", large ? "text-2xl" : "text-base")}
        >
          {symbol}
        </span>
        <input
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            /* Digits and one separator only. Rejecting at the keystroke beats
               validating on submit for a field this simple. */
            const next = event.target.value.replace(/[^0-9.,]/g, "").replace(",", ".");
            if (next.split(".").length > 2) return;
            onChange(next);
          }}
          className={cn(
            "tnum w-full bg-transparent pr-3.5 font-mono text-ink-900 outline-none",
            large ? "text-2xl" : "text-base",
          )}
        />
      </span>
      {hint ? <span className="mt-1.5 block text-[0.8125rem] text-ink-500">{hint}</span> : null}
    </label>
  );
}
