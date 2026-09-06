/**
 * ============================================================================
 * PRICING
 * ----------------------------------------------------------------------------
 * The model, stated once so every surface argues the same way:
 *
 *   FREE   makes a student love the product and build the habit. Roughly 60%
 *          of the daily-use product: the whole community, discovery, events,
 *          deals, the basic budget, basic Arrival Mode, and enough AI to prove
 *          it works. Not a trial. It does not expire.
 *
 *   PLUS   "Save more. Get smarter recommendations." The first jump in
 *          intelligence: the budget coach, receipts, Survival Mode, the weekly
 *          planner, catch-up, price intelligence, smart collections.
 *
 *   PRO    "Let StudentOS run more of your student life." The recommended
 *          tier: everything you do with other people, and the future —
 *          forecasting, group plans and voting, shared budgets, the trip and
 *          weekend planner, advanced matching.
 *
 *   MAX    "Everything, everywhere." Power users and travellers: many cities,
 *          many currencies, the deepest forecasting, the highest AI limits.
 *
 * What is deliberately NOT gated, at any price: reading and posting in Student
 * Pulse, chat, seeing events and deals, joining and hosting plans, friends,
 * basic groups. Charging for access to other students would kill the network
 * that makes every paid feature work.
 *
 * Names, prices and Stripe price ids all live here. Nothing else in the code
 * knows what a tier costs or is called.
 * ============================================================================
 */

export type BillingPeriod = "monthly" | "annual";

/**
 * Display currencies. List prices per currency, not FX conversions — a student
 * in the US is shown a price chosen for that market that ends in a round
 * number. Other currencies are billed in euro and the exact local amount is
 * shown at checkout, which the UI says out loud.
 */
export type PriceCurrency = "EUR" | "GBP" | "USD";

export const priceCurrencies: readonly { code: PriceCurrency; locale: string; label: string }[] = [
  { code: "EUR", locale: "en-IE", label: "Euro" },
  { code: "GBP", locale: "en-GB", label: "British pound" },
  { code: "USD", locale: "en-US", label: "US dollar" },
];

export const defaultCurrency: PriceCurrency = "EUR";

export function localeFor(currency: PriceCurrency): string {
  return priceCurrencies.find((entry) => entry.code === currency)?.locale ?? "en-IE";
}

/** Two months free. Change once, every price and badge follows. */
export const annualDiscount = 2 / 12;

export type PlanKey = "free" | "plus" | "pro" | "max";

export type Plan = {
  key: PlanKey;
  name: string;
  /** Monthly list price in euro. Annual is derived, never hand-typed. */
  monthly: number;
  /** Per-currency list price. `EUR` must equal `monthly`. */
  monthlyBy: Record<PriceCurrency, number>;
  /** Outcome-driven headline. What the tier does for the student. */
  headline: string;
  tagline: string;
  /** Short line under the price, sets expectations before the feature list. */
  meta: string;
  /** The one thing this tier unlocks that the tier below does not. */
  unlocks: string;
  features: readonly string[];
  cta: string;
  recommended?: boolean;
  /** Populated per environment; empty on the marketing build. */
  stripePriceIds: { monthly: string | null; annual: string | null };
};

export const plans: readonly Plan[] = [
  {
    key: "free",
    name: "Free",
    monthly: 0,
    monthlyBy: { EUR: 0, GBP: 0, USD: 0 },
    headline: "Get started",
    tagline: "The community, the city, the basic budget. Enough to make it a habit.",
    meta: "No card. Not a trial. Does not expire.",
    unlocks: "Everything students post, permanently free",
    features: [
      "Student Pulse, city and campus feeds, chat, polls, friends",
      "Anyone Down? — join and host plans",
      "Events, student deals, Under €10, the core map",
      "Monthly budget, categories, recurring costs, Safe Today",
      "Arrival Mode checklist and your first-week plan",
      "8 smart asks a week: what is free, cheap food, can I afford this",
      "10 saved places and events",
    ],
    cta: "Start free",
    stripePriceIds: { monthly: null, annual: null },
  },
  {
    key: "plus",
    name: "Plus",
    monthly: 7.99,
    monthlyBy: { EUR: 7.99, GBP: 6.99, USD: 8.99 },
    headline: "Save more",
    tagline: "StudentOS starts actively saving you money and time.",
    meta: "The first real jump in intelligence.",
    unlocks: "The budget coach, Survival Mode and the weekly planner",
    features: [
      "Everything in Free",
      "200 smart asks a week, with the deeper planning model",
      "AI Budget Coach, receipt scanning, custom categories, smart alerts",
      "Survival Mode: a plan for the money you have left",
      "Weekly planner built from your budget and what is on",
      "Cheaper-alternative swaps with the saving attached",
      "Price intelligence: what students here actually pay",
      "Pulse catch-up, smart collections, AI Arrival Plan",
      "Unlimited saved places",
    ],
    cta: "Choose Plus",
    stripePriceIds: { monthly: null, annual: null },
  },
  {
    key: "pro",
    name: "Pro",
    monthly: 9.99,
    monthlyBy: { EUR: 9.99, GBP: 8.99, USD: 10.99 },
    headline: "Run your student life",
    tagline: "Everything you plan with other people, and where the month is heading.",
    meta: "Best value. Two euro more than Plus, most of the product more.",
    unlocks: "Forecasting, group plans with voting, shared budgets",
    features: [
      "Everything in Plus",
      "500 smart asks a week and the Advanced City Brain",
      "Month-end forecast and predictive budget insights",
      "Group plans: invites, voting, shared budgets and splits",
      "Weekend and trip planner",
      "Friend-aware recommendations and advanced matching",
      "Collaborative collections and shared plans",
      "Personalised Right Now and event intelligence",
      "Saved searches with alerts, offline city pack",
    ],
    cta: "Choose Pro",
    recommended: true,
    stripePriceIds: { monthly: null, annual: null },
  },
  {
    key: "max",
    name: "Max",
    monthly: 14.99,
    monthlyBy: { EUR: 14.99, GBP: 12.99, USD: 15.99 },
    headline: "Everything, everywhere",
    tagline: "For students who move between cities and want the deepest view.",
    meta: "Built for exchange years and constant travel.",
    unlocks: "Many cities, many currencies, the highest AI limits",
    features: [
      "Everything in Pro",
      "Unlimited cities side by side, with separate budgets",
      "Multi-currency money view for a year abroad",
      "Relocation between cities and Leaving Mode intelligence",
      "Long-term history, scenarios and year-ahead planning",
      "Spend compared with students in your own city",
      "Highest AI limits and the fastest responses",
      "Export everything you have saved and spent",
      "Early access to new features",
      "Partner benefits, only where they genuinely exist",
    ],
    cta: "Choose Max",
    stripePriceIds: { monthly: null, annual: null },
  },
] as const;

export function planByKey(key: PlanKey): Plan {
  return plans.find((plan) => plan.key === key) ?? plans[0];
}

/**
 * Monthly-equivalent price for a plan, on a billing period, in a currency.
 * The pricing table and the checkout quote both call this; nothing computes a
 * price a second way.
 */
export function priceFor(plan: Plan, period: BillingPeriod, currency: PriceCurrency = defaultCurrency): number {
  const list = plan.monthlyBy[currency];
  if (list === 0) return 0;
  if (period === "monthly") return list;
  return Math.round(list * (1 - annualDiscount) * 100) / 100;
}

/** What the student is actually charged when they pick annual. */
export function billedTotal(plan: Plan, period: BillingPeriod, currency: PriceCurrency = defaultCurrency): number | null {
  if (plan.monthlyBy[currency] === 0 || period === "monthly") return null;
  return Math.round(priceFor(plan, "annual", currency) * 12 * 100) / 100;
}

/** Cash saved over a year by paying annually. Zero for the free tier. */
export function annualSaving(plan: Plan, currency: PriceCurrency = defaultCurrency): number {
  const list = plan.monthlyBy[currency];
  if (list === 0) return 0;
  return Math.round((list * 12 - (billedTotal(plan, "annual", currency) ?? 0)) * 100) / 100;
}

export const annualSavingLabel = `${Math.round(annualDiscount * 12)} months free`;

/** Questions students actually ask before paying. */
export const pricingFaq = [
  {
    q: "What do I actually get for free?",
    a: "All of Student Pulse — every city and campus feed, chat, votes and polls — plus events and deals, joining and hosting plans, the core map, the basic budget with Safe Today, Arrival Mode, ten saved places and eight smart asks a week. It is not a trial and it does not expire.",
  },
  {
    q: "So what am I paying for?",
    a: "Intelligence over the same data. Plus makes the product save you money: the budget coach, receipts, Survival Mode, the weekly planner, cheaper swaps. Pro runs more of your life: forecasting, group plans with voting, shared budgets, the trip planner. Max works everywhere: many cities, many currencies, the deepest view.",
  },
  {
    q: "Why is the community free if the rest is not?",
    a: "Because the community is what makes the paid features work. A price on other students would shrink the network the recommendations are built from, and then nobody would want the paid tier either.",
  },
  {
    q: "What is the difference between Plus and Pro?",
    a: "Plus is you and your money. Pro is you, your people and the future: month-end forecasting, group plans your friends vote on, shared budgets and splits, the weekend and trip planner, friend-aware recommendations. It is two euro more and most students who plan with others pick it.",
  },
  {
    q: "Can I cancel or switch tier?",
    a: "Any time, from settings. Switching takes effect immediately and the remaining balance is prorated. Downgrading keeps everything you saved — it just stops being editable past the free limits.",
  },
  {
    q: "Do you sell my location or spending data?",
    a: "No. Location is used to answer your question and is not sold or shared with advertisers. Budget data stays in your account and is never attached to an error report.",
  },
  {
    q: "Is there a student discount?",
    a: "The whole product is priced for students, so there is no separate discount to stack. Annual billing is the cheapest option and saves two months.",
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Comparison matrix                                                           */
/* -------------------------------------------------------------------------- */

export type MatrixValue = boolean | string;

export type MatrixRow = {
  label: string;
  hint?: string;
  values: Record<PlanKey, MatrixValue>;
};

export type MatrixGroup = { title: string; rows: readonly MatrixRow[] };

const all = { free: true, plus: true, pro: true, max: true } as const;

export const featureMatrix: readonly MatrixGroup[] = [
  {
    title: "Community — free on every tier",
    rows: [
      { label: "Student Pulse, city and campus feeds", hint: "Never rate limited, on any tier.", values: all },
      { label: "Chat, replies, reactions, polls", values: all },
      { label: "Friends and basic groups", values: all },
      { label: "Anyone Down? — join and host", values: all },
      { label: "Pulse catch-up", hint: "Five things worth knowing from what you missed.", values: { free: false, plus: true, pro: true, max: true } },
      { label: "Advanced matching and event intelligence", values: { free: false, plus: false, pro: true, max: true } },
    ],
  },
  {
    title: "Asking your city",
    rows: [
      { label: "Smart asks a week", hint: "What is free, cheap food, can I afford this, a plan.", values: { free: "8", plus: "200", pro: "500", max: "1,500" } },
      { label: "Deeper planning model", values: { free: false, plus: true, pro: true, max: true } },
      { label: "Advanced City Brain", hint: "Neighbourhood, season and your own history as context.", values: { free: false, plus: false, pro: true, max: true } },
      { label: "Recommendations that learn from what you pick", values: { free: false, plus: true, pro: true, max: true } },
    ],
  },
  {
    title: "Finding places",
    rows: [
      { label: "Map and core layers", hint: "Free covers For you, food, free and events.", values: { free: "Core", plus: "All", pro: "All", max: "All" } },
      { label: "Combined filters and student-verified only", values: { free: false, plus: true, pro: true, max: true } },
      { label: "Saved places", values: { free: "10", plus: "Unlimited", pro: "Unlimited", max: "Unlimited" } },
      { label: "Smart collections", values: { free: false, plus: true, pro: true, max: true } },
      { label: "Collaborative collections", values: { free: false, plus: false, pro: true, max: true } },
      { label: "Price intelligence", hint: "What students here actually pay for lunch, a pint, a week of food.", values: { free: false, plus: true, pro: true, max: true } },
    ],
  },
  {
    title: "Money",
    rows: [
      { label: "Budget, categories, recurring, Safe Today", values: all },
      { label: "Can I afford this?", values: { free: "Basic", plus: "With alternatives", pro: "With forecast", max: "With forecast" } },
      { label: "AI Budget Coach and receipt scanning", values: { free: false, plus: true, pro: true, max: true } },
      { label: "Survival Mode", values: { free: false, plus: true, pro: true, max: true } },
      { label: "Month-end forecast and scenarios", values: { free: false, plus: false, pro: true, max: true } },
      { label: "Shared budgets and group expenses", values: { free: false, plus: false, pro: true, max: true } },
      { label: "Multi-currency and long-term history", values: { free: false, plus: false, pro: false, max: true } },
    ],
  },
  {
    title: "Planning and moving",
    rows: [
      { label: "Arrival Mode and first-week plan", values: all },
      { label: "AI Arrival Plan", values: { free: false, plus: true, pro: true, max: true } },
      { label: "Weekly planner", values: { free: false, plus: true, pro: true, max: true } },
      { label: "Group plans with voting and shared budgets", values: { free: false, plus: false, pro: true, max: true } },
      { label: "Weekend and trip planner", values: { free: false, plus: false, pro: true, max: true } },
      { label: "Cities at once", values: { free: "1", plus: "1", pro: "2", max: "Unlimited" } },
      { label: "Relocation and Leaving Mode intelligence", values: { free: false, plus: false, pro: false, max: true } },
      { label: "Export everything", values: { free: false, plus: false, pro: false, max: true } },
    ],
  },
];

/** Footnote for the asterisk above. Printed under the table, never omitted. */
export const fairUseNote =
  "*Unlimited means no monthly cap under normal student use. A soft ceiling exists to stop automated abuse; it is far above what a person can reach and you are told before you hit it, never after.";

/** Reassurances that belong next to a price, not buried in a FAQ. */
export const pricingAssurances = [
  { label: "No card to start", detail: "The free tier is not a trial." },
  { label: "Cancel any time", detail: "From settings, prorated immediately." },
  { label: "Student pricing already applied", detail: "There is no discount code to hunt for." },
  { label: "Your data is not the product", detail: "Location and spending are never sold." },
] as const;
