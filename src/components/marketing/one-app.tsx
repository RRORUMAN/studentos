import { ArrowDown } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { collapsedApps } from "@/data/brain";
import { brand } from "@/brand/brand.config";

/**
 * ============================================================================
 * ONE APP INSTEAD OF TEN
 * ----------------------------------------------------------------------------
 * Generic category icons, never trademarked logos: the point is the *number*
 * of apps a student juggles in month one, and naming brands would turn an
 * argument about attention into an argument about competitors.
 *
 * The layout does the talking — a scattered row of tiles above, one wordmark
 * below, an arrow between them.
 * ============================================================================
 */
export function OneApp() {
  return (
    <Section id="one-app" tone="warm">
      <div className="page">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow index="15" className="justify-center">
            One app
          </Eyebrow>
          <h2 className="mt-4 text-display-md text-ink-950">
            Your city. Your money. Your people. Your plans.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-600 sm:text-lg">
            Month one abroad currently takes about eight apps and a group chat nobody can search.
            None of them know what the others know.
          </p>
        </div>

        <RevealGroup
          step={0.04}
          className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-2.5 sm:gap-3"
        >
          {collapsedApps.map((app) => {
            const Icon = app.icon;
            return (
              <RevealItem key={app.label}>
                <span
                  style={{ transform: `rotate(${app.rotate}deg)` }}
                  className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[0.8125rem] font-medium text-ink-500 shadow-[var(--shadow-flat)]"
                >
                  <Icon className="size-4 shrink-0 text-ink-400" aria-hidden />
                  {app.label}
                </span>
              </RevealItem>
            );
          })}
        </RevealGroup>

        <Reveal delay={0.1} className="mt-8 flex flex-col items-center">
          <ArrowDown className="size-5 text-ink-300" aria-hidden />
          <div className="mt-6 rounded-2xl bg-ink-950 px-6 py-5 shadow-[var(--shadow-lift)]">
            <Wordmark tone="dark" className="scale-125" />
          </div>
          <p className="mt-6 text-display-xs text-ink-950">One place.</p>
          <p className="mt-2 max-w-md text-center text-[0.9375rem] leading-relaxed text-ink-600">
            The budget knows what the events cost. The events know who your friends are. The
            timeline knows what you already said yes to. That is the whole reason {brand.name}{" "}
            exists as one product instead of eight.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
