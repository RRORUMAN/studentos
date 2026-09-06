import type { ReactNode } from "react";

import { MascotArt } from "@/components/mascot/mascot-art";
import type { MascotState } from "@/brand/mascot.config";
import { brand } from "@/brand/brand.config";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * SHARE CARD
 * ----------------------------------------------------------------------------
 * The object that leaves the product: a story-sized card with one headline
 * number, a few lines, the mascot and the wordmark. Rendered as DOM at a fixed
 * aspect so a screenshot is the export — no image pipeline, no stale assets,
 * and it restyles with the brand.
 *
 * Money is opt-in per card. A student sharing "3 free things Sunday" is fine
 * with that being public; the same student may not want "€18 total" on a
 * story. Callers decide, the card never adds a figure on its own.
 * ============================================================================
 */

export type ShareCardTone = "signal" | "ink" | "mint" | "pulse";

const TONES: Record<ShareCardTone, { bg: string; fg: string; sub: string; chip: string }> = {
  signal: { bg: "bg-signal", fg: "text-ink-950", sub: "text-ink-950/70", chip: "bg-ink-950 text-signal" },
  ink: { bg: "bg-ink-950", fg: "text-paper", sub: "text-paper/65", chip: "bg-signal text-ink-950" },
  mint: { bg: "bg-mint", fg: "text-ink-950", sub: "text-ink-950/70", chip: "bg-ink-950 text-mint" },
  pulse: { bg: "bg-pulse", fg: "text-white", sub: "text-white/75", chip: "bg-white text-pulse-deep" },
};

export function ShareCard({
  eyebrow,
  headline,
  lines,
  mascot = "happy",
  tone = "signal",
  footer,
  aspect = "story",
  className,
}: {
  /** Small caps line at the top: "TONIGHT UNDER €20", "€0 SUNDAY". */
  eyebrow: string;
  /** The one big thing: "€18 TOTAL", "3 FREE THINGS TO DO". */
  headline: string;
  /** Up to four short lines. */
  lines?: readonly { label: string; value?: string }[];
  mascot?: MascotState;
  tone?: ShareCardTone;
  footer?: ReactNode;
  /** 9:16 for stories, 1:1 for feeds, 1.91:1 for link previews. */
  aspect?: "story" | "square" | "wide";
  className?: string;
}) {
  const t = TONES[tone];

  return (
    <div
      className={cn(
        "relative flex w-full max-w-sm flex-col overflow-hidden rounded-[28px] p-7 shadow-[var(--shadow-lift)]",
        aspect === "story" && "aspect-[9/16]",
        aspect === "square" && "aspect-square",
        aspect === "wide" && "aspect-[1.91/1] max-w-2xl",
        t.bg,
        t.fg,
        className,
      )}
    >
      <p className={cn("font-mono text-micro uppercase tracking-[0.14em]", t.sub)}>{eyebrow}</p>
      <h3 className="mt-3 font-display text-[2.25rem] leading-[0.98] font-semibold tracking-tight text-balance">{headline}</h3>

      {lines && lines.length > 0 ? (
        <ul className={cn("mt-5 space-y-2 border-t pt-4", tone === "ink" ? "border-paper/15" : tone === "pulse" ? "border-white/25" : "border-ink-950/15")}>
          {lines.slice(0, 4).map((line) => (
            <li key={line.label} className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
              <span className="min-w-0 truncate">{line.label}</span>
              {line.value ? <span className="tnum shrink-0 font-mono font-semibold">{line.value}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <div className="min-w-0">
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 font-mono text-micro font-semibold uppercase tracking-[0.1em]", t.chip)}>
            {brand.name}
          </span>
          {footer ? <div className={cn("mt-2 text-[0.8125rem]", t.sub)}>{footer}</div> : null}
        </div>
        <MascotArt state={mascot} className="size-24 shrink-0 drop-shadow-[0_8px_16px_rgba(10,10,16,0.25)]" />
      </div>
    </div>
  );
}
