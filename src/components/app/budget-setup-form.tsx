"use client";

import { Check, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/onboarding/controls";
import { addCustomCategory, setCategoryBudget, setMonthlyBudget } from "@/server/actions/budget";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * BUDGET SETUP FORM
 * ----------------------------------------------------------------------------
 * Two independent forms on one screen: the monthly total, and per-category
 * amounts.
 *
 * They are independent on purpose. Editing "nightlife" should not require
 * re-submitting the whole budget, and re-running the total must not discard a
 * category the student has already tuned — which is why `setCategoryBudget`
 * marks the envelope `custom` and `setMonthlyBudget` preserves custom rows.
 *
 * The copy here says exactly that, and no more. It previously claimed "the
 * total updates to match", which was never true: category edits do not move
 * the monthly figure. A setup screen that misdescribes its own arithmetic is
 * how a student ends up with a budget they did not intend and no idea why.
 * ============================================================================
 */

type Where = { currency: string; locale: string };

export function BudgetSetupForm({
  symbol,
  currentTotalCents,
  excludeHousing,
  categories,
  canAddCustom,
  where,
}: {
  symbol: string;
  currentTotalCents: number;
  excludeHousing: boolean;
  categories: readonly { key: string; label: string; plannedCents: number }[];
  canAddCustom: boolean;
  where: Where;
}) {
  const [total, setTotal] = useState(currentTotalCents > 0 ? String(currentTotalCents / 100) : "");
  const [exclude, setExclude] = useState(excludeHousing);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /* Live sum of the category amounts as edited on screen, so the student can
     see the two numbers agree — or see that they do not, which is allowed. */
  const [sums, setSums] = useState<Record<string, number>>(() =>
    Object.fromEntries(categories.map((category) => [category.key, category.plannedCents])),
  );
  const categoryTotal = Object.values(sums).reduce((sum, cents) => sum + cents, 0);
  const monthlyCents = Math.round((Number(total.replace(",", ".")) || 0) * 100);
  const drift = categoryTotal - monthlyCents;

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
      <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
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
          <span className="text-[0.9375rem] text-ink-800">Rent is handled separately — leave it out</span>
        </label>

        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
          Saving this splits the figure across the categories below. Anything you have changed
          yourself is kept exactly as you set it.
        </p>

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
        <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
          <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Per category</h2>
          <p className="mb-4 text-[0.875rem] leading-relaxed text-ink-500">
            Each one saves on its own. Changing a category does not move the monthly figure above —
            it marks that category as yours, so re-saving the monthly figure leaves it alone.
          </p>

          <div className="space-y-3">
            {categories.map((category) => (
              <CategoryRow
                key={category.key}
                categoryKey={category.key}
                label={category.label}
                plannedCents={category.plannedCents}
                symbol={symbol}
                onSaved={(cents) => setSums((current) => ({ ...current, [category.key]: cents }))}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-ink-100 pt-3 text-[0.875rem]">
            <span className="text-ink-600">Categories add up to</span>
            <span className="tnum font-mono font-semibold text-ink-900">{money(categoryTotal / 100, where)}</span>
          </div>
          {monthlyCents > 0 && Math.abs(drift) >= 100 ? (
            <p className="mt-1.5 flex items-start gap-2 text-[0.8125rem] text-ink-600">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-deep" />
              <span>
                That is {money(Math.abs(drift) / 100, where)} {drift > 0 ? "more" : "less"} than the
                monthly figure. Not a problem — the budget uses the categories — but the monthly
                number above will not match until you change it.
              </span>
            </p>
          ) : null}
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
  onSaved,
}: {
  categoryKey: string;
  label: string;
  plannedCents: number;
  symbol: string;
  onSaved: (cents: number) => void;
}) {
  const [value, setValue] = useState(String(plannedCents / 100));
  const [committed, setCommitted] = useState(String(plannedCents / 100));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Saves on blur rather than behind a button. Eleven categories with eleven
     Save buttons is a form nobody finishes — but a failure must still be
     visible, or a silent rejection looks exactly like a successful save. */
  const commit = () => {
    if (value === committed) return;
    setError(null);

    const form = new FormData();
    form.set("category", categoryKey);
    form.set("amount", value);

    startTransition(async () => {
      const result = await setCategoryBudget(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCommitted(value);
      onSaved(Math.round((Number(value.replace(",", ".")) || 0) * 100));
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    });
  };

  return (
    <div>
      <label className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-[0.9375rem] text-ink-800">{label}</span>

        <span
          className={cn(
            "flex h-11 w-32 items-center gap-1 rounded-lg border bg-white pl-3 focus-within:border-ink-400",
            error ? "border-pulse" : "border-ink-200",
          )}
        >
          <span aria-hidden className="tnum font-mono text-[0.875rem] text-ink-400">
            {symbol}
          </span>
          <input
            inputMode="decimal"
            value={value}
            aria-label={`${label} budget`}
            aria-invalid={error ? true : undefined}
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

      {error ? (
        <p role="alert" className="mt-1 text-right text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}
    </div>
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
  const [added, setAdded] = useState<string | null>(null);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <h2 className="mb-1 text-[1.0625rem] font-semibold text-ink-950">Add a category</h2>
      <p className="mb-4 text-[0.875rem] text-ink-500">
        Anything the defaults do not cover. It is yours, so re-saving the monthly figure never
        removes it.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={name}
          placeholder="Laundry, hobby, anything"
          aria-label="Category name"
          onChange={(event) => setName(event.target.value)}
          className="h-11 flex-1 rounded-lg border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
        <span className="flex h-11 w-32 items-center gap-1 rounded-lg border border-ink-200 bg-white pl-3">
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
      {added ? (
        <p role="status" className="mt-3 text-[0.8125rem] text-mint-deep">
          {added} added. It appears in the list above.
        </p>
      ) : null}

      <Button
        variant="outline"
        size="md"
        className="mt-4"
        disabled={pending || name.length === 0 || amount.length === 0}
        onClick={() => {
          setError(null);
          setAdded(null);
          const form = new FormData();
          form.set("name", name);
          form.set("amount", amount);
          startTransition(async () => {
            const result = await addCustomCategory(form);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setAdded(name);
            setName("");
            setAmount("");
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add category
      </Button>
    </section>
  );
}
