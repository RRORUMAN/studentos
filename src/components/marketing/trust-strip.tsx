import { Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { trustPoints } from "@/data/brain";

/**
 * ============================================================================
 * TRUST
 * ----------------------------------------------------------------------------
 * Deliberately a strip, not a section. StudentOS is not a security product and
 * a page that argues about privacy at length starts to sound like one; these
 * are five commitments, stated once, in the place a student starts wondering
 * what they are handing over.
 * ============================================================================
 */
export function TrustStrip() {
  return (
    <Section id="trust" tone="warm" className="py-14 sm:py-16 lg:py-20">
      <div className="page">
        <div className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6">
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            What we will not do with your data
          </p>
          <Reveal>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {trustPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.label} className="flex gap-3 lg:flex-col lg:gap-2">
                    <Icon className="size-5 shrink-0 text-ink-400" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[0.875rem] font-semibold text-ink-950">
                        {point.label}
                      </span>
                      <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-500">
                        {point.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
