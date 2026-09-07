"use client";

import { Info, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  type ExchangeKind,
  exchangeKindMeta,
  exchangeKinds,
  type ListingCategory,
  type ListingMode,
  listingCategoryMeta,
} from "@/domain/social";
import { createListing } from "@/server/actions/exchange";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * EXCHANGE FORM
 * ----------------------------------------------------------------------------
 * Lane, then "I have / I need", then the few fields that lane needs. Note
 * what is not on it: an address. `meetArea` asks for a public place and the
 * row has nowhere to put anything else.
 * ============================================================================
 */
export function ExchangeForm({
  symbol,
  fromLeaving,
  suggestedArea,
  initialKind = "sell",
  initialMode = "offer",
}: {
  symbol: string;
  fromLeaving: boolean;
  suggestedArea: string;
  initialKind?: ExchangeKind;
  initialMode?: ListingMode;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ExchangeKind>(initialKind);
  const [mode, setMode] = useState<ListingMode>(initialMode);
  const lane = exchangeKindMeta[kind];
  const [category, setCategory] = useState<ListingCategory>(lane.categories[0]);
  const [condition, setCondition] = useState<"new" | "good" | "used" | "worn">("good");
  const [form, setForm] = useState({ title: "", detail: "", price: "", meetArea: "", whenAt: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const priced = lane.priced && kind !== "free";
  const timed = kind === "ride" || kind === "borrow" || kind === "help";
  const placeholder =
    kind === "sell"
      ? mode === "offer" ? "IKEA desk, collect from Moncloa" : "Desk under €30, near campus"
      : kind === "borrow"
        ? mode === "offer" ? "Cordless drill, weekends" : "Anyone have a drill I can borrow?"
        : kind === "help"
          ? mode === "offer" ? "Can help translate Spanish contracts" : "Need help moving a sofa on Saturday"
          : kind === "ride"
            ? mode === "offer" ? "Taxi to the airport Friday 06:00, 2 seats" : "Split a taxi to the airport Friday morning"
            : "Kitchen starter box — plates, pans, cutlery";

  const changeKind = (next: ExchangeKind) => {
    setKind(next);
    setCategory(exchangeKindMeta[next].categories[0]);
    if (next === "free") setMode("offer");
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const data = new FormData();
        data.set("kind", kind);
        data.set("mode", mode);
        data.set("title", form.title);
        data.set("detail", form.detail);
        data.set("category", category);
        data.set("price", priced ? form.price || "0" : "0");
        data.set("condition", condition);
        data.set("meetArea", form.meetArea);
        if (timed && form.whenAt) data.set("whenAt", new Date(form.whenAt).toISOString());
        if (fromLeaving) data.set("fromLeaving", "1");
        startTransition(async () => {
          const result = await createListing(data);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          router.push(`/exchange/${result.id}`);
        });
      }}
      className="space-y-5"
    >
      {/* ---- lane ------------------------------------------------------- */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-800">What kind of exchange</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {exchangeKinds.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={kind === entry}
              onClick={() => changeKind(entry)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                kind === entry ? "border-ink-950 bg-ink-950 text-paper" : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
              )}
            >
              <span aria-hidden className="text-lg">{exchangeKindMeta[entry].emoji}</span>
              <span className="text-[0.8125rem] font-semibold">{exchangeKindMeta[entry].label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[0.8125rem] text-ink-500">{lane.blurb}</p>
      </fieldset>

      {/* ---- mode ------------------------------------------------------- */}
      {kind !== "free" ? (
        <fieldset>
          <legend className="sr-only">Offering or asking</legend>
          <div className="flex rounded-full bg-paper-2 p-1">
            {(["offer", "request"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={mode === entry}
                onClick={() => setMode(entry)}
                className={cn(
                  "h-9 flex-1 rounded-full text-[0.875rem] font-medium transition-colors",
                  mode === entry ? "bg-white text-ink-950 shadow-[var(--shadow-flat)]" : "text-ink-500",
                )}
              >
                {entry === "offer" ? lane.offer : lane.request}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">{mode === "offer" ? "What is it" : "What do you need"}</span>
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder={placeholder}
          className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-800">Category</legend>
        <div className="flex flex-wrap gap-1.5">
          {lane.categories.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setCategory(entry)}
              aria-pressed={category === entry}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors",
                category === entry ? "border-ink-950 bg-ink-950 text-paper" : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
              )}
            >
              <span aria-hidden>{listingCategoryMeta[entry].emoji}</span>
              {listingCategoryMeta[entry].label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">{kind === "sell" && mode === "offer" ? "Condition and detail" : "Detail"}</span>
        <textarea
          value={form.detail}
          onChange={(event) => setForm({ ...form, detail: event.target.value })}
          placeholder={
            kind === "ride"
              ? "Where from, where to, how many seats, how to split it."
              : kind === "help"
                ? "What it involves and roughly how long."
                : "Two years old, one scratch on the top. Comes apart for transport."
          }
          rows={3}
          className="w-full rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>

      {kind === "sell" && mode === "offer" ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-800">Condition</legend>
          <div className="flex gap-2">
            {(["new", "good", "used", "worn"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setCondition(entry)}
                aria-pressed={condition === entry}
                className={cn(
                  "h-9 flex-1 rounded-full border text-[0.8125rem] font-medium capitalize transition-colors",
                  condition === entry ? "border-ink-950 bg-ink-950 text-paper" : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
                )}
              >
                {entry}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {priced ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">
            {mode === "offer" ? (kind === "ride" ? "Price per seat" : "Price") : "Up to"}
          </span>
          <span className="flex h-12 items-center gap-1 rounded-md border border-ink-200 bg-white pl-3.5 focus-within:border-ink-400">
            <span aria-hidden className="tnum font-mono text-ink-400">{symbol}</span>
            <input
              inputMode="decimal"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value.replace(/[^0-9.,]/g, "") })}
              placeholder="0"
              className="tnum w-full bg-transparent pr-3.5 font-mono text-[0.9375rem] text-ink-900 outline-none"
            />
          </span>
        </label>
      ) : null}

      {timed ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">{kind === "ride" ? "When" : "When (optional)"}</span>
          <input
            type="datetime-local"
            value={form.whenAt}
            onChange={(event) => setForm({ ...form, whenAt: event.target.value })}
            className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900"
          />
        </label>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">{kind === "ride" ? "Meeting point" : "Where to meet"}</span>
        <input
          value={form.meetArea}
          onChange={(event) => setForm({ ...form, meetArea: event.target.value })}
          placeholder={`${suggestedArea} main entrance`}
          className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>

      <p className="flex items-start gap-2.5 rounded-lg bg-flow-soft/60 px-3.5 py-3 text-[0.8125rem] leading-snug text-flow-deep">
        <Info className="mt-px size-4 shrink-0" />
        A public place — a campus building, a station, a square. Never your address. There is no field for one and there never will be.
      </p>

      {error ? <p role="alert" className="text-[0.8125rem] text-pulse-deep">{error}</p> : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        disabled={pending || form.title.trim().length < 3 || form.detail.trim().length === 0 || form.meetArea.trim().length < 3}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {mode === "offer" ? "Post it" : "Post the request"}
      </Button>
    </form>
  );
}
