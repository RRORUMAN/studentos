import { AskSection } from "@/components/marketing/ask-section";
import { BudgetSection } from "@/components/marketing/budget-section";
import { CoverageTicker } from "@/components/marketing/coverage-ticker";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { GlobalCities } from "@/components/marketing/global-cities";
import { Hero } from "@/components/marketing/hero";
import { PlatformExplorer } from "@/components/marketing/platform-explorer";
import { PricingTable } from "@/components/marketing/pricing-table";
import { ProblemSection } from "@/components/marketing/problem-section";
import { PulseSection } from "@/components/marketing/pulse-section";
import { Testimonials } from "@/components/marketing/testimonials";
import { TodaySection } from "@/components/marketing/today-section";
import { TrustSection } from "@/components/marketing/trust-section";

/**
 * ============================================================================
 * LANDING PAGE
 * ----------------------------------------------------------------------------
 * Twelve sections, down from twenty-two. The order is a story, read top to
 * bottom:
 *
 *   the product running (hero) · where it works (ticker) · 01 the problem ·
 *   02 the screen you open every day · 03 how a question becomes an answer ·
 *   04 the people · 05 the money · 06 everything else, in one window ·
 *   07 is my city covered · 08 the rules behind every number · 09 price ·
 *   10 questions · the ask.
 *
 * Nine product surfaces that used to be nine full sections (events, Anyone
 * Down?, missions, Survival Mode, Work, Arrival, Speak Local, Exchange,
 * LifeOps) now live in the platform window as tabs, each still running its
 * real demo. Their old anchors (`/#events`, `/#missions`…) are the tab ids, so
 * nothing linking to them broke.
 *
 * ---------------------------------------------------------------------------
 * Ground rhythm. No two adjacent sections share a tone, and exactly two are
 * full-bleed dark: Ask, where the product is at its most impressive, and the
 * closing ask. Every other dark rectangle is the product inside a light
 * section, which keeps "dark means the app" a rule the eye can learn.
 *
 *   paper · white band · warm · paper · DARK · pulse · flow · paper(window) ·
 *   paper(cities, divided by the window's own frame) · warm · paper · warm ·
 *   [testimonials: renders nothing until a real quote exists] · DARK
 * ============================================================================
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <CoverageTicker />
      <ProblemSection />
      <TodaySection />
      <AskSection />
      <PulseSection />
      <BudgetSection />
      <PlatformExplorer />
      <GlobalCities />
      <TrustSection />
      <Testimonials />
      <PricingTable tone="paper" eyebrowIndex="09" />
      <FaqSection />
      <FinalCta />
    </>
  );
}
