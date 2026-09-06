"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/onboarding/controls";
import {
  addCustomCategory,
  setCategoryBudget,
  setMonthlyBudget,
} from "@/server/actions/budget";

/**
 * ============================================================================
 * BUDGET SETUP FORM
 * ----------------------------------------------------------------------------
 * Two independent forms on one screen: the monthly total, and per-category
 * overrides.
 *
 * They are independent on purpose. Editing "nightlife" should not require
 * re-submitting the whole budget, and re-running the total should not silently
 * discard a category the student has already tuned — which is exactly what
 * `setMonthlyBudget` protects against on the server by preserving `custom`
 * envelopes.
 * ============================================================================
 */

export function BudgetSetupForm({
  symbol,
  currentTotalCents,
  excludeHousing,
  categories,
  canAddCustom,
}: {
  symbol: string;
  currentTotalCents: number;
  excludeHousing: boolean;
  categories: readonly { key: string; label: string; plannedCents: number }[];
  canAddCustom: boolean;
}) {
  const [total, setTotal] = useState(
    currentTotalCents > 0 ? String(currentTotalCents / 100) : "",
  );
  const [exclude, setExclude] = useState(excludeHousing);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const saveTotal = () => {
    setError(null);
    setSaved(false);

    const form = new FormData();
    form.set("amount", total);
    if (exclude) form.set("excludeHousing", "on");

    startTransition(async () => {
      const result = await setMonthlyBudget(form);
      if (!result.ok) setError(result.message);
      else setSaved(true);
    });
  };

  return (
    <div className="space-y-8">
      {/* ---- total -------------------------------------------------------- */}
      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <MoneyInput
          large
          label="Monthly budget"
          symbol={symbol}
          value={total}
          onChange={setTotal}
          placeholder="800"
          hint="Everything you expect to spend in a month."
        />

        <label className="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            checked={exclude}
            onChange={(event) => setExclude(event.target.checked)}
            className="size-4 rounded-xs border-ink-300"
          />
          <span className="text-[0.9375rem] text-ink-800">
            Rent is handled separately — leave it out
          </span>
        </label>

        {error ? (
          <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">
            {error}
          </p>
        ) : null}

        <Button
          variant="primary"
          size="md"
          className="mt-4"
          onClick={saveTotal}
          disabled={pending || total.length === 0}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {saved ? <Check className="size-4" /> : null}
          {saved ? "Saved" : "Save budget"}
        </Button>
      </section>

      {/* ---- per category -------------------------------------------------- */}
      {categories.length > 0 ? (
        <section className="rounded-xl border border-ink-200 bg-white p-5">
          <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Per category</h2>
          <p className="mb-4 text-[0.875rem] text-ink-500">
            Move any of these. The total updates to match.
          </p>

          <div className="space-y-3">
            {categories.map((category) => (
              <CategoryRow
                key={category.key}
                categoryKey={category.key}
                label={category.label}
                plannedCents={category.plannedCents}
                symbol={symbol}
              />
            ))}
          </div>
        </section>
      ) : null}

      {canAddCustom ? <AddCategory symbol={symbol} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Category row                                                                */
/* -------------------------------------------------------------------------- */

function CategoryRow({
  categoryKey,
  label,
  plannedCents,
  symbol,
}: {
  categoryKey: string;
  label: string;
  plannedCents: number;
  symbol: string;
}) {
  const [value, setValue] = useState(String(plannedCents / 100));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  /* Saves on blur rather than behind a button. Eleven categories with eleven
     Save buttons is a form nobody finishes. */
  const commit = () => {
    if (value === String(plannedCents / 100)) return;
    const form = new FormData();
    form.set("category", categoryKey);
    form.set("amount", value);

    startTransition(async () => {
      const result = await setCategoryBudget(form);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      }
    });
  };

  return (
    <label className="flex items-center gap-3">
      <span className="min-w-0 flex-1 text-[0.9375rem] text-ink-800">{label}</span>

      <span className="flex h-11 w-32 items-center gap-1 rounded-md border border-ink-200 bg-white pl-3 focus-within:border-ink-400">
        <span aria-hidden className="tnum font-mono text-[0.875rem] text-ink-400">
          {symbol}
        </span>
        <input
          inputMode="decimal"
          value={value}
          aria-label={`${label} budget`}
          onChange={(event) => setValue(event.target.value.replace(/[^0-9.,]/g, ""))}
          onBlur={commit}
          className="tnum w-full bg-transparent pr-3 font-mono text-[0.9375rem] text-ink-900 outline-none"
        />
      </span>

      <span aria-live="polite" className="w-5 shrink-0">
        {pending ? <Loader2 className="size-4 animate-spin text-ink-400" /> : null}
        {saved ? <Check className="size-4 text-mint-deep" /> : null}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Custom category                                                             */
/* -------------------------------------------------------------------------- */

function AddCategory({ symbol }: { symbol: string }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-5">
      <h2 className="mb-4 text-[1.0625rem] font-semibold text-ink-950">Add a category</h2>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={name}
          placeholder="Laundry, hobby, anything"
          aria-label="Category name"
          onChange={(event) => setName(event.target.value)}
          className="h-11 flex-1 rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
        <span className="flex h-11 w-32 items-center gap-1 rounded-md border border-ink-200 bg-white pl-3">
          <span aria-hidden className="tnum font-mono text-[0.875rem] text-ink-400">
            {symbol}
          </span>
          <input
            inputMode="decimal"
            value={amount}
            aria-label="Amount"
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ""))}
            className="tnum w-full bg-transparent pr-3 font-mono text-[0.9375rem] text-ink-900 outline-none"
          />
        </span>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <Button
        variant="outline"
        size="md"
        className="mt-4"
        disabled={pending || name.length === 0 || amount.length === 0}
        onClick={() => {
          setError(null);
          const form = new FormData();
          form.set("name", name);
          form.set("amount", amount);
          startTransition(async () => {
            const result = await addCustomCategory(form);
            if (!result.ok) setError(result.message);
            else {
              setName("");
              setAmount("");
            }
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add category
      </Button>
    </section>
  );
}
