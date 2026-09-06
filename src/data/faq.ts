import { brand } from "@/brand/brand.config";
import { mascot } from "@/brand/mascot.config";
import { coverageStats } from "@/config/regions";
import { STUDENT_VERIFIED_THRESHOLD } from "@/services/db/schema";

/**
 * ============================================================================
 * FAQ
 * ----------------------------------------------------------------------------
 * The questions a student actually has before signing up, answered in the same
 * voice as the rest of the site: short, specific, and willing to say no.
 *
 * Three rules this list is held to.
 * - Every answer that could be a number is a number, and the number is derived
 *   rather than typed, so nothing here can drift out of sync with the product.
 * - Where the honest answer is "not yet", it says not yet. A FAQ that only
 *   contains good news is marketing copy with a chevron on it.
 * - No question exists to set up a feature. If it is not asked in real life it
 *   is not here.
 * ============================================================================
 */

export type FaqItem = {
  q: string;
  a: string;
  /** Groups the list into columns and drives the section filter chips. */
  topic: "product" | "community" | "money" | "privacy" | "coverage";
};

export const faq: readonly FaqItem[] = [
  {
    topic: "product",
    q: `What is ${brand.name}?`,
    a: `One app for living in a city you just moved to. It combines what students in that city actually know with your location, your interests and your budget, then answers the practical questions: where to eat, what is on tonight, what you can afford, and who wants to come.`,
  },
  {
    topic: "product",
    q: "Is it only for international students?",
    a: `No. It is built hardest for the first months somewhere new, which is why exchange and international students get the most out of it, but nothing in the product requires you to be one. Plenty of it is just as useful in the city you grew up in.`,
  },
  {
    topic: "product",
    q: `Can I use ${brand.name} before I move?`,
    a: `Yes, and that is when Arrival Mode is most useful. You can read your future city's feed, see what things cost, build the first-week checklist and set a budget before you land.`,
  },
  {
    topic: "product",
    q: `How does ${brand.name} decide what to recommend?`,
    a: `Facts are retrieved first and keep their source: opening hours, fares and free windows come from official or venue listings, and prices come from students who reported them. The model's job is to choose, order and explain within your budget — never to invent a price or an opening time. Every row on a plan says where it came from.`,
  },
  {
    topic: "community",
    q: "How does The Loop work?",
    a: `It is a feed per city and per campus. Students post deals, events, warnings and questions, other students vote and correct them, and a place earns a verified badge only after ${STUDENT_VERIFIED_THRESHOLD} independent confirmations. The confirmation count is printed next to the badge, and below the threshold you see the count and no badge.`,
  },
  {
    topic: "community",
    q: "Can other students see where I am?",
    a: `No. Your exact location is never shown to anyone. It is used to answer your own questions — distance, what is nearby — and when you post an Anyone Down? plan, other students see the meeting place and time you chose, not you.`,
  },
  {
    topic: "community",
    q: "Do I have to know people to use it?",
    a: `No, and that is the point. Anyone Down? is open to your city rather than to a friend group, because in your first month you do not have one yet. Groups are temporary by default and close after the plan.`,
  },
  {
    topic: "money",
    q: `Is ${brand.name} free?`,
    a: `There is a real free tier, not a trial: all of The Loop, city chat, this week's events and deals, joining other people's plans, the core map layers and three AI plans a week. Paid tiers unlock depth — unlimited answers, every map layer and filter, the budget coach, forecasting, group planning and Survival Mode.`,
  },
  {
    topic: "money",
    q: `Does ${brand.name} need access to my bank?`,
    a: `No. Budgeting works entirely on numbers you enter or scan from a receipt, and it stays that way on every tier. Nothing in the product requires a bank connection.`,
  },
  {
    topic: "money",
    q: "Where do deals and events come from?",
    a: `Three places, always labelled: official venue and city listings, student unions and campus societies, and students posting what they found. A deal a student reported is shown as a student report until other students confirm it.`,
  },
  {
    topic: "privacy",
    q: "Do you sell my location or spending data?",
    a: `No. Location answers your question and is then done with. Budget data stays in your account, is not shared with venues, is not sold to advertisers, and is never attached to an error report.`,
  },
  {
    topic: "privacy",
    q: "Who can see my profile?",
    a: `You choose. The default is your first name, your campus and how many terms you have been in the city — enough for another student to judge whether your recommendation is worth trusting, and nothing more.`,
  },
  {
    topic: "coverage",
    q: "Which countries are supported?",
    a: `The planner, budget, map and Arrival Mode work in any city, and prices are shown in ${coverageStats.currencies} currencies across ${coverageStats.countries} countries. The Loop is different — a community only works once there are students in it, so it opens city by city and the site says plainly which ones are open.`,
  },
  {
    topic: "coverage",
    q: "My city is not on the list. Can I still use it?",
    a: `Yes, minus the community. You get the AI answers, the map, the budget and Arrival Mode from day one; the feed for your city stays marked as not open rather than being filled with content nobody posted.`,
  },
  {
    topic: "product",
    q: `Who is ${mascot.name}?`,
    a: `The ${mascot.species.toLowerCase()} you will see around the product. He is how ${brand.name} points at things worth knowing — a good find, a plan that fits, a night that costs nothing. He never makes a decision for you and he is never the only thing telling you something important.`,
  },
];

export const faqTopics: readonly { key: FaqItem["topic"]; label: string }[] = [
  { key: "product", label: "The product" },
  { key: "community", label: "Community" },
  { key: "money", label: "Money and pricing" },
  { key: "privacy", label: "Privacy" },
  { key: "coverage", label: "Where it works" },
];
