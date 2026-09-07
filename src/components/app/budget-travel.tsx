"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/onboarding/controls";
import { removeTripBudget, saveTripBudget } from "@/server/actions/budget";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * TRIP BUDGETS
 * ----------------------------------------------------------------------------
 * A weekend away is not a category, it is an event with dates.
 *
 * The money goes into its own envelope and is held *out* of safe-to-spend
 * until the trip starts. That is the whole feature: without it, setting aside
 * €180 for Barcelona makes the daily figure look healthier for two weeks and
 * then collapses it, which is the opposite of what putting money aside is
 * supposed to do.
 * ============================================================================
 */

type Where = { currency: string; locale: string };

export type TripView = {
  category: string;
  name: string;
  /** Formatted on the server, in the city's timezone. */
  datesLabel: string;
  start: string;
  end: string;
  plannedCents: number;
  spentCents: number;
  remainingCents: number;
  status: "upcoming" | "active" | "past";
  daysUntil: number;
  reserved: boolean;
};

export function TripBudgets({
  trips,
  symbol,
  where,
}: {
  trips: readonly TripView[];
  symbol: string;
  where: Where;
}) {
  const [open, setOpen] = useState(trips.length === 0);
  const fmt = (cents: number) => money(cents / 100, where);

  return (
    <div className="space-y-4">
      {trips.length > 0 ? (
        <ul className="space-y-3">
          {trips.map((trip) => (
            <TripRow key={trip.category} trip={trip} fmt={fmt} />
          ))}
        </ul>
      ) : null}

      {open ? (
        <TripForm symbol={symbol} onDone={() => setOpen(trips.length === 0)} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-[0.8125rem] font-medium text-ink-700 hover:bg-ink-100"
        >
          <Plus className="size-3.5" />
          Add a trip
        </button>
      )}
    </div>
  );
}

function TripRow({ trip, fmt }: { trip: TripView; fmt: (cents: number) => string }) {
  const [pending, startTransition] = useTransition();
  const spentFraction = trip.plannedCents === 0 ? 0 : Math.min(1, trip.spentCents / trip.plannedCents);

  return (
    <li
      className={cn(
        "rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6",
        pending && "opacity-40",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-semibold text-ink-950">{trip.name}</p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-500">
            {trip.datesLabel} ·{" "}
            {trip.status === "past"
              ? "finished"
              : trip.status === "active"
                ? "happening now"
                : trip.daysUntil === 0
                  ? "starts today"
                  : `in ${trip.daysUntil} day${trip.daysUntil === 1 ? "" : "s"}`}
          </p>
        </div>
        <span className="tnum shrink-0 text-right font-mono text-[0.9375rem] font-semibold text-ink-900">
          {fmt(trip.remainingCents)}
          <span className="block text-[0.6875rem] font-normal text-ink-400">of {fmt(trip.plannedCents)} left</span>
        </span>
        <button
          type="button"
          aria-label={`Remove ${trip.name}`}
          disabled={pending}
          onClick={() => startTransition(async () => void (await removeTripBudget(trip.category)))}
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-300 hover:bg-pulse-soft hover:text-pulse-deep"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-flow transition-[width] duration-500"
          style={{ width: `${spentFraction * 100}%` }}
        />
      </div>

      <p className="mt-2 text-[0.8125rem] text-ink-600">
        {trip.reserved
          ? `Held back from safe-to-spend until ${trip.datesLabel.split("–")[0]}.`
          : trip.status === "active"
            ? "Counting against safe-to-spend now the trip has started."
            : "Finished. What is left is back in the month."}
      </p>
    </li>
  );
}

function TripForm({ symbol, onDone }: { symbol: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <h2 className="mb-4 text-[1.0625rem] font-semibold text-ink-950">A trip to budget for</h2>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">Where to?</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Barcelona"
          aria-label="Trip name"
          className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">From</span>
          <input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            aria-label="Start date"
            className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">To</span>
          <input
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            aria-label="End date"
            className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900"
          />
        </label>
      </div>

      <div className="mt-3">
        <MoneyInput
          label="Set aside"
          symbol={symbol}
          value={amount}
          onChange={setAmount}
          placeholder="180"
          hint="Held out of safe-to-spend until the trip starts."
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <Button
        variant="primary"
        size="md"
        className="mt-4"
        disabled={pending || !name.trim() || !start || !end || !amount}
        onClick={() => {
          setError(null);
          const form = new FormData();
          form.set("name", name);
          form.set("start", start);
          form.set("end", end);
          form.set("amount", amount);
          startTransition(async () => {
            const result = await saveTripBudget(form);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setName("");
            setStart("");
            setEnd("");
            setAmount("");
            onDone();
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save trip
      </Button>
    </section>
  );
}
