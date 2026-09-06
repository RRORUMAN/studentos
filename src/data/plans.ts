import { sum } from "@/lib/utils";

import type { Plan } from "./types";

/**
 * Seeded answers for the hero command interface.
 *
 * The marketing site never calls a live model or a paid maps API for an
 * anonymous visitor. These are pre-computed answers in exactly the shape the
 * real generator returns, so the hero is the real component with a fixed
 * response rather than an illustration of one.
 */

export const heroPlans: readonly Plan[] = [
  {
    id: "tonight-20",
    citySlug: "madrid",
    query: "What can I do tonight for €20?",
    title: "Your €18.50 night",
    budget: 20,
    interested: 3,
    items: [
      {
        time: "19:30",
        title: "Student ramen",
        detail: "Malasaña · the €8.50 bowl is the student portion",
        price: 8.5,
        walkMinutes: 9,
        kind: "food",
        source: "students",
      },
      {
        time: "21:00",
        title: "Free rooftop event",
        detail: "No door fee before 22:00",
        price: 0,
        walkMinutes: 7,
        kind: "event",
        source: "venue",
      },
      {
        time: "23:00",
        title: "Student bar",
        detail: "Two drinks for the price of one on the same street",
        price: 7,
        kind: "drink",
        source: "students",
      },
      { time: "", title: "Transport", detail: "Two metro legs", price: 3, kind: "transport", source: "official" },
    ],
  },
  {
    id: "groceries-40",
    citySlug: "madrid",
    query: "Where should I buy groceries with €40?",
    title: "Your €38.40 week",
    budget: 40,
    interested: 0,
    note: "Splitting the shop between the market and the supermarket is what saves the €12, not switching brands.",
    items: [
      {
        time: "Stop 1",
        title: "Fruit and veg at the market",
        detail: "Lavapiés · roughly a third under supermarket prices",
        price: 12.4,
        walkMinutes: 14,
        kind: "activity",
        source: "students",
      },
      {
        time: "Stop 2",
        title: "Basics at the discount supermarket",
        detail: "Chamberí · own-brand rice, pasta, eggs, oil",
        price: 19.8,
        walkMinutes: 11,
        kind: "activity",
        source: "students",
      },
      {
        time: "Stop 3",
        title: "Bread from the bakery",
        detail: "Cheaper and better than the supermarket aisle",
        price: 3.2,
        walkMinutes: 3,
        kind: "food",
        source: "students",
      },
      { time: "", title: "Transport", detail: "One metro leg each way", price: 3, kind: "transport", source: "official" },
    ],
  },
  {
    id: "free-tonight",
    citySlug: "madrid",
    query: "What free events are happening?",
    title: "Tonight, for the price of the metro",
    budget: 10,
    interested: 7,
    note: "Everything on this list is free. The only cost is getting between the three.",
    items: [
      {
        time: "19:00",
        title: "Reina Sofía, free hours",
        detail: "Free entry in the last two hours on weekdays",
        price: 0,
        walkMinutes: 18,
        kind: "culture",
        source: "official",
      },
      {
        time: "21:00",
        title: "Rooftop opening",
        detail: "No door fee before 22:00",
        price: 0,
        walkMinutes: 7,
        kind: "event",
        source: "venue",
      },
      {
        time: "23:30",
        title: "Free-entry night, La Latina",
        detail: "No cover before 01:00 on weeknights",
        price: 0,
        walkMinutes: 16,
        kind: "event",
        source: "venue",
      },
      { time: "", title: "Transport", detail: "Two metro legs", price: 3, kind: "transport", source: "official" },
    ],
  },
  {
    id: "weekend-check",
    citySlug: "madrid",
    query: "Can I afford going out this weekend?",
    title: "Yes. This weekend costs you €32",
    budget: 67,
    interested: 5,
    note: "You have €67 left in entertainment this month. This weekend leaves €35 of it.",
    items: [
      {
        time: "Sat 16:00",
        title: "Football at Retiro",
        detail: "Open pitches, usually a game short of players",
        price: 0,
        walkMinutes: 21,
        kind: "activity",
        source: "students",
      },
      {
        time: "Sat 21:00",
        title: "Dinner on the menú",
        detail: "Moncloa · three courses with a drink",
        price: 8,
        walkMinutes: 6,
        kind: "food",
        source: "students",
      },
      {
        time: "Sat 23:30",
        title: "Student bar, then free-entry night",
        detail: "In before 01:00 or it becomes €12",
        price: 14,
        walkMinutes: 5,
        kind: "drink",
        source: "students",
      },
      {
        time: "Sun 11:00",
        title: "El Rastro, then vermouth",
        detail: "La Latina · the whole plan costs one drink",
        price: 4,
        walkMinutes: 12,
        kind: "culture",
        source: "students",
      },
      { time: "", title: "Transport", detail: "Weekend metro legs", price: 6, kind: "transport", source: "official" },
    ],
  },
] as const;

/** Total spend for a plan. Never hardcode a total in copy — derive it. */
export function planTotal(plan: Plan): number {
  return Math.round(sum(plan.items.map((item) => item.price)) * 100) / 100;
}

/** Positive when under budget. */
export function planHeadroom(plan: Plan): number {
  return Math.round((plan.budget - planTotal(plan)) * 100) / 100;
}

/** The plan the hero opens on. */
export const defaultPlan = heroPlans[0];

/**
 * Shareable plans. Designed for a 9:16 story card and a WhatsApp link preview,
 * which is why the item list is short and the total is the loudest element.
 */
export type SharePlan = {
  id: string;
  citySlug: string;
  title: string;
  subtitle: string;
  items: readonly { label: string; price: number }[];
  savedBy: number;
};

export const sharePlans: readonly SharePlan[] = [
  {
    id: "madrid-25-saturday",
    citySlug: "madrid",
    title: "The €25 Madrid Saturday",
    subtitle: "Lunch, a museum, a coffee, a night out and the metro home.",
    items: [
      { label: "Lunch", price: 8 },
      { label: "Museum", price: 0 },
      { label: "Coffee", price: 4 },
      { label: "Nightlife", price: 10 },
      { label: "Metro", price: 3 },
    ],
    savedBy: 1240,
  },
  {
    id: "barcelona-18-sunday",
    citySlug: "barcelona",
    title: "The €18 Barcelona Sunday",
    subtitle: "Market breakfast, the beach that is not Barceloneta, open-air cinema.",
    items: [
      { label: "Market breakfast", price: 5 },
      { label: "Beach", price: 0 },
      { label: "Menú lunch", price: 12 },
      { label: "Open-air cinema", price: 0 },
      { label: "Metro", price: 1 },
    ],
    savedBy: 610,
  },
  {
    id: "berlin-12-friday",
    citySlug: "berlin",
    title: "The €12 Berlin Friday",
    subtitle: "Mensa dinner, a free gallery night, and the semester ticket doing the rest.",
    items: [
      { label: "Mensa dinner", price: 3.5 },
      { label: "Gallery night", price: 0 },
      { label: "Späti round", price: 8.5 },
      { label: "Transport", price: 0 },
    ],
    savedBy: 430,
  },
] as const;

export function sharePlanTotal(plan: SharePlan): number {
  return Math.round(sum(plan.items.map((item) => item.price)) * 100) / 100;
}

export function sharePlansForCity(citySlug: string): SharePlan[] {
  return sharePlans.filter((plan) => plan.citySlug === citySlug);
}
