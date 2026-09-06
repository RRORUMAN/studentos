import type { Place } from "@/data/types";
import type { Cents, CityEvent, CommunityPost, Deal, Invite } from "@/domain/types";
import type { Scored } from "@/server/engines/recommend";

/**
 * ============================================================================
 * FOR YOU FEED
 * ----------------------------------------------------------------------------
 * One ranked, mixed list instead of five separate rails: events, places, deals,
 * open plans and community posts, interleaved so no single kind owns the top.
 *
 * Every card carries the reasons it is there, and a card with no reason is
 * dropped rather than shown with a generic "recommended for you". That rule is
 * what separates personalisation from decoration: if the product cannot say
 * *why*, it should not be saying anything.
 *
 * Pure. The scorers in `recommend.ts` have already done the maths; this file
 * arranges their output.
 * ============================================================================
 */

export type FeedKind = "event" | "place" | "deal" | "invite" | "post";

export type FeedItem = {
  kind: FeedKind;
  id: string;
  href: string;
  title: string;
  /** One line under the title: venue and time, category and walk, etc. */
  meta: string;
  priceCents: Cents | null;
  /** 0-100, when the item was scored. */
  match: number | null;
  /** Why this is here. Facts from the row, never generated. */
  reasons: string[];
  /** Social proof that exists on the row. */
  social: string | null;
  /** Used for ordering only. */
  score: number;
  /** When the thing happens, for the time chip. Null for places and deals. */
  startsAt: string | null;
  tag: "free" | "deal" | "tonight" | "friends" | "campus" | null;
};

export type FeedInput = {
  events: readonly Scored<CityEvent>[];
  places: readonly Scored<Place>[];
  deals: readonly (Deal & { confidence: string })[];
  invites: readonly (Invite & { going: number; hostName: string | null })[];
  posts: readonly (CommunityPost & { score: number })[];
  /** Ids of events friends are interested in or going to. */
  friendEventIds: ReadonlySet<string>;
  /** Categories the student spends in, from their envelopes. */
  spendingCategories: ReadonlySet<string>;
  campusSlug: string | null;
  now: Date;
  limit?: number;
};

const TONIGHT_MS = 16 * 3_600_000;

export function buildForYouFeed(input: FeedInput): FeedItem[] {
  const now = input.now.getTime();
  const items: FeedItem[] = [];

  /* ---- events ----------------------------------------------------------- */
  for (const scored of input.events) {
    const event = scored.item;
    if (scored.reasons.length === 0) continue;
    const startsIn = Date.parse(event.startsAt) - now;
    const tonight = startsIn >= -3_600_000 && startsIn <= TONIGHT_MS;
    const friends = input.friendEventIds.has(event.id);

    items.push({
      kind: "event",
      id: event.id,
      href: `/events/${event.id}`,
      title: event.title,
      meta: event.venue,
      priceCents: event.priceCents,
      match: scored.match,
      reasons: scored.reasons,
      social:
        event.interested >= 5 ? `${event.interested} students interested` : null,
      /* Soon and social things float. A great event next month is still a
         great event, but not for the top of today's feed. */
      score:
        scored.match +
        (tonight ? 12 : startsIn < 3 * 86_400_000 ? 6 : 0) +
        (friends ? 15 : 0) +
        (event.priceCents === 0 ? 4 : 0),
      startsAt: event.startsAt,
      tag: friends ? "friends" : event.priceCents === 0 ? "free" : tonight ? "tonight" : null,
    });
  }

  /* ---- places ----------------------------------------------------------- */
  for (const scored of input.places) {
    const place = scored.item;
    if (scored.reasons.length === 0 || scored.match < 55) continue;
    items.push({
      kind: "place",
      id: place.id,
      href: `/discover/${place.id}`,
      title: place.name,
      meta: `${place.category} · ${place.walkMinutes} min walk`,
      priceCents: place.price === null ? null : Math.round(place.price * 100),
      match: scored.match,
      reasons: scored.reasons,
      social: place.verifiedBy >= 10 ? `${place.verifiedBy} students confirmed this` : null,
      /* Places are evergreen, so they are held slightly below time-bound rows. */
      score: scored.match - 4,
      startsAt: null,
      tag: place.price === 0 ? "free" : null,
    });
  }

  /* ---- deals ------------------------------------------------------------ */
  for (const deal of input.deals) {
    if (deal.confidence === "expired" || deal.confidence === "disputed") continue;
    const relevant = input.spendingCategories.has(deal.category);
    if (!relevant && deal.confidence !== "verified") continue;
    const reasons: string[] = [];
    if (relevant) reasons.push(`You budget for ${deal.category.replace(/-/g, " ")}`);
    if (deal.confidence === "verified") reasons.push("Confirmed working by students");
    if (deal.requiresStudentId) reasons.push("Bring your student card");
    items.push({
      kind: "deal",
      id: deal.id,
      href: "/discover?tab=deals",
      title: deal.title,
      meta: deal.value,
      priceCents: null,
      match: null,
      reasons,
      social: deal.confirmations >= 3 ? `${deal.confirmations} students used this` : null,
      score: 58 + (relevant ? 10 : 0) + (deal.confidence === "verified" ? 8 : 0),
      startsAt: null,
      tag: "deal",
    });
  }

  /* ---- open plans ------------------------------------------------------- */
  for (const invite of input.invites) {
    const startsIn = Date.parse(invite.startsAt) - now;
    if (startsIn < -3_600_000) continue;
    const reasons: string[] = [];
    if (invite.going > 0) reasons.push(`${invite.going} already in`);
    if (invite.capacity - invite.going > 0) reasons.push(`${invite.capacity - invite.going} ${invite.capacity - invite.going === 1 ? "spot" : "spots"} left`);
    if (invite.budgetCents !== null && invite.budgetCents <= 1500) reasons.push("Cheap");
    if (reasons.length === 0) continue;
    items.push({
      kind: "invite",
      id: invite.id,
      href: `/anyone-down/${invite.id}`,
      title: invite.title,
      meta: invite.hostName ? `${invite.hostName} is looking for people` : "Someone is looking for people",
      priceCents: invite.budgetCents,
      match: null,
      reasons,
      social: null,
      score: 64 + (startsIn <= 2 * 86_400_000 ? 8 : 0) + Math.min(10, invite.going * 3),
      startsAt: invite.startsAt,
      tag: invite.audience === "campus" ? "campus" : null,
    });
  }

  /* ---- posts ------------------------------------------------------------ */
  for (const post of input.posts) {
    const campus = Boolean(input.campusSlug && post.campusSlug === input.campusSlug);
    const reasons: string[] = [];
    if (campus) reasons.push("From your campus");
    if (post.kind === "deal") reasons.push("A deal students reported");
    if (post.kind === "question" && post.commentCount >= 3) reasons.push(`${post.commentCount} answers`);
    if (post.upvotes >= 20) reasons.push(`${post.upvotes} upvotes`);
    if (reasons.length === 0) continue;
    items.push({
      kind: "post",
      id: post.id,
      href: `/pulse/${post.id}`,
      title: post.title,
      meta: `#${post.channel}`,
      priceCents: null,
      match: null,
      reasons,
      social: post.commentCount > 0 ? `${post.commentCount} ${post.commentCount === 1 ? "reply" : "replies"}` : null,
      score: 50 + Math.min(20, post.score * 4) + (campus ? 8 : 0),
      startsAt: null,
      tag: campus ? "campus" : null,
    });
  }

  return interleave(items.sort((a, b) => b.score - a.score)).slice(0, input.limit ?? 12);
}

/**
 * Stop one kind owning the top. At most two of the same kind in any window of
 * three, preserving score order otherwise.
 */
export function interleave(sorted: readonly FeedItem[]): FeedItem[] {
  const out: FeedItem[] = [];
  const pending = [...sorted];

  while (pending.length > 0) {
    const last = out.slice(-2).map((item) => item.kind);
    const blocked = last.length === 2 && last[0] === last[1] ? last[0] : null;
    const index = blocked ? pending.findIndex((item) => item.kind !== blocked) : 0;
    const pick = index === -1 ? 0 : index;
    out.push(pending.splice(pick, 1)[0]);
  }

  return out;
}
