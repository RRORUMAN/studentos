"use client";

import { ArrowRight, Check, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/onboarding/controls";
import type { Place } from "@/data/types";
import { addTransaction } from "@/server/actions/budget";
import { affordVerdictMeta, canAfford } from "@/server/engines/afford";
import { betterOptionForSpend } from "@/server/engines/better-option";
import type { BudgetReading } from "@/server/engines/budget";
import { layersForCategory, parseAmount } from "@/server/engines/budget";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * CAN I AFFORD THIS?
 * ----------------------------------------------------------------------------
 * The answer arrives as you type.
 *
 * It used to require a submit and a navigation per question, which is the
 * wrong shape for the thing being asked: standing outside a restaurant
 * deciding between €18 and €25 is a *comparison*, and a comparison that costs
 * a page load each way does not get made. Every figure here is arithmetic over
 * a reading the server already sent, so the verdict can be recomputed on every
 * keystroke for free — no request, no spinner, no model.
 *
 * `canAfford` and `betterOptionForSpend` are the same pure engines the server
 * uses, imported directly. There is no second implementation of the maths to
 * drift out of step with the first.
 * ============================================================================
 */

type Where = { currency: string; locale: string };
type Category = { key: string; label: string };

/** Where "find something cheaper in this category" goes on Discover. */
const DISCOVER_TAB: Record<string, string> = {
  "eating-out": "food",
  groceries: "groceries",
  nightlife: "nightlife",
  fitness: "fitness",
  entertainment: "free",
  shopping: "deals",
};

export function AffordForm({
  symbol,
  defaultAmount,
  defaultCategory,
  categories,
  reading,
  places,
  citySlug,
  maxWalkMinutes,
  nowIso,
  where,
}: {
  symbol: string;
  defaultAmount: string;
  defaultCategory: string;
  categories: readonly Category[];
  reading: BudgetReading;
  /** The student's city, for the cheaper-option check. */
  places: readonly Place[];
  citySlug: string;
  maxWalkMinutes: number;
  /** The request clock, so server and client agree on "until Monday". */
  nowIso: string;
  where: Where;
}) {
  const [amount, setAmount] = useState(defaultAmount);
  const [category, setCategory] = useState(defaultCategory);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const fmt = useMemo(() => (cents: number) => money(cents / 100, where), [where]);

  const amountCents = useMemo(() => {
    const value = parseAmount(amount);
    return value === null ? null : Math.round(value * 100);
  }, [amount]);

  const result = useMemo(
    () => (amountCents === null ? null : canAfford({ amountCents, reading, now, formatMoney: fmt })),
    [amountCents, reading, now, fmt],
  );

  const envelope = reading.categories.find((entry) => entry.category === category) ?? null;
  const categoryLeft = envelope && result ? envelope.remainingCents - result.amountCents : null;

  /* The same "better option" rule the place pages use, applied to a spend
     rather than to a place: same job, genuinely cheaper, about as good. */
  const better = useMemo(
    () =>
      amountCents === null
        ? null
        : betterOptionForSpend({
            amountCents,
            layers: layersForCategory(category),
            citySlug,
            candidates: places,
            maxWalkMinutes,
          }),
    [amountCents, category, citySlug, places, maxWalkMinutes],
  );

  const meta = result ? affordVerdictMeta[result.verdict] : null;
  const discoverTab = DISCOVER_TAB[category];
  const cheaperHref =
    amountCents === null
      ? "/discover"
      : `/discover?${discoverTab ? `tab=${discoverTab}&` : ""}max=${Math.max(1, Math.floor((amountCents * 0.7) / 100))}`;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <MoneyInput
          large
          label="How much?"
          symbol={symbol}
          value={amount}
          onChange={(value) => {
            setAmount(value);
            setLogged(false);
            setError(null);
          }}
          placeholder="35"
          hint="The answer updates as you type."
        />

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-ink-800">On what?</legend>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  setCategory(entry.key);
                  setLogged(false);
                }}
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
      </section>

      {result && meta ? (
        <section className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
          <div
            className={cn(
              "flex items-start gap-4 p-5",
              result.verdict === "yes" && "bg-mint-soft/60",
              result.verdict === "possibly" && "bg-amber-soft/60",
              result.verdict === "not-ideal" && "bg-pulse-soft/60",
              result.verdict === "no-budget" && "bg-flow-soft/60",
            )}
          >
            <MascotArt
              state={result.verdict === "yes" ? "budget" : result.verdict === "possibly" ? "thinking" : "concerned"}
              className="size-12 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <Badge accent={meta.accent} tone="solid">
                {meta.label}
              </Badge>
              <p className="mt-2.5 text-[1.25rem] leading-snug font-semibold text-ink-950">{result.headline}</p>
            </div>
          </div>

          {result.verdict !== "no-budget" ? (
            <>
              <dl className="grid grid-cols-2 divide-x divide-ink-100 border-t border-ink-100 sm:grid-cols-3">
                <Figure label={`Safe until ${result.horizonLabel}`} value={fmt(result.horizonCents)} />
                <Figure
                  label="Left after this"
                  value={fmt(Math.max(0, result.leftoverCents))}
                  tone={result.leftoverCents < 0 ? "bad" : result.verdict === "yes" ? "good" : "watch"}
                />
                {envelope && categoryLeft !== null ? (
                  <Figure
                    label={`Left in ${envelope.label.toLowerCase()}`}
                    value={fmt(Math.max(0, categoryLeft))}
                    tone={categoryLeft < 0 ? "bad" : undefined}
                    className="col-span-2 border-t border-ink-100 sm:col-span-1 sm:border-t-0"
                  />
                ) : (
                  <Figure
                    label="Per day after"
                    value={fmt(result.leftoverPerDayCents)}
                    className="col-span-2 border-t border-ink-100 sm:col-span-1 sm:border-t-0"
                  />
                )}
              </dl>

              {result.suggestedCents ? (
                <p className="border-t border-ink-100 px-5 py-3.5 text-[0.875rem] text-ink-700">
                  A comfortable figure would be about{" "}
                  <button
                    type="button"
                    onClick={() => setAmount(String(Math.floor(result.suggestedCents! / 100)))}
                    className="tnum font-semibold underline underline-offset-4 hover:text-ink-950"
                  >
                    {fmt(result.suggestedCents)}
                  </button>
                  .
                </p>
              ) : null}

              {/* Two next actions, because a verdict with nothing to do next is
                  just a number. */}
              <div className="flex flex-col gap-2 border-t border-ink-100 p-4 sm:flex-row">
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  disabled={pending || logged}
                  onClick={() => {
                    setError(null);
                    const form = new FormData();
                    form.set("amount", amount);
                    form.set("category", category);
                    startTransition(async () => {
                      const action = await addTransaction(form);
                      if (!action.ok) setError(action.message);
                      else setLogged(true);
                    });
                  }}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : logged ? <Check className="size-4" /> : null}
                  {logged ? "Logged" : "Log this spend"}
                </Button>

                <Link
                  href={cheaperHref}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-ink-200 bg-paper px-5 py-2.5 text-[0.9375rem] font-medium text-ink-900 hover:border-ink-300 hover:bg-white"
                >
                  <Search className="size-4" />
                  Find a cheaper option
                </Link>
              </div>

              {error ? (
                <p role="alert" className="px-5 pb-4 text-[0.8125rem] text-pulse-deep">
                  {error}
                </p>
              ) : null}
              {logged ? (
                <p role="status" className="px-5 pb-4 text-[0.8125rem] text-mint-deep">
                  Logged against {envelope?.label.toLowerCase() ?? "your budget"}. Safe-to-spend has moved.
                </p>
              ) : null}
            </>
          ) : (
            <div className="border-t border-ink-100 p-5">
              <Link
                href="/budget/setup"
                className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-semibold text-paper"
              >
                Set a budget
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}
        </section>
      ) : (
        <p className="rounded-2xl bg-paper-2 px-5 py-6 text-center text-[0.9375rem] text-ink-600">
          Type an amount and the verdict appears here — no submitting, no waiting.
        </p>
      )}

      {result && result.verdict !== "no-budget" && better ? (
        <Link
          href={`/discover/${better.place.id}`}
          className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]"
        >
          <span className="min-w-0 flex-1">
            <span className="font-mono text-micro uppercase tracking-[0.1em] text-mint-deep">Better option</span>
            <span className="mt-0.5 block text-[1rem] font-semibold text-ink-950">{better.place.name}</span>
            <span className="mt-0.5 block text-[0.8125rem] text-ink-600">
              {money(better.place.price ?? 0, where)} · {better.why} · saves {fmt(better.savingCents)}
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-ink-400" />
        </Link>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone?: "good" | "watch" | "bad";
  className?: string;
}) {
  return (
    <div className={cn("px-5 py-4", className)}>
      <dt className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">{label}</dt>
      <dd
        className={cn(
          "tnum mt-1 font-mono text-[1.375rem] leading-none font-semibold",
          tone === "good" ? "text-mint-deep" : tone === "bad" ? "text-pulse-deep" : tone === "watch" ? "text-amber-deep" : "text-ink-950",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
