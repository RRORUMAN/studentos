"use client";

import { useState } from "react";

import { MascotArt } from "@/components/mascot/mascot-art";
import { type LegacyMascotState, type MascotAccessory, type MascotState, resolveMascotState } from "@/brand/mascot.config";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * MASCOT
 * ----------------------------------------------------------------------------
 * The animated character. Wraps the static art with the four idle behaviours
 * and nothing else:
 *
 *   breathe    a 3px bob on a 7s cycle
 *   blink      both eyes, ~120ms, roughly every 6.5s
 *   ear twitch one ear, a few degrees, roughly every 9s
 *   pop        a single 0.6s spring, fired only when the state changes
 *
 * All four are CSS animations on transform. Nothing here runs a timer, nothing
 * measures layout, and the global prefers-reduced-motion rule switches every
 * one of them off — leaving a composed static character, because none of the
 * keyframes use a fill mode.
 *
 * The pop is the only motion that is not ambient, and it is deliberately tied
 * to state *change* rather than state: a mascot that celebrates on every
 * render is a mascot that gets muted.
 * ============================================================================
 */

const SIZES = {
  xs: "size-8",
  sm: "size-10",
  md: "size-14",
  lg: "size-20",
  xl: "size-28",
  "2xl": "size-40",
} as const;

export type MascotSize = keyof typeof SIZES;

export type MascotProps = {
  state?: MascotState | LegacyMascotState;
  size?: MascotSize;
  accessory?: MascotAccessory;
  /** Breathing and blinking. Turn off inside dense UI where he is a small icon. */
  idle?: boolean;
  /**
   * Accessible name. Leave undefined to mark the mascot decorative, which is
   * right almost everywhere: his expression restates information the copy
   * beside him already carries, so announcing it twice is noise.
   */
  title?: string;
  className?: string;
};

export function Mascot({
  state: rawState = "neutral",
  size = "md",
  accessory = "none",
  idle = true,
  title,
  className,
}: MascotProps) {
  const state = resolveMascotState(rawState);
  /* Remounting on state change is what restarts the pop animation: a class
     toggle would need a forced reflow between removal and re-add, a key does
     not.

     The counter is advanced during render rather than from an effect. This is
     React's sanctioned "adjust state when a prop changes" pattern, and it is
     the right one here for a reason beyond lint: an effect would paint the new
     face for one frame *before* the pop started, so the animation would visibly
     begin late. Comparing during render re-runs this component before anything
     is committed, so the new face and its pop arrive on the same frame.

     `generation` starts at 0, so the mount pass never pops — the first time a
     visitor meets him he is simply there. */
  const [seenState, setSeenState] = useState<MascotState>(state);
  const [generation, setGeneration] = useState(0);

  if (seenState !== state) {
    setSeenState(state);
    setGeneration((current) => current + 1);
  }

  return (
    <span
      key={generation}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        SIZES[size],
        idle && "mascot-idle",
        generation > 0 && "mascot-pops",
        className,
      )}
    >
      <MascotArt state={state} accessory={accessory} idle={idle} title={title} className="size-full" />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Static variant                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The mascot without the client bundle. For server components, dense lists and
 * anywhere he appears at 32px or below, where the idle motion is invisible and
 * the hydration cost is not.
 */
export function MascotStill({
  state = "neutral",
  size = "md",
  accessory = "none",
  title,
  className,
}: Omit<MascotProps, "idle">) {
  return (
    <MascotArt
      state={state}
      accessory={accessory}
      title={title}
      className={cn(SIZES[size], className)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The mascot in a disc, sized to sit in an avatar stack or a feed row next to
 * real student avatars. The disc is what stops him from competing with them:
 * inside a circle he is one participant, not a character standing on the page.
 */
export function MascotAvatar({
  state = "neutral",
  size = "md",
  onDark = false,
  className,
  title,
}: {
  state?: MascotState | LegacyMascotState;
  size?: "xs" | "sm" | "md" | "lg";
  onDark?: boolean;
  className?: string;
  title?: string;
}) {
  const disc = {
    xs: "size-6",
    sm: "size-8",
    md: "size-10",
    lg: "size-12",
  }[size];

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full",
        /* Light on both grounds. A near-black character inside a translucent
           white disc on the dark console is a silhouette, not a face — so the
           dark variant gets a solid pale disc and a brighter ring instead. */
        onDark ? "bg-paper-2 ring-1 ring-white/25" : "bg-signal-soft ring-1 ring-ink-950/8",
        disc,
        className,
      )}
    >
      {/* Scaled up and pushed down so the head fills the disc: the character is
          drawn as a bust, and a bust centred in a circle leaves dead space
          above the ears and shows a slice of collar at the bottom. */}
      <MascotArt state={state} title={title} className="size-[118%] translate-y-[10%]" />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Speech                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The mascot with a line. This is the only sanctioned way to give him dialogue
 * — a bare string next to the character with no bubble reads as body copy, and
 * within two sections nobody can tell which words are his.
 *
 * The bubble is `aria-hidden` when `decorative`, which is the default: his line
 * always restates something already on screen, so a screen reader hearing it
 * again learns nothing.
 */
export function MascotSay({
  children,
  state = "neutral",
  size = "md",
  accessory = "none",
  side = "right",
  tone = "paper",
  decorative = true,
  className,
  bubbleClassName,
}: {
  children: React.ReactNode;
  state?: MascotState | LegacyMascotState;
  size?: MascotSize;
  accessory?: MascotAccessory;
  /** Which side of the mascot the bubble sits on. */
  side?: "right" | "left" | "top";
  tone?: "paper" | "dark" | "signal";
  decorative?: boolean;
  className?: string;
  bubbleClassName?: string;
}) {
  const bubble = (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        "relative max-w-[15rem] rounded-2xl px-3.5 py-2 text-[0.8125rem] leading-snug font-medium mascot-says",
        tone === "dark" && "bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-sm",
        tone === "signal" && "bg-signal text-ink-950 ring-1 ring-ink-950/10",
        tone === "paper" && "bg-white text-ink-800 shadow-[var(--shadow-float)] ring-1 ring-ink-950/6",
        bubbleClassName,
      )}
    >
      {children}
      {/* The tail. A rotated square rather than a triangle path, so it inherits
          the bubble background and ring on both light and dark grounds. */}
      <span
        aria-hidden
        className={cn(
          "absolute size-2.5 rotate-45",
          tone === "dark" && "bg-white/10",
          tone === "signal" && "bg-signal",
          tone === "paper" && "bg-white",
          side === "right" && "top-1/2 -left-1 -translate-y-1/2",
          side === "left" && "top-1/2 -right-1 -translate-y-1/2",
          side === "top" && "-bottom-1 left-6",
        )}
      />
    </span>
  );

  const character = <Mascot state={state} size={size} accessory={accessory} />;

  if (side === "top") {
    return (
      <span className={cn("inline-flex flex-col items-start gap-2", className)}>
        {bubble}
        {character}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-3",
        side === "left" && "flex-row-reverse",
        className,
      )}
    >
      {character}
      {bubble}
    </span>
  );
}

