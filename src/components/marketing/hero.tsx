import { ArrowRight, Globe2, PlayCircle } from "lucide-react";

import { HeroConsole } from "@/components/product/hero-console";
import { ButtonLink } from "@/components/ui/button";
import { Atmosphere } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { coverageStats } from "@/config/regions";
import { cities, cityStatusLabel } from "@/data/cities";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * HERO
 * ----------------------------------------------------------------------------
 * Product-first: the argument is made in four lines and then the actual working
 * console takes the stage, centred and full width, rather than being squeezed
 * into a right-hand column. A visitor can run a real query before they have
 * scrolled once.
 *
 * The ground is light. Depth comes from the drafting grid, two drifting colour
 * washes and grain — never from a dark slab, because the dark rectangle on this
 * page has one job and it is being the app.
 * ============================================================================
 */

/** Numbers that are true by construction: each one is derived, not typed. */
const PROOF = [
  { value: `${coverageStats.cities}`, label: "student cities" },
  { value: `${coverageStats.countries}`, label: "countries" },
  { value: `${coverageStats.currencies}`, label: "currencies priced natively" },
  { value: `${coverageStats.languages}`, label: "interface languages" },
] as const;

export function Hero() {
  const openingFirst = cities.filter((city) => city.status === "live");

  return (
    <section className="relative isolate overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
      <Atmosphere
        blobs={[
          {
            className: "-top-56 -left-40 size-[40rem] bg-signal/25 sm:size-[52rem]",
            drift: "a",
          },
          {
            className: "-top-64 right-[-18rem] size-[36rem] bg-flow/10 sm:size-[46rem]",
            drift: "b",
          },
        ]}
      />

      <div className="page relative">
        {/* ---- argument ---------------------------------------------------- */}
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal>
            <p className="relative inline-flex items-center gap-2.5 overflow-hidden rounded-full py-1.5 pr-4 pl-1.5 text-[0.8125rem] text-ink-700 glass">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-2.5 py-1 font-mono text-micro font-semibold tracking-[0.06em] text-signal uppercase">
                <Globe2 className="size-3" aria-hidden />
                Worldwide
              </span>
              <span>
                {cityStatusLabel["live"]} in{" "}
                {openingFirst.map((city) => city.name).join(" and ")}
              </span>
              {/* A single light pass, once every few seconds. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-linear-to-r from-transparent via-white/70 to-transparent animate-sheen"
              />
            </p>
          </Reveal>

          <Reveal delay={0.05}>
            {/* The marker lands on two words, not the whole phrase. A highlight
                across a full line wraps into stacked slabs at this size and
                stops reading as a marker at all — a short phrase kept on one
                line survives every breakpoint. */}
            <h1 className="mt-7 text-display-2xl text-ink-950">
              Your new city,{" "}
              <span className="relative inline-block whitespace-nowrap">
                <span
                  aria-hidden
                  className="absolute inset-x-[-0.1em] top-[0.14em] bottom-[0.06em] -z-10 -rotate-[0.7deg] rounded-[0.08em] bg-signal"
                />
                figured out
              </span>
              .
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-ink-600 text-balance sm:text-xl">
              Find cheap places, free events, student deals, people to meet and things to do —
              personalised around your location, your interests and what you can actually spend.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/get-started" variant="signal" size="lg" className="group">
                Get started free
                <ArrowRight
                  className="size-4.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </ButtonLink>
              <ButtonLink href="/#demo" variant="outline" size="lg" className="bg-white/70">
                <PlayCircle className="size-4.5" aria-hidden />
                Try {brand.name}
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-5 text-sm text-ink-400">
              Free to join. No card required. Works in any city on day one.
            </p>
          </Reveal>
        </div>

        {/* ---- the product ------------------------------------------------- */}
        <div className="relative mt-14 sm:mt-16">
          <Reveal kind="blur" delay={0.1}>
            <div className="relative mx-auto w-full max-w-[42rem]">
              <HeroConsole />

              {/* Two glass cards that break the console's edge. Decorative
                  framing on wide screens only — below `xl` they would collide
                  with the console, so they are simply not rendered.

                  They name what the console *always* does, never what the plan
                  currently on screen happens to say: the console is interactive,
                  so a card quoting a total would start contradicting it the
                  moment a visitor ran a different question. */}
              <FloatCard
                className="absolute top-24 -left-52 hidden w-56 xl:block"
                delay="0s"
                label="Budget aware"
                value="Fits the number"
                note="Every plan is built against what you can actually spend"
                accent="mint"
              />
              <FloatCard
                className="absolute -right-52 bottom-28 hidden w-56 xl:block"
                delay="1.4s"
                label="Sourced"
                value="Row by row"
                note="Each line says whether students or the city said it"
                accent="signal"
              />
            </div>
          </Reveal>
        </div>

        {/* ---- derived proof ----------------------------------------------- */}
        <Reveal delay={0.15}>
          <dl className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-xl bg-ink-200/70 sm:mt-16 sm:grid-cols-4">
            {PROOF.map((item) => (
              <div key={item.label} className="bg-paper/80 px-4 py-5 text-center backdrop-blur-sm">
                <dt className="sr-only">{item.label}</dt>
                <dd>
                  <span className="tnum block font-display text-2xl font-semibold tracking-[-0.02em] text-ink-950">
                    {item.value}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-ink-500">
                    {item.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Floating glass card                                                         */
/* -------------------------------------------------------------------------- */

function FloatCard({
  className,
  delay,
  label,
  value,
  note,
  accent,
}: {
  className?: string;
  /** Offsets the float loop so the two cards never bob in unison. */
  delay: string;
  label: string;
  value: string;
  note: string;
  accent: "mint" | "signal";
}) {
  return (
    <div
      aria-hidden
      className={cn("rounded-lg p-4 glass animate-float", className)}
      style={{ animationDelay: delay }}
    >
      <p className="flex items-center gap-2 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
        <span
          className={cn(
            "size-1.5 rounded-full",
            accent === "mint" ? "bg-mint" : "bg-signal-deep",
          )}
        />
        {label}
      </p>
      <p className="tnum mt-2 font-display text-xl font-semibold tracking-[-0.02em] text-ink-950">
        {value}
      </p>
      <p className="mt-1 text-xs leading-snug text-ink-500">{note}</p>
    </div>
  );
}
