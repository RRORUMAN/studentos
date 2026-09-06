/**
 * Accent lookup. Tailwind needs literal class strings at build time, so accents
 * are resolved through this map rather than interpolated into class names.
 */
export type Accent = "signal" | "pulse" | "flow" | "mint" | "amber";

type AccentSet = {
  /** Readable accent text on a light ground. Contrast-checked. */
  text: string;
  /** Saturated fill, for dots, bars and pins. */
  fill: string;
  /** Tinted ground for chips and soft cards. */
  soft: string;
  /** Text colour that sits on `fill`. */
  onFill: string;
  border: string;
  /** Accent text that stays readable on the dark product surface. */
  textOnDark: string;
  ring: string;
};

export const accents: Record<Accent, AccentSet> = {
  signal: {
    text: "text-signal-deep",
    fill: "bg-signal",
    soft: "bg-signal-soft",
    onFill: "text-ink-950",
    border: "border-signal-deep/25",
    textOnDark: "text-signal",
    ring: "ring-signal/40",
  },
  pulse: {
    text: "text-pulse-deep",
    fill: "bg-pulse",
    soft: "bg-pulse-soft",
    onFill: "text-white",
    border: "border-pulse-deep/20",
    textOnDark: "text-pulse",
    ring: "ring-pulse/40",
  },
  flow: {
    text: "text-flow-deep",
    fill: "bg-flow",
    soft: "bg-flow-soft",
    onFill: "text-white",
    border: "border-flow-deep/20",
    textOnDark: "text-[#8fa2ff]",
    ring: "ring-flow/40",
  },
  mint: {
    text: "text-mint-deep",
    fill: "bg-mint",
    soft: "bg-mint-soft",
    onFill: "text-ink-950",
    border: "border-mint-deep/20",
    textOnDark: "text-mint",
    ring: "ring-mint/40",
  },
  amber: {
    text: "text-amber-deep",
    fill: "bg-amber",
    soft: "bg-amber-soft",
    onFill: "text-ink-950",
    border: "border-amber-deep/20",
    textOnDark: "text-amber",
    ring: "ring-amber/40",
  },
};
