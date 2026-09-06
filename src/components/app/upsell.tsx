import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { MascotArt } from "@/components/mascot/mascot-art";
import { type Feature, featureCopy, requiredTier } from "@/config/entitlements";
import { planByKey } from "@/config/pricing";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * UPSELL
 * ----------------------------------------------------------------------------
 * The value-first paywall. One per screen at most, in context, never a
 * padlock. It answers "what does this give me?" with the feature's promise and
 * an optional line about *this* situation, then names the tier and its price.
 *
 * `preview` lets a screen show the shape of the paid answer — row labels, a
 * first line, a partial projection — so the student sees the value before the
 * price. Labels only; a value that has not been paid for never reaches the
 * browser.
 * ============================================================================
 */

export function Upsell({
  feature,
  line,
  preview,
  tone = "paper",
  className,
}: {
  feature: Feature;
  /** A sentence about the student's own situation, when there is one. */
  line?: string | null;
  /** Row labels the feature would fill in. */
  preview?: readonly { label: string; hint?: string }[];
  tone?: "paper" | "dark";
  className?: string;
}) {
  const copy = featureCopy[feature];
  const plan = planByKey(requiredTier(feature));
  const dark = tone === "dark";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl",
        dark ? "bg-ink-950 text-paper" : "bg-white text-ink-950 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6",
        className,
      )}
    >
      {preview && preview.length > 0 ? (
        <ul className={cn("divide-y border-b", dark ? "divide-paper/10 border-paper/10" : "divide-ink-100 border-ink-100")}>
          {preview.map((row) => (
            <li key={row.label} className="flex items-center gap-4 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[0.9375rem]", dark ? "text-paper/85" : "text-ink-700")}>{row.label}</span>
                {row.hint ? <span className={cn("mt-0.5 block text-[0.8125rem]", dark ? "text-paper/50" : "text-ink-400")}>{row.hint}</span> : null}
              </span>
              <span className={cn("h-3 w-16 shrink-0 rounded-full", dark ? "bg-paper/15" : "bg-ink-100")} aria-hidden />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-start gap-4 p-5">
        <MascotArt state="thinking" className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className={cn("flex items-center gap-1.5 font-mono text-micro uppercase tracking-[0.1em]", dark ? "text-signal" : "text-ink-400")}>
            <Sparkles className="size-3" />
            {plan.name}
            {plan.monthly > 0 ? <span className="tnum">· {money(plan.monthly)}/month</span> : null}
          </p>
          <h3 className="mt-1.5 text-[1.0625rem] font-semibold">{copy.label}</h3>
          <p className={cn("mt-1 text-[0.875rem] leading-relaxed", dark ? "text-paper/75" : "text-ink-600")}>
            {line ?? copy.promise}
          </p>
          <Link
            href={`/upgrade?feature=${feature}`}
            className={cn(
              "mt-3.5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.875rem] font-semibold transition-colors",
              dark ? "bg-signal text-ink-950 hover:brightness-[1.04]" : "bg-ink-950 text-paper hover:bg-ink-800",
            )}
          >
            Unlock with {plan.name}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * The quiet version: one line and a link, for a corner of a screen where a
 * full card would shout. Used where a feature would *add* to something that
 * already works, never where it replaces it.
 */
export function UpsellLine({ feature, line, className }: { feature: Feature; line: string; className?: string }) {
  const plan = planByKey(requiredTier(feature));
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-500", className)}>
      <Sparkles className="size-3.5 text-ink-400" />
      <span>{line}</span>
      <Link href={`/upgrade?feature=${feature}`} className="font-medium text-ink-800 underline underline-offset-4 hover:text-ink-950">
        {plan.name}
      </Link>
    </p>
  );
}

/** "2 smart asks left this week." Shown before the limit, never after. */
export function AskMeter({
  used,
  limit,
  remaining,
  className,
}: {
  used: number;
  limit: number | null;
  remaining: number | null;
  className?: string;
}) {
  if (limit === null || remaining === null) return null;
  const exhausted = remaining === 0;
  const nearing = remaining <= Math.max(1, Math.ceil(limit / 4));
  if (!nearing) {
    return (
      <p className={cn("tnum font-mono text-micro text-ink-400", className)}>
        {used}/{limit} smart asks this week
      </p>
    );
  }
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.8125rem] font-medium",
        exhausted ? "bg-amber-soft text-amber-deep" : "bg-paper-2 text-ink-700",
        className,
      )}
    >
      {exhausted
        ? "You have used this week's free smart asks. Answers still work — the written summary comes back next week."
        : `${remaining} smart ${remaining === 1 ? "ask" : "asks"} left this week`}
    </p>
  );
}
