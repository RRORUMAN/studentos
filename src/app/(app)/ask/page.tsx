import type { Metadata } from "next";

import { AskConsole } from "@/components/app/ask-console";
import { MascotArt } from "@/components/mascot/mascot-art";
import { toolMeta, type ToolName } from "@/server/ai/tools";
import { askStudentOS, recentAsks } from "@/server/actions/ask";
import { askSuggestions } from "@/server/engines/suggestions";
import { loadMoney } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { hourIn, weekdayIn } from "@/lib/dates";
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

/** What Ask can actually see, printed once so the claim is checkable. */
const VISIBLE: ToolName[] = [
  "search_places",
  "search_events",
  "search_deals",
  "read_budget",
  "read_lifeops",
  "search_social",
  "search_student_pulse",
  "search_exchange",
];

export default async function AskPage(props: PageProps<"/ask">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();
  const where = viewer.currency;
  const tz = viewer.city.timezone;

  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = raw?.trim() ?? "";

  const [money$, history] = await Promise.all([loadMoney(viewer.user.id, now), recentAsks(6)]);

  const suggestions = askSuggestions({
    stage: viewer.stage.stage,
    safeTodayCents: money$.unset ? null : money$.reading.safeTodayCents,
    currencySymbol: currencySymbol(where.currency, where.locale),
    hasBudget: !money$.unset,
    day: weekdayIn(now, tz),
    hour: hourIn(now, tz),
    social: !viewer.profile.socialGoals.includes("private"),
    cityName: viewer.city.name,
    hasCampus: Boolean(viewer.profile.campusSlug),
  });

  const initialResult = query ? await askStudentOS(query) : null;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="mb-5 flex items-center gap-4">
        <MascotArt state="neutral" idle className="size-14 shrink-0" />
        <div className="min-w-0">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            {viewer.city.name}
            {money$.unset ? "" : ` · ${money(money$.reading.safeTodayCents / 100, where)} safe today`}
          </p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">Ask {brand.name}</h1>
          <p className="mt-1 text-[0.9375rem] text-ink-500">Real places, real prices, your own numbers. Never invented.</p>
        </div>
      </header>

      <AskConsole
        initialQuery={query}
        initialResult={initialResult}
        suggestions={suggestions}
        history={history}
        where={where}
      />

      {/* What it can see. Printed rather than implied, because a student
          handing a product their budget deserves to know what it reads. */}
      <section className="mt-10 rounded-2xl bg-paper-2/70 p-5">
        <h2 className="text-[0.9375rem] font-semibold text-ink-950">What Ask can see</h2>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-600">
          Every answer is built from these, in this order, before any writing happens. It cannot invent a place, a price
          or an event, and it will not answer a visa or residency question — those come from official sources with the
          date each was checked.
        </p>
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {VISIBLE.map((name) => (
            <li key={name} className="flex gap-2 text-[0.8125rem] leading-snug text-ink-600">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-300" />
              <span>
                <span className="font-mono text-ink-800">{toolMeta[name].label}</span> — {toolMeta[name].detail}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.8125rem] text-ink-500">
          Your budget, your timeline and your saved items are read for your answers only. They are never shown to another
          student and never leave your account.
        </p>
      </section>
    </div>
  );
}
