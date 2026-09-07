import { Avatar, Badge, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import {
  featuredTestimonial,
  hasTestimonials,
  supportingTestimonials,
} from "@/data/testimonials";

/**
 * ============================================================================
 * TESTIMONIALS
 * ----------------------------------------------------------------------------
 * The production UI, wired to an empty list.
 *
 * `data/testimonials.ts` ships with no rows, so this component renders
 * *nothing* — no placeholder, no "coming soon", no invented quote behind a
 * sample marker. The brand rule is no fabricated testimonials, and the only
 * way to hold a page to that under deadline is to make the empty state the
 * default rather than a decision someone has to keep making.
 *
 * Add one consented quote with `featured: true` and the section appears: a
 * large pull-quote, then the rest as smaller stories.
 * ============================================================================
 */
export function Testimonials() {
  if (!hasTestimonials || !featuredTestimonial) return null;

  return (
    <Section id="students" tone="paper">
      <div className="page">
        <SectionHeader
          eyebrow="Students"
          title="What students say."
          lead="Quotes from students who use it, published with their permission."
        />

        <Reveal className="mt-10">
          <figure className="rounded-2xl bg-white p-6 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5 sm:p-8">
            <blockquote className="text-display-xs leading-snug text-ink-950">
              &ldquo;{featuredTestimonial.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 flex flex-wrap items-center gap-3">
              <Avatar initials={featuredTestimonial.initials} />
              <span>
                <span className="block text-[0.9375rem] font-medium text-ink-950">
                  {featuredTestimonial.name}
                </span>
                <span className="block text-[0.8125rem] text-ink-500">
                  {featuredTestimonial.context}
                </span>
              </span>
              {featuredTestimonial.outcome ? (
                <Badge accent="mint" className="ml-auto">
                  {featuredTestimonial.outcome}
                </Badge>
              ) : null}
            </figcaption>
          </figure>
        </Reveal>

        {supportingTestimonials.length > 0 ? (
          <RevealGroup step={0.05} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {supportingTestimonials.map((entry) => (
              <RevealItem key={entry.id}>
                <figure className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/5">
                  <blockquote className="text-[0.9375rem] leading-relaxed text-ink-700">
                    &ldquo;{entry.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-2.5 border-t border-ink-100 pt-4">
                    <Avatar initials={entry.initials} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[0.875rem] font-medium text-ink-950">
                        {entry.name}
                      </span>
                      <span className="block truncate text-xs text-ink-500">{entry.context}</span>
                    </span>
                  </figcaption>
                </figure>
              </RevealItem>
            ))}
          </RevealGroup>
        ) : null}
      </div>
    </Section>
  );
}
