import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

import { MascotArt } from "@/components/mascot/mascot-art";
import { type Feature, featureCopy, requiredTier } from "@/config/entitlements";
import { plans } from "@/config/pricing";
import { money } from "@/lib/utils";

/**
 * ============================================================================
 * LOCKED FEATURE
 * ----------------------------------------------------------------------------
 * How a paid feature appears to someone who does not have it.
 *
 * The rule, and it is the whole design: **never say "upgrade to continue"
 * without saying what the feature would tell them.** A lock that explains
 * nothing is an obstacle; a lock that names the rows it would fill in is a
 * demonstration.
 *
 * ---------------------------------------------------------------------------
 * WHY `preview` IS A LIST OF LABELS AND NOT A ReactNode
 *
 * It used to accept arbitrary JSX so a caller could pass the genuine, computed
 * component and blur it with CSS. That is not a paywall: the real numbers were
 * in the HTML, one view-source away, on every locked panel in the product.
 *
 * The type now makes that mistake impossible. A caller can describe the
 * *shape* — "Projected spend", "Where the month lands" — and nothing else. If a
 * value has not been paid for, there is no prop that can carry it to the
 * browser.
 *
 * Free users are never interrupted by this. It appears where the feature would
 * have been, in place, and nowhere else.
 * ============================================================================
 */

/** A row the feature would fill in. Labels only — never a value. */
export type PreviewRow = { label: string; hint?: string };

export function Locked({
  feature,
  preview,
  compact = false,
}: {
  feature: Feature;
  /**
   * The rows this feature would produce, by name. Deliberately cannot carry a
   * value — see the note above.
   */
  preview?: readonly PreviewRow[];
  compact?: boolean;
}) {
  const copy = featureCopy[feature];
  const tier = requiredTier(feature);
  const plan = plans.find((entry) => entry.key === tier);

  if (compact) {
    return (
      <Link
        href={`/upgrade?feature=${feature}`}
        className="flex items-center gap-3 rounded-lg border border-dashed border-ink-300 bg-paper-2/60 px-4 py-3 transition-colors hover:border-ink-400"
      >
        <Lock className="size-4 shrink-0 text-ink-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.875rem] font-medium text-ink-800">{copy.label}</span>
          <span className="mt-0.5 block text-[0.8125rem] text-ink-500">{copy.promise}</span>
        </span>
        <span className="shrink-0 text-[0.8125rem] font-medium text-ink-600">
          {plan?.name}
        </span>
      </Link>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      {preview && preview.length > 0 ? (
        /* The shape of the answer: real row names, no values. The lock glyph
           stands where the figure would be — there is nothing to un-blur
           because nothing was sent. */
        <ul className="divide-y divide-ink-100 border-b border-ink-200">
          {preview.map((row) => (
            <li key={row.label} className="flex items-center gap-4 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] text-ink-700">{row.label}</span>
                {row.hint ? (
                  <span className="mt-0.5 block text-[0.8125rem] text-ink-400">{row.hint}</span>
                ) : null}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-[0.75rem] font-semibold text-ink-500">
                <Lock className="size-3" aria-hidden />
                Locked
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-start gap-4 border-t border-ink-200 p-5">
        <MascotArt state="thinking" className="size-12 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            <Lock className="size-3" />
            {plan?.name}
            {plan && plan.monthly > 0 ? (
              <span className="tnum">· {money(plan.monthly)}/month</span>
            ) : null}
          </p>

          <h3 className="mt-1.5 text-[1.0625rem] font-semibold text-ink-950">{copy.label}</h3>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-600">{copy.promise}</p>

          <Link
            href={`/upgrade?feature=${feature}`}
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper transition-colors hover:bg-ink-800"
          >
            Unlock with {plan?.name}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Quota                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Shown when a *quota* rather than a feature runs out.
 *
 * Different copy from `Locked` on purpose: the student had the feature and used
 * it, which is a much better moment. It says how many they got, when it comes
 * back, and what more would cost — a limit that resets is far less annoying
 * than one that does not, and saying so is worth more than hiding it.
 */
export function QuotaReached({
  used,
  limit,
  resetsIn,
  feature = "advancedAI",
}: {
  used: number;
  limit: number;
  resetsIn: string;
  feature?: Feature;
}) {
  const tier = requiredTier(feature);
  const plan = plans.find((entry) => entry.key === tier);

  return (
    <section className="rounded-xl border border-amber-deep/20 bg-amber-soft/50 p-5">
      <div className="flex items-start gap-4">
        <MascotArt state="neutral" className="size-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[1.0625rem] font-semibold text-ink-950">
            That is your <span className="tnum">{limit}</span> asks for this week.
          </h3>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
            Resets {resetsIn}. Everything else keeps working — the map, events, budget and the
            community are not metered.
          </p>
          <Link
            href={`/upgrade?feature=${feature}`}
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper transition-colors hover:bg-ink-800"
          >
            Ask without a limit — {plan?.name}
            <ArrowRight className="size-3.5" />
          </Link>
          <p className="tnum mt-2 font-mono text-micro text-ink-500">
            {used} / {limit} used
          </p>
        </div>
      </div>
    </section>
  );
}
