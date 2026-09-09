"use client";

import { ArrowRight, Footprints, MapPinOff, ShieldCheck, Tag, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { accents, type Accent } from "@/components/ui/accent";
import { valueLabel } from "@/config/places";
import {
  type ValueBand,
  type Viewport,
  positionIn,
  priceLevelLabel,
  priceLevelNote,
  viewportFor,
} from "@/domain/places";
import { cn } from "@/lib/utils";

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

/**
 * A place, as the map needs it.
 *
 * `x` and `y` used to be here: a position on a drawing, written by hand beside
 * each invented place. They are gone. A place carries where it actually is,
 * and the map projects that into the canvas, so two shops on one street are
 * drawn on one street.
 */
export type MapPlace = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  /** The provider's 1-4 band. Null means it did not publish one. */
  priceLevel: number | null;
  /** "8 min walk" or "600 m away", already decided by `describeProximity`. */
  proximityLabel: string;
  /** A word and its reasons. Never a percentage. */
  valueBand: ValueBand;
  valueReasons: readonly string[];
  /** Real confirmations. Zero renders nothing. */
  confirmations: number;
  /** 0-100 from the scorer: fit against this student, not quality. */
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
  centre,
  attribution,
  eventCount = 0,
  className,
}: {
  places: readonly MapPlace[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** City centre, used to anchor the view when nothing is pinned. */
  centre: { lat: number; lng: number };
  /** Licence line for whatever produced these rows. Rendered on the canvas. */
  attribution?: string | null;
  /** Events in the current view, listed below but not pinned. */
  eventCount?: number;
  className?: string;
}) {
  const selected = places.find((place) => place.id === selectedId) ?? null;

  /* The viewport follows what is on screen, so filtering to one category zooms
     into it rather than leaving three pins in a corner. */
  const viewport = useMemo(
    () =>
      viewportFor(
        places.length > 0 ? places.map((place) => ({ lat: place.lat, lng: place.lng })) : [centre],
      ),
    [places, centre],
  );

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
        <MapGround />

        {viewport
          ? places.map((place) => (
              <Pin
                key={place.id}
                place={place}
                viewport={viewport}
                selected={place.id === selectedId}
                onSelect={() => onSelect(place.id === selectedId ? null : place.id)}
              />
            ))
          : null}

        {attribution ? (
          <span className="absolute bottom-1.5 right-2 z-10 rounded bg-ink-950/70 px-1.5 py-0.5 text-[0.625rem] text-white/50">
            {attribution}
          </span>
        ) : null}

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
                <span
                  className="text-[0.9375rem] font-medium text-ink-700"
                  title={priceLevelNote(selected.priceLevel)}
                >
                  {priceLevelLabel(selected.priceLevel)}
                </span>
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
                <span className="tnum">{selected.proximityLabel}</span>
              </span>
              {selected.confirmations >= 10 ? (
                <span className="inline-flex items-center gap-1 text-mint-deep">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  <span className="tnum">{selected.confirmations}</span> confirmed
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
              {/* A band and its reasons, not a bar. The bar said a measurement
                  had happened; the number behind it was written by hand. */}
              <div className="min-w-0 flex-1">
                <span className="text-[0.75rem] font-medium text-ink-700">
                  {valueLabel[selected.valueBand]}
                </span>
                {selected.valueReasons.length > 0 ? (
                  <p className="mt-0.5 truncate text-[0.75rem] text-ink-500">
                    {selected.valueReasons.join(" · ")}
                  </p>
                ) : null}
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
  viewport,
  selected,
  onSelect,
}: {
  place: MapPlace;
  viewport: Viewport;
  selected: boolean;
  onSelect: () => void;
}) {
  const at = positionIn({ lat: place.lat, lng: place.lng }, viewport);
  /* Outside the viewport is not drawn. Clamping to the edge would put a pin
     where the place is not. */
  if (!at) return null;

  const accent = accents[place.accent];
  const label = place.name.length > 16 ? `${place.name.slice(0, 15)}\u2026` : place.name;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${place.name}, ${place.category}, ${place.proximityLabel}`}
      className={cn(
        "absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border px-1.5 py-1 text-[0.6875rem] font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 hover:scale-105 active:scale-95",
        selected
          ? cn(accent.fill, accent.onFill, "z-30 border-transparent shadow-[var(--shadow-float)]")
          : "border-white/12 bg-ink-950/85 text-white/85 hover:border-white/35",
      )}
      style={{ left: `${at.left}%`, top: `${at.top}%` }}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", selected ? "bg-current opacity-60" : accent.fill)}
      />
      <span className={cn("whitespace-nowrap", selected ? "inline" : "hidden sm:inline")}>{label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Ground                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A plain grid, and deliberately so.
 *
 * There used to be a generated city here: random blocks, a park, a river,
 * arterial roads, all drawn from the city's `mapSeed`. Every city got a river
 * whether or not it has one. Now that the pins are at real coordinates that
 * fiction would be worse than before, because it would look like the shops sit
 * on those streets. A grid claims nothing. Configure a tile provider and the
 * streets become real and attributed.
 */
function MapGround() {
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id="discover-grid" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#discover-grid)" />
    </svg>
  );
}
