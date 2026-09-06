"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MoneyInput } from "@/components/onboarding/controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Can I afford this?" input. Amount plus a category chip. The result goes in
 * the URL so it can be reloaded, and so the server does the arithmetic.
 */
export function AffordForm({
  symbol,
  defaultAmount,
  defaultCategory,
  categories,
}: {
  symbol: string;
  defaultAmount: string;
  defaultCategory: string;
  categories: readonly { key: string; label: string }[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(defaultAmount);
  const [category, setCategory] = useState(defaultCategory);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!amount) return;
        router.push(`/budget/afford?amount=${encodeURIComponent(amount)}&category=${encodeURIComponent(category)}`);
      }}
      className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6"
    >
      <MoneyInput large label="How much?" symbol={symbol} value={amount} onChange={setAmount} placeholder="35" />

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-ink-800">On what?</legend>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setCategory(entry.key)}
              aria-pressed={category === entry.key}
              className={cn(
                "h-9 rounded-full px-3.5 text-[0.875rem] font-medium transition-colors",
                category === entry.key ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Button type="submit" variant="primary" size="lg" block className="mt-5" disabled={amount.length === 0}>
        Can I afford it?
      </Button>
    </form>
  );
}
