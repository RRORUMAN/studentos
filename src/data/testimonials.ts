/**
 * ============================================================================
 * TESTIMONIALS
 * ----------------------------------------------------------------------------
 * Empty on purpose. The brand rule is "no fabricated stats, partners or
 * testimonials" (see brand.config.ts), so this list ships with nothing in it
 * and the Testimonials section renders nothing until a real student has given
 * a real quote and consented to publish it.
 *
 * The section UI is built and waiting: the first entry with `featured: true`
 * takes the large pull-quote slot, the rest render as smaller stories. Add a
 * row shaped like the commented example and the section appears on its own.
 * ============================================================================
 */

export type Testimonial = {
  id: string;
  quote: string;
  /** First name plus initial. Full names only with written consent. */
  name: string;
  /** Initials for the avatar. Never a photo. */
  initials: string;
  /** Course or programme, then the university. */
  context: string;
  citySlug?: string;
  /** The specific, checkable result. Rendered as a chip beside the quote. */
  outcome?: string;
  /** Promotes the quote to the large pull-quote slot. Exactly one should have it. */
  featured?: boolean;
};

export const testimonials: readonly Testimonial[] = [
  /* Example. Replace with a real, consented quote before uncommenting:
  {
    id: "t-1",
    quote: "It knew my semester ticket already covered transport and stopped adding fares to every plan. Small thing. It is why I believed the rest of the numbers.",
    name: "First name L.",
    initials: "FL",
    context: "Exchange, Humboldt-Universität zu Berlin",
    citySlug: "berlin",
    outcome: "€0 spent on single fares",
    featured: true,
  },
  */
];

export const hasTestimonials = testimonials.length > 0;

export const featuredTestimonial: Testimonial | undefined =
  testimonials.find((entry) => entry.featured) ?? testimonials[0];

export const supportingTestimonials: readonly Testimonial[] = testimonials.filter(
  (entry) => entry.id !== featuredTestimonial?.id,
);
