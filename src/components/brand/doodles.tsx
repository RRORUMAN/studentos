import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * DOODLES
 * ----------------------------------------------------------------------------
 * The playful layer. Six marks, drawn in one hand, used as punctuation rather
 * than decoration — a star next to a good find, a pin next to a place, a coin
 * next to a saving.
 *
 * Rules that keep this from becoming clip art:
 * - Every mark inherits `currentColor`. There are no baked-in colours, so a
 *   doodle always belongs to the accent of the thing it is annotating.
 * - Stroke widths are all 2 at a 24 viewBox. Mixed weights are what makes a
 *   set of hand-drawn marks look like it came from three different files.
 * - Slightly imperfect geometry on purpose. The star is off-axis, the underline
 *   sags. Perfect doodles read as icons, and we already have an icon set.
 * - Always decorative: every one is `aria-hidden` and none may ever be the only
 *   carrier of a meaning.
 * ============================================================================
 */

type DoodleProps = Omit<SVGProps<SVGSVGElement>, "children">;

function Doodle({ className, children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-5 shrink-0", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/** A four-point sparkle. Marks a genuinely good find, never a generic "AI". */
export function DoodleStar(props: DoodleProps) {
  return (
    <Doodle {...props}>
      <path d="M12 3.2c.9 4.4 2.4 6 6.8 6.9-4.4.9-5.9 2.4-6.8 6.8-.9-4.4-2.4-5.9-6.8-6.8 4.4-.9 5.9-2.5 6.8-6.9Z" />
      <path d="M18.6 16.4c.4 1.9 1 2.5 2.9 2.9-1.9.4-2.5 1-2.9 2.9-.4-1.9-1-2.5-2.9-2.9 1.9-.4 2.5-1 2.9-2.9Z" />
    </Doodle>
  );
}

/** A place. The single most used mark on the site, so it is the simplest. */
export function DoodlePin(props: DoodleProps) {
  return (
    <Doodle {...props}>
      <path d="M12 21.5c3.4-3.9 6.4-7 6.4-10.6A6.4 6.4 0 0 0 5.6 10.9c0 3.6 3 6.7 6.4 10.6Z" />
      <circle cx="12" cy="10.6" r="2.3" />
    </Doodle>
  );
}

/** Money. A coin with a nick out of the rim, so it reads as spent, not minted. */
export function DoodleCoin(props: DoodleProps) {
  return (
    <Doodle {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M14.6 9.2c-.7-.8-1.7-1.2-2.8-1.2-1.6 0-2.6.8-2.6 2s1 1.7 2.7 2.1c1.8.4 2.9 1 2.9 2.3s-1.2 2-2.9 2c-1.2 0-2.2-.4-2.9-1.3" />
      <path d="M12 6.3v11.4" />
    </Doodle>
  );
}

/** Someone said something. Used around The Loop and Anyone Down?. */
export function DoodleBubble(props: DoodleProps) {
  return (
    <Doodle {...props}>
      <path d="M20.4 12.6c0 3.9-3.8 7-8.4 7-1 0-2-.1-2.9-.4L4 20.8l1.4-3.7c-1.1-1.2-1.8-2.8-1.8-4.5 0-3.9 3.8-7 8.4-7s8.4 3.1 8.4 7Z" />
    </Doodle>
  );
}

/** A route between two places. The Discover and plan motif. */
export function DoodleRoute(props: DoodleProps) {
  return (
    <Doodle {...props}>
      <circle cx="5.5" cy="6" r="2.4" />
      <circle cx="18.5" cy="18" r="2.4" />
      <path d="M7.6 7.4c2.6 1.4 1.4 4.2-1 5.2s-2.4 3.6.8 4.6" strokeDasharray="0.1 3.4" />
    </Doodle>
  );
}

/** Free. A tag with nothing written on it, which is the joke. */
export function DoodleTag(props: DoodleProps) {
  return (
    <Doodle {...props}>
      <path d="M11.4 3.4 4 4.2l-.8 7.4 9 9 8.2-8.2-9-9Z" />
      <circle cx="8.2" cy="8.4" r="1.4" />
    </Doodle>
  );
}

/* -------------------------------------------------------------------------- */
/* Accent lines                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A hand-drawn underline. Sits behind one word in a headline — never a phrase,
 * because a marker stroke that wraps onto a second line stops reading as a
 * marker and starts reading as a highlight bug.
 */
export function SketchUnderline({ className, ...props }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 120 10"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
      className={cn("absolute inset-x-0 -bottom-1 h-[0.36em] w-full", className)}
      {...props}
    >
      <path
        d="M2 7c22-3.6 44-5 76-3.8 16 .6 30 2.2 40 3.3"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A short curved arrow, for pointing at the one thing in a composition that
 * should be looked at first. Rotate it with a class rather than a prop.
 */
export function SketchArrow({ className, ...props }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 48 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-10 shrink-0", className)}
      {...props}
    >
      <path d="M4 6c14-1 26 6 30 22" />
      <path d="M27 25.5 34.5 28.5 38 21" />
    </svg>
  );
}

/**
 * A soft blob, used behind a mascot or a stat so he is standing on something
 * rather than floating. Organic on purpose — the rest of the page is built on
 * a hairline grid, and this is the one shape allowed to ignore it.
 */
export function Blob({ className, ...props }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 200 180"
      fill="currentColor"
      aria-hidden
      className={cn("absolute inset-0 size-full", className)}
      {...props}
    >
      <path d="M163 31c19 17 27 46 21 71s-25 46-49 57-52 12-71-1-29-40-25-66 22-50 44-63 61-14 80 2Z" />
    </svg>
  );
}
