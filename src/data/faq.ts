import { brand } from "@/brand/brand.config";
import { mascot } from "@/brand/mascot.config";
import { quotas } from "@/config/entitlements";
import { annualSavingLabel, planByKey } from "@/config/pricing";
import { coverageStats } from "@/config/regions";
import { cities } from "@/data/cities";

/**
 * ============================================================================
 * FAQ
 * ----------------------------------------------------------------------------
 * The questions a student has before signing up, answered in the same voice as
 * the rest of the site: short, specific, willing to say no.
 *
 * Every number is derived from config, never typed, so nothing here can drift
 * from the pricing table or the coverage list.
 * ============================================================================
 */

export type FaqItem = {
  q: string;
  a: string;
  topic: "product" | "money" | "privacy" | "coverage";
};

const plus = planByKey("plus");
const pro = planByKey("pro");
const max = planByKey("max");
const eur = (amount: number) => `€${amount.toFixed(2)}`;

const deepCityNames = cities.map((city) => city.name);
const deepCityList =
  deepCityNames.length > 1
    ? `${deepCityNames.slice(0, -1).join(", ")} and ${deepCityNames[deepCityNames.length - 1]}`
    : (deepCityNames[0] ?? "");

export const faq: readonly FaqItem[] = [
  {
    topic: "money",
    q: "What does it cost?",
    a: `Free is free: not a trial, no card, and it does not expire. ${plus.name} is ${eur(plus.monthly)} a month, ${pro.name} is ${eur(pro.monthly)} and ${max.name} is ${eur(max.monthly)}. Paying annually gives you ${annualSavingLabel}. Prices are set per currency, not converted at checkout.`,
  },
  {
    topic: "money",
    q: "What do I actually get for free?",
    a: `${brand.surfaces.pulse}, chat, events and deals, Discover, ${brand.surfaces.anyoneDown}, ${brand.surfaces.arrival}, LifeOps, Smart Missions, the basic budget with Safe today, ${quotas.free.savedItems} saved places and ${quotas.free.aiAsksPerWeek} smart asks a week. Paying buys depth on top of that: more asks, the budget coach, Survival Mode, forecasting and group plans.`,
  },
  {
    topic: "privacy",
    q: "Is my location private?",
    a: `Yes. Your exact location answers your own question and is never shown to anyone. When you post a plan, other students see the meeting place and time you chose, not you. ${brand.name} does not sell location or spending data to anyone.`,
  },
  {
    topic: "coverage",
    q: "Does it work in my city?",
    a: `Ask, Budget, LifeOps, Missions and ${brand.surfaces.arrival} work in any of the ${coverageStats.cities} cities across ${coverageStats.countries} countries, in ${coverageStats.currencies} currencies, from official data on day one. The student layer is deepest in ${deepCityList}. Every other city says on this page, in one word, how far along it is.`,
  },
  {
    topic: "product",
    q: "Is the data on this page real?",
    a: `No, and it says so. Everything on this page is sample data rendered through the product's own components, each panel marked as sample. Inside ${brand.name}, every row comes from somewhere you can see: student reports, official listings or the venue, and the source is printed next to it. Nothing is invented to fill a card.`,
  },
  {
    topic: "product",
    q: "Can I use it before I arrive?",
    a: `That is when ${brand.surfaces.arrival} is most useful. Set your city and start date, and the before-arrival list, a budget in the local currency and your future city's feed are ready before you land.`,
  },
  {
    topic: "money",
    q: "Can I cancel?",
    a: "Any time, from settings. Switching tier takes effect immediately and the remaining balance is prorated. Downgrading keeps everything you saved.",
  },
  {
    topic: "product",
    q: "Do I have to know people already?",
    a: `No. ${brand.surfaces.anyoneDown} turns a plan into a group that is open to your city, because in your first month you do not have a friend group yet. Groups are temporary by default and close after the plan.`,
  },
  {
    topic: "money",
    q: "Does it need access to my bank?",
    a: "No. Budgeting runs on numbers you enter or receipts you scan, on every tier. Nothing in the product requires a bank connection.",
  },
  {
    topic: "product",
    q: `Who is ${mascot.name}?`,
    a: `The ${mascot.species.toLowerCase()} in the glasses. He is how ${brand.name} points at things worth knowing: a good find, a plan that fits, a night that costs nothing. He never decides for you and is never the only thing telling you something important.`,
  },
];

export const faqTopics: readonly { key: FaqItem["topic"]; label: string }[] = [
  { key: "product", label: "The product" },
  { key: "money", label: "Money and pricing" },
  { key: "privacy", label: "Privacy" },
  { key: "coverage", label: "Where it works" },
];
