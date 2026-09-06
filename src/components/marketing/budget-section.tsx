import { ArrowRight } from "lucide-react";

import { MascotArt } from "@/components/mascot/mascot-art";
import { BudgetPanel } from "@/components/product/budget-panel";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { budgetMonth, categoryRemaining, safeToday, tonightPlanCost, weeklyDelta } from "@/data/budget";
import { money } from "@/lib/utils";

export function BudgetSection() {
  const safe = safeToday();
  const goingOut = categoryRemaining("going-out");
  const delta = weeklyDelta();

  return (
    <Section id="budget" tone="flow">
      <div className="page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-center lg:gap-14">
          <Reveal kind="blur" className="order-2 w-full lg:order-1">
            <BudgetPanel />
          </Reveal>

          <div className="order-1 lg:order-2">
            <Reveal>
              <Eyebrow index="07">
                {brand.surfaces.budget}
              </Eyebrow>
              <h2 className="mt-4 text-display-md text-ink-950">
                Your budget should tell you what you <em className="not-italic text-signal-deep">can</em>{" "}
                do.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
                Budgeting apps are built for people with salaries. They show you a pie chart of a
                month that already happened. This answers the only question that matters on a
                Thursday night: can I go out, and for how much.
              </p>
            </Reveal>

            <RevealGroup className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Safe today",
                  value: money(safe),
                  note: `After ${budgetMonth.upcoming.length} known charges, across ${budgetMonth.daysLeft} days`,
                },
                {
                  label: "Going out left",
                  value: money(goingOut),
                  note: "This month, in the category that decides your weekend",
                },
                {
                  label: "Versus target",
                  value: `${delta >= 0 ? "−" : "+"}${money(Math.abs(delta))}`,
                  note: delta >= 0 ? "Under your weekly target" : "Over your weekly target",
                },
              ].map((stat) => (
                <RevealItem
                  key={stat.label}
                  className="rounded-lg border border-ink-200 bg-paper p-4"
                >
                  <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                    {stat.label}
                  </p>
                  <p className="tnum mt-1.5 font-mono text-2xl font-semibold text-ink-950">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-xs leading-snug text-ink-500">{stat.note}</p>
                </RevealItem>
              ))}
            </RevealGroup>

            {/* ---- the mascot verdict --------------------------------------
                The whole budget argument in one line: not a chart of a month
                that already happened, but an answer to tonight. He is the
                supporting voice here rather than the focus — a money surface
                has to read as trustworthy first, and a character delivering
                the numbers themselves would undercut that. */}
            <Reveal delay={0.08}>
              <div className="mt-8 flex items-center gap-3.5 rounded-xl border border-ink-950/10 bg-white p-4">
                <MascotArt
                  state={tonightPlanCost <= safe ? "excited" : "warning"}
                  className="size-12 shrink-0"
                />
                <p className="text-[0.9375rem] leading-snug text-ink-700">
                  {tonightPlanCost <= safe ? (
                    <>
                      <span className="font-semibold text-ink-950">
                        Tonight&rsquo;s {money(tonightPlanCost)} plan fits.
                      </span>{" "}
                      You are still inside the day.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-ink-950">
                        That is {money(tonightPlanCost - safe)} over today.
                      </span>{" "}
                      Take the free option tonight.
                    </>
                  )}
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-xl text-[0.875rem] leading-relaxed text-ink-500">
                Budget data never leaves your account. It is not sold, not shared with venues, and
                never attached to an error report.
              </p>
              <ButtonLink href="/get-started" variant="signal" size="lg" className="group mt-6">
                Plan around my budget
                <ArrowRight
                  className="size-4.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </ButtonLink>
            </Reveal>
          </div>
        </div>
      </div>
    </Section>
  );
}
