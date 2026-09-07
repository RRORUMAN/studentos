import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AffordForm } from "@/components/app/afford-form";
import { MascotArt } from "@/components/mascot/mascot-art";
import { defaultCategories, isTripCategory } from "@/server/engines/budget";
import { loadMoney, placesFor } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { currencySymbol } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Can I afford this?",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * CAN I AFFORD THIS?
 * ----------------------------------------------------------------------------
 * "€35 dinner tonight" → yes / possibly / not ideal, with what it leaves until
 * Monday, what it leaves in the category, and the cheaper real alternative.
 *
 * The page is a shell: it loads the reading and the city's places once, and
 * `AffordForm` recomputes the answer on every keystroke from the same pure
 * engines the server would have used. Free at every tier — the verdict and the
 * horizon figures are arithmetic and cost nothing to produce.
 *
 * The URL still carries `?amount=` so an answer can be linked to and so the
 * first paint is a complete result, which is what the daily brief and Ask link
 * into.
 * ============================================================================
 */
export default async function AffordPage(props: PageProps<"/budget/afford">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();
  const where = viewer.currency;
  const symbol = currencySymbol(where.currency, where.locale);

  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  /* Kept as the raw string: `AffordForm` parses it with the same
     comma-tolerant parser the rest of the money surface uses, so "12,50" in a
     URL behaves exactly as it does in the field. */
  const amount = one("amount") ?? "";
  const category = one("category") ?? "eating-out";

  const money$ = await loadMoney(viewer.user.id, now);
  const reading = money$.reading;

  const categories =
    reading.categories.length > 0
      ? reading.categories
          .filter((entry) => entry.discretionary && !isTripCategory(entry.category))
          .map((entry) => ({ key: entry.category, label: entry.label }))
      : defaultCategories.filter((entry) => !entry.essential).map((entry) => ({ key: entry.key, label: entry.label }));

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/budget"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Budget
      </Link>

      <header className="flex items-start gap-4">
        <MascotArt state="budget" className="size-14 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Can I afford this?</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            Checked against what is genuinely free until the weekend, after rent and the things that
            renew. The answer moves as you type.
          </p>
        </div>
      </header>

      <div className="mt-6">
        <AffordForm
          symbol={symbol}
          defaultAmount={amount}
          defaultCategory={category}
          categories={categories.length > 0 ? categories : [{ key: "eating-out", label: "Eating out" }]}
          reading={reading}
          places={placesFor(viewer.profile.citySlug)}
          citySlug={viewer.profile.citySlug}
          maxWalkMinutes={Math.round(viewer.profile.maxTravelMinutes * 1.6)}
          nowIso={now.toISOString()}
          where={where}
        />
      </div>
    </div>
  );
}
