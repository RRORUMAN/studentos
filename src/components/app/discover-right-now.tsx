import { Info, Zap } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/primitives";
import { type RightNowItem, rightNowKindLabel } from "@/server/engines/right-now";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * RIGHT NOW — the Discover tab
 * ----------------------------------------------------------------------------
 * What `rightNow()` returned, printed honestly: events under way or starting
 * soon, groups forming and what students just posted. Places do not appear —
 * the rows hold no opening hours, so "open now" is not a claim this product
 * can make, and the tab says so instead of guessing.
 * ============================================================================
 */
export function DiscoverRightNow({
  items,
  where,
}: {
  items: readonly RightNowItem[];
  where: { currency: string; locale: string };
}) {
  return (
    <div>
      <p className="mb-3 flex items-start gap-2 rounded-xl bg-paper-2 px-3.5 py-2.5 text-[0.8125rem] leading-snug text-ink-600">
        <Info className="mt-px size-4 shrink-0 text-ink-400" aria-hidden />
        <span>
          Events under way or starting in the next three hours, groups forming, and what students just
          posted. Places are not listed here: we do not hold opening hours, so nothing claims to be open now.
        </span>
      </p>

      {items.length === 0 ? null : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3.5 rounded-2xl p-4 ring-1 transition-shadow hover:shadow-[var(--shadow-raise)]",
                  item.kind === "happening" && "bg-pulse-soft/70 ring-pulse-deep/15",
                  item.kind === "free-now" && "bg-mint-soft/70 ring-mint-deep/15",
                  item.kind === "soon" && "bg-white ring-ink-950/6",
                  item.kind === "filling" && "bg-signal-soft/70 ring-signal-deep/15",
                  item.kind === "posted" && "bg-white ring-ink-950/6",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-mono text-micro uppercase tracking-[0.1em] text-ink-500">
                    <Zap className="size-3" aria-hidden />
                    {rightNowKindLabel[item.kind]}
                  </span>
                  <span className="mt-1 block text-[1rem] leading-snug font-semibold text-ink-950">{item.title}</span>
                  <span className="mt-0.5 block text-[0.8125rem] text-ink-600">{item.meta}</span>
                </span>
                {item.priceCents === 0 ? (
                  <Badge accent="mint" tone="solid">Free</Badge>
                ) : item.priceCents !== null ? (
                  <span className="tnum shrink-0 font-mono text-[0.9375rem] font-semibold text-ink-900">
                    {money(item.priceCents / 100, where)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
