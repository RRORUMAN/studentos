import type { Cents, Id, Iso } from "@/domain/types";

/**
 * ============================================================================
 * SOCIAL
 * ----------------------------------------------------------------------------
 * Communities, groups, shared money and the marketplace.
 *
 * One safety rule runs through the whole module and is enforced structurally
 * rather than by review: nothing here ever carries a home address or a live
 * coordinate. A listing has a `meetArea` (a public place label), an invite has
 * a venue, and a member has a campus. The precise `homePoint` on a profile is
 * never joined into any of these shapes, so a mistake in a query cannot leak
 * one.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Communities                                                                 */
/* -------------------------------------------------------------------------- */

export type CommunityKind =
  | "university"
  | "campus"
  | "neighbourhood"
  | "sport"
  | "language"
  | "culture"
  | "subject"
  | "hobby"
  | "travel"
  | "career";

export const communityKindLabel: Record<CommunityKind, string> = {
  university: "University",
  campus: "Campus",
  neighbourhood: "Neighbourhood",
  sport: "Sport",
  language: "Language",
  culture: "Culture",
  subject: "Subject",
  hobby: "Hobby",
  travel: "Travel",
  career: "Career",
};

/**
 * A micro-community. These raise relevance without shattering Pulse: a post
 * still belongs to the city feed, it is just *also* addressable by community.
 * Fragmenting into fully separate feeds is how a young network ends up with
 * forty channels of four people each.
 */
export type Community = {
  id: Id;
  citySlug: string | null;
  campusSlug: string | null;
  kind: CommunityKind;
  slug: string;
  name: string;
  blurb: string;
  emoji: string;
  memberCount: number;
  createdAt: Iso;
};

export type CommunityMember = {
  communityId: Id;
  userId: Id;
  role: "member" | "moderator";
  joinedAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Activities — Anyone Down?                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The activity taxonomy behind Anyone Down?. A closed list rather than free
 * text, because matching students to each other needs a join key, and "footy"
 * / "football" / "soccer" as three separate strings is a network that never
 * reaches critical mass in any of them.
 */
export type ActivityKind =
  | "football"
  | "gym"
  | "run"
  | "coffee"
  | "study"
  | "lunch"
  | "nightlife"
  | "concert"
  | "museum"
  | "language-exchange"
  | "weekend-trip"
  | "coworking"
  | "gaming"
  | "other";

export const activityMeta: Record<
  ActivityKind,
  { label: string; emoji: string; typicalMinutes: number; interests: readonly string[] }
> = {
  football: { label: "Football", emoji: "⚽", typicalMinutes: 90, interests: ["football", "sports"] },
  gym: { label: "Gym", emoji: "🏋️", typicalMinutes: 75, interests: ["gym", "fitness"] },
  run: { label: "Run", emoji: "🏃", typicalMinutes: 45, interests: ["running", "fitness"] },
  coffee: { label: "Coffee", emoji: "☕", typicalMinutes: 60, interests: ["coffee", "food"] },
  study: { label: "Study", emoji: "📚", typicalMinutes: 120, interests: ["study-groups"] },
  lunch: { label: "Lunch", emoji: "🍽️", typicalMinutes: 60, interests: ["food"] },
  nightlife: { label: "Night out", emoji: "🌃", typicalMinutes: 240, interests: ["nightlife", "clubbing"] },
  concert: { label: "Concert", emoji: "🎤", typicalMinutes: 180, interests: ["music", "concerts"] },
  museum: { label: "Museum", emoji: "🖼️", typicalMinutes: 120, interests: ["art", "museums", "culture"] },
  "language-exchange": {
    label: "Language exchange",
    emoji: "💬",
    typicalMinutes: 90,
    interests: ["language-exchange"],
  },
  "weekend-trip": { label: "Weekend trip", emoji: "🚆", typicalMinutes: 2880, interests: ["travel"] },
  coworking: { label: "Coworking", emoji: "💻", typicalMinutes: 180, interests: ["startups", "technology"] },
  gaming: { label: "Gaming", emoji: "🎮", typicalMinutes: 120, interests: ["gaming"] },
  other: { label: "Something else", emoji: "✨", typicalMinutes: 90, interests: [] },
};

/* -------------------------------------------------------------------------- */
/* Groups                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A persistent friend group, as opposed to the temporary group an Anyone Down?
 * plan creates and closes. This is the retention loop: once four people share
 * a group with plans and a bucket in it, the product stops being an app they
 * each happen to have.
 */
export type Group = {
  id: Id;
  citySlug: string;
  name: string;
  emoji: string;
  ownerId: Id;
  createdAt: Iso;
};

export type GroupMember = {
  groupId: Id;
  userId: Id;
  joinedAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Shared buckets                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A shared envelope: "Saturday night", "Barcelona trip", "Flat groceries".
 *
 * Explicitly NOT banking. No money moves; the product tracks who fronted what
 * and what the group still owes each other. Anything more needs a licence, and
 * a student splitting a €14 taxi does not want an onboarding flow with a
 * passport scan in it.
 */
export type Bucket = {
  id: Id;
  groupId: Id | null;
  ownerId: Id;
  name: string;
  emoji: string;
  targetCents: Cents;
  forDate: Iso | null;
  closedAt: Iso | null;
  createdAt: Iso;
};

export type BucketEntry = {
  id: Id;
  bucketId: Id;
  userId: Id;
  label: string;
  amountCents: Cents;
  /** Who actually paid, which is what the settle-up view is computed from. */
  paidBy: Id;
  createdAt: Iso;
};

/** One person's position in a bucket: what they owe, or are owed. */
export type Settlement = { userId: Id; paidCents: Cents; shareCents: Cents; netCents: Cents };

/**
 * Equal-split settle-up.
 *
 * Rounding is done by distributing the remainder cent-by-cent across members
 * rather than by rounding each share, because three people splitting €10 must
 * come to exactly €10 — a naive round gives 3×€3.33 = €9.99 and a bucket that
 * never closes.
 */
export function settleBucket(
  entries: readonly BucketEntry[],
  memberIds: readonly Id[],
): { total: Cents; settlements: Settlement[] } {
  const total = entries.reduce((sum, entry) => sum + entry.amountCents, 0);
  const members = memberIds.length;
  if (members === 0) return { total, settlements: [] };

  const base = Math.floor(total / members);
  let remainder = total - base * members;

  const paidBy = new Map<Id, Cents>();
  for (const entry of entries) {
    paidBy.set(entry.paidBy, (paidBy.get(entry.paidBy) ?? 0) + entry.amountCents);
  }

  return {
    total,
    settlements: memberIds.map((userId) => {
      /* Hand out the leftover cents one at a time, in member order, so the sum
         of shares is exactly the total. */
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      const shareCents = base + extra;
      const paidCents = paidBy.get(userId) ?? 0;
      return { userId, paidCents, shareCents, netCents: paidCents - shareCents };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Marketplace                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The five lanes of Student Exchange. Buy/sell is one of them, not the whole
 * thing: the same verified network that moves a desk between students also
 * lends a drill, splits a taxi to the airport and finds someone to translate a
 * contract. Each lane has its own categories and its own price semantics.
 */
export type ExchangeKind = "sell" | "borrow" | "help" | "ride" | "free";

export const exchangeKindMeta: Record<
  ExchangeKind,
  {
    label: string;
    emoji: string;
    /** What a listing in this lane is for, in one line. */
    blurb: string;
    /** Prompts for the "I need" / "I have" toggle. */
    offer: string;
    request: string;
    /** Whether a price field makes sense at all. */
    priced: boolean;
    categories: readonly ListingCategory[];
  }
> = {
  sell: {
    label: "Buy & sell",
    emoji: "📦",
    blurb: "Second-hand between students. Outgoing students sell what incoming students need.",
    offer: "I'm selling",
    request: "I'm looking for",
    priced: true,
    categories: ["furniture", "books", "electronics", "kitchen", "clothing", "bikes", "supplies", "other"],
  },
  borrow: {
    label: "Borrow",
    emoji: "🔧",
    blurb: "Tools, chargers, sports kit, books. Lend it for a day rather than buying it twice.",
    offer: "I can lend",
    request: "I need to borrow",
    priced: false,
    categories: ["tools", "chargers", "sports", "books", "household", "other"],
  },
  help: {
    label: "Help",
    emoji: "🙋",
    blurb: "Move a sofa, translate a letter, fix a laptop, explain the registration form.",
    offer: "I can help with",
    request: "I need help with",
    priced: false,
    categories: ["moving", "translate", "advice", "airport", "tech", "study", "other"],
  },
  ride: {
    label: "Rides & travel",
    emoji: "🚕",
    blurb: "Split a taxi to the airport, share a road trip, find a weekend travel buddy.",
    offer: "I have space",
    request: "I need a ride",
    priced: true,
    categories: ["taxi", "airport", "road-trip", "weekend", "other"],
  },
  free: {
    label: "Free stuff",
    emoji: "🎁",
    blurb: "Things students are giving away. First to collect.",
    offer: "I'm giving away",
    request: "I'm looking for",
    priced: false,
    categories: ["furniture", "kitchen", "books", "electronics", "clothing", "household", "other"],
  },
};

export const exchangeKinds = Object.keys(exchangeKindMeta) as ExchangeKind[];

export type ListingCategory =
  | "furniture"
  | "books"
  | "electronics"
  | "kitchen"
  | "bikes"
  | "clothing"
  | "supplies"
  | "tools"
  | "chargers"
  | "sports"
  | "household"
  | "moving"
  | "translate"
  | "advice"
  | "airport"
  | "tech"
  | "study"
  | "taxi"
  | "road-trip"
  | "weekend"
  | "other"
  /** Legacy lane-as-category from the first marketplace. Rows keep it; new listings use `kind: "free"`. */
  | "free";

export const listingCategoryMeta: Record<ListingCategory, { label: string; emoji: string }> = {
  furniture: { label: "Furniture", emoji: "🪑" },
  books: { label: "Books", emoji: "📗" },
  electronics: { label: "Electronics", emoji: "🎧" },
  kitchen: { label: "Kitchen", emoji: "🍳" },
  bikes: { label: "Bikes", emoji: "🚲" },
  clothing: { label: "Clothes", emoji: "🧥" },
  supplies: { label: "Uni supplies", emoji: "✏️" },
  tools: { label: "Tools", emoji: "🔧" },
  chargers: { label: "Chargers & cables", emoji: "🔌" },
  sports: { label: "Sports kit", emoji: "🏸" },
  household: { label: "Household", emoji: "🧺" },
  moving: { label: "Moving furniture", emoji: "🛋️" },
  translate: { label: "Translate something", emoji: "🌐" },
  advice: { label: "Local advice", emoji: "🧭" },
  airport: { label: "Airport", emoji: "✈️" },
  tech: { label: "Tech help", emoji: "💻" },
  study: { label: "Study help", emoji: "📚" },
  taxi: { label: "Shared taxi", emoji: "🚕" },
  "road-trip": { label: "Road trip", emoji: "🚗" },
  weekend: { label: "Weekend travel", emoji: "🚆" },
  other: { label: "Other", emoji: "✨" },
  free: { label: "Free stuff", emoji: "🎁" },
};

export type ListingMode = "offer" | "request";
export type ListingStatus = "active" | "reserved" | "sold" | "completed" | "withdrawn";

/**
 * An exchange listing.
 *
 * This closes the strongest loop in the product: a student in Leaving Mode has
 * a flat full of things they cannot take, and a student in Arrival Mode needs
 * exactly those things in exactly that city. Neither can find the other on a
 * general classifieds site, and the university Facebook group has been dead
 * since 2019.
 *
 * `meetArea` is a public place label — a campus building, a metro station. The
 * type has no address field at all, so a listing physically cannot carry one.
 *
 * `mode` is what makes it a network rather than a shop: "I need a desk under
 * €30" is a listing too, and it is the one a departing student can answer.
 */
export type Listing = {
  id: Id;
  citySlug: string;
  campusSlug: string | null;
  sellerId: Id;
  /** Which lane. Older rows without one are read as `sell`, or `free` when `category` is `free`. */
  kind?: ExchangeKind;
  /** Offering something, or asking for it. Older rows are offers. */
  mode?: ListingMode;
  title: string;
  detail: string;
  category: ListingCategory;
  priceCents: Cents;
  condition: "new" | "good" | "used" | "worn";
  meetArea: string;
  status: ListingStatus;
  /** Listed as part of Leaving Mode. Surfaced to arriving students first. */
  fromLeaving: boolean;
  /** For rides and borrows: when it is needed or available. */
  whenAt?: Iso | null;
  createdAt: Iso;
  soldAt: Iso | null;
};

/** Resolve the lane for any row, including ones written before lanes existed. */
export function listingKind(listing: Pick<Listing, "kind" | "category">): ExchangeKind {
  if (listing.kind) return listing.kind;
  return listing.category === "free" ? "free" : "sell";
}

export function listingMode(listing: Pick<Listing, "mode">): ListingMode {
  return listing.mode ?? "offer";
}

/** Safety guidance shown on every listing. Not dismissible. */
export const marketplaceSafety = [
  "Meet somewhere public — a campus building or a station, never a flat.",
  "Pay when you collect. Nobody legitimate needs a deposit up front.",
  "Bring a friend for anything large or expensive, and for any ride share.",
  "Report anything that feels off. It is one tap and it is anonymous.",
] as const;

/** The line shown per lane on top of the general guidance. */
export const exchangeKindSafety: Record<ExchangeKind, string> = {
  sell: "Check it works before you pay. Cash or an instant transfer on the spot, never a deposit.",
  borrow: "Agree the return date in the chat so it is written down.",
  help: "Keep it to public places and daylight for anything involving a stranger's flat or yours.",
  ride: "Share the driver's details with a friend and split the fare in the app chat before you leave.",
  free: "Collect from a public place. If someone wants you to come inside, take a friend.",
};

/* -------------------------------------------------------------------------- */
/* Personal memory                                                             */
/* -------------------------------------------------------------------------- */

/**
 * What the product learned from behaviour, as opposed to what the student
 * declared at onboarding.
 *
 * Deliberately an inspectable row of named numbers rather than an embedding: a
 * student must be able to open this, see "you seem to like cheap food and walk
 * a lot", disagree, and reset it. A recommender you cannot see or correct is
 * one people stop trusting the first time it is wrong about them — and they
 * cannot tell you *why* it is wrong, so it never improves.
 */
export type Memory = {
  userId: Id;
  /** Category -> affinity in -1..1. Nudged by saves, joins and dismissals. */
  categoryAffinity: Record<string, number>;
  dislikedPlaceIds: readonly Id[];
  likedPlaceIds: readonly Id[];
  /** The price band actually chosen, not the one declared. */
  observedPriceBandCents: Cents | null;
  /** Observed willingness to travel, in minutes. */
  observedTravelMinutes: number | null;
  updatedAt: Iso;
};

export function emptyMemory(userId: Id, now: Iso): Memory {
  return {
    userId,
    categoryAffinity: {},
    dislikedPlaceIds: [],
    likedPlaceIds: [],
    observedPriceBandCents: null,
    observedTravelMinutes: null,
    updatedAt: now,
  };
}

/**
 * Move an affinity towards a target by a learning rate, clamped to -1..1.
 *
 * The rate is low (0.18) on purpose. A student who saves one museum has not
 * become a museum person, and a recommender that swings on a single tap feels
 * erratic in a way that reads as broken rather than personalised.
 */
export function nudgeAffinity(current: number | undefined, direction: 1 | -1, rate = 0.18): number {
  const value = current ?? 0;
  const next = value + (direction - value) * rate;
  return Math.max(-1, Math.min(1, Math.round(next * 1000) / 1000));
}
