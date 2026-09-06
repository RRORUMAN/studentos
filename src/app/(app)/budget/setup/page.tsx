import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BudgetSetupForm } from "@/components/app/budget-setup-form";
import { Locked } from "@/components/app/locked";
import { loadMoney } from "@/server/queries/money";
import { requireViewer } from "@/server/viewer";
import { currencySymbol } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Budget setup",
  robots: { index: false, follow: false },
};

export default async function BudgetSetupPage() {
  const viewer = await requireViewer();
  const money$ = await loadMoney(viewer.user.id);
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
        One number is enough to start. We split it into categories and you can move any of them
        afterwards.
      </p>

      <BudgetSetupForm
        symbol={symbol}
        currentTotalCents={money$.setup?.monthlyTotalCents ?? 0}
        excludeHousing={money$.setup?.excludeHousing ?? false}
        categories={money$.reading.categories.map((entry) => ({
          key: entry.category,
          label: entry.label,
          plannedCents: entry.plannedCents,
        }))}
        canAddCustom={viewer.entitlements.can.customBudgetCategories}
      />

      {viewer.entitlements.can.customBudgetCategories ? null : (
        <div className="mt-6">
          <Locked feature="customBudgetCategories" compact />
        </div>
      )}
    </div>
  );
}
