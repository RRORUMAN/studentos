import { BadgeCheck, Link2, Lock, type LucideIcon } from "lucide-react";

import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";

/**
 * Credibility without invented numbers.
 *
 * No partner logos, no "trusted by 40,000 students", no scraped review scores.
 * What a pre-launch product can honestly show is the standard it holds itself
 * to — and, unusually, the things it is refusing to do. The `never` line on each
 * card is the load-bearing one: a promise with a cost attached is the only kind
 * worth printing.
 */
const STANDARDS: readonly {
  icon: LucideIcon;
  title: string;
  body: string;
  never: string;
}[] = [
  {
    icon: BadgeCheck,
    title: "Prices come from students",
    body: "A price appears once students independently report it, and the number of people behind it is always on screen next to it.",
    never: "Never a menu scrape presented as a student price.",
  },
  {
    icon: Link2,
    title: "Every fact keeps its source",
    body: "Opening hours, fares and free windows are attributed to the official listing. Taste is attributed to students. You can see which is which on every row.",
    never: "Never laundered through a chatbot into one confident voice.",
  },
  {
    icon: Lock,
    title: "The community stays free",
    body: `${brand.surfaces.loop}, city chat, events, deals and joining other people's plans cost nothing, permanently and unmetered. Paid tiers buy depth — unlimited AI, the full map, forecasting, group planning — never access to other students.`,
    never: "Never a paywall between you and another student.",
  },
];

export function Standards() {
  return (
    <Section tone="warm" id="standards" className="py-16 sm:py-20 lg:py-24">
      <div className="page">
        <Reveal>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Eyebrow index="12">What we will not do</Eyebrow>
              <h2 className="mt-4 max-w-xl text-display-sm text-ink-950">
                Three standards, and what each one costs us.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-ink-500">
              Every screen on this site is built from sample data and says so. When a city&rsquo;s
              community is not open yet, the product prints that instead of filling the space.
            </p>
          </div>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-ink-200/70 md:grid-cols-3">
          {STANDARDS.map(({ icon: Icon, title, body, never }) => (
            <RevealItem key={title} className="flex flex-col bg-paper p-6 lg:p-7">
              <span className="grid size-10 place-items-center rounded-lg bg-ink-950 text-signal">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold tracking-[-0.02em] text-ink-950">
                {title}
              </h3>
              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-ink-600">{body}</p>
              <p className="mt-5 border-t border-ink-200 pt-4 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                {never}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </Section>
  );
}
