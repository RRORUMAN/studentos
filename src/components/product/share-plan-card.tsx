"use client";

import { motion, useReducedMotion } from "motion/react";
import { Bookmark, Check, Copy } from "lucide-react";

import { BrandMark } from "@/components/brand/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { brand } from "@/brand/brand.config";
import { getCity } from "@/data/cities";
import { sharePlanTotal, type SharePlan } from "@/data/plans";
import { useCopy } from "@/hooks/use-copy";
import { ease } from "@/lib/motion";
import { cn, count, money } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * SHAREABLE PLAN
 * ----------------------------------------------------------------------------
 * Built for the two places a plan actually travels: an Instagram story and a
 * WhatsApp group. That means a 9:16 frame, one loud number, and type that
 * survives being screenshotted on a cracked phone.
 *
 * Lime on ink rather than ink on white — a screenshot of this is recognisable
 * from across a room, which is the entire distribution strategy.
 * ============================================================================
 */
export function SharePlanCard({
  plan,
  className,
}: {
  plan: SharePlan;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const city = getCity(plan.citySlug);
  const total = sharePlanTotal(plan);

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 18, rotate: -1.2 }}
      whileInView={{ opacity: 1, y: 0, rotate: -1.2 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={reduced ? { duration: 0 } : { duration: 0.6, ease: ease.out }}
      className={cn(
        "relative flex aspect-9/16 w-full max-w-[20rem] flex-col justify-between",
        "rounded-2xl bg-signal p-6 text-ink-950",
        "shadow-[var(--shadow-lift)] ring-1 ring-ink-950/10",
        className,
      )}
    >
      <div>
        <div className="flex items-center justify-between">
          <BrandMark className="size-5 text-ink-950" />
          <span className="font-mono text-micro uppercase tracking-[0.14em] text-ink-950/55">
            {city?.name ?? plan.citySlug}
          </span>
        </div>

        <h3 className="mt-6 font-display text-[2rem] leading-[0.95] font-semibold tracking-[-0.035em] uppercase">
          {plan.title}
        </h3>
        <p className="mt-3 text-[0.8125rem] leading-snug text-ink-950/65">{plan.subtitle}</p>
      </div>

      <ul className="my-6 flex flex-col gap-2.5">
        {plan.items.map((item) => (
          <li key={item.label} className="flex items-baseline gap-2 font-mono text-sm">
            <span className="shrink-0 text-ink-950/80">{item.label}</span>
            <span aria-hidden className="h-px min-w-4 flex-1 border-b border-dashed border-ink-950/30" />
            <span className={cn("tnum shrink-0 font-medium", item.price === 0 && "text-ink-950/55")}>
              {item.price === 0 ? "FREE" : money(item.price)}
            </span>
          </li>
        ))}
      </ul>

      <div>
        <div className="border-t-2 border-ink-950 pt-3">
          <div className="flex items-end justify-between">
            <span className="font-mono text-micro uppercase tracking-[0.14em] text-ink-950/60">
              Total
            </span>
            <span className="tnum font-mono text-[2.5rem] leading-none font-semibold">
              {money(total)}
            </span>
          </div>
        </div>
        <p className="mt-3 flex items-center justify-between font-mono text-micro uppercase tracking-[0.1em] text-ink-950/50">
          <span>{brand.domain}</span>
          <span className="tnum">saved by {count(plan.savedBy)}</span>
        </p>
      </div>
    </motion.article>
  );
}

/** The actions that sit under a share card. Kept separate so the card itself
 *  stays a clean rectangle for screenshots. */
export function SharePlanActions({ plan, onDark = false }: { plan: SharePlan; onDark?: boolean }) {
  const toast = useToast();
  const { copy, copied } = useCopy();
  const city = getCity(plan.citySlug);
  const total = sharePlanTotal(plan);

  const text = [
    `${plan.title}`,
    ...plan.items.map((item) => `${item.label}: ${item.price === 0 ? "free" : money(item.price)}`),
    `Total: ${money(total)}`,
    `${city?.name ?? ""} · made with ${brand.name} ${brand.url}`,
  ].join("\n");

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={onDark ? "onDark" : "primary"}
        size="md"
        onClick={async () => {
          const ok = await copy(text);
          track("plan_copied", { planId: plan.id });
          toast({
            title: ok ? "Plan copied" : "Could not copy",
            description: ok ? "Paste it straight into a group chat." : "Your browser blocked it.",
            tone: ok ? "success" : "warning",
          });
        }}
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? "Copied" : "Copy this plan"}
      </Button>
      <ButtonLink
        href="/get-started"
        variant={onDark ? "onDarkGhost" : "outline"}
        size="md"
        onClick={() => track("cta_clicked", { location: "share-plan", planId: plan.id })}
      >
        <Bookmark className="size-4" aria-hidden />
        Make my own
      </ButtonLink>
    </div>
  );
}
