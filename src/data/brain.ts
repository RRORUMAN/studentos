import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Building2,
  Heart,
  MapPin,
  MessagesSquare,
  Users,
} from "lucide-react";

/**
 * AI CITY BRAIN
 * ----------------------------------------------------------------------------
 * The section explains a mechanism, not a miracle. Each input names what it
 * actually is, where it comes from, and what it changes about the answer.
 * Factual claims (opening hours, fares, prices published by a venue) are
 * attributed to a source; taste claims are attributed to students.
 */

export type BrainInput = {
  key: string;
  label: string;
  /** What this input actually contains. */
  detail: string;
  /** Where it comes from. Rendered verbatim in the UI. */
  provenance: string;
  /** What the answer loses without it — used by the interactive diagram. */
  withoutIt: string;
  icon: LucideIcon;
  accent: "pulse" | "flow" | "mint" | "amber" | "signal";
};

export const brainInputs: readonly BrainInput[] = [
  {
    key: "students",
    label: "Student knowledge",
    detail: "Posts, replies, confirmations and corrections from students living in your city right now.",
    provenance: "Written by students, weighted by how many independently confirm it",
    withoutIt: "You get places that are open, not places that are worth going to.",
    icon: MessagesSquare,
    accent: "pulse",
  },
  {
    key: "local",
    label: "Local data",
    detail: "Opening hours, transport fares, free museum windows, official event listings.",
    provenance: "Public and official sources, refreshed and timestamped",
    withoutIt: "Recommendations drift out of date and free windows get missed.",
    icon: Building2,
    accent: "flow",
  },
  {
    key: "budget",
    label: "Your budget",
    detail: "What you have left this month and what you have already committed.",
    provenance: "Your account only. Never shared, never sold",
    withoutIt: "You get suggestions you cannot afford, which is most apps.",
    icon: Banknote,
    accent: "flow",
  },
  {
    key: "location",
    label: "Your location",
    detail: "Where you are now, so distance is measured in minutes rather than kilometres.",
    provenance: "Used to answer the question you asked, then discarded",
    withoutIt: "Everything looks equally close, and nothing is.",
    icon: MapPin,
    accent: "mint",
  },
  {
    key: "preferences",
    label: "Your preferences",
    detail: "Diet, what you keep saving, what you quietly never open.",
    provenance: "Learned from your own activity in the app",
    withoutIt: "The same five popular places, for everyone, forever.",
    icon: Heart,
    accent: "amber",
  },
  {
    key: "friends",
    label: "Your friends",
    detail: "Who is free, who is nearby, and what they have already said yes to.",
    provenance: "Only people you have connected with, only what they chose to share",
    withoutIt: "You get a plan. You do not get anyone to do it with.",
    icon: Users,
    accent: "pulse",
  },
] as const;

export type BrainOutput = {
  key: string;
  question: string;
  answer: string;
  /** Which inputs the answer leans on most. */
  uses: readonly string[];
  attribution: string;
};

export const brainOutputs: readonly BrainOutput[] = [
  {
    key: "groceries",
    question: "Best cheap groceries for you",
    answer:
      "Split the shop: fruit and veg at the Lavapiés market, basics at the discount supermarket in Chamberí. About €38 for the week instead of €50.",
    uses: ["students", "budget", "location"],
    attribution: "Price gap reported by 29 students this term",
  },
  {
    key: "free-tonight",
    question: "What's free tonight",
    answer:
      "Reina Sofía is free from 19:00, and the rooftop opening in Malasaña has no door fee before 22:00. Both are inside 20 minutes of you.",
    uses: ["local", "location", "students"],
    attribution: "Museum hours from official listings, door policy from the venue",
  },
  {
    key: "recommend",
    question: "Where students actually recommend going",
    answer:
      "The ramen counter in Malasaña, for the €8.50 student bowl that is not on the menu. Forty-one students have confirmed it.",
    uses: ["students", "preferences"],
    attribution: "41 independent student confirmations",
  },
  {
    key: "afford",
    question: "What you can afford",
    answer:
      "You have €67 left for going out this month and €18.40 that is safe today. A €16 night keeps both intact.",
    uses: ["budget"],
    attribution: "Your own budget, nothing else",
  },
  {
    key: "join",
    question: "Who wants to join",
    answer:
      "Three people from your campus have this rooftop saved, and a five-a-side game at Retiro on Saturday is two players short.",
    uses: ["friends", "students", "location"],
    attribution: "People who opted in to being found",
  },
] as const;

/**
 * ASK YOUR CITY
 * The comparison is between the shape of the question, not between brands.
 */
export const searchComparison = {
  traditional: {
    label: "Traditional search",
    query: "Restaurants near me",
    results: [
      { name: "Result 1", meta: "Sponsored · 4.5 ★ · €€", note: "No price. No walk. No idea if students go." },
      { name: "Result 2", meta: "4.4 ★ · €€€", note: "Reviewed mostly by people visiting for four days." },
      { name: "Result 3", meta: "4.6 ★ · €€", note: "Closed on the night you asked." },
    ],
    verdict: "You still have to open three tabs and guess.",
  },
  studentos: {
    label: "StudentOS",
    query:
      "Cheap dinner under €12, vegetarian, somewhere students actually like, within 15 minutes.",
    answer: {
      lead: "Three that fit. The first one is what students keep coming back to.",
      results: [
        {
          name: "Ramen counter, Malasaña",
          price: "€8.50",
          walk: "9 min",
          note: "Veg broth version on request. The €8.50 bowl is the student portion.",
          proof: "41 students confirmed",
        },
        {
          name: "Menú del día, Moncloa",
          price: "€5",
          walk: "4 min",
          note: "Vegetarian first and second course on Tuesdays and Thursdays.",
          proof: "17 students confirmed",
        },
        {
          name: "Falafel counter, Lavapiés",
          price: "€6.50",
          walk: "13 min",
          note: "Open until 01:00, which most of this list is not.",
          proof: "23 students confirmed",
        },
      ],
      footnote: "Prices from student reports this term. Opening hours from the venues.",
    },
  },
} as const;

/**
 * ONE APP INSTEAD OF TEN
 * The apps a student actually juggles in their first month abroad, described
 * generically rather than by brand.
 */
export const collapsedApps: readonly { label: string; emoji: string }[] = [
  { label: "Maps", emoji: "🗺️" },
  { label: "Events", emoji: "🎟️" },
  { label: "Deals", emoji: "🏷️" },
  { label: "Budget", emoji: "📊" },
  { label: "Group chats", emoji: "💬" },
  { label: "Recommendations", emoji: "⭐" },
  { label: "Student forums", emoji: "🧵" },
  { label: "Local guides", emoji: "📖" },
  { label: "Transport apps", emoji: "🚇" },
  { label: "Notes to self", emoji: "📝" },
] as const;
