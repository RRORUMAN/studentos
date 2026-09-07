/**
 * ============================================================================
 * PEOPLE
 * ----------------------------------------------------------------------------
 * Anyone Down? turns a plan into a temporary group. The group exists for the
 * plan and closes afterwards, which is the whole point: you do not have to
 * already know people to end up doing something with them.
 *
 * Everything in this file is sample content. Initials only, never photos, and
 * every panel that renders it carries a sample marker.
 * ============================================================================
 */

export type Attendee = {
  initials: string;
  handle: string;
  campus: string;
  /** How they answered. Undefined means they have not answered yet. */
  status?: "in" | "maybe";
};

export type Invite = {
  id: string;
  citySlug: string;
  title: string;
  when: string;
  place: string;
  price: number;
  priceNote: string;
  /** Total the plan needs, including the people already in. */
  needs: number;
  attendees: readonly Attendee[];
  /** What the group chat opens with once it is formed. */
  firstMessage: string;
};

export const invites: readonly Invite[] = [
  {
    id: "retiro-football",
    citySlug: "madrid",
    title: "Free football",
    when: "Saturday · 16:00",
    place: "Retiro, east pitches",
    price: 0,
    priceNote: "Free. Bring water.",
    needs: 10,
    attendees: [
      { initials: "TK", handle: "tomas.k", campus: "Carlos III", status: "in" },
      { initials: "AM", handle: "aya.m", campus: "Complutense", status: "in" },
      { initials: "JP", handle: "joao.p", campus: "Politécnica", status: "in" },
      { initials: "SR", handle: "sofia.r", campus: "Complutense", status: "in" },
      { initials: "LB", handle: "liam.b", campus: "Autónoma", status: "in" },
      { initials: "NF", handle: "nadia.f", campus: "Complutense", status: "in" },
      { initials: "PV", handle: "pere.v", campus: "Carlos III", status: "in" },
      { initials: "HB", handle: "hakim.b", campus: "Politécnica", status: "maybe" },
    ],
    firstMessage: "Group open. Meeting at the Menéndez Pelayo gate at 15:45.",
  },
] as const;

export const defaultInvite = invites[0];

/** Students shown as "interested" under a generated plan. */
export const nearbyInterested: readonly Attendee[] = [
  { initials: "EM", handle: "eva.m", campus: "Autónoma" },
  { initials: "YT", handle: "yuki.t", campus: "Complutense" },
  { initials: "SA", handle: "seb.a", campus: "Carlos III" },
] as const;

/**
 * A pool of sample people without a campus, so the demo planner can attach the
 * right university for whichever city is selected.
 */
export const peoplePool: readonly { initials: string; handle: string }[] = [
  { initials: "EM", handle: "eva.m" },
  { initials: "YT", handle: "yuki.t" },
  { initials: "SA", handle: "seb.a" },
  { initials: "LK", handle: "lena.k" },
  { initials: "MP", handle: "milan.p" },
  { initials: "AH", handle: "amira.h" },
  { initials: "JS", handle: "jonas.s" },
  { initials: "SR", handle: "sofia.r" },
  { initials: "TK", handle: "tomas.k" },
  { initials: "NF", handle: "nadia.f" },
] as const;

/* -------------------------------------------------------------------------- */
/* Anyone Down? — the landing page demo                                        */
/* -------------------------------------------------------------------------- */

export const anyoneDownDemo = {
  citySlug: "berlin",
  title: "Football",
  when: "Saturday · 16:00",
  place: "Tempelhofer Feld, north pitches",
  price: 0,
  /** How many more people the plan needs. */
  need: 3,
  joiners: [
    { initials: "MP", handle: "milan.p", campus: "TU Berlin" },
    { initials: "LK", handle: "lena.k", campus: "Humboldt" },
    { initials: "JS", handle: "jonas.s", campus: "Freie" },
  ],
  firstMessage: "Group open. Meet at the S-Bahn exit at 15:45.",
  planLine: "Football 16:00 · Späti after · €0 to €4 each",
} as const;

/* -------------------------------------------------------------------------- */
/* Student Exchange                                                             */
/* -------------------------------------------------------------------------- */

export type ExchangeLane = "sell" | "borrow" | "help" | "rides" | "free";

export const exchangeLanes: readonly { key: ExchangeLane; label: string }[] = [
  { key: "sell", label: "Buy & sell" },
  { key: "borrow", label: "Borrow" },
  { key: "help", label: "Help" },
  { key: "rides", label: "Rides & travel" },
  { key: "free", label: "Free stuff" },
];

export type ExchangeListing = {
  id: string;
  title: string;
  /** Null for requests with no price attached. */
  price: number | null;
  lane: ExchangeLane;
  type: "offer" | "request";
  university: string;
  area: string;
  note: string;
  verified: boolean;
  initials: string;
};

export const exchangeListings: readonly ExchangeListing[] = [
  {
    id: "x-desk",
    title: "Desk",
    price: 20,
    lane: "sell",
    type: "offer",
    university: "Humboldt",
    area: "Neukölln",
    note: "Leaving in June. Collect from the building lobby, not the flat.",
    verified: true,
    initials: "LK",
  },
  {
    id: "x-bike",
    title: "Bike, two locks included",
    price: 65,
    lane: "sell",
    type: "offer",
    university: "TU Berlin",
    area: "Wedding",
    note: "Serviced last month. Meet at the campus bike rack.",
    verified: true,
    initials: "MP",
  },
  {
    id: "x-kitchen",
    title: "Kitchen set",
    price: 0,
    lane: "free",
    type: "offer",
    university: "Freie",
    area: "Dahlem",
    note: "Pans, plates, a kettle. First to collect on Saturday.",
    verified: true,
    initials: "JS",
  },
  {
    id: "x-drill",
    title: "Borrow a drill",
    price: null,
    lane: "borrow",
    type: "request",
    university: "Humboldt",
    area: "Mitte",
    note: "One evening, two shelves. Returned with the bits.",
    verified: true,
    initials: "AH",
  },
  {
    id: "x-taxi",
    title: "Split airport taxi",
    price: 12,
    lane: "rides",
    type: "request",
    university: "TU Berlin",
    area: "Kreuzberg",
    note: "Sunday 06:30 to BER. Two seats left.",
    verified: true,
    initials: "SR",
  },
  {
    id: "x-moving",
    title: "Need help moving",
    price: null,
    lane: "help",
    type: "request",
    university: "Freie",
    area: "Friedrichshain",
    note: "Two boxes and a sofa, Saturday morning. Pizza after.",
    verified: false,
    initials: "TK",
  },
];

export const safeMeetupLine =
  "Meet in public: on campus, at a station, in a shop. Home addresses are never shown, not even to a verified student.";
