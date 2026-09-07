import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ExchangeForm } from "@/components/app/exchange-form";
import { type ExchangeKind, exchangeKinds } from "@/domain/social";
import { requireViewer } from "@/server/viewer";
import { currencySymbol } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Post to the exchange",
  robots: { index: false, follow: false },
};

export default async function NewListingPage(props: PageProps<"/exchange/new">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const symbol = currencySymbol(viewer.currency.currency, viewer.currency.locale);
  const leaving = viewer.stage.stage === "leaving";
  const kind = exchangeKinds.includes(pick("kind") as ExchangeKind) ? (pick("kind") as ExchangeKind) : "sell";
  const mode = pick("mode") === "request" ? "request" : "offer";

  return (
    <div className="page max-w-xl py-6 sm:py-8">
      <Link href="/exchange" className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        Exchange
      </Link>

      <h1 className="text-display-xs text-ink-950 sm:text-display-sm">{mode === "request" ? "What do you need?" : "What have you got?"}</h1>
      <p className="mt-2 mb-7 text-[0.9375rem] leading-relaxed text-ink-600">
        {leaving
          ? "Students arriving next term need exactly this. Listing it beats leaving it on the pavement."
          : mode === "request"
            ? "Someone in your city probably has it. Say what, and roughly what you would pay or when you need it."
            : "Someone in your city needs it. Meet somewhere public."}
      </p>

      <ExchangeForm
        symbol={symbol}
        fromLeaving={leaving}
        suggestedArea={viewer.campusName ?? viewer.city.name}
        initialKind={kind}
        initialMode={mode}
      />
    </div>
  );
}
