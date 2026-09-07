"use client";

import { ArrowRight, Footprints, MapPinOff, ShieldCheck, Tag, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { accents, type Accent } from "@/components/ui/accent";
import { Badge, Meter } from "@/components/ui/primitives";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * DISCOVER MAP — the product map
 * ----------------------------------------------------------------------------
 * A stylised vector city rather than a tile map: it costs nothing to serve,
 * works with no network, and keeps attention on price and walking time rather
 * than street names nobody has learned yet.
 *
 * It draws exactly what the page has already filtered — the same rows, the
 * same order — and nothing else. It holds no filter state of its own, so the
 * map and the list can never disagree.
 *
 * Places only. Place rows carry a position on this canvas (0-100 on each
 * axis); event rows carry real coordinates that cannot be projected onto a
 * stylised drawing without inventing a position, so events are listed and
 * never pinned. The canvas says so rather than pretending.
 *
 * No "you are here". The student's home point is a real coordinate and this
 * canvas is not geographic; placing a marker would be a fabrication.
 * ============================================================================
 */

export type MapPlace = {
  id: string;
  name: string;
  category: string;
  /** Position on the canvas, 0-100. */
  x: number;
  y: number;
  priceCents: number | null;
  priceLabel: string;
  walkMinutes: number;
  /** 0-100, as rated by students. */
  studentValue: number;
  verifiedBy: number;
  /** 0-100 from the scorer. */
  match: number;
  accent: Accent;
  community: "friends" | "campus" | null;
  /** A live deal attached to the place, when there is one. */
  deal: string | null;
  reasons: readonly string[];
};

export function DiscoverMap({
  places,
  selectedId,
  onSelect,
  seed,
  where,
  eventCount = 0,
  className,
}: {
  places: readonly MapPlace[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The city's map seed; the same city always draws the same way. */
  seed: number;
  where: { currency: string; locale: string };
  /** Events in the current view, listed below but not pinned. */
  eventCount?: number;
  className?: string;
}) {
  const selected = places.find((place) => place.id === selectedId) ?? null;

  return (
    <div
      data-surface="dark"
      className={cn(
        "relative overflow-hidden rounded-2xl bg-linear-to-b from-console-2 to-console text-white shadow-[var(--shadow-console)] ring-1 ring-white/8",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-2.5">
        <p className="tnum truncate text-[0.8125rem] text-white/70">
          {places.length === 0
            ? "No places in this view"
            : `${places.length} ${places.length === 1 ? "place" : "places"} on the map`}
          {eventCount > 0 ? (
            <span className="text-white/40">
              {" · "}
              {eventCount} {eventCount === 1 ? "event" : "events"} listed, not pinned
            </span>
          ) : null}
        </p>
        {selected ? (
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-label="Clear selection"
            className="grid size-7 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* ---- canvas ------------------------------------------------------- */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-900 lg:aspect-[16/11]">
        <MapCanvas seed={seed} />

        {places.map((place) => (
          <Pin
            key={place.id}
            place={place}
            selected={place.id === selectedId}
            onSelect={() => onSelect(place.id === selectedId ? null : place.id)}
          />
        ))}

        {places.length === 0 ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/60 px-6 text-center backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <MapPinOff className="size-6 text-white/30" aria-hidden />
              <p className="text-sm font-medium text-white">Nothing to pin here</p>
              <p className="max-w-xs text-[0.8125rem] text-white/50">
                {eventCount > 0
                  ? "Events sit on real coordinates, which do not fit this stylised canvas. They are in the list."
                  : "Places appear here as pins. Try another category or clear the search."}
              </p>
            </div>
          </div>
        ) : null}

        {/* ---- selection ------------------------------------------------- */}
        {selected ? (
          <div className="absolute inset-x-3 bottom-3 z-30 rounded-xl bg-paper p-3.5 text-ink-900 shadow-[var(--shadow-lift)] ring-1 ring-ink-950/10" data-surface="light">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{selected.category}</p>
                <p className="mt-0.5 truncate text-[1rem] font-semibold text-ink-950">{selected.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {selected.priceCents === 0 ? (
                  <Badge accent="mint" tone="solid">Free</Badge>
                ) : selected.priceCents === null ? (
                  <span className="text-[0.8125rem] text-ink-500">{selected.priceLabel}</span>
                ) : (
                  <span className="tnum font-mono text-[1rem] font-semibold text-ink-950">
                    {money(selected.priceCents / 100, where)}
                  </span>
                )}
                {selected.match >= 60 ? (
                  <span className="tnum rounded-full bg-signal-soft px-2 py-0.5 font-mono text-micro font-semibold text-signal-deep">
                    {selected.match}%
                  </span>
                ) : null}
              </div>
            </div>

            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-600">
              <span className="inline-flex items-center gap-1">
                <Footprints className="size-3.5 text-ink-400" aria-hidden />
                <span className="tnum">{selected.walkMinutes} min walk</span>
              </span>
              {selected.verifiedBy >= 10 ? (
                <span className="inline-flex items-center gap-1 text-mint-deep">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  <span className="tnum">{selected.verifiedBy}</span> confirmed
                </span>
              ) : null}
              {selected.community === "friends" ? (
                <span className="inline-flex items-center gap-1 text-pulse-deep">
                  <Users className="size-3.5" aria-hidden />
                  Friends saved this
                </span>
              ) : selected.community === "campus" ? (
                <span className="inline-flex items-center gap-1 text-flow-deep">
                  <Users className="size-3.5" aria-hidden />
                  Your campus saved this
                </span>
              ) : null}
              {selected.deal ? (
                <span className="inline-flex items-center gap-1 text-amber-deep">
                  <Tag className="size-3.5" aria-hidden />
                  Deal · {selected.deal}
                </span>
              ) : null}
            </p>

            <div className="mt-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-[0.75rem]">
                  <span className="text-ink-500">Student value</span>
                  <span className="tnum font-mono text-ink-400">{selected.studentValue}/100</span>
                </div>
                <Meter value={selected.studentValue} accent={selected.studentValue >= 85 ? "mint" : selected.studentValue >= 70 ? "signal" : "amber"} label={`Student value ${selected.studentValue} of 100`} className="mt-1" />
              </div>
              <Link
                href={`/discover/${selected.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-950 px-3 py-1.5 text-[0.8125rem] font-medium text-paper"
              >
                Open
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            {selected.reasons.length > 0 ? (
              <p className="mt-2 truncate text-[0.75rem] text-ink-500">
                <span className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">Why </span>
                {selected.reasons.slice(0, 3).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="border-t border-white/8 px-4 py-2 text-[0.75rem] text-white/40">
        Our own rows on a stylised canvas — no third-party tiles, so nothing about where you look is sent anywhere.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pin                                                                         */
/* -------------------------------------------------------------------------- */

function Pin({
  place,
  selected,
  onSelect,
}: {
  place: MapPlace;
  selected: boolean;
  onSelect: () => void;
}) {
  const accent = accents[place.accent];
  const label =
    place.priceCents === 0
      ? "Free"
      : place.priceCents === null
        ? place.priceLabel.replace(/^≈/, "")
        : place.priceLabel.replace(/^≈/, "");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${place.name}, ${place.priceLabel}, ${place.walkMinutes} minute walk`}
      className={cn(
        "absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border px-1.5 py-1 text-[0.6875rem] font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 hover:scale-105 active:scale-95",
        selected
          ? cn(accent.fill, accent.onFill, "z-30 border-transparent shadow-[var(--shadow-float)]")
          : "border-white/12 bg-ink-950/85 text-white/85 hover:border-white/35",
      )}
      style={{ left: `${place.x}%`, top: `${place.y}%` }}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", selected ? "bg-current opacity-60" : accent.fill)}
      />
      <span className={cn("tnum whitespace-nowrap", selected ? "inline" : "hidden sm:inline")}>{label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Canvas — deterministic abstract city                                        */
/* -------------------------------------------------------------------------- */

/** Tiny seeded PRNG so a city always draws the same way. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function MapCanvas({ seed }: { seed: number }) {
  const blocks = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: 26 }, () => ({
      x: random() * 100,
      y: random() * 100,
      w: 6 + random() * 16,
      h: 5 + random() * 13,
      r: random() * 2.5,
      o: 0.03 + random() * 0.06,
    }));
  }, [seed]);

  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {blocks.map((block, index) => (
        <rect key={index} x={block.x} y={block.y} width={block.w} height={block.h} rx={block.r} fill="white" opacity={block.o} />
      ))}
      <path d="M62 34 Q78 30 86 42 Q90 54 80 60 Q68 64 62 54 Z" fill="var(--color-mint)" opacity="0.14" />
      <path
        d="M-4 84 Q22 74 38 86 Q56 98 78 88 Q92 82 104 90"
        fill="none"
        stroke="var(--color-flow)"
        strokeOpacity="0.28"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <g stroke="white" strokeOpacity="0.08" strokeWidth="0.5">
        <line x1="0" y1="24" x2="100" y2="20" />
        <line x1="0" y1="52" x2="100" y2="56" />
        <line x1="18" y1="0" x2="14" y2="100" />
        <line x1="48" y1="0" x2="52" y2="100" />
        <line x1="76" y1="0" x2="72" y2="100" />
      </g>
      <g stroke="white" strokeOpacity="0.04" strokeWidth="0.3">
        <line x1="0" y1="12" x2="100" y2="10" />
        <line x1="0" y1="38" x2="100" y2="38" />
        <line x1="0" y1="70" x2="100" y2="72" />
        <line x1="32" y1="0" x2="30" y2="100" />
        <line x1="62" y1="0" x2="64" y2="100" />
        <line x1="90" y1="0" x2="88" y2="100" />
      </g>
    </svg>
  );
}
