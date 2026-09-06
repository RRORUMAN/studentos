"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { useState } from "react";

import { DoodleCoin } from "@/components/brand/doodles";
import { Mascot } from "@/components/mascot/mascot";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { accents } from "@/components/ui/accent";
import { Atmosphere, Eyebrow, SampleTag, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { Sticker } from "@/components/viral/sticker";
import { useToast } from "@/components/ui/toast";
import { brand } from "@/brand/brand.config";
import { mascot } from "@/brand/mascot.config";
import { defaultCity } from "@/data/cities";
import { survivalDefaults, survivalHorizons, survivalPlan, survivalRange } from "@/data/survival";
import { useCopy } from "@/hooks/use-copy";
import { duration, ease } from "@/lib/motion";
import { cn, money } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * ============================================================================
 * SURVIVAL MODE
 * ----------------------------------------------------------------------------
 * The section that should get screenshotted.
 *
 * Every other money feature on this page answers "how am I doing?". This one
 * answers the question students actually type at 23:00 on a Tuesday: I have
 * this much, it has to last until then, what do I do. Nothing else in the
 * category answers it, which is why it gets its own section rather than a
 * bullet inside Budget.
 *
 * The allocator is real (see data/survival.ts) and the rows always sum to the
 * number on the slider, so a visitor can drag it to €14 and watch the plan
 * refuse to pretend — which is the part that earns trust with a budget
 * attached.
 * ============================================================================
 */
export function SurvivalMode() {
  const reduced = useReducedMotion();
  const toast = useToast();
  const { copy, copied } = useCopy();

  const [amount, setAmount] = useState<number>(survivalDefaults.amount);
  const [days, setDays] = useState<number>(survivalDefaults.days);

  const city = defaultCity;
  const where = { currency: city.currency.code };
  const plan = survivalPlan(amount, days, city);
  const horizon = survivalHorizons.find((entry) => entry.days === days);

  const shareText = [
    `${money(amount, where)} until ${horizon?.phrase ?? `${days} days`}`,
    ...plan.rows
      .filter((row) => row.amount > 0 || row.key === "free")
      .map((row) => `${row.label}: ${row.amount === 0 ? "free" : money(row.amount, where)}`),
    `Made with ${brand.name} ${brand.url}`,
  ].join("\n");

  return (
    <Section id="survival" tone="warm" className="overflow-hidden">
      <Atmosphere
        grid={false}
        blobs={[
          { className: "-top-48 left-[-12rem] size-[34rem] bg-pulse/12", drift: "a" },
          { className: "bottom-[-22rem] right-[-14rem] size-[32rem] bg-signal/20", drift: "b" },
        ]}
      />

      <div className="page relative">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-14">
          {/* ---- the pitch ------------------------------------------------- */}
          <div className="lg:sticky lg:top-24">
            <Reveal>
              <Eyebrow index="08">Survival Mode</Eyebrow>
              <h2 className="mt-4 text-display-md text-ink-950">
                {money(amount, where)} until {horizon?.phrase ?? "Friday"}?
                <br />
                <span className="text-ink-400">Let&rsquo;s make it work.</span>
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-600">
                Budgeting apps explain a month that already happened. This is the question students
                actually have on a Tuesday night — and the plan changes as the number does.
              </p>
            </Reveal>

            {/* ---- controls ------------------------------------------------ */}
            <Reveal delay={0.05}>
              <div className="mt-8 rounded-2xl p-6 glass">
                <label htmlFor="survival-amount" className="sr-only">
                  Money you have left, in {city.currency.code}
                </label>
                <p className="font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
                  I have
                </p>
                <p className="tnum mt-1 font-display text-display-lg text-ink-950">
                  {money(amount, where)}
                </p>
                <input
                  id="survival-amount"
                  type="range"
                  min={survivalRange.min}
                  max={survivalRange.max}
                  step={survivalRange.step}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  onPointerUp={() => track("survival_amount_changed", { amount, days })}
                  className={cn(
                    "mt-4 h-1.5 w-full cursor-grab appearance-none rounded-full bg-ink-200 active:cursor-grabbing",
                    "[&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
                    "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink-950 [&::-webkit-slider-thumb]:bg-signal",
                    "[&::-webkit-slider-thumb]:shadow-[var(--shadow-raise)] [&::-webkit-slider-thumb]:transition-transform",
                    "[&::-webkit-slider-thumb]:hover:scale-110",
                    "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2",
                    "[&::-moz-range-thumb]:border-ink-950 [&::-moz-range-thumb]:bg-signal",
                  )}
                />
                <div className="mt-2 flex justify-between font-mono text-micro text-ink-400">
                  <span className="tnum">{money(survivalRange.min, where)}</span>
                  <span className="tnum">{money(survivalRange.max, where)}</span>
                </div>

                <p className="mt-6 font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
                  Until
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {survivalHorizons.map((entry) => (
                    <button
                      key={entry.days}
                      type="button"
                      aria-pressed={entry.days === days}
                      onClick={() => {
                        setDays(entry.days);
                        track("survival_horizon_changed", { days: entry.days });
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium",
                        "transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97]",
                        entry.days === days
                          ? "border-transparent bg-ink-950 text-paper"
                          : "border-ink-200 bg-white/70 text-ink-600 hover:border-ink-300 hover:text-ink-950",
                      )}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          {/* ---- the plan --------------------------------------------------- */}
          <Reveal kind="blur" delay={0.05} className="min-w-0">
            <div className="relative">
              {/* The mascot reacts to the number rather than decorating the
                  card: determined when it works, warning when it does not. */}
              <div className="mb-4 flex items-center gap-3">
                <Mascot state={plan.tight ? "warning" : "determined"} size="md" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={plan.tight ? "tight" : "fine"}
                    initial={reduced ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : duration.quick, ease: ease.out }}
                    className="rounded-2xl bg-white px-3.5 py-2 text-[0.9375rem] font-medium text-ink-800 shadow-[var(--shadow-float)] ring-1 ring-ink-950/6"
                  >
                    {plan.tight
                      ? "That is thin. Here is the honest version."
                      : "Alright. Game plan."}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="overflow-hidden rounded-2xl border border-ink-200 bg-paper">
                <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 bg-white/70 px-5 py-4">
                  <DoodleCoin className="size-5 text-signal-deep" />
                  <p className="text-[0.9375rem] font-semibold text-ink-950">
                    {plan.days === 1 ? "Today" : `${plan.days} days`} in {city.name}
                  </p>
                  <SampleTag className="ml-auto" />
                </div>

                <ul className="divide-y divide-ink-100">
                  {plan.rows.map((row) => {
                    const accent = accents[row.accent];
                    return (
                      <li key={row.key} className="flex items-start gap-4 px-5 py-4">
                        <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", accent.fill)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.9375rem] font-medium text-ink-950">{row.label}</p>
                          <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-500">
                            {row.detail}
                          </p>
                        </div>
                        <motion.span
                          key={`${row.key}-${row.amount}`}
                          initial={reduced ? false : { opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: reduced ? 0 : duration.quick }}
                          className={cn(
                            "tnum shrink-0 font-mono text-[0.9375rem] font-medium",
                            row.amount === 0 ? "text-mint-deep" : "text-ink-950",
                          )}
                        >
                          {row.amount === 0 ? "FREE" : money(row.amount, where)}
                        </motion.span>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex items-center justify-between border-t-2 border-ink-950 px-5 py-4">
                  <span className="font-mono text-micro uppercase tracking-[0.14em] text-ink-500">
                    Food per day
                  </span>
                  <span className="tnum font-mono text-2xl font-semibold text-ink-950">
                    {money(plan.perDay, where)}
                  </span>
                </div>
              </div>

              {/* ---- what it buys ------------------------------------------ */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Sticker tone={plan.tight ? "amber" : "mint"} size="sm">
                  {plan.tight ? "Tight week" : "Budget survives"}
                </Sticker>
                <Sticker tone="signal" size="sm" rotate={-1.5}>
                  {money(plan.buffer, where)} held back
                </Sticker>
                <span className="text-sm text-ink-500">
                  Things to do stays at zero on purpose. {city.name} has enough free.
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Button
                  variant="sticker"
                  onClick={async () => {
                    const ok = await copy(shareText);
                    track("survival_plan_copied", { amount, days });
                    toast({
                      title: ok ? "Plan copied" : "Could not copy",
                      description: ok
                        ? "Paste it straight into a group chat."
                        : "Your browser blocked clipboard access.",
                      tone: ok ? "success" : "warning",
                    });
                  }}
                >
                  {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  {copied ? "Copied" : "Copy this plan"}
                </Button>
                <ButtonLink
                  href="/get-started"
                  variant="outline"
                  className="group"
                  onClick={() => track("cta_clicked", { location: "survival" })}
                >
                  Build my survival plan
                  <ArrowRight
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </ButtonLink>
              </div>

              <p className="mt-4 max-w-xl text-[0.8125rem] leading-relaxed text-ink-400">
                Survival Mode is a {brand.name} Plus feature. {mascot.name} works the numbers from
                what {city.name} students report a shop and a student menu actually cost — it is
                arithmetic you can check, not a guess.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
