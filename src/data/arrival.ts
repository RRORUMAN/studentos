import { resolveCity } from "@/data/cities";
import type { ArrivalTask, CityContext } from "./types";

/**
 * ARRIVAL MODE
 * ----------------------------------------------------------------------------
 * The first-two-weeks list.
 *
 * TWO TIERS. `arrivalTasksByCity` holds a list somebody wrote for one specific
 * city, with that city's card names, that city's prices and that city's
 * authorities. `genericTasks` below builds the list for every other city out of
 * what is true everywhere plus whatever the city record actually carries. The
 * seam matters: see the long comment above `genericTasks` for what happened
 * when the fallback was simply an alias for Madrid's list.
 *
 * Anything touching immigration, residency or tax is flagged `legal: true` and
 * renders the disclaimer below. It renders an official source link where we
 * hold a checked source for that country — and where we do not it links
 * nothing, because a link to the wrong country's ministry is worse than no
 * link at all. The product must never be the authority on a legal requirement,
 * and must never appear to be one for a country it knows nothing about.
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

/* -------------------------------------------------------------------------- */
/* The fallback, for the seventy-nine cities with no seeded list               */
/* -------------------------------------------------------------------------- */

/**
 * ============================================================================
 * WHAT THIS REPLACED, because it was the worst thing in the codebase
 * ----------------------------------------------------------------------------
 * This line used to read:
 *
 *   export const genericArrivalTasks = arrivalTasksByCity.madrid;
 *
 * One city has a seeded list. So every student in the other seventy-nine
 * opened Arrival Mode — the screen for their first two weeks in a country they
 * have never lived in — and was told, as fact, to get the Abono Joven if they
 * are under 26, that it costs about €20 a month, that a SIM is €8–€15, that a
 * gym is €15–€25, and that the authority for their residency is the Spanish
 * Ministry of Foreign Affairs. In Seoul. In Toronto. In Lagos.
 *
 * Every one of those is a specific, checkable, confidently-worded claim about
 * the wrong country, on the screen where a student is least able to tell and
 * most likely to act. The residency row is the one that matters: it is flagged
 * `legal: true`, which makes the interface render its source link with extra
 * weight, and the link went to a Spanish ministry.
 *
 * THE FIX IS NOT TO WRITE SEVENTY-NINE MORE LISTS from memory — that would be
 * the same failure in more places. It is to say only what is true everywhere,
 * and to fill in the specifics from data the product actually holds:
 * `City.transport` carries a real card name, a real student note and a real
 * official URL for each city, imported and checked. Where there is no such
 * datum, the task says what to look for instead of naming something that does
 * not exist there.
 *
 * NOTHING BELOW NAMES A PRICE. A cost is a claim about one country's economy
 * and this list is read in eighty. The city's own price anchors are on the
 * city screen, where they are dated and attributed.
 * ============================================================================
 */
function genericTasks(city: CityContext | null): readonly ArrivalTask[] {
  const where = city?.name ?? "your city";
  const transport = city?.transport ?? null;

  return [
    {
      id: "transport",
      label: "Transport pass",
      detail: transport
        ? `${transport.card} — ${transport.studentNote} Sort it before you start buying single tickets, which is where the money goes in week one.`
        : `Find the student or under-26 travel pass in ${where} before you buy single tickets. Almost every city has one, and it is usually the largest saving available to you in your first month.`,
      effort: "An hour, once",
      /* The city's own transport authority, or nothing. Never a stand-in. */
      source: transport ? { label: transport.card, url: transport.officialUrl } : undefined,
    },
    {
      id: "sim",
      label: "Local SIM",
      detail:
        "A prepaid local SIM usually works the day you buy it and usually needs only your passport. Leave the contract until you have a local bank account and an address.",
      effort: "Half an hour in a phone shop",
    },
    {
      id: "banking",
      label: "Somewhere to be paid and to pay from",
      detail:
        "A digital account you can open from your phone covers the first weeks. A local account matters when a landlord, an employer or the university needs one, and what it asks for depends on the country — check what proof of address they accept before you go in.",
      effort: "Minutes in an app, longer in a branch",
      legal: true,
    },
    {
      id: "registration",
      label: "Registration and residency",
      detail: city
        ? `What ${city.country} requires of you depends on your nationality, your course and how long you are staying, and it is the one thing here that has a deadline attached. Your university's international office deals with this for students in your exact position every year — they are the fastest correct answer, and they are free.`
        : "What is required depends on your nationality, your course and how long you are staying. Your university's international office handles this for students in your exact position every year.",
      effort: "Appointment based, book early",
      legal: true,
      /* NO LINK, deliberately, and this is the whole point of the rewrite: the
         only immigration URL this file has ever held is Spain's, and handing
         that to a student in Seoul is worse than handing them nothing. When a
         checked per-country source exists — the shape `work-rights.ts` already
         uses, an authority plus a URL plus the date it was confirmed to
         resolve — it belongs here. Until then this row names the authority a
         student can actually reach. */
    },
    {
      id: "discounts",
      label: "Student discounts worth having",
      detail:
        "Your university card, whatever the national youth or student card is called here, and museum or transport concessions. Three things cover most of what you will use; the rest is marketing.",
      effort: "An afternoon, once",
    },
    {
      id: "supermarket",
      label: "Find your cheap supermarket",
      detail:
        "Work out which supermarket near you is the cheap one and which market is cheaper still. This single decision moves your weekly spend more than any other habit you will form this month.",
      effort: "One walk around your neighbourhood",
    },
    {
      id: "gym",
      label: "Gym or sport",
      detail:
        "University clubs are almost always cheaper than a private gym and come with people attached, which is the part that matters in month one. Municipal sports centres are the next cheapest.",
      effort: "Sign up in person",
    },
    {
      id: "community",
      label: "Join your university community",
      detail:
        "Find your campus feed and two societies. This is the step that decides whether the year is social or lonely, and it is free.",
      effort: "Ten minutes",
    },
    {
      id: "first-event",
      label: "Go to one thing in week one",
      detail:
        "Anything free with other new students. The first event is the hardest and the only one that matters.",
      effort: "One evening",
    },
  ];
}

/**
 * The list with no city attached at all.
 *
 * Used where a city is genuinely not known. It is the generic list above with
 * every interpolation taking its fallback branch, which is why that branch had
 * to be written to stand on its own rather than to read as a degraded version
 * of something better.
 */
export const genericArrivalTasks: readonly ArrivalTask[] = genericTasks(null);

export function arrivalTasksFor(citySlug: string): readonly ArrivalTask[] {
  return arrivalTasksByCity[citySlug] ?? genericTasks(resolveCity(citySlug));
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
