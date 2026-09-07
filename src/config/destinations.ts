import {
  Bookmark,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  Compass,
  type LucideIcon,
  Package,
  Target,
  UsersRound,
  Wallet,
} from "lucide-react";

/**
 * ============================================================================
 * DESTINATIONS
 * ----------------------------------------------------------------------------
 * Everything that is not in the navigation bar, in one list.
 *
 * It lives here rather than next to the nav component for a reason worth
 * stating: `app-nav.tsx` is a client module, and a plain array exported from a
 * client module is replaced by a client-reference proxy when a *server*
 * component imports it. In development that silently works; in a production
 * build it becomes an object with no `.map`, and the You page throws. This
 * file has no `"use client"`, so both sides get the real array.
 * ============================================================================
 */

export type Destination = {
  href: string;
  label: string;
  detail: string;
  icon: LucideIcon;
};

export const MORE_DESTINATIONS: readonly Destination[] = [
  { href: "/discover", label: "Discover", detail: "Map, cheap food, study spots, what is on right now", icon: Compass },
  { href: "/events", label: "Event radar", detail: "Tonight, free, under €10, campus, trending", icon: CalendarDays },
  { href: "/budget", label: "Budget", detail: "Safe to spend today, can I afford this, survival mode", icon: Wallet },
  { href: "/work", label: "Work", detail: "Part-time jobs, gigs and paid projects that fit your week", icon: Briefcase },
  { href: "/missions", label: "Smart Missions", detail: "A weekend under budget, meet three people", icon: Target },
  { href: "/exchange", label: "Student Exchange", detail: "Buy, borrow, help, share a ride, free stuff", icon: Package },
  { href: "/anyone-down", label: "Anyone down?", detail: "Turn anything into a group", icon: UsersRound },
  { href: "/plans", label: "Plans", detail: "Yours and the ones you were invited to", icon: CalendarCheck },
  { href: "/saved", label: "Saved", detail: "Places, events, deals and listings you kept", icon: Bookmark },
];
