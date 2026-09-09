"use client";

import {
  Compass,
  House,
  Languages,
  ListChecks,
  MessagesSquare,
  Sparkles,
  Target,
  User,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MascotArt } from "@/components/mascot/mascot-art";
import { brand } from "@/brand/brand.config";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * APP NAVIGATION
 * ----------------------------------------------------------------------------
 * Five destinations on mobile, six on desktop, one list of routes.
 *
 * MOBILE  Home · Today · Ask · Pulse · You. Ask is raised in the middle: it
 *         is the one action that is always useful and it should be reachable
 *         with a thumb from any screen. "Today" is LifeOps — the answer to
 *         "what do I need to care about", which is the question a student
 *         opens the app with on a weekday morning.
 *
 *         Discover, Events, Budget, Missions, Exchange, Plans and Saved are
 *         reached from Home, from Today, and from the More sheet on You —
 *         a bar with eleven items is a bar nobody reads.
 *
 * DESKTOP Home · Today · Discover · Pulse · Budget · Missions, with Ask as a
 *         standing pill on the right. There is room, and a mouse does not
 *         care about reach.
 *
 * Both are deliberately quiet: no fills, no badges except the notification
 * dot, one active state. The content is meant to be the loud thing.
 * ============================================================================
 */

type Item = { href: string; label: string; icon: typeof House; center?: boolean };

const MOBILE: readonly Item[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/lifeops", label: "Today", icon: ListChecks },
  { href: "/ask", label: "Ask", icon: Sparkles, center: true },
  { href: "/pulse", label: "Pulse", icon: MessagesSquare },
  { href: "/you", label: "You", icon: User },
];

const DESKTOP: readonly Item[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/lifeops", label: "Today", icon: ListChecks },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/pulse", label: "Pulse", icon: MessagesSquare },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/speak", label: "Speak", icon: Languages },
  { href: "/missions", label: "Missions", icon: Target },
];

/**
 * Aliases: a student on a sub-surface should see its parent lit. Events live
 * under Discover; Arrival and Leaving are the timeline in another shape.
 */
const ALIASES: Record<string, string> = {
  "/events": "/discover",
  "/arrival": "/lifeops",
  "/leaving": "/lifeops",
};

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => {
    const path = Object.entries(ALIASES).reduce(
      (current, [from, to]) => (current === from || current.startsWith(`${from}/`) ? to : current),
      pathname,
    );
    return path === href || path.startsWith(`${href}/`);
  };
}

/* -------------------------------------------------------------------------- */
/* Mobile                                                                      */
/* -------------------------------------------------------------------------- */

export function MobileNav() {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 lg:hidden",
        "border-t border-ink-200/70 bg-paper/94 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex max-w-md items-end justify-around px-2">
        {MOBILE.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          if (item.center) {
            return (
              <li key={item.href} className="-mt-5">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex flex-col items-center gap-1 transition-transform duration-150 active:translate-y-px"
                >
                  <span
                    className={cn(
                      "grid size-13 place-items-center rounded-full shadow-[var(--shadow-float)] ring-4 ring-paper transition-colors",
                      active ? "bg-ink-950" : "bg-signal",
                    )}
                  >
                    <Icon className={cn("size-6", active ? "text-signal" : "text-ink-950")} strokeWidth={2.2} />
                  </span>
                  <span className="pb-1.5 text-[0.6875rem] font-medium text-ink-600">{item.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-16 flex-col items-center gap-1 py-2.5 transition-colors duration-150",
                  active ? "text-ink-950" : "text-ink-400 hover:text-ink-700",
                )}
              >
                <Icon className="size-5.5" strokeWidth={active ? 2.4 : 1.9} />
                <span className="text-[0.6875rem] font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop                                                                     */
/* -------------------------------------------------------------------------- */

export function DesktopNav() {
  const isActive = useIsActive();

  return (
    <nav aria-label="Main" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {DESKTOP.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-[0.9375rem] font-medium transition-colors duration-150",
                  active ? "bg-ink-950 text-paper" : "text-ink-600 hover:bg-ink-100 hover:text-ink-950",
                )}
              >
                <Icon className="size-4" strokeWidth={2} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The standing Ask control on desktop. Always one click away. */
export function DesktopAsk() {
  const isActive = useIsActive();
  const active = isActive("/ask");
  return (
    <Link
      href="/ask"
      aria-current={active ? "page" : undefined}
      className={cn(
        "hidden items-center gap-2 rounded-full px-4 py-2 text-[0.9375rem] font-semibold transition-colors lg:flex",
        active ? "bg-ink-950 text-signal" : "bg-signal text-ink-950 hover:brightness-[1.04]",
      )}
    >
      <Sparkles className="size-4" strokeWidth={2.2} />
      Ask
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Brand mark                                                                  */
/* -------------------------------------------------------------------------- */

export function AppMark({ city, campus }: { city?: string; campus?: string | null }) {
  return (
    <Link href="/home" aria-label={`${brand.name} home`} className="flex min-w-0 shrink items-center gap-2">
      <MascotArt state="neutral" className="size-8 shrink-0" />
      <span className="hidden font-display text-[1.0625rem] font-semibold tracking-tight text-ink-950 lg:block">
        {brand.name}
      </span>
      {city ? (
        <span className="min-w-0 truncate font-mono text-micro uppercase tracking-[0.1em] text-ink-400 lg:hidden">
          {city}
          {campus ? ` · ${campus}` : ""}
        </span>
      ) : null}
    </Link>
  );
}
