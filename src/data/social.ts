/**
 * ANYONE DOWN?
 * ----------------------------------------------------------------------------
 * A plan becomes a temporary group. The group exists for the plan and closes
 * afterwards, which is the whole point: you do not have to already know people
 * to end up doing something with them.
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
