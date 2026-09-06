import type {
  MoneyGoal,
  PriceSensitivity,
  SocialGoal,
  StudentStatus,
  TransportMode,
} from "@/domain/types";
import type { HousingSituation } from "@/domain/lifecycle";

/**
 * ============================================================================
 * ONBOARDING
 * ----------------------------------------------------------------------------
 * Every question, every option, in one file.
 *
 * The target is two to four minutes, and the shape that gets there is: one
 * decision per screen, big tap targets, almost everything skippable, and no
 * free-text box the student has to compose a sentence into. A form that feels
 * like paperwork is abandoned around step four regardless of how good the
 * product behind it is.
 *
 * What each answer is actually FOR is written next to it. That is not
 * documentation for its own sake — a question whose answer changes nothing is
 * a question that should be deleted, and keeping the use next to the option
 * list is what makes that obvious at review time.
 * ============================================================================
 */

export type Choice<T extends string> = {
  value: T;
  label: string;
  /** Shown under the label. Keep to one short line or omit. */
  detail?: string;
  emoji?: string;
};

/* -------------------------------------------------------------------------- */
/* Step 1 — status                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Drives which lifecycle the student is in and therefore what Home leads with.
 * "Moving soon" is the highest-value answer in the whole flow: it is the only
 * one that unlocks the pre-arrival timeline.
 */
export const studentStatuses: readonly Choice<StudentStatus>[] = [
  { value: "international", label: "International student", detail: "Studying in a country that is not home.", emoji: "🌍" },
  { value: "exchange", label: "Exchange or Erasmus", detail: "Here for a semester or two.", emoji: "🔁" },
  { value: "studying-abroad", label: "Studying abroad", detail: "Full degree, away from home.", emoji: "🎓" },
  { value: "home-country", label: "Studying in my home country", detail: "Local, but new to the city.", emoji: "🏡" },
  { value: "moving-soon", label: "Moving soon", detail: "Not there yet. Getting set up.", emoji: "✈️" },
  { value: "other", label: "Something else", emoji: "✨" },
];

/* -------------------------------------------------------------------------- */
/* Step 4 — housing                                                            */
/* -------------------------------------------------------------------------- */

/** Decides which Arrival tasks matter and whether housing search is surfaced. */
export const housingSituations: readonly Choice<HousingSituation>[] = [
  { value: "sorted", label: "Sorted", detail: "I have somewhere for the whole stay." },
  { value: "university-halls", label: "University halls" },
  { value: "temporary", label: "Temporary for now", detail: "Hostel, sublet or a friend's sofa." },
  { value: "searching", label: "Still looking" },
  { value: "with-family", label: "With family" },
  { value: "unknown", label: "Not sure yet" },
];

/* -------------------------------------------------------------------------- */
/* Step 6 — money goals                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Multi-select. Changes which budget surfaces are promoted and the tone of the
 * insight line — a student who picked "just basic tracking" is never shown
 * coaching copy.
 */
export const moneyGoals: readonly Choice<MoneyGoal>[] = [
  { value: "stop-overspending", label: "Stop overspending", emoji: "🛑" },
  { value: "save-more", label: "Save more", emoji: "🏦" },
  { value: "track-spending", label: "See where it goes", emoji: "🔎" },
  { value: "cheaper-alternatives", label: "Find cheaper options", emoji: "🏷️" },
  { value: "plan-spending", label: "Plan ahead", emoji: "🗓️" },
  { value: "budget-weekly", label: "Budget weekly", emoji: "📅" },
  { value: "budget-monthly", label: "Budget monthly", emoji: "🗒️" },
  { value: "basic-tracking", label: "Just basic tracking", emoji: "✅" },
];

/* -------------------------------------------------------------------------- */
/* Step 7 — interests                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The single most load-bearing answer in onboarding: `scoreInterestFit` reads
 * these on every recommendation, and the values here are the same strings used
 * as place layers and event tags, so the join needs no translation table.
 *
 * Grouped for scanning. A flat wall of thirty chips is where students stop
 * reading and tap three at random.
 */
export const interestGroups: readonly {
  title: string;
  items: readonly Choice<string>[];
}[] = [
  {
    title: "Eating and drinking",
    items: [
      { value: "food", label: "Food", emoji: "🍽️" },
      { value: "cheap-food", label: "Cheap eats", emoji: "🍜" },
      { value: "coffee", label: "Coffee", emoji: "☕" },
      { value: "cooking", label: "Cooking", emoji: "🥘" },
    ],
  },
  {
    title: "Going out",
    items: [
      { value: "nightlife", label: "Nightlife", emoji: "🌃" },
      { value: "clubbing", label: "Clubbing", emoji: "🪩" },
      { value: "music", label: "Live music", emoji: "🎸" },
      { value: "concerts", label: "Concerts", emoji: "🎤" },
      { value: "festivals", label: "Festivals", emoji: "🎪" },
    ],
  },
  {
    title: "Sport and moving",
    items: [
      { value: "football", label: "Football", emoji: "⚽" },
      { value: "gym", label: "Gym", emoji: "🏋️" },
      { value: "running", label: "Running", emoji: "🏃" },
      { value: "cycling", label: "Cycling", emoji: "🚲" },
      { value: "fitness", label: "Fitness", emoji: "💪" },
      { value: "nature", label: "Outdoors", emoji: "🌲" },
    ],
  },
  {
    title: "Making things happen",
    items: [
      { value: "technology", label: "Technology", emoji: "💻" },
      { value: "startups", label: "Startups", emoji: "🚀" },
      { value: "business", label: "Business", emoji: "📈" },
      { value: "networking", label: "Networking", emoji: "🤝" },
      { value: "volunteering", label: "Volunteering", emoji: "🧤" },
    ],
  },
  {
    title: "Culture",
    items: [
      { value: "art", label: "Art", emoji: "🎨" },
      { value: "museums", label: "Museums", emoji: "🏛️" },
      { value: "cinema", label: "Cinema", emoji: "🎬" },
      { value: "photography", label: "Photography", emoji: "📷" },
      { value: "fashion", label: "Fashion", emoji: "🧥" },
      { value: "culture", label: "Local culture", emoji: "🧭" },
    ],
  },
  {
    title: "People and places",
    items: [
      { value: "travel", label: "Travel", emoji: "🚆" },
      { value: "language-exchange", label: "Language exchange", emoji: "💬" },
      { value: "study-groups", label: "Study groups", emoji: "📚" },
      { value: "gaming", label: "Gaming", emoji: "🎮" },
      { value: "dating-activities", label: "Date ideas", emoji: "🌹" },
    ],
  },
];

export const allInterests = interestGroups.flatMap((group) => group.items);

/** Below this, recommendations are too generic to feel personal. */
export const MIN_INTERESTS = 3;

/* -------------------------------------------------------------------------- */
/* Step 8 — social goals                                                       */
/* -------------------------------------------------------------------------- */

/**
 * "Mostly use privately" is deliberately a first-class option, not a
 * grudging opt-out. A meaningful share of students want the budget and the
 * discovery and none of the people, and a product that nags them about making
 * friends is a product they delete.
 */
export const socialGoals: readonly Choice<SocialGoal>[] = [
  { value: "meet-friends", label: "Meet new friends", emoji: "👋" },
  { value: "go-out", label: "People to go out with", emoji: "🌃" },
  { value: "sports", label: "Sport and teams", emoji: "⚽" },
  { value: "study-groups", label: "Study groups", emoji: "📚" },
  { value: "networking", label: "Networking", emoji: "🤝" },
  { value: "travel-buddies", label: "Travel buddies", emoji: "🚆" },
  { value: "language-exchange", label: "Language exchange", emoji: "💬" },
  { value: "campus-events", label: "Campus events", emoji: "🎓" },
  { value: "private", label: "Mostly use it privately", detail: "No social features on Home.", emoji: "🔒" },
];

/* -------------------------------------------------------------------------- */
/* Step 9 — food                                                               */
/* -------------------------------------------------------------------------- */

/** A hard filter in `recommendPlaces`, not a ranking nudge. */
export const diets: readonly Choice<string>[] = [
  { value: "no-preference", label: "No preference" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "dairy-free", label: "Dairy-free" },
];

/* -------------------------------------------------------------------------- */
/* Step 10 — transport                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Multi-select. Anyone with a mode other than walking gets their travel radius
 * multiplied in `recommendPlaces`, because "20 minutes" means something very
 * different on a bike.
 */
export const transportModes: readonly Choice<TransportMode>[] = [
  { value: "walk", label: "Walk", emoji: "🚶" },
  { value: "transit", label: "Public transport", emoji: "🚇" },
  { value: "bike", label: "Bike", emoji: "🚲" },
  { value: "scooter", label: "Scooter", emoji: "🛴" },
  { value: "car", label: "Car", emoji: "🚗" },
  { value: "taxi", label: "Taxi or rideshare", emoji: "🚕" },
];

export const travelLimits: readonly Choice<string>[] = [
  { value: "10", label: "10 minutes", detail: "Round the corner only." },
  { value: "20", label: "20 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "90", label: "Anywhere good", detail: "Distance is not the issue." },
];

/* -------------------------------------------------------------------------- */
/* Step 11 — price sensitivity                                                 */
/* -------------------------------------------------------------------------- */

/** Shifts the sweet spot in `scoreBudgetFit`. */
export const priceSensitivities: readonly Choice<PriceSensitivity>[] = [
  { value: "cheapest", label: "Cheapest possible", detail: "Price decides it.", emoji: "🪙" },
  { value: "value", label: "Good value", detail: "Cheap, but not grim.", emoji: "⚖️" },
  { value: "balanced", label: "Balanced", detail: "Price matters, quality more.", emoji: "🎯" },
  { value: "occasional-splurge", label: "Happy to spend sometimes", detail: "For the right thing.", emoji: "✨" },
];

/* -------------------------------------------------------------------------- */
/* Step 12 — notifications                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every topic starts OFF except budget warnings.
 *
 * That is a real product decision and it costs engagement: defaulting
 * everything on is the standard move and it is why nobody trusts app
 * notifications. Budget warnings are the exception because a student who set a
 * budget and then silently blew through it has been failed by the product.
 */
export const notificationTopics: readonly {
  value: string;
  label: string;
  detail: string;
  defaultOn: boolean;
}[] = [
  { value: "budget-warnings", label: "Budget warnings", detail: "Before a category runs out, not after.", defaultOn: true },
  { value: "free-events", label: "Free events", detail: "Matching your interests, nearby.", defaultOn: false },
  { value: "deals", label: "Deals", detail: "New student discounts near you.", defaultOn: false },
  { value: "friends-plans", label: "Friends and plans", detail: "Invites and who is joining.", defaultOn: false },
  { value: "campus", label: "Campus", detail: "Your university only.", defaultOn: false },
  { value: "plans", label: "Plans", detail: "Invites, votes and changes to plans you are on.", defaultOn: false },
  { value: "pulse", label: "Student Pulse", detail: "Worth-knowing posts from your city.", defaultOn: false },
  { value: "arrival", label: "Arrival", detail: "The next thing to sort, while you are settling in.", defaultOn: false },
  { value: "weekend-ideas", label: "Weekend ideas", detail: "One digest on Thursday.", defaultOn: false },
];

/* -------------------------------------------------------------------------- */
/* Budget setup                                                                */
/* -------------------------------------------------------------------------- */

/** The detailed-mode categories, in the order they are asked. */
export const budgetCategories: readonly { key: string; label: string; hint?: string }[] = [
  { key: "housing", label: "Housing", hint: "Rent and bills." },
  { key: "groceries", label: "Groceries" },
  { key: "eating-out", label: "Eating out" },
  { key: "nightlife", label: "Nightlife" },
  { key: "transport", label: "Transport" },
  { key: "shopping", label: "Shopping" },
  { key: "fitness", label: "Fitness" },
  { key: "entertainment", label: "Entertainment" },
  { key: "travel", label: "Travel" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "other", label: "Other" },
];

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The ordered flow. `optional` steps render a visible Skip, which is what keeps
 * the perceived length down: a student who skips four of these still lands on a
 * genuinely personalised Home.
 */
export const onboardingSteps = [
  { id: "status", title: "Where are you at?", subtitle: "So the first screen is the right one.", optional: false },
  { id: "city", title: "Which city?", subtitle: "Everything is built around this.", optional: false },
  { id: "university", title: "Where are you studying?", subtitle: "Unlocks your campus community.", optional: true },
  { id: "home", title: "Whereabouts are you staying?", subtitle: "Only used for distances. Never shown to anyone.", optional: true },
  { id: "budget", title: "What can you spend a month?", subtitle: "A rough number is fine.", optional: true },
  { id: "money-goals", title: "What should we help with?", subtitle: "Pick as many as apply.", optional: true },
  { id: "interests", title: "What are you into?", subtitle: "This is what makes recommendations yours.", optional: false },
  { id: "social", title: "What would make this useful socially?", subtitle: "Or keep it entirely private.", optional: true },
  { id: "food", title: "Anything you do not eat?", subtitle: "Filters food recommendations properly.", optional: true },
  { id: "transport", title: "How do you get around?", subtitle: "Sets how far is too far.", optional: true },
  { id: "price", title: "How do you pick places?", subtitle: "Tunes what gets recommended.", optional: true },
  { id: "notifications", title: "What is worth interrupting you for?", subtitle: "Change any of this later.", optional: true },
] as const;

export type OnboardingStepId = (typeof onboardingSteps)[number]["id"];
