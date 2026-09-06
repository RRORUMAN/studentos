import type { ComponentProps, ReactNode } from "react";

import { accents, type Accent } from "@/components/ui/accent";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

export function Badge({
  accent = "signal",
  tone = "soft",
  className,
  children,
  ...props
}: ComponentProps<"span"> & { accent?: Accent; tone?: "soft" | "solid" | "outline" }) {
  const a = accents[accent];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-semibold uppercase tracking-[0.06em]",
        tone === "soft" && cn(a.soft, a.text),
        tone === "solid" && cn(a.fill, a.onFill),
        tone === "outline" && cn("border bg-transparent", a.border, a.text),
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Eyebrow — numbered section label, the "OS manual" motif                     */
/* -------------------------------------------------------------------------- */

export function Eyebrow({
  index,
  children,
  onDark = false,
  className,
}: {
  index?: string;
  children: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2.5 font-mono text-micro uppercase tracking-[0.14em]",
        onDark ? "text-white/45" : "text-ink-400",
        className,
      )}
    >
      {index ? (
        <span
          className={cn(
            "tnum rounded-xs px-1.5 py-0.5",
            onDark ? "bg-white/10 text-white/70" : "bg-ink-100 text-ink-600",
          )}
        >
          {index}
        </span>
      ) : null}
      <span>{children}</span>
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Section shell                                                               */
/* -------------------------------------------------------------------------- */

export type SectionTone = "paper" | "warm" | "tint" | "flow" | "pulse" | "dark";

/**
 * Section grounds.
 *
 * The rule the whole site now follows: **dark is the product, light is the
 * page.** A marketing section is never `dark` — the only dark rectangles a
 * visitor sees are `AppSurface` consoles, which makes "this is the app" a
 * colour the eye can learn. Rhythm between sections comes from the four light
 * grounds below instead of from alternating black and white slabs.
 */
export function Section({
  id,
  tone = "paper",
  className,
  children,
  ...props
}: ComponentProps<"section"> & { tone?: SectionTone }) {
  return (
    <section
      id={id}
      data-surface={tone === "dark" ? "dark" : "light"}
      className={cn(
        "relative scroll-mt-24 py-20 sm:py-24 lg:py-32",
        tone === "paper" && "bg-paper text-ink-900",
        tone === "warm" && "bg-paper-2 text-ink-900",
        tone === "tint" && "bg-tint-signal text-ink-900",
        tone === "flow" && "bg-tint-flow text-ink-900",
        tone === "pulse" && "bg-tint-pulse text-ink-900",
        tone === "dark" && "bg-console text-white",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Atmosphere — the depth layer light sections use instead of a dark ground     */
/* -------------------------------------------------------------------------- */

/**
 * Decorative ground for a light section: a hairline drafting grid, two drifting
 * colour washes and a film grain over the top. Always `aria-hidden`, always
 * `pointer-events-none`, and every layer is optional so a section can take just
 * the grid or just the wash.
 */
export function Atmosphere({
  grid = true,
  grain = true,
  blobs = [],
  className,
}: {
  grid?: boolean;
  grain?: boolean;
  /** Soft colour washes, positioned with Tailwind inset utilities. */
  blobs?: readonly { className: string; drift?: "a" | "b" | "none" }[];
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {grid ? (
        <div className="absolute inset-0 text-ink-950/[0.045] gridline [mask-image:radial-gradient(120%_90%_at_50%_0%,black,transparent_75%)]" />
      ) : null}
      {blobs.map((blob, index) => (
        <div
          key={index}
          className={cn(
            "mesh-blob",
            blob.drift === "b" ? "animate-drift-slow" : blob.drift === "none" ? "" : "animate-drift",
            blob.className,
          )}
        />
      ))}
      {grain ? <div className="absolute inset-0 opacity-[0.16] mix-blend-multiply grain" /> : null}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  eyebrowIndex,
  title,
  lead,
  align = "left",
  onDark = false,
  className,
  children,
}: {
  eyebrow?: string;
  eyebrowIndex?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  onDark?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <Eyebrow index={eyebrowIndex} onDark={onDark}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      <h2
        className={cn(
          "max-w-3xl text-display-md",
          onDark ? "text-white" : "text-ink-950",
          align === "center" && "mx-auto",
        )}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={cn(
            "max-w-2xl text-base leading-relaxed sm:text-lg",
            onDark ? "text-white/65" : "text-ink-600",
            align === "center" && "mx-auto",
          )}
        >
          {lead}
        </p>
      ) : null}
      {children}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Product panel — the sanctioned way to put dark UI on a light page           */
/* -------------------------------------------------------------------------- */

/**
 * Some product components (the Pulse post card, the map, the feed) are dark by
 * design because they are the app. They used to be hosted by full-bleed dark
 * `Section`s, which made half the marketing page black.
 *
 * This is the replacement: a dark, rounded, inset panel that carries those
 * components inside an otherwise light section. Same components, same contrast,
 * a fifth of the ink — and it now reads as "a screen embedded in the page"
 * rather than "the page went dark for a while".
 */
export function ProductPanel({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-surface="dark"
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 text-white sm:p-6 lg:p-8",
        "bg-linear-to-b from-console-2 to-console",
        "shadow-[var(--shadow-console)] ring-1 ring-white/8",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/25 to-transparent"
      />
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sample marker — every seeded demo on the site carries one                    */
/* -------------------------------------------------------------------------- */

export function SampleTag({
  label = "Sample data",
  onDark = false,
  className,
}: {
  label?: string;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-micro uppercase tracking-[0.1em]",
        onDark ? "bg-white/8 text-white/50" : "bg-ink-100 text-ink-500",
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", onDark ? "bg-white/40" : "bg-ink-400")} />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                      */
/* -------------------------------------------------------------------------- */

const AVATAR_TINTS = [
  "bg-pulse-soft text-pulse-deep",
  "bg-flow-soft text-flow-deep",
  "bg-mint-soft text-mint-deep",
  "bg-amber-soft text-amber-deep",
  "bg-signal-soft text-signal-deep",
];

/** Deterministic tint from initials, so the same person is the same colour. */
function tintFor(initials: string) {
  const code = initials.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_TINTS[code % AVATAR_TINTS.length];
}

export function Avatar({
  initials,
  size = "md",
  className,
  title,
}: {
  initials: string;
  size?: "xs" | "sm" | "md";
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "xs" && "size-6 text-[0.5625rem]",
        size === "sm" && "size-8 text-[0.6875rem]",
        size === "md" && "size-10 text-xs",
        tintFor(initials),
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({
  people,
  size = "sm",
  max = 5,
  onDark = false,
}: {
  people: readonly { initials: string; handle?: string }[];
  size?: "xs" | "sm" | "md";
  max?: number;
  onDark?: boolean;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((person) => (
          <Avatar
            key={person.handle ?? person.initials}
            initials={person.initials}
            size={size}
            title={person.handle}
            className={cn("ring-2", onDark ? "ring-ink-900" : "ring-white")}
          />
        ))}
      </div>
      {rest > 0 ? (
        <span
          className={cn(
            "tnum ml-2 text-sm font-medium",
            onDark ? "text-white/60" : "text-ink-500",
          )}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Meter — a value bar. Used for budget and student value, never a star rating. */
/* -------------------------------------------------------------------------- */

export function Meter({
  value,
  accent = "flow",
  label,
  className,
  onDark = false,
}: {
  /** 0-100. */
  value: number;
  accent?: Accent;
  label?: string;
  className?: string;
  onDark?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full", onDark ? "bg-white/12" : "bg-ink-100", className)}
      role="meter"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", accents[accent].fill)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Divider with a label — used between dense product blocks                    */
/* -------------------------------------------------------------------------- */

export function RuleLabel({
  children,
  onDark = false,
  className,
}: {
  children: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className={cn("h-px flex-1", onDark ? "bg-white/12" : "bg-ink-200")} />
      <span
        className={cn(
          "font-mono text-micro uppercase tracking-[0.12em]",
          onDark ? "text-white/40" : "text-ink-400",
        )}
      >
        {children}
      </span>
      <span className={cn("h-px flex-1", onDark ? "bg-white/12" : "bg-ink-200")} />
    </div>
  );
}
