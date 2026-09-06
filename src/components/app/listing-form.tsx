"use client";

import { Info, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { listingCategoryMeta, type ListingCategory } from "@/domain/social";
import { createListing } from "@/server/actions/marketplace";
import { cn } from "@/lib/utils";

/**
 * The listing form.
 *
 * Note what is not on it: an address. `meetArea` asks for a public place and
 * the type has nowhere to put anything else, so a seller cannot publish where
 * they live even by accident.
 */
export function ListingForm({
  symbol,
  fromLeaving,
  suggestedArea,
}: {
  symbol: string;
  fromLeaving: boolean;
  suggestedArea: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<ListingCategory>("furniture");
  const [condition, setCondition] = useState<"new" | "good" | "used" | "worn">("good");
  const [form, setForm] = useState({
    title: "",
    detail: "",
    price: "",
    meetArea: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const free = category === "free";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);

        const data = new FormData();
        data.set("title", form.title);
        data.set("detail", form.detail);
        data.set("category", category);
        data.set("price", free ? "0" : form.price || "0");
        data.set("condition", condition);
        data.set("meetArea", form.meetArea);
        if (fromLeaving) data.set("fromLeaving", "1");

        startTransition(async () => {
          const result = await createListing(data);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          router.push("/marketplace");
        });
      }}
      className="space-y-5"
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">What is it</span>
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="IKEA desk, collect from Moncloa"
          className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-800">Category</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(listingCategoryMeta) as ListingCategory[]).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setCategory(entry)}
              aria-pressed={category === entry}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors",
                category === entry
                  ? "border-ink-950 bg-ink-950 text-paper"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
              )}
            >
              <span aria-hidden>{listingCategoryMeta[entry].emoji}</span>
              {listingCategoryMeta[entry].label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">Condition and detail</span>
        <textarea
          value={form.detail}
          onChange={(event) => setForm({ ...form, detail: event.target.value })}
          placeholder="Two years old, one scratch on the top. Comes apart for transport."
          rows={3}
          className="w-full rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>

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
                condition === entry
                  ? "border-ink-950 bg-ink-950 text-paper"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
              )}
            >
              {entry}
            </button>
          ))}
        </div>
      </fieldset>

      {!free ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800">Price</span>
          <span className="flex h-12 items-center gap-1 rounded-md border border-ink-200 bg-white pl-3.5 focus-within:border-ink-400">
            <span aria-hidden className="tnum font-mono text-ink-400">
              {symbol}
            </span>
            <input
              inputMode="decimal"
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: event.target.value.replace(/[^0-9.,]/g, "") })
              }
              className="tnum w-full bg-transparent pr-3.5 font-mono text-[0.9375rem] text-ink-900 outline-none"
            />
          </span>
        </label>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">
          Where to collect it
        </span>
        <input
          value={form.meetArea}
          onChange={(event) => setForm({ ...form, meetArea: event.target.value })}
          placeholder={`${suggestedArea} main entrance`}
          className="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-[0.9375rem] text-ink-900 placeholder:text-ink-400"
        />
      </label>

      <p className="flex items-start gap-2.5 rounded-lg bg-flow-soft/60 px-3.5 py-3 text-[0.8125rem] leading-snug text-flow-deep">
        <Info className="mt-px size-4 shrink-0" />
        A public place — a campus building, a station, a square. Never your address. There is no
        field for one and there never will be.
      </p>

      {error ? (
        <p role="alert" className="text-[0.8125rem] text-pulse-deep">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        disabled={
          pending ||
          form.title.trim().length < 3 ||
          form.detail.trim().length === 0 ||
          form.meetArea.trim().length < 3
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        List it
      </Button>
    </form>
  );
}
