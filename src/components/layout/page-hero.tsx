import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/**
 * Compact hero for every page that is not the landing page. Keeps inner pages
 * visually part of the same product without repeating the marketing hero.
 */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  lead,
  actions,
  aside,
  tone = "paper",
}: {
  crumbs?: readonly Crumb[];
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  tone?: "paper" | "warm";
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-ink-200 py-12 sm:py-16",
        tone === "warm" ? "bg-paper-2" : "bg-paper",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-ink-300/50 dotfield [mask-image:radial-gradient(60%_70%_at_20%_0%,black,transparent)]"
      />
      <div className="page relative">
        {crumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-[0.8125rem] text-ink-400">
              {crumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-1">
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="rounded transition-colors hover:text-ink-900"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-ink-600">{crumb.label}</span>
                  )}
                  {index < crumbs.length - 1 ? (
                    <ChevronRight className="size-3.5 text-ink-300" aria-hidden />
                  ) : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <Reveal>
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <h1 className={cn("max-w-3xl text-display-lg text-ink-950", eyebrow && "mt-3")}>
              {title}
            </h1>
            {lead ? (
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-600">{lead}</p>
            ) : null}
            {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
          </Reveal>

          {aside ? <Reveal delay={0.05}>{aside}</Reveal> : null}
        </div>
      </div>
    </section>
  );
}
