import type { Place } from "@/data/types";
import type { CityEvent } from "@/domain/types";
import type { Scored } from "@/server/engines/recommend";

/**
 * ============================================================================
 * FIRST WEEK PLAN
 * ----------------------------------------------------------------------------
 * The seven days after landing, one thing a day, generated the moment
 * onboarding finishes so the product has a plan before the student has a
 * routine.
 *
 * The order is the order things actually block each other: food and a way to
 * get around before anything else, campus before the social calendar, the gym
 * and a first night out once the basics hold. Every line points at a real
 * place or event from the student's own rows — the supermarket named is the
 * one the scorer picked, not a category.
 *
 * Pure. No model, no I/O.
 * ============================================================================
 */

export type FirstWeekDay = {
  offset: number;
  dateIso: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  kind: "task" | "place" | "event" | "social";
  done: boolean;
};

export function firstWeekPlan(input: {
  /** Arrival date, or account creation when none was given. */
  startsOn: Date;
  places: readonly Scored<Place>[];
  freeEvents: readonly Scored<CityEvent>[];
  doneTaskIds: ReadonlySet<string>;
  social: boolean;
  cityName: string;
}): FirstWeekDay[] {
  const best = (layer: string) => input.places.find((entry) => entry.item.layers.includes(layer as never));

  const supermarket = best("groceries");
  const lunch = best("cheap-food");
  const study = best("study");
  const gym = best("fitness");
  const night = best("nightlife");
  const freeThing = best("free");
  const firstEvent = input.freeEvents[0];

  const days: Omit<FirstWeekDay, "dateIso" | "offset">[] = [
    {
      label: "Day 1",
      title: supermarket ? `Find your supermarket: ${supermarket.item.name}` : "Find your supermarket",
      detail: supermarket ? supermarket.item.why : "The cheap one, not the close one. It sets the food budget for the whole term.",
      href: supermarket ? `/discover/${supermarket.item.id}` : "/discover?tab=groceries",
      kind: "place",
      done: input.doneTaskIds.has("find-supermarket"),
    },
    {
      label: "Day 2",
      title: "Sort transport",
      detail: "The student card or pass for your city. Paying single fares for a month is the most common first-week leak.",
      href: "/arrival",
      kind: "task",
      done: input.doneTaskIds.has("transport-card"),
    },
    {
      label: "Day 3",
      title: lunch ? `Campus walk, then lunch at ${lunch.item.name}` : "Campus walk, then a cheap lunch",
      detail: lunch ? lunch.item.why : "Find the library, the student office and where people actually eat.",
      href: lunch ? `/discover/${lunch.item.id}` : "/discover?tab=food",
      kind: "place",
      done: input.doneTaskIds.has("campus-orientation"),
    },
    {
      label: "Day 4",
      title: firstEvent ? firstEvent.item.title : "A free event",
      detail: firstEvent
        ? `${firstEvent.item.venue}. Free, and the easiest kind of room to walk into alone.`
        : `Something free in ${input.cityName}. The easiest kind of room to walk into alone.`,
      href: firstEvent ? `/events/${firstEvent.item.id}` : "/events?tab=free",
      kind: "event",
      done: false,
    },
    {
      label: "Day 5",
      title: gym ? `Set up the gym: ${gym.item.name}` : study ? `Find where you will work: ${study.item.name}` : "Set up a routine",
      detail: gym ? gym.item.why : study ? study.item.why : "A gym or a study spot. Either gives the week a shape.",
      href: gym ? `/discover/${gym.item.id}` : study ? `/discover/${study.item.id}` : "/discover?tab=fitness",
      kind: "place",
      done: false,
    },
    {
      label: "Day 6",
      title: input.social ? "Say yes to one plan" : freeThing ? freeThing.item.name : "Something free",
      detail: input.social
        ? "Someone in your city is short a person for something. Join one, or post your own."
        : freeThing
          ? freeThing.item.why
          : "Somewhere in the city that costs nothing.",
      href: input.social ? "/anyone-down" : freeThing ? `/discover/${freeThing.item.id}` : "/events?tab=free",
      kind: input.social ? "social" : "place",
      done: false,
    },
    {
      label: "Weekend",
      title: night ? `First night out: ${night.item.name}` : `Your ${input.cityName} starter plan`,
      detail: night ? night.item.why : "A cheap evening built from what you have found this week.",
      href: night ? `/discover/${night.item.id}` : "/ask?q=Plan%20Saturday",
      kind: "place",
      done: false,
    },
  ];

  return days.map((day, offset) => {
    const date = new Date(input.startsOn);
    date.setDate(date.getDate() + offset);
    return { ...day, offset, dateIso: date.toISOString() };
  });
}
