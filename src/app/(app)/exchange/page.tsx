import { Plus, Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Empty } from "@/components/app/cards";
import { ExchangeCard } from "@/components/app/exchange-card";
import { MascotArt } from "@/components/mascot/mascot-art";
import {
  type ExchangeKind,
  exchangeKindMeta,
  exchangeKinds,
  type ListingCategory,
  type ListingMode,
  listingCategoryMeta,
  marketplaceSafety,
} from "@/domain/social";
import { laneCounts, loadListings } from "@/server/queries/exchange";
import { minutesSince, requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtWhen } from "@/lib/dates";
import { ago, cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Student Exchange",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * STUDENT EXCHANGE
 * ----------------------------------------------------------------------------
 * A verified student network for the things a city needs moved between
 * people: second-hand stuff, a drill for an afternoon, help carrying a sofa,
 * a taxi split to the airport, a kitchen box someone is giving away.
 *
 * Offers and requests sit side by side, because "I need a desk under €30"
 * is a listing too — and it is the one a departing student can answer.
 * Departing stock is surfaced first for arriving students: that is the loop.
 * ============================================================================
 */
export default async function ExchangePage(props: PageProps<"/exchange">) {
  const viewer = await requireViewer();
  const now = requestDate();
  const params = await props.searchParams;
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const kind = exchangeKinds.includes(pick("kind") as ExchangeKind) ? (pick("kind") as ExchangeKind) : null;
  const mode = pick("mode") === "offer" || pick("mode") === "request" ? (pick("mode") as ListingMode) : null;
  const categoryRaw = pick("category");
  const category = categoryRaw && categoryRaw in listingCategoryMeta ? (categoryRaw as ListingCategory) : null;
  const query = pick("q")?.trim() || null;

  const stage = viewer.stage.stage;
  const arriving = stage === "before-arrival" || stage === "first-24h" || stage === "first-week";
  const leaving = stage === "leaving";

  const [listings, counts] = await Promise.all([
    loadListings({ citySlug: viewer.profile.citySlug, viewerId: viewer.user.id, arriving, filter: { kind, mode, category, query }, now }),
    laneCounts(viewer.profile.citySlug),
  ]);

  const href = (patch: Partial<{ kind: string | null; mode: string | null; category: string | null; q: string | null }>) => {
    const next = new URLSearchParams();
    const merged = { kind, mode, category, q: query, ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const text = next.toString();
    return text ? `/exchange?${text}` : "/exchange";
  };

  const categories = kind ? exchangeKindMeta[kind].categories : [];
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="page py-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <MascotArt state="social" className="hidden size-14 shrink-0 sm:block" />
          <div className="min-w-0">
            <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">Student Exchange · {viewer.city.name}</p>
            <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">
              {arriving ? "Students leaving have what you need." : leaving ? "Pass it on before you go." : "Buy, borrow, help, share a ride."}
            </h1>
            <p className="mt-1.5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-600">
              Verified students in {viewer.city.name}. Offers and requests, five lanes, public meeting points only.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={leaving ? "/exchange/new?mode=offer" : "/exchange/new?mode=request"} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[0.875rem] font-medium text-ink-800 ring-1 ring-ink-950/8 hover:ring-ink-950/20">
            {leaving ? "I have something" : "I need something"}
          </Link>
          <Link href={leaving ? "/exchange/new?mode=request" : "/exchange/new"} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-950 px-4 text-[0.875rem] font-medium text-paper hover:bg-ink-800">
            <Plus className="size-4" />
            Post
          </Link>
        </div>
      </header>

      {/* ---- lanes -------------------------------------------------------- */}
      <nav aria-label="Lanes" className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        <LaneChip href={href({ kind: null, category: null })} active={!kind} label="All" emoji="✨" count={total} />
        {exchangeKinds.map((entry) => (
          <LaneChip
            key={entry}
            href={href({ kind: entry, category: null })}
            active={kind === entry}
            label={exchangeKindMeta[entry].label}
            emoji={exchangeKindMeta[entry].emoji}
            count={counts[entry]}
          />
        ))}
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-paper-2 p-1">
          {(
            [
              [null, "Everything"],
              ["offer", "Offers"],
              ["request", "Requests"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={label}
              href={href({ mode: value })}
              aria-current={mode === value ? "page" : undefined}
              className={cn("inline-flex h-8 items-center rounded-full px-3 text-[0.8125rem] font-medium", mode === value ? "bg-white text-ink-950 shadow-[var(--shadow-flat)]" : "text-ink-500 hover:text-ink-900")}
            >
              {label}
            </Link>
          ))}
        </div>

        <form action="/exchange" className="relative ml-auto w-full sm:w-64">
          {kind ? <input type="hidden" name="kind" value={kind} /> : null}
          {mode ? <input type="hidden" name="mode" value={mode} /> : null}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Desk, drill, airport…"
            aria-label="Search the exchange"
            className="h-10 w-full rounded-full bg-white pr-4 pl-9 text-[0.875rem] text-ink-900 ring-1 ring-ink-950/8 placeholder:text-ink-400 focus:ring-ink-950/25"
          />
        </form>
      </div>

      {categories.length > 0 ? (
        <nav aria-label="Categories" className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
          <Link href={href({ category: null })} className={cn("inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.8125rem] font-medium", !category ? "bg-ink-950 text-paper" : "bg-white text-ink-600 ring-1 ring-ink-950/8")}>
            Any
          </Link>
          {categories.map((entry) => (
            <Link key={entry} href={href({ category: entry })} className={cn("inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[0.8125rem] font-medium", category === entry ? "bg-ink-950 text-paper" : "bg-white text-ink-600 ring-1 ring-ink-950/8")}>
              <span aria-hidden>{listingCategoryMeta[entry].emoji}</span>
              {listingCategoryMeta[entry].label}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* ---- listings ---------------------------------------------------- */}
      <div className="mt-6">
        {listings.length === 0 ? (
          <Empty
            line={
              query
                ? `Nothing matching “${query}” right now. Post a request and the person who has it gets told.`
                : kind
                  ? `Nothing in ${exchangeKindMeta[kind].label.toLowerCase()} in ${viewer.city.name} yet.`
                  : `Nothing listed in ${viewer.city.name} yet.`
            }
            action={mode === "request" || query ? "Post a request" : "Be the first"}
            href={mode === "request" || query ? "/exchange/new?mode=request" : "/exchange/new"}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((view) => (
              <ExchangeCard
                key={view.listing.id}
                view={view}
                where={viewer.currency}
                whenLabel={view.listing.whenAt ? fmtWhen(view.listing.whenAt, viewer.city.timezone, now) : null}
                agoLabel={ago(minutesSince(view.listing.createdAt))}
              />
            ))}
          </ul>
        )}
      </div>

      {/* ---- trust ------------------------------------------------------- */}
      <section className="mt-8 grid gap-4 rounded-2xl bg-paper-2/70 p-5 sm:grid-cols-[auto_1fr]">
        <ShieldCheck className="size-5 text-mint-deep" />
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-ink-950">Meeting a stranger, safely</h2>
          <ul className="mt-2 space-y-1.5">
            {marketplaceSafety.map((line) => (
              <li key={line} className="flex gap-2.5 text-[0.875rem] leading-snug text-ink-600">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-400" />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.8125rem] text-ink-500">
            Every poster shows their verified-student badge, university and how many exchanges they have completed. Home addresses are never shown — there is no field for one.
          </p>
        </div>
      </section>
    </div>
  );
}

function LaneChip({ href, active, label, emoji, count }: { href: string; active: boolean; label: string; emoji: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.875rem] font-medium transition-colors",
        active ? "border-ink-950 bg-ink-950 text-paper" : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
      )}
    >
      <span aria-hidden>{emoji}</span>
      {label}
      <span className={cn("tnum font-mono text-micro", active ? "text-signal" : "text-ink-400")}>{count}</span>
    </Link>
  );
}
