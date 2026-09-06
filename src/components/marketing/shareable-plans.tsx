import { SharePlanActions, SharePlanCard } from "@/components/product/share-plan-card";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { getCity } from "@/data/cities";
import { sharePlans } from "@/data/plans";

/**
 * Plans are the unit that travels. A student screenshots one into a group chat
 * and three people arrive at the same bar — which is cheaper acquisition than
 * anything we could buy, and only works if the card looks good at story size.
 */
export function ShareablePlans() {
  return (
    <Section id="plans" tone="warm">
      <div className="page">
        <Reveal>
          <Eyebrow index="15">
            Shareable plans
          </Eyebrow>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-2xl text-display-md text-ink-950">
              A plan is the thing people actually send each other.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-ink-600">
              Built to survive a screenshot: one loud total, five readable lines, and type that
              still works at story size on a cracked phone.
            </p>
          </div>
        </Reveal>

        <div className="-mx-5 mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4 no-scrollbar sm:mx-0 sm:px-0 lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible">
          {sharePlans.map((plan) => {
            const city = getCity(plan.citySlug);
            return (
              <div key={plan.id} className="w-[17rem] shrink-0 snap-center sm:w-[19rem] lg:w-auto">
                <SharePlanCard plan={plan} className="mx-auto" />
                <div className="mt-6 flex flex-col items-start gap-3">
                  <p className="text-sm text-ink-500">
                    {city?.name} · {plan.items.length} stops
                  </p>
                  <SharePlanActions plan={plan} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
