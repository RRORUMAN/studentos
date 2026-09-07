import type { Metadata } from "next";

import { PageHero } from "@/components/layout/page-hero";
import { FinalCta } from "@/components/marketing/final-cta";
import { PricingTable } from "@/components/marketing/pricing-table";
import { brand } from "@/brand/brand.config";
import { quotas } from "@/config/entitlements";
import { annualSavingLabel } from "@/config/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${brand.surfaces.pulse}, events, ${brand.surfaces.anyoneDown}, ${brand.surfaces.arrival}, LifeOps, missions and a real budget are free permanently. Paying adds intelligence over the same data: unlimited asks, the budget coach, Survival Mode, forecasting and group plans. Annual billing is ${annualSavingLabel}.`,
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Pricing" }]}
        eyebrow="Pricing"
        title="Free is genuinely free. Paying buys depth."
        lead={`A network with a paywall in front of it is worthless, so ${brand.surfaces.pulse}, chat, events, deals, ${brand.surfaces.anyoneDown}, ${brand.surfaces.arrival}, LifeOps, Smart Missions and the basic budget stay free permanently — including ${quotas.free.aiAsksPerWeek} smart asks a week. Paying adds intelligence over the same data, never access to other students.`}
      />
      <PricingTable showHeader={false} showFaq tone="warm" />
      <FinalCta />
    </>
  );
}
