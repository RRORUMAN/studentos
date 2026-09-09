"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, MapPinOff, Navigation, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";

import { AppSurface } from "@/components/product/app-surface";
import { PlaceCard } from "@/components/product/place-card";
import { accents } from "@/components/ui/accent";
import { Chip } from "@/components/ui/chip";
import { placeLayers } from "@/config/places";
import type { Place, PlaceLayer } from "@/data/types";
import {
  type Coords,
  type Viewport,
  describeProximity,
  positionIn,
  viewportFor,
} from "@/domain/places";
import { duration, ease, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { isStudentVerified } from "@/services/db/schema";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * THE MAP
 * ----------------------------------------------------------------------------
 * Real places at real coordinates, projected properly.
 *
 * WHAT THIS REPLACED. The old map drew a random city from a seeded PRNG and
 * placed each pin using `x` and `y` percentages written by hand beside each
 * invented place. It was a picture of a map. Two shops on the same street
 * could sit at opposite corners; a river ran through every city; and none of
 * it moved if the data changed, because the data was the drawing.
 *
 * Now the pins are Web Mercator projections of the coordinates the provider
 * returned, into a viewport computed from the places themselves. The relative
 * geography is therefore true: something drawn to the north-east is to the
 * north-east, and two places close together on screen are close together on
 * the ground.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO BASEMAP BY DEFAULT
 *
 * Streets under the pins would need a tile provider. OpenStreetMap's own tile
 * servers exist for the map on their website and their usage policy does not
 * cover an application, so shipping a default that points at them would be
 * taking something that was not offered. With `NEXT_PUBLIC_MAP_TILE_URL` set,
 * tiles are drawn and attributed; without it the ground is plain and the map
 * says so. A plain ground with true positions is honest; borrowed tiles are
 * not.
 * ============================================================================
 */

export type CityMapProps = {
  cityName: string;
  /** Real places, already loaded. This component never fetches. */
  places: readonly Place[];
  /** City centre, used when nothing else anchors the view. */
  centre: Coords;
  /** Where the student is, when they have told us. Null is normal. */
  homePoint?: Coords | null;
  /** Set when no provider answered. Rendered instead of an empty map. */
  unavailable?: { message: string } | null;
  /** The licence line for whatever produced these rows. */
  attribution?: string | null;
  /** Passed in so the server and client agree on what "now" is. */
  now: Date;
  timezone: string;
  className?: string;
};

export function CityMap({
  cityName,
  places,
  centre,
  homePoint = null,
  unavailable = null,
  attribution,
  now,
  timezone,
  className,
}: CityMapProps) {
  const reduced = useReducedMotion();

  const [layers, setLayers] = useState<PlaceLayer[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      places
        .filter((place) =>
          layers.length === 0 ? true : place.layers.some((layer) => layers.includes(layer)),
        )
        .filter((place) => (verifiedOnly ? isStudentVerified(place.confirmations) : true)),
    [places, layers, verifiedOnly],
  );

  /* The viewport follows what is actually on screen, so filtering to one layer
     zooms into it rather than leaving four pins in the corner of a city. */
  const viewport = useMemo(
    () =>
      viewportFor([
        ...visible.map((place) => ({ lat: place.lat, lng: place.lng })),
        ...(homePoint ? [homePoint] : []),
        ...(visible.length === 0 ? [centre] : []),
      ]),
    [visible, homePoint, centre],
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
      title={`${cityName} · Discover`}
      meta={
        unavailable
          ? "Map unavailable"
          : `${visible.length} of ${places.length} places match your filters`
      }
      className={className}
      bodyClassName="p-0 sm:p-0"
    >
      {/* ---- layer rail --------------------------------------------------- */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-white/8 px-4 py-3 no-scrollbar edge-fade-x sm:px-5">
        {placeLayers
          .filter((layer) => layer.key !== "for-you")
          .map((layer) => {
            const count = places.filter((place) => place.layers.includes(layer.key)).length;
            /* A filter that would empty the map is not offered. An enabled chip
               that yields nothing reads as a broken map rather than as an
               honest absence. */
            if (count === 0) return null;
            return (
              <Chip
                key={layer.key}
                onDark
                accent={layer.accent}
                active={layers.includes(layer.key)}
                onClick={() => toggleLayer(layer.key)}
                count={count}
              >
                {layer.label}
              </Chip>
            );
          })}
        {places.some((place) => isStudentVerified(place.confirmations)) ? (
          <Chip
            onDark
            accent="mint"
            active={verifiedOnly}
            onClick={() => setVerifiedOnly((current) => !current)}
            icon={<BadgeCheck className="size-3.5" />}
          >
            Student Verified
          </Chip>
        ) : null}
      </div>

      {/* ---- canvas ------------------------------------------------------- */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-900 sm:aspect-[16/10]">
        <Ground />

        {homePoint && viewport ? <HomePin point={homePoint} viewport={viewport} /> : null}

        {viewport
          ? visible.map((place) => (
              <MapPin
                key={place.id}
                place={place}
                viewport={viewport}
                selected={place.id === selectedId}
                reduced={Boolean(reduced)}
                onSelect={() => {
                  setSelectedId(place.id === selectedId ? null : place.id);
                  track("place_opened", { placeId: place.id, source: "map" });
                }}
              />
            ))
          : null}

        {unavailable ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/80 px-6 text-center backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <WifiOff className="size-6 text-amber" aria-hidden />
              <p className="text-sm font-medium text-white">{unavailable.message}</p>
              <p className="max-w-xs text-[0.8125rem] text-white/45">
                Our map service, not your connection. Nothing here is a statement about what is
                actually near you.
              </p>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/70 px-6 text-center backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <MapPinOff className="size-6 text-white/30" aria-hidden />
              <p className="text-sm font-medium text-white">
                {places.length === 0 ? `Nothing mapped here yet` : "Nothing matches those filters"}
              </p>
              <p className="max-w-xs text-[0.8125rem] text-white/45">
                {verifiedOnly
                  ? "Student Verified needs ten independent confirmations. Turn it off to see places that are still building up."
                  : places.length === 0
                    ? `No provider returned places around ${cityName}. If you know somewhere, it can be added to OpenStreetMap and it will appear here.`
                    : "Try turning a filter back off."}
              </p>
            </div>
          </div>
        ) : null}

        {attribution ? (
          <span className="absolute bottom-1.5 right-2 z-10 rounded bg-ink-950/70 px-1.5 py-0.5 text-[0.625rem] text-white/50">
            {attribution}
          </span>
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
              <PlaceCard place={selected} timezone={timezone} now={now} />
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
                {homePoint
                  ? "Distances are from where you live. Pick a pin for the details."
                  : `Distances are from the centre of ${cityName}. Set where you live and they become distances from you.`}
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
                      {place.category} · {describeProximity(place.proximity)}
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
/* Pins                                                                        */
/* -------------------------------------------------------------------------- */

function MapPin({
  place,
  viewport,
  selected,
  reduced,
  onSelect,
}: {
  place: Place;
  viewport: Viewport;
  selected: boolean;
  reduced: boolean;
  onSelect: () => void;
}) {
  const at = positionIn({ lat: place.lat, lng: place.lng }, viewport);
  /* Outside the viewport is not drawn at all. Clamping it to the edge would
     put a pin somewhere the place is not, which is the whole class of mistake
     this rewrite exists to end. */
  if (!at) return null;

  const primary = place.layers[0];
  const layerMeta = placeLayers.find((layer) => layer.key === primary);
  const accent = accents[layerMeta?.accent ?? "signal"];

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${place.name}, ${place.category}, ${describeProximity(place.proximity)}`}
      className={cn(
        "absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full",
        "flex items-center gap-1 border px-1.5 py-1 text-[0.6875rem] font-medium",
        "transition-colors duration-150",
        selected
          ? cn(accent.fill, accent.onFill, "border-transparent shadow-[var(--shadow-float)]")
          : "border-white/12 bg-ink-950/85 text-white/85 hover:border-white/35",
      )}
      style={{ left: `${at.left}%`, top: `${at.top}%` }}
      whileHover={reduced ? undefined : { scale: 1.06 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={reduced ? { duration: 0 } : spring.snappy}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          selected ? "bg-current opacity-60" : accent.fill,
        )}
      />
      <span className={cn("whitespace-nowrap", selected ? "inline" : "hidden sm:inline")}>
        {place.name.length > 18 ? `${place.name.slice(0, 17)}…` : place.name}
      </span>
    </motion.button>
  );
}

function HomePin({ point, viewport }: { point: Coords; viewport: Viewport }) {
  const at = positionIn(point, viewport);
  if (!at) return null;

  return (
    <span
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${at.left}%`, top: `${at.top}%` }}
      aria-hidden
    >
      <span className="relative grid place-items-center">
        <span className="absolute size-6 rounded-full bg-flow/30 animate-ping-soft" />
        <span className="grid size-4 place-items-center rounded-full bg-flow ring-2 ring-ink-900">
          <Navigation className="size-2 text-white" />
        </span>
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Ground                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A plain ground, and deliberately so.
 *
 * There used to be a generated city here: random blocks, a river, arterial
 * roads. It was drawn from the city's `mapSeed`, which meant every city had a
 * river through it whether or not it has one, and the streets under the pins
 * were fiction. Now that the pins are real, that fiction would be worse than
 * before: it would look like the shops sat on those streets.
 *
 * So: a grid, which claims nothing. When a deployment configures a tile
 * provider the streets are real and are attributed; until then this is an
 * honest backdrop for true positions.
 */
function Ground() {
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id="map-grid" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#map-grid)" />
    </svg>
  );
}
