import type { ReactNode } from "react";

import { DoodleCoin, DoodlePin, DoodleStar, DoodleTag } from "@/components/brand/doodles";
import { MascotArt } from "@/components/mascot/mascot-art";
import type { MascotState } from "@/brand/mascot.config";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * STICKERS
 * ----------------------------------------------------------------------------
 * The unit of the brand that is designed to leave the site.
 *
 * A sticker is a hard 2px keyline, a solid offset shadow and a flat fill — the
 * treatment is deliberately the opposite of the soft glass used everywhere else
 * on the page, so "this object is meant to be screenshotted and sent" is a
 * visual rule rather than a caption.
 *
 * They are rendered as DOM, not exported as images, which is what makes them
 * cheap: a sticker sheet costs a few hundred bytes of markup and no asset
 * pipeline, and it restyles with the brand instead of going stale in a folder.
 * ============================================================================
 */

export type StickerTone = "signal" | "pulse" | "mint" | "amber" | "flow" | "ink" | "paper";

const TONES: Record<StickerTone, string> = {
  signal: "bg-signal text-ink-950",
  pulse: "bg-pulse text-white",
  mint: "bg-mint text-ink-950",
  amber: "bg-amber text-ink-950",
  flow: "bg-flow text-white",
  ink: "bg-ink-950 text-signal",
  paper: "bg-white text-ink-950",
};

export function Sticker({
  children,
  tone = "signal",
  icon,
  rotate = 0,
  size = "md",
  className,
}: {
  children: ReactNode;
  tone?: StickerTone;
  icon?: ReactNode;
  /** Degrees. Kept under 4 — a sticker at 10° reads as a mistake, not as play. */
  rotate?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap sticker",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* The sheet                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The sanctioned sticker set. Everything a student might want to slap on a
 * screenshot, and nothing that requires a claim we cannot stand behind.
 *
 * Declared as data rather than markup so the same list can drive the brand
 * page, an in-product sticker picker and, later, an export job — without
 * anyone retyping the strings and quietly inventing a tenth sticker.
 */
export type StickerSpec = {
  key: string;
  label: string;
  tone: StickerTone;
  icon?: "star" | "coin" | "pin" | "tag";
  rotate?: number;
};

export const stickerSheet: readonly StickerSpec[] = [
  { key: "found-a-deal", label: "Found a deal", tone: "amber", icon: "tag", rotate: -2 },
  { key: "anyone-down", label: "Anyone Down?", tone: "pulse", rotate: 1.5 },
  { key: "free-tonight", label: "Free tonight", tone: "signal", icon: "star", rotate: -1 },
  { key: "student-verified", label: "Student verified", tone: "mint", rotate: 2 },
  { key: "budget-survived", label: "Budget survived", tone: "flow", icon: "coin", rotate: -1.5 },
  { key: "under-10", label: "Under €10", tone: "ink", icon: "coin", rotate: 1 },
  { key: "new-city", label: "New city unlocked", tone: "paper", icon: "pin", rotate: -2 },
  { key: "good-find", label: "Good find", tone: "signal", icon: "star", rotate: 2 },
];

const ICONS = {
  star: DoodleStar,
  coin: DoodleCoin,
  pin: DoodlePin,
  tag: DoodleTag,
} as const;

/** Renders one entry from the sheet. Keeps call sites down to a key. */
export function SheetSticker({ spec, className }: { spec: StickerSpec; className?: string }) {
  const Icon = spec.icon ? ICONS[spec.icon] : null;
  return (
    <Sticker tone={spec.tone} rotate={spec.rotate} className={className} icon={Icon ? <Icon className="size-3.5" /> : undefined}>
      {spec.label}
    </Sticker>
  );
}

/* -------------------------------------------------------------------------- */
/* Reaction assets                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The mascot as a reaction: face in a disc, one word under it. This is the
 * asset that actually travels — it is the shape of every reaction pack anyone
 * has ever used in a group chat, and it works at 64px in a chat bubble.
 */
export function MascotReaction({
  state,
  label,
  tone = "paper",
  className,
}: {
  state: MascotState;
  label: string;
  tone?: "paper" | "signal" | "ink";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-24 flex-col items-center gap-2 rounded-2xl px-2 pt-2 pb-2.5 sticker",
        tone === "signal" && "bg-signal text-ink-950",
        tone === "ink" && "bg-ink-950 text-signal",
        tone === "paper" && "bg-white text-ink-950",
        className,
      )}
    >
      {/* The disc is always light, including on the ink tile. He is a near-black
          character: on a dark ground he stops being a face and becomes a
          silhouette, which defeats the entire purpose of a reaction asset. */}
      <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-paper-2">
        <MascotArt state={state} className="size-[116%] translate-y-[9%]" />
      </span>
      <span className="text-center text-[0.6875rem] leading-tight font-semibold">{label}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Presets — the sanctioned sticker set                                        */
/* -------------------------------------------------------------------------- */

/**
 * The stickers the brand actually ships. A closed list, so the same phrase is
 * always the same colour and the same mascot face wherever it appears — in a
 * share card, a Pulse post, a story.
 */
export const stickerPresets = {
  "free-tonight": { label: "Free tonight", tone: "mint", mascot: "excited" },
  "good-find": { label: "Good find", tone: "signal", mascot: "happy" },
  "anyone-down": { label: "Anyone down?", tone: "pulse", mascot: "social" },
  "under-10": { label: "Under €10", tone: "amber", mascot: "budget" },
  "budget-survived": { label: "Budget survived", tone: "ink", mascot: "celebrating" },
  "student-verified": { label: "Student verified", tone: "mint", mascot: "neutral" },
  "new-city": { label: "New city", tone: "flow", mascot: "arrival" },
  "found-a-deal": { label: "Found a deal", tone: "amber", mascot: "happy" },
  "people-joined": { label: "3 people joined", tone: "pulse", mascot: "social" },
  "zero-plan": { label: "€0 plan", tone: "mint", mascot: "excited" },
} as const satisfies Record<string, { label: string; tone: StickerTone; mascot: MascotState }>;

export type StickerPreset = keyof typeof stickerPresets;

/** A preset sticker with the mascot face in the disc. */
export function PresetSticker({
  preset,
  label,
  rotate = 0,
  size = "md",
  className,
}: {
  preset: StickerPreset;
  /** Override the label when a number belongs in it: "5 people joined". */
  label?: string;
  rotate?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = stickerPresets[preset];
  return (
    <Sticker
      tone={meta.tone}
      rotate={rotate}
      size={size}
      className={className}
      icon={<MascotArt state={meta.mascot} className={size === "sm" ? "size-4" : "size-5"} />}
    >
      {label ?? meta.label}
    </Sticker>
  );
}
