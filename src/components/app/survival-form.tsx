"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/onboarding/controls";
import { cn } from "@/lib/utils";

/**
 * The two inputs Survival Mode needs.
 *
 * Horizons are buttons rather than a date picker: "until Friday" is how the
 * question is actually asked, and asking someone in financial stress to operate
 * a calendar widget is a small cruelty. The result goes in the URL so a plan
 * can be reloaded, shared or bookmarked.
 */
const HORIZONS = [
  { days: 2, label: "2 days" },
  { days: 4, label: "4 days" },
  { days: 7, label: "A week" },
  { days: 14, label: "2 weeks" },
];

export function SurvivalForm({
  symbol,
  defaultAmount,
  defaultDays,
}: {
  symbol: string;
  defaultAmount: string;
  defaultDays: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(defaultAmount);
  const [days, setDays] = useState(defaultDays);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!amount) return;
        router.push(`/budget/survival?amount=${encodeURIComponent(amount)}&days=${days}`);
      }}
      className="rounded-xl border border-ink-200 bg-white p-5"
    >
      <MoneyInput
        large
        label="What have you got left?"
        symbol={symbol}
        value={amount}
        onChange={setAmount}
        placeholder="42"
      />

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium text-ink-800">And it has to last</legend>
        <div className="flex flex-wrap gap-2">
          {HORIZONS.map((horizon) => (
            <button
              key={horizon.days}
              type="button"
              onClick={() => setDays(String(horizon.days))}
              aria-pressed={days === String(horizon.days)}
              className={cn(
                "h-10 rounded-full border px-4 text-[0.875rem] font-medium transition-colors",
                days === String(horizon.days)
                  ? "border-ink-950 bg-ink-950 text-paper"
                  : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
              )}
            >
              {horizon.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        className="mt-5"
        disabled={amount.length === 0}
      >
        Build the plan
      </Button>
    </form>
  );
}
