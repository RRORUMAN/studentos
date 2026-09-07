import { Link2, MessagesSquare, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BrandMark } from "@/components/brand/logo";
import { MascotStill } from "@/components/mascot/mascot";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, SampleTag, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { getCity } from "@/data/cities";
import { landingSharePlan, shareTargets, sharePlanTotal } from "@/data/plans";
import { cn, money } from "@/lib/utils";

const TARGET_ICON: Record<string, LucideIcon> = {
  friends: UserRound,
  pulse: MessagesSquare,
  group: Users,
  link: Link2,
};

/**
 * ============================================================================
 * SHARE
 * ----------------------------------------------------------------------------
 * A plan is the product's unit of value and its distribution strategy at the
 * same time. So the object is built to leave: hard keyline, flat lime, one
 * enormous total, type that survives a screenshot on a cracked phone.
 *
 * Both buttons are links into onboarding. Nothing here copies to a clipboard
 * a visitor did not ask for, and nothing pretends to have shared anything.
 * ============================================================================
 */
export function ShareSection() {
  const plan = landingSharePlan;
  const city = getCity(plan.citySlug);
  const total = sharePlanTotal(plan);

  return (
    <Section id="share" tone="pulse">
      <div className="page">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* ---- the sticker ------------------------------------------------- */}
          <Reveal className="order-2 lg:order-1">
            <div className="mx-auto w-full max-w-[22rem] rotate-[-1.5deg] rounded-2xl bg-signal p-6 text-ink-950 sticker">
              <div className="flex items-center justify-between">
                <BrandMark className="size-5" />
                <span className="font-mono text-micro uppercase tracking-[0.14em] text-ink-950/60">
                  {city?.name ?? plan.citySlug}
                </span>
              </div>

              <h3 className="mt-6 font-display text-[2rem] leading-[0.95] font-semibold tracking-[-0.035em] uppercase">
                {plan.title}
              </h3>
              <p className="mt-3 text-[0.8125rem] leading-snug text-ink-950/65">{plan.subtitle}</p>

              <ul className="my-6 flex flex-col gap-2.5">
                {plan.items.map((item) => (
                  <li key={item.label} className="flex items-baseline gap-2 font-mono text-sm">
                    <span className="shrink-0 text-ink-950/80">{item.label}</span>
                    <span
                      aria-hidden
                      className="h-px min-w-4 flex-1 border-b border-dashed border-ink-950/30"
                    />
                    <span
                      className={cn(
                        "tnum shrink-0 font-medium",
                        item.price === 0 && "text-ink-950/55",
                      )}
                    >
                      {item.price === 0 ? "FREE" : money(item.price)}
                    </span>
                  </li>
                ))}
              </ul>

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

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-950/50">
                  {brand.domain}
                </span>
                <MascotStill state="celebrating" size="sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <SampleTag />
            </div>
          </Reveal>

          {/* ---- the argument ------------------------------------------------ */}
          <div className="order-1 lg:order-2">
            <Eyebrow index="16">Share</Eyebrow>
            <h2 className="mt-4 text-display-md text-ink-950">
              A good plan is worth sending.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-600 sm:text-lg">
              Every plan you build is one object with a total on it. Send it to a friend, post it
              to your campus feed, drop it in a group, or hand out a public link that anyone can
              open — no account needed to read it.
            </p>

            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {shareTargets.map((target) => {
                const Icon = TARGET_ICON[target.key] ?? Link2;
                return (
                  <li
                    key={target.key}
                    className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-flat)]"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-pulse-soft text-pulse-deep">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.875rem] font-medium text-ink-950">
                        {target.label}
                      </span>
                      <span className="block text-xs leading-snug text-ink-500">
                        {target.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/get-started?intent=plan" variant="sticker">
                Copy this plan
              </ButtonLink>
              <ButtonLink href="/get-started" variant="outline">
                Make my own
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
