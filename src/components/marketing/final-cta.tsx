import { ArrowRight, Check } from "lucide-react";

import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { defaultCurrency, localeFor, plans } from "@/config/pricing";
import { coverageStats } from "@/config/regions";
import { money } from "@/lib/utils";

/**
 * The one loud moment on the page.
 *
 * Everything above this is warm paper and hairlines, which is exactly what
 * earns a full field of signal green here: after ten quiet sections the eye has
 * nothing to compare it to, so the close lands. Used twice it would land nowhere.
 */
export function FinalCta() {
  const cheapestPaid = Math.min(
    ...plans.filter((plan) => plan.monthly > 0).map((plan) => plan.monthly),
  );
  const where = { currency: defaultCurrency, locale: localeFor(defaultCurrency) };

  const assurances = [
    "Free tier, not a trial",
    "No card to start",
    `Works in ${coverageStats.countries} countries`,
  ];

  return (
    <section className="relative isolate overflow-hidden bg-signal py-20 text-ink-950 sm:py-28">
      {/* Two decorative layers, both very low contrast: a dot field that keeps
          the flat green from looking like a colour swatch, and grain over it so
          the edge between them never bands on a wide gradient-poor display. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-ink-950/25 dotfield [mask-image:radial-gradient(75%_65%_at_50%_45%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.13] mix-blend-multiply grain"
      />

      <div className="page relative">
        <Reveal className="flex flex-col items-center text-center">
          {/* The close is the one place he is the focal point rather than a
              detail. He has been in the margins for twelve sections; putting
              him centre stage, packed and ready, is what makes the ending feel
              like a character saying goodbye rather than a form. */}
          <MascotArt state="excited" accessory="backpack" className="size-28 sm:size-32" />

          <h2 className="mt-6 max-w-3xl text-display-lg text-balance">
            Your new city is easier when you know where to look.
          </h2>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-950/70">
            Discover more, spend smarter and meet the people around you. Your first month somewhere
            new only happens once — spend it doing things instead of working out what they cost.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/get-started" variant="primary" size="lg" className="group">
              Build my {brand.name}
              <ArrowRight
                className="size-4.5 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </ButtonLink>
            <ButtonLink
              href="/#demo"
              size="lg"
              className="border-2 border-ink-950 bg-transparent text-ink-950 shadow-none hover:bg-ink-950/8"
            >
              Explore the product
            </ButtonLink>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {assurances.map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-sm text-ink-950/70">
                <Check className="size-4 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm text-ink-950/55">
            Paid tiers start at {money(cheapestPaid, where)} a month, in your own currency.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
