import { AlertTriangle, Bookmark, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/primitives";
import { type Pay, payPeriodLabel, workKindMeta } from "@/domain/work";
import { type Match, describeSignal, headlineShortfall } from "@/server/engines/work-match";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * ONE OPPORTUNITY
 * ----------------------------------------------------------------------------
 * The card the whole board is made of.
 *
 * What it prints, in the order a student reads it: the money, the fit, the
 * title, when, where, and the two or three facts that produced the number.
 * Pay is first and largest because pay is why anyone is on this screen, and
 * because a job board that makes you open a listing to find out what it pays
 * is wasting the time of somebody who has none.
 *
 * Three rules the markup enforces:
 *
 *   A missing wage renders as "Pay not stated" in the same slot, in the same
 *   size, in a muted colour. It is not omitted. An absent price reads as
 *   "probably fine" when it is left blank and reads correctly when it is
 *   stated, and the difference is a wasted evening.
 *
 *   The fit number is always accompanied by at least one reason. A bare
 *   percentage is a claim with no evidence attached to it.
 *
 *   A sample row says so, on the card, every time. See `seed-work.ts`.
 * ============================================================================
 */

export type Where = { currency: string; locale: string };

function payLine(pay: Pay | null, where: Where): { text: string; muted: boolean } {
  if (!pay) return { text: "Pay not stated", muted: true };

  const min = money(pay.minCents / 100, where);
  const amount = pay.maxCents === null ? min : `${min}–${money(pay.maxCents / 100, where)}`;
  return { text: `${amount} ${payPeriodLabel[pay.period]}`, muted: false };
}

/** Green above a genuinely good match, quiet below it. Never red. */
function fitTone(fit: number): string {
  if (fit >= 80) return "bg-mint text-ink-950";
  if (fit >= 60) return "bg-signal-soft text-signal-deep";
  return "bg-ink-100 text-ink-600";
}

export function WorkCard({
  match,
  where,
  whenLabel,
  saved,
  statusLabel,
}: {
  match: Match;
  where: Where;
  /** Formatted in the city's timezone by the caller. Null when undated. */
  whenLabel: string | null;
  saved: boolean;
  /** "Applied", "Interview" … when this one is already in the tracker. */
  statusLabel: string | null;
}) {
  const { opportunity, fit, reasons, shortfalls, risks } = match;
  const pay = payLine(opportunity.pay, where);
  const fmt = (cents: number) => money(cents / 100, where);

  /* Three reasons is the most a card can carry before it stops being scannable
     and starts being a paragraph. The rest are on the detail screen. */
  const shown = reasons.slice(0, 3);
  /* At most one catch on the card, and only when it is a real objection.
     `headlineShortfall` returns null when everything we know is merely
     unstated — a line that fires on every row is a line nobody reads. */
  const catchOne = headlineShortfall(shortfalls);

  return (
    <li className="relative flex flex-col rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge accent="signal" tone="soft">
            {workKindMeta[opportunity.kind].label}
          </Badge>
          {opportunity.provider === "sample" ? (
            <Badge accent="amber">Sample posting</Badge>
          ) : null}
          {opportunity.provider === "students" ? <Badge accent="mint">From a student</Badge> : null}
          {statusLabel ? <Badge accent="flow">{statusLabel}</Badge> : null}
        </div>
        {saved ? <Bookmark className="size-4 shrink-0 fill-ink-950 text-ink-950" /> : null}
      </div>

      <p
        className={cn(
          "tnum mt-2.5 font-mono text-[1.125rem] font-semibold",
          pay.muted ? "text-ink-400" : "text-ink-950",
        )}
      >
        {pay.text}
      </p>

      <h3 className="mt-1 text-[1rem] leading-snug font-semibold text-ink-950">
        <Link href={`/work/${opportunity.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
          {opportunity.title}
        </Link>
      </h3>

      {opportunity.employerName ? (
        <p className="mt-0.5 text-[0.8125rem] text-ink-600">{opportunity.employerName}</p>
      ) : null}

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-500">
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">
            {opportunity.remoteType === "remote" ? "Remote" : (opportunity.area ?? "Location not given")}
          </span>
        </span>
        {whenLabel ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 shrink-0" />
            {whenLabel}
          </span>
        ) : null}
        {opportunity.hoursMin ? (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5 shrink-0" />
            {opportunity.hoursMin} h/week
          </span>
        ) : null}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={cn(
            "tnum shrink-0 rounded-full px-2.5 py-1 font-mono text-[0.8125rem] font-semibold",
            fitTone(fit),
          )}
        >
          {fit}% fit
        </span>
        <span className="min-w-0 truncate text-[0.8125rem] text-ink-600">
          {shown.length > 0
            ? shown.map((signal) => describeSignal(signal, fmt)).join(" · ")
            : /* An honest fallback rather than an empty strip: a posting can be
                 terse enough that nothing positive is *stated*, and pretending
                 otherwise is the one thing this card must not do. */
              "Nothing stated that we could match against your profile"}
        </span>
      </div>

      {catchOne ? (
        <p className="mt-1.5 text-[0.8125rem] text-ink-500">
          <span className="font-medium text-ink-700">The catch: </span>
          {describeSignal(catchOne, fmt)}
        </p>
      ) : null}

      {risks.length > 0 ? (
        <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-amber-soft px-2 py-1.5 text-[0.75rem] leading-snug text-ink-800">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          Flagged for review — open it to see why.
        </p>
      ) : null}
    </li>
  );
}
