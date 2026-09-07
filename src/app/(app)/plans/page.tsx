import { CalendarDays, ChevronRight, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NewPlanForm } from "@/components/app/plan-controls";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { loadMyPlans, type PlanCard } from "@/server/queries/plans";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtDay, fmtWhen } from "@/lib/dates";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Plans",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * PLANS
 * ----------------------------------------------------------------------------
 * Upcoming · Invites · Past. A plan is a saved itinerary or an Anyone Down?
 * group the student joined, shown the same way so it is one list.
 * ============================================================================
 */
export default async function PlansPage(props: PageProps<"/plans">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestDate();
  const where = viewer.currency;
  const timeZone = viewer.city.timezone;

  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = raw === "invites" || raw === "past" ? raw : "upcoming";

  const plans = await loadMyPlans({ userId: viewer.user.id, citySlug: viewer.profile.citySlug, now });
  const list = tab === "invites" ? plans.invited : tab === "past" ? plans.past : plans.upcoming;

  return (
    <div className="page max-w-3xl py-6 sm:py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">{viewer.city.name}</p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">Plans</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/plans/week" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2.5 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20">
            <Sparkles className="size-4" />
            Plan my week
          </Link>
          <NewPlanForm />
        </div>
      </header>

      <nav aria-label="Plan views" className="flex gap-2">
        {(
          [
            { value: "upcoming", label: "Upcoming", count: plans.upcoming.length },
            { value: "invites", label: "Invites", count: plans.invited.length },
            { value: "past", label: "Past", count: plans.past.length },
          ] as const
        ).map((entry) => (
          <Link
            key={entry.value}
            href={entry.value === "upcoming" ? "/plans" : `/plans?tab=${entry.value}`}
            aria-current={tab === entry.value ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.875rem] font-medium transition-colors",
              tab === entry.value ? "bg-ink-950 text-paper" : "bg-white text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20",
            )}
          >
            {entry.label}
            {entry.count > 0 ? <span className="tnum text-[0.75rem] opacity-70">{entry.count}</span> : null}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl bg-white px-5 py-12 text-center ring-1 ring-ink-950/6">
          <MascotArt state={tab === "invites" ? "social" : "neutral"} className="size-16" />
          <h2 className="mt-4 text-[1.0625rem] font-semibold text-ink-950">
            {tab === "upcoming" ? "Want something to do?" : tab === "invites" ? "No invites right now." : "Nothing here yet."}
          </h2>
          <p className="mt-1 max-w-sm text-[0.9375rem] text-ink-600">
            {tab === "upcoming"
              ? "Ask for a night or a weekend and save it, join an Anyone Down? plan, or build one from scratch."
              : tab === "invites"
                ? "When a friend invites you to a plan, or someone posts one for your campus, it lands here."
                : "Plans you have been on show up here after they happen."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/ask?q=Plan%20Saturday" className="rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper">Ask for a plan</Link>
            <Link href="/anyone-down" className="rounded-full bg-white px-4 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/10">Find a plan to join</Link>
          </div>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((card) => (
            <li key={`${card.kind}-${card.id}`}>
              <PlanRow card={card} where={where} timeZone={timeZone} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanRow({
  card,
  where,
  timeZone,
  now,
}: {
  card: PlanCard;
  where: { currency: string; locale: string };
  timeZone: string;
  now: Date;
}) {
  const when = card.when
    ? card.kind === "invite"
      ? fmtWhen(card.when, timeZone, now)
      : fmtDay(card.when, timeZone, now)
    : "No date yet";

  return (
    <Link href={card.href} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl", card.kind === "invite" ? "bg-signal-soft" : "bg-flow-soft")}>
        {card.kind === "invite" ? <Users className="size-5 text-signal-deep" /> : <CalendarDays className="size-5 text-flow-deep" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[1rem] font-semibold text-ink-950">{card.title}</span>
          {card.status === "invited" ? <Badge accent="pulse">Invited</Badge> : null}
          {card.shared ? <Badge accent="mint">Public</Badge> : null}
        </span>
        <span className="mt-0.5 block text-[0.8125rem] text-ink-500">
          {when}
          {" · "}
          <span className="tnum">{card.people}</span> {card.people === 1 ? "person" : "people"}
          {card.kind === "plan" ? ` · ${card.stops} ${card.stops === 1 ? "stop" : "stops"}` : ""}
          {card.perPersonCents !== null
            ? ` · ~${money(card.perPersonCents / 100, where)} each`
            : card.totalCents
              ? ` · ${money(card.totalCents / 100, where)}`
              : ""}
          {card.by && !card.mine ? ` · by ${card.by}` : ""}
          {card.votes > 0 ? ` · ${card.votes} votes` : ""}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink-300" />
    </Link>
  );
}
