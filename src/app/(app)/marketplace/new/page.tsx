import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ListingForm } from "@/components/app/listing-form";
import { requireViewer } from "@/server/viewer";
import { currencySymbol } from "@/lib/utils";

export const metadata: Metadata = {
  title: "List something",
  robots: { index: false, follow: false },
};

export default async function NewListingPage() {
  const viewer = await requireViewer();
  const symbol = currencySymbol(viewer.currency.currency, viewer.currency.locale);
  const leaving = viewer.stage.stage === "leaving";

  return (
    <div className="page max-w-xl py-6 sm:py-8">
      <Link
        href="/marketplace"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Marketplace
      </Link>

      <h1 className="text-display-xs text-ink-950 sm:text-display-sm">List something</h1>
      <p className="mt-2 mb-7 text-[0.9375rem] leading-relaxed text-ink-600">
        {leaving
          ? "Students arriving next term need exactly this. Listing it beats leaving it on the pavement."
          : "Someone in your city needs it. Meet somewhere public."}
      </p>

      <ListingForm
        symbol={symbol}
        fromLeaving={leaving}
        suggestedArea={viewer.campusName ?? viewer.city.name}
      />
    </div>
  );
}
