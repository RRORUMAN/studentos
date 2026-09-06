"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { collapsedApps } from "@/data/brain";
import { ease, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Even ring, slightly wider than tall so it reads as a landscape cluster.
 * Offsets are unit vectors; they are multiplied by the measured stage size at
 * render time, which is what lets every tile converge on the exact centre.
 */
const RING = collapsedApps.map((app, index) => {
  const angle = (index / collapsedApps.length) * Math.PI * 2 - Math.PI / 2;
  return { ...app, ux: Math.cos(angle) * 0.37, uy: Math.sin(angle) * 0.36 };
});

/** Measures an element, so ring offsets can be expressed in pixels. */
function useStageSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

/**
 * Ten apps become one. The animation is the argument, so it is replayable —
 * a visitor who scrolled past it can watch it again on demand.
 *
 * Under reduced motion the same idea is stated as a static diagram rather than
 * being lost.
 */
export function OneApp() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stage = useStageSize(stageRef);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!inView || reduced) return;
    const timer = window.setTimeout(() => setCollapsed(true), 900);
    return () => window.clearTimeout(timer);
  }, [inView, reduced]);

  return (
    <Section id="product" tone="paper">
      <div className="page">
        <Reveal>
          <Eyebrow index="11">One app instead of ten</Eyebrow>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-2xl text-display-md text-ink-950">
              Right now this is ten apps, four group chats and a note on your phone.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-ink-600">
              None of them know your budget, none of them know your city yet, and none of them can
              tell you who else is free on Saturday.
            </p>
          </div>
        </Reveal>

        <div ref={ref} className="relative mt-12">
          {reduced ? (
            <StaticDiagram />
          ) : (
            <>
              <div
                ref={stageRef}
                className="relative mx-auto aspect-4/3 w-full max-w-3xl sm:aspect-16/9"
              >
                {RING.map((app, index) => (
                  <div
                    key={app.label}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    <motion.div
                      initial={false}
                      animate={
                        collapsed
                          ? { x: 0, y: 0, scale: 0.25, opacity: 0 }
                          : {
                              x: app.ux * stage.width,
                              y: app.uy * stage.height,
                              scale: 1,
                              opacity: 1,
                            }
                      }
                      transition={{
                        duration: 0.7,
                        delay: collapsed ? index * 0.045 : index * 0.03,
                        ease: ease.inOut,
                      }}
                    >
                      <div className="flex w-20 flex-col items-center gap-1.5 sm:w-24">
                        <span className="grid size-11 place-items-center rounded-lg border border-ink-200 bg-white text-lg shadow-[var(--shadow-raise)] sm:size-14 sm:text-xl">
                          <span aria-hidden>{app.emoji}</span>
                        </span>
                        <span className="text-center text-[0.6875rem] leading-tight text-ink-500">
                          {app.label}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                ))}

                {/* the survivor */}
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  initial={false}
                  animate={collapsed ? { scale: 1, opacity: 1 } : { scale: 0.72, opacity: 0.25 }}
                  transition={collapsed ? { ...spring.bouncy, delay: 0.45 } : { duration: 0.3 }}
                >
                  <div className="flex flex-col items-center gap-3">
                    <span
                      className={cn(
                        "relative grid size-20 place-items-center rounded-2xl bg-ink-950 text-signal sm:size-24",
                        "shadow-[var(--shadow-lift)]",
                      )}
                    >
                      <BrandMark className="size-9 sm:size-11" />
                      {collapsed ? (
                        <motion.span
                          aria-hidden
                          className="absolute inset-0 rounded-2xl ring-2 ring-signal"
                          initial={{ opacity: 0.9, scale: 1 }}
                          animate={{ opacity: 0, scale: 1.35 }}
                          transition={{ duration: 0.9, delay: 0.5, ease: ease.out }}
                        />
                      ) : null}
                    </span>
                    <span className="font-display text-lg font-semibold tracking-[-0.02em] text-ink-950">
                      {brand.name}
                    </span>
                  </div>
                </motion.div>
              </div>

              <div className="mt-2 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCollapsed(false);
                    window.setTimeout(() => setCollapsed(true), 500);
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Play again
                </Button>
              </div>
            </>
          )}
        </div>

        <Reveal>
          <p className="mx-auto mt-8 max-w-xl text-center text-base leading-relaxed text-ink-600">
            One place that knows where you are, what you have left this month, what students near
            you have found, and who is free tonight.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

/** Reduced-motion equivalent: the same claim, stated rather than performed. */
function StaticDiagram() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
      <ul className="flex flex-wrap justify-center gap-2">
        {collapsedApps.map((app) => (
          <li
            key={app.label}
            className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-600"
          >
            <span aria-hidden>{app.emoji}</span>
            {app.label}
          </li>
        ))}
      </ul>
      <span className="font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
        collapse into
      </span>
      <div className="flex flex-col items-center gap-3">
        <span className="grid size-20 place-items-center rounded-2xl bg-ink-950 text-signal shadow-[var(--shadow-lift)]">
          <BrandMark className="size-9" />
        </span>
        <span className="font-display text-lg font-semibold tracking-[-0.02em] text-ink-950">
          {brand.name}
        </span>
      </div>
    </div>
  );
}
