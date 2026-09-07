import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Banknote,
  CalendarClock,
  Luggage,
  MessagesSquare,
  Radar,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";

import { brand } from "@/brand/brand.config";

export type ProductSurface = {
  key: string;
  label: string;
  blurb: string;
  href: string;
  icon: LucideIcon;
  /** Accent token name. Each surface owns one colour across the whole site. */
  accent: "signal" | "pulse" | "flow" | "mint" | "amber";
};

/**
 * The product surfaces a visitor can read about. This list drives the nav
 * panel and the footer, so a new surface is added in exactly one place. Each
 * link lands on the section of the landing page that shows it working.
 */
export const productSurfaces: readonly ProductSurface[] = [
  {
    key: "ask",
    label: `Ask ${brand.name}`,
    blurb: "One question, one answer built from real rows: places, events, deals, your budget.",
    href: "/#ask",
    icon: Sparkles,
    accent: "signal",
  },
  {
    key: "pulse",
    label: brand.surfaces.pulse,
    blurb: "What students in your city are posting, asking and organising right now.",
    href: "/#pulse",
    icon: MessagesSquare,
    accent: "pulse",
  },
  {
    key: "anyone-down",
    label: brand.surfaces.anyoneDown,
    blurb: "Turn any event, place or plan into a group. Then a chat. Then a shared plan.",
    href: "/#anyone-down",
    icon: UsersRound,
    accent: "pulse",
  },
  {
    key: "events",
    label: "Event radar",
    blurb: "Tonight, free, under €10, campus, trending. Before it happened, not after.",
    href: "/#events",
    icon: Radar,
    accent: "amber",
  },
  {
    key: "budget",
    label: brand.surfaces.budget,
    blurb: "Safe today, safe this week, and whether tonight's plan actually fits.",
    href: "/#budget",
    icon: Banknote,
    accent: "flow",
  },
  {
    key: "lifeops",
    label: "LifeOps",
    blurb: "Deadlines, classes, tasks, plans and payments on one timeline.",
    href: "/#lifeops",
    icon: CalendarClock,
    accent: "flow",
  },
  {
    key: "missions",
    label: "Smart Missions",
    blurb: "Weekend under €30, first 7 days, make €50 last. Priced steps, not tips.",
    href: "/#missions",
    icon: Target,
    accent: "signal",
  },
  {
    key: "arrival",
    label: brand.surfaces.arrival,
    blurb: "Before arrival, first day, first week, first month. Official items link to sources.",
    href: "/#arrival",
    icon: Luggage,
    accent: "amber",
  },
  {
    key: "exchange",
    label: "Student Exchange",
    blurb: "Students leaving have what new students need. A desk, a bike, a lift to the airport.",
    href: "/#exchange",
    icon: ArrowLeftRight,
    accent: "mint",
  },
] as const;

export type NavItem = {
  label: string;
  href: string;
  /** When present the item opens a panel instead of navigating immediately. */
  panel?: "product";
};

export const primaryNav: readonly NavItem[] = [
  { label: "Product", href: "/#ask", panel: "product" },
  { label: "Pulse", href: "/#pulse" },
  { label: "Budget", href: "/#budget" },
  { label: "Cities", href: "/#cities" },
  { label: "Pricing", href: "/pricing" },
] as const;

export const authNav = {
  signIn: { label: "Sign in", href: "/signin" },
  primary: { label: "Get started", href: "/get-started" },
} as const;

export const footerNav: readonly { title: string; links: readonly NavItem[] }[] = [
  {
    title: "Product",
    links: productSurfaces.map((surface) => ({ label: surface.label, href: surface.href })),
  },
  {
    title: "Cities",
    links: [
      { label: "Madrid", href: "/city/madrid" },
      { label: "Barcelona", href: "/city/barcelona" },
      { label: "London", href: "/city/london" },
      { label: "Amsterdam", href: "/city/amsterdam" },
      { label: "Berlin", href: "/city/berlin" },
      { label: "All cities", href: "/students" },
    ],
  },
  {
    title: "Students",
    links: [
      { label: "Things to do", href: "/city/madrid/things-to-do" },
      { label: "Free events", href: "/city/madrid/free-events" },
      { label: "Cheap food", href: "/city/madrid/cheap-food" },
      { label: "Student deals", href: "/city/madrid/student-deals" },
      { label: "Starter pack", href: "/city/madrid/starter-pack" },
      { label: "Campuses", href: "/students#campuses" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "How answers are built", href: "/#ask" },
      { label: "Privacy and trust", href: "/#trust" },
      { label: "Contact", href: `mailto:${brand.contact.support}` },
    ],
  },
] as const;
