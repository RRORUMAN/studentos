import { defaultCity, getCity } from "@/data/cities";
import type { City, Plan, PlanItem } from "@/data/types";
import { sum } from "@/lib/utils";

/**
 * ============================================================================
 * DEMO PLANNER
 * ----------------------------------------------------------------------------
 * The engine behind the live demo. It is deliberately *not* a model call: it is
 * a pure, deterministic function of (city, intent, budget) that composes a plan
 * out of that city's published price anchors.
 *
 * Two consequences, both intentional:
 *
 *  1. Moving the budget slider changes the plan for a *reason* a student can
 *     follow — a round of drinks drops out, the sit-down dinner becomes a
 *     student portion, the metro leg disappears in a city where they already
 *     hold a semester ticket. Nothing is faked or interpolated for effect.
 *
 *  2. No network, no key, no per-visitor cost. The site can hand an anonymous
 *     visitor a working planner because the planner is arithmetic.
 *
 * The real product replaces this with a retrieval step over student reports and
 * official listings; the *shape* it returns is this `Plan`, which is why every
 * demo surface on the site can render both.
 * ============================================================================
 */

export type DemoIntent = "tonight" | "free" | "food" | "weekend";

export const demoIntents: readonly {
  key: DemoIntent;
  label: string;
  /** The question a student would actually type. */
  query: (city: City) => string;
  /** Sensible opening budget in the city's own currency. */
  defaultBudget: (city: City) => number;
  /** Slider bounds, so the range always straddles a real decision. */
  range: (city: City) => [number, number];
}[] = [
  {
    key: "tonight",
    label: "A night out",
    query: (city) => `What can I do tonight in ${city.name}?`,
    defaultBudget: (city) => round(city.anchors.lunch[1] + city.anchors.pint[0] * 2 + 4),
    range: (city) => [round(city.anchors.pint[0] * 2), round(city.anchors.lunch[1] * 3 + 20)],
  },
  {
    key: "free",
    label: "Free things",
    query: (city) => `What is free in ${city.name} tonight?`,
    defaultBudget: (city) => round(Math.max(city.anchors.singleFare * 2, 5)),
    range: (city) => [0, round(Math.max(city.anchors.singleFare * 4, 15))],
  },
  {
    key: "food",
    label: "A week of food",
    query: (city) => `Where do I buy a week of food in ${city.name}?`,
    defaultBudget: (city) => round(city.anchors.weeklyGroceries[1]),
    range: (city) => [
      round(city.anchors.weeklyGroceries[0] * 0.6),
      round(city.anchors.weeklyGroceries[1] * 1.6),
    ],
  },
  {
    key: "weekend",
    label: "A whole weekend",
    query: (city) => `Can I afford a weekend in ${city.name}?`,
    defaultBudget: (city) => round(city.anchors.lunch[1] * 3 + city.anchors.pint[0] * 4),
    range: (city) => [round(city.anchors.lunch[0] * 2), round(city.anchors.lunch[1] * 6 + 40)],
  },
];

export function intentMeta(key: DemoIntent) {
  return demoIntents.find((intent) => intent.key === key) ?? demoIntents[0];
}

/** Prices are money, so they round to cents and never carry float noise. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Transport rows, or nothing at all where a student already has the ride. */
function transportRow(city: City, legs: number): PlanItem | null {
  if (city.anchors.singleFare === 0) {
    return {
      time: "",
      title: "Transport",
      detail: `${city.transport.card} covers it — ${city.transport.studentNote.toLowerCase()}`,
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
  const transportCost = transport?.price ?? 0;

  let left = budget - transportCost;
  const items: PlanItem[] = [];

  /* Dinner tier. Three honest options, chosen by what is actually left. */
  if (left >= sitDown + pint) {
    items.push({
      time: "20:00",
      title: "Dinner on the set menu",
      detail: `${city.neighbourhoods[0]} · three courses, the price students actually pay`,
      price: round(sitDown),
      walkMinutes: 8,
      kind: "food",
      source: "students",
    });
    left -= sitDown;
  } else if (left >= cheapLunch) {
    items.push({
      time: "20:00",
      title: "The student portion",
      detail: `${city.neighbourhoods[0]} · the cheaper size that is not on the tourist menu`,
      price: round(cheapLunch),
      walkMinutes: 9,
      kind: "food",
      source: "students",
    });
    left -= cheapLunch;
  } else {
    const street = round(cheapLunch * 0.55);
    items.push({
      time: "20:00",
      title: "Eat before you go out",
      detail: "Street food, or the supermarket meal deal students actually use",
      price: street,
      walkMinutes: 5,
      kind: "food",
      source: "students",
    });
    left -= street;
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

  /* Drinks are the elastic row: they absorb whatever is left, up to three. */
  const rounds = Math.max(0, Math.min(3, Math.floor(left / pint)));
  if (rounds > 0) {
    items.push({
      time: "23:00",
      title: rounds === 1 ? "One round at the student bar" : `${rounds} rounds at the student bar`,
      detail: "Two for one on the same street before midnight",
      price: round(pint * rounds),
      kind: "drink",
      source: "students",
    });
  }

  if (transport) items.push(transport);

  return {
    items,
    note:
      rounds === 0
        ? "At this budget the honest answer is dinner and the free event. Nothing here is padded to fill the number."
        : undefined,
  };
}

function buildFree(city: City, budget: number): { items: PlanItem[]; note?: string } {
  const transport = transportRow(city, 2);
  const affordable = (transport?.price ?? 0) <= budget;

  const items: PlanItem[] = [
    {
      time: "18:00",
      title: "Museum free hours",
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

  if (transport && affordable) items.push(transport);

  return {
    items,
    note: affordable
      ? "Everything on this list is free. The only line with a price on it is getting between them."
      : "Everything here is free, and at this budget the route is walking. The three stops are within 35 minutes of each other on foot.",
  };
}

function buildFood(city: City, budget: number): { items: PlanItem[]; note?: string } {
  const [lean, comfortable] = city.anchors.weeklyGroceries;
  /* Scale the real weekly shop to the chosen budget, then split it the way
     students who have worked it out actually split it: produce at the market,
     staples at the discounter, bread from the bakery. */
  const shop = Math.max(lean * 0.6, Math.min(budget, comfortable * 1.6));
  const transport = transportRow(city, 2);
  const groceryBudget = Math.max(0, shop - (transport?.price ?? 0));

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
      title: "Staples at the discount supermarket",
      detail: "Own-brand rice, pasta, eggs, oil — the half of the shop that never varies",
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
  ];

  if (transport) items.push(transport);

  return {
    items,
    note: "Splitting the shop across three stops is what saves the money, not switching brands.",
  };
}

function buildWeekend(city: City, budget: number): { items: PlanItem[]; note?: string } {
  const [cheapLunch, sitDown] = city.anchors.lunch;
  const pint = city.anchors.pint[0];
  const transport = transportRow(city, 4);
  let left = budget - (transport?.price ?? 0);

  const items: PlanItem[] = [
    {
      time: "Sat 16:00",
      title: "Open pitches at the park",
      detail: "Usually a game short of players",
      price: 0,
      walkMinutes: 18,
      kind: "activity",
      source: "students",
    },
  ];

  const dinner = left >= sitDown * 2 ? sitDown : cheapLunch;
  items.push({
    time: "Sat 21:00",
    title: "Dinner out",
    detail: `${city.neighbourhoods[0]} · the set menu, not the à la carte`,
    price: round(dinner),
    walkMinutes: 6,
    kind: "food",
    source: "students",
  });
  left -= dinner;

  const rounds = Math.max(0, Math.min(4, Math.floor((left * 0.6) / pint)));
  if (rounds > 0) {
    items.push({
      time: "Sat 23:30",
      title: `${rounds} rounds, then the free-entry night`,
      detail: "In before 01:00 or the door becomes a cover charge",
      price: round(pint * rounds),
      kind: "drink",
      source: "students",
    });
    left -= pint * rounds;
  }

  items.push({
    time: "Sun 11:00",
    title: "Flea market, then a slow coffee",
    detail: `${city.neighbourhoods[2] ?? city.neighbourhoods[0]} · the whole morning costs one drink`,
    price: left >= cheapLunch * 0.4 ? round(cheapLunch * 0.4) : 0,
    walkMinutes: 11,
    kind: "culture",
    source: "students",
  });

  if (transport) items.push(transport);

  return { items };
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

const BUILDERS: Record<DemoIntent, (city: City, budget: number) => { items: PlanItem[]; note?: string }> = {
  tonight: buildTonight,
  free: buildFree,
  food: buildFood,
  weekend: buildWeekend,
};

export type DemoPlan = Plan & {
  city: City;
  /** How many of the rows carry a student-reported price, for the source line. */
  studentRows: number;
  /** True when the plan came in over the number the student asked for. */
  over: boolean;
};

/**
 * Compose a plan. Pure: the same three arguments always produce the same plan,
 * which is what lets the demo animate between two states instead of flickering
 * through an unrelated one.
 */
export function planFor(
  citySlug: string,
  intent: DemoIntent,
  budget: number,
): DemoPlan {
  const city = getCity(citySlug) ?? defaultCity;
  const meta = intentMeta(intent);
  const { items, note } = BUILDERS[intent](city, budget);
  const total = round(sum(items.map((item) => item.price)));
  const over = total > budget;

  return {
    id: `${city.slug}-${intent}-${budget}`,
    citySlug: city.slug,
    query: meta.query(city),
    title: titleFor(intent, total, city),
    budget,
    items,
    interested: intent === "food" ? 0 : 2 + (items.length % 4),
    /* At the bottom of the slider the cheapest real evening can still cost more
       than the number asked for. Saying so is the whole point: a planner that
       always lands under budget is one that pads or invents, and a student who
       has been told "yes" once too often stops believing the totals. */
    note: over ? overNote(city, round(total - budget)) : note,
    city,
    studentRows: items.filter((item) => item.source === "students").length,
    over,
  };
}

function overNote(city: City, shortfall: number): string {
  const amount = new Intl.NumberFormat(brandLocaleFor(city), {
    style: "currency",
    currency: city.currency.code,
    minimumFractionDigits: Math.round(shortfall * 100) % 100 === 0 ? 0 : 2,
    maximumFractionDigits: Math.round(shortfall * 100) % 100 === 0 ? 0 : 2,
  }).format(shortfall);

  return `This is the cheapest honest version and it still comes to ${amount} over. Nothing has been dropped to make the number work — in ${city.name} that evening costs what it costs.`;
}

function titleFor(intent: DemoIntent, total: number, city: City): string {
  const amount = new Intl.NumberFormat(brandLocaleFor(city), {
    style: "currency",
    currency: city.currency.code,
    minimumFractionDigits: Math.round(total * 100) % 100 === 0 ? 0 : 2,
    maximumFractionDigits: Math.round(total * 100) % 100 === 0 ? 0 : 2,
  }).format(total);

  switch (intent) {
    case "free":
      return total === 0 ? "A free night, start to finish" : `Tonight, for ${amount}`;
    case "food":
      return `Your ${amount} week of food`;
    case "weekend":
      return `Your ${amount} weekend`;
    default:
      return `Your ${amount} night`;
  }
}

/** Cities keep their own formatting: £ in London, € in Madrid, from one call. */
function brandLocaleFor(city: City): string {
  return city.currency.code === "GBP" ? "en-GB" : "en-IE";
}

/** Convenience for callers that need the money options for a city. */
export function moneyIn(city: City) {
  return { currency: city.currency.code, locale: brandLocaleFor(city) };
}
