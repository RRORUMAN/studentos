import Link from "next/link";

import type { City } from "@/data/types";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { suffix: "", label: "Overview" },
  { suffix: "loop", label: "Loop" },
  { suffix: "things-to-do", label: "Things to do" },
  { suffix: "free-events", label: "Free events" },
  { suffix: "cheap-food", label: "Cheap food" },
  { suffix: "student-deals", label: "Student deals" },
  { suffix: "starter-pack", label: "Starter pack" },
] as const;

/**
 * City sub-navigation. Sticks under the main nav so a visitor who arrived on
 * "cheap food in Madrid" from a search result can see the rest of the city
 * without going back.
 */
export function CitySubnav({ city, active }: { city: City; active: string }) {
  return (
    <nav
      aria-label={`${city.name} sections`}
      className="sticky top-16 z-30 border-b border-ink-200 bg-paper/90 backdrop-blur-md"
    >
      <div className="page">
        <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 no-scrollbar edge-fade-x">
          {SECTIONS.map((section) => {
            const href = section.suffix
              ? `/city/${city.slug}/${section.suffix}`
              : `/city/${city.slug}`;
            const isActive = section.suffix === active;
            return (
              <li key={section.label}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative inline-flex shrink-0 items-center px-3 py-3.5 text-sm font-medium transition-colors",
                    isActive ? "text-ink-950" : "text-ink-500 hover:text-ink-900",
                  )}
                >
                  {section.label}
                  {isActive ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ink-950" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
