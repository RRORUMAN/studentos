/**
 * ============================================================================
 * BRAND — single source of truth.
 * ----------------------------------------------------------------------------
 * Every user-visible reference to the product name, tagline, voice and legal
 * entity flows from this file. Renaming the product globally = editing `name`.
 * Nothing else in the codebase should hardcode the string "StudentOS".
 * ============================================================================
 */

export const brand = {
  /** Product name. Change this one value to rename the product everywhere. */
  name: "StudentOS",
  /** Lowercase machine-safe slug, used for storage keys, ids and file names. */
  slug: "studentos",
  /** Short-form used inside dense product UI where the full name is too long. */
  shortName: "OS",
  /** Positioning line. One sentence, no buzzwords. */
  tagline: "The operating system for living abroad as a student.",
  /** Used as the default meta description and in share cards. */
  description:
    "Real student knowledge plus AI, your location and your budget — so you know where to go, what to do, what you can afford and who wants to join.",
  /** Primary domain. Used for canonical URLs, sitemap and share links. */
  domain: "studentos.app",
  get url() {
    return `https://${this.domain}`;
  },
  /** Legal entity shown in the footer. */
  legalName: "StudentOS Labs",
  /** Support + press contacts. */
  contact: {
    support: "hey@studentos.app",
    press: "press@studentos.app",
  },
  social: {
    instagram: "https://instagram.com/studentos",
    tiktok: "https://tiktok.com/@studentos",
    x: "https://x.com/studentos",
  },
  /** Default display currency for the marketing experience. */
  currency: {
    code: "EUR",
    symbol: "€",
    locale: "en-IE",
  },
  /**
   * Named product surfaces. These are proper nouns in the copy, so they live
   * here rather than being retyped across twenty components.
   */
  surfaces: {
    loop: "Student Pulse",
    pulse: "Student Pulse",
    chat: "Chat",
    ask: "Ask",
    brain: "AI City Brain",
    anyoneDown: "Anyone Down?",
    arrival: "Arrival Mode",
    discover: "Discover",
    budget: "Budget",
    plans: "Plans",
  },
  /** Voice rules, kept next to the brand so copy reviews have one home. */
  voice: {
    do: [
      "Say the number.",
      "Speak like a student who has already figured it out.",
      "Short sentences. Real places. Real prices.",
    ],
    dont: [
      "No growth-hack hype.",
      "No fabricated stats, partners or testimonials.",
      "Never imply a recommendation is verified when it is not.",
    ],
  },
} as const;

export type Brand = typeof brand;

/** Convenience: `${brand.name}` is used constantly in copy interpolation. */
export const BRAND = brand.name;
