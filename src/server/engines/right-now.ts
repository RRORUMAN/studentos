import type { CityEvent, CommunityPost, Invite } from "@/domain/types";

/**
 * ============================================================================
 * RIGHT NOW
 * ----------------------------------------------------------------------------
 * What is relevant in the next few hours: happening now, starting soon, free
 * right now, plans filling up, and what students posted in the last while.
 *
 * Only facts the rows support. Places carry no opening hours in this data, so
 * there is no "open now" claim anywhere in this file — inventing one is exactly
 * the kind of confident wrongness a student stops forgiving after once.
 *
 * Nothing about where any student physically is. Ever.
 * ============================================================================
 */

export type RightNowItem = {
  kind: "happening" | "soon" | "free-now" | "filling" | "posted";
  id: string;
  title: string;
  meta: string;
  href: string;
  /** Minutes until it starts. Negative when already under way. */
  inMinutes: number | null;
  free: boolean;
};

export function rightNow(input: {
  now: Date;
  events: readonly CityEvent[];
  invites: readonly (Invite & { going: number })[];
  posts: readonly CommunityPost[];
  limit?: number;
}): RightNowItem[] {
  const now = input.now.getTime();
  const out: RightNowItem[] = [];

  for (const event of input.events) {
    const starts = Date.parse(event.startsAt);
    const ends = event.endsAt ? Date.parse(event.endsAt) : starts + 2 * 3_600_000;
    const inMinutes = Math.round((starts - now) / 60_000);

    if (starts <= now && ends > now) {
      out.push({
        kind: "happening",
        id: event.id,
        title: event.title,
        meta: `Under way at ${event.venue}`,
        href: `/events/${event.id}`,
        inMinutes,
        free: event.priceCents === 0,
      });
    } else if (inMinutes > 0 && inMinutes <= 180) {
      out.push({
        kind: event.priceCents === 0 ? "free-now" : "soon",
        id: event.id,
        title: event.title,
        meta: `Starts in ${inMinutes < 60 ? `${inMinutes} min` : `${Math.round(inMinutes / 60)}h`} · ${event.venue}`,
        href: `/events/${event.id}`,
        inMinutes,
        free: event.priceCents === 0,
      });
    }
  }

  for (const invite of input.invites) {
    const starts = Date.parse(invite.startsAt);
    const inMinutes = Math.round((starts - now) / 60_000);
    const spots = invite.capacity - invite.going;
    if (inMinutes < -60 || inMinutes > 6 * 60 || spots <= 0) continue;
    out.push({
      kind: "filling",
      id: invite.id,
      title: invite.title,
      meta: `${invite.going} in, ${spots} ${spots === 1 ? "spot" : "spots"} left`,
      href: `/anyone-down/${invite.id}`,
      inMinutes,
      free: invite.budgetCents === 0,
    });
  }

  const recentPosts = input.posts
    .filter((post) => now - Date.parse(post.createdAt) <= 3 * 3_600_000 && post.hiddenAt === null)
    .sort((a, b) => b.upvotes + b.commentCount - (a.upvotes + a.commentCount))
    .slice(0, 2);

  for (const post of recentPosts) {
    const minutes = Math.round((now - Date.parse(post.createdAt)) / 60_000);
    out.push({
      kind: "posted",
      id: post.id,
      title: post.title,
      meta: `#${post.channel} · ${minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`}`,
      href: `/pulse/${post.id}`,
      inMinutes: null,
      free: false,
    });
  }

  const order: Record<RightNowItem["kind"], number> = {
    happening: 0,
    "free-now": 1,
    soon: 2,
    filling: 3,
    posted: 4,
  };

  return out
    .sort((a, b) => order[a.kind] - order[b.kind] || (a.inMinutes ?? 0) - (b.inMinutes ?? 0))
    .slice(0, input.limit ?? 6);
}
