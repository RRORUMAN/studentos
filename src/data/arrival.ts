import type { ArrivalTask } from "./types";

/**
 * ARRIVAL MODE
 * ----------------------------------------------------------------------------
 * The first-two-weeks list. In the product this is generated per city from the
 * city record plus official sources; here the Madrid variant is seeded and the
 * generic variant is the fallback.
 *
 * Anything touching immigration, residency or tax is flagged `legal: true`.
 * Those rows always render the official source link and the disclaimer below —
 * the product must never be the authority on a legal requirement.
 */

export const legalDisclaimer =
  "Official requirements change and depend on your nationality, course and length of stay. We link the primary source and never present this as legal advice.";

export const arrivalTasksByCity: Record<string, readonly ArrivalTask[]> = {
  madrid: [
    {
      id: "transport",
      label: "Transport card",
      detail:
        "Get the Abono Joven if you are under 26. It is a flat monthly fee for the whole region, so single tickets stop making sense immediately.",
      effort: "20 min online, card arrives by post",
      cost: "≈€20 a month",
      source: { label: "Consorcio Regional de Transportes", url: "https://www.crtm.es/" },
    },
    {
      id: "sim",
      label: "SIM card",
      detail:
        "A prepaid Spanish SIM works on day one and needs only your passport. Switch to a contract later once you have a bank account.",
      effort: "15 min in any phone shop",
      cost: "€8–€15 a month",
    },
    {
      id: "banking",
      label: "Banking",
      detail:
        "An EU digital account covers you for weeks one and two. Open a local account once you have a registration certificate if your landlord or university needs one.",
      effort: "10 min in an app, longer in a branch",
      legal: true,
      source: {
        label: "Your bank's proof-of-address requirements",
        url: "https://europa.eu/youreurope/citizens/consumers/financial-products-and-services/bank-accounts-eu/index_en.htm",
      },
    },
    {
      id: "registration",
      label: "Registration and residency",
      detail:
        "EU students usually register locally; non-EU students follow the process attached to their visa. Both depend on your nationality and course length.",
      effort: "Appointment based, book early",
      legal: true,
      source: {
        label: "Spanish Ministry of Foreign Affairs",
        url: "https://www.exteriores.gob.es/en/Paginas/index.aspx",
      },
    },
    {
      id: "discounts",
      label: "Student discounts",
      detail:
        "Your university card, a national youth card and a museum pass cover most of what you will actually use. The rest are marketing.",
      effort: "30 min once",
    },
    {
      id: "supermarket",
      label: "Find your cheap supermarket",
      detail:
        "Work out which supermarket is nearest and which market is cheapest. This single decision moves your weekly spend by €10 to €15.",
      effort: "One walk around your neighbourhood",
      cost: "Saves ≈€50 a month",
    },
    {
      id: "gym",
      label: "Gym or sport",
      detail:
        "Municipal sports centres have under-26 rates well below private gyms. University clubs are cheaper again and come with people.",
      effort: "Sign up in person",
      cost: "€15–€25 a month",
    },
    {
      id: "community",
      label: "Join your university community",
      detail:
        "Find your campus feed and two societies. This is the step that decides whether the year is social or lonely, and it is free.",
      effort: "10 min",
    },
    {
      id: "first-event",
      label: "Go to one thing in week one",
      detail:
        "Anything free with other new students. The first event is the hardest and the only one that matters.",
      effort: "One evening",
    },
  ],
};

/** Cities without a seeded list fall back to the generic version. */
export const genericArrivalTasks: readonly ArrivalTask[] = arrivalTasksByCity.madrid;

export function arrivalTasksFor(citySlug: string): readonly ArrivalTask[] {
  return arrivalTasksByCity[citySlug] ?? genericArrivalTasks;
}

/* -------------------------------------------------------------------------- */
/* Arrival stages: the landing page view of Arrival Mode                       */
/* -------------------------------------------------------------------------- */

export type ArrivalStageKey = "before" | "first-day" | "first-week" | "first-month";

export type ArrivalStageTask = {
  label: string;
  detail: string;
  /** The row links to an official source in the product. */
  official?: boolean;
  cost?: string;
  kind:
    | "transport"
    | "sim"
    | "supermarket"
    | "university"
    | "gym"
    | "community"
    | "budget"
    | "social"
    | "bank"
    | "registration"
    | "travel";
};

export type ArrivalStage = {
  key: ArrivalStageKey;
  label: string;
  tagline: string;
  tasks: readonly ArrivalStageTask[];
};

/**
 * Sample tasks per stage. In the product the list is generated per city from
 * the city record and official sources; the shape is the same.
 */
export const arrivalStages: readonly ArrivalStage[] = [
  {
    key: "before",
    label: "Before arrival",
    tagline: "The things that are cheaper or faster from home.",
    tasks: [
      { kind: "budget", label: "Set a budget that matches the city", detail: "Rent, transport, a realistic food number. In the local currency." },
      { kind: "registration", label: "Book the registration appointment", detail: "Slots go weeks ahead in most cities. Official link attached.", official: true },
      { kind: "transport", label: "Order the transport card if it ships", detail: "Some cities post it. Others need you in person.", official: true },
      { kind: "community", label: "Read your future city's feed", detail: "What students are asking this month is what you will be asking next month." },
    ],
  },
  {
    key: "first-day",
    label: "First day",
    tagline: "Four things, then sleep.",
    tasks: [
      { kind: "sim", label: "Local SIM", detail: "Prepaid works on day one and needs only your passport.", cost: "€8 to €15 a month" },
      { kind: "transport", label: "Transport card or semester ticket", detail: "Check what your university already includes before buying anything.", official: true },
      { kind: "supermarket", label: "Find the cheap supermarket", detail: "One walk around the neighbourhood. This decision moves your weekly spend by €10 to €15." },
      { kind: "university", label: "Walk to campus once, unhurried", detail: "So the first real day is not the first time." },
    ],
  },
  {
    key: "first-week",
    label: "First week",
    tagline: "Set up, then show up.",
    tasks: [
      { kind: "university", label: "University card and library", detail: "The card gets you the canteen price, the gym rate and the study rooms." },
      { kind: "bank", label: "Bank account or EU digital account", detail: "A digital account covers weeks one and two. Official requirements linked.", official: true },
      { kind: "community", label: "Join your campus feed and two societies", detail: "The step that decides whether the year is social or lonely. Free." },
      { kind: "social", label: "Go to one free thing", detail: "Anything with other new students. The first one is the hardest and the only one that matters." },
    ],
  },
  {
    key: "first-month",
    label: "First month",
    tagline: "A routine, a budget that holds, a group.",
    tasks: [
      { kind: "gym", label: "Gym or sport", detail: "Municipal centres and university clubs are well under private gyms.", cost: "€15 to €25 a month" },
      { kind: "budget", label: "Check what is charging you monthly", detail: "Subscriptions surface from your own history." },
      { kind: "social", label: "Join something that repeats", detail: "A weekly game or a language exchange beats ten one-off events." },
      { kind: "travel", label: "Plan one weekend away", detail: "A separate envelope for it, so it does not wreck the month." },
    ],
  },
];
