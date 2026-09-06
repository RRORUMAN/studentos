import type { SVGProps } from "react";

import { brand } from "@/brand/brand.config";
import { cn } from "@/lib/utils";

/**
 * The mark: an app tile with a location pin knocked out of it. Place is the
 * one thing every surface of the product has in common, so the mark says
 * "somewhere" rather than "student" or "AI".
 *
 * It inherits `currentColor`, so it works on paper, on the dark product
 * surface and inside a signal-coloured chip without a second asset.
 */
export function BrandMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={cn("size-6", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.4 0h11.2A6.4 6.4 0 0 1 24 6.4v11.2a6.4 6.4 0 0 1-6.4 6.4H6.4A6.4 6.4 0 0 1 0 17.6V6.4A6.4 6.4 0 0 1 6.4 0Zm5.6 4.5a5.1 5.1 0 0 0-5.1 5.1c0 3.6 3.9 7.9 4.6 8.7a.68.68 0 0 0 1 0c.7-.8 4.6-5.1 4.6-8.7A5.1 5.1 0 0 0 12 4.5Zm0 3.2a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z"
      />
    </svg>
  );
}

/**
 * The wordmark. `OS` carries the accent so the name reads as a system rather
 * than a noun, and the whole thing is one flex row so it never wraps oddly.
 */
export function Wordmark({
  className,
  markClassName,
  tone = "light",
}: {
  className?: string;
  markClassName?: string;
  tone?: "light" | "dark";
}) {
  // Split on the trailing "OS" so a rename keeps working: if the new name has
  // no suffix, the whole word simply renders in the base colour.
  const suffix = brand.name.endsWith(brand.shortName) ? brand.shortName : "";
  const stem = suffix ? brand.name.slice(0, -suffix.length) : brand.name;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark
        className={cn(
          "size-6 shrink-0",
          tone === "dark" ? "text-white" : "text-ink-950",
          markClassName,
        )}
      />
      <span
        className={cn(
          "font-display text-[1.0625rem] font-semibold tracking-[-0.02em]",
          tone === "dark" ? "text-white" : "text-ink-950",
        )}
      >
        {stem}
        {suffix ? <span className="text-signal-deep">{suffix}</span> : null}
      </span>
    </span>
  );
}
