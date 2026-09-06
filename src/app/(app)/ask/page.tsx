import type { Metadata } from "next";

import { AskConsole } from "@/components/app/ask-console";
import { MascotArt } from "@/components/mascot/mascot-art";
import { askStudentOS } from "@/server/actions/ask";
import { askSuggestions } from "@/server/engines/suggestions";
import { loadMoney } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { currencySymbol, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: `Ask ${brand.name}`,
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * ASK
 * ----------------------------------------------------------------------------
 * A question in the URL is answered on the server so the first paint already
 * carries the cards. The suggestions come from the student's own situation —
 * stage, money, day, campus — so every one is a question this product can
 * answer well right now.
 * ============================================================================
 */
export default async function AskPage(props: PageProps<"/ask">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();
  const where = viewer.currency;

  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = raw?.trim() ?? "";

  const money$ = await loadMoney(viewer.user.id, now);
  const suggestions = askSuggestions({
    stage: viewer.stage.stage,
    safeTodayCents: money$.unset ? null : money$.reading.safeTodayCents,
    currencySymbol: currencySymbol(where.currency, where.locale),
    hasBudget: !money$.unset,
    day: now.getDay(),
    hour: now.getHours(),
    social: !viewer.profile.socialGoals.includes("private"),
    cityName: viewer.city.name,
    hasCampus: Boolean(viewer.profile.campusSlug),
  });

  const initialResult = query ? await askStudentOS(query) : null;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="mb-5 flex items-center gap-4">
        <MascotArt state="neutral" idle className="size-14 shrink-0" />
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            {viewer.city.name}
            {money$.unset ? "" : ` · ${money(money$.reading.safeTodayCents / 100, where)} safe today`}
          </p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">Ask {brand.name}</h1>
          <p className="mt-1 text-[0.9375rem] text-ink-500">
            Real places, real prices, what students said. Never invented.
          </p>
        </div>
      </header>

      <AskConsole initialQuery={query} initialResult={initialResult} suggestions={suggestions} where={where} />
    </div>
  );
}
