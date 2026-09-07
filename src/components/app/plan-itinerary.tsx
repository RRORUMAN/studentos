import Link from "next/link";
import type { ReactNode } from "react";

import type { SavedPlanItem } from "@/domain/types";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * PLAN ITINERARY
 * ----------------------------------------------------------------------------
 * The lines of a plan, printed one way everywhere: on the plan screen, on the
 * public link, in a chat attachment. Prices are the stored prices; a line built
 * from a row links back to it. Controls (vote, remove) are slots the caller
 * fills, so the public page and the owner's page cannot drift apart.
 * ============================================================================
 */
export function PlanItinerary({
  items,
  where,
  links = true,
  vote,
  remove,
  empty,
  total = true,
}: {
  items: readonly SavedPlanItem[];
  where: { currency: string; locale: string };
  /** Link lines back to their event or place. Off on the signed-out page. */
  links?: boolean;
  /** Per-line vote control, when voting is on. */
  vote?: (index: number) => ReactNode;
  /** Per-line remove control, for the owner. */
  remove?: (index: number) => ReactNode;
  /** What to show when there are no lines. */
  empty?: ReactNode;
  /** Print the total row at the bottom. */
  total?: boolean;
}) {
  const sum = items.reduce((acc, item) => acc + item.priceCents, 0);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      {items.length === 0 ? (
        empty ?? null
      ) : (
        <ol className="divide-y divide-ink-100">
          {items.map((item, index) => {
            const href =
              links && item.refKind === "place"
                ? `/discover/${item.refId}`
                : links && item.refKind === "event"
                  ? `/events/${item.refId}`
                  : null;
            return (
              <li key={`${item.title}-${index}`} className="flex items-start gap-3 px-5 py-3.5">
                <span className="tnum w-6 shrink-0 pt-0.5 font-mono text-[0.75rem] text-ink-400">{item.time || index + 1}</span>
                <div className="min-w-0 flex-1">
                  {href ? (
                    <Link href={href} className="text-[0.9375rem] font-medium text-ink-900 hover:underline">{item.title}</Link>
                  ) : (
                    <p className="text-[0.9375rem] font-medium text-ink-900">{item.title}</p>
                  )}
                  {item.detail || item.walkMinutes ? (
                    <p className="mt-0.5 text-[0.8125rem] text-ink-500">
                      {item.detail}
                      {item.walkMinutes ? `${item.detail ? " · " : ""}${item.walkMinutes} min walk` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {vote ? vote(index) : null}
                  <span className={cn("tnum font-mono text-[0.9375rem] font-medium", item.priceCents === 0 ? "text-mint-deep" : "text-ink-900")}>
                    {item.priceCents === 0 ? "Free" : money(item.priceCents / 100, where)}
                  </span>
                  {remove ? remove(index) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {total && items.length > 0 ? (
        <div className="flex items-baseline justify-between border-t border-ink-100 bg-paper-2/60 px-5 py-3.5">
          <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-500">Total</span>
          <span className="tnum font-mono text-[1.25rem] font-semibold text-ink-950">{sum === 0 ? "Free" : money(sum / 100, where)}</span>
        </div>
      ) : null}
    </section>
  );
}
