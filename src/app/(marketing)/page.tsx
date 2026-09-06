import { AnyoneDown } from "@/components/marketing/anyone-down";
import { ArrivalSection } from "@/components/marketing/arrival-section";
import { AskYourCity } from "@/components/marketing/ask-your-city";
import { BudgetSection } from "@/components/marketing/budget-section";
import { CityBrain } from "@/components/marketing/city-brain";
import { DiscoverSection } from "@/components/marketing/discover-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { LiveDemo } from "@/components/marketing/live-demo";
import { MovingAbroad } from "@/components/marketing/moving-abroad";
import { OneApp } from "@/components/marketing/one-app";
import { PricingTable } from "@/components/marketing/pricing-table";
import { LoopSection } from "@/components/marketing/loop-section";
import { ShareablePlans } from "@/components/marketing/shareable-plans";
import { Standards } from "@/components/marketing/standards";
import { SurvivalMode } from "@/components/marketing/survival-mode";
import { Testimonials } from "@/components/marketing/testimonials";
import { Worldwide } from "@/components/marketing/worldwide";

/**
 * ============================================================================
 * LANDING PAGE
 * ----------------------------------------------------------------------------
 * Section order is an argument, read top to bottom:
 *
 *   name the feeling, hand over the working product, show how a question turns
 *   into an answer, show the machine that builds it, show the community it is
 *   built from, who you go with, what you can afford, what happens when you
 *   can afford almost nothing, where things are, how to arrive, why it
 *   replaces ten apps, what we refuse to do, who has used it, that it works
 *   wherever you are going, how it spreads, what it costs, the awkward
 *   questions — and only then, the ask.
 *
 * Two deliberate choices in that list.
 *
 * The problem section is first and the demo is second: a visitor is shown
 * themselves, then handed the product to drive, before being asked to take a
 * single claim on trust.
 *
 * Pricing sits near the end and the FAQ sits *after* it, because the questions
 * a student has are mostly created by the price, and answering them on the
 * page is cheaper than answering them in support.
 *
 * ---------------------------------------------------------------------------
 * Ground rhythm. No two adjacent sections share a tone, and none of them is
 * dark: the rule the whole site follows is that dark is the product and light
 * is the page, so the only dark rectangles a visitor meets are `AppSurface`
 * consoles. The one loud field on the page is the closing CTA.
 *
 *   warm · paper · tint · paper · pulse · paper · flow · warm · paper · warm ·
 *   paper · warm · tint · flow · warm · paper · warm · signal
 * ============================================================================
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <MovingAbroad />
      <LiveDemo />
      <AskYourCity />
      <CityBrain />
      <LoopSection />
      <AnyoneDown />
      <BudgetSection />
      <SurvivalMode />
      <DiscoverSection />
      <ArrivalSection />
      <OneApp />
      <Standards />
      <Testimonials />
      <Worldwide />
      <ShareablePlans />
      <PricingTable tone="paper" />
      <FaqSection />
      <FinalCta />
    </>
  );
}
