import type { GuideCategory } from "@/domain/knowledge";
import type { CommunityKind } from "@/domain/social";
import type { EventKind } from "@/domain/types";

/**
 * ============================================================================
 * SEED CONTENT
 * ----------------------------------------------------------------------------
 * The rows a fresh install starts with, so the product is explorable before a
 * single student has posted anything.
 *
 * Two honesty rules govern everything in this file, and they are the reason it
 * is structured the way it is:
 *
 *   1. Nothing here is presented as a live listing. When no Supabase project is
 *      configured the app renders a standing "sample city data" notice (see
 *      `isSeededData` in `src/server/db/index.ts`), because demo content that
 *      looks like real inventory is the single most dishonest thing a product
 *      of this kind can do.
 *
 *   2. Official information carries a real source URL. The `officialFacts`
 *      rows below link to actual government and transport authority pages, and
 *      `checkedAt` is set at seed time rather than backdated to look fresher
 *      than it is. Where a rule genuinely depends on nationality, the row says
 *      so instead of picking an answer.
 *
 * Event dates are stored as *offsets in days from seed time*, not absolute
 * instants. `rollForward` in `seed.ts` keeps them in the future, so a demo
 * install opened three months later still shows something on tonight rather
 * than an empty state caused by nothing but the calendar.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

export type SeedEvent = {
  slug: string;
  citySlug: string;
  campusSlug: string | null;
  title: string;
  blurb: string;
  kind: EventKind;
  priceCents: number;
  /** Days from seed time. Kept small so the first week is well populated. */
  inDays: number;
  /** Local hour, 0-23. */
  hour: number;
  durationHours: number;
  venue: string;
  lat: number;
  lng: number;
  source: "students" | "official" | "venue";
  sourceUrl: string | null;
  confirmations: number;
  interested: number;
  tags: string[];
};

export const seedEvents: readonly SeedEvent[] = [
  /* ---- Madrid --------------------------------------------------------- */
  {
    slug: "madrid-prado-free-evening",
    citySlug: "madrid",
    campusSlug: null,
    title: "Museo del Prado — free evening",
    blurb: "Free entry for the last two hours, every weekday evening. Go at opening, not at 19:00.",
    kind: "culture",
    priceCents: 0,
    inDays: 0,
    hour: 18,
    durationHours: 2,
    venue: "Museo del Prado",
    lat: 40.4138,
    lng: -3.6921,
    source: "official",
    sourceUrl: "https://www.museodelprado.es/en/visit-the-museum/free-visits",
    confirmations: 41,
    interested: 128,
    tags: ["art", "museums", "culture", "free"],
  },
  {
    slug: "madrid-tech-startups-meetup",
    citySlug: "madrid",
    campusSlug: null,
    title: "Madrid Tech & Startups meetup",
    blurb: "Monthly. Short talks, then everyone stands around outside. Free, and they put on food.",
    kind: "tech",
    priceCents: 0,
    inDays: 1,
    hour: 19,
    durationHours: 3,
    venue: "Impact Hub Barceló",
    lat: 40.4258,
    lng: -3.6996,
    source: "students",
    sourceUrl: null,
    confirmations: 18,
    interested: 27,
    tags: ["technology", "startups", "networking", "free"],
  },
  {
    slug: "madrid-retiro-sunday-run",
    citySlug: "madrid",
    campusSlug: null,
    title: "Retiro Sunday run",
    blurb: "Informal 5k. Turns up whatever the weather, no sign-up, no cost.",
    kind: "sports",
    priceCents: 0,
    inDays: 3,
    hour: 10,
    durationHours: 1,
    venue: "Parque del Retiro, Puerta de Alcalá gate",
    lat: 40.42,
    lng: -3.6883,
    source: "students",
    sourceUrl: null,
    confirmations: 22,
    interested: 44,
    tags: ["running", "fitness", "free", "outdoor"],
  },
  {
    slug: "madrid-ucm-welcome-week",
    citySlug: "madrid",
    campusSlug: "ucm",
    title: "UCM international welcome",
    blurb: "Campus tour, registration help desk, and the only time the paperwork queue is short.",
    kind: "university",
    priceCents: 0,
    inDays: 2,
    hour: 11,
    durationHours: 4,
    venue: "UCM Facultad de Filosofía",
    lat: 40.4489,
    lng: -3.7283,
    source: "official",
    sourceUrl: "https://www.ucm.es/english",
    confirmations: 12,
    interested: 86,
    tags: ["university", "social", "free"],
  },
  {
    slug: "madrid-lavapies-language-exchange",
    citySlug: "madrid",
    campusSlug: null,
    title: "Lavapiés language exchange",
    blurb: "Spanish/English tandem night. Free to attend, drinks are the normal bar price.",
    kind: "social",
    priceCents: 0,
    inDays: 2,
    hour: 20,
    durationHours: 3,
    venue: "La Escalera de Jacob",
    lat: 40.4089,
    lng: -3.7009,
    source: "students",
    sourceUrl: null,
    confirmations: 31,
    interested: 63,
    tags: ["language-exchange", "social", "free"],
  },
  {
    slug: "madrid-conde-duque-open-air",
    citySlug: "madrid",
    campusSlug: null,
    title: "Conde Duque open-air screening",
    blurb: "Outdoor film in the courtyard. Bring something to sit on.",
    kind: "culture",
    priceCents: 0,
    inDays: 4,
    hour: 22,
    durationHours: 2,
    venue: "Centro Cultural Conde Duque",
    lat: 40.4272,
    lng: -3.7108,
    source: "venue",
    sourceUrl: null,
    confirmations: 9,
    interested: 51,
    tags: ["cinema", "culture", "free", "outdoor"],
  },
  {
    slug: "madrid-uam-football",
    citySlug: "madrid",
    campusSlug: "uam",
    title: "UAM five-a-side, pitch 2",
    blurb: "Regular Tuesday game. Pitch is paid for by whoever turns up, split between everyone.",
    kind: "sports",
    priceCents: 200,
    inDays: 1,
    hour: 18,
    durationHours: 2,
    venue: "UAM Cantoblanco sports centre",
    lat: 40.5443,
    lng: -3.6947,
    source: "students",
    sourceUrl: null,
    confirmations: 26,
    interested: 19,
    tags: ["football", "sports"],
  },
  {
    slug: "madrid-malasana-cheap-gig",
    citySlug: "madrid",
    campusSlug: null,
    title: "Malasaña basement gig",
    blurb: "Three local bands. Ticket is cheap on the door, cheaper if you get there before 22:00.",
    kind: "music",
    priceCents: 700,
    inDays: 5,
    hour: 21,
    durationHours: 4,
    venue: "Sala Costello",
    lat: 40.4225,
    lng: -3.7008,
    source: "venue",
    sourceUrl: null,
    confirmations: 7,
    interested: 38,
    tags: ["music", "concerts", "nightlife"],
  },
  {
    slug: "madrid-reina-sofia-free",
    citySlug: "madrid",
    campusSlug: null,
    title: "Reina Sofía — free hours",
    blurb: "Free from 19:00 Monday to Saturday. The Guernica room is quietest right at the end.",
    kind: "culture",
    priceCents: 0,
    inDays: 1,
    hour: 19,
    durationHours: 2,
    venue: "Museo Reina Sofía",
    lat: 40.4079,
    lng: -3.6944,
    source: "official",
    sourceUrl: "https://www.museoreinasofia.es/en/visit",
    confirmations: 37,
    interested: 94,
    tags: ["art", "museums", "culture", "free"],
  },
  {
    slug: "madrid-weekend-market",
    citySlug: "madrid",
    campusSlug: null,
    title: "El Rastro flea market",
    blurb: "Sunday morning. Free to wander; go early if you actually want to buy something.",
    kind: "social",
    priceCents: 0,
    inDays: 3,
    hour: 9,
    durationHours: 5,
    venue: "La Latina",
    lat: 40.4075,
    lng: -3.7076,
    source: "official",
    sourceUrl: null,
    confirmations: 44,
    interested: 71,
    tags: ["shopping", "culture", "free", "outdoor"],
  },

  /* ---- Barcelona ------------------------------------------------------- */
  {
    slug: "bcn-mnac-free-sunday",
    citySlug: "barcelona",
    campusSlug: null,
    title: "MNAC free Sunday afternoon",
    blurb: "Free after 15:00 on Sundays, and free the first Sunday of the month all day.",
    kind: "culture",
    priceCents: 0,
    inDays: 3,
    hour: 15,
    durationHours: 3,
    venue: "Museu Nacional d'Art de Catalunya",
    lat: 41.3684,
    lng: 2.1533,
    source: "official",
    sourceUrl: "https://www.museunacional.cat/en",
    confirmations: 29,
    interested: 82,
    tags: ["art", "museums", "culture", "free"],
  },
  {
    slug: "bcn-barceloneta-volley",
    citySlug: "barcelona",
    campusSlug: null,
    title: "Beach volleyball, Barceloneta",
    blurb: "Open nets most evenings. Turn up, ask to join, nobody minds.",
    kind: "sports",
    priceCents: 0,
    inDays: 0,
    hour: 18,
    durationHours: 3,
    venue: "Platja de la Barceloneta",
    lat: 41.3784,
    lng: 2.1925,
    source: "students",
    sourceUrl: null,
    confirmations: 16,
    interested: 47,
    tags: ["sports", "free", "outdoor"],
  },
  {
    slug: "bcn-gracia-language",
    citySlug: "barcelona",
    campusSlug: null,
    title: "Gràcia intercambio night",
    blurb: "Catalan, Spanish and English tables. Free entry, first drink usually included.",
    kind: "social",
    priceCents: 0,
    inDays: 2,
    hour: 20,
    durationHours: 3,
    venue: "Plaça del Sol",
    lat: 41.4021,
    lng: 2.1568,
    source: "students",
    sourceUrl: null,
    confirmations: 23,
    interested: 58,
    tags: ["language-exchange", "social", "free"],
  },
  {
    slug: "bcn-poblenou-market",
    citySlug: "barcelona",
    campusSlug: null,
    title: "Palo Alto weekend market",
    blurb: "Design and food market. Entry is a few euro, the wandering is the point.",
    kind: "food",
    priceCents: 400,
    inDays: 4,
    hour: 11,
    durationHours: 6,
    venue: "Palo Alto, Poblenou",
    lat: 41.4032,
    lng: 2.1998,
    source: "venue",
    sourceUrl: null,
    confirmations: 11,
    interested: 34,
    tags: ["food", "shopping", "social"],
  },

  /* ---- London ---------------------------------------------------------- */
  {
    slug: "london-tate-modern",
    citySlug: "london",
    campusSlug: null,
    title: "Tate Modern — permanent collection",
    blurb: "Free, always. The members' floors are not, and you do not need them.",
    kind: "culture",
    priceCents: 0,
    inDays: 0,
    hour: 10,
    durationHours: 8,
    venue: "Tate Modern, Bankside",
    lat: 51.5076,
    lng: -0.0994,
    source: "official",
    sourceUrl: "https://www.tate.org.uk/visit/tate-modern",
    confirmations: 52,
    interested: 143,
    tags: ["art", "museums", "culture", "free"],
  },
  {
    slug: "london-southbank-skate",
    citySlug: "london",
    campusSlug: null,
    title: "Southbank undercroft",
    blurb: "Free to watch, free to skate. Busiest and best on a dry evening.",
    kind: "outdoor",
    priceCents: 0,
    inDays: 1,
    hour: 17,
    durationHours: 4,
    venue: "Southbank Centre undercroft",
    lat: 51.5058,
    lng: -0.1163,
    source: "students",
    sourceUrl: null,
    confirmations: 14,
    interested: 39,
    tags: ["free", "outdoor", "culture"],
  },
  {
    slug: "london-student-night",
    citySlug: "london",
    campusSlug: null,
    title: "Union student night",
    blurb: "Cheapest night out in the area by a distance. Bring your student card or pay double.",
    kind: "nightlife",
    priceCents: 500,
    inDays: 2,
    hour: 22,
    durationHours: 5,
    venue: "ULU, Malet Street",
    lat: 51.5219,
    lng: -0.1312,
    source: "venue",
    sourceUrl: null,
    confirmations: 33,
    interested: 96,
    tags: ["nightlife", "clubbing", "social"],
  },

  /* ---- Amsterdam ------------------------------------------------------- */
  {
    slug: "ams-vondelpark-run",
    citySlug: "amsterdam",
    campusSlug: null,
    title: "Vondelpark morning run",
    blurb: "Loop is 3.2km. Free, and busy enough that you will not be running alone.",
    kind: "sports",
    priceCents: 0,
    inDays: 1,
    hour: 8,
    durationHours: 1,
    venue: "Vondelpark",
    lat: 52.3579,
    lng: 4.8686,
    source: "students",
    sourceUrl: null,
    confirmations: 19,
    interested: 41,
    tags: ["running", "fitness", "free", "outdoor"],
  },
  {
    slug: "ams-nemo-rooftop",
    citySlug: "amsterdam",
    campusSlug: null,
    title: "NEMO rooftop terrace",
    blurb: "The roof is free even though the museum is not. Best view in the centre for €0.",
    kind: "outdoor",
    priceCents: 0,
    inDays: 2,
    hour: 16,
    durationHours: 4,
    venue: "NEMO Science Museum",
    lat: 52.3738,
    lng: 4.9123,
    source: "official",
    sourceUrl: "https://www.nemosciencemuseum.nl/en/",
    confirmations: 27,
    interested: 68,
    tags: ["free", "outdoor", "culture"],
  },

  /* ---- Berlin ---------------------------------------------------------- */
  {
    slug: "berlin-tempelhof",
    citySlug: "berlin",
    campusSlug: null,
    title: "Tempelhofer Feld",
    blurb: "A decommissioned airport you are allowed to cycle down. Free, enormous, open late.",
    kind: "outdoor",
    priceCents: 0,
    inDays: 0,
    hour: 15,
    durationHours: 6,
    venue: "Tempelhofer Feld",
    lat: 52.4731,
    lng: 13.4025,
    source: "official",
    sourceUrl: "https://gruen-berlin.de/en/tempelhofer-feld",
    confirmations: 48,
    interested: 112,
    tags: ["free", "outdoor", "cycling"],
  },
  {
    slug: "berlin-museum-sunday",
    citySlug: "berlin",
    campusSlug: null,
    title: "Museumssonntag — free museums",
    blurb: "First Sunday of the month, dozens of museums free. Book the slot, they go fast.",
    kind: "culture",
    priceCents: 0,
    inDays: 5,
    hour: 10,
    durationHours: 8,
    venue: "Across Berlin",
    lat: 52.5199,
    lng: 13.4016,
    source: "official",
    sourceUrl: "https://www.museumssonntag.berlin/en",
    confirmations: 61,
    interested: 154,
    tags: ["art", "museums", "culture", "free"],
  },
  {
    slug: "berlin-neukolln-flea",
    citySlug: "berlin",
    campusSlug: null,
    title: "Neukölln flea market",
    blurb: "Where students furnish a flat for under €60. Cash only, haggle politely.",
    kind: "social",
    priceCents: 0,
    inDays: 3,
    hour: 10,
    durationHours: 6,
    venue: "Maybachufer",
    lat: 52.4914,
    lng: 13.4283,
    source: "students",
    sourceUrl: null,
    confirmations: 24,
    interested: 57,
    tags: ["shopping", "free", "outdoor"],
  },
];

/* -------------------------------------------------------------------------- */
/* Deals                                                                       */
/* -------------------------------------------------------------------------- */

export type SeedDeal = {
  slug: string;
  citySlug: string;
  title: string;
  detail: string;
  value: string;
  category: string;
  requiresStudentId: boolean;
  /** Days from seed time; null for open-ended. */
  expiresInDays: number | null;
  source: "students" | "official" | "venue";
  /** Seeded confirmation reports, as day-offsets into the past. */
  reportsAgoDays: number[];
};

export const seedDeals: readonly SeedDeal[] = [
  {
    slug: "madrid-abono-joven",
    citySlug: "madrid",
    title: "Abono Joven — whole region, flat monthly",
    detail: "Under 26 gets every metro, bus and regional train in Madrid for one flat monthly fee.",
    value: "€20/month",
    category: "transport",
    requiresStudentId: false,
    expiresInDays: null,
    source: "official",
    reportsAgoDays: [1, 3, 6, 9, 14, 20, 28],
  },
  {
    slug: "madrid-menu-del-dia-campus",
    citySlug: "madrid",
    title: "Menú del día near Moncloa",
    detail: "Three courses, bread and a drink on weekday lunchtimes. Stops at 16:00 sharp.",
    value: "€11-13",
    category: "food",
    requiresStudentId: false,
    expiresInDays: null,
    source: "students",
    reportsAgoDays: [2, 4, 5, 11, 18],
  },
  {
    slug: "madrid-cine-estudiante",
    citySlug: "madrid",
    title: "Cinema student Wednesday",
    detail: "Most chains do a reduced Wednesday ticket with a student card.",
    value: "~€5",
    category: "entertainment",
    requiresStudentId: true,
    expiresInDays: null,
    source: "venue",
    reportsAgoDays: [3, 8, 15],
  },
  {
    slug: "madrid-gym-student-term",
    citySlug: "madrid",
    title: "University sports centre membership",
    detail: "Campus gyms are typically a third of a commercial chain, and the term rate is cheaper again.",
    value: "Term rate",
    category: "fitness",
    requiresStudentId: true,
    expiresInDays: null,
    source: "official",
    reportsAgoDays: [5, 12, 21, 30],
  },
  {
    slug: "madrid-museum-student-free",
    citySlug: "madrid",
    title: "Free museum entry with EU student card",
    detail: "Several national museums are free for EU students under 25. Bring photo ID as well.",
    value: "Free",
    category: "culture",
    requiresStudentId: true,
    expiresInDays: null,
    source: "official",
    reportsAgoDays: [1, 2, 7, 13, 19, 26],
  },
  {
    slug: "bcn-t-jove",
    citySlug: "barcelona",
    title: "T-Jove travel card",
    detail: "90 days of unlimited travel for under 25s. Works out far cheaper than singles.",
    value: "Quarterly",
    category: "transport",
    requiresStudentId: false,
    expiresInDays: null,
    source: "official",
    reportsAgoDays: [2, 5, 10, 17, 24],
  },
  {
    slug: "london-18plus-oyster",
    citySlug: "london",
    title: "18+ Student Oyster",
    detail: "30% off travelcards and bus passes. Takes a couple of weeks to arrive, apply early.",
    value: "30% off",
    category: "transport",
    requiresStudentId: true,
    expiresInDays: null,
    source: "official",
    reportsAgoDays: [1, 4, 9, 16, 23, 29],
  },
  {
    slug: "ams-ov-student",
    citySlug: "amsterdam",
    title: "Off-peak student travel",
    detail: "Eligibility depends on where you study and your nationality — check before assuming.",
    value: "Varies",
    category: "transport",
    requiresStudentId: true,
    expiresInDays: null,
    source: "official",
    reportsAgoDays: [6, 14],
  },
  {
    slug: "berlin-semesterticket",
    citySlug: "berlin",
    title: "Semesterticket",
    detail: "Bundled into enrolment fees at most Berlin universities. You already paid for it.",
    value: "Included",
    category: "transport",
    requiresStudentId: true,
    expiresInDays: null,
    source: "official",
    reportsAgoDays: [3, 7, 15, 22],
  },
];

/* -------------------------------------------------------------------------- */
/* Official information                                                        */
/* -------------------------------------------------------------------------- */

export type SeedFact = {
  slug: string;
  citySlug: string | null;
  countryCode: string;
  topic:
    | "immigration"
    | "residency"
    | "visa"
    | "registration"
    | "healthcare"
    | "tax"
    | "legal"
    | "university"
    | "transport"
    | "emergency";
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  authority: "official" | "university" | "community";
  variesByNationality: boolean;
};

/**
 * Every row links to a primary source. Note how many are marked
 * `variesByNationality`: that flag makes the UI refuse to state one answer and
 * link the source instead, which is the only defensible way to handle
 * immigration rules in a product used by students from everywhere.
 */
export const seedFacts: readonly SeedFact[] = [
  {
    slug: "es-emergency",
    citySlug: null,
    countryCode: "ES",
    topic: "emergency",
    title: "Emergency number in Spain is 112",
    summary:
      "112 reaches police, ambulance and fire from any phone, free, and operators speak English.",
    sourceName: "Ministerio del Interior",
    sourceUrl: "https://www.interior.gob.es/",
    authority: "official",
    variesByNationality: false,
  },
  {
    slug: "es-empadronamiento",
    citySlug: "madrid",
    countryCode: "ES",
    topic: "registration",
    title: "Empadronamiento — registering your address",
    summary:
      "Registering at your local town hall is what unlocks a health centre and many administrative steps. Requirements and appointment availability differ by district.",
    sourceName: "Ayuntamiento de Madrid",
    sourceUrl: "https://www.madrid.es/portal/site/munimadrid",
    authority: "official",
    variesByNationality: true,
  },
  {
    slug: "es-tie-nie",
    citySlug: null,
    countryCode: "ES",
    topic: "residency",
    title: "NIE and TIE for students",
    summary:
      "Whether you need a NIE, a TIE, or an EU registration certificate depends on your nationality and the length of your stay. Check the official page for your own case.",
    sourceName: "Administraciones Públicas",
    sourceUrl: "https://www.inclusion.gob.es/web/migraciones/home",
    authority: "official",
    variesByNationality: true,
  },
  {
    slug: "es-healthcare-ehic",
    citySlug: null,
    countryCode: "ES",
    topic: "healthcare",
    title: "Healthcare cover as a student in Spain",
    summary:
      "EU students typically rely on a valid EHIC or equivalent; non-EU students usually need private cover arranged for the visa. Confirm what applies to you before you travel.",
    sourceName: "Ministerio de Sanidad",
    sourceUrl: "https://www.sanidad.gob.es/",
    authority: "official",
    variesByNationality: true,
  },
  {
    slug: "es-madrid-transport",
    citySlug: "madrid",
    countryCode: "ES",
    topic: "transport",
    title: "Abono Joven is the transport card to get",
    summary:
      "Under 26 gets the whole Madrid region for one flat monthly fee. Apply with a photo and ID; the physical card takes a few days.",
    sourceName: "Consorcio Regional de Transportes de Madrid",
    sourceUrl: "https://www.crtm.es/",
    authority: "official",
    variesByNationality: false,
  },
  {
    slug: "uk-emergency",
    citySlug: null,
    countryCode: "GB",
    topic: "emergency",
    title: "Emergency number in the UK is 999",
    summary: "999 or 112 both work. 111 is the non-emergency NHS line for medical advice.",
    sourceName: "NHS",
    sourceUrl: "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/",
    authority: "official",
    variesByNationality: false,
  },
  {
    slug: "uk-gp-registration",
    citySlug: "london",
    countryCode: "GB",
    topic: "healthcare",
    title: "Register with a GP when you arrive",
    summary:
      "Registration is free and does not require immigration status checks. Do it in the first week rather than when you are already ill.",
    sourceName: "NHS",
    sourceUrl: "https://www.nhs.uk/nhs-services/gps/how-to-register-with-a-gp-surgery/",
    authority: "official",
    variesByNationality: false,
  },
  {
    slug: "nl-emergency",
    citySlug: null,
    countryCode: "NL",
    topic: "emergency",
    title: "Emergency number in the Netherlands is 112",
    summary: "112 for emergencies; 0900-8844 is the non-urgent police line.",
    sourceName: "Rijksoverheid",
    sourceUrl: "https://www.government.nl/",
    authority: "official",
    variesByNationality: false,
  },
  {
    slug: "nl-brp",
    citySlug: "amsterdam",
    countryCode: "NL",
    topic: "registration",
    title: "Registering in the BRP",
    summary:
      "Staying longer than four months generally means registering with the municipality. You need an appointment and proof of address.",
    sourceName: "Gemeente Amsterdam",
    sourceUrl: "https://www.amsterdam.nl/en/",
    authority: "official",
    variesByNationality: true,
  },
  {
    slug: "de-emergency",
    citySlug: null,
    countryCode: "DE",
    topic: "emergency",
    title: "Emergency numbers in Germany",
    summary: "112 for ambulance and fire, 110 for police. Both are free from any phone.",
    sourceName: "Bundesregierung",
    sourceUrl: "https://www.bundesregierung.de/",
    authority: "official",
    variesByNationality: false,
  },
  {
    slug: "de-anmeldung",
    citySlug: "berlin",
    countryCode: "DE",
    topic: "registration",
    title: "Anmeldung — address registration",
    summary:
      "Registering your address at a Bürgeramt is required and unlocks a tax ID and a bank account. Appointments are scarce; book before you land if you can.",
    sourceName: "Berlin.de Service Portal",
    sourceUrl: "https://service.berlin.de/dienstleistung/120686/en/",
    authority: "official",
    variesByNationality: false,
  },
  {
    slug: "de-health-insurance",
    citySlug: null,
    countryCode: "DE",
    topic: "healthcare",
    title: "Health insurance is mandatory to enrol",
    summary:
      "German universities will not complete enrolment without proof of health insurance. What counts as valid depends on your nationality and age.",
    sourceName: "DAAD",
    sourceUrl: "https://www.daad.de/en/",
    authority: "official",
    variesByNationality: true,
  },
];

/* -------------------------------------------------------------------------- */
/* Guides — the Survival Hub                                                   */
/* -------------------------------------------------------------------------- */

export type SeedGuide = {
  slug: string;
  citySlug: string | null;
  countryCode: string | null;
  category: GuideCategory;
  title: string;
  answer: string;
  points: string[];
  source: "official" | "students" | "editorial";
  sourceUrl: string | null;
  confirmations: number;
};

export const seedGuides: readonly SeedGuide[] = [
  {
    slug: "madrid-cheap-supermarkets",
    citySlug: "madrid",
    countryCode: "ES",
    category: "money",
    title: "Which supermarkets are actually cheap",
    answer: "Mercadona and Lidl for the weekly shop; the corner shop is for emergencies only.",
    points: [
      "Mercadona is the default weekly shop for most students here.",
      "Lidl and Aldi undercut it on staples but carry less fresh.",
      "Small supermarkets in the centre run 20-40% above the same items in a big store.",
      "Fruit and veg from a neighbourhood market is usually cheaper than either.",
    ],
    source: "students",
    sourceUrl: null,
    confirmations: 34,
  },
  {
    slug: "madrid-menu-del-dia",
    citySlug: "madrid",
    countryCode: "ES",
    category: "food",
    title: "How the menú del día works",
    answer: "Weekday lunch, three courses plus a drink, roughly €11-13 near campus.",
    points: [
      "Served weekday lunchtimes only, typically 13:00 to 16:00.",
      "It is starter, main, dessert and a drink for one price.",
      "Same restaurant à la carte in the evening costs roughly double.",
      "Places a street back from a main square are cheaper and usually better.",
    ],
    source: "students",
    sourceUrl: null,
    confirmations: 47,
  },
  {
    slug: "generic-first-week-money",
    citySlug: null,
    countryCode: null,
    category: "money",
    title: "What the first month actually costs",
    answer: "Budget for deposits and one-off setup costs on top of your normal monthly spend.",
    points: [
      "A rental deposit is usually the single biggest first-month cost.",
      "Transport card, phone plan and any registration fee all land in week one.",
      "Kitchen and bedding for a new flat is a real number — buy second-hand.",
      "Keep a buffer: the first month is when unexpected costs cluster.",
    ],
    source: "editorial",
    sourceUrl: null,
    confirmations: 0,
  },
  {
    slug: "generic-avoid-tourist-traps",
    citySlug: null,
    countryCode: null,
    category: "money",
    title: "Spotting a tourist price",
    answer: "A menu with photographs on a main square is a price signal, not a food signal.",
    points: [
      "Two streets off the main square is usually 30-40% cheaper for the same thing.",
      "Photo menus and staff waving you in are near-universal warning signs.",
      "Check whether a cover charge or bread charge is added by default.",
      "If a place is full of students at 14:00, that is the strongest signal there is.",
    ],
    source: "students",
    sourceUrl: null,
    confirmations: 28,
  },
  {
    slug: "generic-phone-plan",
    citySlug: null,
    countryCode: null,
    category: "admin",
    title: "Getting a local SIM",
    answer: "A prepaid SIM in week one, then switch to a contract once you have an address.",
    points: [
      "Prepaid needs only ID and works the same day.",
      "Contracts are cheaper per GB but usually need a local bank account and address.",
      "Check whether your plan includes EU roaming before a weekend trip.",
      "Do not cancel your home number until any two-factor codes are moved across.",
    ],
    source: "editorial",
    sourceUrl: null,
    confirmations: 0,
  },
  {
    slug: "generic-safety-basics",
    citySlug: null,
    countryCode: null,
    category: "safety",
    title: "The safety basics worth knowing",
    answer: "Know the emergency number, keep your phone charged, and be sceptical of anyone rushing you.",
    points: [
      "Save the local emergency number and your university's out-of-hours line.",
      "Pickpocketing on busy transport is the most common issue students report.",
      "Any 'official' asking for payment on the street is worth verifying.",
      "Tell someone where you are going the first few times you go out somewhere new.",
    ],
    source: "editorial",
    sourceUrl: null,
    confirmations: 0,
  },
  {
    slug: "generic-meet-people",
    citySlug: null,
    countryCode: null,
    category: "social",
    title: "Meeting people when you know nobody",
    answer: "Recurring, low-stakes things beat one-off big events every time.",
    points: [
      "A weekly sport or language exchange builds friends faster than a huge welcome party.",
      "Say yes to the first three invitations, even the ones you do not fancy.",
      "Campus societies are the cheapest social infrastructure you will ever get.",
      "Being the person who organises something is the fastest route in.",
    ],
    source: "editorial",
    sourceUrl: null,
    confirmations: 0,
  },
  {
    slug: "generic-laundry",
    citySlug: null,
    countryCode: null,
    category: "admin",
    title: "Laundry without a machine",
    answer: "Self-service laundrettes are per-load; university halls usually have card-operated machines.",
    points: [
      "A self-service wash and dry is typically the cheapest option outside halls.",
      "Going mid-morning on a weekday means no queue.",
      "Check whether your building has a shared machine before paying for a service wash.",
    ],
    source: "students",
    sourceUrl: null,
    confirmations: 12,
  },
];

/* -------------------------------------------------------------------------- */
/* Communities                                                                 */
/* -------------------------------------------------------------------------- */

export type SeedCommunity = {
  slug: string;
  citySlug: string | null;
  campusSlug: string | null;
  kind: CommunityKind;
  name: string;
  blurb: string;
  emoji: string;
  memberCount: number;
};

export const seedCommunities: readonly SeedCommunity[] = [
  { slug: "madrid-newcomers", citySlug: "madrid", campusSlug: null, kind: "neighbourhood", name: "New in Madrid", blurb: "Arrived in the last few months. Ask anything.", emoji: "🧭", memberCount: 214 },
  { slug: "madrid-football", citySlug: "madrid", campusSlug: null, kind: "sport", name: "Madrid football", blurb: "Five-a-side, pitches and people short a player.", emoji: "⚽", memberCount: 96 },
  { slug: "madrid-language", citySlug: "madrid", campusSlug: null, kind: "language", name: "Spanish practice", blurb: "Tandem partners and intercambio nights.", emoji: "💬", memberCount: 152 },
  { slug: "madrid-cheap-eats", citySlug: "madrid", campusSlug: null, kind: "hobby", name: "Cheap eats Madrid", blurb: "Where the €10 lunch actually is.", emoji: "🍽️", memberCount: 188 },
  { slug: "ucm", citySlug: "madrid", campusSlug: "ucm", kind: "campus", name: "UCM", blurb: "Complutense students.", emoji: "🎓", memberCount: 143 },
  { slug: "uam", citySlug: "madrid", campusSlug: "uam", kind: "campus", name: "UAM", blurb: "Autónoma students.", emoji: "🎓", memberCount: 88 },
  { slug: "bcn-newcomers", citySlug: "barcelona", campusSlug: null, kind: "neighbourhood", name: "New in Barcelona", blurb: "First months in the city.", emoji: "🧭", memberCount: 176 },
  { slug: "bcn-beach-sport", citySlug: "barcelona", campusSlug: null, kind: "sport", name: "Beach sport", blurb: "Volleyball, running, swimming.", emoji: "🏐", memberCount: 71 },
  { slug: "london-newcomers", citySlug: "london", campusSlug: null, kind: "neighbourhood", name: "New in London", blurb: "Getting set up without spending a fortune.", emoji: "🧭", memberCount: 302 },
  { slug: "ams-cycling", citySlug: "amsterdam", campusSlug: null, kind: "hobby", name: "Bikes in Amsterdam", blurb: "Buying, fixing and not getting one stolen.", emoji: "🚲", memberCount: 119 },
  { slug: "berlin-newcomers", citySlug: "berlin", campusSlug: null, kind: "neighbourhood", name: "New in Berlin", blurb: "Anmeldung, flats and the first winter.", emoji: "🧭", memberCount: 247 },
];

/* -------------------------------------------------------------------------- */
/* Channels                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The Loop's channel set. Fixed rather than user-created: a young network with
 * forty channels of four people each is a dead network, and the fastest way to
 * get there is letting anyone make a channel on day one.
 */
export const loopChannels = [
  { slug: "general", label: "General", emoji: "💬" },
  { slug: "cheap-eats", label: "Cheap eats", emoji: "🍜" },
  { slug: "events-tonight", label: "Tonight", emoji: "🌙" },
  { slug: "deals", label: "Deals", emoji: "🏷️" },
  { slug: "nightlife", label: "Nightlife", emoji: "🌃" },
  { slug: "housing", label: "Housing", emoji: "🔑" },
  { slug: "questions", label: "Questions", emoji: "❓" },
  { slug: "campus", label: "Campus", emoji: "🎓" },
  { slug: "football", label: "Football", emoji: "⚽" },
  { slug: "gym", label: "Gym", emoji: "🏋️" },
  { slug: "travel", label: "Travel", emoji: "🚆" },
  { slug: "buy-sell", label: "Buy & sell", emoji: "📦" },
  { slug: "jobs", label: "Jobs", emoji: "💼" },
  { slug: "study", label: "Study", emoji: "📚" },
  { slug: "language", label: "Language", emoji: "🗣️" },
] as const;

export type LoopChannel = (typeof loopChannels)[number]["slug"];

/* -------------------------------------------------------------------------- */
/* Challenges                                                                  */
/* -------------------------------------------------------------------------- */

export const seedChallenges = [
  {
    slug: "zero-spend-sunday",
    title: "€0 Sunday",
    blurb: "One day, nothing spent. Harder and more interesting than it sounds.",
    emoji: "🫙",
    metric: "zero-spend-day" as const,
    target: 1,
    capCents: null,
    lastsDays: 14,
  },
  {
    slug: "weekend-under-30",
    title: "Weekend under €30",
    blurb: "Friday to Sunday, everything included.",
    emoji: "🎯",
    metric: "weekend-under" as const,
    target: 1,
    capCents: 3000,
    lastsDays: 21,
  },
  {
    slug: "three-new-places",
    title: "Three new places",
    blurb: "Somewhere you have never been, three times this fortnight.",
    emoji: "📍",
    metric: "new-places" as const,
    target: 3,
    capCents: null,
    lastsDays: 14,
  },
  {
    slug: "free-event-week",
    title: "Free event week",
    blurb: "Two free things in seven days.",
    emoji: "🎟️",
    metric: "free-events" as const,
    target: 2,
    capCents: null,
    lastsDays: 7,
  },
];
