"use client";

import { ArrowRight, Check, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/onboarding/controls";
import { parseAmountCents } from "@/server/engines/budget";
import { previewSurvival, saveSurvivalPlan } from "@/server/actions/budget";
import type { SurvivalCity } from "@/server/engines/survival";
import { buildSurvivalPlan, survivalPlanLines } from "@/server/engines/survival";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * SURVIVAL MODE — the form and the plan
 * ----------------------------------------------------------------------------
 * "I have €42 and it has to last until Friday."
 *
 * The plan is rebuilt as the amount changes. That matters more here than
 * anywhere else in the product: a student on their worst money day of the
 * month is trying to work out whether €38 or €45 is the number, and making
 * them submit and reload between the two is a design that has never met the
 * person using it.
 *
 * ---------------------------------------------------------------------------
 * HOW THE PAYWALL SURVIVES A LIVE RECOMPUTE
 *
 * An unlocked student recomputes locally — the engine is pure arithmetic, so
 * it is instant and free. A student without Survival Mode never receives the
 * allocated amounts at all: their recompute is a server action that returns
 * the *structure* — every category, every piece of reasoning, every free line
 * at its true €0 — with the paid figures absent. Computing the plan in their
 * browser to blur it afterwards would put the answer one view-source away,
 * which is not a paywall.
 * ============================================================================
 */

type Where = { currency: string; locale: string };

/** A line as the client renders it. `amountCents: null` means withheld. */
export type ViewLine = {
  key: string;
  label: string;
  basis: string;
  amountCents: number | null;
  free: boolean;
};

export type ViewPlan = {
  lines: ViewLine[];
  verdict: string;
  moves: string[];
};

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
  unlocked,
  city,
  initial,
  where,
}: {
  symbol: string;
  defaultAmount: string;
  defaultDays: string;
  unlocked: boolean;
  /** Only sent to a student who can use it; the locked path never computes. */
  city: SurvivalCity | null;
  /** Server-rendered so the first paint is a complete plan, JS or no JS. */
  initial: ViewPlan | null;
  where: Where;
}) {
  const [amount, setAmount] = useState(defaultAmount);
  const [days, setDays] = useState(defaultDays);
  const [remote, setRemote] = useState<ViewPlan | null>(initial);
  const [, startPreview] = useTransition();

  const amountCents = useMemo(() => parseAmountCents(amount), [amount]);
  const dayCount = Number(days) || 4;

  /* Unlocked: the same engine the server runs, on the client, per keystroke. */
  const localPlan = useMemo(() => {
    if (!unlocked || !city || amountCents === null) return null;
    return buildSurvivalPlan({ amountCents, days: dayCount, city });
  }, [unlocked, city, amountCents, dayCount]);

  const localView: ViewPlan | null = useMemo(
    () =>
      localPlan
        ? {
            lines: localPlan.lines.map((line) => ({
              key: line.key,
              label: line.label,
              basis: line.basis,
              amountCents: line.amountCents,
              free: line.free,
            })),
            verdict: localPlan.verdict,
            moves: [...localPlan.moves],
          }
        : null,
    [localPlan],
  );

  /* Locked: the structure comes back from the server, debounced so typing an
     amount is not one request per digit. */
  const dirty = useRef(false);
  useEffect(() => {
    if (unlocked) return;
    if (!dirty.current) return;
    /* An empty or half-typed amount has no plan to fetch. The *display* falls
       back to nothing below, derived rather than stored, so the effect never
       has to set state synchronously to clear it. */
    if (amountCents === null) return;

    const timer = window.setTimeout(() => {
      startPreview(async () => {
        const result = await previewSurvival({ amount, days: dayCount });
        if (!result.ok) return;
        setRemote({
          lines: result.preview.lines.map((line, index) => ({
            key: `${line.label}-${index}`,
            label: line.label,
            basis: line.basis,
            amountCents: line.free ? 0 : null,
            free: line.free,
          })),
          verdict: result.preview.verdict,
          moves: [],
        });
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [unlocked, amount, amountCents, dayCount]);

  const view = unlocked ? localView : amountCents === null ? null : remote;

  const touch = () => {
    dirty.current = true;
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <MoneyInput
          large
          label="What have you got left?"
          symbol={symbol}
          value={amount}
          onChange={(value) => {
            touch();
            setAmount(value);
          }}
          placeholder="42"
          hint="The plan rebuilds as you type. 42 or 42,50 both work."
        />

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium text-ink-800">And it has to last</legend>
          <div className="flex flex-wrap gap-2">
            {HORIZONS.map((horizon) => (
              <button
                key={horizon.days}
                type="button"
                onClick={() => {
                  touch();
                  setDays(String(horizon.days));
                }}
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
      </section>

      {view ? (
        <PlanView
          view={view}
          where={where}
          unlocked={unlocked}
          amountCents={amountCents}
          days={dayCount}
          lines={localPlan ? survivalPlanLines(localPlan) : null}
        />
      ) : (
        <p className="rounded-2xl bg-paper-2 px-5 py-6 text-center text-[0.9375rem] text-ink-600">
          Put in what you actually have. Food gets worked out first, a buffer is kept back, and the
          rest of the plan is things that cost nothing.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Plan                                                                        */
/* -------------------------------------------------------------------------- */

function PlanView({
  view,
  where,
  unlocked,
  amountCents,
  days,
  lines,
}: {
  view: ViewPlan;
  where: Where;
  unlocked: boolean;
  amountCents: number | null;
  days: number;
  lines: ReturnType<typeof survivalPlanLines> | null;
}) {
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <div className="border-b border-ink-100 bg-paper-2/60 p-5">
        <p className="text-[0.9375rem] leading-relaxed text-ink-800">{view.verdict}</p>
      </div>

      <ul className="divide-y divide-ink-100">
        {view.lines.map((line) => (
          <li key={line.key} className="flex items-start gap-4 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-medium text-ink-900">{line.label}</p>
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-500">{line.basis}</p>
            </div>

            {line.amountCents === null ? (
              /* Withheld on the server. Nothing to un-blur, nothing to read in
                 the page source. */
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-[0.75rem] font-semibold text-ink-500">
                <Lock className="size-3" aria-hidden />
                Locked
              </span>
            ) : (
              <span
                className={cn(
                  "tnum shrink-0 font-mono text-[0.9375rem] font-medium",
                  line.amountCents === 0 ? "text-mint-deep" : "text-ink-900",
                )}
              >
                {line.amountCents === 0 ? "Free" : money(line.amountCents / 100, where)}
              </span>
            )}
          </li>
        ))}
      </ul>

      {view.moves.length > 0 ? (
        <div className="border-t border-ink-100 px-5 py-4">
          <h2 className="mb-2 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            What actually makes this work
          </h2>
          <ul className="space-y-1.5">
            {view.moves.map((move) => (
              <li key={move} className="flex gap-2.5 text-[0.875rem] leading-snug text-ink-700">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal" />
                {move}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {unlocked && lines && amountCents !== null ? (
        <div className="border-t border-ink-100 p-4">
          <Button
            variant="primary"
            size="md"
            block
            disabled={pending || Boolean(saved)}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await saveSurvivalPlan({
                  amountCents,
                  days,
                  lines,
                  formattedAmount: money(amountCents / 100, where),
                });
                if (!result.ok) setError(result.message);
                else setSaved(result.href);
              });
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            {saved ? "Saved to your plans" : "Save this plan"}
          </Button>

          {saved ? (
            <p role="status" className="mt-2.5 text-[0.875rem] text-ink-600">
              It is in your plans, where you can open it again or share it.{" "}
              <Link href={saved} className="inline-flex items-center gap-1 font-medium text-ink-950 underline underline-offset-4">
                Open the plan
                <ArrowRight className="size-3" />
              </Link>
            </p>
          ) : (
            <p className="mt-2.5 text-[0.8125rem] text-ink-500">
              Saving keeps it under Plans, so you can check it against what you actually spend.
            </p>
          )}

          {error ? (
            <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
