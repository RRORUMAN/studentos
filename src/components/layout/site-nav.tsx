"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Wordmark } from "@/components/brand/logo";
import { accents } from "@/components/ui/accent";
import { ButtonLink } from "@/components/ui/button";
import { brand } from "@/brand/brand.config";
import { authNav, primaryNav, productSurfaces } from "@/config/site";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * Sticky navigation. Transparent over the hero, then it earns a background
 * once you scroll — the page should feel like it starts at the product, not
 * at a toolbar.
 */
export function SiteNav() {
  const reduced = useReducedMotion();
  const pathname = usePathname();

  const [scrolled, setScrolled] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Route change closes everything.
     Derived from the pathname rather than written by an effect: an effect that
     resets state after a navigation renders the new page with the old menu
     still open for one frame, and costs a second render to close it. */
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setMenuOpen(false);
    setProductOpen(false);
  }

  /* Escape closes, and the mobile sheet locks the page behind it. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setProductOpen(false);
      setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300",
        scrolled || menuOpen
          ? /* 95, not 85: at 85 the header went a muddy grey whenever it
               crossed the dark Ask section, which is most of the scroll on a
               phone. It still blurs, just no longer tints. */
            "bg-paper/95 shadow-[0_1px_0_0_var(--color-ink-200)] backdrop-blur-md"
          : "bg-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="page flex h-16 items-center justify-between gap-4"
        onMouseLeave={() => {
          closeTimer.current = window.setTimeout(() => setProductOpen(false), 120);
        }}
        onMouseEnter={() => window.clearTimeout(closeTimer.current)}
      >
        <Link
          href="/"
          className="shrink-0 rounded-md"
          aria-label={`${brand.name} home`}
          onClick={() => track("cta_clicked", { location: "nav-logo" })}
        >
          <Wordmark />
        </Link>

        {/* ---- desktop links ---------------------------------------------- */}
        <ul className="hidden items-center gap-0.5 lg:flex">
          {primaryNav.map((item) =>
            item.panel === "product" ? (
              <li key={item.label} className="relative">
                <button
                  type="button"
                  aria-expanded={productOpen}
                  aria-haspopup="true"
                  onClick={() => setProductOpen((open) => !open)}
                  onMouseEnter={() => setProductOpen(true)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    productOpen ? "bg-ink-100 text-ink-950" : "text-ink-600 hover:text-ink-950",
                  )}
                >
                  {item.label}
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", productOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
              </li>
            ) : (
              <li key={item.label}>
                <NavLink href={item.href} active={pathname === item.href}>
                  {item.label}
                </NavLink>
              </li>
            ),
          )}
        </ul>

        {/* ---- actions ------------------------------------------------------ */}
        <div className="flex items-center gap-2">
          <ButtonLink
            href={authNav.signIn.href}
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            {authNav.signIn.label}
          </ButtonLink>
          <ButtonLink
            href={authNav.primary.href}
            variant="primary"
            size="sm"
            onClick={() => track("cta_clicked", { location: "nav" })}
          >
            {authNav.primary.label}
          </ButtonLink>
          <button
            type="button"
            className="-mr-1.5 grid size-10 place-items-center rounded-full text-ink-700 transition-colors hover:bg-ink-100 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </nav>

      {/* ---- desktop product panel ----------------------------------------- */}
      <AnimatePresence>
        {productOpen ? (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduced ? 0 : duration.quick, ease: ease.out }}
            className="absolute inset-x-0 top-16 hidden lg:block"
            onMouseEnter={() => window.clearTimeout(closeTimer.current)}
          >
            <div className="page">
              <div className="overflow-hidden rounded-xl border border-ink-200 bg-white p-2 shadow-[var(--shadow-lift)]">
                <ul className="grid grid-cols-3 gap-1">
                  {productSurfaces.map((surface) => {
                    const Icon = surface.icon;
                    const accent = accents[surface.accent];
                    return (
                      <li key={surface.key}>
                        <Link
                          href={surface.href}
                          onClick={() => setProductOpen(false)}
                          className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-ink-50"
                        >
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-md",
                              accent.soft,
                              accent.text,
                            )}
                          >
                            <Icon className="size-4.5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-ink-950">
                              {surface.label}
                            </span>
                            <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-500">
                              {surface.blurb}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ---- mobile sheet --------------------------------------------------- */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            id="mobile-menu"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
            className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-ink-200 bg-paper lg:hidden"
          >
            <div className="page py-5">
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                Product
              </p>
              <ul className="mt-2.5 grid gap-1 sm:grid-cols-2">
                {productSurfaces.map((surface) => {
                  const Icon = surface.icon;
                  const accent = accents[surface.accent];
                  return (
                    <li key={surface.key}>
                      <Link
                        href={surface.href}
                        className="flex items-center gap-3 rounded-lg p-2.5 transition-colors active:bg-ink-100"
                      >
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-md",
                            accent.soft,
                            accent.text,
                          )}
                        >
                          <Icon className="size-4.5" aria-hidden />
                        </span>
                        <span className="text-[0.9375rem] font-medium text-ink-950">
                          {surface.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-6 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                Go to
              </p>
              <ul className="mt-2 flex flex-col">
                {primaryNav
                  .filter((item) => !item.panel)
                  .map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="block border-b border-ink-100 py-3 text-lg font-medium text-ink-900"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                <li>
                  <Link
                    href={authNav.signIn.href}
                    className="block border-b border-ink-100 py-3 text-lg font-medium text-ink-900"
                  >
                    {authNav.signIn.label}
                  </Link>
                </li>
              </ul>

              <ButtonLink
                href={authNav.primary.href}
                variant="signal"
                size="lg"
                block
                className="mt-5"
                onClick={() => track("cta_clicked", { location: "nav-mobile" })}
              >
                {authNav.primary.label}
              </ButtonLink>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-ink-950" : "text-ink-600 hover:text-ink-950",
      )}
    >
      {children}
    </Link>
  );
}
