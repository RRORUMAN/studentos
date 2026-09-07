import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  BadgePercent,
  CalendarDays,
  EyeOff,
  FileText,
  ListChecks,
  Map,
  MapPinOff,
  MessageCircle,
  MessagesSquare,
  ShoppingBag,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";

import type { Accent } from "@/components/ui/accent";

/**
 * ============================================================================
 * LANDING SHOWCASE
 * ----------------------------------------------------------------------------
 * Seeded rows for the product sections of the landing page: Today, LifeOps,
 * Event radar, Right now, One app, Trust. All of it is sample content in the
 * product's own shapes, rendered with a sample marker. Money numbers that
 * matter are derived from `data/budget.ts`, not typed here.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Why StudentOS exists                                                         */
/* -------------------------------------------------------------------------- */

export const whyQuestions: readonly { text: string; rotate: number; accent: Accent }[] = [
  { text: "Where do students actually go?", rotate: -3, accent: "pulse" },
  { text: "What's free tonight?", rotate: 2, accent: "mint" },
  { text: "Why is food so expensive here?", rotate: -1.5, accent: "amber" },
  { text: "How do I meet people?", rotate: 3, accent: "pulse" },
  { text: "Which supermarket is cheap?", rotate: -2, accent: "mint" },
  { text: "Can I afford going out?", rotate: 1.5, accent: "flow" },
  { text: "What important thing am I forgetting?", rotate: -2.5, accent: "signal" },
];

/* -------------------------------------------------------------------------- */
/* Today                                                                        */
/* -------------------------------------------------------------------------- */

export type BriefLine = {
  kind: "events" | "friend" | "deal" | "task" | "group";
  text: string;
  accent: Accent;
};

export const todayBrief = {
  citySlug: "berlin",
  greeting: "Good afternoon",
  lines: [
    { kind: "events", text: "2 free events tonight", accent: "mint" },
    { kind: "friend", text: "1 friend going out", accent: "pulse" },
    { kind: "deal", text: "€6 lunch near campus", accent: "amber" },
    { kind: "task", text: "Transport-card task due", accent: "flow" },
    { kind: "group", text: "Football group needs 3 more people", accent: "pulse" },
  ] satisfies BriefLine[],
  insight: "You spend most on Thursdays. Tonight is a Thursday.",
} as const;

/* -------------------------------------------------------------------------- */
/* LifeOps                                                                      */
/* -------------------------------------------------------------------------- */

export type LifeOpsKind = "class" | "food" | "deadline" | "event" | "official" | "money" | "plan";

export type LifeOpsItem = {
  /** A clock time for today, a day name for the week. */
  time: string;
  label: string;
  detail: string;
  kind: LifeOpsKind;
  price?: number;
};

export const lifeOpsToday: readonly LifeOpsItem[] = [
  { time: "10:00", label: "Class", detail: "Macro II · Room 1.04", kind: "class" },
  { time: "13:00", label: "Cheap lunch", detail: "Mensa Nord · 6 min walk", kind: "food", price: 6 },
  { time: "16:00", label: "University deadline", detail: "Module registration closes", kind: "deadline" },
  { time: "19:00", label: "Free event", detail: "Open-air cinema · 2 friends going", kind: "event", price: 0 },
];

export const lifeOpsWeek: readonly LifeOpsItem[] = [
  { time: "Thu", label: "Transport card", detail: "Renews · official link attached", kind: "official" },
  { time: "Fri", label: "Rent", detail: "Recurring · already set aside", kind: "money" },
  { time: "Sat", label: "Weekend plan", detail: "€25 Berlin Saturday · 3 going", kind: "plan", price: 25 },
];

export const lifeOpsModes = ["Before arrival", "First week", "Established", "Leaving soon"] as const;

/* -------------------------------------------------------------------------- */
/* Right now                                                                    */
/* -------------------------------------------------------------------------- */

export type RightNowItem = {
  kind: "starting" | "free" | "food" | "people" | "trending" | "study";
  label: string;
  title: string;
  meta: string;
  accent: Accent;
};

export const rightNowItems: readonly RightNowItem[] = [
  { kind: "starting", label: "Starting in 30 min", title: "Open-mic night", meta: "Free · 8 min walk", accent: "pulse" },
  { kind: "free", label: "Free nearby", title: "Museum free window", meta: "18:00 to 20:00 · 13 min", accent: "mint" },
  { kind: "food", label: "Cheap food", title: "€6 lunch near campus", meta: "Until 14:00 · 6 min", accent: "amber" },
  { kind: "people", label: "Looking for people", title: "3 short for football", meta: "Saturday 16:00", accent: "pulse" },
  { kind: "trending", label: "Trending", title: "Rooftop opening", meta: "138 students interested", accent: "signal" },
  { kind: "study", label: "Study spot", title: "Library, 3rd floor", meta: "Quiet · plugs · until 22:00", accent: "flow" },
];

/* -------------------------------------------------------------------------- */
/* Event radar                                                                  */
/* -------------------------------------------------------------------------- */

export type RadarFilter = "tonight" | "free" | "weekend" | "campus" | "trending" | "under10";

export const radarFilters: readonly { key: RadarFilter; label: string }[] = [
  { key: "tonight", label: "Tonight" },
  { key: "free", label: "Free" },
  { key: "weekend", label: "Weekend" },
  { key: "campus", label: "Campus" },
  { key: "trending", label: "Trending" },
  { key: "under10", label: "Under €10" },
];

export type RadarEvent = {
  id: string;
  title: string;
  kind: "music" | "culture" | "sport" | "social" | "film";
  when: string;
  day: "today" | "weekend" | "week";
  price: number;
  walkMinutes: number;
  place: string;
  /** Sample counts. */
  interested: number;
  friends: number;
  university?: string;
  /** Hosted by a university, society or student union. */
  campus: boolean;
  trending: boolean;
  /** The one-line reason it is on the radar for this student. */
  why: string;
};

export const eventRadar: readonly RadarEvent[] = [
  { id: "ev-cinema", title: "Open-air cinema", kind: "film", when: "Tonight · 21:00", day: "today", price: 0, walkMinutes: 14, place: "Volkspark Friedrichshain", interested: 63, friends: 1, university: "TU Berlin", campus: false, trending: true, why: "Free, and one friend is going" },
  { id: "ev-rooftop", title: "Rooftop opening, no door fee", kind: "social", when: "Tonight · 20:00", day: "today", price: 0, walkMinutes: 9, place: "Neukölln", interested: 138, friends: 0, campus: false, trending: true, why: "No door fee before 21:00" },
  { id: "ev-jazz", title: "Jazz jam at the student club", kind: "music", when: "Tonight · 22:00", day: "today", price: 4, walkMinutes: 11, place: "Mitte", interested: 27, friends: 0, university: "Humboldt", campus: true, trending: false, why: "€4 with a student card" },
  { id: "ev-football", title: "Football, Tempelhofer Feld", kind: "sport", when: "Saturday · 16:00", day: "weekend", price: 0, walkMinutes: 18, place: "Tempelhof", interested: 8, friends: 2, university: "Freie", campus: false, trending: false, why: "2 friends in, 3 players short" },
  { id: "ev-flea", title: "Flea market, then coffee", kind: "culture", when: "Sunday · 11:00", day: "weekend", price: 3, walkMinutes: 12, place: "Mauerpark", interested: 44, friends: 0, campus: false, trending: false, why: "The whole morning costs one coffee" },
  { id: "ev-language", title: "Language exchange", kind: "social", when: "Wednesday · 19:00", day: "week", price: 0, walkMinutes: 16, place: "Wedding", interested: 31, friends: 1, university: "TU Berlin", campus: true, trending: false, why: "Free, and half the room is new this term" },
  { id: "ev-techno", title: "Techno night, student list", kind: "music", when: "Saturday · 23:30", day: "weekend", price: 8, walkMinutes: 21, place: "Kreuzberg", interested: 96, friends: 1, campus: false, trending: true, why: "€8 on the student list before 00:30" },
  { id: "ev-museum", title: "Museum free window", kind: "culture", when: "Thursday · 18:00", day: "week", price: 0, walkMinutes: 13, place: "Museumsinsel", interested: 52, friends: 0, campus: false, trending: false, why: "Free in the last two hours" },
  { id: "ev-film", title: "Campus film night", kind: "film", when: "Friday · 20:00", day: "weekend", price: 2, walkMinutes: 6, place: "Mitte", interested: 40, friends: 3, university: "Humboldt", campus: true, trending: false, why: "€2, and 3 friends are going" },
];

export function radarMatches(event: RadarEvent, filter: RadarFilter | null): boolean {
  switch (filter) {
    case "tonight":
      return event.day === "today";
    case "free":
      return event.price === 0;
    case "weekend":
      return event.day === "weekend";
    case "campus":
      return event.campus;
    case "trending":
      return event.trending;
    case "under10":
      return event.price < 10;
    default:
      return true;
  }
}

/* -------------------------------------------------------------------------- */
/* One app instead of ten                                                       */
/* -------------------------------------------------------------------------- */

/** The apps a student juggles in month one, described generically. */
export const collapsedApps: readonly { label: string; icon: LucideIcon; rotate: number }[] = [
  { label: "Maps", icon: Map, rotate: -4 },
  { label: "Student forum", icon: MessagesSquare, rotate: 3 },
  { label: "Group chat", icon: MessageCircle, rotate: -2 },
  { label: "Budget app", icon: Wallet, rotate: 4 },
  { label: "Events app", icon: CalendarDays, rotate: -3 },
  { label: "To-do list", icon: ListChecks, rotate: 2 },
  { label: "Student discounts", icon: BadgePercent, rotate: -1 },
  { label: "Marketplace", icon: ShoppingBag, rotate: 3 },
];

/* -------------------------------------------------------------------------- */
/* Trust                                                                        */
/* -------------------------------------------------------------------------- */

export const trustPoints: readonly { label: string; detail: string; icon: LucideIcon }[] = [
  { label: "Private by default", detail: "Nothing about you is public until you choose.", icon: EyeOff },
  { label: "Your exact home location is never shown", detail: "Plans show the meeting place you picked, not where you live.", icon: MapPinOff },
  { label: "Control what others see", detail: "First name, campus, terms in the city. You choose the rest.", icon: SlidersHorizontal },
  { label: "Student verification", detail: "A university email or card. A badge means something.", icon: BadgeCheck },
  { label: "Source-aware recommendations", detail: "Every row says whether it came from students, the venue or an official listing.", icon: FileText },
];
