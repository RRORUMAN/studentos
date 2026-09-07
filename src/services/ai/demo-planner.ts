import { mascotLine } from "@/brand/mascot.config";
import { missionTemplate } from "@/config/missions";
import { defaultCity, getCity } from "@/data/cities";
import { affordCheck, safeThisWeek, safeToday } from "@/data/budget";
import { peoplePool } from "@/data/social";
import type { City, Plan, PlanItem } from "@/data/types";
import { sum } from "@/lib/utils";

/**
 * ============================================================================
 * DEMO PLANNER
 * ----------------------------------------------------------------------------
 * The engine behind every interactive demo on the landing page: the hero
 * console, Ask, the budget check and the mission preview.
 *
 * It is deliberately *not* a model call. It is a pure, deterministic function
 * of (city, query) composed from that city's published price anchors, which
 * buys three things:
 *
 *  1. Switching city genuinely recomputes the plan, in that city's currency,
 *     for a reason a student can follow: Berlin drops the transport row
 *     because the semester ticket covers it, London's pint anchor pushes the
 *     bar line up, Amsterdam has no fare at all.
 *  2. No network, no key, no per-visitor cost, no rate limit.
 *  3. Every number on the page derives from the same arithmetic, so the hero
 *     total and the budget verdict can never contradict each other.
 *
 * The real product replaces this with retrieval over student reports and
 * official listings. The *shape* it returns is this `Plan`, which is why the
 * same components render both.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Intents                                                                     */
/* -------------------------------------------------------------------------- */

export type DemoIntent = "tonight" | "free" | "saturday" | "groceries";

export type DemoIntentMeta = {
  key: DemoIntent;
  /**
   * The chip label and the typed question. Both take the city, because a
   * student in London asks about £20 and one in Madrid about €20 — printing
   * euro at a London price level would be the first dishonest number on the
   * page.
   */
  label: (city: City) => string;
  query: (city: City) => string;
  /** The budget the question implies, in the city's own currency. */
  budget: (city: City) => number;
};

export const demoIntents: readonly DemoIntentMeta[] = [
  {
    key: "tonight",
    label: (city) => `Tonight under ${formatIn(city, scale(city, 20))}`,
    query: (city) => `What can I do tonight for under ${formatIn(city, scale(city, 20))}?`,
    budget: (city) => scale(city, 20),
  },
  {
    key: "free",
    label: () => "What's free tonight?",
    query: () => "What's free tonight?",
    budget: (city) => scale(city, 6),
  },
  {
    key: "saturday",
    label: (city) => `Saturday for ${formatIn(city, scale(city, 30))}`,
    query: (city) => `Plan Saturday for ${formatIn(city, scale(city, 30))}.`,
    budget: (city) => scale(city, 30),
  },
  {
    key: "groceries",
    label: () => "A week of groceries",
    query: () => "Where should I buy groceries this week?",
    budget: (city) => round(city.anchors.weeklyGroceries[1]),
  },
];

export function intentMeta(key: DemoIntent): DemoIntentMeta {
  return demoIntents.find((intent) => intent.key === key) ?? demoIntents[0];
}

/** The five cities with seeded local data, in switcher order. */
export const demoCities = ["berlin", "madrid", "barcelona", "amsterdam", "london"] as const;

/* -------------------------------------------------------------------------- */
/* Arithmetic helpers                                                          */
/* -------------------------------------------------------------------------- */

/** Prices are money: round to cents, never carry float noise. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Whole units, for headline budgets that should never show cents. */
function whole(value: number): number {
  return Math.max(1, Math.round(value));
}

/**
 * A euro figure restated in the city's own price level, using its cheap-lunch
 * anchor as the ratio. "€20 tonight" is a different amount of evening in
 * London and in Berlin, and the demo says so rather than converting currency.
 */
function scale(city: City, euros: number): number {
  const ratio = city.anchors.lunch[0] / defaultCity.anchors.lunch[0];
  return whole(euros * ratio);
}

/** Transport rows, or nothing at all where a student already has the ride. */
function transportRow(city: City, legs: number): PlanItem {
  if (city.anchors.singleFare === 0) {
    return {
      time: "",
      title: "Transport",
      detail: `${city.transport.card} covers it`,
      price: 0,
      kind: "transport",
      source: "official",
    };
  }
  return {
    time: "",
    title: "Transport",
    detail: `${legs} legs on the ${city.transport.card}`,
    price: round(city.anchors.singleFare * legs),
    kind: "transport",
    source: "official",
  };
}

/* -------------------------------------------------------------------------- */
/* Intent builders                                                             */
/* -------------------------------------------------------------------------- */

function buildTonight(city: City, budget: number): { items: PlanItem[]; note?: string } {
  const [cheapLunch, sitDown] = city.anchors.lunch;
  const pint = city.anchors.pint[0];
  const transport = transportRow(city, 2);
  let left = budget - transport.price;

  const items: PlanItem[] = [];

  /* Dinner tier: three honest options, picked by what is actually left. */
  if (left >= sitDown + pint * 2) {
    items.push({
      time: "20:00",
      title: "Dinner",
      detail: `${city.neighbourhoods[0]} · the set menu, the price students actually pay`,
      price: round(sitDown),
      walkMinutes: 8,
      kind: "food",
      source: "students",
    });
    left -= sitDown;
  } else {
    items.push({
      time: "20:00",
      title: "Dinner",
      detail: `${city.neighbourhoods[0]} · the student portion, not on the tourist menu`,
      price: round(cheapLunch),
      walkMinutes: 9,
      kind: "food",
      source: "students",
    });
    left -= cheapLunch;
  }

  /* The free thing is always in the plan, whatever the budget. */
  items.push({
    time: "21:30",
    title: "Free event",
    detail: "No door fee before 22:00",
    price: 0,
    walkMinutes: 7,
    kind: "event",
    source: "venue",
  });

  /* Drinks are the elastic row: they absorb what is left, up to three. */
  const rounds = Math.max(0, Math.min(3, Math.floor(left / pint)));
  if (rounds > 0) {
    items.push({
      time: "23:00",
      title: "Student bar",
      detail: rounds === 1 ? "One round, two-for-one before midnight" : `${rounds} rounds, two-for-one before midnight`,
      price: round(pint * rounds),
      kind: "drink",
      source: "students",
    });
  }

  items.push(transport);

  return {
    items,
    note:
      rounds === 0
        ? "At this budget the honest answer is dinner and the free event. Nothing is padded to fill the number."
        : undefined,
  };
}

function buildFree(city: City, budget: number): { items: PlanItem[]; note?: string } {
  const transport = transportRow(city, 2);
  const affordable = transport.price <= budget;

  const items: PlanItem[] = [
    {
      time: "18:00",
      title: "Museum free window",
      detail: "Free entry in the last two hours on weekdays",
      price: 0,
      walkMinutes: 14,
      kind: "culture",
      source: "official",
    },
    {
      time: "21:00",
      title: "Opening night, no door fee",
      detail: `${city.neighbourhoods[1] ?? city.neighbourhoods[0]} · free before 22:00`,
      price: 0,
      walkMinutes: 7,
      kind: "event",
      source: "venue",
    },
    {
      time: "23:00",
      title: "Free-entry night",
      detail: "No cover before 01:00 on weeknights",
      price: 0,
      walkMinutes: 12,
      kind: "event",
      source: "venue",
    },
  ];

  if (affordable) items.push(transport);

  return {
    items,
    note: affordable
      ? "Everything on this list is free. The only line with a price is getting between them."
      : "Everything here is free, and at this budget the route is walking. All three are inside 35 minutes on foot.",
  };
}

function buildSaturday(city: City, budget: number): { items: PlanItem[]; note?: string } {
  const [cheapLunch, sitDown] = city.anchors.lunch;
  const pint = city.anchors.pint[0];
  const transport = transportRow(city, 4);
  let left = budget - transport.price;

  const items: PlanItem[] = [
    {
      time: "11:00",
      title: "Free museum",
      detail: "Free entry on Saturday mornings",
      price: 0,
      walkMinutes: 13,
      kind: "culture",
      source: "official",
    },
  ];

  const lunch = left >= sitDown * 2 ? sitDown : cheapLunch;
  items.push({
    time: "13:30",
    title: "Student lunch",
    detail: `${city.neighbourhoods[0]} · three courses, student price`,
    price: round(lunch),
    walkMinutes: 6,
    kind: "food",
    source: "students",
  });
  left -= lunch;

  items.push({
    time: "16:00",
    title: "Football meetup",
    detail: "Open pitches, usually a game short of players",
    price: 0,
    walkMinutes: 18,
    kind: "activity",
    source: "students",
  });

  const rounds = Math.max(0, Math.min(3, Math.floor((left * 0.7) / pint)));
  if (rounds > 0) {
    items.push({
      time: "21:00",
      title: "Night event",
      detail: "On the student list before 00:30",
      price: round(pint * rounds),
      kind: "event",
      source: "venue",
    });
  }

  items.push(transport);

  return { items };
}

function buildGroceries(city: City, budget: number): { items: PlanItem[]; note?: string } {
  const [lean, comfortable] = city.anchors.weeklyGroceries;
  const shop = Math.max(lean * 0.6, Math.min(budget, comfortable * 1.6));
  const transport = transportRow(city, 2);
  const groceryBudget = Math.max(0, shop - transport.price);

  const items: PlanItem[] = [
    {
      time: "Stop 1",
      title: "Fruit and veg at the market",
      detail: `${city.neighbourhoods[1] ?? city.neighbourhoods[0]} · roughly a third under supermarket prices`,
      price: round(groceryBudget * 0.32),
      walkMinutes: 12,
      kind: "activity",
      source: "students",
    },
    {
      time: "Stop 2",
      title: "Staples at the discounter",
      detail: "Own-brand rice, pasta, eggs, oil. The half of the shop that never varies",
      price: round(groceryBudget * 0.52),
      walkMinutes: 9,
      kind: "activity",
      source: "students",
    },
    {
      time: "Stop 3",
      title: "Bread from the bakery",
      detail: "Cheaper and better than the supermarket aisle",
      price: round(groceryBudget * 0.16),
      walkMinutes: 3,
      kind: "food",
      source: "students",
    },
    transport,
  ];

  return {
    items,
    note: "Splitting the shop across three stops is what saves the money, not switching brands.",
  };
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

const BUILDERS: Record<DemoIntent, (city: City, budget: number) => { items: PlanItem[]; note?: string }> = {
  tonight: buildTonight,
  free: buildFree,
  saturday: buildSaturday,
  groceries: buildGroceries,
};

export type DemoPlan = Plan & {
  city: City;
  intent: DemoIntent;
  /** How many rows carry a student-reported price, for the source line. */
  studentRows: number;
  /** True when the plan came in over the number the student asked for. */
  over: boolean;
  /** Headroom, positive when under budget. */
  headroom: number;
  /** Sample interest counts, derived so they never contradict the avatars. */
  interestedCount: number;
  sameUniversity: number;
  people: readonly { initials: string; handle: string; campus: string }[];
  /** The mascot's one line about this result. */
  mascotSays: string;
};

/**
 * Compose a plan. Pure: the same two arguments always produce the same plan,
 * which is what lets the demo animate between two states rather than flicker
 * through an unrelated one.
 */
export function planFor(citySlug: string, intent: DemoIntent, budgetOverride?: number): DemoPlan {
  const city = getCity(citySlug) ?? defaultCity;
  const meta = intentMeta(intent);
  const budget = budgetOverride ?? meta.budget(city);
  const { items, note } = BUILDERS[intent](city, budget);

  const total = round(sum(items.map((item) => item.price)));
  const over = total > budget;
  const headroom = round(budget - total);

  /* Interest counts are derived from the plan itself, so the avatar stack and
     the sentence beside it can never disagree. */
  const interestedCount = intent === "groceries" ? 0 : 8 + ((city.mapSeed + items.length) % 9);
  const sameUniversity = interestedCount === 0 ? 0 : 1 + (city.mapSeed % 3);
  const campus = universityFor(city);
  const people = peoplePool
    .slice(0, Math.min(5, Math.max(0, interestedCount)))
    .map((person) => ({ ...person, campus }));

  return {
    id: `${city.slug}-${intent}`,
    citySlug: city.slug,
    intent,
    query: meta.query(city),
    title: titleFor(intent, total, city),
    budget,
    items,
    interested: interestedCount,
    note: over ? overNote(city, round(total - budget)) : note,
    city,
    studentRows: items.filter((item) => item.source === "students").length,
    over,
    headroom,
    interestedCount,
    sameUniversity,
    people,
    mascotSays: over ? mascotLine("budgetTight", 1) : intent === "free" ? mascotLine("found", 2) : mascotLine("budgetSafe", 1),
  };
}

/** A readable university name for the city, for the "from your university" line. */
function universityFor(city: City): string {
  const byCity: Record<string, string> = {
    madrid: "Complutense",
    barcelona: "UB",
    london: "UCL",
    amsterdam: "UvA",
    berlin: "Humboldt",
  };
  return byCity[city.slug] ?? "your university";
}

function overNote(city: City, shortfall: number): string {
  return `This is the cheapest honest version and it still comes to ${formatIn(city, shortfall)} over. Nothing was dropped to make the number work.`;
}

function titleFor(intent: DemoIntent, total: number, city: City): string {
  const amount = formatIn(city, total);
  switch (intent) {
    case "free":
      return total === 0 ? "A free night, start to finish" : `Tonight, for ${amount}`;
    case "groceries":
      return `Your ${amount} week of food`;
    case "saturday":
      return `Your ${amount} Saturday`;
    default:
      return `Your ${amount} night`;
  }
}

/** Cities keep their own formatting: £ in London, € in Madrid, one call site. */
export function moneyIn(city: City) {
  return { currency: city.currency.code, locale: brandLocaleFor(city) };
}

function brandLocaleFor(city: City): string {
  return city.currency.code === "GBP" ? "en-GB" : "en-IE";
}

function formatIn(city: City, amount: number): string {
  const cents = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat(brandLocaleFor(city), {
    style: "currency",
    currency: city.currency.code,
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(amount);
}

/* -------------------------------------------------------------------------- */
/* Ask — structured answers, not chat bubbles                                  */
/* -------------------------------------------------------------------------- */

export type AskAnswerKind = "plan" | "budget" | "place" | "event" | "people" | "tasks";

export type AskRow = {
  label: string;
  detail?: string;
  /** Null renders no figure at all; 0 renders "Free". */
  price?: number | null;
  meta?: string;
};

export type AskAnswer = {
  query: string;
  kind: AskAnswerKind;
  /** One line above the rows. Never a paragraph. */
  lead: string;
  rows: readonly AskRow[];
  /** The money consequence, when there is one. */
  budgetLine?: string;
  /** Where the answer came from. Always present. */
  sources: string;
  mascotSays: string;
};

/**
 * The rotating questions in the Ask section. Each returns a *structured*
 * answer built from the same seeded arithmetic, because the product answers
 * with rows, cards and a total rather than with prose.
 */
export const askQueries: readonly string[] = [
  "What's free tonight?",
  "Plan Saturday for €30.",
  "Where should I buy groceries?",
  "Can I afford this?",
  "Find people to play football.",
  "What am I forgetting this week?",
  "Where should I study?",
];

export function askAnswer(query: string, citySlug: string): AskAnswer {
  const city = getCity(citySlug) ?? defaultCity;
  const price = (amount: number) => formatIn(city, amount);

  switch (query) {
    case "Plan Saturday for €30.": {
      /* The question names €30, so the plan is built to €30 exactly rather
         than to this city's scaled equivalent: the answer must match the
         number the student just read. */
      const plan = planFor(city.slug, "saturday", 30);
      return {
        query,
        kind: "plan",
        lead: plan.title,
        rows: plan.items.map((item) => ({ label: item.title, detail: item.detail, price: item.price, meta: item.time })),
        budgetLine: plan.over
          ? `${price(Math.abs(plan.headroom))} over the €30 you asked for.`
          : `${price(plan.headroom)} under budget, and inside this week's safe ${price(safeThisWeek())}.`,
        sources: `${plan.studentRows} rows from student reports, the rest from official listings`,
        mascotSays: mascotLine("budgetSafe", 1),
      };
    }
    case "Where should I buy groceries?": {
      const plan = planFor(city.slug, "groceries");
      return {
        query,
        kind: "plan",
        lead: plan.title,
        rows: plan.items.map((item) => ({ label: item.title, detail: item.detail, price: item.price, meta: item.time })),
        budgetLine: plan.note,
        sources: "Price gaps reported by students this term",
        mascotSays: mascotLine("found", 1),
      };
    }
    case "Can I afford this?": {
      const check = affordCheck(35);
      return {
        query,
        kind: "budget",
        lead: `${check.headline} ${check.detail}`,
        rows: [
          { label: "Safe today", price: check.safeToday },
          { label: "Safe this week", price: check.safeWeek },
          { label: "This spend", price: check.amount },
          check.alternative
            ? { label: check.alternative.label, detail: check.alternative.note, price: check.alternative.price, meta: `saves ${price(check.alternative.saves)}` }
            : { label: "Nothing to change", detail: "It already fits.", price: null },
        ],
        budgetLine: `Leaves ${price(check.leftUntilMonday)} for going out until Monday.`,
        sources: "Your own budget, nothing else",
        mascotSays: mascotLine("afford", 0),
      };
    }
    case "Find people to play football.": {
      const campus = universityFor(city);
      return {
        query,
        kind: "people",
        lead: "One game on Saturday, three players short.",
        rows: [
          { label: "Football, Saturday 16:00", detail: `${city.neighbourhoods[0]} · free pitches`, price: 0, meta: "2 of 5 in" },
          { label: "Weekly kickabout", detail: `Hosted by students at ${campus}`, price: 0, meta: "repeats" },
          { label: "Anyone Down?", detail: "Post it and let the city answer", price: null, meta: "opens a group" },
        ],
        sources: "Students who opted in to being found",
        mascotSays: mascotLine("social", 2),
      };
    }
    case "What am I forgetting this week?": {
      return {
        query,
        kind: "tasks",
        lead: "Three things, in the order they bite.",
        rows: [
          { label: "Module registration closes", detail: "Today at 16:00", price: null, meta: "deadline" },
          { label: "Transport card renews", detail: "Thursday · official link attached", price: null, meta: "official" },
          { label: "Rent", detail: "Friday · already set aside", price: null, meta: "recurring" },
        ],
        budgetLine: `After the planned week you still have ${price(safeThisWeek())} of safe spend.`,
        sources: "Your LifeOps timeline and official sources",
        mascotSays: mascotLine("focus", 0),
      };
    }
    case "Where should I study?": {
      return {
        query,
        kind: "place",
        lead: "Three that are open late and have plugs.",
        rows: [
          { label: "University library, 3rd floor", detail: "Quiet · plugs · until 22:00", price: 0, meta: "6 min" },
          { label: "Public library", detail: "Busy before 15:00, empty after", price: 0, meta: "11 min" },
          { label: "Café with a back room", detail: "One coffee buys the afternoon", price: 3, meta: "8 min" },
        ],
        sources: "Student reports, opening hours from the venues",
        mascotSays: mascotLine("focus", 0),
      };
    }
    default: {
      const plan = planFor(city.slug, "free");
      return {
        query: "What's free tonight?",
        kind: "event",
        lead: "Three free things, all inside 20 minutes.",
        rows: plan.items.map((item) => ({ label: item.title, detail: item.detail, price: item.price, meta: item.time })),
        budgetLine: `Costs nothing, so today's safe ${price(safeToday())} stays where it is.`,
        sources: "Museum hours from official listings, door policy from the venues",
        mascotSays: mascotLine("found", 2),
      };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Missions                                                                    */
/* -------------------------------------------------------------------------- */

export type MissionPreviewStep = {
  label: string;
  price: number;
  done: boolean;
};

export type MissionPreview = {
  key: string;
  title: string;
  tagline: string;
  emoji: string;
  steps: readonly MissionPreviewStep[];
  total: number;
  budget: number | null;
};

/**
 * A priced preview of a mission template for the landing page. Prices come
 * from the city's anchors, so "Weekend under €30" is a real €30 in Berlin and
 * a real one in London.
 */
export function missionPreview(key: string, citySlug: string): MissionPreview | null {
  const template = missionTemplate(key);
  if (!template) return null;
  const city = getCity(citySlug) ?? defaultCity;

  const budget = template.budgetCents === null ? null : whole(scale(city, template.budgetCents / 100));
  const lunch = round(city.anchors.lunch[0]);
  const night = round(city.anchors.pint[0] * 2);
  const transport = city.anchors.singleFare === 0 ? 0 : round(city.anchors.singleFare * 4);

  const priced: MissionPreviewStep[] = template.steps.slice(0, 4).map((step, index) => {
    const price =
      step.priceCents !== undefined
        ? step.kind === "transport"
          ? transport
          : whole(scale(city, step.priceCents / 100))
        : step.pick?.free
          ? 0
          : step.kind === "place"
            ? lunch
            : step.kind === "event"
              ? night
              : 0;
    return { label: step.label, price, done: index === 0 };
  });

  const withTransport: MissionPreviewStep[] = [
    ...priced,
    { label: "Transport", price: transport, done: false },
  ];

  const spent = round(sum(withTransport.map((step) => step.price)));
  const buffer = budget === null ? 0 : Math.max(0, round(budget - spent));
  const steps = budget === null ? withTransport : [...withTransport, { label: "Buffer", price: buffer, done: false }];

  return {
    key: template.key,
    title: template.title,
    tagline: template.tagline,
    emoji: template.emoji,
    steps,
    total: round(sum(steps.map((step) => step.price))),
    budget,
  };
}
