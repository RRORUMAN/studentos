import Image from "next/image";
import type { SVGProps } from "react";

import {
  type LegacyMascotState,
  mascot,
  type MascotAccessory,
  mascotAssetFor,
  type MascotState,
  resolveMascotState,
} from "@/brand/mascot.config";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * MASCOT ART
 * ----------------------------------------------------------------------------
 * The StudentOS French Bulldog, drawn once and read fifteen ways.
 *
 * Drawn from the canonical reference portrait: a black Frenchie, square to
 * camera, large upright bat ears, big warm brown eyes with a visible sclera,
 * matte black RECTANGULAR frames sitting low on the muzzle, and a calm, faintly
 * amused mouth. Soft key light from the upper left.
 *
 * Two render paths, one character:
 *
 *   VECTOR   this file. Always available, identical in server and client
 *            components, holds up at 16px, animates for free.
 *   RENDER   a rendered image per state, used only when one is declared in
 *            `mascotAssets`. Expression and accessory come from the image; the
 *            vector's motion classes still apply to the wrapper.
 *
 * ---------------------------------------------------------------------------
 * WHAT MAKES IT THE BREED — AND THE REFERENCE
 *
 * 1. Skull flat on top and square, widest at the cheeks.
 * 2. Bat ears: broad base, rounded tip, set wide and UPRIGHT. Taller than the
 *    previous drawing — the reference's ears are the silhouette.
 * 3. A deep stop above the nose, a raised roll that catches light.
 * 4. Eyes low and inboard, one and a half eyes apart, LARGE, with a pale
 *    sclera and a warm brown iris around a big black pupil. The eyes are most
 *    of the character's charm and the one place a white shape is allowed.
 * 5. Rectangular frames: thick, matte, near-black, a step darker than the
 *    coat, small corner radius. The bridge sits on the stop.
 * 6. Short wide muzzle, heavy flews, whisker spots four a side.
 *
 * NO GRADIENTS: four flat coat planes layered as shapes, so the SVG needs no
 * `<defs>` ids and can repeat forty times on a screen. The rule that keeps him
 * one character: silhouette, proportion and colour are identical in every
 * state. Only eyes, brows, mouth and a few degrees of tilt change.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Expression system                                                           */
/* -------------------------------------------------------------------------- */

type Eyes = "open" | "wide" | "happy" | "squint" | "soft" | "glance";
type Brow = "neutral" | "raised" | "one-up" | "down" | "worried";
type Mouth = "smirk" | "smile" | "open" | "flat" | "wave" | "grin";

type Face = {
  eyes: Eyes;
  brow: Brow;
  mouth: Mouth;
  /** Head tilt in degrees. Small values only — past 6 he looks unwell. */
  tilt: number;
  tongue?: boolean;
};

const FACES: Record<MascotState, Face> = {
  neutral: { eyes: "open", brow: "neutral", mouth: "smirk", tilt: 0 },
  thinking: { eyes: "glance", brow: "one-up", mouth: "flat", tilt: -4 },
  happy: { eyes: "open", brow: "raised", mouth: "smile", tilt: 2 },
  excited: { eyes: "wide", brow: "raised", mouth: "grin", tilt: 3, tongue: true },
  celebrating: { eyes: "happy", brow: "raised", mouth: "open", tilt: -3, tongue: true },
  budget: { eyes: "open", brow: "one-up", mouth: "smirk", tilt: 0 },
  concerned: { eyes: "soft", brow: "worried", mouth: "flat", tilt: 0 },
  explorer: { eyes: "wide", brow: "one-up", mouth: "smirk", tilt: -3 },
  social: { eyes: "happy", brow: "raised", mouth: "smile", tilt: 3 },
  arrival: { eyes: "open", brow: "raised", mouth: "smile", tilt: -2 },
  survival: { eyes: "squint", brow: "down", mouth: "flat", tilt: 0 },
  error: { eyes: "soft", brow: "worried", mouth: "wave", tilt: 2 },
  empty: { eyes: "open", brow: "worried", mouth: "wave", tilt: 5 },
  travel: { eyes: "wide", brow: "raised", mouth: "smile", tilt: -4 },
  focus: { eyes: "squint", brow: "neutral", mouth: "flat", tilt: 0 },
};

/* -------------------------------------------------------------------------- */
/* Geometry — canvas 128×128, character seated, head centred on x=64          */
/* -------------------------------------------------------------------------- */

const HAUNCHES =
  "M64 90C37 90 19 104 16 121C15.2 125.4 17.4 128 21.5 128L106.5 128C110.6 128 112.8 125.4 112 121C109 104 91 90 64 90Z";
const CHEST =
  "M64 84C46 84 33.5 95 31.5 112C30.6 120.5 31.6 128 34.5 128L93.5 128C96.4 128 97.4 120.5 96.5 112C94.5 95 82 84 64 84Z";
const LEG_LEFT = "M47 103C40.5 103 37.5 109.5 37.5 117L37.5 124.5C37.5 126.8 38.8 128 41.2 128L57.5 128C59.6 128 60.5 126.8 60.5 124.8L59.5 105Z";
const LEG_RIGHT = "M81 103C87.5 103 90.5 109.5 90.5 117L90.5 124.5C90.5 126.8 89.2 128 86.8 128L70.5 128C68.4 128 67.5 126.8 67.5 124.8L68.5 105Z";
const TOES: readonly string[] = [
  "M43.5 128L43.5 120.5", "M49 128L49 119.5", "M54.5 128L54.5 120.5",
  "M73.5 128L73.5 120.5", "M79 128L79 119.5", "M84.5 128L84.5 120.5",
];

/** Skull: flat top, widest at the cheeks, soft square jaw. */
const HEAD =
  "M30 34C36 26.5 48 23 64 23C80 23 92 26.5 98 34C104.5 41 107.5 51 107.5 62C107.5 74.5 104 84.5 97 91.5C89.5 99 78 102.5 64 102.5C50 102.5 38.5 99 31 91.5C24 84.5 20.5 74.5 20.5 62C20.5 51 23.5 41 30 34Z";
const SKULL_LIGHT =
  "M64 24.5C49 24.5 37.5 28 32 35C27 41.4 24.4 48.5 23.4 55.5C30 45.5 45 40 64 40C83 40 98 45.5 104.6 55.5C103.6 48.5 101 41.4 96 35C90.5 28 79 24.5 64 24.5Z";
const JAW_SHADE =
  "M31 90C38.5 99 50 102.5 64 102.5C78 102.5 89.5 99 97 90C89 95.5 77.5 98.5 64 98.5C50.5 98.5 39 95.5 31 90Z";
const RIM_HEAD = "M105.5 72C104 84 100 92 93.5 97.5C87 103 77 105.5 64 105.5";
const RIM_BODY = "M95 100C97.5 110 98 120 97 128";

/**
 * Ears. Taller and more upright than a generic drawing: the reference's ears
 * rise almost to the top of the frame and are the silhouette. Broad base,
 * rounded tip, a slight outward lean.
 */
const EAR_LEFT =
  "M29 46C24.5 34 21.5 19 23.5 9.5C24.4 5.2 27.4 2.6 31.2 3.2C34.8 3.8 37.8 7 40.4 11.6C46 21.4 51.6 32.4 55 41.5C46.5 39.2 36.5 40.8 29 46Z";
const EAR_RIGHT =
  "M99 46C103.5 34 106.5 19 104.5 9.5C103.6 5.2 100.6 2.6 96.8 3.2C93.2 3.8 90.2 7 87.6 11.6C82 21.4 76.4 32.4 73 41.5C81.5 39.2 91.5 40.8 99 46Z";
const EAR_LEFT_INNER =
  "M34.5 43C31 33 29.4 21 30.6 14.2C31.4 10.2 34.6 9.2 37.4 13.2C41.8 19.6 47 30.4 50.4 39.2C44.6 38.2 39 39.6 34.5 43Z";
const EAR_RIGHT_INNER =
  "M93.5 43C97 33 98.6 21 97.4 14.2C96.6 10.2 93.4 9.2 90.6 13.2C86.2 19.6 81 30.4 77.6 39.2C83.4 38.2 89 39.6 93.5 43Z";

const MUZZLE =
  "M64 63C53 63 46 68 43.5 75.5C41 83 43.2 90.5 48.5 95C53.2 99 58.2 100.5 64 100.5C69.8 100.5 74.8 99 79.5 95C84.8 90.5 87 83 84.5 75.5C82 68 75 63 64 63Z";
const MUZZLE_LIGHT =
  "M64 64.5C55 64.5 48.8 68.5 46.4 74.5C52 69.6 57.6 67.4 64 67.4C70.4 67.4 76 69.6 81.6 74.5C79.2 68.5 73 64.5 64 64.5Z";
const BROW_ROLL =
  "M64 58.5C56.5 58.5 51 61 48 65C53.5 62 58.8 60.8 64 60.8C69.2 60.8 74.5 62 80 65C77 61 71.5 58.5 64 58.5Z";
const WHISKERS: readonly (readonly [number, number])[] = [
  [52, 86], [49.8, 90], [53.2, 91.5], [50.5, 94],
  [76, 86], [78.2, 90], [74.8, 91.5], [77.5, 94],
];

/** Eye centres: inboard of the cheeks, low on the skull. Large. */
const EYE_X = [47, 81] as const;
const EYE_Y = 58;
const EYE_R = 11.5;

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export type MascotArtProps = {
  state?: MascotState | LegacyMascotState;
  accessory?: MascotAccessory;
  /** Enables the blink, ear-twitch and thinking CSS animations. */
  idle?: boolean;
  /** Accessible name. Leave undefined to mark him decorative. */
  title?: string;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "className" | "title">;

export function MascotArt({
  state: rawState = "neutral",
  accessory = "none",
  idle = false,
  title,
  className,
  ...props
}: MascotArtProps) {
  const state = resolveMascotState(rawState);
  const asset = mascotAssetFor(state);

  /* A declared render wins. The wrapper keeps the same box and motion classes,
     so swapping vector for render changes nothing around it. */
  if (asset) {
    return (
      <span
        className={cn("relative inline-block overflow-hidden", className)}
        role={title ? "img" : undefined}
        aria-hidden={title ? undefined : true}
        aria-label={title}
      >
        <Image
          src={asset.src}
          alt={title ?? ""}
          width={asset.width}
          height={asset.height}
          className={cn("size-full object-contain", idle && state === "thinking" && "mascot-thinks")}
          sizes="(max-width: 640px) 160px, 320px"
        />
        {accessory !== "none" ? (
          <svg viewBox="0 0 128 128" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            <AccessoryFor accessory={accessory} tilt={0} />
          </svg>
        ) : null}
      </span>
    );
  }

  const face = FACES[state];

  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("overflow-visible", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}

      <ellipse cx="64" cy="126" rx="42" ry="5" className="fill-[var(--mascot-shade)]" opacity="0.16" />

      {/* ---- body ---------------------------------------------------------- */}
      <g>
        <path d={HAUNCHES} className="fill-[var(--mascot-coat-lo)]" />
        <path d={CHEST} className="fill-[var(--mascot-coat)]" />
        <path d="M64 90C56 90 50 96 47 106C52 99 57.5 96 64 96C70.5 96 76 99 81 106C78 96 72 90 64 90Z" className="fill-[var(--mascot-coat-hi)]" opacity="0.5" />
        <path d={LEG_LEFT} className="fill-[var(--mascot-coat)]" />
        <path d={LEG_RIGHT} className="fill-[var(--mascot-coat)]" />
        <path d="M64 108C63.4 114 63.2 121 63.4 128" className="stroke-[var(--mascot-shade)]" strokeWidth="2.4" strokeLinecap="round" opacity="0.5" fill="none" />
        <path d="M38.4 112C37.6 118 37.4 123.5 37.6 128" className="stroke-[var(--mascot-shade)]" strokeWidth="2" strokeLinecap="round" opacity="0.38" fill="none" />
        <path d="M89.6 112C90.4 118 90.6 123.5 90.4 128" className="stroke-[var(--mascot-shade)]" strokeWidth="2" strokeLinecap="round" opacity="0.38" fill="none" />
        <path d="M47 103C42 103 39.4 108 38.8 114C42 108.5 45.5 106.5 50 106.5L59.6 106.5L59.5 105Z" className="fill-[var(--mascot-coat-hi)]" opacity="0.3" />
        <path d="M81 103C86 103 88.6 108 89.2 114C86 108.5 82.5 106.5 78 106.5L68.4 106.5L68.5 105Z" className="fill-[var(--mascot-coat-hi)]" opacity="0.22" />
        {TOES.map((toe) => (
          <path key={toe} d={toe} className="stroke-[var(--mascot-shade)]" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
        ))}
        <path d={RIM_BODY} className="stroke-[var(--mascot-rim)]" strokeWidth="2" strokeLinecap="round" opacity="0.3" fill="none" />
      </g>

      {/* ---- head ---------------------------------------------------------- */}
      <g
        transform={`rotate(${face.tilt} 64 64)`}
        className={cn(idle && state === "thinking" && "mascot-thinks")}
        style={idle && state === "thinking" ? { transformOrigin: "64px 100px" } : undefined}
      >
        <g className={cn(idle && "mascot-twitches")} style={{ transformOrigin: "35px 44px" }}>
          <path d={EAR_LEFT} className="fill-[var(--mascot-coat-lo)]" />
          <path d={EAR_LEFT_INNER} className="fill-[var(--mascot-ear)]" />
          <path d={EAR_LEFT_INNER} className="fill-[var(--mascot-ear-hi)]" opacity="0.4" transform="translate(1.5 3) scale(0.82) translate(7 4)" />
        </g>
        <g>
          <path d={EAR_RIGHT} className="fill-[var(--mascot-coat-lo)]" />
          <path d={EAR_RIGHT_INNER} className="fill-[var(--mascot-ear)]" />
          <path d={EAR_RIGHT_INNER} className="fill-[var(--mascot-ear-hi)]" opacity="0.4" transform="translate(-1.5 3) scale(0.82) translate(14 4)" />
        </g>

        <path d={HEAD} className="fill-[var(--mascot-coat)]" />
        <path d={SKULL_LIGHT} className="fill-[var(--mascot-coat-hi)]" opacity="0.75" />
        <path d={JAW_SHADE} className="fill-[var(--mascot-coat-lo)]" opacity="0.85" />
        <path d={RIM_HEAD} className="stroke-[var(--mascot-rim)]" strokeWidth="2.2" strokeLinecap="round" opacity="0.34" fill="none" />

        <path d={MUZZLE} className="fill-[var(--mascot-muzzle)]" />
        <path d={MUZZLE_LIGHT} className="fill-[var(--mascot-muzzle-hi)]" opacity="0.6" />
        <path d={BROW_ROLL} className="fill-[var(--mascot-wrinkle)]" opacity="0.5" />

        <BrowPair kind={face.brow} />
        <EyePair kind={face.eyes} idle={idle} />
        <Spectacles />
        <Nose />
        <MouthShape kind={face.mouth} tongue={face.tongue ?? false} />

        {WHISKERS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.85" className="fill-[var(--mascot-shade)]" opacity="0.5" />
        ))}
        <ellipse cx="36" cy="76" rx="6" ry="4" className="fill-[var(--mascot-blush)]" opacity="0.06" />
        <ellipse cx="92" cy="76" rx="6" ry="4" className="fill-[var(--mascot-blush)]" opacity="0.06" />
      </g>

      <AccessoryFor accessory={accessory} tilt={face.tilt} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Spectacles                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The signature. Rectangular, thick, matte, a step darker than the coat — on a
 * black head a frame at coat value reads as texture, only a darker one reads
 * as a frame. Small corner radius: these are the reference's frames, not round
 * ones. Drawn as strokes so the lens stays clear and the eye is never dulled.
 */
function Spectacles() {
  const lens = { w: 33, h: 24, r: 3.2 };
  const left = EYE_X[0] - lens.w / 2 + 1;
  const right = EYE_X[1] - lens.w / 2 - 1;
  const top = EYE_Y - lens.h / 2 + 1;

  return (
    <g className="stroke-[var(--mascot-frame)]" fill="none" strokeWidth="4" strokeLinejoin="round">
      {/* Arms back to the ears. */}
      <path d={`M${left} ${EYE_Y - 3}L${left - 9} ${EYE_Y - 6.5}`} strokeLinecap="round" />
      <path d={`M${right + lens.w} ${EYE_Y - 3}L${right + lens.w + 9} ${EYE_Y - 6.5}`} strokeLinecap="round" />

      <rect x={left} y={top} width={lens.w} height={lens.h} rx={lens.r} />
      <rect x={right} y={top} width={lens.w} height={lens.h} rx={lens.r} />

      {/* Bridge over the stop. Short and straight, like the reference. */}
      <path d={`M${left + lens.w} ${top + 7}L${right} ${top + 7}`} strokeLinecap="round" />

      {/* A single specular streak on the left lens. One, not two. */}
      <path d={`M${left + 7} ${top + 18}L${left + 14} ${top + 6}`} className="stroke-white" strokeWidth="2" strokeLinecap="round" opacity="0.18" />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Eyes                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Big warm brown eyes with a pale sclera and a large black pupil — the
 * reference's most charming feature and the one warm shape on the character.
 * "glance" shifts the pupils up and to the side: the thinking look.
 */
function EyePair({ kind, idle }: { kind: Eyes; idle: boolean }) {
  if (kind === "happy") {
    return (
      <g className="stroke-[var(--mascot-shade)]" strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path d={`M${EYE_X[0] - 8} ${EYE_Y + 2}C${EYE_X[0] - 3.5} ${EYE_Y - 5.5} ${EYE_X[0] + 3.5} ${EYE_Y - 5.5} ${EYE_X[0] + 8} ${EYE_Y + 2}`} />
        <path d={`M${EYE_X[1] - 8} ${EYE_Y + 2}C${EYE_X[1] - 3.5} ${EYE_Y - 5.5} ${EYE_X[1] + 3.5} ${EYE_Y - 5.5} ${EYE_X[1] + 8} ${EYE_Y + 2}`} />
      </g>
    );
  }

  const ry = { open: 1, wide: 1.08, squint: 0.5, soft: 0.84, glance: 0.96, happy: 1 }[kind];
  const gaze = kind === "glance" ? { x: 2.6, y: -2.4 } : { x: 0, y: 0 };

  return (
    <g>
      {EYE_X.map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={EYE_Y} rx={EYE_R + 1.4} ry={EYE_R * ry + 1.4} className="fill-[var(--mascot-shade)]" opacity="0.6" />
          {/* Sclera: pale, warm, never pure white. */}
          <ellipse cx={cx} cy={EYE_Y} rx={EYE_R} ry={EYE_R * ry} className="fill-[var(--mascot-sclera)]" />
          {/* Iris: warm brown, most of the eye. */}
          <ellipse cx={cx + gaze.x} cy={EYE_Y + 0.4 + gaze.y} rx={EYE_R - 2.6} ry={(EYE_R - 2.6) * ry} className="fill-[var(--mascot-eye)]" />
          <ellipse cx={cx + gaze.x} cy={EYE_Y + 2.6 + gaze.y} rx={EYE_R - 4.4} ry={(EYE_R - 5) * ry} className="fill-[var(--mascot-iris)]" opacity="0.8" />
          <ellipse cx={cx + gaze.x} cy={EYE_Y + 0.4 + gaze.y} rx={EYE_R - 2.6} ry={(EYE_R - 2.6) * ry} className="stroke-[var(--mascot-iris-deep)]" strokeWidth="1.5" fill="none" opacity="0.9" />
          {/* Pupil: large. */}
          <ellipse cx={cx + gaze.x} cy={EYE_Y + 0.6 + gaze.y} rx={5.2} ry={5.2 * ry} className="fill-[var(--mascot-pupil)]" />
          {/* Catchlights: one large upper-left, one small lower-right. */}
          <circle cx={cx - 3.2 + gaze.x} cy={EYE_Y - 3.4 * ry + gaze.y} r={2.7} className="fill-white" opacity="0.95" />
          <circle cx={cx + 3.6 + gaze.x} cy={EYE_Y + 3.6 * ry + gaze.y} r={1.2} className="fill-white" opacity="0.55" />
          {idle ? (
            <ellipse
              cx={cx}
              cy={EYE_Y}
              rx={EYE_R + 1.6}
              ry={EYE_R * ry + 1.6}
              className="fill-[var(--mascot-coat)] mascot-blinks"
              style={{ transformOrigin: `${cx}px ${EYE_Y}px`, transform: "scaleY(0)" }}
            />
          ) : null}
        </g>
      ))}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Brows                                                                       */
/* -------------------------------------------------------------------------- */

function BrowPair({ kind }: { kind: Brow }) {
  const geometry: Record<Brow, { left: number; right: number; lift: number }> = {
    neutral: { left: 0, right: 0, lift: 0 },
    raised: { left: -8, right: 8, lift: -2.5 },
    "one-up": { left: -12, right: 2, lift: -1.5 },
    down: { left: 12, right: -12, lift: 1.5 },
    worried: { left: 14, right: -14, lift: -0.5 },
  };
  const { left, right, lift } = geometry[kind];
  const y = EYE_Y - 17;

  return (
    <g className="fill-[var(--mascot-coat-hi)]" opacity="0.9">
      <rect x={EYE_X[0] - 8} y={y + lift} width="16" height="3.4" rx="1.7" transform={`rotate(${left} ${EYE_X[0]} ${y + lift})`} />
      <rect x={EYE_X[1] - 8} y={y + lift} width="16" height="3.4" rx="1.7" transform={`rotate(${right} ${EYE_X[1]} ${y + lift})`} />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Nose and mouth                                                              */
/* -------------------------------------------------------------------------- */

function Nose() {
  return (
    <g>
      <path d="M64 69C57 69 52 72.4 52 77.6C52 82.4 57.2 86.4 64 86.4C70.8 86.4 76 82.4 76 77.6C76 72.4 71 69 64 69Z" className="fill-[var(--mascot-nose)]" />
      <path d="M64 70.2C59.4 70.2 55.6 72 54.4 74.8C57.6 72.6 60.6 71.6 64 71.6C67.4 71.6 70.4 72.6 73.6 74.8C72.4 72 68.6 70.2 64 70.2Z" className="fill-[var(--mascot-nose-hi)]" opacity="0.85" />
      <path d="M58.6 77.4C57.4 77.4 56.7 78.4 57 79.6C57.3 80.8 58.2 81.5 59.2 81C60.2 80.5 60.4 79.1 59.9 78.1C59.6 77.6 59.1 77.4 58.6 77.4Z" className="fill-[var(--mascot-shade)]" />
      <path d="M69.4 77.4C70.6 77.4 71.3 78.4 71 79.6C70.7 80.8 69.8 81.5 68.8 81C67.8 80.5 67.6 79.1 68.1 78.1C68.4 77.6 68.9 77.4 69.4 77.4Z" className="fill-[var(--mascot-shade)]" />
      <path d="M64 86.4L64 89.5" className="stroke-[var(--mascot-shade)]" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
    </g>
  );
}

function MouthShape({ kind, tongue }: { kind: Mouth; tongue: boolean }) {
  const y = 87;
  const flews = (
    <g className="stroke-[var(--mascot-mouth)]" strokeWidth="2" strokeLinecap="round" fill="none">
      <path d={`M64 ${y}C61 ${y + 3.5} 57.5 ${y + 4.5} 55 ${y + 3}`} />
      <path d={`M64 ${y}C67 ${y + 3.5} 70.5 ${y + 4.5} 73 ${y + 3}`} />
    </g>
  );

  if (kind === "open" || kind === "grin") {
    const depth = kind === "grin" ? 9 : 7;
    return (
      <g>
        <path d={`M56 ${y}C56 ${y} 59 ${y + depth} 64 ${y + depth}C69 ${y + depth} 72 ${y} 72 ${y}Z`} className="fill-[var(--mascot-mouth)]" />
        {tongue ? (
          <path d={`M59.5 ${y + 4}C59.5 ${y + 4} 61 ${y + depth + 0.5} 64 ${y + depth + 0.5}C67 ${y + depth + 0.5} 68.5 ${y + 4} 68.5 ${y + 4}Z`} className="fill-[var(--mascot-tongue)]" />
        ) : null}
        {flews}
      </g>
    );
  }

  const line: Record<Exclude<Mouth, "open" | "grin">, string> = {
    smirk: `M57 ${y + 1}C60 ${y + 3.5} 68 ${y + 3.5} 71.5 ${y - 0.5}`,
    smile: `M57 ${y}C60 ${y + 4} 68 ${y + 4} 71 ${y}`,
    flat: `M58 ${y + 1.5}L70 ${y + 1.5}`,
    wave: `M57 ${y + 1.5}C59.5 ${y - 1} 62 ${y + 4} 64.5 ${y + 1.5}C67 ${y - 1} 69 ${y + 3} 71 ${y + 1.5}`,
  };

  return (
    <g>
      <path d={line[kind]} className="stroke-[var(--mascot-mouth)]" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {flews}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Accessories                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One item, in one place, for one reason. Each is a small flat glyph in a
 * brand accent, placed where a real object would sit, never on the face.
 */
function AccessoryFor({ accessory, tilt }: { accessory: MascotAccessory; tilt: number }) {
  switch (accessory) {
    case "backpack":
      return (
        <g>
          <path d="M22 98C16.5 98 13 102.5 13 108L13 120C13 124.4 15.8 127.5 19.5 127.5L28 127.5L28 98Z" className="fill-[var(--mascot-strap)]" />
          <path d="M17 104L25 104" className="stroke-white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M28 104C30.5 102 32 99.5 33 97" className="stroke-[var(--mascot-strap)]" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      );
    case "calculator":
      return (
        <g transform="translate(96 104)">
          <rect width="20" height="22" rx="3" className="fill-[var(--color-flow)]" />
          <rect x="3" y="3" width="14" height="5" rx="1.2" className="fill-white" opacity="0.9" />
          {[0, 1, 2].map((row) =>
            [0, 1, 2].map((col) => (
              <circle key={`${row}-${col}`} cx={5 + col * 5} cy={12.5 + row * 4} r="1.4" className="fill-white" opacity="0.8" />
            )),
          )}
        </g>
      );
    case "luggage-tag":
      return (
        <g transform="translate(98 100) rotate(12)">
          <path d="M0 6C0 2.7 2.7 0 6 0L14 0C17.3 0 20 2.7 20 6L20 22C20 24.2 18.2 26 16 26L4 26C1.8 26 0 24.2 0 22Z" className="fill-[var(--color-amber)]" />
          <circle cx="10" cy="5" r="2" className="fill-[var(--mascot-coat)]" />
          <path d="M4 12L16 12M4 17L13 17" className="stroke-[var(--mascot-coat)]" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
        </g>
      );
    case "speech-bubble":
      return (
        <g transform="translate(94 8)">
          <path d="M4 0L24 0C26.2 0 28 1.8 28 4L28 14C28 16.2 26.2 18 24 18L12 18L6 24L7 18L4 18C1.8 18 0 16.2 0 14L0 4C0 1.8 1.8 0 4 0Z" className="fill-[var(--color-pulse)]" />
          {[7, 14, 21].map((x) => <circle key={x} cx={x} cy="9" r="1.7" className="fill-white" />)}
        </g>
      );
    case "notebook":
      return (
        <g transform="translate(10 102) rotate(-8)">
          <rect width="22" height="26" rx="2.5" className="fill-[var(--color-mint)]" />
          <rect x="3" width="3" height="26" className="fill-[var(--mascot-coat)]" opacity="0.35" />
          <path d="M9 8L18 8M9 13L18 13M9 18L15 18" className="stroke-[var(--mascot-coat)]" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case "map-pin":
      return (
        <g transform="translate(100 6)">
          <path d="M11 0C4.9 0 0 4.9 0 11C0 18.5 11 28 11 28C11 28 22 18.5 22 11C22 4.9 17.1 0 11 0Z" className="fill-[var(--color-signal)]" />
          <circle cx="11" cy="11" r="4.2" className="fill-[var(--mascot-coat)]" />
        </g>
      );
    case "cap":
      return (
        <g transform={`rotate(${tilt} 64 64)`}>
          <path d="M64 12C51 12 42 19 41 28L87 28C86 19 77 12 64 12Z" className="fill-[var(--mascot-collar)]" />
          <path d="M41 28L34 31C33 31.5 33.5 33 35 33L87 33C88 33 88 31.5 87 31L87 28Z" className="fill-[var(--mascot-collar)]" />
        </g>
      );
    case "collar":
      return (
        <g>
          <path d="M40 97C46 103 55 106 64 106C73 106 82 103 88 97C82 101 73 103 64 103C55 103 46 101 40 97Z" className="fill-[var(--mascot-collar)]" />
          <circle cx="64" cy="105" r="3" className="fill-[var(--mascot-collar)]" />
        </g>
      );
    default:
      return null;
  }
}

/**
 * The head only, for icons, avatars and the favicon. Same geometry, cropped:
 * ears, skull, eyes, frames. Recognisable at 16px because the frames and the
 * ears are the two shapes that survive.
 */
export function MascotHead({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="14 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={className}
    >
      <path d={EAR_LEFT} className="fill-[var(--mascot-coat-lo)]" />
      <path d={EAR_LEFT_INNER} className="fill-[var(--mascot-ear)]" />
      <path d={EAR_RIGHT} className="fill-[var(--mascot-coat-lo)]" />
      <path d={EAR_RIGHT_INNER} className="fill-[var(--mascot-ear)]" />
      <path d={HEAD} className="fill-[var(--mascot-coat)]" />
      <path d={SKULL_LIGHT} className="fill-[var(--mascot-coat-hi)]" opacity="0.75" />
      <path d={MUZZLE} className="fill-[var(--mascot-muzzle)]" />
      <EyePair kind="open" idle={false} />
      <Spectacles />
      <Nose />
      <MouthShape kind="smirk" tongue={false} />
    </svg>
  );
}

export const mascotArtSpecies = mascot.species;
