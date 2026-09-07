"use client";

import { Check, Loader2, PencilLine, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { ClaimView } from "@/server/queries/truth";
import { verifyClaim } from "@/server/actions/truth";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * LOCAL TRUTH
 * ----------------------------------------------------------------------------
 * What students know about a place, and the one tap that keeps it true.
 *
 * The design rule this component exists to enforce: a statement and its
 * confidence are rendered by the same component, always, and the confidence is
 * never smaller or quieter than the statement. A product that shows "€8 student
 * lunch" in bold and "unconfirmed" in 10px grey has technically disclosed and
 * practically lied.
 *
 * The verify control is three buttons rather than a thumbs up/down, because
 * "it's gone" and "the price moved" are different facts and collapsing them
 * loses the correction — which is the single most useful thing a student can
 * tell us. `assess()` treats them differently too.
 * ============================================================================
 */

export function LocalTruthRow({
  view,
  where,
  /** Hide the verify controls where the row is decorative (cards, lists). */
  actionable = true,
}: {
  view: ClaimView;
  where: { currency: string; locale: string };
  actionable?: boolean;
}) {
  const { claim, assessment, meta } = view;
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"confirmed" | "changed" | "gone" | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = (verdict: "confirmed" | "changed" | "gone", correction?: number | null) => {
    setError(null);
    startTransition(async () => {
      const result = await verifyClaim({ claimId: claim.id, verdict, correction: correction ?? null });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDone(verdict);
      setCorrecting(false);
      toast({
        title: verdict === "confirmed" ? "Thanks — noted" : "Thanks, we'll flag it",
        description:
          verdict === "confirmed"
            ? "Other students will see this was checked today."
            : "It takes a couple of reports before this changes for everyone.",
      });
    });
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm text-ink-900">{claim.statement}</p>
        <Badge accent={meta.accent} tone="soft">
          {meta.label}
        </Badge>
      </div>

      {/* The provenance line. Never optional — a claim without it is a rumour. */}
      <p className="mt-1.5 text-[0.8125rem] text-ink-500">
        {assessment.reason}
        {claim.amountCents !== null ? (
          <> · {money(claim.amountCents / 100, where)}</>
        ) : null}
      </p>

      {assessment.suggestedCents !== null && assessment.suggestedCents !== claim.amountCents ? (
        <p className="mt-1 text-[0.8125rem] text-amber-deep">
          Students report it is now {money(assessment.suggestedCents / 100, where)}.
        </p>
      ) : null}

      {!actionable ? null : done ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-mint-deep">
          <Check className="size-3.5" aria-hidden />
          {done === "confirmed" ? "You confirmed this" : "You reported a change"}
        </p>
      ) : correcting ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(submit) => {
            submit.preventDefault();
            const value = Number(amount);
            send("changed", Number.isFinite(value) && value > 0 ? value : null);
          }}
        >
          <label className="text-[0.8125rem] text-ink-600" htmlFor={`correct-${claim.id}`}>
            What is it now?
          </label>
          <input
            id={`correct-${claim.id}`}
            inputMode="decimal"
            value={amount}
            onChange={(change) => setAmount(change.target.value)}
            className="w-24 rounded-md border border-ink-200 px-2 py-1 text-sm"
            placeholder="9.50"
          />
          <VerifyButton pending={pending} type="submit">
            Save
          </VerifyButton>
          <button
            type="button"
            className="text-[0.8125rem] text-ink-500 underline"
            onClick={() => setCorrecting(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-ink-500">{view.verifyPrompt}</span>
          <VerifyButton pending={pending} onClick={() => send("confirmed")}>
            <Check className="size-3.5" aria-hidden /> Yes
          </VerifyButton>
          <VerifyButton pending={pending} onClick={() => setCorrecting(true)}>
            <PencilLine className="size-3.5" aria-hidden /> Changed
          </VerifyButton>
          <VerifyButton pending={pending} onClick={() => send("gone")}>
            <X className="size-3.5" aria-hidden /> Gone
          </VerifyButton>
        </div>
      )}

      {error ? <p className="mt-2 text-[0.8125rem] text-pulse-deep">{error}</p> : null}
    </div>
  );
}

function VerifyButton({
  pending,
  children,
  ...props
}: React.ComponentProps<"button"> & { pending: boolean }) {
  return (
    <button
      type="button"
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1 text-[0.8125rem] font-medium text-ink-700",
        "transition-colors hover:border-ink-400 hover:text-ink-950 disabled:opacity-50",
      )}
      {...props}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

/**
 * The list wrapper. Renders nothing at all when there is nothing verified to
 * say, rather than an empty "What students say" heading — an empty section
 * label is a promise the product did not keep.
 */
export function LocalTruthList({
  views,
  where,
  title = "What students say",
}: {
  views: readonly ClaimView[];
  where: { currency: string; locale: string };
  title?: string;
}) {
  if (views.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-semibold text-ink-950">{title}</h2>
      {views.map((view) => (
        <LocalTruthRow key={view.claim.id} view={view} where={where} />
      ))}
    </section>
  );
}
