"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, MapPinOff, Navigation } from "lucide-react";
import { useMemo, useState } from "react";

import { AppSurface } from "@/components/product/app-surface";
import { PlaceCard } from "@/components/product/place-card";
import { accents } from "@/components/ui/accent";
import { Chip } from "@/components/ui/chip";
import { getCity } from "@/data/cities";
import { placeLayers, placesForCity } from "@/data/places";
import type { Place, PlaceLayer } from "@/data/types";
import { duration, ease, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { isStudentVerified } from "@/services/db/schema";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * DISCOVER
 * ----------------------------------------------------------------------------
 * A stylised vector city rather than a tile map. Three reasons: it costs
 * nothing to serve to anonymous traffic, it works with no network, and an
 * abstract canvas keeps attention on price and walking time instead of on
 * street names nobody has learned yet.
 *
 * The layer rail, the verified filter and pin selection are all real state.
 * ============================================================================
 */
export function CityMap({ citySlug, className }: { citySlug: string; className?: string }) {
  const reduced = useReducedMotion();
  const city = getCity(citySlug);
  const all = useMemo(() => placesForCity(citySlug), [citySlug]);

  const [layers, setLayers] = useState<PlaceLayer[]>(["for-you"]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      all
        .filter((place) => (layers.length === 0 ? true : place.layers.some((l) => layers.includes(l))))
        .filter((place) => (verifiedOnly ? isStudentVerified(place.verifiedBy) : true)),
    [all, layers, verifiedOnly],
  );

  const selected = visible.find((place) => place.id === selectedId) ?? null;

  function toggleLayer(layer: PlaceLayer) {
    setLayers((current) => {
      const next = current.includes(layer)
        ? current.filter((item) => item !== layer)
        : [...current, layer];
      track("map_layer_toggled", { layer, active: !current.includes(layer) });
      return next;
    });
    setSelectedId(null);
  }

  return (
    <AppSurface
      title={`${city?.name ?? "Discover"} · Discover`}
      meta={`${visible.length} of ${all.length} places match your layers`}
      className={className}
      bodyClassName="p-0 sm:p-0"
    >
      {/* ---- layer rail --------------------------------------------------- */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-white/8 px-4 py-3 no-scrollbar edge-fade-x sm:px-5">
        {placeLayers.map((layer) => (
          <Chip
            key={layer.key}
            onDark
            accent={layer.accent}
            active={layers.includes(layer.key)}
            onClick={() => toggleLayer(layer.key)}
            count={all.filter((place) => place.layers.includes(layer.key)).length}
          >
            {layer.label}
          </Chip>
        ))}
        <Chip
          onDark
          accent="mint"
          active={verifiedOnly}
          onClick={() => setVerifiedOnly((current) => !current)}
          icon={<BadgeCheck className="size-3.5" />}
        >
          Student Verified
        </Chip>
      </div>

      {/* ---- canvas ------------------------------------------------------- */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-900 sm:aspect-[16/10]">
        <MapCanvas seed={city?.mapSeed ?? 11} />

        {/* "you are here" */}
        <span
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: "26%", top: "40%" }}
          aria-hidden
        >
          <span className="relative grid place-items-center">
            <span className="absolute size-6 rounded-full bg-flow/30 animate-ping-soft" />
            <span className="grid size-4 place-items-center rounded-full bg-flow ring-2 ring-ink-900">
              <Navigation className="size-2 text-white" />
            </span>
          </span>
        </span>

        {visible.map((place) => (
          <MapPin
            key={place.id}
            place={place}
            selected={place.id === selectedId}
            reduced={Boolean(reduced)}
            onSelect={() => {
              setSelectedId(place.id === selectedId ? null : place.id);
              track("place_opened", { placeId: place.id, source: "map" });
            }}
          />
        ))}

        {visible.length === 0 ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/70 px-6 text-center backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <MapPinOff className="size-6 text-white/30" aria-hidden />
              <p className="text-sm font-medium text-white">Nothing matches those layers</p>
              <p className="max-w-xs text-[0.8125rem] text-white/45">
                {verifiedOnly
                  ? "Student Verified needs ten independent confirmations. Turn it off to see places that are still building up."
                  : "Try turning a layer back on."}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ---- selection ---------------------------------------------------- */}
      <div className="border-t border-white/8 px-4 py-4 sm:px-5">
        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.div
              key={selected.id}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
            >
              <PlaceCard place={selected} />
            </motion.div>
          ) : (
            <motion.div
              key="hint"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2.5"
            >
              <p className="text-[0.8125rem] text-white/45">
                Pick a pin to see the price, the walk and why it is on the map.
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar edge-fade-x">
                {visible.slice(0, 4).map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => setSelectedId(place.id)}
                    className="shrink-0 rounded-md border border-white/10 bg-white/4 px-3 py-2 text-left transition-colors hover:border-white/25"
                  >
                    <span className="block max-w-[11rem] truncate text-[0.8125rem] font-medium text-white">
                      {place.name}
                    </span>
                    <span className="tnum mt-0.5 block text-xs text-white/45">
                      {place.priceLabel} · {place.walkMinutes} min
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Pin                                                                         */
/* -------------------------------------------------------------------------- */

function MapPin({
  place,
  selected,
  reduced,
  onSelect,
}: {
  place: Place;
  selected: boolean;
  reduced: boolean;
  onSelect: () => void;
}) {
  const primary = place.layers[0];
  const layerMeta = placeLayers.find((layer) => layer.key === primary);
  const accent = accents[layerMeta?.accent ?? "signal"];
  const free = place.price === 0;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${place.name}, ${place.priceLabel}, ${place.walkMinutes} minute walk`}
      className={cn(
        "absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full",
        "flex items-center gap-1 border px-1.5 py-1 text-[0.6875rem] font-medium",
        "transition-colors duration-150",
        selected
          ? cn(accent.fill, accent.onFill, "border-transparent shadow-[var(--shadow-float)]")
          : "border-white/12 bg-ink-950/85 text-white/85 hover:border-white/35",
      )}
      style={{ left: `${place.x}%`, top: `${place.y}%` }}
      whileHover={reduced ? undefined : { scale: 1.06 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={reduced ? { duration: 0 } : spring.snappy}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", selected ? "bg-current opacity-60" : accent.fill)}
      />
      <span className={cn("tnum whitespace-nowrap", selected ? "inline" : "hidden sm:inline")}>
        {free ? "Free" : place.priceLabel.replace(/^≈/, "")}
      </span>
    </motion.button>
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
    <svg
      className="absolute inset-0 size-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* blocks */}
      {blocks.map((block, index) => (
        <rect
          key={index}
          x={block.x}
          y={block.y}
          width={block.w}
          height={block.h}
          rx={block.r}
          fill="white"
          opacity={block.o}
        />
      ))}

      {/* park */}
      <path
        d="M62 34 Q78 30 86 42 Q90 54 80 60 Q68 64 62 54 Z"
        fill="var(--color-mint)"
        opacity="0.14"
      />

      {/* river */}
      <path
        d="M-4 84 Q22 74 38 86 Q56 98 78 88 Q92 82 104 90"
        fill="none"
        stroke="var(--color-flow)"
        strokeOpacity="0.28"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* arterial roads */}
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
