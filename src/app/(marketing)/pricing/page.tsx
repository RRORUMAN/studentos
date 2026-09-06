import type { Metadata } from "next";

import { PageHero } from "@/components/layout/page-hero";
import { FinalCta } from "@/components/marketing/final-cta";
import { PricingTable } from "@/components/marketing/pricing-table";
import { brand } from "@/brand/brand.config";
import { annualSavingLabel } from "@/config/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: `The community is free permanently and unmetered. Paying unlocks the rest of the product: unlimited AI, the full map, budgeting and group planning — never access to other students. Annual billing is ${annualSavingLabel}.`,
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Pricing" }]}
        eyebrow="Pricing"
        title="The community is free. The depth is what you pay for."
        lead={`A network with a paywall in front of it is worthless, so ${brand.surfaces.loop}, city chat, events, deals and joining other people’s plans stay free permanently and unmetered. Paying unlocks the rest of the product: unlimited AI, every map layer, budgeting, forecasting and group planning.`}
      />
      <PricingTable showHeader={false} showFaq tone="warm" />
      <FinalCta />
    </>
  );
}
