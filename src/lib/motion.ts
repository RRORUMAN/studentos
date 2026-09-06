import type { Transition, Variants } from "motion/react";

/**
 * ============================================================================
 * MOTION TOKENS
 * ----------------------------------------------------------------------------
 * Mirrors the easing curves declared in globals.css so CSS transitions and
 * JS-driven animation feel like the same product. Nothing in the app should
 * invent its own duration or curve.
 * ============================================================================
 */

export const duration = {
  /** Tap feedback, checkbox flips. */
  instant: 0.12,
  /** Hover, chip selection. */
  quick: 0.18,
  /** The default. Panels, cards, list items. */
  base: 0.28,
  /** Section reveals, layout shifts. */
  slow: 0.45,
  /** Narrative moments: the hero plan assembling itself. */
  story: 0.7,
} as const;

type Cubic = [number, number, number, number];

export const ease: Record<"out" | "inOut" | "springish", Cubic> = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
  springish: [0.34, 1.4, 0.64, 1],
};

export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.8 },
  soft: { type: "spring", stiffness: 260, damping: 30 },
  bouncy: { type: "spring", stiffness: 420, damping: 18, mass: 0.9 },
} as const satisfies Record<string, Transition>;

/** Shared `whileInView` viewport config: reveal once, slightly before centre. */
export const viewport = {
  once: true,
  amount: 0.2,
  margin: "0px 0px -8% 0px",
} as const;

export const revealUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: ease.out },
  },
};

export const revealBlur: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: duration.story, ease: ease.out },
  },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  shown: { opacity: 1, scale: 1, transition: spring.bouncy },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: duration.base, ease: ease.out } },
};

/** Container that releases children one after another. */
export function stagger(step = 0.06, delay = 0): Variants {
  return {
    hidden: {},
    shown: {
      transition: { staggerChildren: step, delayChildren: delay },
    },
  };
}

/**
 * Reduced-motion fallback. Elements still change state — they just arrive
 * instead of travelling. Returning `undefined` for variants would strand
 * anything relying on the hidden/shown state names.
 */
export const staticVariants: Variants = {
  hidden: { opacity: 1, y: 0, scale: 1, filter: "none" },
  shown: { opacity: 1, y: 0, scale: 1, filter: "none", transition: { duration: 0 } },
};
