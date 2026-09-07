import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BudgetSetupForm } from "@/components/app/budget-setup-form";
import { Locked } from "@/components/app/locked";
import { isTripCategory } from "@/server/engines/budget";
import { loadMoney } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { currencySymbol } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Budget setup",
  robots: { index: false, follow: false },
};

/**
 * Setup is two independent forms and says so. Trip envelopes are deliberately
 * not listed here — they have dates and a screen of their own, and editing
 * "Barcelona 12–15 Sep" in a list of rent and groceries would be a category
 * pretending to be a category.
 */
export default async function BudgetSetupPage() {
  const viewer = await requireViewer();
  const now = requestDate();
  const money$ = await loadMoney(viewer.user.id, now);
  const symbol = currencySymbol(viewer.currency.currency, viewer.currency.locale);

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/budget"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Budget
      </Link>

      <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Set your budget</h1>
      <p className="mt-2 mb-8 text-[0.9375rem] leading-relaxed text-ink-600">
        One number is enough to start. It is split into categories, and you can change any of them
        afterwards without touching the monthly figure again.
      </p>

      <BudgetSetupForm
        symbol={symbol}
        currentTotalCents={money$.setup?.monthlyTotalCents ?? 0}
        excludeHousing={money$.setup?.excludeHousing ?? false}
        categories={money$.reading.categories
          .filter((entry) => !isTripCategory(entry.category))
          .map((entry) => ({
            key: entry.category,
            label: entry.label,
            plannedCents: entry.plannedCents,
          }))}
        canAddCustom={viewer.entitlements.can.customBudgetCategories}
        where={viewer.currency}
      />

      {viewer.entitlements.can.customBudgetCategories ? null : (
        <div className="mt-6">
          <Locked feature="customBudgetCategories" compact />
        </div>
      )}

      {money$.reading.trips.length > 0 ? (
        <p className="mt-6 text-[0.875rem] text-ink-600">
          Your trip budgets are kept separately and are not affected by anything on this screen.{" "}
          <Link href="/budget/travel" className="font-medium text-ink-950 underline underline-offset-4">
            Manage trips
          </Link>
        </p>
      ) : null}
    </div>
  );
}
