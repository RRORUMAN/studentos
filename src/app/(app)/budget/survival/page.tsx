import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Locked } from "@/components/app/locked";
import { MascotArt } from "@/components/mascot/mascot-art";
import { SurvivalForm, type ViewPlan } from "@/components/app/survival-form";
import { parseAmountCents } from "@/server/engines/budget";
import { buildSurvivalPlan, previewSurvivalPlan } from "@/server/engines/survival";
import { loadMoney } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { currencySymbol } from "@/lib/utils";

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
 * That withholding happens **on the server**, in `previewSurvivalPlan` — the
 * engine's own preview, rather than a redaction function this page invented.
 * An earlier version rendered the true amounts and blurred them with CSS,
 * which is not a paywall at all: the numbers were in the HTML and one
 * view-source away. If a value has not been paid for, it must not reach the
 * browser — and that holds for the live recompute too, which is why a locked
 * student's updates come back from a server action rather than being computed
 * in their own browser.
 *
 * The trade is deliberate: this is the screen a student reaches on their worst
 * money day of the month, and turning them away with nothing would be both
 * unkind and bad business. Showing them the shape of the answer — and that most
 * of it is free things — is the honest version of a paywall.
 * ============================================================================
 */
export default async function SurvivalPage(props: PageProps<"/budget/survival">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();

  const where = viewer.currency;
  const symbol = currencySymbol(where.currency, where.locale);

  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const rawAmount = one("amount") ?? "";
  const daysRaw = one("days");
  const days = Number.isFinite(Number(daysRaw)) && Number(daysRaw) > 0 ? Math.min(60, Number(daysRaw)) : 4;

  const money$ = await loadMoney(viewer.user.id, now);
  const unlocked = viewer.entitlements.can.survivalMode;

  /* Comma-safe, and the same parser the field and the action use. */
  const amountCents =
    parseAmountCents(rawAmount) ??
    (money$.reading.availableCents > 0 ? Math.round(money$.reading.availableCents / 100) * 100 : null);

  const defaultAmount = amountCents === null ? "" : String(Math.round(amountCents / 100));

  /* The first paint is a complete plan, so the screen is useful before any
     JavaScript runs and a linked-to plan renders as one. */
  let initial: ViewPlan | null = null;
  if (amountCents !== null) {
    if (unlocked) {
      const plan = buildSurvivalPlan({ amountCents, days, city: viewer.city });
      initial = {
        lines: plan.lines.map((line) => ({
          key: line.key,
          label: line.label,
          basis: line.basis,
          amountCents: line.amountCents,
          free: line.free,
        })),
        verdict: plan.verdict,
        moves: [...plan.moves],
      };
    } else {
      const preview = previewSurvivalPlan({ amountCents, days, city: viewer.city });
      initial = {
        lines: preview.lines.map((line, index) => ({
          key: `${line.label}-${index}`,
          label: line.label,
          basis: line.basis,
          amountCents: line.free ? 0 : null,
          free: line.free,
        })),
        verdict: preview.verdict,
        moves: [],
      };
    }
  }

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
            Tell it what you actually have and how long it has to last. It works out the food first,
            keeps a buffer, and fills the rest with things that cost nothing.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <SurvivalForm
          symbol={symbol}
          defaultAmount={defaultAmount}
          defaultDays={String(days)}
          unlocked={unlocked}
          city={unlocked ? viewer.city : null}
          initial={initial}
          where={where}
        />
      </div>

      {!unlocked ? (
        <div className="mt-5">
          <Locked feature="survivalMode" />
        </div>
      ) : null}
    </div>
  );
}
