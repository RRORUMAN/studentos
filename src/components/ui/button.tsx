import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * One button system. `buttonStyles` is exported so anchors, Next links and
 * buttons can share it without a polymorphic wrapper — the three call sites
 * below are the only ones allowed to use it.
 */
export const buttonStyles = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap",
    "font-medium leading-none",
    "transition-[transform,background-color,color,box-shadow,border-color]",
    "duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-45",
    "aria-disabled:pointer-events-none aria-disabled:opacity-45",
  ],
  {
    variants: {
      variant: {
        /** The default action on a light surface. */
        primary:
          "bg-ink-950 text-paper shadow-[var(--shadow-raise)] hover:bg-ink-800 hover:shadow-[var(--shadow-float)]",
        /** The one loud button per screen. Reserved for the main conversion. */
        signal:
          "bg-signal text-ink-950 shadow-[var(--shadow-raise)] hover:brightness-[1.04] hover:shadow-[var(--shadow-float)]",
        outline:
          "border border-ink-200 bg-paper text-ink-900 hover:border-ink-300 hover:bg-white",
        ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-950",
        /** For dark product surfaces. */
        onDark: "bg-paper text-ink-950 hover:bg-white",
        onDarkGhost:
          "border border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10",
        /** Playful sticker treatment, used sparingly on social moments. */
        sticker:
          "border-2 border-ink-950 bg-signal text-ink-950 shadow-[var(--shadow-sticker-sm)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-sticker)] active:translate-x-px active:translate-y-px active:shadow-none",
        link: "h-auto p-0 text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900",
      },
      size: {
        sm: "h-9 rounded-full px-3.5 text-sm",
        md: "h-11 rounded-full px-5 text-[0.9375rem]",
        lg: "h-13 rounded-full px-6 text-base sm:h-14 sm:px-7 sm:text-[1.0625rem]",
        icon: "size-10 rounded-full",
      },
      block: { true: "w-full", false: "" },
    },
    compoundVariants: [{ variant: "link", size: ["sm", "md", "lg"], class: "h-auto rounded-none px-0" }],
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export type ButtonVariants = VariantProps<typeof buttonStyles>;

export function Button({
  className,
  variant,
  size,
  block,
  ...props
}: ComponentProps<"button"> & ButtonVariants) {
  return (
    <button
      type="button"
      className={cn(buttonStyles({ variant, size, block }), className)}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant,
  size,
  block,
  ...props
}: ComponentProps<typeof Link> & ButtonVariants) {
  return (
    <Link className={cn(buttonStyles({ variant, size, block }), className)} {...props} />
  );
}

export function ButtonAnchor({
  className,
  variant,
  size,
  block,
  ...props
}: ComponentProps<"a"> & ButtonVariants) {
  return <a className={cn(buttonStyles({ variant, size, block }), className)} {...props} />;
}
