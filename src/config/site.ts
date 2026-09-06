import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CalendarHeart,
  Compass,
  Luggage,
  MessagesSquare,
  Sparkles,
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
 * The six product surfaces. This list drives the nav mega-panel, the footer,
 * the "one app instead of ten" section and the city page sub-navigation, so a
 * new surface is added in exactly one place.
 */
export const productSurfaces: readonly ProductSurface[] = [
  {
    key: "loop",
    label: brand.surfaces.loop,
    blurb: "What students in your city are posting, asking and organising right now.",
    href: "/#loop",
    icon: MessagesSquare,
    accent: "pulse",
  },
  {
    key: "brain",
    label: brand.surfaces.brain,
    blurb: "Answers built from student knowledge and local data, with sources attached.",
    href: "/#city-brain",
    icon: Sparkles,
    accent: "signal",
  },
  {
    key: "discover",
    label: brand.surfaces.discover,
    blurb: "A map that knows the price, the walk and whether students actually go.",
    href: "/#discover",
    icon: Compass,
    accent: "mint",
  },
  {
    key: "budget",
    label: brand.surfaces.budget,
    blurb: "Not a spreadsheet. A number that tells you what tonight can cost.",
    href: "/#budget",
    icon: Banknote,
    accent: "flow",
  },
  {
    key: "anyone-down",
    label: brand.surfaces.anyoneDown,
    blurb: "Turn a plan into a group before you know anyone properly.",
    href: "/#anyone-down",
    icon: CalendarHeart,
    accent: "pulse",
  },
  {
    key: "arrival",
    label: brand.surfaces.arrival,
    blurb: "Transport card, SIM, bank, gym. The first-two-weeks list, per city.",
    href: "/#arrival",
    icon: Luggage,
    accent: "amber",
  },
] as const;

export type NavItem = {
  label: string;
  href: string;
  /** When present the item opens a panel instead of navigating immediately. */
  panel?: "product";
};

export const primaryNav: readonly NavItem[] = [
  { label: "Product", href: "/#product", panel: "product" },
  { label: "Pulse", href: "/#loop" },
  { label: "Discover", href: "/#discover" },
  { label: "Budget", href: "/#budget" },
  { label: "Students", href: "/students" },
  { label: "Pricing", href: "/pricing" },
] as const;

export const authNav = {
  signIn: { label: "Sign in", href: "/login" },
  primary: { label: "Get started free", href: "/signup" },
} as const;

export const footerNav: readonly { title: string; links: readonly NavItem[] }[] = [
  {
    title: "Product",
    links: [
      { label: brand.surfaces.loop, href: "/#loop" },
      { label: brand.surfaces.brain, href: "/#city-brain" },
      { label: brand.surfaces.discover, href: "/#discover" },
      { label: brand.surfaces.budget, href: "/#budget" },
      { label: brand.surfaces.anyoneDown, href: "/#anyone-down" },
      { label: brand.surfaces.arrival, href: "/#arrival" },
    ],
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
      { label: "How recommendations work", href: "/#city-brain" },
      { label: "Contact", href: `mailto:${brand.contact.support}` },
    ],
  },
] as const;
