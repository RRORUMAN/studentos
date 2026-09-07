import { AnyoneDown } from "@/components/marketing/anyone-down";
import { ArrivalSection } from "@/components/marketing/arrival-section";
import { AskSection } from "@/components/marketing/ask-section";
import { BudgetSection } from "@/components/marketing/budget-section";
import { EventRadar } from "@/components/marketing/event-radar";
import { ExchangeSection } from "@/components/marketing/exchange-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { GlobalCities } from "@/components/marketing/global-cities";
import { Hero } from "@/components/marketing/hero";
import { LifeOpsSection } from "@/components/marketing/lifeops-section";
import { MissionsSection } from "@/components/marketing/missions-section";
import { OneApp } from "@/components/marketing/one-app";
import { PricingTable } from "@/components/marketing/pricing-table";
import { PulseSection } from "@/components/marketing/pulse-section";
import { RightNow } from "@/components/marketing/right-now";
import { ShareSection } from "@/components/marketing/share-section";
import { WorkSection } from "@/components/marketing/work-section";
import { SurvivalMode } from "@/components/marketing/survival-mode";
import { Testimonials } from "@/components/marketing/testimonials";
import { TodaySection } from "@/components/marketing/today-section";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { WhyStudentOS } from "@/components/marketing/why-studentos";

/**
 * ============================================================================
 * LANDING PAGE
 * ----------------------------------------------------------------------------
 * The order is an argument, read top to bottom:
 *
 *   hand over the working product, name the problem it solves, show the screen
 *   you would open every day, show how a question becomes an answer, show the
 *   people it is built from, how you end up going with them, what is on, what
 *   you can afford, what happens when you can barely afford anything, what you
 *   have to remember, what to actually do with your week, how to arrive, how
 *   students supply each other, what is on right now, where it works, why it
 *   replaces eight apps, how a plan travels, what we will not do with your
 *   data — and only then price, questions, and the ask.
 *
 * Two deliberate choices.
 *
 * The demo is *in* the hero rather than below the fold: a visitor drives the
 * product before being asked to take a single claim on trust.
 *
 * Pricing sits near the end and the FAQ after it, because most of the
 * questions a student has are created by the price.
 *
 * ---------------------------------------------------------------------------
 * Ground rhythm. No two adjacent sections share a tone, and exactly two are
 * full-bleed dark: Ask, in the middle, where the product is at its most
 * impressive, and the closing CTA. Every other dark rectangle on the page is a
 * ProductPanel or an AppSurface inside a light section, which keeps "dark means
 * the product" a rule the eye can learn.
 *
 *   paper · warm · paper · DARK · pulse · paper · warm · flow · paper · warm ·
 *   tint · paper · warm · paper · flow · warm · pulse · warm · [testimonials:
 *   renders nothing until a real quote exists] · paper · warm · DARK
 * ============================================================================
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <WhyStudentOS />
      <TodaySection />
      <AskSection />
      <PulseSection />
      <AnyoneDown />
      <EventRadar />
      <BudgetSection />
      <SurvivalMode />
      <WorkSection />
      <LifeOpsSection />
      <MissionsSection />
      <ArrivalSection />
      <ExchangeSection />
      <RightNow />
      <GlobalCities />
      <OneApp />
      <ShareSection />
      <TrustStrip />
      <Testimonials />
      <PricingTable tone="paper" />
      <FaqSection />
      <FinalCta />
    </>
  );
}
