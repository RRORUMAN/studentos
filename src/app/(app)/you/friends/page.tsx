import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PersonRow } from "@/components/app/people";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { findMany } from "@/server/db";
import {
  friendshipWith,
  loadFollowerIds,
  loadFollowingIds,
  suggestedPeople,
  visibleProfile,
} from "@/server/queries/social";
import { requireViewer } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Friends",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * FRIENDS
 * ----------------------------------------------------------------------------
 * Requests, friends, following, people worth knowing, sent, and blocked —
 * matched on campus and interests, never location. Every suggestion carries
 * its reason, and every row can start a conversation.
 *
 * Following is the lighter relationship and has its own list: you can read
 * what someone posts without asking them for anything, and they are told
 * nothing. Friendship is mutual and unlocks friends-only plans and the
 * friends audience.
 * ============================================================================
 */
export default async function FriendsPage() {
  const viewer = await requireViewer();
  const social = !viewer.profile.socialGoals.includes("private");

  const [friendships, profiles, followingIds, followerIds] = await Promise.all([
    findMany("friendships", (row) => row.requesterId === viewer.user.id || row.addresseeId === viewer.user.id),
    findMany("profiles", (row) => row.userId !== viewer.user.id),
    loadFollowingIds(viewer.user.id),
    loadFollowerIds(viewer.user.id),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const other = (row: { requesterId: string; addresseeId: string }) =>
    row.requesterId === viewer.user.id ? row.addresseeId : row.requesterId;

  const requests = friendships.filter((row) => row.status === "pending" && row.addresseeId === viewer.user.id);
  const sent = friendships.filter((row) => row.status === "pending" && row.requesterId === viewer.user.id);
  const friends = friendships.filter((row) => row.status === "accepted");
  const blocked = friendships.filter((row) => row.status === "blocked" && row.requesterId === viewer.user.id);

  const resolve = async (ids: string[]) => {
    const out = [];
    for (const id of ids) {
      const profile = byUser.get(id);
      if (!profile) continue;
      /* Friends and requesters are always visible to each other; blocked rows
         keep only a name so the list can be undone. */
      const visible = (await visibleProfile(viewer.user.id, profile)) ?? {
        userId: profile.userId,
        handle: profile.handle,
        displayName: profile.displayName,
        avatarEmoji: profile.avatarEmoji,
        bio: null,
        citySlug: null,
        campusSlug: null,
        interests: [],
        verified: false,
        termsInCity: profile.termsInCity,
      };
      out.push({ profile: visible, state: await friendshipWith(viewer.user.id, id) });
    }
    return out;
  };

  const friendIdSet = new Set(friends.map(other));
  /* Following is its own list, minus the people already in Friends above. */
  const followingOnly = [...followingIds].filter((id) => !friendIdSet.has(id));

  const [requestRows, friendRows, followingRows, sentRows, blockedRows, suggestions] = await Promise.all([
    resolve(requests.map(other)),
    resolve(friends.map(other)),
    resolve(followingOnly),
    resolve(sent.map(other)),
    resolve(blocked.map((row) => row.addresseeId)),
    social
      ? suggestedPeople({
          viewerId: viewer.user.id,
          citySlug: viewer.profile.citySlug,
          campusSlug: viewer.profile.campusSlug,
          interests: viewer.profile.interests,
          limit: 8,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href="/you" className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        You
      </Link>

      <header className="flex items-start gap-4">
        <MascotArt state="social" className="size-14 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Friends</h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            Friends see each other&rsquo;s plans and get friend-only Anyone Down? posts. Following is one-way and
            silent. You can message any student in your city. Matching uses campus and interests — never where
            anyone is.
          </p>
        </div>
      </header>

      {requestRows.length > 0 ? (
        <section className="mt-7">
          <h2 className="mb-2 text-[1.0625rem] font-semibold text-ink-950">Requests</h2>
          <ul className="space-y-2">
            {requestRows.map((entry) => (
              <PersonRow
                key={entry.profile.userId}
                profile={entry.profile}
                state={entry.state}
                reason="Wants to connect"
                following={followingIds.has(entry.profile.userId)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-7">
        <h2 className="mb-2 text-[1.0625rem] font-semibold text-ink-950">
          Friends {friendRows.length > 0 ? <span className="tnum text-ink-400">{friendRows.length}</span> : null}
        </h2>
        {friendRows.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-8 text-center ring-1 ring-ink-950/6">
            <p className="text-[0.9375rem] text-ink-700">Start with your campus. Everyone below shares something with you.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {friendRows.map((entry) => (
              <PersonRow
                key={entry.profile.userId}
                profile={entry.profile}
                state={entry.state}
                following={followingIds.has(entry.profile.userId)}
              />
            ))}
          </ul>
        )}
      </section>

      {followingRows.length > 0 ? (
        <section className="mt-7">
          <h2 className="mb-2 text-[1.0625rem] font-semibold text-ink-950">
            Following <span className="tnum text-ink-400">{followingRows.length}</span>
          </h2>
          <ul className="space-y-2">
            {followingRows.map((entry) => (
              <PersonRow
                key={entry.profile.userId}
                profile={entry.profile}
                state={entry.state}
                following
                reason={followerIds.has(entry.profile.userId) ? "Follows you back" : "Their posts reach your Following feed"}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {social ? (
        <section className="mt-7">
          <h2 className="mb-2 text-[1.0625rem] font-semibold text-ink-950">People worth knowing</h2>
          {suggestions.length === 0 ? (
            <p className="rounded-2xl bg-white px-5 py-8 text-center text-[0.9375rem] text-ink-600 ring-1 ring-ink-950/6">
              Nobody matching yet. Add a campus and a few interests and this fills in as students join.
            </p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((entry) => (
                <PersonRow
                  key={entry.profile.userId}
                  profile={entry.profile}
                  state="none"
                  following={followingIds.has(entry.profile.userId)}
                  reason={
                    entry.shared.length > 0
                      ? `Also into ${entry.shared.slice(0, 2).map((tag) => tag.replace(/-/g, " ")).join(" and ")}${entry.sameCampus ? " · your campus" : ""}`
                      : "Your campus"
                  }
                />
              ))}
            </ul>
          )}
          {!viewer.entitlements.can.advancedSocialMatching && suggestions.length > 0 ? (
            <div className="mt-4">
              <Upsell feature="advancedSocialMatching" line="These are matched on campus and interests. Pro also matches on budget range and the plans you both join, and shows who is going to the same things." />
            </div>
          ) : null}
        </section>
      ) : (
        <p className="mt-7 rounded-2xl bg-paper-2 px-5 py-4 text-[0.875rem] text-ink-600">
          You chose to use {`StudentOS`} privately, so nobody is suggested to you and you are not suggested to anyone.{" "}
          <Link href="/you/privacy" className="font-medium text-ink-900 underline underline-offset-4">Change that</Link>
        </p>
      )}

      {sentRows.length > 0 ? (
        <section className="mt-7">
          <h2 className="mb-2 text-[1.0625rem] font-semibold text-ink-950">Sent</h2>
          <ul className="space-y-2">
            {sentRows.map((entry) => (
              <PersonRow
                key={entry.profile.userId}
                profile={entry.profile}
                state={entry.state}
                reason="Waiting for them"
                following={followingIds.has(entry.profile.userId)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {blockedRows.length > 0 ? (
        <section className="mt-7">
          <h2 className="mb-2 text-[1.0625rem] font-semibold text-ink-950">Blocked</h2>
          <ul className="space-y-2">
            {blockedRows.map((entry) => (
              <PersonRow
                key={entry.profile.userId}
                profile={entry.profile}
                state="blocked"
                canMessage={false}
                reason="Cannot see you or your plans"
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
