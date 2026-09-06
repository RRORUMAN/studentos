import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AffordForm } from "@/components/app/afford-form";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { placesForCity } from "@/data/places";
import { affordVerdictMeta, canAfford } from "@/server/engines/afford";
import { categoryLabel, defaultCategories } from "@/server/engines/budget";
import { loadMoney } from "@/server/queries/money";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { cn, currencySymbol, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Can I afford this?",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * CAN I AFFORD THIS?
 * ----------------------------------------------------------------------------
 * "€35 dinner tonight" → yes / possibly / not ideal, with what it leaves until
 * Monday, what it leaves in the category, and a cheaper real alternative.
 *
 * Free at every tier: the verdict and the horizon figures are arithmetic and
 * cost nothing. Plus adds the cheaper alternative with the saving attached;
 * Pro adds whether the spend keeps the whole month on track.
 * ============================================================================
 */
export default async function AffordPage(props: PageProps<"/budget/afford">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();
  const where = viewer.currency;
  const symbol = currencySymbol(where.currency, where.locale);
  const can = viewer.entitlements.can;

  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const raw = one("amount");
  const amount = raw ? Number(raw.replace(",", ".")) : null;
  const category = one("category") ?? "eating-out";

  const money$ = await loadMoney(viewer.user.id, now);
  const reading = money$.reading;

  const categories =
    reading.categories.length > 0
      ? reading.categories.filter((entry) => entry.discretionary).map((entry) => ({ key: entry.category, label: entry.label }))
      : defaultCategories.filter((entry) => !entry.essential).map((entry) => ({ key: entry.key, label: entry.label }));

  const result =
    amount !== null && Number.isFinite(amount) && amount > 0
      ? canAfford({ amountCents: Math.round(amount * 100), reading, now, formatMoney: (cents) => money(cents / 100, where) })
      : null;

  const envelope = reading.categories.find((entry) => entry.category === category) ?? null;
  const categoryLeft = envelope ? envelope.remainingCents - (result?.amountCents ?? 0) : null;

  /* A cheaper alternative in the same category, from real rows. */
  const layer = ({ "eating-out": "cheap-food", nightlife: "nightlife", entertainment: "free", fitness: "fitness", groceries: "groceries" } as Record<string, string>)[category];
  const alternative =
    result && layer
      ? placesForCity(viewer.profile.citySlug)
          .filter((place) => place.layers.includes(layer as never) && place.price !== null)
          .filter((place) => Math.round((place.price ?? 0) * 100) <= result.amountCents * 0.7)
          .filter((place) => place.walkMinutes <= viewer.profile.maxTravelMinutes * 1.6)
          .sort((a, b) => b.studentValue - a.studentValue)[0] ?? null
      : null;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href="/budget" className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        Budget
      </Link>

      <header className="flex items-start gap-4">
        <MascotArt state={result ? (result.verdict === "yes" ? "neutral" : result.verdict === "possibly" ? "thinking" : "warning") : "neutral"} className="size-14 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Can I afford this?</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            Checked against what is genuinely free until {result?.horizonLabel ?? "Monday"}, after rent and the things that renew.
          </p>
        </div>
      </header>

      <div className="mt-6">
        <AffordForm
          symbol={symbol}
          defaultAmount={amount ? String(amount) : ""}
          defaultCategory={category}
          categories={categories.length > 0 ? categories : [{ key: "eating-out", label: "Eating out" }]}
        />
      </div>

      {result ? (
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
          <div className={cn("p-5", result.verdict === "yes" && "bg-mint-soft/60", result.verdict === "possibly" && "bg-amber-soft/60", result.verdict === "not-ideal" && "bg-pulse-soft/60", result.verdict === "no-budget" && "bg-flow-soft/60")}>
            <Badge accent={affordVerdictMeta[result.verdict].accent} tone="solid">{affordVerdictMeta[result.verdict].label}</Badge>
            <p className="mt-3 text-[1.25rem] leading-snug font-semibold text-ink-950">{result.headline}</p>
          </div>

          {result.verdict !== "no-budget" ? (
            <dl className="grid grid-cols-2 divide-x divide-ink-100 border-t border-ink-100 sm:grid-cols-3">
              <Figure label={`Safe until ${result.horizonLabel}`} value={money(result.horizonCents / 100, where)} />
              <Figure label="Left after this" value={money(Math.max(0, result.leftoverCents) / 100, where)} tone={result.leftoverCents < 0 ? "bad" : result.verdict === "yes" ? "good" : "watch"} />
              {envelope && categoryLeft !== null ? (
                <Figure label={`Left in ${categoryLabel(category).toLowerCase()}`} value={money(Math.max(0, categoryLeft) / 100, where)} tone={categoryLeft < 0 ? "bad" : undefined} className="col-span-2 border-t border-ink-100 sm:col-span-1 sm:border-t-0" />
              ) : (
                <Figure label="Per day after" value={money(result.leftoverPerDayCents / 100, where)} className="col-span-2 border-t border-ink-100 sm:col-span-1 sm:border-t-0" />
              )}
            </dl>
          ) : (
            <div className="border-t border-ink-100 p-5">
              <Link href="/budget/setup" className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-semibold text-paper">
                Set a budget
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}

          {result.suggestedCents ? (
            <p className="border-t border-ink-100 px-5 py-3.5 text-[0.875rem] text-ink-700">
              A comfortable figure would be about <span className="tnum font-semibold">{money(result.suggestedCents / 100, where)}</span>.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ---- cheaper alternative ------------------------------------------- */}
      {result && alternative ? (
        can.cheaperAlternatives ? (
          <Link
            href={`/discover/${alternative.id}`}
            className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]"
          >
            <MascotArt state="excited" className="size-11 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="font-mono text-micro uppercase tracking-[0.1em] text-mint-deep">Cheaper alternative</span>
              <span className="mt-0.5 block text-[1rem] font-semibold text-ink-950">{alternative.name}</span>
              <span className="mt-0.5 block text-[0.8125rem] text-ink-600">
                {money(alternative.price ?? 0, where)} · {alternative.walkMinutes} min walk · saves{" "}
                {money((result.amountCents - Math.round((alternative.price ?? 0) * 100)) / 100, where)}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-ink-400" />
          </Link>
        ) : (
          <div className="mt-4">
            <Upsell
              feature="cheaperAlternatives"
              line={`There is a ${categoryLabel(category).toLowerCase()} option nearby at roughly ${money(Math.round((alternative.price ?? 0)), where)} that students rate well. Plus shows it, with the saving attached, every time you check.`}
            />
          </div>
        )
      ) : null}

      {result && result.verdict !== "no-budget" && !can.budgetForecast ? (
        <div className="mt-4">
          <Upsell
            feature="budgetForecast"
            line="See whether this spend still keeps you on budget to the end of the month, not just to Monday."
            preview={[{ label: "Where the month lands after this", hint: "At your current pace" }, { label: "Days of buffer left" }]}
          />
        </div>
      ) : null}
    </div>
  );
}

function Figure({ label, value, tone, className }: { label: string; value: string; tone?: "good" | "watch" | "bad"; className?: string }) {
  return (
    <div className={cn("px-5 py-4", className)}>
      <dt className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">{label}</dt>
      <dd className={cn("tnum mt-1 font-mono text-[1.375rem] leading-none font-semibold", tone === "good" ? "text-mint-deep" : tone === "bad" ? "text-pulse-deep" : tone === "watch" ? "text-amber-deep" : "text-ink-950")}>
        {value}
      </dd>
    </div>
  );
}
