"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

import { revealBlur, revealUp, stagger, staticVariants, viewport } from "@/lib/motion";

type RevealProps = {
  children: ReactNode;
  /** `up` travels, `blur` also defocuses. Use `blur` once per page at most. */
  kind?: "up" | "blur";
  delay?: number;
  className?: string;
} & Omit<ComponentProps<typeof motion.div>, "children" | "variants" | "initial" | "whileInView">;

/**
 * Scroll reveal. Under `prefers-reduced-motion` the element is simply present:
 * no travel, no fade, no delay — the content must never be gated behind an
 * animation that has been switched off.
 */
export function Reveal({ children, kind = "up", delay = 0, className, ...props }: RevealProps) {
  const reduced = useReducedMotion();
  const variants: Variants = reduced ? staticVariants : kind === "blur" ? revealBlur : revealUp;

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="shown"
      viewport={viewport}
      transition={reduced ? { duration: 0 } : { delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Container that releases its children one after another. Children must be
 * `RevealItem`s (or any motion element using the hidden/shown state names).
 */
export function RevealGroup({
  children,
  step = 0.06,
  delay = 0,
  className,
  ...props
}: {
  children: ReactNode;
  step?: number;
  delay?: number;
  className?: string;
} & Omit<ComponentProps<typeof motion.div>, "children" | "variants">) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={reduced ? staticVariants : stagger(step, delay)}
      initial="hidden"
      whileInView="shown"
      viewport={viewport}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & Omit<
  ComponentProps<typeof motion.div>,
  "children" | "variants"
>) {
  const reduced = useReducedMotion();
  return (
    <motion.div className={className} variants={reduced ? staticVariants : revealUp} {...props}>
      {children}
    </motion.div>
  );
}
