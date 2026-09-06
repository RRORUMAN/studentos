/**
 * ============================================================================
 * TESTIMONIALS
 * ----------------------------------------------------------------------------
 * READ THIS BEFORE PUBLISHING.
 *
 * The brand voice rule is "no fabricated stats, partners or testimonials"
 * (see brand.config.ts), and these are seeded. They are therefore rendered
 * behind the same `SampleTag` every other demo on the site carries, and the
 * section header says in plain words that they are illustrative until the
 * closed test group reports back.
 *
 * `sampleContent` is the switch. Set it to `false` only when every row below has
 * been replaced with a quote a named student actually gave and consented to
 * publish — at that point the sample marker and the disclosure line disappear on
 * their own. Do not flip it to make the page look better; the whole value of the
 * marker is that it is honest when it is inconvenient.
 *
 * Shape notes for whoever swaps these out:
 *   `outcome`  a number the student can point at. This is the part that
 *              persuades; "great app!" persuades nobody. Keep it specific.
 *   `context`  where they were and what they were doing. Erasmus in Madrid is a
 *              different problem from a masters in London.
 * ============================================================================
 */

export const sampleContent = true;

export type Testimonial = {
  id: string;
  quote: string;
  /** First name plus initial. Full names only with written consent. */
  name: string;
  initials: string;
  /** Course or programme, then the city. */
  context: string;
  citySlug?: string;
  /** The specific, checkable result. Rendered as a chip beside the quote. */
  outcome?: string;
  /** Promotes the quote to the large pull-quote slot. Exactly one should have it. */
  featured?: boolean;
};

export const testimonials: readonly Testimonial[] = [
  {
    id: "t-featured",
    quote:
      "I spent my first three weeks in Madrid paying tourist prices two streets from where the students eat. Nobody tells you that. The app told me on day one, with the number next to it — and it showed me who else was going.",
    name: "Aya M.",
    initials: "AM",
    context: "Erasmus, Complutense de Madrid",
    citySlug: "madrid",
    outcome: "€180 saved in month one",
    featured: true,
  },
  {
    id: "t-budget",
    quote:
      "The budget thing is the only one I have kept. It does not lecture me about coffee — it tells me what tonight can cost and then plans a night that fits.",
    name: "Seb A.",
    initials: "SA",
    context: "Engineering, Carlos III",
    citySlug: "madrid",
    outcome: "Ended term €0 overdrawn",
  },
  {
    id: "t-arrival",
    quote:
      "Transport card, SIM, bank, residency registration — in order, per city, with the official link on each one. That list saved me a fortnight of asking strangers.",
    name: "Yuki T.",
    initials: "YT",
    context: "Exchange, Universitat de Barcelona",
    citySlug: "barcelona",
    outcome: "Set up in 4 days, not 3 weeks",
  },
  {
    id: "t-anyone-down",
    quote:
      "Anyone Down? did the thing I could not do myself in a new city. You post the plan, not yourself. Two people showed up and one of them is still my flatmate.",
    name: "Hakim B.",
    initials: "HB",
    context: "Masters, Politécnica de Madrid",
    citySlug: "madrid",
  },
  {
    id: "t-sources",
    quote:
      "What made me trust it was the sources. Every row says whether it came from students or the official listing. I have never seen an AI app admit which half it is guessing at.",
    name: "Ines C.",
    initials: "IC",
    context: "Economics, Pompeu Fabra",
    citySlug: "barcelona",
  },
  {
    id: "t-london",
    quote:
      "London eats your money in transport and lunch and nothing else. It worked that out in a week and rebuilt my routine around the free museums.",
    name: "Priya R.",
    initials: "PR",
    context: "Postgrad, UCL",
    citySlug: "london",
    outcome: "£95 a month off transport",
  },
  {
    id: "t-berlin",
    quote:
      "It knew my semester ticket already covered transport and stopped adding fares to every plan. Small thing. It is the reason I believed the rest of the numbers.",
    name: "Lena K.",
    initials: "LK",
    context: "Exchange, Humboldt Berlin",
    citySlug: "berlin",
  },
  {
    id: "t-pulse",
    quote:
      "The city feed is the part I open daily. Not influencers — people at my campus posting what is actually free this week.",
    name: "Pau V.",
    initials: "PV",
    context: "Design, Universitat de Barcelona",
    citySlug: "barcelona",
  },
];

export const featuredTestimonial =
  testimonials.find((entry) => entry.featured) ?? testimonials[0];

export const supportingTestimonials = testimonials.filter((entry) => !entry.featured);
