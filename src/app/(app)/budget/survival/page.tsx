import { ArrowLeft, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Locked } from "@/components/app/locked";
import { MascotArt } from "@/components/mascot/mascot-art";
import { SurvivalForm } from "@/components/app/survival-form";
import { buildSurvivalPlan } from "@/server/engines/survival";
import { loadMoney } from "@/server/queries/money";
import { requireViewer } from "@/server/viewer";
import { cn, currencySymbol, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Survival Mode",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * SURVIVAL MODE
 * ----------------------------------------------------------------------------
 * "I have €42 and it has to last until Friday."
 *
 * ---------------------------------------------------------------------------
 * HOW THE PAYWALL WORKS, AND WHY IT IS BUILT THIS WAY
 *
 * A free student sees the *real* plan structure: every category, every piece of
 * reasoning, the honest verdict, and every free line at its true €0. What is
 * withheld is the money allocated to the paid lines.
 *
 * That withholding happens **on the server, in `redact()` below**. An earlier
 * version rendered the true amounts and blurred them with CSS, which is not a
 * paywall at all — the numbers were in the HTML and one view-source away. If a
 * value has not been paid for, it must not reach the browser.
 *
 * The trade is deliberate: this is the screen a student reaches on their worst
 * money day of the month, and turning them away with nothing would be both
 * unkind and bad business. Showing them the shape of the answer — and that most
 * of it is free things — is the honest version of a paywall.
 * ============================================================================
 */

/** A line as the client receives it. `amountCents: null` means withheld. */
type ViewLine = {
  key: string;
  label: string;
  basis: string;
  amountCents: number | null;
  free: boolean;
};

export default async function SurvivalPage(props: PageProps<"/budget/survival">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;

  const where = viewer.currency;
  const symbol = currencySymbol(where.currency, where.locale);

  const raw = Array.isArray(params.amount) ? params.amount[0] : params.amount;
  const daysRaw = Array.isArray(params.days) ? params.days[0] : params.days;

  const amount = raw ? Number(raw) : null;
  const days = daysRaw ? Number(daysRaw) : 4;

  const money$ = await loadMoney(viewer.user.id);
  const unlocked = viewer.entitlements.can.survivalMode;

  const plan =
    amount !== null && Number.isFinite(amount) && amount > 0
      ? buildSurvivalPlan({
          amountCents: Math.round(amount * 100),
          days: Number.isFinite(days) ? days : 4,
          city: viewer.city,
        })
      : null;

  /**
   * Strip the paid numbers before they leave the server.
   *
   * Free lines keep their €0 — "this part costs nothing" is the most useful
   * thing on the screen and withholding it would be mean as well as pointless.
   */
  type PlanLine = ReturnType<typeof buildSurvivalPlan>["lines"][number];

  const redact = (line: PlanLine): ViewLine => ({
    key: line.key,
    label: line.label,
    basis: line.basis,
    amountCents: unlocked || line.free ? line.amountCents : null,
    free: line.free,
  });

  const lines: ViewLine[] = plan ? plan.lines.map(redact) : [];

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/budget"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Budget
      </Link>

      <div className="flex items-start gap-4">
        <MascotArt state="survival" className="size-16 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Survival Mode</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">
            Tell it what you actually have and how long it has to last. It works out the food
            first, keeps a buffer, and fills the rest with things that cost nothing.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <SurvivalForm
          symbol={symbol}
          defaultAmount={
            amount !== null
              ? String(amount)
              : money$.reading.availableCents > 0
                ? String(Math.round(money$.reading.availableCents / 100))
                : ""
          }
          defaultDays={String(days)}
        />
      </div>

      {plan ? (
        <div className="mt-8">
          <PlanView
            lines={lines}
            verdict={plan.verdict}
            moves={unlocked ? plan.moves : plan.moves.slice(0, 1)}
            where={where}
          />

          {!unlocked ? (
            <div className="mt-5">
              <Locked feature="survivalMode" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Plan                                                                        */
/* -------------------------------------------------------------------------- */

function PlanView({
  lines,
  verdict,
  moves,
  where,
}: {
  lines: readonly ViewLine[];
  verdict: string;
  moves: readonly string[];
  where: { currency: string; locale: string };
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <div className="border-b border-ink-200 bg-paper-2/60 p-5">
        <p className="text-[0.9375rem] leading-relaxed text-ink-800">{verdict}</p>
      </div>

      <ul className="divide-y divide-ink-100">
        {lines.map((line) => (
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

      <div className="border-t border-ink-200 px-5 py-4">
        <h2 className="mb-2 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
          What actually makes this work
        </h2>
        <ul className="space-y-1.5">
          {moves.map((move) => (
            <li key={move} className="flex gap-2.5 text-[0.875rem] leading-snug text-ink-700">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal" />
              {move}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
