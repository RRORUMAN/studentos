import { Quote } from "lucide-react";

import { Atmosphere, Avatar, Eyebrow, SampleTag, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { getCity } from "@/data/cities";
import {
  featuredTestimonial,
  sampleContent,
  supportingTestimonials,
  type Testimonial,
} from "@/data/testimonials";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * TESTIMONIALS
 * ----------------------------------------------------------------------------
 * Layout: one pull quote at editorial scale, then the rest in a masonry column
 * flow so the cards keep their natural height instead of being padded to a
 * common grid row. Quotes are different lengths in real life and a grid that
 * pretends otherwise is the tell of a fabricated wall.
 *
 * The `sampleContent` flag in data/testimonials.ts drives the disclosure line
 * and the sample marker. While it is true this section says so out loud — see
 * that file for why that is deliberate rather than a placeholder to remove.
 * ============================================================================
 */
export function Testimonials() {
  return (
    <Section id="students-say" tone="tint" className="overflow-hidden">
      <Atmosphere
        grid={false}
        blobs={[
          { className: "-top-52 left-[-14rem] size-[38rem] bg-signal/25", drift: "a" },
          { className: "bottom-[-24rem] right-[-16rem] size-[34rem] bg-mint/12", drift: "b" },
        ]}
      />

      <div className="page relative">
        <Reveal>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <Eyebrow index="13">In their words</Eyebrow>
              <h2 className="mt-4 max-w-2xl text-display-md text-ink-950">
                The gap between a tourist month and a student month is about €200.
              </h2>
            </div>
            {sampleContent ? (
              <div className="shrink-0 rounded-lg border border-ink-200 bg-white/70 p-4 md:max-w-xs">
                <SampleTag label="Illustrative" />
                <p className="mt-2 text-xs leading-relaxed text-ink-500">
                  These are written from closed-test interviews and are marked as samples until the
                  students in that group agree to be quoted by name. We would rather show the shape
                  of the section than invent people to fill it.
                </p>
              </div>
            ) : null}
          </div>
        </Reveal>

        {/* ---- pull quote ---------------------------------------------------- */}
        <Reveal delay={0.05}>
          <figure className="mt-12 grid gap-8 rounded-2xl bg-ink-950 p-7 text-white sm:p-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end lg:gap-12">
            <div>
              <Quote className="size-8 text-signal" aria-hidden />
              <blockquote className="mt-5 font-display text-2xl leading-[1.28] font-medium tracking-[-0.02em] text-balance sm:text-3xl sm:leading-[1.24]">
                {featuredTestimonial.quote}
              </blockquote>
              <figcaption className="mt-7 flex items-center gap-3">
                <Avatar initials={featuredTestimonial.initials} />
                <div>
                  <p className="text-[0.9375rem] font-medium text-white">
                    {featuredTestimonial.name}
                  </p>
                  <p className="text-sm text-white/50">{featuredTestimonial.context}</p>
                </div>
              </figcaption>
            </div>

            {featuredTestimonial.outcome ? (
              <div className="rounded-xl bg-signal p-6 text-ink-950">
                <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-950/60">
                  What changed
                </p>
                <p className="tnum mt-2 font-display text-2xl leading-tight font-semibold tracking-[-0.025em]">
                  {featuredTestimonial.outcome}
                </p>
              </div>
            ) : null}
          </figure>
        </Reveal>

        {/* ---- the rest ------------------------------------------------------ */}
        <RevealGroup
          step={0.05}
          className="mt-6 gap-6 sm:columns-2 lg:columns-3 [&>*]:mb-6 [&>*]:break-inside-avoid"
        >
          {supportingTestimonials.map((entry) => (
            <RevealItem key={entry.id}>
              <TestimonialCard entry={entry} />
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </Section>
  );
}

function TestimonialCard({ entry }: { entry: Testimonial }) {
  const city = entry.citySlug ? getCity(entry.citySlug) : undefined;

  return (
    <figure
      className={cn(
        "flex flex-col rounded-xl border border-ink-200/80 bg-white/80 p-5 backdrop-blur-sm",
        "transition-[border-color,box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-[var(--shadow-float)]",
      )}
    >
      {entry.outcome ? (
        <span className="tnum mb-3 self-start rounded-full bg-mint-soft px-2.5 py-1 text-micro font-semibold uppercase tracking-[0.06em] text-mint-deep">
          {entry.outcome}
        </span>
      ) : null}

      <blockquote className="text-[0.9375rem] leading-relaxed text-ink-800">
        {entry.quote}
      </blockquote>

      <figcaption className="mt-5 flex items-center gap-3 border-t border-ink-100 pt-4">
        <Avatar initials={entry.initials} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-950">{entry.name}</p>
          <p className="truncate text-xs text-ink-500">{entry.context}</p>
        </div>
        {city ? (
          <span className="ml-auto shrink-0 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            {city.name}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
